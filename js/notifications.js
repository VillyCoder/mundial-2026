/*
 * notifications.js
 * Sistema de notificaciones push para la PWA.
 * Detecta cambios en los partidos del equipo favorito (goles, inicio, final)
 * y muestra notificaciones del navegador aunque la app este en segundo plano.
 *
 * No requiere clave VAPID ni backend propio: funciona con la Notifications API
 * del navegador y el Service Worker ya registrado.
 *
 * Flujo:
 *   1. El usuario activa las notificaciones en "Mi Equipo".
 *   2. Se pide permiso al navegador (una sola vez).
 *   3. Se arranca un polling cada 30 segundos a /api/matches.
 *   4. Al detectar un gol, se llama a /api/match-detail para obtener el goleador.
 *   5. Se muestra la notificacion con banderas, marcador y nombre del goleador.
 */

import { Scraper } from './scraper.js';
import { Storage } from './storage.js';

const POLL_MS_IDLE = 30000;
const POLL_MS_LIVE = 15000;

const ALERTS_KEY = 'mundial_alerts';

export const NotificationSystem = {
    pollingTimer: null,
    matchStates: new Map(),
    remindersScheduled: new Set(),

    // Comprueba si las notificaciones estan activas (permiso concedido + toggle ON)
    isEnabled() {
        return 'Notification' in window
            && Notification.permission === 'granted'
            && Storage.get('notifications');
    },

    // Devuelve el mapa de alertas individuales guardadas en localStorage
    getAlerts() {
        try { return JSON.parse(localStorage.getItem(ALERTS_KEY) || '{}'); } catch { return {}; }
    },

    // Indica si un partido concreto tiene la campanita activada
    isAlerted(matchId) {
        return !!this.getAlerts()[matchId];
    },

    // Activa o desactiva la alerta de un partido. Devuelve true/false/null (null = sin permiso)
    async toggleAlert(matchId, matchInfo) {
        const alerts = this.getAlerts();
        if (alerts[matchId]) {
            delete alerts[matchId];
            localStorage.setItem(ALERTS_KEY, JSON.stringify(alerts));
            return false;
        }
        if (!('Notification' in window)) return null;
        if (Notification.permission === 'default') {
            const granted = await this.requestPermission();
            if (!granted) return null;
        }
        if (Notification.permission !== 'granted') return null;
        alerts[matchId] = matchInfo;
        localStorage.setItem(ALERTS_KEY, JSON.stringify(alerts));
        // Si el polling no esta corriendo, lo arrancamos ahora
        if (!this.pollingTimer) {
            const code = this.favCode || '';
            this.checkLive(code);
            this.schedulePoll(code);
        }
        return true;
    },

    // Pide permiso de notificacion al navegador y guarda el resultado
    async requestPermission() {
        if (!('Notification' in window)) return false;
        const permission = await Notification.requestPermission();
        return permission === 'granted';
    },

    // Arranca el polling y comprueba partidos proximos.
    // Usa un intervalo corto (15s) cuando hay partido en vivo para reducir el retardo,
    // y uno largo (30s) cuando no hay nada en juego para no gastar bateria.
    // Arranca si el usuario tiene el toggle global O si tiene bells con permiso concedido.
    start(favCode) {
        this.stop();
        this.favCode = favCode;
        const hasAlerts = Object.keys(this.getAlerts()).length > 0;
        const bellsReady = hasAlerts && Notification.permission === 'granted';
        if (!this.isEnabled() && !bellsReady) return;
        if (this.isEnabled()) this.checkUpcoming(favCode);
        this.schedulePoll(favCode);
    },

    schedulePoll(favCode) {
        const hasLive = [...this.matchStates.values()].some(s => s.status === 'live');
        const interval = hasLive ? POLL_MS_LIVE : POLL_MS_IDLE;
        this.pollingTimer = setTimeout(async () => {
            await this.checkLive(favCode);
            this.schedulePoll(favCode);
        }, interval);
    },

    stop() {
        if (this.pollingTimer) { clearTimeout(this.pollingTimer); this.pollingTimer = null; }
        this.matchStates.clear();
        this.remindersScheduled.clear();
    },

    // Comprueba si el equipo favorito tiene partido en la proxima hora
    // y programa una notificacion de aviso 30 minutos antes del inicio
    async checkUpcoming(favCode) {
        try {
            const data = await Scraper.getTeamSchedule(favCode);
            const now = Date.now();
            for (const m of (data?.matches || [])) {
                if (m.status !== 'scheduled') continue;
                const kickoff = new Date(m.date).getTime();
                const msUntil = kickoff - now;
                const minUntil = Math.round(msUntil / 60000);
                const remKey = `remind_${m.id}`;

                if (this.remindersScheduled.has(remKey)) continue;
                this.remindersScheduled.add(remKey);

                const rival = favCode === m.homeCode ? m.awayTeam : m.homeTeam;
                const icon = favCode === m.homeCode ? m.homeLogo : m.awayLogo;
                const matchUrl = `#/match/${m.id}`;

                if (minUntil <= 0) continue;

                if (minUntil <= 30) {
                    // El partido empieza en menos de 30 minutos: avisa ya
                    this.show(
                        `Partido en ${minUntil} minutos`,
                        `${m.homeTeam} vs ${m.awayTeam} - ${m.dateMadrid} h`,
                        icon, `upcoming_${m.id}`, matchUrl
                    );
                } else if (minUntil <= 120) {
                    // Programa la notificacion para cuando queden 30 minutos
                    const delay = msUntil - 30 * 60000;
                    setTimeout(() => {
                        if (!this.isEnabled()) return;
                        this.show(
                            'Partido en 30 minutos',
                            `${m.homeTeam} vs ${m.awayTeam} - ${m.dateMadrid} h`,
                            icon, `upcoming_${m.id}`, matchUrl
                        );
                    }, delay);
                }
            }
        } catch (_) {}
    },

    // Comprueba partidos en vivo del equipo favorito Y partidos con campanita activada
    async checkLive(favCode) {
        try {
            const data = await Scraper.getMatches();
            const alertedIds = Object.keys(this.getAlerts());
            for (const m of (data?.matches || [])) {
                const isFav = m.homeCode === favCode || m.awayCode === favCode;
                const isAlerted = alertedIds.includes(m.id);
                if (!isFav && !isAlerted) continue;
                // El equipo favorito requiere el toggle global; la campanita solo necesita permiso
                const canNotify = isFav ? this.isEnabled() : Notification.permission === 'granted';
                if (!canNotify) continue;

                const prev = this.matchStates.get(m.id);
                const curr = {
                    status: m.status,
                    homeScore: m.homeScore ?? 0,
                    awayScore: m.awayScore ?? 0,
                    clock: m.clock
                };

                if (prev) {
                    const prevTotal = prev.homeScore + prev.awayScore;
                    const currTotal = curr.homeScore + curr.awayScore;

                    if (currTotal > prevTotal) {
                        // Hay un gol nuevo: buscamos al goleador en el detalle
                        await this.onGoal(m, curr);
                    }

                    if (prev.status === 'scheduled' && curr.status === 'live') {
                        this.show(
                            '¡Empieza el partido!',
                            `${m.homeTeam} ${curr.homeScore}-${curr.awayScore} ${m.awayTeam}`,
                            m.homeLogo, `kickoff_${m.id}`, `#/match/${m.id}`
                        );
                    }

                    if (prev.status === 'live' && curr.status === 'finished') {
                        const winner = curr.homeScore > curr.awayScore ? m.homeTeam
                            : curr.awayScore > curr.homeScore ? m.awayTeam : 'Empate';
                        this.show(
                            `FINAL: ${m.homeTeam} ${curr.homeScore}-${curr.awayScore} ${m.awayTeam}`,
                            winner === 'Empate' ? 'Partido terminado en empate' : `Gana ${winner}`,
                            m.homeLogo, `final_${m.id}`, `#/match/${m.id}`
                        );
                    }
                }

                this.matchStates.set(m.id, curr);
            }
        } catch (_) {}
    },

    // Cuando se detecta un gol: obtiene el nombre del goleador y su foto
    async onGoal(match, curr) {
        let body = `Minuto ${curr.clock || '?'}`;
        let image = '';

        try {
            const dateStr = match.date?.split('T')[0]?.replace(/-/g, '') || '';
            Scraper.clear(`detail_${match.id}`);
            const detail = await Scraper.getMatchDetail(match.id, dateStr);
            const allEvents = [...(detail?.details || []), ...(detail?.plays || [])];
            const goals = allEvents
                .filter(p => p.scoringPlay || p.type === 'Goal')
                .sort((a, b) => (parseInt(b.minute) || 0) - (parseInt(a.minute) || 0));
            const lastGoal = goals[0];

            if (lastGoal?.athletes?.[0]?.name) {
                const scorer = lastGoal.athletes[0].name;
                body = `Gol de ${scorer} (${curr.clock || '?'})`;
                try {
                    const photo = await Scraper.getPlayerPhoto(scorer);
                    if (photo?.thumb) image = photo.thumb;
                } catch (_) {}
            }
        } catch (_) {}

        const title = `¡GOL! ${match.homeTeam} ${curr.homeScore}-${curr.awayScore} ${match.awayTeam}`;
        const tag = `goal_${match.id}_${curr.homeScore}_${curr.awayScore}`;
        const icon = match.homeLogo;

        this.show(title, body, icon, tag, `#/match/${match.id}`, image);
    },

    // Muestra la notificacion usando el Service Worker si esta disponible.
    // Solo necesita permiso del navegador; el toggle global lo comprueba quien llama.
    show(title, body, icon, tag, url = '#/', image = '') {
        if (Notification.permission !== 'granted') return;
        const options = {
            body,
            tag,
            icon: icon || '',
            badge: icon || '',
            data: { url },
            requireInteraction: false,
            vibrate: [100, 50, 200]
        };
        if (image) options.image = image;

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready
                .then(sw => sw.showNotification(title, options))
                .catch(() => new Notification(title, options));
        } else {
            new Notification(title, options);
        }
    }
};

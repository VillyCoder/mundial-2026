/*
 * match-detail.js
 * Pagina de detalle de un partido: marcador, cronologia de eventos,
 * estadisticas por equipo y mapas de formacion con alineaciones.
 *
 * Para las alineaciones combina dos fuentes:
 *   - ESPN Core API: da la formacion oficial (ej: "4-3-3") y el puesto de cada jugador.
 *   - ESPN Site API: da los nombres y posiciones de los jugadores.
 * Cuando un partido no ha empezado, la alineacion no esta disponible y se muestra
 * la plantilla completa como fallback.
 */

import { Scraper } from '../scraper.js';
import { getFavoriteTeam, ensureVisibleColor } from '../config.js';
import { renderChannelRow } from '../channels.js';

// ESPN solo devuelve 4 categorias de posicion (G, D, M, F).
// Las traducimos al espanol para mostrarlas en la interfaz.
const POSITION_ES = {
    'G': 'POR', 'GK': 'POR', 'GKP': 'POR',
    'D': 'DEF',
    'M': 'MC',
    'F': 'DEL'
};
const POSITION_FULL_ES = {
    'G': 'Portero', 'GK': 'Portero', 'GKP': 'Portero',
    'D': 'Defensa',
    'M': 'Centrocampista',
    'F': 'Delantero'
};

const STAGE_NAMES = {
    'FIFA World Cup, Group A': 'Grupo A', 'FIFA World Cup, Group B': 'Grupo B',
    'FIFA World Cup, Group C': 'Grupo C', 'FIFA World Cup, Group D': 'Grupo D',
    'FIFA World Cup, Group E': 'Grupo E', 'FIFA World Cup, Group F': 'Grupo F',
    'FIFA World Cup, Group G': 'Grupo G', 'FIFA World Cup, Group H': 'Grupo H',
    'FIFA World Cup, Group I': 'Grupo I', 'FIFA World Cup, Group J': 'Grupo J',
    'FIFA World Cup, Group K': 'Grupo K', 'FIFA World Cup, Group L': 'Grupo L',
    'Round of 32': 'Octavos de final', 'Rd of 16': 'Octavos de final',
    'Quarterfinals': 'Cuartos de final', 'Semifinals': 'Semifinal',
    'Third Place': 'Tercer puesto', 'Final': 'FINAL'
};

export const MatchDetail = {
    refreshTimer: null,
    currentMatch: null,

    async render(container, params) {
        this.stopRefresh();
        const matchId = params?.id;
        if (!matchId) { container.innerHTML = '<div class="error">Partido no encontrado</div>'; return; }
        container.innerHTML = '<div class="loading">Cargando detalles...</div>';

        const matchDate = params?.date || '';
        const espnData = await Scraper.getCalendar(matchDate);
        let espnMatch = espnData?.matches?.find(m => m.id === matchId);

        // Partidos a medianoche UTC (ej: 00:00Z) pueden aparecer en el calendario
        // del dia anterior. Si no se encuentra, intentar el dia previo.
        if (!espnMatch && matchDate.length === 8) {
            const y = parseInt(matchDate.slice(0, 4));
            const mo = parseInt(matchDate.slice(4, 6)) - 1;
            const d = parseInt(matchDate.slice(6, 8));
            const prev = new Date(Date.UTC(y, mo, d - 1));
            const prevKey = prev.getUTCFullYear().toString()
                + String(prev.getUTCMonth() + 1).padStart(2, '0')
                + String(prev.getUTCDate()).padStart(2, '0');
            const prevData = await Scraper.getCalendar(prevKey);
            espnMatch = prevData?.matches?.find(m => m.id === matchId) || null;
        }

        const cdnData = await Scraper.getMatchDetail(matchId, espnMatch?.date?.split('T')[0]?.replace(/-/g, '') || matchDate);

        if (!espnMatch && cdnData) {
            espnMatch = cdnData;
        }

        const match = this.combineData(espnMatch, cdnData);
        if (!match) { container.innerHTML = '<div class="error">Partido no encontrado</div>'; return; }

        this.currentMatch = match;
        this.renderPage(container, match);

        if (match.status === 'live') {
            this.startRefresh(container, matchId, matchDate);
        }
    },

    stopRefresh() {
        if (this.refreshTimer) { clearInterval(this.refreshTimer); this.refreshTimer = null; }
    },

    startRefresh(container, matchId, matchDate) {
        this.stopRefresh();
        this.refreshTimer = setInterval(async () => {
            try {
                Scraper.clear(`detail_${matchId}`);
                const espnData = await Scraper.getMatches();
                const espnMatch = espnData?.matches?.find(m => m.id === matchId);
                const cdnData = await Scraper.getMatchDetail(matchId, matchDate);
                const match = this.combineData(espnMatch, cdnData);
                if (match) {
                    this.currentMatch = match;
                    this.updateLiveUI(container, match);
                }
                if (espnMatch?.status !== 'live') { this.stopRefresh(); }
            } catch (_) {}
        }, 30000);
    },

    updateLiveUI(container, m) {
        const scoreEl = container.querySelector('.detail-score');
        if (scoreEl) {
            scoreEl.innerHTML = `
                <span class="detail-status-badge live">${m.clock || 'EN VIVO'}</span>
                <div class="detail-score-numbers">
                    <span class="detail-score-val">${m.homeScore != null ? m.homeScore : '-'}</span>
                    <span class="detail-score-sep">:</span>
                    <span class="detail-score-val">${m.awayScore != null ? m.awayScore : '-'}</span>
                </div>`;
        }
        const contentEl = document.getElementById('detail-content');
        if (contentEl) {
            const activeTab = container.querySelector('.detail-tab.active')?.dataset.tab || 'events';
            this.renderTabContent(activeTab, m, contentEl);
        }
        const tabEls = container.querySelectorAll('.detail-tab');
        tabEls.forEach(t => {
            const tab = t.dataset.tab;
            if (tab === 'events') t.textContent = `Eventos (${m.plays?.length || 0})`;
        });
    },

    combineData(espn, cdn) {
        if (!espn && !cdn) return null;
        const allEvents = cdn?.details?.length ? cdn.details : cdn?.plays || [];
        const sorted = [...allEvents].sort((a, b) => {
            const ma = parseInt(a.minute) || 0;
            const mb = parseInt(b.minute) || 0;
            return ma - mb;
        });
        const goals = sorted.filter(p => p.scoringPlay || p.type === 'Goal');
        const cards = sorted.filter(p => p.yellowCard || p.redCard || p.type?.includes('Card'));
        const subs = sorted.filter(p => p.substitution || p.type === 'Substitution');

        return {
            id: espn?.id || cdn?.gameId,
            date: espn?.date,
            dateMadrid: espn?.dateMadrid || cdn?.dateMadrid || '',
            homeTeam: espn?.homeTeam || cdn?.homeTeam || '???',
            awayTeam: espn?.awayTeam || cdn?.awayTeam || '???',
            homeLogo: espn?.homeLogo || cdn?.homeLogo || '',
            awayLogo: espn?.awayLogo || cdn?.awayLogo || '',
            homeId: espn?.homeId || '', awayId: espn?.awayId || '',
            homeCode: espn?.homeCode || cdn?.homeCode || '',
            awayCode: espn?.awayCode || cdn?.awayCode || '',
            homeColor: espn?.homeColor || cdn?.homeColor || '',
            awayColor: espn?.awayColor || cdn?.awayColor || '',
            homeScore: espn?.homeScore, awayScore: espn?.awayScore,
            status: espn?.status || cdn?.status || 'scheduled', clock: espn?.clock,
            group: espn?.group || '', venue: espn?.venue || '',
            city: espn?.city || '', country: espn?.country || '',
            attendance: espn?.attendance,
            goals, cards, subs, plays: sorted,
            teamStats: cdn?.teamStats || [],
            odds: cdn?.odds || espn?.odds || null,
            homeFormation: espn?.homeFormation || '',
            awayFormation: espn?.awayFormation || '',
            spanishChannels: espn?.spanishChannels || []
        };
    },

    renderPage(container, m) {
        const status = m.status === 'finished' ? 'FINAL' :
                      m.status === 'live' ? m.clock || 'EN VIVO' :
                      m.dateMadrid || 'Por jugar';
        const fav = getFavoriteTeam();
        const isFav = m.homeTeam === fav.name || m.awayTeam === fav.name || m.homeCode === fav.code || m.awayCode === fav.code;
        const dateStr = m.date ? new Date(m.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }) : '';

        container.innerHTML = `
        <div class="match-detail-page">
            <a href="#/live" class="back-link">Volver</a>
            <div class="detail-header">
                <span class="detail-stage">${STAGE_NAMES[m.group] || m.group || ''}</span>
                <span class="detail-date">${dateStr}${m.dateMadrid ? ' - ' + m.dateMadrid + ' h' : ''}</span>
            </div>
            <div class="detail-scorecard ${isFav ? 'spain-match' : ''}">
                <div class="detail-team">
                    ${m.homeLogo ? `<img class="detail-flag" src="${m.homeLogo}" alt="${m.homeCode}" onerror="this.style.display='none'">` : ''}
                    <span class="detail-team-name">${m.homeTeam}</span>
                </div>
                <div class="detail-score">
                    <span class="detail-status-badge ${m.status === 'finished' ? 'ft' : m.status === 'live' ? 'live' : ''}">${status}</span>
                    <div class="detail-score-numbers">
                        <span class="detail-score-val">${m.homeScore != null ? m.homeScore : '-'}</span>
                        <span class="detail-score-sep">:</span>
                        <span class="detail-score-val">${m.awayScore != null ? m.awayScore : '-'}</span>
                    </div>
                </div>
                <div class="detail-team">
                    ${m.awayLogo ? `<img class="detail-flag" src="${m.awayLogo}" alt="${m.awayCode}" onerror="this.style.display='none'">` : ''}
                    <span class="detail-team-name">${m.awayTeam}</span>
                </div>
            </div>
            <div class="detail-info-bar">
                ${m.venue ? `<span>${m.venue}</span>` : ''}
                ${m.city ? `<span>${m.city}${m.country ? ', ' + m.country : ''}</span>` : ''}
                ${m.attendance ? `<span>${m.attendance.toLocaleString()} asistentes</span>` : ''}
                ${renderChannelRow(m.spanishChannels, 'detail-broadcast-row')}
            </div>
            <div class="detail-tabs">
                <button class="detail-tab active" data-tab="events">Eventos (${m.plays?.length || 0})</button>
                ${m.teamStats?.length ? '<button class="detail-tab" data-tab="stats">Estadisticas</button>' : ''}
                <button class="detail-tab" data-tab="lineups">Convocatoria</button>
            </div>
            <div id="detail-content" class="detail-content"></div>
        </div>`;
        this.setupTabs(container, m);
        this.renderTabContent('events', m, document.getElementById('detail-content'));
    },

    setupTabs(container, m) {
        container.querySelectorAll('.detail-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                container.querySelectorAll('.detail-tab').forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                this.renderTabContent(e.target.dataset.tab, m, document.getElementById('detail-content'));
            });
        });
    },

    renderTabContent(tab, m, el) {
        if (!el) return;
        switch (tab) {
            case 'events': el.innerHTML = this.renderTimeline(m); break;
            case 'goals': el.innerHTML = this.renderGoals(m); break;
            case 'cards': el.innerHTML = this.renderCards(m); break;
            case 'stats': el.innerHTML = this.renderStats(m); break;
            case 'lineups': this.renderLineups(m, el); break;
        }
    },

    renderTimeline(m) {
        if (!m.plays?.length) {
            const msg = m.status === 'scheduled'
                ? `<div class="no-data">El partido comienza el ${m.dateMadrid ? m.dateMadrid + ' h' : 'proximamente'}.<br>Los eventos apareceran aqui cuando empiece.</div>`
                : '<div class="no-data">Sin eventos disponibles</div>';
            return msg;
        }

        // Iconos SVG inline para los tipos de evento
        // Balon: Material Icons sports_soccer (Google Fonts, licencia Apache 2.0)
        const ICON_GOAL = `<svg class="tl-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="white" fill-rule="evenodd" d="M12,2C6.48,2,2,6.48,2,12s4.48,10,10,10s10-4.48,10-10S17.52,2,12,2z M13,5.3l1.35-0.95c1.82,0.56,3.37,1.76,4.38,3.34l-0.39,1.34l-1.35,0.46L13,6.7V5.3z M9.65,4.35L11,5.3v1.4L7.01,9.49L5.66,9.03L5.27,7.69C6.28,6.12,7.83,4.92,9.65,4.35z M7.08,17.11l-1.14,0.1C4.73,15.81,4,13.99,4,12c0-0.12,0.01-0.23,0.02-0.35l1-0.73L6.4,11.4l1.46,4.34L7.08,17.11z M14.5,19.59C13.71,19.85,12.87,20,12,20s-1.71-0.15-2.5-0.41L8.81,18.1L9.45,17h5.11l0.64,1.11L14.5,19.59z M14.27,15H9.73l-1.35-4.02L12,8.44l3.63,2.54L14.27,15z M18.06,17.21l-1.14-0.1l-0.79-1.37l1.46-4.34l1.39-0.47l1,0.73C19.99,11.77,20,11.88,20,12C20,13.99,19.27,15.81,18.06,17.21z"/></svg>`;
        const ICON_YELLOW = `<svg class="tl-icon" viewBox="0 0 24 24" fill="#FBBF24" stroke="#FBBF24" stroke-width="0"><rect x="4" y="2" width="16" height="20" rx="2"/></svg>`;
        const ICON_RED = `<svg class="tl-icon" viewBox="0 0 24 24" fill="#EF4444" stroke="#EF4444" stroke-width="0"><rect x="4" y="2" width="16" height="20" rx="2"/></svg>`;
        const ICON_SUB = `<svg class="tl-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 16V4m0 0L3 8m4-4 4 4"/><path d="M17 8v12m0 0 4-4m-4 4-4-4"/></svg>`;

        return `
        <div class="timeline-header">
            <span class="timeline-header-home">${m.homeTeam}</span>
            <span class="timeline-header-min">Min</span>
            <span class="timeline-header-away">${m.awayTeam}</span>
        </div>
        <div class="timeline-split">
            ${m.plays.map(ev => {
                const isHome = ev.team === m.homeId;
                const isAway = ev.team === m.awayId;
                const player = ev.athletes?.[0]?.name || '';
                const headshot = ev.athletes?.[0]?.headshot || '';
                const isGoal = ev.scoringPlay;
                const isYellow = ev.yellowCard;
                const isRed = ev.redCard;
                const isSub = ev.substitution;
                const isOwnGoal = ev.ownGoal;

                let iconClass = '';
                let icon = '';
                let typeText = ev.type || '';
                if (isGoal) {
                    iconClass = 'tl-goal';
                    icon = ICON_GOAL;
                    typeText = isOwnGoal ? 'Autogol' : 'Gol';
                } else if (isRed) {
                    iconClass = 'tl-red';
                    icon = ICON_RED;
                    typeText = 'Tarjeta roja';
                } else if (isYellow) {
                    iconClass = 'tl-yellow';
                    icon = ICON_YELLOW;
                    typeText = 'Tarjeta amarilla';
                } else if (isSub) {
                    iconClass = 'tl-sub';
                    icon = ICON_SUB;
                    typeText = 'Cambio';
                }

                const photoHtml = (isGoal && headshot)
                    ? `<img class="tl-headshot" src="${headshot}" alt="${player}" onerror="this.style.display='none'">`
                    : '';

                const homeHtml = isHome ? `
                    <div class="tl-event tl-home ${iconClass}">
                        ${photoHtml}
                        <div class="tl-event-text">
                            <span class="tl-player">${player}</span>
                            <span class="tl-type">${icon}${typeText}</span>
                        </div>
                    </div>` : '<div class="tl-event tl-empty"></div>';

                const awayHtml = isAway ? `
                    <div class="tl-event tl-away ${iconClass}">
                        <div class="tl-event-text">
                            <span class="tl-type">${typeText}${icon}</span>
                            <span class="tl-player">${player}</span>
                        </div>
                        ${photoHtml}
                    </div>` : '<div class="tl-event tl-empty"></div>';

                return `
                <div class="tl-row">
                    ${homeHtml}
                    <div class="tl-minute">${ev.minute || ''}</div>
                    ${awayHtml}
                </div>`;
            }).join('')}
        </div>`;
    },

    renderGoals(m) {
        if (!m.goals?.length) return '<div class="no-data">Sin goles</div>';
        return `
        <div class="timeline-header">
            <span class="timeline-header-home">${m.homeTeam}</span>
            <span class="timeline-header-min">Min</span>
            <span class="timeline-header-away">${m.awayTeam}</span>
        </div>
        <div class="timeline-split">
            ${m.goals.map(g => {
                const isHome = g.team === m.homeId;
                const player = g.athletes?.[0]?.name || '';
                const isOwnGoal = g.ownGoal;
                const typeText = isOwnGoal ? 'Autogol' : (g.type || 'Gol');

                return `
                <div class="tl-row">
                    ${isHome ? `<div class="tl-event tl-home tl-goal"><span class="tl-player">${player}</span><span class="tl-type">${typeText}</span></div>` : '<div class="tl-event tl-empty"></div>'}
                    <div class="tl-minute">${g.minute || ''}</div>
                    ${!isHome ? `<div class="tl-event tl-away tl-goal"><span class="tl-type">${typeText}</span><span class="tl-player">${player}</span></div>` : '<div class="tl-event tl-empty"></div>'}
                </div>`;
            }).join('')}
        </div>`;
    },

    renderCards(m) {
        if (!m.cards?.length) return '<div class="no-data">Sin tarjetas</div>';
        return `
        <div class="timeline-header">
            <span class="timeline-header-home">${m.homeTeam}</span>
            <span class="timeline-header-min">Min</span>
            <span class="timeline-header-away">${m.awayTeam}</span>
        </div>
        <div class="timeline-split">
            ${m.cards.map(c => {
                const isHome = c.team === m.homeId;
                const player = c.athletes?.[0]?.name || '';
                const isRed = c.redCard || c.type?.includes('Red');
                const iconClass = isRed ? 'tl-red' : 'tl-yellow';
                const typeText = isRed ? 'Tarjeta roja' : 'Tarjeta amarilla';

                return `
                <div class="tl-row">
                    ${isHome ? `<div class="tl-event tl-home ${iconClass}"><span class="tl-player">${player}</span><span class="tl-type">${typeText}</span></div>` : '<div class="tl-event tl-empty"></div>'}
                    <div class="tl-minute">${c.minute || ''}</div>
                    ${!isHome ? `<div class="tl-event tl-away ${iconClass}"><span class="tl-type">${typeText}</span><span class="tl-player">${player}</span></div>` : '<div class="tl-event tl-empty"></div>'}
                </div>`;
            }).join('')}
        </div>`;
    },

    renderStats(m) {
        if (!m.teamStats?.length) return '<div class="no-data">Sin estadisticas</div>';
        const statLabels = {
            PP: 'Posesion %', FC: 'Faltas', CW: 'Corners', SOG: 'Tiros a puerta',
            SHOT: 'Tiros totales', G: 'Goles', A: 'Asistencias', SHAST: 'Asist. tiro',
            APP: 'Apariciones'
        };
        const homeTeam = m.teamStats.find(t => t.id === m.homeId || t.code === m.homeCode);
        const awayTeam = m.teamStats.find(t => t.id === m.awayId || t.code === m.awayCode);
        if (!homeTeam || !awayTeam) return '<div class="no-data">Sin estadisticas</div>';

        const allKeys = [...new Set([
            ...homeTeam.statistics.map(s => s.abbreviation),
            ...awayTeam.statistics.map(s => s.abbreviation)
        ])];
        const displayStats = ['PP', 'SOG', 'SHOT', 'CW', 'FC', 'A'];

        const homeColor = ensureVisibleColor(m.homeColor) || '#E53E3E';
        const awayColor = ensureVisibleColor(m.awayColor) || '#3182CE';

        return `
        <div class="stats-comparison">
            <div class="stats-comp-header">
                <span class="stats-comp-team" style="color:${homeColor}">${m.homeTeam}</span>
                <span class="stats-comp-away" style="color:${awayColor}">${m.awayTeam}</span>
            </div>
            ${displayStats.map(key => {
                const hStat = homeTeam.statistics.find(s => s.abbreviation === key);
                const aStat = awayTeam.statistics.find(s => s.abbreviation === key);
                const hv = parseFloat(hStat?.displayValue) || 0;
                const av = parseFloat(aStat?.displayValue) || 0;
                const total = hv + av;
                const hp = total > 0 ? Math.round((hv / total) * 100) : 50;
                return `
                <div class="stats-comp-row">
                    <span class="stats-comp-val left">${hv}</span>
                    <div class="stats-comp-bar">
                        <div class="stats-comp-fill home" style="width:${hp}%;background:${homeColor}"></div>
                        <span class="stats-comp-label">${statLabels[key] || key}</span>
                        <div class="stats-comp-fill away" style="width:${100 - hp}%;background:${awayColor}"></div>
                    </div>
                    <span class="stats-comp-val right">${av}</span>
                </div>`;
            }).join('')}
        </div>`;
    },

    async renderLineups(m, el) {
        el.innerHTML = '<div class="loading">Cargando formaciones...</div>';

        const [homeLineup, awayLineup, homeRoster, awayRoster] = await Promise.all([
            m.id && m.homeId ? Scraper.getLineup(m.id, m.homeId) : Promise.resolve(null),
            m.id && m.awayId ? Scraper.getLineup(m.id, m.awayId) : Promise.resolve(null),
            m.homeId ? Scraper.getRoster(m.homeId) : Promise.resolve(null),
            m.awayId ? Scraper.getRoster(m.awayId) : Promise.resolve(null)
        ]);

        const homeData = (homeLineup?.athletes?.length >= 11) ? homeLineup : homeRoster;
        const awayData = (awayLineup?.athletes?.length >= 11) ? awayLineup : awayRoster;
        const homeFormation = homeLineup?.formation || m.homeFormation || '';
        const awayFormation = awayLineup?.formation || m.awayFormation || '';

        const buildPositions = (athletes, formationStr, side) => {
            const isHome = side === 'home';
            const GK_POS = ['G', 'GK', 'GKP'];
            const gk = athletes.find(a => GK_POS.includes(a.position));
            const field = athletes.filter(a => !GK_POS.includes(a.position));

            let lineSizes = [];
            if (formationStr && /^\d[\d-]+$/.test(formationStr)) {
                lineSizes = formationStr.split('-').map(Number).filter(n => n > 0);
            }
            if (!lineSizes.length) {
                const d = field.filter(p => p.position === 'D').length || 4;
                const mf = field.filter(p => p.position === 'M').length || 4;
                const f = field.filter(p => p.position === 'F').length || 2;
                lineSizes = [d, mf, f];
            }

            const posMap = {};
            const gkY = isHome ? 88 : 12;
            if (gk) posMap[gk.name] = { x: 50, y: gkY };

            const yStart = isHome ? 70 : 30;
            const yEnd = isHome ? 16 : 84;
            const numLines = lineSizes.length;
            const lineGroups = [];
            let playerIdx = 0;

            lineSizes.forEach((count, li) => {
                const t = numLines === 1 ? 0.5 : li / (numLines - 1);
                const y = yStart + (yEnd - yStart) * t;
                const xs = [];
                const spacing = 84 / (count + 1);
                for (let i = 0; i < count; i++) xs.push(8 + spacing * (i + 1));
                lineGroups.push({ y, xs });
                for (let i = 0; i < count && playerIdx < field.length; i++, playerIdx++) {
                    posMap[field[playerIdx].name] = { x: xs[i], y };
                }
            });

            return { posMap, lineGroups, lineSizes };
        };

        const buildSvgLines = (lineGroups) => lineGroups.map(lg => {
            if (lg.xs.length < 2) return '';
            const pts = lg.xs.map(x => `${x},${lg.y}`).join(' ');
            return `<polyline class="pitch-line" points="${pts}" stroke="rgba(255,255,255,0.15)" stroke-width="0.8" fill="none" stroke-linecap="round" stroke-dasharray="200" style="animation-delay:0.35s"/>`;
        }).join('');

        const renderPitch = (roster, side, formationStr) => {
            if (!roster?.athletes?.length) return `<div class="no-data">Sin datos de alineacion</div>`;
            const isHome = side === 'home';
            const GK_POS = ['G', 'GK', 'GKP'];
            const athletes = roster.athletes;

            const posOrder = { 'G': 0, 'GK': 0, 'GKP': 0, 'D': 1, 'M': 2, 'F': 3 };
            let starters;
            const marked = athletes.filter(a => a.starter === true);
            if (marked.length >= 11) {
                starters = [...marked]
                    .sort((a, b) => (posOrder[a.position] ?? 2) - (posOrder[b.position] ?? 2))
                    .slice(0, 11);
            } else {
                const gk = athletes.find(a => GK_POS.includes(a.position));
                const defs = athletes.filter(a => a.position === 'D').slice(0, 4);
                const mids = athletes.filter(a => a.position === 'M').slice(0, 4);
                const fwds = athletes.filter(a => a.position === 'F').slice(0, 2);
                starters = [gk, ...defs, ...mids, ...fwds].filter(Boolean).slice(0, 11);
            }

            // Si no hay titulares marcados la alineacion no esta confirmada todavia
            const lineupConfirmed = marked.length >= 11;
            const { posMap, lineGroups, lineSizes } = buildPositions(starters, formationStr, 'home');
            const detectedFormation = formationStr || (lineupConfirmed ? lineSizes.join('-') : '');
            const dotColor = isHome ? '#EF4444' : '#2563EB';
            const svgLines = buildSvgLines(lineGroups);
            const flagUrl = `https://a.espncdn.com/i/teamlogos/countries/500/${(roster.code || '').toLowerCase()}.png`;

            return `
            <div class="pitch-container">
                <div class="pitch-label">
                    ${roster.code ? `<img src="${flagUrl}" alt="${roster.code}" onerror="this.style.display='none'" style="width:24px;height:18px;border-radius:2px;object-fit:cover">` : ''}
                    ${roster.team || ''}
                </div>
                <div class="pitch-formation-tag">
                    ${detectedFormation
                        ? detectedFormation
                        : '<span class="formation-pending">Alineacion sin confirmar</span>'}
                </div>
                <div class="pitch">
                    <div class="pitch-box-top"></div>
                    <div class="pitch-box-bottom"></div>
                    <div class="pitch-penalty-top"></div>
                    <div class="pitch-penalty-bottom"></div>
                    <div class="pitch-center-dot"></div>
                    <svg class="pitch-lines-svg" viewBox="0 0 100 100" preserveAspectRatio="none">${svgLines}</svg>
                    ${starters.map((p, i) => {
                        const pos = posMap[p.name] || { x: 50, y: 50 };
                        const delay = (i * 0.055).toFixed(2);
                        const shortName = p.name.split(' ').pop();
                        return `<div class="pitch-player ${side}" style="left:${pos.x}%;top:${pos.y}%;animation-delay:${delay}s">
                            <div class="pitch-player-dot" style="background:${dotColor}">${p.jersey || (i + 1)}</div>
                            <span class="pitch-player-name">${shortName}</span>
                            <div class="pitch-player-tooltip">${p.name}<small>${POSITION_FULL_ES[p.position] || p.position || ''}</small></div>
                        </div>`;
                    }).join('')}
                </div>
            </div>`;
        };

        const renderSubs = (roster, teamName) => {
            if (!roster?.athletes?.length) return '';
            const GK_POS = ['G', 'GK', 'GKP'];
            const athletes = roster.athletes;
            const starterSet = new Set();
            const marked = athletes.filter(a => a.starter === true);
            if (marked.length >= 11) {
                marked.slice(0, 11).forEach(a => starterSet.add(a.name));
            } else {
                const gk = athletes.find(a => GK_POS.includes(a.position));
                if (gk) starterSet.add(gk.name);
                athletes.filter(a => a.position === 'D').slice(0, 4).forEach(a => starterSet.add(a.name));
                athletes.filter(a => a.position === 'M').slice(0, 4).forEach(a => starterSet.add(a.name));
                athletes.filter(a => a.position === 'F').slice(0, 2).forEach(a => starterSet.add(a.name));
            }
            const subs = athletes.filter(a => !starterSet.has(a.name));
            if (!subs.length) return '';
            return `
            <div class="lineup-team">
                <h4>${teamName} — Suplentes</h4>
                <div class="lineup-list subs">
                    ${subs.map(a => `
                    <div class="lineup-player">
                        <span class="player-num">${a.jersey || '-'}</span>
                        <span class="player-pos">${POSITION_ES[a.position] || a.position || ''}</span>
                        <span class="player-name">${a.name}</span>
                    </div>`).join('')}
                </div>
            </div>`;
        };

        el.innerHTML = `
        <div class="lineup-section">
            <div class="pitch-grid">
                ${renderPitch(homeData, 'home', homeFormation)}
                ${renderPitch(awayData, 'away', awayFormation)}
            </div>
            <div class="lineup-grid">
                ${renderSubs(homeRoster || homeData, m.homeTeam)}
                ${renderSubs(awayRoster || awayData, m.awayTeam)}
            </div>
        </div>`;
    }
};

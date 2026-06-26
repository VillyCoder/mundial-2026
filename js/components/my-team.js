/*
 * my-team.js
 * Pagina "Mi Equipo": permite al usuario elegir su seleccion favorita
 * y ver todos sus partidos en el torneo (jugados y proximos).
 *
 * El calendario completo se carga desde /api/team-schedule, que itera
 * las 39 fechas del torneo en el servidor y filtra por equipo.
 */

import { getFavoriteTeam, setFavoriteTeam } from '../config.js';
import { Scraper } from '../scraper.js';
import { Storage } from '../storage.js';
import { Sidebar } from './sidebar.js';
import { NotificationSystem } from '../notifications.js';
import { renderChannelRow } from '../channels.js';

// Selecciones disponibles para elegir como favorita
const TEAM_OPTIONS = [
    { code: 'ESP', name: 'España', nickname: 'La Roja' },
    { code: 'ARG', name: 'Argentina', nickname: 'La Albiceleste' },
    { code: 'BRA', name: 'Brasil', nickname: 'La Canarinha' },
    { code: 'FRA', name: 'Francia', nickname: 'Les Bleus' },
    { code: 'GER', name: 'Alemania', nickname: 'Die Mannschaft' },
    { code: 'ENG', name: 'Inglaterra', nickname: 'Three Lions' },
    { code: 'ITA', name: 'Italia', nickname: 'Azzurri' },
    { code: 'POR', name: 'Portugal', nickname: 'Selecao' },
    { code: 'NED', name: 'Paises Bajos', nickname: 'Oranje' },
    { code: 'BEL', name: 'Belgica', nickname: 'Red Devils' },
    { code: 'CRO', name: 'Croacia', nickname: 'Vatreni' },
    { code: 'MAR', name: 'Marruecos', nickname: 'Atlas Lions' },
    { code: 'JPN', name: 'Japon', nickname: 'Blue Samurai' },
    { code: 'KOR', name: 'Corea del Sur', nickname: 'Taegeuk Warriors' },
    { code: 'URU', name: 'Uruguay', nickname: 'La Celeste' },
    { code: 'COL', name: 'Colombia', nickname: 'Los Cafeteros' },
    { code: 'MEX', name: 'Mexico', nickname: 'El Tri' },
    { code: 'USA', name: 'Estados Unidos', nickname: 'USMNT' },
    { code: 'CAN', name: 'Canada', nickname: 'Les Rouges' },
    { code: 'ECU', name: 'Ecuador', nickname: 'La Tri' },
    { code: 'SEN', name: 'Senegal', nickname: 'Lions de Teranga' },
    { code: 'GHA', name: 'Ghana', nickname: 'Black Stars' },
    { code: 'CMR', name: 'Camerun', nickname: 'Indomitable Lions' },
    { code: 'NGA', name: 'Nigeria', nickname: 'Super Eagles' },
    { code: 'TUN', name: 'Tunez', nickname: 'Eagles of Carthage' },
    { code: 'AUS', name: 'Australia', nickname: 'Socceroos' },
    { code: 'IRN', name: 'Iran', nickname: 'Team Melli' },
    { code: 'KSA', name: 'Arabia Saudita', nickname: 'The Green Falcons' },
    { code: 'QAT', name: 'Catar', nickname: 'The Maroons' },
    { code: 'SRB', name: 'Serbia', nickname: 'The Eagles' },
    { code: 'POL', name: 'Polonia', nickname: 'Bialo-Czerwoni' },
    { code: 'SUI', name: 'Suiza', nickname: 'Nati' },
    { code: 'DEN', name: 'Dinamarca', nickname: 'Danish Dynamite' },
    { code: 'CZE', name: 'Republica Checa', nickname: 'Narodni Tym' },
    { code: 'GRE', name: 'Grecia', nickname: 'Galanolefki' },
    { code: 'CHI', name: 'Chile', nickname: 'La Roja' },
    { code: 'PAR', name: 'Paraguay', nickname: 'La Albirroja' },
    { code: 'PER', name: 'Peru', nickname: 'La Blanquirroja' },
    { code: 'BOL', name: 'Bolivia', nickname: 'La Verde' },
    { code: 'PAN', name: 'Panama', nickname: 'Los Canaleros' },
    { code: 'CRC', name: 'Costa Rica', nickname: 'Los Ticos' },
    { code: 'HON', name: 'Honduras', nickname: 'Los Catrachos' },
    { code: 'JAM', name: 'Jamaica', nickname: 'The Reggae Boyz' },
    { code: 'CPV', name: 'Cabo Verde', nickname: 'Blue Sharks' }
];

// Traducciones de fases del torneo (ESPN las devuelve en ingles)
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

export const MyTeam = {
    async render(container) {
        const currentTeam = getFavoriteTeam();

        container.innerHTML = `
            <div class="my-team-page">
                <div class="my-team-hero" id="my-team-hero">
                    <div class="my-team-hero-content">
                        <img class="my-team-flag" src="https://a.espncdn.com/i/teamlogos/countries/500/${currentTeam.code.toLowerCase()}.png" alt="${currentTeam.code}">
                        <h1>${currentTeam.name}</h1>
                        <span class="my-team-nickname">${currentTeam.nickname}</span>
                    </div>
                </div>

                <div class="team-section">
                    <h2>Seleccionar Equipo Favorito</h2>
                    <div class="team-selector" id="team-selector">
                        ${TEAM_OPTIONS.map(t => `
                            <div class="team-selector-item ${t.code === currentTeam.code ? 'active' : ''}" data-code="${t.code}">
                                <img class="team-selector-logo" src="https://a.espncdn.com/i/teamlogos/countries/500/${t.code.toLowerCase()}.png" alt="${t.code}">
                                <span class="team-selector-name">${t.name}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="team-section">
                    <h2>Partidos en el Torneo</h2>
                    <div id="team-matches">
                        <div class="loading">Cargando todos los partidos...</div>
                    </div>
                </div>

                <div class="team-section" id="install-section">
                    <h2>Instalar app</h2>
                    <div class="settings-card" id="install-card">
                        <div class="setting-item">
                            <div class="setting-info">
                                <span class="setting-label">Mundial 2026</span>
                                <span class="setting-desc" id="install-desc">Acceso rapido desde tu pantalla de inicio</span>
                            </div>
                            <button class="btn-install-app" id="installAppBtn">Instalar</button>
                        </div>
                    </div>
                </div>

                <div class="team-section">
                    <h2>Notificaciones</h2>
                    <div class="settings-card">
                        <div class="setting-item">
                            <div class="setting-info">
                                <span class="setting-label">Alertas del partido</span>
                                <span class="setting-desc">Goles, inicio del partido y resultado final</span>
                            </div>
                            <label class="toggle">
                                <input type="checkbox" id="notifToggle" ${Storage.get('notifications') ? 'checked' : ''}>
                                <span class="toggle-slider"></span>
                            </label>
                        </div>
                        <div class="setting-item">
                            <div class="setting-info">
                                <span class="setting-label">Aviso previo</span>
                                <span class="setting-desc">Recordatorio 30 minutos antes de cada partido</span>
                            </div>
                            <label class="toggle">
                                <input type="checkbox" id="remindToggle" ${Storage.get('remindBefore') ? 'checked' : ''}>
                                <span class="toggle-slider"></span>
                            </label>
                        </div>
                        <div class="setting-item">
                            <div class="setting-info">
                                <span class="setting-label">Probar notificacion</span>
                                <span class="setting-desc">Envia una notificacion de ejemplo ahora mismo</span>
                            </div>
                            <button class="btn-test-notif" id="testNotifBtn">Probar</button>
                        </div>
                        <div id="notif-status" class="notif-status"></div>
                    </div>
                </div>
            </div>
        `;

        this.setupEvents(container, currentTeam);
        await this.loadAllMatches(currentTeam.code);
    },

    setupEvents(container, currentTeam) {
        // Seccion de instalacion: muestra u oculta segun plataforma y estado
        this.setupInstallButton(container);

        const notifToggle = container.querySelector('#notifToggle');
        const remindToggle = container.querySelector('#remindToggle');
        const statusEl = container.querySelector('#notif-status');

        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        const isPWA = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

        const updateStatus = () => {
            if (!statusEl) return;

            // iOS en Safari normal: las notificaciones web solo funcionan en la PWA instalada
            if (isIOS && !isPWA) {
                statusEl.innerHTML = 'Para recibir notificaciones, instala la app: toca <strong>Compartir</strong> (cuadrado con flecha) y luego <strong>Anadir a pantalla de inicio</strong>.';
                statusEl.className = 'notif-status info';
                if (notifToggle) notifToggle.disabled = true;
                if (remindToggle) remindToggle.disabled = true;
                return;
            }

            if (!('Notification' in window)) {
                statusEl.textContent = isIOS
                    ? 'Necesitas iOS 16.4 o superior para recibir notificaciones.'
                    : 'Tu navegador no soporta notificaciones.';
                statusEl.className = 'notif-status error';
                if (notifToggle) notifToggle.disabled = true;
                if (remindToggle) remindToggle.disabled = true;
                return;
            }

            if (notifToggle) notifToggle.disabled = false;
            if (remindToggle) remindToggle.disabled = false;

            if (Notification.permission === 'denied') {
                statusEl.textContent = 'Notificaciones bloqueadas. Cambialo en los ajustes del navegador.';
                statusEl.className = 'notif-status error';
            } else if (Notification.permission === 'granted' && Storage.get('notifications')) {
                statusEl.textContent = 'Activo. Recibiras alertas de goles, inicio y fin del partido.';
                statusEl.className = 'notif-status ok';
            } else {
                statusEl.textContent = '';
                statusEl.className = 'notif-status';
            }
        };
        updateStatus();

        notifToggle?.addEventListener('change', async (e) => {
            if (e.target.checked) {
                const granted = await NotificationSystem.requestPermission();
                if (!granted) {
                    e.target.checked = false;
                    Storage.set('notifications', false);
                    updateStatus();
                    return;
                }
                Storage.set('notifications', true);
                NotificationSystem.start(currentTeam.code);
            } else {
                Storage.set('notifications', false);
                NotificationSystem.stop();
            }
            updateStatus();
        });

        remindToggle?.addEventListener('change', (e) => {
            Storage.set('remindBefore', e.target.checked);
        });

        container.querySelector('#testNotifBtn')?.addEventListener('click', async () => {
            if (!('Notification' in window)) {
                statusEl.textContent = isIOS
                    ? 'Necesitas iOS 16.4 o superior para recibir notificaciones.'
                    : 'Tu navegador no soporta notificaciones.';
                statusEl.className = 'notif-status error';
                return;
            }
            if (Notification.permission !== 'granted') {
                const granted = await NotificationSystem.requestPermission();
                if (!granted) {
                    statusEl.textContent = 'Permiso denegado. Cambialo en los ajustes del navegador.';
                    statusEl.className = 'notif-status error';
                    return;
                }
                Storage.set('notifications', true);
                const toggle = container.querySelector('#notifToggle');
                if (toggle) toggle.checked = true;
                updateStatus();
            }
            const team = getFavoriteTeam();
            const icon = `https://a.espncdn.com/i/teamlogos/countries/500/${team.code.toLowerCase()}.png`;
            NotificationSystem.show(
                `¡GOL! ${team.name} 1-0 Rival`,
                'Notificacion de prueba - las alertas funcionan correctamente',
                icon,
                'test_' + Date.now(),
                '#/'
            );
        });

        container.querySelectorAll('.team-selector-item').forEach(item => {
            item.addEventListener('click', async () => {
                const code = item.dataset.code;
                setFavoriteTeam(code);
                const team = TEAM_OPTIONS.find(t => t.code === code);

                container.querySelectorAll('.team-selector-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');

                const heroEl = document.getElementById('my-team-hero');
                if (heroEl && team) {
                    heroEl.innerHTML = `
                        <div class="my-team-hero-content">
                            <img class="my-team-flag" src="https://a.espncdn.com/i/teamlogos/countries/500/${team.code.toLowerCase()}.png" alt="${team.code}">
                            <h1>${team.name}</h1>
                            <span class="my-team-nickname">${team.nickname}</span>
                        </div>`;
                }

                const sidebarEl = document.getElementById('sidebar');
                if (sidebarEl) {
                    const wasActive = sidebarEl.classList.contains('active');
                    Sidebar.render(sidebarEl);
                    if (wasActive) sidebarEl.classList.add('active');
                }

                // Activa notificaciones automaticamente al elegir equipo (si el navegador lo permite)
                if (!Storage.get('notifications') && 'Notification' in window && Notification.permission !== 'denied') {
                    const granted = await NotificationSystem.requestPermission();
                    if (granted) {
                        Storage.set('notifications', true);
                        const toggle = container.querySelector('#notifToggle');
                        if (toggle) toggle.checked = true;
                        updateStatus();
                    }
                }
                NotificationSystem.start(code);

                await this.loadAllMatches(code);
            });
        });
    },

    // Gestiona el boton de instalacion segun plataforma
    setupInstallButton(container) {
        const section = container.querySelector('#install-section');
        const btn = container.querySelector('#installAppBtn');
        const desc = container.querySelector('#install-desc');
        if (!section || !btn) return;

        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        const isPWA = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

        // Si ya esta instalada como PWA, ocultar la seccion
        if (isPWA) { section.style.display = 'none'; return; }

        if (isIOS) {
            btn.textContent = 'Añadir a inicio';
            if (desc) desc.textContent = 'Abre el menu de compartir para instalar la app';
            btn.addEventListener('click', async () => {
                if ('share' in navigator) {
                    try { await navigator.share({ title: 'Mundial 2026', url: window.location.href }); } catch {}
                } else {
                    this.showIOSInstallModal();
                }
            });
        } else {
            // Android/Chrome: disparar el prompt nativo si esta disponible
            btn.addEventListener('click', () => {
                document.dispatchEvent(new CustomEvent('mundial:install-requested'));
            });
            // Escuchar si el prompt se vuelve disponible para actualizar el boton
            document.addEventListener('mundial:install-available', () => {
                btn.disabled = false;
                btn.textContent = 'Instalar';
            }, { once: true });
            // Si el prompt no esta disponible (ya instalado o no compatible), ocultar
            document.addEventListener('mundial:install-not-available', () => {
                section.style.display = 'none';
            }, { once: true });
            document.dispatchEvent(new CustomEvent('mundial:install-check'));
        }
    },

    // Modal de instrucciones para iOS (no hay API directa)
    showIOSInstallModal() {
        if (document.getElementById('ios-install-modal')) return;
        const modal = document.createElement('div');
        modal.id = 'ios-install-modal';
        modal.className = 'ios-install-modal';
        modal.innerHTML = `
            <div class="ios-install-overlay" id="ios-modal-overlay"></div>
            <div class="ios-install-sheet">
                <div class="ios-install-header">
                    <span class="ios-install-title">Instalar Mundial 2026</span>
                    <button class="ios-install-close" id="ios-modal-close">&#x2715;</button>
                </div>
                <div class="ios-install-steps">
                    <div class="ios-install-step">
                        <span class="ios-step-num">1</span>
                        <div class="ios-step-text">
                            <span class="ios-step-label">Toca el boton Compartir</span>
                            <span class="ios-step-desc">El icono de cuadrado con flecha hacia arriba en la barra de Safari</span>
                        </div>
                        <svg class="ios-share-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="32" height="32">
                            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                            <polyline points="16 6 12 2 8 6"/>
                            <line x1="12" y1="2" x2="12" y2="15"/>
                        </svg>
                    </div>
                    <div class="ios-install-step">
                        <span class="ios-step-num">2</span>
                        <div class="ios-step-text">
                            <span class="ios-step-label">Anadir a pantalla de inicio</span>
                            <span class="ios-step-desc">Desplazate hacia abajo en el menu y toca esta opcion</span>
                        </div>
                    </div>
                    <div class="ios-install-step">
                        <span class="ios-step-num">3</span>
                        <div class="ios-step-text">
                            <span class="ios-step-label">Confirmar</span>
                            <span class="ios-step-desc">Toca "Anadir" en la esquina superior derecha</span>
                        </div>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(modal);
        requestAnimationFrame(() => modal.classList.add('visible'));
        const close = () => {
            modal.classList.remove('visible');
            setTimeout(() => modal.remove(), 300);
        };
        modal.querySelector('#ios-modal-close')?.addEventListener('click', close);
        modal.querySelector('#ios-modal-overlay')?.addEventListener('click', close);
    },

    // Carga todos los partidos del equipo en el torneo.
    // El servidor itera las 39 fechas del Mundial y filtra los partidos.
    async loadAllMatches(teamCode) {
        const container = document.getElementById('team-matches');
        if (!container) return;
        container.innerHTML = '<div class="loading">Cargando calendario completo del torneo...</div>';

        try {
            const data = await Scraper.getTeamSchedule(teamCode);
            const matches = data?.matches || [];

            if (!matches.length) {
                container.innerHTML = '<div class="no-match">No hay partidos para este equipo en el torneo</div>';
                return;
            }

            // Separa partidos en vivo, proximos y jugados
            const live = matches.filter(m => m.status === 'live');
            const upcoming = matches.filter(m => m.status === 'scheduled');
            const played = matches.filter(m => m.status === 'finished');

            let html = '';

            if (live.length) {
                html += '<p class="team-matches-label">En vivo</p>';
                html += live.map(m => this.matchCard(m)).join('');
            }

            if (upcoming.length) {
                html += '<p class="team-matches-label">Proximos partidos</p>';
                html += upcoming.map(m => this.matchCard(m)).join('');
            }

            if (played.length) {
                html += '<p class="team-matches-label">Partidos jugados</p>';
                // Mostrar del mas reciente al mas antiguo
                html += [...played].reverse().map(m => this.matchCard(m)).join('');
            }

            container.innerHTML = html;
        } catch (e) {
            container.innerHTML = '<div class="no-match">Error cargando datos del torneo</div>';
        }
    },

    // Tarjeta compacta de partido (reutiliza el estilo del calendario)
    matchCard(m) {
        const isFinished = m.status === 'finished';
        const isLive = m.status === 'live';
        const stageLabel = STAGE_NAMES[m.group] || m.group?.replace('FIFA World Cup, ', '') || '';

        // Fecha en formato legible: "Lun 15 jun"
        const dateLabel = m.date
            ? new Date(m.date).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
            : '';

        const timeOrScore = isLive
            ? `EN VIVO ${m.clock || ''}'`
            : isFinished
                ? 'Final'
                : m.dateMadrid || 'Por jugar';

        return `
        <a href="#/match/${m.id}?date=${m.date?.split('T')[0]?.replace(/-/g, '') || ''}" class="cal-match ${isFinished ? 'finished' : ''} ${isLive ? 'live' : ''}">
            <div class="team-match-meta">
                ${dateLabel ? `<span class="team-match-date">${dateLabel}</span>` : ''}
                <span class="team-match-time ${isLive ? 'live' : ''}">${timeOrScore}</span>
                ${stageLabel ? `<span class="cal-stage">${stageLabel}</span>` : ''}
            </div>
            <div class="cal-match-teams">
                <div class="cal-team">
                    <span class="cal-team-name">${m.homeTeam}</span>
                    ${m.homeLogo ? `<img class="cal-flag" src="${m.homeLogo}" alt="${m.homeCode}">` : ''}
                </div>
                <div class="cal-score">
                    ${m.homeScore != null
                        ? `<span>${m.homeScore}</span><span>-</span><span>${m.awayScore}</span>`
                        : `<span class="cal-vs">VS</span>`}
                </div>
                <div class="cal-team cal-team-right">
                    ${m.awayLogo ? `<img class="cal-flag" src="${m.awayLogo}" alt="${m.awayCode}">` : ''}
                    <span class="cal-team-name">${m.awayTeam}</span>
                </div>
            </div>
            ${m.venue ? `<div class="cal-match-info"><span>${m.venue}${m.city ? ' - ' + m.city : ''}</span></div>` : ''}
            ${m.status === 'scheduled' && m.spanishChannels?.length ? renderChannelRow(m.spanishChannels) : ''}
        </a>`;
    }
};

/*
 * live-score.js
 * Pagina "Hoy": muestra los partidos del dia con marcador en tiempo real.
 * Permite filtrar por grupo (fase de grupos, octavos, cuartos...).
 * Cada tarjeta de partido enlaza a su pagina de detalle.
 */

import { Scraper } from '../scraper.js';
import { getFavoriteTeam } from '../config.js';
import { renderChannelRow } from '../channels.js';
import { NotificationSystem } from '../notifications.js';

// ESPN devuelve los nombres de fase en ingles, los traducimos para la interfaz
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

// Devuelve las fechas de hoy y mañana en formato YYYYMMDD para la API de ESPN
function getMatchDates() {
    const now = new Date();
    const fmt = d => d.toISOString().split('T')[0].replace(/-/g, '');
    return {
        today: fmt(now),
        tomorrow: fmt(new Date(now.getTime() + 86400000))
    };
}

export const LiveScore = {
    allMatches: [],
    todayMatches: [],
    nextDayMatches: [],
    todayDate: '',

    async render(el) {
        el.innerHTML = `
            <div class="live-score-page">
                <div class="page-header" style="text-align:center">
                    <h1>Hoy</h1>
                    <div class="live-indicator"><span class="pulse"></span> Datos en vivo - ESPN</div>
                </div>
                <div id="day-tabs" class="day-tabs" style="justify-content:center"></div>
                <div id="filters" class="filters" style="justify-content:center"></div>
                <div id="matches" class="matches-grid"><div class="loading">Cargando partidos...</div></div>
            </div>`;
        await this.load();
    },

    async load() {
        const el = document.getElementById('matches');
        if (!el) return;
        try {
            const { today } = getMatchDates();
            this.todayDate = today;
            const todayData = await Scraper.getCalendar(today);
            const seen = new Set();
            this.todayMatches = (todayData?.matches || []).filter(m => {
                if (!m.id || seen.has(m.id)) return false;
                seen.add(m.id);
                return true;
            });
            this.allMatches = this.todayMatches;

            if (!this.allMatches.length) {
                el.innerHTML = '<div class="no-matches">No hay partidos disponibles hoy</div>';
                return;
            }
            this.renderDayTabs();
            this.renderFilters(this.todayMatches);
            this.renderMatches(this.todayMatches, 'today');
        } catch (e) {
            console.error('Load error:', e);
            el.innerHTML = '<div class="error">Error cargando partidos</div>';
        }
    },

    renderDayTabs() {
        const el = document.getElementById('day-tabs');
        if (!el) return;
        const liveCount = this.todayMatches.filter(m => m.status === 'live').length;
        const todayLabel = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' });

        el.innerHTML = `
            <div class="day-tabs-row">
                <button class="day-tab active" data-day="today">Hoy - ${todayLabel}</button>
                ${liveCount > 0 ? `<span class="live-count-badge">${liveCount} en vivo</span>` : ''}
            </div>
        `;
    },

    renderFilters(matches) {
        const el = document.getElementById('filters');
        if (!el) return;
        const groups = [...new Set(matches.map(m => m.group))].filter(Boolean).sort();
        el.innerHTML = `
            <button class="filter-btn active" data-group="all">Todos</button>
            ${groups.map(g => {
                const label = STAGE_NAMES[g] || g.replace('FIFA World Cup, ', '');
                return `<button class="filter-btn" data-group="${g}">${label}</button>`;
            }).join('')}`;
        el.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                el.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                const group = e.target.dataset.group;
                const dayEl = document.querySelector('.day-tab.active');
                const day = dayEl?.dataset.day || 'today';
                const baseMatches = day === 'today' ? this.todayMatches : this.nextDayMatches;
                this.renderMatches(group === 'all' ? baseMatches : baseMatches.filter(m => m.group === group), day);
            });
        });
    },

    renderMatches(matches, day) {
        const el = document.getElementById('matches');
        el.innerHTML = matches.map(m => this.card(m, day)).join('');
    },

    card(m, day) {
        const stageLabel = STAGE_NAMES[m.group] || m.group?.replace('FIFA World Cup, ', '') || '';
        const isLive = m.status === 'live';
        const isFinished = m.status === 'finished';
        const fav = getFavoriteTeam();
        const isFav = m.homeCode === fav.code || m.awayCode === fav.code || m.homeTeam === fav.name || m.awayTeam === fav.name;
        const timeStr = m.dateMadrid || '';
        const statusStr = isLive ? m.clock + "'" : isFinished ? 'Final' : timeStr;
        const isAlerted = NotificationSystem.isAlerted(m.id);

        const renderForm = (form) => {
            if (!form) return '';
            return `<div class="form-strip">${form.split('').map(c => {
                const cls = c === 'W' ? 'form-w' : c === 'D' ? 'form-d' : 'form-l';
                const label = c === 'W' ? 'G' : c === 'D' ? 'E' : 'P';
                return `<span class="form-dot ${cls}">${label}</span>`;
            }).join('')}</div>`;
        };

        return `
        <a href="#/match/${m.id}?date=${this.todayDate || m.date?.split('T')[0]?.replace(/-/g, '') || ''}" class="match-card ${isFinished ? 'finished' : ''} ${isLive ? 'live' : ''} ${isFav ? 'favorite' : ''}">
            <div class="match-card-header">
                <span class="match-stage-tag">${stageLabel}</span>
                <div class="match-card-actions">
                    <button class="match-bell-btn ${isAlerted ? 'active' : ''}"
                        data-match-id="${m.id}"
                        data-home="${m.homeTeam || ''}"
                        data-away="${m.awayTeam || ''}"
                        title="Activar alerta para este partido">
                        <svg viewBox="0 0 24 24" fill="${isAlerted ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" width="13" height="13">
                            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                        </svg>
                    </button>
                    <span class="match-status ${isFinished ? 'ft' : isLive ? 'live' : ''}">${isLive ? 'EN VIVO ' : ''}${statusStr}</span>
                </div>
            </div>
            <div class="match-card-body">
                <div class="team-block">
                    ${m.homeLogo ? `<img class="flag-lg" src="${m.homeLogo}" alt="${m.homeCode}">` : ''}
                    <span class="team-n">${m.homeTeam}</span>
                    ${renderForm(m.homeForm)}
                </div>
                <div class="score-center">
                    ${m.homeScore != null ? `<span class="score-status ${isLive ? 'live' : isFinished ? 'ft' : ''}">${isLive ? m.clock + "'" : isFinished ? 'Final' : ''}</span><div class="score-nums"><span class="score-val">${m.homeScore}</span><span class="score-sep">-</span><span class="score-val">${m.awayScore}</span></div>` : `<span class="vs-text">${timeStr || 'VS'}</span>`}
                </div>
                <div class="team-block">
                    ${m.awayLogo ? `<img class="flag-lg" src="${m.awayLogo}" alt="${m.awayCode}">` : ''}
                    <span class="team-n">${m.awayTeam}</span>
                    ${renderForm(m.awayForm)}
                </div>
            </div>
            ${m.venue ? `<div class="match-card-venue">${m.venue}${m.city ? ' - ' + m.city : ''}</div>` : ''}
            ${renderChannelRow(m.spanishChannels)}
            ${this.renderMatchPreview(m, isFinished)}
            ${isFav ? `<div class="spain-badge">Mi Seleccion</div>` : ''}
        </a>`;
    },

    renderMatchPreview(m, isFinished) {
        const hasStats = m.homeStats && Object.keys(m.homeStats).length > 0;
        const hasProb = m.probability;
        if (!hasStats && !hasProb) return '';

        let html = '<div class="match-preview">';

        if (hasProb) {
            html += `
            <div class="probability-bar">
                <div class="prob-segment prob-home" style="width:${m.probability.home}%"></div>
                <div class="prob-segment prob-draw" style="width:${m.probability.draw}%"></div>
                <div class="prob-segment prob-away" style="width:${m.probability.away}%"></div>
            </div>
            <div class="prob-labels">
                <span>${m.probability.home}% ${m.homeCode}</span>
                <span>${m.probability.draw}% Empate</span>
                <span>${m.awayCode} ${m.probability.away}%</span>
            </div>`;
        }

        if (hasStats) {
            const statsToShow = [
                { key: 'PP', label: 'Posesion' },
                { key: 'SOG', label: 'Tiros a puerta' },
                { key: 'FC', label: 'Faltas' },
                { key: 'CW', label: 'Corners' }
            ];
            html += '<div class="match-stats-mini">';
            statsToShow.forEach(s => {
                const hv = parseFloat(m.homeStats[s.key]) || 0;
                const av = parseFloat(m.awayStats?.[s.key]) || 0;
                const total = hv + av;
                if (total === 0) return;
                const hp = Math.round((hv / total) * 100);
                html += `
                <div class="stat-mini-row">
                    <span class="stat-mini-val">${hv}</span>
                    <div class="stat-mini-bar">
                        <div class="stat-mini-fill home" style="width:${hp}%"></div>
                    </div>
                    <span class="stat-mini-label">${s.label}</span>
                    <div class="stat-mini-bar">
                        <div class="stat-mini-fill away" style="width:${100 - hp}%"></div>
                    </div>
                    <span class="stat-mini-val">${av}</span>
                </div>`;
            });
            html += '</div>';
        }

        if (m.homeLeaders && Object.keys(m.homeLeaders).length > 0) {
            const gl = m.homeLeaders.G || m.homeLeaders.goals;
            const al = m.awayLeaders?.G || m.awayLeaders?.goals;
            if (gl || al) {
                html += '<div class="match-leaders">';
                if (gl) html += `<span class="leader-home"><span class="leader-name">${gl.name}</span><span class="leader-goals">${gl.value} gol${gl.value !== '1' ? 'es' : ''}</span></span>`;
                html += '<span class="leader-sep">vs</span>';
                if (al) html += `<span class="leader-away"><span class="leader-name">${al.name}</span><span class="leader-goals">${al.value} gol${al.value !== '1' ? 'es' : ''}</span></span>`;
                html += '</div>';
            }
        }

        html += '</div>';
        return html;
    }
};

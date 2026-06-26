/*
 * app.js
 * Punto de entrada de la aplicacion. Se encarga de:
 *   1. Registrar las rutas del router con sus componentes correspondientes.
 *   2. Renderizar la pagina de inicio (/) con partidos en vivo, proximos y estadisticas.
 *
 * El resto de paginas (Hoy, Calendario, Clasificacion...) las gestiona el Router,
 * que llama al metodo render() del componente asociado a cada ruta.
 */

import { Router } from './router.js';
import { Header } from './components/header.js';
import { Sidebar } from './components/sidebar.js';
import { LiveScore } from './components/live-score.js';
import { Calendar } from './components/calendar.js';
import { Standings } from './components/standings.js';
import { MatchDetail } from './components/match-detail.js';
import { MyTeam } from './components/my-team.js';
import { Stats } from './components/stats.js';
import { Teams } from './components/teams.js';
import { Scraper } from './scraper.js';
import { NotificationSystem } from './notifications.js';
import { getFavoriteTeam } from './config.js';

const router = new Router();

// Inicializa la app cuando el DOM esta listo
function init() {
    Header.render(document.getElementById('header'));
    Sidebar.render(document.getElementById('sidebar'));

    // Arranca las notificaciones si el usuario las tiene activadas
    const fav = getFavoriteTeam();
    NotificationSystem.start(fav.code);

    // Cuando el Service Worker redirige desde una notificacion, navega a la ruta indicada
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', event => {
            if (event.data?.type === 'NAVIGATE' && event.data.url) {
                window.location.hash = event.data.url.startsWith('#') ? event.data.url : '#' + event.data.url;
            }
        });
    }

    // Cada ruta apunta a un componente con un metodo render(container, params)
    router.register('/', { render: renderHome });
    router.register('/live', LiveScore);
    router.register('/calendar', Calendar);
    router.register('/standings', Standings);
    router.register('/my-team', MyTeam);
    router.register('/stats', Stats);
    router.register('/teams', Teams);
    router.register('/match/:id', MatchDetail);

    router.init(document.getElementById('content'));
}

// Pagina de inicio: muestra partidos de hoy + mañana y estadisticas globales
async function renderHome(container) {
    container.innerHTML = `
        <div class="home-page">
            <div class="hero-banner">
                <div class="hero-content">
                    <img src="https://a.espncdn.com/i/leaguelogos/soccer/500/4.png" alt="FIFA World Cup" class="hero-logo">
                    <div class="hero-text">
                        <h1>Copa del Mundo FIFA 2026</h1>
                        <p>Estados Unidos, Canada y Mexico</p>
                    </div>
                </div>
            </div>
            <div id="home-live" class="home-section"></div>
            <div id="home-upcoming" class="home-section"></div>
            <div id="home-stats" class="home-section"></div>
        </div>`;

    try {
        const { today, tomorrow } = getDates();

        // Cargamos todo en paralelo para que la pagina sea mas rapida
        const [todayData, nextData, tournamentStats, topScorersData] = await Promise.all([
            Scraper.getCalendar(today),
            Scraper.getCalendar(tomorrow),
            Scraper.getTournamentStats(),
            Scraper.getTopScorers()
        ]);

        const allMatches = [...(todayData?.matches || []), ...(nextData?.matches || [])];
        const liveMatches = allMatches.filter(m => m.status === 'live');
        const scheduledMatches = allMatches.filter(m => m.status === 'scheduled').slice(0, 6);
        const finishedMatches = allMatches.filter(m => m.status === 'finished').slice(0, 4);

        renderLiveCarousel(liveMatches);
        renderUpcoming(scheduledMatches, finishedMatches);
        renderHomeStats(tournamentStats, topScorersData);
    } catch (e) {
        console.error('Error cargando inicio:', e);
    }
}

// Devuelve las fechas de hoy y mañana en formato YYYYMMDD que acepta la API de ESPN
function getDates() {
    const now = new Date();
    const fmt = d => d.toISOString().split('T')[0].replace(/-/g, '');
    return {
        today: fmt(now),
        tomorrow: fmt(new Date(now.getTime() + 86400000))
    };
}

// Muestra los partidos en vivo en un carrusel horizontal con scroll
function renderLiveCarousel(matches) {
    const el = document.getElementById('home-live');
    if (!el || !matches.length) { if (el) el.innerHTML = ''; return; }

    el.innerHTML = `
        <div class="home-section-header">
            <h2>En Vivo Ahora</h2>
            <a href="#/live" class="view-all-sm">Ver todos</a>
        </div>
        <div class="live-carousel">
            ${matches.map(m => LiveScore.card(m)).join('')}
        </div>`;
}

// Muestra proximos partidos y resultados recientes
function renderUpcoming(scheduled, finished) {
    const el = document.getElementById('home-upcoming');
    if (!el) return;

    let html = '';
    if (scheduled.length) {
        html += `<div class="home-section-header"><h2>Proximos Partidos</h2><a href="#/calendar" class="view-all-sm">Calendario</a></div>`;
        html += `<div class="home-matches">${scheduled.map(m => LiveScore.card(m)).join('')}</div>`;
    }
    if (finished.length) {
        html += `<div class="home-section-header"><h2>Resultados Recientes</h2></div>`;
        html += `<div class="home-matches">${finished.map(m => LiveScore.card(m)).join('')}</div>`;
    }
    el.innerHTML = html;
}

// Muestra el strip de estadisticas del torneo y los goleadores.
// Usa las mismas clases CSS que la pagina de Estadisticas para mantener consistencia visual.
function renderHomeStats(data, topScorersData) {
    const el = document.getElementById('home-stats');
    if (!el || !data) return;

    const topScorers = topScorersData?.topScorers?.slice(0, 5) || [];

    el.innerHTML = `
    <div class="home-section-header">
        <h2>El Torneo en Numeros</h2>
        <a href="#/stats" class="view-all-sm">Ver todas</a>
    </div>
    <div class="stats-cards">
        <div class="stats-card">
            <span class="stats-card-val">${data.totalMatches || 0}</span>
            <span class="stats-card-label">Partidos jugados</span>
        </div>
        <div class="stats-card">
            <span class="stats-card-val">${data.totalGoals || 0}</span>
            <span class="stats-card-label">Goles totales</span>
        </div>
        <div class="stats-card">
            <span class="stats-card-val">${data.goalsPerMatch || 0}</span>
            <span class="stats-card-label">Goles por partido</span>
        </div>
    </div>
    ${topScorers.length ? `
    <div class="home-section-header" style="margin-top:var(--space-xl)">
        <h2>Goleadores del Torneo</h2>
        <a href="#/stats" class="view-all-sm">Ver todos</a>
    </div>
    <div class="home-scorers">
        ${topScorers.map((s, i) => `
        <div class="scorer-card">
            <span class="scorer-rank">${i + 1}</span>
            ${s.teamLogo ? `<img class="scorer-flag" src="${s.teamLogo}" alt="">` : ''}
            <span class="scorer-name">${s.name}</span>
            <span class="scorer-info">${s.position} - ${s.team}</span>
            <span class="scorer-goals">${s.goals} gol${s.goals !== 1 ? 'es' : ''}</span>
        </div>`).join('')}
    </div>` : ''}`;
}

// Delegacion global para campanitas — funciona en home, hoy, calendario y cualquier pagina
document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.match-bell-btn');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();

    const matchId = btn.dataset.matchId;
    const matchInfo = {
        id: matchId,
        homeTeam: btn.dataset.home || '',
        awayTeam: btn.dataset.away || ''
    };

    const result = await NotificationSystem.toggleAlert(matchId, matchInfo);

    if (result === null) {
        showToast('Activa las notificaciones del navegador para usar alertas');
        return;
    }

    btn.classList.toggle('active', result);
    const svg = btn.querySelector('svg');
    if (svg) svg.setAttribute('fill', result ? 'currentColor' : 'none');
    btn.title = result ? 'Alerta activa — haz clic para desactivar' : 'Activar alerta para este partido';

    const label = matchInfo.homeTeam && matchInfo.awayTeam
        ? `${matchInfo.homeTeam} vs ${matchInfo.awayTeam}`
        : 'este partido';
    showToast(result ? `Alerta activada: ${label}` : 'Alerta eliminada');
}, true); // captura en fase capture para ganar al enlace

function showToast(msg) {
    let toast = document.getElementById('mundial-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'mundial-toast';
        toast.className = 'mundial-toast';
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), 3000);
}

document.addEventListener('DOMContentLoaded', init);

/*
 * stats.js
 * Pagina de estadisticas globales del torneo.
 * Calcula: goles totales, goles por partido, mejor ataque/defensa,
 * posesion media, corners, tiros y goleadores individuales.
 *
 * Los datos se obtienen consultando los resultados de los ultimos 14 dias
 * (el servidor acumula todos los partidos terminados en ese periodo).
 */

import { Scraper } from '../scraper.js';

export const Stats = {
    async render(container) {
        container.innerHTML = `
            <div class="stats-page">
                <div class="page-header">
                    <h1>Estadisticas del Torneo</h1>
                </div>
                <div id="stats-overview" class="stats-overview"><div class="loading">Cargando estadisticas...</div></div>
                <div id="stats-players" class="stats-players"></div>
                <div id="stats-rankings" class="stats-rankings-full"></div>
                <div class="stats-modal-overlay" id="stats-modal" style="display:none">
                    <div class="stats-modal">
                        <div class="stats-modal-header">
                            <h2 id="stats-modal-title"></h2>
                            <button class="stats-modal-close" id="stats-modal-close">&times;</button>
                        </div>
                        <div class="stats-modal-body" id="stats-modal-body"></div>
                    </div>
                </div>
            </div>`;

        document.getElementById('stats-modal-close')?.addEventListener('click', () => this.closeModal());
        document.getElementById('stats-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'stats-modal') this.closeModal();
        });

        const [data, topData] = await Promise.all([
            Scraper.getTournamentStats(),
            Scraper.getTopScorers()
        ]);
        if (!data) {
            document.getElementById('stats-overview').innerHTML = '<div class="error">Error cargando estadisticas</div>';
            return;
        }
        this.renderOverview(data);
        if (topData) {
            this.renderPlayers(topData);
            this.topData = topData;
        }
        this.renderRankings(data);
        this.tournamentData = data;
    },

    renderOverview(data) {
        const el = document.getElementById('stats-overview');
        if (!el) return;
        el.innerHTML = `
        <div class="stats-cards">
            <div class="stats-card">
                <span class="stats-card-val">${data.totalMatches}</span>
                <span class="stats-card-label">Partidos jugados</span>
            </div>
            <div class="stats-card">
                <span class="stats-card-val">${data.totalGoals}</span>
                <span class="stats-card-label">Goles totales</span>
            </div>
            <div class="stats-card">
                <span class="stats-card-val">${data.goalsPerMatch}</span>
                <span class="stats-card-label">Goles por partido</span>
            </div>
        </div>`;
    },

    renderPlayers(topData) {
        const el = document.getElementById('stats-players');
        if (!el) return;

        const sections = [
            { id: 'scorers', title: 'Goleadores del Torneo', items: topData.topScorers, valueKey: 'goals', valueLabel: 'goles' },
            { id: 'assists', title: 'Mas Asistencias', items: topData.topAssists, valueKey: 'assists', valueLabel: 'asist.' },
            { id: 'cards', title: 'Mas Tarjetas', items: topData.topCards, valueKey: 'cards', valueLabel: 'tarjetas' }
        ].filter(s => s.items?.length > 0);

        if (!sections.length) { el.innerHTML = ''; return; }

        el.innerHTML = sections.map(sec => {
            const visibleItems = sec.items.slice(0, 5);
            return `
            <div class="stats-section-full">
                <div class="stats-section-header">
                    <h2 class="stats-section-title">${sec.title}</h2>
                    ${sec.items.length > 5 ? `<button class="stats-show-more" data-section="${sec.id}" data-type="player">Ver top ${Math.min(sec.items.length, 20)}</button>` : ''}
                </div>
                <div class="stats-ranking">
                    ${visibleItems.map((p, i) => `
                    <div class="stats-rank-row">
                        <span class="stats-rank-pos">${i + 1}</span>
                        ${p.teamLogo ? `<img class="stats-rank-flag" src="${p.teamLogo}" alt="">` : ''}
                        <div class="stats-rank-player">
                            <span class="stats-rank-name">${p.name}</span>
                            <span class="stats-rank-team">${p.team} - ${p.position || ''}</span>
                        </div>
                        <span class="stats-rank-val">${p[sec.valueKey]}<small>${sec.valueLabel}</small></span>
                    </div>`).join('')}
                </div>
            </div>`;
        }).join('');

        el.querySelectorAll('.stats-show-more').forEach(btn => {
            btn.addEventListener('click', () => this.openModal(btn.dataset.section, 'player'));
        });
    },

    renderRankings(data) {
        const el = document.getElementById('stats-rankings');
        if (!el) return;

        const sections = [
            { id: 'attack', title: 'Mejor Ataque', teams: data.bestAttack, valueKey: 'goals', valueLabel: 'goles' },
            { id: 'defense', title: 'Mejor Defensa', teams: data.bestDefense, valueKey: 'conceded', valueLabel: 'encajados' },
            { id: 'cleansheets', title: 'Porterias a Cero', teams: data.mostCleanSheets, valueKey: 'total', valueLabel: '' },
            { id: 'efficiency', title: 'Eficacia Goleadora', teams: data.bestEfficiency, valueKey: 'efficiency', valueLabel: '%' },
            { id: 'possession', title: 'Mas Posesion', teams: data.bestPossession, valueKey: 'avg', valueLabel: '%' },
            { id: 'shotsontarget', title: 'Tiros a Puerta', teams: data.mostShotsOnTarget, valueKey: 'total', valueLabel: '' },
            { id: 'corners', title: 'Mas Corners', teams: data.mostCorners, valueKey: 'total', valueLabel: '' },
            { id: 'shots', title: 'Mas Tiros Totales', teams: data.mostShots, valueKey: 'total', valueLabel: '' },
            { id: 'fouls', title: 'Mas Faltas', teams: data.mostFouls, valueKey: 'total', valueLabel: '' }
        ].filter(s => s.teams?.length > 0);

        if (!sections.length) { el.innerHTML = ''; return; }

        el.innerHTML = sections.map(sec => {
            const visibleItems = sec.teams.slice(0, 15);
            return `
            <div class="stats-section-full">
                <div class="stats-section-header">
                    <h2 class="stats-section-title">${sec.title}</h2>
                    ${sec.teams.length > 15 ? `<button class="stats-show-more" data-section="${sec.id}" data-type="team">Ver top ${Math.min(sec.teams.length, 20)}</button>` : ''}
                </div>
                <div class="stats-ranking">
                    ${visibleItems.map((t, i) => `
                    <div class="stats-rank-row">
                        <span class="stats-rank-pos">${i + 1}</span>
                        ${t.logo ? `<img class="stats-rank-flag" src="${t.logo}" alt="">` : ''}
                        <span class="stats-rank-name">${t.name}</span>
                        <span class="stats-rank-val">${t[sec.valueKey]}<small>${sec.valueLabel}</small></span>
                    </div>`).join('')}
                </div>
            </div>`;
        }).join('');

        el.querySelectorAll('.stats-show-more').forEach(btn => {
            btn.addEventListener('click', () => this.openModal(btn.dataset.section, 'team'));
        });
    },

    openModal(sectionId, type) {
        const modal = document.getElementById('stats-modal');
        const titleEl = document.getElementById('stats-modal-title');
        const bodyEl = document.getElementById('stats-modal-body');
        if (!modal || !titleEl || !bodyEl) return;

        let items = [];
        let title = '';
        let valueKey = '', valueLabel = '';

        if (type === 'player') {
            const sec = [
                { id: 'scorers', title: 'Goleadores del Torneo', items: this.topData?.topScorers, valueKey: 'goals', valueLabel: 'goles' },
                { id: 'assists', title: 'Mas Asistencias', items: this.topData?.topAssists, valueKey: 'assists', valueLabel: 'asist.' },
                { id: 'cards', title: 'Mas Tarjetas', items: this.topData?.topCards, valueKey: 'cards', valueLabel: 'tarjetas' }
            ].find(s => s.id === sectionId);
            if (sec) {
                items = sec.items || [];
                title = sec.title;
                valueKey = sec.valueKey;
                valueLabel = sec.valueLabel;
            }
        } else {
            const sec = [
                { id: 'attack', title: 'Mejor Ataque', teams: this.tournamentData?.bestAttack, valueKey: 'goals', valueLabel: 'goles' },
                { id: 'defense', title: 'Mejor Defensa', teams: this.tournamentData?.bestDefense, valueKey: 'conceded', valueLabel: 'encajados' },
                { id: 'cleansheets', title: 'Porterias a Cero', teams: this.tournamentData?.mostCleanSheets, valueKey: 'total', valueLabel: '' },
                { id: 'efficiency', title: 'Eficacia Goleadora', teams: this.tournamentData?.bestEfficiency, valueKey: 'efficiency', valueLabel: '%' },
                { id: 'possession', title: 'Mas Posesion', teams: this.tournamentData?.bestPossession, valueKey: 'avg', valueLabel: '%' },
                { id: 'shotsontarget', title: 'Tiros a Puerta', teams: this.tournamentData?.mostShotsOnTarget, valueKey: 'total', valueLabel: '' },
                { id: 'corners', title: 'Mas Corners', teams: this.tournamentData?.mostCorners, valueKey: 'total', valueLabel: '' },
                { id: 'shots', title: 'Mas Tiros Totales', teams: this.tournamentData?.mostShots, valueKey: 'total', valueLabel: '' },
                { id: 'fouls', title: 'Mas Faltas', teams: this.tournamentData?.mostFouls, valueKey: 'total', valueLabel: '' }
            ].find(s => s.id === sectionId);
            if (sec) {
                items = sec.teams || [];
                title = sec.title;
                valueKey = sec.valueKey;
                valueLabel = sec.valueLabel;
            }
        }

        titleEl.textContent = title;
        const topItems = items.slice(0, 20);
        bodyEl.innerHTML = topItems.map((item, i) => {
            if (type === 'player') {
                return `<div class="stats-rank-row">
                    <span class="stats-rank-pos">${i + 1}</span>
                    ${item.teamLogo ? `<img class="stats-rank-flag" src="${item.teamLogo}" alt="">` : ''}
                    <div class="stats-rank-player">
                        <span class="stats-rank-name">${item.name}</span>
                        <span class="stats-rank-team">${item.team} - ${item.position || ''}</span>
                    </div>
                    <span class="stats-rank-val">${item[valueKey]}<small>${valueLabel}</small></span>
                </div>`;
            } else {
                return `<div class="stats-rank-row">
                    <span class="stats-rank-pos">${i + 1}</span>
                    ${item.logo ? `<img class="stats-rank-flag" src="${item.logo}" alt="">` : ''}
                    <span class="stats-rank-name">${item.name}</span>
                    <span class="stats-rank-val">${item[valueKey]}<small>${valueLabel}</small></span>
                </div>`;
            }
        }).join('');

        modal.style.display = 'flex';
    },

    closeModal() {
        const modal = document.getElementById('stats-modal');
        if (modal) modal.style.display = 'none';
    }
};

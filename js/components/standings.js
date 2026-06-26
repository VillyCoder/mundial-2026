import { Scraper } from '../scraper.js';
import { getFavoriteTeam } from '../config.js';

export const Standings = {
    async render(el) {
        el.innerHTML = `
            <div class="standings-page">
                <div class="page-header"><h1>Clasificacion Mundial 2026</h1></div>
                <div id="standings-grid" class="standings-grid"><div class="loading">Cargando clasificacion...</div></div>
            </div>`;
        const data = await Scraper.getStandings();
        if (!data?.groups?.length) {
            document.getElementById('standings-grid').innerHTML = '<div class="no-matches">Sin datos</div>';
            return;
        }
        this.renderAllGroups(data.groups);
    },

    renderAllGroups(groups) {
        const el = document.getElementById('standings-grid');
        if (!el) return;
        const fav = getFavoriteTeam();

        el.innerHTML = groups.map(group => `
            <div class="standings-group-card">
                <div class="standings-group-header">
                    <span class="standings-group-name">${group.name}</span>
                </div>
                <div class="standings-group-table">
                    <div class="sgt-header">
                        <span class="sgt-col sgt-pos">#</span>
                        <span class="sgt-col sgt-team">Equipo</span>
                        <span class="sgt-col sgt-stat">PJ</span>
                        <span class="sgt-col sgt-stat">PG</span>
                        <span class="sgt-col sgt-stat">PE</span>
                        <span class="sgt-col sgt-stat">PP</span>
                        <span class="sgt-col sgt-stat">DG</span>
                        <span class="sgt-col sgt-pts">Pts</span>
                    </div>
                    ${group.teams.map((t, i) => `
                    <div class="sgt-row ${t.code === fav.code || t.name === fav.name ? 'favorite' : ''} ${i < 2 ? 'qualified' : ''}">
                        <span class="sgt-col sgt-pos">${t.pos}</span>
                        <span class="sgt-col sgt-team">
                            ${t.logo ? `<img class="sgt-flag" src="${t.logo}" alt="${t.code}">` : ''}
                            <span class="sgt-name">${t.name}</span>
                        </span>
                        <span class="sgt-col sgt-stat">${t.played}</span>
                        <span class="sgt-col sgt-stat">${t.won}</span>
                        <span class="sgt-col sgt-stat">${t.drawn}</span>
                        <span class="sgt-col sgt-stat">${t.lost}</span>
                        <span class="sgt-col sgt-stat">${t.gd > 0 ? '+' : ''}${t.gd}</span>
                        <span class="sgt-col sgt-pts">${t.points}</span>
                    </div>`).join('')}
                </div>
            </div>
        `).join('');
    }
};

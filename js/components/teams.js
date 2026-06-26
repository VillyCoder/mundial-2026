/*
 * teams.js
 * Pagina de equipos: muestra todos los participantes agrupados por fase,
 * con sus estadisticas de grupo. Al hacer clic en un equipo se abre
 * la plantilla completa con posicion y dorsal de cada jugador.
 *
 * Las fotos de los jugadores se cargan de forma "lazy" (perezosa) desde
 * TheSportsDB (API gratuita) para no bloquear la carga inicial de la pagina.
 * Mientras llegan, se muestran las iniciales del jugador.
 */

import { Scraper } from '../scraper.js';

// Carga fotos de los jugadores visibles en el contenedor de forma progresiva.
// Se procesan en lotes de 3 para no saturar la API gratuita de TheSportsDB.
async function loadPhotosForRoster(container) {
    const players = container.querySelectorAll('[data-player-name]');
    const queue = Array.from(players);
    const batchSize = 3;

    const processNext = async () => {
        const batch = queue.splice(0, batchSize);
        if (!batch.length) return;
        await Promise.all(batch.map(async el => {
            const name = el.dataset.playerName;
            const photo = await Scraper.getPlayerPhoto(name);
            if (photo?.thumb) {
                el.innerHTML = `<img src="${photo.thumb}" alt="${name}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.parentElement.textContent=this.parentElement.dataset.initials">`;
                el.dataset.initials = el.textContent;
            }
        }));
        if (queue.length) setTimeout(processNext, 200);
    };
    processNext();
}

export const Teams = {
    allTeams: [],
    selectedTeam: null,

    async render(container) {
        container.innerHTML = `
            <div class="teams-page">
                <div class="page-header">
                    <h1>Equipos</h1>
                </div>
                <div id="teams-grid" class="teams-grid"><div class="loading">Cargando equipos...</div></div>
                <div id="team-detail" class="team-detail"></div>
            </div>`;

        const data = await Scraper.getTeams();
        if (!data?.teams?.length) {
            document.getElementById('teams-grid').innerHTML = '<div class="no-matches">Sin datos</div>';
            return;
        }
        this.allTeams = data.teams;
        this.renderGrid();
    },

    renderGrid() {
        const el = document.getElementById('teams-grid');
        if (!el) return;

        const groups = {};
        this.allTeams.forEach(t => {
            const g = t.group || 'Sin grupo';
            if (!groups[g]) groups[g] = [];
            groups[g].push(t);
        });

        el.innerHTML = Object.entries(groups).map(([groupName, teams]) => `
            <div class="teams-group">
                <div class="teams-group-header">
                    <h3 class="teams-group-title">${groupName}</h3>
                </div>
                <div class="teams-list">
                    ${teams.map(t => `
                    <div class="team-row" data-id="${t.id}" data-code="${t.code}">
                        <div class="team-row-left">
                            ${t.logo ? `<img class="team-row-logo" src="${t.logo}" alt="${t.code}">` : ''}
                            <span class="team-row-name">${t.name}</span>
                        </div>
                        <div class="team-row-right">
                            <div class="team-stat-cell">
                                <span class="team-stat-label">PJ</span>
                                <span class="team-stat-val">${t.played}</span>
                            </div>
                            <div class="team-stat-cell">
                                <span class="team-stat-label">G</span>
                                <span class="team-stat-val">${t.won}</span>
                            </div>
                            <div class="team-stat-cell">
                                <span class="team-stat-label">E</span>
                                <span class="team-stat-val">${t.drawn}</span>
                            </div>
                            <div class="team-stat-cell">
                                <span class="team-stat-label">P</span>
                                <span class="team-stat-val">${t.lost}</span>
                            </div>
                            <div class="team-stat-cell team-stat-pts">
                                <span class="team-stat-label">Pts</span>
                                <span class="team-stat-val">${t.points}</span>
                            </div>
                        </div>
                    </div>`).join('')}
                </div>
            </div>
        `).join('');

        el.querySelectorAll('.team-row').forEach(row => {
            row.addEventListener('click', () => {
                const teamId = row.dataset.id;
                const team = this.allTeams.find(t => t.id === teamId);
                if (team) this.showTeamDetail(team);
            });
        });
    },

    async showTeamDetail(team) {
        this.selectedTeam = team;
        const detailEl = document.getElementById('team-detail');
        const gridEl = document.getElementById('teams-grid');
        if (!detailEl) return;

        gridEl.style.display = 'none';
        detailEl.innerHTML = '<div class="loading">Cargando plantilla...</div>';

        const roster = await Scraper.getRoster(team.id);

        detailEl.innerHTML = `
        <div class="team-detail-page">
            <button class="back-link" id="teams-back">&larr; Volver a equipos</button>
            <div class="team-detail-hero">
                ${team.logo ? `<img class="team-detail-logo" src="${team.logo}" alt="${team.code}">` : ''}
                <div class="team-detail-info">
                    <h2>${team.name}</h2>
                    <span class="team-detail-group">${team.group}</span>
                </div>
            </div>
            <div class="team-detail-stats-row">
                <div class="td-stat"><span class="td-stat-val">${team.points}</span><span class="td-stat-label">Pts</span></div>
                <div class="td-stat"><span class="td-stat-val">${team.played}</span><span class="td-stat-label">PJ</span></div>
                <div class="td-stat"><span class="td-stat-val">${team.won}</span><span class="td-stat-label">PG</span></div>
                <div class="td-stat"><span class="td-stat-val">${team.drawn}</span><span class="td-stat-label">PE</span></div>
                <div class="td-stat"><span class="td-stat-val">${team.lost}</span><span class="td-stat-label">PP</span></div>
                <div class="td-stat"><span class="td-stat-val">${team.gf}</span><span class="td-stat-label">GF</span></div>
                <div class="td-stat"><span class="td-stat-val">${team.ga}</span><span class="td-stat-label">GC</span></div>
            </div>
            <div class="team-roster">
                <h3>Plantilla</h3>
                ${roster?.athletes?.length ? this.renderRoster(roster.athletes) : '<div class="no-data">Sin datos de plantilla</div>'}
            </div>
        </div>`;

        const rosterEl = detailEl.querySelector('.team-roster');
        if (rosterEl) loadPhotosForRoster(rosterEl);

        document.getElementById('teams-back')?.addEventListener('click', () => {
            detailEl.innerHTML = '';
            gridEl.style.display = '';
        });
    },

    renderCoaches(coaches) {
        return `
        <div class="coach-section">
            <h3>Cuerpo Tecnico</h3>
            ${coaches.map(c => `
            <div class="coach-row" data-coach-name="${c.name}">
                <div class="coach-avatar" data-coach-name="${c.name}">${c.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}</div>
                <div class="coach-info">
                    <span class="coach-name">${c.name}</span>
                    <span class="coach-role">${c.role}</span>
                </div>
            </div>`).join('')}
        </div>`;
    },

    renderRoster(athletes) {
        const posGroups = { G: [], D: [], M: [], F: [] };
        athletes.forEach(a => {
            const pos = a.position || '';
            if (posGroups[pos]) posGroups[pos].push(a);
            else posGroups['M'].push(a);
        });

        const posLabels = { G: 'Porteros', D: 'Defensas', M: 'Centrocampistas', F: 'Delanteros' };

        return Object.entries(posGroups).filter(([, p]) => p.length > 0).map(([pos, players]) => `
            <div class="roster-position">
                <h4 class="roster-pos-title">${posLabels[pos] || pos}</h4>
                <div class="roster-list">
                    ${players.map(p => {
                        const initials = p.name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();
                        return `
                    <div class="roster-player">
                        <span class="roster-num">${p.jersey || '-'}</span>
                        <span class="roster-avatar" data-player-name="${p.name}" data-initials="${initials}">${initials}</span>
                        <span class="roster-name">${p.name}</span>
                    </div>`;
                    }).join('')}
                </div>
            </div>
        `).join('');
    }
};

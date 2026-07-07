import { Scraper } from '../scraper.js';

const LABELS = {
    r32: 'Ronda de 32',
    r16: 'Octavos',
    qf: 'Cuartos',
    sf: 'Semifinales',
    final: 'Final',
    third: '3er puesto'
};
const SHOW_ORDER = ['r32', 'r16', 'qf', 'sf', 'final', 'third'];

export const Bracket = {
    async render(el) {
        el.innerHTML = `
            <div class="bracket-page">
                <div class="page-header"><h1>Cuadro Eliminatorio</h1></div>
                <div class="loading">Cargando eliminatorias...</div>
            </div>`;

        const data = await Scraper.getBracket();
        const rounds = data?.rounds;
        if (!rounds) {
            el.innerHTML = '<div class="no-matches">Sin datos de eliminatorias</div>';
            return;
        }

        el.innerHTML = `<div class="bracket-page"><div class="page-header"><h1>Cuadro Eliminatorio</h1></div></div>`;
        this.build(el.querySelector('.bracket-page'), rounds);
    },

    // Primera ronda con partidos aún no terminados (la más antigua pendiente)
    activeRound(rounds) {
        for (const r of SHOW_ORDER) {
            if ((rounds[r] || []).some(m => m.status !== 'finished')) return r;
        }
        // Todo terminado → mostrar la final
        return 'final';
    },

    build(el, rounds) {
        const active = this.activeRound(rounds);
        const tabs = SHOW_ORDER.filter(r => (rounds[r] || []).length > 0);

        const nav = `
            <nav class="bv-tabs" aria-label="Rondas">
                ${tabs.map(r => `
                    <button class="bv-tab${r === active ? ' active' : ''}" data-round="${r}">
                        ${LABELS[r]}
                    </button>`).join('')}
            </nav>`;

        const panels = tabs.map(r => `
            <div class="bv-panel${r === active ? ' active' : ''}" data-round="${r}">
                <div class="bv-grid bv-grid-${r}">
                    ${(rounds[r] || []).map(m => this.card(m)).join('')}
                </div>
            </div>`).join('');

        el.insertAdjacentHTML('beforeend', `<div class="bv-wrap">${nav}<div class="bv-panels">${panels}</div></div>`);

        el.querySelectorAll('.bv-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                el.querySelectorAll('.bv-tab').forEach(b => b.classList.remove('active'));
                el.querySelectorAll('.bv-panel').forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                el.querySelector(`.bv-panel[data-round="${btn.dataset.round}"]`)?.classList.add('active');
            });
        });
    },

    card(m) {
        if (!m) return '';
        const done = m.status === 'finished';
        const live = m.status === 'live';
        const hWin = done && m.homeScore > m.awayScore;
        const aWin = done && m.awayScore > m.homeScore;

        const row = (name, logo, score, win, lose) => `
            <div class="bv-team${win ? ' winner' : lose ? ' loser' : ''}">
                ${logo
                    ? `<img class="bv-flag" src="${logo}" alt="${name}">`
                    : '<span class="bv-flag-ph"></span>'}
                <span class="bv-name">${name || '?'}</span>
                ${(done || live) ? `<span class="bv-score">${score ?? '-'}</span>` : ''}
            </div>`;

        return `
            <div class="bv-card${live ? ' live' : ''}${done ? ' done' : ''}">
                <div class="bv-card-date">
                    ${live
                        ? '<span class="bv-live">● EN VIVO</span>'
                        : `<span>${m.dateMadrid || ''}</span>`}
                </div>
                ${row(m.homeTeam, m.homeLogo, m.homeScore, hWin, aWin)}
                <div class="bv-sep"></div>
                ${row(m.awayTeam, m.awayLogo, m.awayScore, aWin, hWin)}
            </div>`;
    }
};

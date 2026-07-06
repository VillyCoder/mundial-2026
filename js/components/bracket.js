import { Scraper } from '../scraper.js';

// Rueda SVG del cuadro eliminatorio del Mundial 2026
// Centro → Campeón | Anillo 1 → Finalistas | ... | Anillo 5 → 32 clasificados

const CX = 380, CY = 380;
const RADII     = [63.6, 127.2, 190.8, 254.4, 318.0]; // inner→outer
const NODE_R    = [14.2,  16.4,  18.6,  20.8,  23.0];
const CHAMP_R   = 30;
const STEP_DEG  = 10;       // grados entre equipos adyacentes
const START_DEG = -75;      // primer equipo del lado derecho

// Ángulo en grados para el slot i-ésimo del anillo exterior (0-31)
function teamDeg(i) {
    return i < 16 ? START_DEG + i * STEP_DEG : 105 + (i - 16) * STEP_DEG;
}

// Ángulo promedio para un rango de slots del anillo exterior
function avgDeg(from, to) {
    let sum = 0;
    for (let i = from; i < to; i++) sum += teamDeg(i);
    return sum / (to - from);
}

function toRad(d) { return d * Math.PI / 180; }
function polarXY(r, deg) {
    const a = toRad(deg);
    return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
}
function fmt(n) { return n.toFixed(2); }

// Determina el ganador de un partido normalizado
function winner(m) {
    if (!m || m.status !== 'finished') return null;
    if (m.homeScore > m.awayScore) return { name: m.homeTeam, logo: m.homeLogo };
    if (m.awayScore > m.homeScore) return { name: m.awayTeam, logo: m.awayLogo };
    // Penaltis: no aparece en score diferencial → usamos el último gol o dejamos null
    return null;
}

function renderNode(x, y, r, team, extra = '') {
    const uid = `n${Math.random().toString(36).slice(2,8)}`;
    let out = `<g class="bw-node${extra}" data-name="${team?.name || ''}">`;
    out += `<circle class="bw-bg" cx="${fmt(x)}" cy="${fmt(y)}" r="${r}"/>`;
    if (team?.logo) {
        out += `<clipPath id="${uid}"><circle cx="${fmt(x)}" cy="${fmt(y)}" r="${r}"/></clipPath>`;
        out += `<image class="bw-logo" href="${team.logo}" `
             + `x="${fmt(x - r)}" y="${fmt(y - r)}" `
             + `width="${fmt(r * 2)}" height="${fmt(r * 2)}" `
             + `clip-path="url(#${uid})" preserveAspectRatio="xMidYMid slice"/>`;
    }
    out += `<circle class="bw-ring" cx="${fmt(x)}" cy="${fmt(y)}" r="${r}"/>`;
    if (team?.name) out += `<title>${team.name}</title>`;
    out += `</g>`;
    return out;
}

// Traza línea entre dos nodos
function link(x1, y1, x2, y2) {
    return `<line class="bw-link" x1="${fmt(x1)}" y1="${fmt(y1)}" x2="${fmt(x2)}" y2="${fmt(y2)}"/>`;
}

export const Bracket = {
    async render(el) {
        el.innerHTML = `
            <div class="bracket-page">
                <div class="page-header"><h1>Cuadro Eliminatorio</h1></div>
                <div id="bracket-wrap" class="bracket-wrap">
                    <div class="loading">Cargando eliminatorias...</div>
                </div>
            </div>`;

        const data = await Scraper.getBracket();
        const wrap = document.getElementById('bracket-wrap');
        if (!wrap) return;

        const rounds = data?.rounds;
        if (!rounds) {
            wrap.innerHTML = '<div class="no-matches">Sin datos de eliminatorias</div>';
            return;
        }

        wrap.innerHTML = this.buildSVG(rounds) + this.buildList(rounds);
        this.bindTooltips(wrap);
    },

    buildSVG(rounds) {
        const r32  = (rounds.r32  || []).slice(0, 16);
        const r16  = (rounds.r16  || []).slice(0, 8);
        const qf   = (rounds.qf   || []).slice(0, 4);
        const sf   = (rounds.sf   || []).slice(0, 2);
        const fin  = (rounds.final|| []).slice(0, 1);

        // Slots del anillo exterior: equipo en posición 2k = local R32[k], 2k+1 = visitante
        function outerTeam(i) {
            const m = r32[Math.floor(i / 2)];
            if (!m) return null;
            return i % 2 === 0
                ? { name: m.homeTeam, logo: m.homeLogo }
                : { name: m.awayTeam, logo: m.awayLogo };
        }

        // Ganadores por anillo
        // ringWinners[0] = winners de r32 (→ r16), [1] = r16 (→qf), [2]=qf (→sf), [3]=sf (→final)
        const ringWinners = [
            r32.map(winner),
            r16.map(winner),
            qf.map(winner),
            sf.map(winner)
        ];
        const champ = fin[0] ? winner(fin[0]) : null;

        let nodes = '', links = '';

        // ── Conexiones ──────────────────────────────────────────────────
        // Outer ring → ring 1 (r32 → r16 bracket)
        for (let k = 0; k < 16; k++) {
            const [ax, ay] = polarXY(RADII[4], teamDeg(k * 2));
            const [bx, by] = polarXY(RADII[4], teamDeg(k * 2 + 1));
            const parentDeg = avgDeg(k * 2, k * 2 + 2);
            const [px, py] = polarXY(RADII[3], parentDeg);
            links += link(ax, ay, px, py);
            links += link(bx, by, px, py);
        }
        // Ring 1 → ring 2 (r32 results → r16)
        for (let k = 0; k < 8; k++) {
            const [ax, ay] = polarXY(RADII[3], avgDeg(k * 2, k * 2 + 2));
            const [bx, by] = polarXY(RADII[3], avgDeg(k * 2 + 2, k * 2 + 4));
            const parentDeg = avgDeg(k * 4, k * 4 + 4);
            const [px, py] = polarXY(RADII[2], parentDeg);
            links += link(ax, ay, px, py);
            links += link(bx, by, px, py);
        }
        // Ring 2 → ring 3 (r16 → qf)
        for (let k = 0; k < 4; k++) {
            const [ax, ay] = polarXY(RADII[2], avgDeg(k * 4, k * 4 + 4));
            const [bx, by] = polarXY(RADII[2], avgDeg(k * 4 + 4, k * 4 + 8));
            const parentDeg = avgDeg(k * 8, k * 8 + 8);
            const [px, py] = polarXY(RADII[1], parentDeg);
            links += link(ax, ay, px, py);
            links += link(bx, by, px, py);
        }
        // Ring 3 → ring 4 (qf → sf)
        for (let k = 0; k < 2; k++) {
            const [ax, ay] = polarXY(RADII[1], avgDeg(k * 8, k * 8 + 8));
            const [bx, by] = polarXY(RADII[1], avgDeg(k * 8 + 8, k * 8 + 16));
            const parentDeg = avgDeg(k * 16, k * 16 + 16);
            const [px, py] = polarXY(RADII[0], parentDeg);
            links += link(ax, ay, px, py);
            links += link(bx, by, px, py);
        }
        // Ring 4 → center
        for (let k = 0; k < 2; k++) {
            const [fx, fy] = polarXY(RADII[0], avgDeg(k * 16, k * 16 + 16));
            links += link(fx, fy, CX, CY);
        }

        // ── Nodos anillo exterior (32 equipos) ──────────────────────────
        for (let i = 0; i < 32; i++) {
            const [x, y] = polarXY(RADII[4], teamDeg(i));
            const t = outerTeam(i);
            nodes += renderNode(x, y, NODE_R[4], t);
        }

        // ── Nodos anillos interiores ─────────────────────────────────────
        // Ring 3: r32 results (16 nodos)
        for (let k = 0; k < 16; k++) {
            const deg = avgDeg(k * 2, k * 2 + 2);
            const [x, y] = polarXY(RADII[3], deg);
            const m = r32[k];
            const w = ringWinners[0][k];
            const pending = !m || m.status !== 'finished';
            const cls = w ? '' : (pending ? ' pending' : ' eliminated-slot');
            const label = m ? (m.status === 'finished'
                ? `${m.homeTeam} ${m.homeScore}-${m.awayScore} ${m.awayTeam}`
                : `${m.homeTeam} vs ${m.awayTeam} · ${m.dateMadrid}`) : '';
            nodes += renderNode(x, y, NODE_R[3], w, cls)
                .replace('</g>', `${label ? `<title>${label}</title>` : ''}</g>`);
        }

        // Ring 2: r16 results (8 nodos)
        for (let k = 0; k < 8; k++) {
            const deg = avgDeg(k * 4, k * 4 + 4);
            const [x, y] = polarXY(RADII[2], deg);
            const m = r16[k];
            const w = ringWinners[1][k];
            const pending = !m || m.status !== 'finished';
            const label = m ? (m.status === 'finished'
                ? `${m.homeTeam} ${m.homeScore}-${m.awayScore} ${m.awayTeam}`
                : `${m.homeTeam} vs ${m.awayTeam} · ${m.dateMadrid}`) : '';
            nodes += renderNode(x, y, NODE_R[2], w, pending ? ' pending' : '')
                .replace('</g>', `${label ? `<title>${label}</title>` : ''}</g>`);
        }

        // Ring 1: qf results (4 nodos)
        for (let k = 0; k < 4; k++) {
            const deg = avgDeg(k * 8, k * 8 + 8);
            const [x, y] = polarXY(RADII[1], deg);
            const m = qf[k];
            const w = ringWinners[2][k];
            const pending = !m || m.status !== 'finished';
            const label = m ? (m.status === 'finished'
                ? `${m.homeTeam} ${m.homeScore}-${m.awayScore} ${m.awayTeam}`
                : `${m.homeTeam} vs ${m.awayTeam} · ${m.dateMadrid}`) : '';
            nodes += renderNode(x, y, NODE_R[1], w, pending ? ' pending' : '')
                .replace('</g>', `${label ? `<title>${label}</title>` : ''}</g>`);
        }

        // Ring 0: sf results / finalistas (2 nodos)
        for (let k = 0; k < 2; k++) {
            const deg = avgDeg(k * 16, k * 16 + 16);
            const [x, y] = polarXY(RADII[0], deg);
            const m = sf[k];
            const w = ringWinners[3][k];
            const pending = !m || m.status !== 'finished';
            const label = m ? (m.status === 'finished'
                ? `${m.homeTeam} ${m.homeScore}-${m.awayScore} ${m.awayTeam}`
                : `${m.homeTeam} vs ${m.awayTeam} · ${m.dateMadrid}`) : '';
            nodes += renderNode(x, y, NODE_R[0], w, pending ? ' pending' : '')
                .replace('</g>', `${label ? `<title>${label}</title>` : ''}</g>`);
        }

        // ── Centro: Campeón ──────────────────────────────────────────────
        const uid = `champ${Math.random().toString(36).slice(2,8)}`;
        let champNode = `<g class="bw-champion">`;
        if (champ?.logo) {
            champNode += `<clipPath id="${uid}"><circle cx="${CX}" cy="${CY}" r="${CHAMP_R}"/></clipPath>`;
            champNode += `<image href="${champ.logo}" x="${CX - CHAMP_R}" y="${CY - CHAMP_R}" `
                       + `width="${CHAMP_R * 2}" height="${CHAMP_R * 2}" clip-path="url(#${uid})" preserveAspectRatio="xMidYMid slice"/>`;
        } else {
            champNode += `<circle cx="${CX}" cy="${CY}" r="${CHAMP_R}" class="bw-champ-empty"/>`;
            champNode += `<g transform="translate(${CX - 11},${CY - 14})">
                <path class="bw-trophy" d="M5 1h12v3h3a2 2 0 0 1 2 2c0 3.3-2.2 5.6-5.2 6A6 6 0 0 1 12 15a6 6 0 0 1-4.8-2.9C4.2 11.6 2 9.3 2 6a2 2 0 0 1 2-2h1V1Zm0 5H4c0 1.9 1.1 3.2 2.6 3.7A12 12 0 0 1 5 6Zm14 0h-1a12 12 0 0 1-1.6 3.7C17.9 9.2 19 7.9 19 6ZM9 16.5h6V19h2.5v2h-11v-2H9v-2.5Z"/>
            </g>`;
        }
        champNode += `<circle cx="${CX}" cy="${CY}" r="${CHAMP_R}" class="bw-champ-ring"/>`;
        if (champ?.name) champNode += `<title>Campeón: ${champ.name}</title>`;
        champNode += `</g>`;

        return `
        <div class="bw-wrapper">
            <svg viewBox="0 0 760 760" class="bw-svg" role="img" aria-label="Cuadro eliminatorio Mundial 2026">
                <defs>
                    <radialGradient id="bw-glow">
                        <stop offset="0%"   stop-color="var(--accent-gold, #FFB800)" stop-opacity="0.25"/>
                        <stop offset="55%"  stop-color="var(--accent-gold, #FFB800)" stop-opacity="0.06"/>
                        <stop offset="100%" stop-color="var(--accent-gold, #FFB800)" stop-opacity="0"/>
                    </radialGradient>
                </defs>
                <circle cx="${CX}" cy="${CY}" r="200" fill="url(#bw-glow)"/>
                <g class="bw-links">${links}</g>
                <g class="bw-nodes">${nodes}</g>
                ${champNode}
            </svg>
            <div class="bw-legend">
                <span class="bw-legend-item"><span class="bw-dot active"></span>Avanza</span>
                <span class="bw-legend-item"><span class="bw-dot pending"></span>Por jugar</span>
            </div>
        </div>`;
    },

    // Lista compacta de partidos por ronda (debajo de la rueda en móvil)
    buildList(rounds) {
        const labels = { r32: 'Ronda de 32', r16: 'Octavos', qf: 'Cuartos', sf: 'Semifinales', final: 'Final', third: 'Tercer puesto' };
        const order  = ['final', 'sf', 'qf', 'r16', 'r32', 'third'];
        let html = '<div class="bw-rounds">';
        for (const key of order) {
            const matches = rounds[key];
            if (!matches?.length) continue;
            html += `<div class="bw-round">
                <h3 class="bw-round-title">${labels[key] || key}</h3>
                <div class="bw-round-matches">`;
            for (const m of matches) {
                const finished = m.status === 'finished';
                const live     = m.status === 'live';
                html += `<div class="bw-match${live ? ' live' : ''}">
                    <div class="bw-match-team">
                        ${m.homeLogo ? `<img src="${m.homeLogo}" alt="">` : ''}
                        <span class="${finished && m.homeScore > m.awayScore ? 'bw-winner' : ''}">${m.homeTeam}</span>
                    </div>
                    <div class="bw-match-score">
                        ${finished || live
                            ? `<span>${m.homeScore}</span><span class="sep">-</span><span>${m.awayScore}</span>`
                            : `<span class="bw-time">${m.dateMadrid}</span>`}
                    </div>
                    <div class="bw-match-team away">
                        <span class="${finished && m.awayScore > m.homeScore ? 'bw-winner' : ''}">${m.awayTeam}</span>
                        ${m.awayLogo ? `<img src="${m.awayLogo}" alt="">` : ''}
                    </div>
                </div>`;
            }
            html += `</div></div>`;
        }
        html += '</div>';
        return html;
    },

    bindTooltips(wrap) {
        wrap.querySelectorAll('.bw-node').forEach(node => {
            const name = node.dataset.name;
            const title = node.querySelector('title');
            if (!name && !title) return;
            node.addEventListener('mouseenter', e => {
                const tip = document.createElement('div');
                tip.className = 'bw-tooltip';
                tip.textContent = title?.textContent || name;
                document.body.appendChild(tip);
                const rect = node.getBoundingClientRect();
                tip.style.left = `${rect.left + rect.width / 2 - tip.offsetWidth / 2}px`;
                tip.style.top  = `${rect.top - tip.offsetHeight - 6 + window.scrollY}px`;
                node._tip = tip;
            });
            node.addEventListener('mouseleave', () => {
                node._tip?.remove();
                node._tip = null;
            });
        });
    }
};

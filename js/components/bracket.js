import { Scraper } from '../scraper.js';

// ── LAYOUT ────────────────────────────────────────────────────────────────────
const H   = 512;         // content height
const CW  = 88;          // column width
const GAP = 20;          // gap between columns
const S   = CW + GAP;   // step = 108
const TOP = 36;          // top margin for title

// Left-half column left-edges
const LR32 = 0, LR16 = S, LQF = 2*S, LSF = 3*S;
// Center section
const CTX = 4*S, CTW = 100;    // 432 → 532
// Right-half column left-edges (SF closest to center)
const RSF = CTX + CTW + GAP;   // 552
const RQF = RSF + S;           // 660
const RR16= RSF + 2*S;         // 768
const RR32= RSF + 3*S;         // 876

const SVG_W = RR32 + CW;       // 964
const SVG_H = TOP + H + 12;    // 560

// ── STYLE ─────────────────────────────────────────────────────────────────────
const LINE = '#22c55e', LW = 1.5;
const BG   = '#0d0d0d';

// ── ABBREVIATIONS ─────────────────────────────────────────────────────────────
const ABBR = {
    'Alemania':'ALE','Paraguay':'PAR','Francia':'FRA','Suecia':'SUE',
    'Sudáfrica':'SUD','Canadá':'CAN','Países Bajos':'PBJ','Marruecos':'MAR',
    'Portugal':'POR','Croacia':'CRO','España':'ESP','Austria':'AUT',
    'Estados Unidos':'USA','Bosnia y Herzegovina':'BYH','Bélgica':'BEL','Senegal':'SEN',
    'Brasil':'BRA','Japón':'JAP','Costa de Marfil':'CDM','Noruega':'NOR',
    'México':'MEX','Ecuador':'ECU','Inglaterra':'ING','RD Congo':'RDC',
    'Argentina':'ARG','Cabo Verde':'CBV','Australia':'AUS','Egipto':'EGI',
    'Suiza':'SUI','Argelia':'AGL','Colombia':'COL','Ghana':'GHA',
};
const ab = n => ABBR[n] || (n || '?').slice(0, 3).toUpperCase();

// ── SVG HELPERS ───────────────────────────────────────────────────────────────
const p = n => +n.toFixed(1);
const ln = (x1, y1, x2, y2) =>
    `<line x1="${p(x1)}" y1="${p(y1)}" x2="${p(x2)}" y2="${p(y2)}" stroke="${LINE}" stroke-width="${LW}" stroke-linecap="round"/>`;

// Y centers of all team rows for a round with n matches per half
function teamYs(n) {
    const slotH = H / (2 * n);
    return Array.from({ length: 2 * n }, (_, i) => TOP + (i + 0.5) * slotH);
}

// Universal bracket connector lines (works for both halves)
// fromX = edge of source column toward destination
// toX   = edge of destination column toward source
// ys    = Y centers of teams in source column (paired)
function conn(fromX, toX, ys) {
    const mx = (fromX + toX) / 2;
    let s = '';
    for (let i = 0; i < ys.length; i += 2) {
        const y1 = ys[i], y2 = ys[i + 1];
        if (y2 === undefined) break;
        const ym = (y1 + y2) / 2;
        s += ln(fromX, y1, mx, y1) + ln(fromX, y2, mx, y2);
        s += ln(mx, y1, mx, y2);
        s += ln(mx, ym, toX, ym);
    }
    return s;
}

// Single team row in SVG
function row(x, yc, name, logo, score, win) {
    const fill = win ? '#FFB800' : (name && name !== '?' ? '#d4d4d4' : '#3a3a3a');
    const rh = 22;
    let s = '';
    if (win) s += `<rect x="${x}" y="${p(yc - rh/2)}" width="${CW}" height="${rh}" rx="3" fill="rgba(255,184,0,0.08)"/>`;
    if (logo) s += `<image href="${logo}" x="${x+4}" y="${p(yc-7)}" width="20" height="14" preserveAspectRatio="xMidYMid meet"/>`;
    s += `<text x="${x+28}" y="${p(yc+4)}" fill="${fill}" font-size="11" font-family="Inter,Arial,sans-serif" font-weight="${win ? 700 : 500}">${ab(name)}</text>`;
    if (score != null) s += `<text x="${x+CW-5}" y="${p(yc+4)}" text-anchor="end" fill="${fill}" font-size="11" font-family="Inter,Arial,sans-serif" font-weight="700">${score}</text>`;
    return s;
}

// Two team rows from a match object at given Y centers
function mRows(x, y1, y2, m) {
    if (!m) {
        return row(x, y1, '?', null, null, false) + row(x, y2, '?', null, null, false);
    }
    const d = m.status === 'finished', l = m.status === 'live';
    const hw = d && m.homeScore > m.awayScore;
    const aw = d && m.awayScore > m.homeScore;
    return row(x, y1, m.homeTeam, m.homeLogo, d||l ? m.homeScore : null, hw) +
           row(x, y2, m.awayTeam, m.awayLogo, d||l ? m.awayScore : null, aw);
}

// Fill a column with match pairs (padding with empty slots)
function colCards(x, matches, totalMatches, ys) {
    let s = '';
    for (let i = 0; i < totalMatches; i++) {
        s += mRows(x, ys[i * 2], ys[i * 2 + 1], matches[i] || null);
    }
    return s;
}

// Center section: trophy + final result
function centerSection(fin) {
    const cx = CTX + CTW / 2, cy = TOP + H / 2;
    let s = `<text x="${cx}" y="${cy - 24}" text-anchor="middle" dominant-baseline="middle" font-size="38">🏆</text>`;
    if (fin?.status === 'finished' || fin?.status === 'live') {
        const hw = fin.homeScore > fin.awayScore;
        s += `<text x="${cx}" y="${cy+4}" text-anchor="middle" fill="${hw ? '#FFB800' : '#aaa'}" font-size="10">${ab(fin.homeTeam)}</text>`;
        s += `<text x="${cx}" y="${cy+18}" text-anchor="middle" fill="#fff" font-size="14" font-weight="700">${fin.homeScore} - ${fin.awayScore}</text>`;
        s += `<text x="${cx}" y="${cy+32}" text-anchor="middle" fill="${!hw ? '#FFB800' : '#aaa'}" font-size="10">${ab(fin.awayTeam)}</text>`;
    } else {
        s += `<text x="${cx}" y="${cy+10}" text-anchor="middle" fill="#555" font-size="11" font-weight="700">FINAL</text>`;
        s += `<text x="${cx}" y="${cy+24}" text-anchor="middle" fill="#3a3a3a" font-size="9">${fin?.dateMadrid || '19 jul'}</text>`;
    }
    return s;
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
export const Bracket = {
    async render(el) {
        el.innerHTML = `<div class="bracket-page">
            <div class="page-header"><h1>Cuadro Eliminatorio</h1></div>
            <div class="loading">Cargando eliminatorias...</div>
        </div>`;

        const data = await Scraper.getBracket();
        const rounds = data?.rounds;
        if (!rounds) {
            el.innerHTML = '<div class="no-matches">Sin datos de eliminatorias</div>';
            return;
        }

        el.innerHTML = `<div class="bracket-page">
            <div class="page-header"><h1>Cuadro Eliminatorio</h1></div>
        </div>`;
        el.querySelector('.bracket-page').insertAdjacentHTML('beforeend', this.build(rounds));
    },

    build(rounds) {
        const r32 = rounds.r32 || [], r16 = rounds.r16 || [];
        const qf  = rounds.qf  || [], sf  = rounds.sf  || [];
        const fin = (rounds.final || [])[0] || null;

        // Split into left / right halves
        const lR32 = r32.slice(0, 8),  rR32 = r32.slice(8, 16);
        const lR16 = r16.slice(0, 4),  rR16 = r16.slice(4, 8);
        const lQF  = qf.slice(0, 2),   rQF  = qf.slice(2, 4);
        const lSF  = sf[0] || null,    rSF  = sf[1] || null;

        // Y positions for each round (team centers)
        const R32Y = teamYs(8);  // 16 entries
        const R16Y = teamYs(4);  // 8 entries
        const QFY  = teamYs(2);  // 4 entries
        const SFY  = teamYs(1);  // 2 entries: [164, 420]

        let cards = '', lines = '';

        // ── LEFT HALF ─────────────────────────────────────────────────────────
        cards += colCards(LR32, lR32, 8, R32Y);
        cards += colCards(LR16, lR16, 4, R16Y);
        cards += colCards(LQF,  lQF,  2, QFY);
        cards += mRows(LSF, SFY[0], SFY[1], lSF);

        lines += conn(LR32 + CW, LR16,     R32Y);
        lines += conn(LR16 + CW, LQF,      R16Y);
        lines += conn(LQF  + CW, LSF,      QFY);
        lines += conn(LSF  + CW, CTX,      SFY);

        // ── RIGHT HALF ────────────────────────────────────────────────────────
        cards += colCards(RR32, rR32, 8, R32Y);
        cards += colCards(RR16, rR16, 4, R16Y);
        cards += colCards(RQF,  rQF,  2, QFY);
        cards += mRows(RSF, SFY[0], SFY[1], rSF);

        lines += conn(RR32,     RR16 + CW, R32Y);
        lines += conn(RR16,     RQF  + CW, R16Y);
        lines += conn(RQF,      RSF  + CW, QFY);
        lines += conn(RSF,      CTX + CTW, SFY);

        // ── CENTER ────────────────────────────────────────────────────────────
        cards += centerSection(fin);

        // Round column labels
        const label = (x, txt) =>
            `<text x="${x + CW/2}" y="${TOP - 6}" text-anchor="middle" fill="#555" font-size="9" font-family="Inter,Arial,sans-serif" font-weight="600" letter-spacing="0.5">${txt}</text>`;
        const colLabels =
            label(LR32,'16avos') + label(LR16,'Octavos') + label(LQF,'Cuartos') + label(LSF,'Semis') +
            label(RR32,'16avos') + label(RR16,'Octavos') + label(RQF,'Cuartos') + label(RSF,'Semis');

        const title = `<text x="${SVG_W/2}" y="18" text-anchor="middle" fill="#d0d0d0" font-size="12" font-weight="700" font-family="Inter,Arial,sans-serif" letter-spacing="1.5">CUADRO ELIMINATORIO · MUNDIAL 2026</text>`;

        return `<div class="bkt-scroll">
            <svg class="bkt-svg" viewBox="0 0 ${SVG_W} ${SVG_H}" width="${SVG_W}" height="${SVG_H}" xmlns="http://www.w3.org/2000/svg">
                <rect width="${SVG_W}" height="${SVG_H}" fill="${BG}" rx="10"/>
                ${title}
                ${colLabels}
                <g>${lines}</g>
                <g>${cards}</g>
            </svg>
        </div>`;
    }
};

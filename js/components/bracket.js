import { Scraper } from '../scraper.js';

// ── ABREVIATURAS ──────────────────────────────────────────────────────────────
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

// Colores por defecto (dark mode); se sobreescriben leyendo CSS vars en tiempo real
let C = {
    primary:     '#D4AF37',
    accent:      '#C8102E',
    bgSurface:   '#252529',
    textPrimary: '#E8E6E3',
    textSecond:  '#A09E9B',
    textMuted:   '#6B6965',
    border:      '#3A3835',
};

function readColors() {
    const s = getComputedStyle(document.documentElement);
    const g = v => s.getPropertyValue(v).trim() || undefined;
    C = {
        primary:     g('--primary')        || '#D4AF37',
        accent:      g('--accent')         || '#C8102E',
        bgSurface:   g('--bg-surface')     || '#252529',
        textPrimary: g('--text-primary')   || '#E8E6E3',
        textSecond:  g('--text-secondary') || '#A09E9B',
        textMuted:   g('--text-muted')     || '#6B6965',
        border:      g('--border')         || '#3A3835',
    };
}

// ── LAYOUT SVG ────────────────────────────────────────────────────────────────
const H   = 560;
const CW  = 96;
const GAP = 20;
const S   = CW + GAP;   // 116

const LR32 = 0, LR16 = S, LQF = 2*S, LSF = 3*S;
const CTX  = 4*S, CTW = 112;
const RSF  = CTX + CTW + GAP;
const RQF  = RSF + S,  RR16 = RSF + 2*S, RR32 = RSF + 3*S;
const SVG_W = RR32 + CW;
const TOP   = 44;
const SVG_H = TOP + H + 16;

function teamYs(n) {
    const slot = H / (2 * n);
    return Array.from({ length: 2 * n }, (_, i) => TOP + (i + 0.5) * slot);
}
const R32Y = teamYs(8);
const R16Y = teamYs(4);
const QFY  = teamYs(2);
const SFY  = teamYs(1);

const p = v => +v.toFixed(1);

function bline(x1, y1, x2, y2) {
    return `<line x1="${p(x1)}" y1="${p(y1)}" x2="${p(x2)}" y2="${p(y2)}" stroke="${C.primary}" stroke-width="1.8" stroke-linecap="round"/>`;
}

function conn(fromX, toX, ys) {
    const mx = (fromX + toX) / 2;
    let s = '';
    for (let i = 0; i < ys.length; i += 2) {
        const y1 = ys[i], y2 = ys[i+1];
        if (y2 === undefined) break;
        const ym = (y1 + y2) / 2;
        s += bline(fromX, y1, mx, y1) + bline(fromX, y2, mx, y2);
        s += bline(mx, y1, mx, y2);
        s += bline(mx, ym, toX, ym);
    }
    return s;
}

function row(x, yc, name, logo, score, win, lose) {
    const rh = 26;
    let s = '';
    if (win) {
        s += `<rect x="${x}" y="${p(yc - rh/2)}" width="${CW}" height="${rh}" rx="3" fill="${C.primary}" fill-opacity="0.15"/>`;
    }
    if (logo) {
        s += `<image href="${logo}" x="${x+4}" y="${p(yc-7)}" width="20" height="14" preserveAspectRatio="xMidYMid meet"/>`;
    }
    const tx   = x + (logo ? 28 : 7);
    const fill = win ? C.primary : lose ? C.textMuted : C.textSecond;
    const fw   = win ? '700' : '400';
    s += `<text x="${p(tx)}" y="${p(yc+4)}" fill="${fill}" font-size="11" font-family="Inter,Arial,sans-serif" font-weight="${fw}">${ab(name)}</text>`;
    if (score != null) {
        s += `<text x="${x+CW-4}" y="${p(yc+4)}" text-anchor="end" fill="${fill}" font-size="11" font-family="Inter,Arial,sans-serif" font-weight="700">${score}</text>`;
    }
    return s;
}

function mRows(x, y1, y2, m) {
    if (!m) {
        return row(x,y1,'?',null,null,false,false) + row(x,y2,'?',null,null,false,false);
    }
    const d  = m.status === 'finished';
    const l  = m.status === 'live';
    const hw = d && m.homeScore > m.awayScore;
    const aw = d && m.awayScore > m.homeScore;
    return row(x,y1,m.homeTeam,m.homeLogo,d||l?m.homeScore:null,hw,d&&!hw) +
           row(x,y2,m.awayTeam,m.awayLogo,d||l?m.awayScore:null,aw,d&&!aw);
}

function col(x, matches, total, ys) {
    let s = '';
    for (let i = 0; i < total; i++) s += mRows(x, ys[i*2], ys[i*2+1], matches[i]||null);
    return s;
}

function centerSVG(fin) {
    const cx = CTX + CTW/2, cy = TOP + H/2;
    let s = `<text x="${p(cx)}" y="${p(cy-24)}" text-anchor="middle" dominant-baseline="middle" font-size="38">🏆</text>`;
    if (fin?.status === 'finished' || fin?.status === 'live') {
        const hw = fin.homeScore > fin.awayScore;
        s += `<text x="${p(cx)}" y="${p(cy+6)}"  text-anchor="middle" fill="${hw?C.primary:C.textSecond}" font-size="10" font-family="Inter,Arial,sans-serif" font-weight="${hw?'700':'400'}">${ab(fin.homeTeam)}</text>`;
        s += `<text x="${p(cx)}" y="${p(cy+20)}" text-anchor="middle" fill="${C.textPrimary}" font-size="14" font-weight="700" font-family="Inter,Arial,sans-serif">${fin.homeScore} - ${fin.awayScore}</text>`;
        s += `<text x="${p(cx)}" y="${p(cy+34)}" text-anchor="middle" fill="${!hw?C.primary:C.textSecond}" font-size="10" font-family="Inter,Arial,sans-serif" font-weight="${!hw?'700':'400'}">${ab(fin.awayTeam)}</text>`;
    } else {
        s += `<text x="${p(cx)}" y="${p(cy+10)}" text-anchor="middle" fill="${C.textMuted}" font-size="11" font-weight="700" font-family="'Bebas Neue',Inter,sans-serif" letter-spacing="2">FINAL</text>`;
        s += `<text x="${p(cx)}" y="${p(cy+24)}" text-anchor="middle" fill="${C.textMuted}" font-size="9"  font-family="Inter,Arial,sans-serif">${fin?.dateMadrid||'19 jul'}</text>`;
    }
    return s;
}

// ── VISTA DESKTOP (SVG) ───────────────────────────────────────────────────────
function buildSVG(rounds) {
    readColors(); // lee los colores reales del tema activo

    const r32 = rounds.r32||[], r16 = rounds.r16||[], qf = rounds.qf||[], sf = rounds.sf||[];
    const fin  = (rounds.final||[])[0]||null;
    const lR32 = r32.slice(0,8),  rR32 = r32.slice(8,16);
    const lR16 = r16.slice(0,4),  rR16 = r16.slice(4,8);
    const lQF  = qf.slice(0,2),   rQF  = qf.slice(2,4);
    const lSF  = sf[0]||null,     rSF  = sf[1]||null;

    let cards = '', lines = '';

    cards += col(LR32,lR32,8,R32Y) + col(LR16,lR16,4,R16Y) + col(LQF,lQF,2,QFY) + mRows(LSF,SFY[0],SFY[1],lSF);
    cards += col(RR32,rR32,8,R32Y) + col(RR16,rR16,4,R16Y) + col(RQF,rQF,2,QFY) + mRows(RSF,SFY[0],SFY[1],rSF);
    cards += centerSVG(fin);

    lines += conn(LR32+CW,LR16,R32Y) + conn(LR16+CW,LQF,R16Y) + conn(LQF+CW,LSF,QFY) + conn(LSF+CW,CTX,SFY);
    lines += conn(RR32,RR16+CW,R32Y) + conn(RR16,RQF+CW,R16Y) + conn(RQF,RSF+CW,QFY) + conn(RSF,CTX+CTW,SFY);

    const lbl = (x,t) => `<text x="${p(x+CW/2)}" y="${TOP-14}" text-anchor="middle" fill="${C.textMuted}" font-size="9" font-family="'Bebas Neue',Inter,sans-serif" letter-spacing="1">${t}</text>`;
    const lbls = lbl(LR32,'16AVOS')+lbl(LR16,'OCTAVOS')+lbl(LQF,'CUARTOS')+lbl(LSF,'SEMIS')+
                 lbl(RR32,'16AVOS')+lbl(RR16,'OCTAVOS')+lbl(RQF,'CUARTOS')+lbl(RSF,'SEMIS');

    const title = `<text x="${p(SVG_W/2)}" y="22" text-anchor="middle" fill="${C.primary}" font-size="13" font-family="'Bebas Neue',Inter,sans-serif" letter-spacing="2">CUADRO ELIMINATORIO · MUNDIAL 2026</text>`;

    const sep = (x) => `<line x1="${p(x)}" y1="${TOP-4}" x2="${p(x)}" y2="${TOP+H+4}" stroke="${C.border}" stroke-width="1" stroke-dasharray="4,4"/>`;
    const seps = sep(LR16)+sep(LQF)+sep(LSF)+sep(RSF)+sep(RQF)+sep(RR16);

    return `<div class="bkt-scroll">
        <svg class="bkt-svg" viewBox="0 0 ${SVG_W} ${SVG_H}" xmlns="http://www.w3.org/2000/svg">
            <rect width="${SVG_W}" height="${SVG_H}" fill="${C.bgSurface}" rx="12"/>
            ${seps}
            ${title}${lbls}
            <g>${lines}</g>
            <g>${cards}</g>
        </svg>
    </div>`;
}

// ── VISTA MÓVIL (tabs + tarjetas) ─────────────────────────────────────────────
const LABELS = { r32:'Ronda de 32', r16:'Octavos', qf:'Cuartos', sf:'Semis', final:'Final', third:'3er puesto' };
const ORDER  = ['r32','r16','qf','sf','final','third'];

function activeRound(rounds) {
    for (const r of ORDER) {
        if ((rounds[r]||[]).some(m => m.status !== 'finished')) return r;
    }
    return 'final';
}

function matchCard(m) {
    if (!m) return '';
    const d  = m.status === 'finished';
    const l  = m.status === 'live';
    const hw = d && m.homeScore > m.awayScore;
    const aw = d && m.awayScore > m.homeScore;

    const teamRow = (name, logo, score, win, lose) => `
        <div class="bv-team${win?' winner':lose?' loser':''}">
            ${logo?`<img class="bv-flag" src="${logo}" alt="">`:'<span class="bv-flag-ph"></span>'}
            <span class="bv-name">${name||'?'}</span>
            ${d||l?`<span class="bv-score">${score??'-'}</span>`:''}
        </div>`;

    return `<div class="bv-card${l?' live':''}${d?' done':''}">
        <div class="bv-card-date">${l?'<span class="bv-live">● EN VIVO</span>':`<span>${m.dateMadrid||''}</span>`}</div>
        ${teamRow(m.homeTeam,m.homeLogo,m.homeScore,hw,aw)}
        <div class="bv-sep"></div>
        ${teamRow(m.awayTeam,m.awayLogo,m.awayScore,aw,hw)}
    </div>`;
}

function buildCards(rounds, container) {
    const active = activeRound(rounds);
    const tabs   = ORDER.filter(r => (rounds[r]||[]).length > 0);

    container.innerHTML = `
        <nav class="bv-tabs">
            ${tabs.map(r=>`<button class="bv-tab${r===active?' active':''}" data-round="${r}">${LABELS[r]}</button>`).join('')}
        </nav>
        <div class="bv-panels">
            ${tabs.map(r=>`
                <div class="bv-panel${r===active?' active':''}" data-round="${r}">
                    <div class="bv-grid bv-grid-${r}">
                        ${(rounds[r]||[]).map(matchCard).join('')}
                    </div>
                </div>`).join('')}
        </div>`;

    container.querySelectorAll('.bv-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            container.querySelectorAll('.bv-tab').forEach(b  => b.classList.remove('active'));
            container.querySelectorAll('.bv-panel').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            container.querySelector(`.bv-panel[data-round="${btn.dataset.round}"]`)?.classList.add('active');
        });
    });
}

// ── EXPORT ────────────────────────────────────────────────────────────────────
export const Bracket = {
    async render(el) {
        el.innerHTML = `<div class="bracket-page">
            <div class="page-header"><h1>Cuadro Eliminatorio</h1></div>
            <div class="loading">Cargando eliminatorias...</div>
        </div>`;
        const data   = await Scraper.getBracket();
        const rounds = data?.rounds;
        if (!rounds) { el.innerHTML = '<div class="no-matches">Sin datos</div>'; return; }

        const page = el.querySelector('.bracket-page');
        page.querySelector('.loading')?.remove();

        // Desktop: SVG bracket (colores leídos de getComputedStyle, sin var())
        page.insertAdjacentHTML('beforeend', `<div class="bkt-desktop">${buildSVG(rounds)}</div>`);

        // Móvil: tabs + tarjetas
        const mobileWrap = document.createElement('div');
        mobileWrap.className = 'bkt-mobile bv-wrap';
        page.appendChild(mobileWrap);
        buildCards(rounds, mobileWrap);
    }
};

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

// ── LAYOUT SVG ────────────────────────────────────────────────────────────────
const H    = 512;
const CW   = 92;
const GAP  = 22;
const S    = CW + GAP;    // 114

const LR32 = 0, LR16 = S, LQF = 2*S, LSF = 3*S;
const CTX  = 4*S, CTW = 108;
const RSF  = CTX + CTW + GAP;
const RQF  = RSF + S,  RR16 = RSF + 2*S, RR32 = RSF + 3*S;
const SVG_W = RR32 + CW;   // ~986px
const TOP   = 42;
const SVG_H = TOP + H + 14;

// Y del centro de cada fila de equipo (2 equipos por partido × n partidos por mitad)
function teamYs(n) {
    const slot = H / (2 * n);
    return Array.from({ length: 2 * n }, (_, i) => TOP + (i + 0.5) * slot);
}

const R32Y = teamYs(8);
const R16Y = teamYs(4);
const QFY  = teamYs(2);
const SFY  = teamYs(1);

const p = v => +v.toFixed(1);
// Usa var(--primary) para las líneas (dorado corporativo)
const bline = (x1,y1,x2,y2) =>
    `<line x1="${p(x1)}" y1="${p(y1)}" x2="${p(x2)}" y2="${p(y2)}" stroke="var(--primary)" stroke-width="1.5" stroke-linecap="round"/>`;

function conn(fromX, toX, ys) {
    const mx = (fromX + toX) / 2;
    let s = '';
    for (let i = 0; i < ys.length; i += 2) {
        const y1 = ys[i], y2 = ys[i+1];
        if (y2 === undefined) break;
        const ym = (y1+y2)/2;
        s += bline(fromX,y1,mx,y1) + bline(fromX,y2,mx,y2);
        s += bline(mx,y1,mx,y2);
        s += bline(mx,ym,toX,ym);
    }
    return s;
}

// Fila de un equipo en SVG
function row(x, yc, name, logo, score, win) {
    const rh = 24;
    let s = '';
    // Fondo ganador
    if (win) s += `<rect x="${x}" y="${p(yc-rh/2)}" width="${CW}" height="${rh}" rx="3" fill="var(--primary)" fill-opacity="0.10"/>`;
    // Bandera
    if (logo) s += `<image href="${logo}" x="${x+5}" y="${p(yc-7)}" width="20" height="14" preserveAspectRatio="xMidYMid meet"/>`;
    // Nombre
    const tx = x + (logo ? 29 : 8);
    const textFill = win ? 'var(--primary)' : 'var(--text-secondary)';
    const fw = win ? '700' : '500';
    s += `<text x="${p(tx)}" y="${p(yc+4)}" fill="${textFill}" font-size="11" font-family="Inter,Arial,sans-serif" font-weight="${fw}">${ab(name)}</text>`;
    // Marcador
    if (score != null) s += `<text x="${x+CW-5}" y="${p(yc+4)}" text-anchor="end" fill="${textFill}" font-size="11" font-family="Inter,Arial,sans-serif" font-weight="700">${score}</text>`;
    return s;
}

// Par de filas de un partido
function mRows(x, y1, y2, m) {
    if (!m) return row(x,y1,'?',null,null,false) + row(x,y2,'?',null,null,false);
    const d=m.status==='finished', l=m.status==='live';
    const hw=d&&m.homeScore>m.awayScore, aw=d&&m.awayScore>m.homeScore;
    return row(x,y1,m.homeTeam,m.homeLogo,d||l?m.homeScore:null,hw) +
           row(x,y2,m.awayTeam,m.awayLogo,d||l?m.awayScore:null,aw);
}

// Columna completa con padding de slots vacíos
function col(x, matches, total, ys) {
    let s = '';
    for (let i = 0; i < total; i++) s += mRows(x, ys[i*2], ys[i*2+1], matches[i]||null);
    return s;
}

// Sección central: trofeo + final
function centerSVG(fin) {
    const cx = CTX + CTW/2, cy = TOP + H/2;
    let s = `<text x="${p(cx)}" y="${p(cy-22)}" text-anchor="middle" dominant-baseline="middle" font-size="36">🏆</text>`;
    if (fin?.status==='finished'||fin?.status==='live') {
        const hw=fin.homeScore>fin.awayScore;
        s += `<text x="${p(cx)}" y="${p(cy+4)}" text-anchor="middle" fill="${hw?'var(--primary)':'var(--text-secondary)'}" font-size="10" font-family="Inter,Arial,sans-serif">${ab(fin.homeTeam)}</text>`;
        s += `<text x="${p(cx)}" y="${p(cy+17)}" text-anchor="middle" fill="var(--text-primary)" font-size="13" font-weight="700" font-family="Inter,Arial,sans-serif">${fin.homeScore} - ${fin.awayScore}</text>`;
        s += `<text x="${p(cx)}" y="${p(cy+30)}" text-anchor="middle" fill="${!hw?'var(--primary)':'var(--text-secondary)'}" font-size="10" font-family="Inter,Arial,sans-serif">${ab(fin.awayTeam)}</text>`;
    } else {
        s += `<text x="${p(cx)}" y="${p(cy+8)}" text-anchor="middle" fill="var(--text-muted)" font-size="11" font-weight="700" font-family="Inter,Arial,sans-serif">FINAL</text>`;
        s += `<text x="${p(cx)}" y="${p(cy+22)}" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-family="Inter,Arial,sans-serif">${fin?.dateMadrid||'19 jul'}</text>`;
    }
    return s;
}

// ── VISTA DESKTOP (SVG) ───────────────────────────────────────────────────────
function buildSVG(rounds) {
    const r32=rounds.r32||[], r16=rounds.r16||[], qf=rounds.qf||[], sf=rounds.sf||[];
    const fin=(rounds.final||[])[0]||null;
    const lR32=r32.slice(0,8), rR32=r32.slice(8,16);
    const lR16=r16.slice(0,4), rR16=r16.slice(4,8);
    const lQF =qf.slice(0,2),  rQF =qf.slice(2,4);
    const lSF=sf[0]||null, rSF=sf[1]||null;

    let cards='', lines='';

    cards += col(LR32,lR32,8,R32Y) + col(LR16,lR16,4,R16Y) + col(LQF,lQF,2,QFY) + mRows(LSF,SFY[0],SFY[1],lSF);
    cards += col(RR32,rR32,8,R32Y) + col(RR16,rR16,4,R16Y) + col(RQF,rQF,2,QFY) + mRows(RSF,SFY[0],SFY[1],rSF);
    cards += centerSVG(fin);

    lines += conn(LR32+CW,LR16,R32Y) + conn(LR16+CW,LQF,R16Y) + conn(LQF+CW,LSF,QFY) + conn(LSF+CW,CTX,SFY);
    lines += conn(RR32,RR16+CW,R32Y) + conn(RR16,RQF+CW,R16Y) + conn(RQF,RSF+CW,QFY) + conn(RSF,CTX+CTW,SFY);

    // Etiquetas de columna (Bebas Neue = fuente del proyecto)
    const lbl = (x,t) => `<text x="${p(x+CW/2)}" y="${TOP-10}" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-family="'Bebas Neue',sans-serif" letter-spacing="1">${t}</text>`;
    const lbls = lbl(LR32,'16AVOS')+lbl(LR16,'OCTAVOS')+lbl(LQF,'CUARTOS')+lbl(LSF,'SEMIS')+
                 lbl(RR32,'16AVOS')+lbl(RR16,'OCTAVOS')+lbl(RQF,'CUARTOS')+lbl(RSF,'SEMIS');

    const title = `<text x="${p(SVG_W/2)}" y="20" text-anchor="middle" fill="var(--primary)" font-size="13" font-family="'Bebas Neue',sans-serif" letter-spacing="2">CUADRO ELIMINATORIO · MUNDIAL 2026</text>`;

    // Separadores verticales tenues entre rondas
    const sep = (x) => `<line x1="${p(x)}" y1="${TOP}" x2="${p(x)}" y2="${TOP+H}" stroke="var(--border)" stroke-width="1"/>`;
    const seps = sep(LR16)+sep(LQF)+sep(LSF)+sep(RSF)+sep(RQF)+sep(RR16);

    return `<div class="bkt-scroll">
        <svg class="bkt-svg" viewBox="0 0 ${SVG_W} ${SVG_H}" width="${SVG_W}" height="${SVG_H}" xmlns="http://www.w3.org/2000/svg">
            <rect width="${SVG_W}" height="${SVG_H}" fill="var(--bg-surface)" rx="12"/>
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
        if ((rounds[r]||[]).some(m=>m.status!=='finished')) return r;
    }
    return 'final';
}

function matchCard(m) {
    if (!m) return '';
    const d=m.status==='finished', l=m.status==='live';
    const hw=d&&m.homeScore>m.awayScore, aw=d&&m.awayScore>m.homeScore;

    const teamRow = (name,logo,score,win,lose) => `
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
    const tabs = ORDER.filter(r => (rounds[r]||[]).length>0);

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
            container.querySelectorAll('.bv-tab').forEach(b=>b.classList.remove('active'));
            container.querySelectorAll('.bv-panel').forEach(p=>p.classList.remove('active'));
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
        const data = await Scraper.getBracket();
        const rounds = data?.rounds;
        if (!rounds) { el.innerHTML='<div class="no-matches">Sin datos</div>'; return; }

        const page = el.querySelector('.bracket-page');
        page.querySelector('.loading')?.remove();

        // Desktop: SVG bracket
        page.insertAdjacentHTML('beforeend', `<div class="bkt-desktop">${buildSVG(rounds)}</div>`);

        // Móvil: tabs + tarjetas
        const mobileWrap = document.createElement('div');
        mobileWrap.className = 'bkt-mobile bv-wrap';
        page.appendChild(mobileWrap);
        buildCards(rounds, mobileWrap);
    }
};

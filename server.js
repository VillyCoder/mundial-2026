/*
 * server.js
 * Servidor HTTP de Node.js que actua como proxy entre el frontend y la API publica de ESPN.
 * No se necesita ninguna clave de API: ESPN expone endpoints publicos para el Mundial.
 *
 * Por que un proxy propio en vez de llamar a ESPN directamente desde el navegador?
 * - Evita problemas de CORS (ESPN bloquea peticiones desde otros dominios).
 * - Centraliza la normalizacion de datos: el frontend siempre recibe el mismo formato.
 * - Permite añadir cache y traduccion de nombres sin tocar el frontend.
 *
 * APIs utilizadas:
 *   - site.api.espn.com  -> datos del marcador, clasificacion, plantillas
 *   - sports.core.api.espn.com -> alineaciones y formaciones (partidos jugados)
 *   - www.thesportsdb.com -> fotos de jugadores (API gratuita, sin clave)
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

// URLs base de las APIs de ESPN
const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world';
const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/soccer/leagues/fifa.world/events';

// Traduccion de nombres de paises del ingles al espanol.
// ESPN devuelve los nombres en ingles, los traducimos para mostrarlos en la interfaz.
const TEAM_NAMES_ES = {
    'Spain': 'España',
    'Germany': 'Alemania',
    'France': 'Francia',
    'England': 'Inglaterra',
    'Italy': 'Italia',
    'Brazil': 'Brasil',
    'Argentina': 'Argentina',
    'Portugal': 'Portugal',
    'Netherlands': 'Países Bajos',
    'Belgium': 'Bélgica',
    'Croatia': 'Croacia',
    'Morocco': 'Marruecos',
    'Japan': 'Japón',
    'South Korea': 'Corea del Sur',
    'Korea Republic': 'Corea del Sur',
    'Australia': 'Australia',
    'Iran': 'Irán',
    'IR Iran': 'Irán',
    'Saudi Arabia': 'Arabia Saudita',
    'Senegal': 'Senegal',
    'Cameroon': 'Camerún',
    'Ghana': 'Ghana',
    'Tunisia': 'Túnez',
    'Canada': 'Canadá',
    'Mexico': 'México',
    'United States': 'Estados Unidos',
    'USA': 'Estados Unidos',
    'Uruguay': 'Uruguay',
    'Ecuador': 'Ecuador',
    'Colombia': 'Colombia',
    'Peru': 'Perú',
    'Chile': 'Chile',
    'Switzerland': 'Suiza',
    'Denmark': 'Dinamarca',
    'Sweden': 'Suecia',
    'Poland': 'Polonia',
    'Czech Republic': 'Chequia',
    'Czechia': 'Chequia',
    'Serbia': 'Serbia',
    'Ukraine': 'Ucrania',
    'Wales': 'Gales',
    'Scotland': 'Escocia',
    'Ireland': 'Irlanda',
    'Northern Ireland': 'Irlanda del Norte',
    'Austria': 'Austria',
    'Hungary': 'Hungría',
    'Romania': 'Rumanía',
    'Turkey': 'Turquía',
    'Greece': 'Grecia',
    'Norway': 'Noruega',
    'Finland': 'Finlandia',
    'Iceland': 'Islandia',
    'Albania': 'Albania',
    'Georgia': 'Georgia',
    'Slovakia': 'Eslovaquia',
    'Slovenia': 'Eslovenia',
    'Bosnia and Herzegovina': 'Bosnia y Herzegovina',
    'North Macedonia': 'Macedonia del Norte',
    'Costa Rica': 'Costa Rica',
    'Panama': 'Panamá',
    'Honduras': 'Honduras',
    'Jamaica': 'Jamaica',
    'Paraguay': 'Paraguay',
    'Bolivia': 'Bolivia',
    'Venezuela': 'Venezuela',
    'Trinidad and Tobago': 'Trinidad y Tobago',
    'Trinidad & Tobago': 'Trinidad y Tobago',
    'El Salvador': 'El Salvador',
    'Guatemala': 'Guatemala',
    'Haiti': 'Haití',
    'Curacao': 'Curazao',
    'China': 'China',
    'China PR': 'China',
    'India': 'India',
    'Thailand': 'Tailandia',
    'Vietnam': 'Vietnam',
    'Indonesia': 'Indonesia',
    'Jordan': 'Jordania',
    'Palestine': 'Palestina',
    'Uzbekistan': 'Uzbekistán',
    'Iraq': 'Irak',
    'Qatar': 'Catar',
    'UAE': 'Emiratos Árabes Unidos',
    'Oman': 'Omán',
    'Bahrain': 'Baréin',
    'Kuwait': 'Kuwait',
    'Algeria': 'Argelia',
    'Nigeria': 'Nigeria',
    'Egypt': 'Egipto',
    'South Africa': 'Sudáfrica',
    'DR Congo': 'RD Congo',
    'Congo DR': 'RD Congo',
    'Ivory Coast': 'Costa de Marfil',
    "Côte d'Ivoire": 'Costa de Marfil',
    'Cape Verde': 'Cabo Verde',
    'Mali': 'Mali',
    'Burkina Faso': 'Burkina Faso',
    'Guinea': 'Guinea',
    'Gabon': 'Gabón',
    'New Zealand': 'Nueva Zelanda'
};

// Si el nombre no tiene traduccion, lo devuelve tal cual (en ingles).
function translateTeam(name) {
    return TEAM_NAMES_ES[name] || name;
}

// Devuelve los canales de TV españoles donde se puede ver el partido.
// Basado en los derechos de emision del Mundial 2026 en España:
//   - DAZN tiene los derechos principales para la mayoria de partidos.
//   - RTVE/La 1 tiene derechos para los partidos de España y la Final.
//   - Teledeporte (RTVE) cubre las rondas eliminatorias restantes.
function getSpanishChannels(event) {
    const comp = event.competitions?.[0];
    const homeCode = comp?.competitors?.find(c => c.homeAway === 'home')?.team?.abbreviation || '';
    const awayCode = comp?.competitors?.find(c => c.homeAway === 'away')?.team?.abbreviation || '';
    const group = comp?.altGameNote || '';

    const isSpain = homeCode === 'ESP' || awayCode === 'ESP';
    const isFinal = group === 'Final';
    const isKnockout = ['Round of 32', 'Rd of 16', 'Quarterfinals', 'Semifinals', 'Third Place'].some(s => group.includes(s));

    const channels = [];
    if (isSpain || isFinal) {
        channels.push({ id: 'rtve', name: 'RTVE La 1', type: 'television' });
    } else if (isKnockout) {
        channels.push({ id: 'teledeporte', name: 'Teledeporte', type: 'television' });
    }
    channels.push({ id: 'dazn', name: 'DAZN', type: 'streaming' });
    return channels;
}

// Elimina acentos y espacios sobrantes para mejorar la busqueda en TheSportsDB.
// ESPN devuelve nombres como "Vinícius Júnior" o "Léo Pereira " que no coinciden
// con la base de datos de TheSportsDB que usa nombres sin diacriticos.
function normalizeForSearch(name) {
    return name.trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

// Tipos MIME para servir los archivos estaticos del frontend
const MIME = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.svg': 'image/svg+xml'
};

// Cache de fotos en memoria + archivo en disco para que persista entre reinicios.
// El archivo photos-cache.json se lee al arrancar y se guarda cada vez que hay fotos nuevas.
const PHOTOS_CACHE_FILE = path.join(__dirname, 'photos-cache.json');
const photoCache = new Map();
let photosDirty = false;

// Carga el cache de fotos desde el archivo (si existe)
try {
    const saved = JSON.parse(fs.readFileSync(PHOTOS_CACHE_FILE, 'utf8'));
    Object.entries(saved).forEach(([k, v]) => photoCache.set(k, v));
    console.log(`Cache de fotos cargado: ${photoCache.size} jugadores`);
} catch (_) {}

// Guarda el cache en disco cada 30 segundos si hubo cambios nuevos
setInterval(() => {
    if (!photosDirty) return;
    try {
        fs.writeFileSync(PHOTOS_CACHE_FILE, JSON.stringify(Object.fromEntries(photoCache), null, 2), 'utf8');
        photosDirty = false;
    } catch (_) {}
}, 30000);

// Cache para el calendario completo de un equipo (todos sus partidos en el torneo).
// Se guarda por codigo de seleccion y expira en 5 minutos.
const teamScheduleCache = new Map();

// Hace una peticion HTTPS y devuelve el JSON parseado.
// Se añade User-Agent para que la API de ESPN no rechace la peticion (sin cabecera la bloquea).
function fetchJSON(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); } catch (e) { reject(new Error('Respuesta no valida de la API')); }
            });
        }).on('error', reject);
    });
}

// Convierte una fecha ISO (UTC) a hora de Madrid para mostrarla al usuario español.
// ESPN guarda los horarios en UTC, por eso hay que convertirlos.
function toMadridTime(isoDate) {
    if (!isoDate) return '';
    return new Date(isoDate).toLocaleTimeString('es-ES', {
        timeZone: 'Europe/Madrid',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Devuelve la fecha en Madrid como cadena YYYYMMDD (para agrupar partidos por dia local)
function toMadridDate(isoDate) {
    if (!isoDate) return '';
    const p = new Intl.DateTimeFormat('es-ES', {
        timeZone: 'Europe/Madrid',
        year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date(isoDate));
    return p.find(x => x.type === 'year').value
         + p.find(x => x.type === 'month').value
         + p.find(x => x.type === 'day').value;
}

function teamLogoUrl(team) {
    if (!team?.logo) return '';
    return team.logo;
}

function extractTeamStats(competitor) {
    const stats = {};
    (competitor?.statistics || []).forEach(s => { stats[s.abbreviation || s.name] = s.displayValue; });
    const leaders = {};
    (competitor?.leaders || []).forEach(l => {
        if (l.leaders?.[0]) {
            leaders[l.abbreviation || l.name] = {
                name: l.leaders[0].athlete?.displayName || '',
                value: l.leaders[0].displayValue || '0',
                jersey: l.leaders[0].athlete?.jersey || '',
                position: l.leaders[0].athlete?.position?.abbreviation || ''
            };
        }
    });
    return {
        stats,
        leaders,
        form: competitor?.form || '',
        record: competitor?.records?.[0]?.summary || ''
    };
}

function calcWinProbability(odds) {
    if (!odds?.moneyline) return null;
    const ml = odds.moneyline;
    const getOdds = (obj) => obj?.current?.odds || obj?.close?.odds || obj?.open?.odds || null;
    const parseOdds = (val) => {
        if (!val) return 0;
        const n = parseInt(String(val).replace('+', ''));
        if (isNaN(n)) return 0;
        return n > 0 ? 100 / (n + 100) : Math.abs(n) / (Math.abs(n) + 100);
    };
    const homeP = parseOdds(getOdds(ml.home));
    const drawP = parseOdds(getOdds(ml.draw));
    const awayP = parseOdds(getOdds(ml.away));
    const total = homeP + drawP + awayP;
    if (total === 0) return null;
    return {
        home: Math.round((homeP / total) * 100),
        draw: Math.round((drawP / total) * 100),
        away: Math.round((awayP / total) * 100)
    };
}

// Transforma el objeto de partido de ESPN al formato que usa el frontend.
// Esto desacopla el frontend de los cambios en la API: si ESPN cambia su estructura,
// solo hay que tocar esta funcion, no todos los componentes visuales.
function normalizeESPNMatch(event) {
    const comp = event.competitions?.[0];
    const home = comp?.competitors?.find(c => c.homeAway === 'home');
    const away = comp?.competitors?.find(c => c.homeAway === 'away');
    const status = comp?.status?.type;
    const homeTeam = translateTeam(home?.team?.displayName || 'Home');
    const awayTeam = translateTeam(away?.team?.displayName || 'Away');
    const homeStats = extractTeamStats(home);
    const awayStats = extractTeamStats(away);
    const odds = comp?.odds?.[0] || null;
    return {
        id: event.id, date: event.date, dateMadrid: toMadridTime(event.date), dateMadridDate: toMadridDate(event.date),
        homeTeam, awayTeam,
        homeId: home?.team?.id || '', awayId: away?.team?.id || '',
        homeCode: home?.team?.abbreviation || '???', awayCode: away?.team?.abbreviation || '???',
        homeLogo: teamLogoUrl(home?.team), awayLogo: teamLogoUrl(away?.team),
        homeColor: home?.team?.color || '', awayColor: away?.team?.color || '',
        homeScore: home?.score != null ? parseInt(home.score) : null,
        awayScore: away?.score != null ? parseInt(away.score) : null,
        status: status?.state === 'in' ? 'live' : status?.state === 'post' ? 'finished' : 'scheduled',
        clock: comp?.status?.displayClock || null,
        group: comp?.altGameNote || '', venue: comp?.venue?.fullName || '',
        city: comp?.venue?.address?.city || '', country: comp?.venue?.address?.country || '',
        attendance: comp?.attendance || 0,
        odds,
        probability: calcWinProbability(odds),
        homeStats: homeStats.stats, homeLeaders: homeStats.leaders,
        homeForm: homeStats.form, homeRecord: homeStats.record,
        awayStats: awayStats.stats, awayLeaders: awayStats.leaders,
        awayForm: awayStats.form, awayRecord: awayStats.record,
        homeFormation: home?.formationSummary || home?.formation || '',
        awayFormation: away?.formationSummary || away?.formation || '',
        // Canales de retransmision segun ESPN (principalmente mercado USA)
        broadcasts: (comp?.geoBroadcasts || []).map(b => b.media?.shortName).filter(Boolean),
        spanishChannels: getSpanishChannels(event)
    };
}

// Handler de peticion: atiende rutas /api/* y sirve los archivos estaticos del frontend.
// Se exporta como funcion para que Vercel pueda usarlo como funcion serverless.
const handler = async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    res.setHeader('Access-Control-Allow-Origin', '*');

    // ESPN live scoreboard
    if (url.pathname === '/api/matches') {
        try {
            const data = await fetchJSON(`${ESPN_BASE}/scoreboard`);
            const matches = (data.events || []).map(normalizeESPNMatch);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ matches, source: 'espn', date: data.day?.date }));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
        }
        return;
    }

    // ESPN Core API detailed match data (plays + scoreboard details)
    if (url.pathname === '/api/match-detail') {
        const gameId = url.searchParams.get('id');
        const dateParam = url.searchParams.get('date');
        if (!gameId) { res.writeHead(400); res.end('id required'); return; }
        try {
            // Try to get scoreboard data for the match (includes details/events with athletes)
            let event = null;
            try {
                const scoreboardData = await fetchJSON(dateParam ? `${ESPN_BASE}/scoreboard?dates=${dateParam}` : `${ESPN_BASE}/scoreboard`);
                event = (scoreboardData.events || []).find(e => e.id === gameId);
            } catch (_) {}
            // Fallbacks por desfase de zona horaria: ESPN usa EDT (UTC-4) para archivar partidos,
            // por lo que un partido a medianoche UTC puede aparecer en la fecha del dia anterior.
            // Probamos -1 y +1 en paralelo para cubrir ambas direcciones.
            if (!event && dateParam && dateParam.length === 8) {
                try {
                    const y = parseInt(dateParam.slice(0, 4));
                    const mo = parseInt(dateParam.slice(4, 6)) - 1;
                    const d = parseInt(dateParam.slice(6, 8));
                    const fmtUTC = dt => dt.getUTCFullYear().toString()
                        + String(dt.getUTCMonth() + 1).padStart(2, '0')
                        + String(dt.getUTCDate()).padStart(2, '0');
                    const prevStr = fmtUTC(new Date(Date.UTC(y, mo, d - 1)));
                    const nextStr = fmtUTC(new Date(Date.UTC(y, mo, d + 1)));
                    const [prevData, nextData] = await Promise.all([
                        fetchJSON(`${ESPN_BASE}/scoreboard?dates=${prevStr}`).catch(() => null),
                        fetchJSON(`${ESPN_BASE}/scoreboard?dates=${nextStr}`).catch(() => null)
                    ]);
                    event = (prevData?.events || []).find(e => e.id === gameId)
                         || (nextData?.events || []).find(e => e.id === gameId)
                         || null;
                } catch (_) {}
            }
            // Fallback: scoreboard en vivo (sin fecha) para partidos en curso
            if (!event && dateParam) {
                try {
                    const liveData = await fetchJSON(`${ESPN_BASE}/scoreboard`);
                    event = (liveData.events || []).find(e => e.id === gameId);
                } catch (_) {}
            }
            const comp = event?.competitions?.[0];

            // Get play-by-play from core API (filter to important events only)
            let plays = [];
            try {
                const playsData = await fetchJSON(`${ESPN_CORE}/${gameId}/competitions/${gameId}/plays`);
                const importantTypes = new Set(['Goal', 'Own Goal', 'Penalty Goal', 'Yellow Card', 'Red Card', 'Substitution', 'Corner Awarded', 'Shot On Target', 'Shot Off Target', 'Shot Blocked', 'VAR Decision']);
                plays = (playsData.items || [])
                    .filter(p => p.scoringPlay || p.yellowCard || p.redCard || p.substitution || importantTypes.has(p.type?.text))
                    .map(p => ({
                        minute: p.clock?.displayValue || '',
                        type: p.type?.text || p.type?.type || '',
                        description: p.text || p.shortText || '',
                        team: p.team?.id || '',
                        scoringPlay: p.scoringPlay || false,
                        yellowCard: p.yellowCard || false,
                        redCard: p.redCard || false,
                        substitution: p.substitution || false,
                        athletes: (p.athletesInvolved || []).map(a => ({
                            name: a.displayName || '',
                            headshot: a.headshot?.href || a.headshot || '',
                            position: a.position || ''
                        }))
                    }));
            } catch (_) { /* play-by-play may not be available */ }

            // Events from scoreboard details (richer data with athletes, headshots) - filter important only
            const details = (comp?.details || [])
                .filter(d => d.scoringPlay || d.yellowCard || d.redCard || d.substitution || d.ownGoal || d.penaltyKick)
                .map(d => ({
                minute: d.clock?.displayValue || '',
                type: d.type?.text || '',
                team: d.team?.id || '',
                scoringPlay: d.scoringPlay || false,
                yellowCard: d.yellowCard || false,
                redCard: d.redCard || false,
                ownGoal: d.ownGoal || false,
                penaltyKick: d.penaltyKick || false,
                athletes: (d.athletesInvolved || []).map(a => ({
                    name: a.displayName || '',
                    headshot: a.headshot?.href || a.headshot || '',
                    position: a.position || '',
                    jersey: a.jersey || ''
                }))
            }));

            // Team statistics from competitors
            const competitors = comp?.competitors || [];
            const homeComp = competitors.find(c => c.homeAway === 'home') || competitors[0];
            const awayComp = competitors.find(c => c.homeAway === 'away') || competitors[1];
            let teamStats = competitors.map(c => ({
                id: c.team?.id || '',
                name: c.team?.displayName || '',
                code: c.team?.abbreviation || '',
                logo: c.team?.logo || '',
                statistics: c.statistics || [],
                leaders: c.leaders || [],
                form: c.form || ''
            }));

            // Si el scoreboard no tiene estadisticas (habitual en partidos en vivo),
            // usar el endpoint summary que las devuelve en tiempo real
            const hasStats = teamStats.some(t => t.statistics.length > 0);
            if (!hasStats) {
                try {
                    const summaryData = await fetchJSON(`https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=${gameId}`);
                    const summaryTeams = summaryData?.boxscore?.teams || [];
                    if (summaryTeams.length) {
                        teamStats = summaryTeams.map(t => ({
                            id: t.team?.id || '',
                            name: translateTeam(t.team?.displayName || ''),
                            code: t.team?.abbreviation || '',
                            logo: t.team?.logo || '',
                            statistics: t.statistics || [],
                            leaders: []
                        }));
                    }
                } catch (_) {}
            }

            const statusState = comp?.status?.type?.state;
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                gameId,
                plays,
                details,
                teamStats,
                odds: comp?.odds?.[0] || null,
                source: 'espn',
                homeId: homeComp?.team?.id || '',
                awayId: awayComp?.team?.id || '',
                homeTeam: translateTeam(homeComp?.team?.displayName || 'Local'),
                awayTeam: translateTeam(awayComp?.team?.displayName || 'Visitante'),
                homeCode: homeComp?.team?.abbreviation || '',
                awayCode: awayComp?.team?.abbreviation || '',
                homeLogo: teamLogoUrl(homeComp?.team),
                awayLogo: teamLogoUrl(awayComp?.team),
                homeColor: homeComp?.team?.color || '',
                awayColor: awayComp?.team?.color || '',
                status: statusState === 'in' ? 'live' : statusState === 'post' ? 'finished' : 'scheduled',
                dateMadrid: toMadridTime(event?.date || '')
            }));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
        }
        return;
    }

    // ESPN standings
    if (url.pathname === '/api/standings') {
        try {
            const data = await fetchJSON('https://site.api.espn.com/apis/v2/sports/soccer/fifa.world/standings');
            const groups = (data.children || []).map(child => ({
                name: child.name || '',
                teams: (child.standings?.entries || []).map((entry, i) => {
                    const stats = {};
                    (entry.stats || []).forEach(s => { stats[s.name] = s.value; });
                    const teamName = translateTeam(entry.team?.displayName || 'Unknown');
                    return {
                        pos: i + 1, name: teamName, code: entry.team?.abbreviation || '???',
                        logo: entry.team?.logo || entry.team?.logos?.[0]?.href || '',
                        played: parseInt(stats.gamesPlayed) || 0,
                        won: parseInt(stats.wins) || 0,
                        drawn: parseInt(stats.ties) || 0,
                        lost: parseInt(stats.losses) || 0,
                        gf: parseInt(stats.pointsFor) || 0,
                        ga: parseInt(stats.pointsAgainst) || 0,
                        gd: parseInt(stats.pointDifferential) || 0,
                        points: parseInt(stats.points) || 0
                    };
                }).sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf || a.name.localeCompare(b.name))
                  .map((t, i) => ({ ...t, pos: i + 1 }))
            }));
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ groups, source: 'espn' }));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
        }
        return;
    }

    // Knockout bracket - all elimination round matches grouped by round
    if (url.pathname === '/api/bracket') {
        try {
            function getRoundKey(note) {
                const n = (note || '').toLowerCase();
                if (n.includes('round of 32') || n.includes('rd of 32')) return 'r32';
                if (n.includes('round of 16') || n.includes('rd of 16')) return 'r16';
                if (n.includes('quarter')) return 'qf';
                if (n.includes('third place') || n.includes('3rd place')) return 'third';
                if (n.includes('semi')) return 'sf';
                if (n.includes('final')) return 'final';
                return null;
            }

            // Fechas de la fase eliminatoria del Mundial 2026: 25 jun - 20 jul
            const dates = [];
            const start = new Date('2026-06-25T00:00:00Z');
            for (let i = 0; i < 26; i++) {
                const d = new Date(start.getTime() + i * 86400000);
                dates.push(d.getUTCFullYear().toString()
                    + String(d.getUTCMonth() + 1).padStart(2, '0')
                    + String(d.getUTCDate()).padStart(2, '0'));
            }

            const rounds = { r32: [], r16: [], qf: [], sf: [], final: [], third: [] };
            const seenIds = new Set();

            const batchSize = 5;
            for (let i = 0; i < dates.length; i += batchSize) {
                const batch = dates.slice(i, i + batchSize);
                const results = await Promise.all(batch.map(d =>
                    fetchJSON(`${ESPN_BASE}/scoreboard?dates=${d}`).catch(() => null)
                ));
                for (const data of results) {
                    for (const event of (data?.events || [])) {
                        if (seenIds.has(event.id)) continue;
                        const comp = event.competitions?.[0];
                        const key = getRoundKey(comp?.altGameNote || comp?.notes?.[0]?.headline || '');
                        if (key && rounds[key]) {
                            seenIds.add(event.id);
                            rounds[key].push(normalizeESPNMatch(event));
                        }
                    }
                }
            }

            // Sort each round by date (gives bracket order)
            for (const r of Object.keys(rounds)) {
                rounds[r].sort((a, b) => new Date(a.date) - new Date(b.date));
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ rounds, source: 'espn' }));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
        }
        return;
    }

    // ESPN calendar - matches for a specific date
    if (url.pathname === '/api/calendar') {
        const date = url.searchParams.get('dates');
        if (!date) { res.writeHead(400); res.end('dates param required (YYYYMMDD)'); return; }
        try {
            const data = await fetchJSON(`${ESPN_BASE}/scoreboard?dates=${date}`);
            const matches = (data.events || []).map(normalizeESPNMatch);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ matches, source: 'espn', date: data.day?.date }));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
        }
        return;
    }

    // Team roster - plantilla del equipo con entrenador incluido
    if (url.pathname === '/api/roster') {
        const teamId = url.searchParams.get('teamId');
        if (!teamId) { res.writeHead(400); res.end('teamId required'); return; }
        try {
            const data = await fetchJSON(`https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/teams/${teamId}/roster`);
            const athletes = (data.athletes || []).map(a => ({
                id: a.id || '',
                name: a.displayName?.trim() || '',
                shortName: a.shortName || '',
                jersey: a.jersey || '',
                position: a.position?.abbreviation || '',
                positionFull: a.position?.displayName || '',
                headshot: a.headshot?.href || '',
                injury: a.injuries?.[0]?.type || ''
            }));

            // ESPN devuelve el cuerpo tecnico en el campo "coach" (array)
            const coaches = (data.coach || []).map(c => ({
                id: c.id || '',
                name: [c.firstName?.trim(), c.lastName?.trim()].filter(Boolean).join(' '),
                role: 'Seleccionador'
            })).filter(c => c.name);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ team: data.team?.displayName || '', code: data.team?.abbreviation || '', athletes, coaches, source: 'espn' }));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
        }
        return;
    }

    // Tournament stats - aggregates data from all played matches
    if (url.pathname === '/api/tournament-stats') {
        try {
            const allMatches = [];
            const today = new Date();
            for (let i = 0; i < 40; i++) {
                const d = new Date(today.getTime() - i * 86400000);
                const dateStr = d.getFullYear().toString() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
                try {
                    const data = await fetchJSON(`${ESPN_BASE}/scoreboard?dates=${dateStr}`);
                    const finished = (data.events || []).filter(e => e.competitions?.[0]?.status?.type?.state === 'post');
                    finished.forEach(ev => allMatches.push(normalizeESPNMatch(ev)));
                } catch (_) {}
            }

            let totalGoals = 0, totalYellow = 0, totalRed = 0, totalMatches = allMatches.length;
            const teamGoals = {}, teamConceded = {}, teamPossession = {}, teamCorners = {}, teamShots = {};
            const teamShotsOnTarget = {}, teamFouls = {}, teamCleanSheets = {};
            const scorers = {};

            for (const m of allMatches) {
                totalGoals += (m.homeScore || 0) + (m.awayScore || 0);
                if (!teamGoals[m.homeCode]) teamGoals[m.homeCode] = { name: translateTeam(m.homeTeam), code: m.homeCode, logo: m.homeLogo, goals: 0, conceded: 0, matches: 0 };
                if (!teamGoals[m.awayCode]) teamGoals[m.awayCode] = { name: translateTeam(m.awayTeam), code: m.awayCode, logo: m.awayLogo, goals: 0, conceded: 0, matches: 0 };
                teamGoals[m.homeCode].goals += m.homeScore || 0;
                teamGoals[m.homeCode].conceded += m.awayScore || 0;
                teamGoals[m.homeCode].matches++;
                teamGoals[m.awayCode].goals += m.awayScore || 0;
                teamGoals[m.awayCode].conceded += m.homeScore || 0;
                teamGoals[m.awayCode].matches++;

                const statMap = (key) => {
                    const hv = parseFloat(m.homeStats?.[key]) || 0;
                    const av = parseFloat(m.awayStats?.[key]) || 0;
                    return { home: hv, away: av, homeCode: m.homeCode, awayCode: m.awayCode };
                };
                const pp = statMap('PP');
                if (pp.home > 0 || pp.away > 0) {
                    if (!teamPossession[pp.homeCode]) teamPossession[pp.homeCode] = { total: 0, count: 0 };
                    if (!teamPossession[pp.awayCode]) teamPossession[pp.awayCode] = { total: 0, count: 0 };
                    teamPossession[pp.homeCode].total += pp.home;
                    teamPossession[pp.homeCode].count++;
                    teamPossession[pp.awayCode].total += pp.away;
                    teamPossession[pp.awayCode].count++;
                }
                const cw = statMap('CW');
                if (!teamCorners[cw.homeCode]) teamCorners[cw.homeCode] = 0;
                if (!teamCorners[cw.awayCode]) teamCorners[cw.awayCode] = 0;
                teamCorners[cw.homeCode] += cw.home;
                teamCorners[cw.awayCode] += cw.away;
                const sh = statMap('SHOT');
                if (!teamShots[sh.homeCode]) teamShots[sh.homeCode] = 0;
                if (!teamShots[sh.awayCode]) teamShots[sh.awayCode] = 0;
                teamShots[sh.homeCode] += sh.home;
                teamShots[sh.awayCode] += sh.away;

                const sog = statMap('SOG');
                if (!teamShotsOnTarget[sog.homeCode]) teamShotsOnTarget[sog.homeCode] = 0;
                if (!teamShotsOnTarget[sog.awayCode]) teamShotsOnTarget[sog.awayCode] = 0;
                teamShotsOnTarget[sog.homeCode] += sog.home;
                teamShotsOnTarget[sog.awayCode] += sog.away;

                const fc = statMap('FC');
                if (!teamFouls[fc.homeCode]) teamFouls[fc.homeCode] = 0;
                if (!teamFouls[fc.awayCode]) teamFouls[fc.awayCode] = 0;
                teamFouls[fc.homeCode] += fc.home;
                teamFouls[fc.awayCode] += fc.away;

                // Porteria a cero: el equipo local no encaja si el rival marca 0
                if (!teamCleanSheets[m.homeCode]) teamCleanSheets[m.homeCode] = 0;
                if (!teamCleanSheets[m.awayCode]) teamCleanSheets[m.awayCode] = 0;
                if ((m.awayScore || 0) === 0) teamCleanSheets[m.homeCode]++;
                if ((m.homeScore || 0) === 0) teamCleanSheets[m.awayCode]++;
            }

            const teamsArr = Object.values(teamGoals);
            const bestAttack = [...teamsArr].sort((a, b) => b.goals - a.goals).slice(0, 15);
            const bestDefense = [...teamsArr].sort((a, b) => a.conceded - b.conceded).slice(0, 15);
            const bestPossession = Object.entries(teamPossession)
                .map(([code, v]) => ({ code, avg: v.count > 0 ? Math.round(v.total / v.count) : 0 }))
                .sort((a, b) => b.avg - a.avg).slice(0, 15)
                .map(t => { const team = teamsArr.find(x => x.code === t.code); return { ...t, name: team?.name || t.code, logo: team?.logo || '' }; });
            const mostCorners = Object.entries(teamCorners)
                .map(([code, val]) => ({ code, total: val }))
                .sort((a, b) => b.total - a.total).slice(0, 15)
                .map(t => { const team = teamsArr.find(x => x.code === t.code); return { ...t, name: team?.name || t.code, logo: team?.logo || '' }; });
            const mostShots = Object.entries(teamShots)
                .map(([code, val]) => ({ code, total: val }))
                .sort((a, b) => b.total - a.total).slice(0, 15)
                .map(t => { const team = teamsArr.find(x => x.code === t.code); return { ...t, name: team?.name || t.code, logo: team?.logo || '' }; });

            const mostShotsOnTarget = Object.entries(teamShotsOnTarget)
                .map(([code, val]) => ({ code, total: val }))
                .sort((a, b) => b.total - a.total).slice(0, 15)
                .map(t => { const team = teamsArr.find(x => x.code === t.code); return { ...t, name: team?.name || t.code, logo: team?.logo || '' }; });

            const mostFouls = Object.entries(teamFouls)
                .map(([code, val]) => ({ code, total: val }))
                .sort((a, b) => b.total - a.total).slice(0, 15)
                .map(t => { const team = teamsArr.find(x => x.code === t.code); return { ...t, name: team?.name || t.code, logo: team?.logo || '' }; });

            const mostCleanSheets = Object.entries(teamCleanSheets)
                .filter(([, val]) => val > 0)
                .map(([code, val]) => ({ code, total: val }))
                .sort((a, b) => b.total - a.total).slice(0, 15)
                .map(t => { const team = teamsArr.find(x => x.code === t.code); return { ...t, name: team?.name || t.code, logo: team?.logo || '' }; });

            // Eficacia goleadora: porcentaje de tiros que acaban en gol (minimo 5 tiros)
            const bestEfficiency = Object.entries(teamShots)
                .filter(([, shots]) => shots >= 5)
                .map(([code, shots]) => {
                    const goals = teamGoals[code]?.goals || 0;
                    return { code, efficiency: Math.round((goals / shots) * 100) };
                })
                .sort((a, b) => b.efficiency - a.efficiency).slice(0, 15)
                .map(t => { const team = teamsArr.find(x => x.code === t.code); return { ...t, name: team?.name || t.code, logo: team?.logo || '' }; });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                totalMatches, totalGoals, goalsPerMatch: totalMatches > 0 ? Math.round(totalGoals / totalMatches * 100) / 100 : 0,
                bestAttack, bestDefense, bestPossession, mostCorners, mostShots,
                mostShotsOnTarget, mostFouls, mostCleanSheets, bestEfficiency,
                source: 'espn'
            }));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
        }
        return;
    }

    // Top scorers - individual players (excludes goalkeepers)
    if (url.pathname === '/api/top-scorers') {
        try {
            const allMatches = [];
            const today = new Date();
            for (let i = 0; i < 40; i++) {
                const d = new Date(today.getTime() - i * 86400000);
                const dateStr = d.getFullYear().toString() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
                try {
                    const data = await fetchJSON(`${ESPN_BASE}/scoreboard?dates=${dateStr}`);
                    const finished = (data.events || []).filter(e => e.competitions?.[0]?.status?.type?.state === 'post');
                    finished.forEach(ev => allMatches.push(ev));
                } catch (_) {}
            }

            const scorers = {};
            const assisters = {};
            const foulers = {};

            for (const ev of allMatches) {
                const comp = ev.competitions?.[0];
                const details = comp?.details || [];
                const competitors = comp?.competitors || [];
                const homeId = competitors.find(c => c.homeAway === 'home')?.team?.id || '';
                const awayId = competitors.find(c => c.homeAway === 'away')?.team?.id || '';

                for (const d of details) {
                    if (!d.athletesInvolved?.length) continue;
                    const athlete = d.athletesInvolved[0];
                    const pos = athlete.position?.abbreviation || '';
                    const name = athlete.displayName || '';
                    const teamId = d.team?.id || '';
                    const teamObj = competitors.find(c => c.team?.id === teamId);
                    const teamName = translateTeam(teamObj?.team?.displayName || '');
                    const teamLogo = teamObj?.team?.logo || '';
                    const jersey = athlete.jersey || '';

                    if (d.scoringPlay && pos !== 'GK' && pos !== 'G') {
                        if (!scorers[name]) scorers[name] = { name, team: teamName, teamLogo, position: pos, jersey, goals: 0 };
                        scorers[name].goals++;
                    }
                    if (d.type?.text === 'Goal' && d.athletesInvolved?.length > 1) {
                        const assister = d.athletesInvolved[1];
                        const aName = assister.displayName || '';
                        const aPos = assister.position?.abbreviation || '';
                        if (aPos !== 'GK' && aPos !== 'G' && aName) {
                            if (!assisters[aName]) assisters[aName] = { name: aName, team: teamName, teamLogo, position: aPos, assists: 0 };
                            assisters[aName].assists++;
                        }
                    }
                    if (d.yellowCard || d.redCard) {
                        const fPos = pos;
                        if (fPos !== 'GK' && fPos !== 'G') {
                            if (!foulers[name]) foulers[name] = { name, team: teamName, teamLogo, position: fPos, cards: 0 };
                            foulers[name].cards++;
                        }
                    }
                }

                const teamStats = competitors.map(c => ({
                    id: c.team?.id || '',
                    stats: {}
                }));
                for (const c of competitors) {
                    for (const s of (c.statistics || [])) {
                        if (s.abbreviation === 'FC') {
                            const key = c.team?.id || '';
                            const t = teamStats.find(x => x.id === key);
                            if (t) t.stats.fouls = (t.stats.fouls || 0) + (parseFloat(s.displayValue) || 0);
                        }
                    }
                }
            }

            const topScorers = Object.values(scorers).sort((a, b) => b.goals - a.goals).slice(0, 15);
            const topAssists = Object.values(assisters).sort((a, b) => b.assists - a.assists).slice(0, 15);
            const topCards = Object.values(foulers).sort((a, b) => b.cards - a.cards).slice(0, 15);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ topScorers, topAssists, topCards, source: 'espn' }));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
        }
        return;
    }

    // All teams
    if (url.pathname === '/api/teams') {
        try {
            const data = await fetchJSON('https://site.api.espn.com/apis/v2/sports/soccer/fifa.world/standings');
            const teams = [];
            for (const child of (data.children || [])) {
                for (const entry of (child.standings?.entries || [])) {
                    const stats = {};
                    (entry.stats || []).forEach(s => { stats[s.name] = s.value; });
                    const teamName = translateTeam(entry.team?.displayName || 'Unknown');
                    teams.push({
                        id: entry.team?.id || '',
                        name: teamName,
                        code: entry.team?.abbreviation || '???',
                        logo: entry.team?.logo || entry.team?.logos?.[0]?.href || '',
                        group: child.name || '',
                        played: parseInt(stats.gamesPlayed) || 0,
                        won: parseInt(stats.wins) || 0,
                        drawn: parseInt(stats.ties) || 0,
                        lost: parseInt(stats.losses) || 0,
                        gf: parseInt(stats.pointsFor) || 0,
                        ga: parseInt(stats.pointsAgainst) || 0,
                        points: parseInt(stats.points) || 0
                    });
                }
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ teams, source: 'espn' }));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
        }
        return;
    }

    // Match-specific lineup (starters + formation) from ESPN Core + site API
    if (url.pathname === '/api/lineup') {
        const eventId = url.searchParams.get('eventId');
        const teamId = url.searchParams.get('teamId');
        if (!eventId || !teamId) { res.writeHead(400); res.end(JSON.stringify({ error: 'eventId and teamId required' })); return; }
        try {
            // Core API: formation string + starters with formationPlace
            const coreData = await fetchJSON(`${ESPN_CORE}/${eventId}/competitions/${eventId}/competitors/${teamId}/roster`);
            const formation = coreData.formation?.summary || coreData.formation?.formationClass || '';
            const coreEntries = coreData.entries || [];

            // Site API: player names, positions, headshots (same IDs)
            let siteAthletes = {};
            try {
                const siteData = await fetchJSON(`${ESPN_BASE}/teams/${teamId}/roster`);
                (siteData.athletes || []).forEach(a => {
                    siteAthletes[String(a.id)] = {
                        name: a.displayName || a.shortName || '',
                        jersey: a.jersey || '',
                        position: a.position?.abbreviation || '',
                        headshot: a.headshot?.href || ''
                    };
                });
            } catch (_) {}

            const athletes = coreEntries.map(e => {
                const pid = String(e.playerId || e.athlete?.id || '');
                const site = siteAthletes[pid] || {};
                return {
                    id: pid,
                    name: site.name || '',
                    jersey: e.jersey || site.jersey || '',
                    position: site.position || '',
                    starter: e.starter === true,
                    formationPlace: parseInt(e.formationPlace) || 0,
                    headshot: site.headshot || ''
                };
            }).filter(a => a.name);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ formation, athletes, source: 'espn-core' }));
        } catch (e) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ formation: '', athletes: [], error: e.message }));
        }
        return;
    }

    // Todos los partidos de un equipo en el torneo (del 11 jun al 19 jul 2026).
    // Itera todas las fechas del Mundial en lotes de 5 para ser rapido y
    // devuelve solo los partidos donde juega el equipo pedido.
    if (url.pathname === '/api/team-schedule') {
        const code = url.searchParams.get('code');
        if (!code) { res.writeHead(400); res.end(JSON.stringify({ error: 'code required' })); return; }

        const cacheKey = `team_${code}`;
        const cached = teamScheduleCache.get(cacheKey);
        if (cached && Date.now() - cached.time < 300000) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(cached.data));
            return;
        }

        try {
            // Genera todas las fechas del torneo: 11 jun - 19 jul 2026 (39 dias)
            const start = new Date('2026-06-11');
            const dates = [];
            for (let i = 0; i < 39; i++) {
                const d = new Date(start);
                d.setDate(d.getDate() + i);
                dates.push(
                    d.getFullYear().toString() +
                    String(d.getMonth() + 1).padStart(2, '0') +
                    String(d.getDate()).padStart(2, '0')
                );
            }

            // Carga en lotes de 5 fechas en paralelo para reducir el tiempo de espera
            const matches = [];
            const batchSize = 5;
            for (let i = 0; i < dates.length; i += batchSize) {
                const batch = dates.slice(i, i + batchSize);
                const results = await Promise.all(batch.map(async date => {
                    try {
                        const data = await fetchJSON(`${ESPN_BASE}/scoreboard?dates=${date}`);
                        return (data.events || [])
                            .filter(ev => {
                                const comps = ev.competitions?.[0]?.competitors || [];
                                return comps.some(c => c.team?.abbreviation === code);
                            })
                            .map(normalizeESPNMatch);
                    } catch (_) { return []; }
                }));
                results.forEach(r => matches.push(...r));
            }

            const result = { matches, code };
            teamScheduleCache.set(cacheKey, { data: result, time: Date.now() });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
        }
        return;
    }

    // Foto de jugador desde TheSportsDB (API gratuita, cache en servidor).
    // Estrategia: busca primero por nombre completo, si no hay resultado
    // intenta con solo el apellido (mas probable que aparezca en la base de datos).
    // Las fotos son de clubes, no de seleccion, pero lo importante es que tengan foto.
    if (url.pathname === '/api/player-photo') {
        const name = url.searchParams.get('name');
        if (!name) { res.writeHead(400); res.end(JSON.stringify({ error: 'name required' })); return; }
        if (photoCache.has(name)) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(photoCache.get(name)));
            return;
        }
        try {
            // Normaliza el nombre: quita acentos y espacios sobrantes antes de buscar.
            // ESPN devuelve "Vinícius Júnior" pero TheSportsDB tiene "Vinicius Junior".
            const normalized = normalizeForSearch(name);

            // Intento 1: nombre completo normalizado
            const data = await fetchJSON(`https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${encodeURIComponent(normalized)}`);
            let player = data.player?.[0];

            // Intento 2: solo el primer nombre (muchos sudamericanos son conocidos por su nombre)
            // Ejemplo: "Vinicius Junior" -> busca "Vinicius"
            if (!player || (!player.strThumb && !player.strCutout)) {
                const firstName = normalized.split(' ')[0];
                if (firstName && firstName !== normalized) {
                    const data2 = await fetchJSON(`https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${encodeURIComponent(firstName)}`);
                    if (data2.player?.[0]?.strThumb || data2.player?.[0]?.strCutout) {
                        player = data2.player[0];
                    }
                }
            }

            const result = {
                thumb: player?.strThumb || '',
                cutout: player?.strCutout || '',
                found: !!(player?.strThumb || player?.strCutout)
            };
            photoCache.set(name, result);
            // Marca el cache como modificado para que se guarde en disco en el siguiente tick
            if (result.found) photosDirty = true;
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
        } catch (e) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ thumb: '', cutout: '', found: false }));
        }
        return;
    }

    let filePath = path.join(__dirname, url.pathname === '/' ? 'index.html' : url.pathname);
    const ext = path.extname(filePath);
    fs.readFile(filePath, (err, content) => {
        if (err) { res.writeHead(404); res.end('Not Found'); return; }
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(content);
    });
};

const server = http.createServer(handler);

// Exportamos el handler para Vercel (despliegue serverless en la nube).
// Vercel llama a esta funcion directamente con cada peticion HTTP.
module.exports = handler;

// En desarrollo local, arrancamos el servidor HTTP en el puerto 3000
if (require.main === module) {
    server.listen(PORT, () => console.log(`Mundial 2026 en http://localhost:${PORT}`));
}

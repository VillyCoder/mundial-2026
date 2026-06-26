/*
 * scripts/prefetch-photos.js
 * Pre-descarga las fotos de todos los jugadores del torneo y las guarda
 * en photos-cache.json para que el servidor las sirva sin llamar a la API.
 *
 * Ejecucion (una sola vez, con el servidor parado):
 *   node scripts/prefetch-photos.js
 *
 * El script respeta los limites de TheSportsDB (API gratuita):
 * - 1 segundo de pausa entre peticiones
 * - Reintento automatico con espera si recibe un error 429
 * Al terminar, photos-cache.json queda listo para incluir en GitHub.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world';
const CACHE_FILE = path.join(__dirname, '..', 'photos-cache.json');
const DELAY_MS = 1200;
const RETRY_DELAY_MS = 5000;

// Carga el cache existente para no repetir busquedas ya hechas
let cache = {};
try {
    cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    console.log(`Cache existente: ${Object.keys(cache).length} jugadores`);
} catch (_) {
    console.log('Sin cache previo, empezando desde cero');
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

function fetchJSON(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
            let data = '';
            if (res.statusCode === 429) { reject({ status: 429 }); return; }
            res.on('data', c => data += c);
            res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
        }).on('error', reject);
    });
}

// Hace una peticion con reintento automatico si hay error 429
async function fetchJSONSafe(url) {
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            return await fetchJSON(url);
        } catch (e) {
            if (e.status === 429) {
                process.stdout.write(`[429 - esperando ${RETRY_DELAY_MS / 1000}s]`);
                await sleep(RETRY_DELAY_MS * (attempt + 1));
            } else {
                throw e;
            }
        }
    }
    return null;
}

function normalizeForSearch(name) {
    return name.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

async function searchPhoto(name) {
    const normalized = normalizeForSearch(name);

    await sleep(DELAY_MS);
    const data = await fetchJSONSafe(`https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${encodeURIComponent(normalized)}`);
    let player = data?.player?.[0];

    if (!player || (!player.strThumb && !player.strCutout)) {
        const firstName = normalized.split(' ')[0];
        if (firstName !== normalized) {
            await sleep(DELAY_MS);
            const data2 = await fetchJSONSafe(`https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${encodeURIComponent(firstName)}`);
            if (data2?.player?.[0]?.strThumb || data2?.player?.[0]?.strCutout) {
                player = data2.player[0];
            }
        }
    }

    return {
        thumb: player?.strThumb || '',
        cutout: player?.strCutout || '',
        found: !!(player?.strThumb || player?.strCutout)
    };
}

async function fetchTeamRoster(teamId) {
    const data = await fetchJSONSafe(`${ESPN_BASE}/teams/${teamId}/roster`);
    return (data?.athletes || []).map(a => a.displayName?.trim()).filter(Boolean);
}

async function main() {
    console.log('Cargando equipos del torneo...');
    const standingsData = await fetchJSONSafe('https://site.api.espn.com/apis/v2/sports/soccer/fifa.world/standings');
    const teams = [];
    for (const child of (standingsData?.children || [])) {
        for (const entry of (child.standings?.entries || [])) {
            if (entry.team?.id) teams.push({ id: entry.team.id, name: entry.team.displayName });
        }
    }
    console.log(`Equipos encontrados: ${teams.length}`);
    console.log('Leyenda: * = foto encontrada | - = sin foto | . = ya en cache\n');

    let total = 0, found = 0, skipped = 0;

    for (const team of teams) {
        console.log(`--- ${team.name} ---`);
        let players;
        try {
            players = await fetchTeamRoster(team.id);
            await sleep(DELAY_MS);
        } catch (e) {
            console.log(`  Error: ${e.message}`);
            continue;
        }

        for (const name of players) {
            total++;
            if (cache[name]) {
                skipped++;
                process.stdout.write('.');
                continue;
            }
            try {
                const result = await searchPhoto(name);
                cache[name] = result;
                process.stdout.write(result.found ? '*' : '-');
                if (result.found) found++;
            } catch (e) {
                cache[name] = { thumb: '', cutout: '', found: false };
                process.stdout.write('x');
            }
        }
        process.stdout.write('\n');
        fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
    }

    console.log(`\nResultado:`);
    console.log(`  Jugadores totales : ${total}`);
    console.log(`  Con foto          : ${found}`);
    console.log(`  Ya en cache       : ${skipped}`);
    console.log(`  Sin foto          : ${total - found - skipped}`);
    console.log(`\nCache guardado en: ${CACHE_FILE}`);
    console.log('Puedes subir photos-cache.json a GitHub para que Vercel lo use.');
}

main().catch(console.error);

/*
 * config.js
 * Configuracion global de la app: mapa de selecciones y preferencias del usuario.
 * Los datos del equipo favorito se guardan en localStorage para que persistan
 * entre visitas sin necesidad de cuenta de usuario ni backend propio.
 */

// Mapa de las selecciones participantes con su codigo ESPN, nombre en espanol,
// apodo y color principal. El codigo debe coincidir con la abreviatura que
// devuelve la API de ESPN (ej: 'ESP', 'ARG', 'BRA').
const TEAMS_MAP = {
    ESP: { code: 'ESP', name: 'España',          nickname: 'La Roja',           color: '#C8102E' },
    ARG: { code: 'ARG', name: 'Argentina',        nickname: 'La Albiceleste',    color: '#75AADB' },
    BRA: { code: 'BRA', name: 'Brasil',           nickname: 'La Canarinha',      color: '#009739' },
    FRA: { code: 'FRA', name: 'Francia',          nickname: 'Les Bleus',         color: '#002395' },
    GER: { code: 'GER', name: 'Alemania',         nickname: 'Die Mannschaft',    color: '#000000' },
    ENG: { code: 'ENG', name: 'Inglaterra',       nickname: 'Three Lions',       color: '#CF081F' },
    ITA: { code: 'ITA', name: 'Italia',           nickname: 'Azzurri',           color: '#0046AD' },
    POR: { code: 'POR', name: 'Portugal',         nickname: 'Selecao',           color: '#006600' },
    NED: { code: 'NED', name: 'Paises Bajos',     nickname: 'Oranje',            color: '#FF6600' },
    BEL: { code: 'BEL', name: 'Belgica',          nickname: 'Red Devils',        color: '#ED2939' },
    CRO: { code: 'CRO', name: 'Croacia',          nickname: 'Vatreni',           color: '#FF0000' },
    MAR: { code: 'MAR', name: 'Marruecos',        nickname: 'Atlas Lions',       color: '#C1272D' },
    JPN: { code: 'JPN', name: 'Japon',            nickname: 'Blue Samurai',      color: '#BC002D' },
    KOR: { code: 'KOR', name: 'Corea del Sur',    nickname: 'Taegeuk Warriors',  color: '#003478' },
    URU: { code: 'URU', name: 'Uruguay',          nickname: 'La Celeste',        color: '#5CBEFF' },
    COL: { code: 'COL', name: 'Colombia',         nickname: 'Los Cafeteros',     color: '#FCD116' },
    MEX: { code: 'MEX', name: 'Mexico',           nickname: 'El Tri',            color: '#006847' },
    USA: { code: 'USA', name: 'Estados Unidos',   nickname: 'USMNT',             color: '#B31942' },
    CAN: { code: 'CAN', name: 'Canada',           nickname: 'Les Rouges',        color: '#FF0000' },
    ECU: { code: 'ECU', name: 'Ecuador',          nickname: 'La Tri',            color: '#FFD100' },
    SEN: { code: 'SEN', name: 'Senegal',          nickname: 'Lions de Teranga',  color: '#00853F' },
    GHA: { code: 'GHA', name: 'Ghana',            nickname: 'Black Stars',       color: '#006B3F' },
    CMR: { code: 'CMR', name: 'Camerun',          nickname: 'Indomitable Lions', color: '#007A5E' },
    NGA: { code: 'NGA', name: 'Nigeria',          nickname: 'Super Eagles',      color: '#008751' },
    TUN: { code: 'TUN', name: 'Tunez',            nickname: 'Eagles of Carthage',color: '#E70013' },
    AUS: { code: 'AUS', name: 'Australia',        nickname: 'Socceroos',         color: '#FFCD00' },
    IRN: { code: 'IRN', name: 'Iran',             nickname: 'Team Melli',        color: '#239F40' },
    KSA: { code: 'KSA', name: 'Arabia Saudita',   nickname: 'The Green Falcons', color: '#006C35' },
    QAT: { code: 'QAT', name: 'Catar',            nickname: 'The Maroons',       color: '#8D1B3D' },
    SRB: { code: 'SRB', name: 'Serbia',           nickname: 'The Eagles',        color: '#C6363C' },
    POL: { code: 'POL', name: 'Polonia',          nickname: 'Bialo-Czerwoni',    color: '#DC143C' },
    SUI: { code: 'SUI', name: 'Suiza',            nickname: 'Nati',              color: '#FF0000' },
    DEN: { code: 'DEN', name: 'Dinamarca',        nickname: 'Danish Dynamite',   color: '#C60C30' },
    CZE: { code: 'CZE', name: 'Republica Checa',  nickname: 'Narodni Tym',       color: '#11457E' },
    GRE: { code: 'GRE', name: 'Grecia',           nickname: 'Galanolefki',       color: '#0D5EAF' },
    CHI: { code: 'CHI', name: 'Chile',            nickname: 'La Roja',           color: '#D52B1E' },
    PAR: { code: 'PAR', name: 'Paraguay',         nickname: 'La Albirroja',      color: '#D52B1E' },
    PER: { code: 'PER', name: 'Peru',             nickname: 'La Blanquirroja',   color: '#D91023' },
    BOL: { code: 'BOL', name: 'Bolivia',          nickname: 'La Verde',          color: '#007934' },
    PAN: { code: 'PAN', name: 'Panama',           nickname: 'Los Canaleros',     color: '#D2122E' },
    CRC: { code: 'CRC', name: 'Costa Rica',       nickname: 'Los Ticos',         color: '#002B7F' },
    HON: { code: 'HON', name: 'Honduras',         nickname: 'Los Catrachos',     color: '#0073CF' },
    JAM: { code: 'JAM', name: 'Jamaica',          nickname: 'The Reggae Boyz',   color: '#009B3A' },
    CPV: { code: 'CPV', name: 'Cabo Verde',       nickname: 'Blue Sharks',       color: '#003893' }
};

// Devuelve el equipo favorito guardado en localStorage.
// Si no hay ninguno guardado o el codigo no existe en el mapa, devuelve España por defecto.
export function getFavoriteTeam() {
    try {
        const raw = localStorage.getItem('mundial2026_data');
        if (raw) {
            const data = JSON.parse(raw);
            if (data.favoriteTeam && TEAMS_MAP[data.favoriteTeam]) {
                return TEAMS_MAP[data.favoriteTeam];
            }
        }
    } catch (_) {
        // Si localStorage no esta disponible (modo privado en algunos navegadores), usamos España
    }
    return TEAMS_MAP.ESP;
}

// Guarda el codigo del equipo favorito en localStorage.
// Se usa desde la pantalla "Mi Equipo" cuando el usuario elige su seleccion.
export function setFavoriteTeam(code) {
    try {
        const raw = localStorage.getItem('mundial2026_data');
        const data = raw ? JSON.parse(raw) : {};
        data.favoriteTeam = code;
        localStorage.setItem('mundial2026_data', JSON.stringify(data));
    } catch (_) {
        // Silencioso: si falla el guardado simplemente no persiste la eleccion
    }
}

// Devuelve un color legible sobre fondo oscuro.
// Los colores ESPN de algunos equipos (Alemania #000000, Korea #003478) son demasiado
// oscuros para verse sobre el fondo de la app — esta funcion los aclara al minimo necesario.
export function ensureVisibleColor(hex) {
    if (!hex) return '';
    hex = ('#' + hex).replace('##', '#');
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    if (lum >= 0.22) return hex;
    const t = Math.min(0.75, (0.22 - lum) / (1 - lum) + 0.3);
    const nr = Math.round(r + (255 - r) * t);
    const ng = Math.round(g + (255 - g) * t);
    const nb = Math.round(b + (255 - b) * t);
    return '#' + [nr, ng, nb].map(v => v.toString(16).padStart(2, '0')).join('');
}

// Datos generales del torneo, utiles como referencia en distintos componentes.
export const Config = {
    tournament: {
        name: 'Copa Mundial FIFA 2026',
        year: 2026,
        startDate: '2026-06-11',
        endDate: '2026-07-19',
        sedes: ['Estados Unidos', 'Canada', 'Mexico'],
        numGrupos: 12,
        numEquipos: 48
    }
};

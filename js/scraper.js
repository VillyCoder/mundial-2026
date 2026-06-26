/*
 * scraper.js
 * Capa de acceso a datos: todas las llamadas al servidor proxy pasan por aqui.
 * Incluye cache en memoria con TTL (tiempo de vida) para no sobrecargar la API
 * con peticiones repetidas mientras el usuario navega.
 *
 * El servidor proxy (server.js) es el que habla con ESPN; el frontend solo
 * llama a rutas locales como /api/matches, /api/standings, etc.
 */

const API = window.location.origin;

export const Scraper = {
    // Almacen interno: { clave -> { data, time } }
    cache: new Map(),

    // Hace una peticion HTTP y lanza un error si la respuesta no es OK
    async fetch(url) {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
    },

    // Devuelve los datos cacheados si todavia son validos (dentro del TTL)
    cached(key, ttl = 30000) {
        const entry = this.cache.get(key);
        return entry && Date.now() - entry.time < ttl ? entry.data : null;
    },

    // Guarda datos en cache con la hora actual
    set(key, data) {
        this.cache.set(key, { data, time: Date.now() });
    },

    // Elimina una entrada del cache (para forzar recarga en partidos en vivo)
    clear(key) {
        this.cache.delete(key);
    },

    // Partidos del marcador general (actualiza cada 15 segundos en vivo)
    async getMatches() {
        const cached = this.cached('matches', 15000);
        if (cached) return cached;
        try {
            const data = await this.fetch(`${API}/api/matches`);
            this.set('matches', data);
            return data;
        } catch (e) {
            console.error('Error obteniendo partidos:', e);
            return { matches: [] };
        }
    },

    // Detalle de un partido: eventos, goles, tarjetas y estadisticas por equipo
    async getMatchDetail(matchId, date) {
        const key = `detail_${matchId}`;
        const cached = this.cached(key, 30000);
        if (cached) return cached;
        try {
            const dateParam = date ? `&date=${date}` : '';
            const data = await this.fetch(`${API}/api/match-detail?id=${matchId}${dateParam}`);
            this.set(key, data);
            return data;
        } catch (e) {
            console.error('Error obteniendo detalle del partido:', e);
            return null;
        }
    },

    // Clasificacion por grupos (cache de 1 minuto)
    async getStandings() {
        const cached = this.cached('standings', 60000);
        if (cached) return cached;
        try {
            const data = await this.fetch(`${API}/api/standings`);
            this.set('standings', data);
            return data;
        } catch (e) {
            console.error('Error obteniendo clasificacion:', e);
            return { groups: [] };
        }
    },

    // Partidos de una fecha concreta en formato YYYYMMDD
    async getCalendar(date) {
        const key = `calendar_${date}`;
        const cached = this.cached(key, 30000);
        if (cached) return cached;
        try {
            const data = await this.fetch(`${API}/api/calendar?dates=${date}`);
            this.set(key, data);
            return data;
        } catch (e) {
            console.error('Error obteniendo calendario:', e);
            return { matches: [] };
        }
    },

    // Carga partidos de varios dias y los combina en un solo array
    async getMultiDayMatches(dates) {
        const results = [];
        for (const d of dates) {
            try {
                const data = await this.getCalendar(d);
                if (data?.matches?.length) results.push(...data.matches);
            } catch (_) {}
        }
        return results;
    },

    // Estadisticas globales del torneo: goles, posesion, corners...
    // Cache de 1 minuto porque estos datos cambian poco
    async getTournamentStats() {
        const cached = this.cached('tournament-stats', 60000);
        if (cached) return cached;
        try {
            const data = await this.fetch(`${API}/api/tournament-stats`);
            this.set('tournament-stats', data);
            return data;
        } catch (e) {
            console.error('Error obteniendo estadisticas del torneo:', e);
            return null;
        }
    },

    // Plantilla de un equipo: jugadores, posiciones y dorsales
    // Cache de 5 minutos porque los datos de plantilla son muy estables
    async getRoster(teamId) {
        const key = `roster_${teamId}`;
        const cached = this.cached(key, 300000);
        if (cached) return cached;
        try {
            const data = await this.fetch(`${API}/api/roster?teamId=${teamId}`);
            this.set(key, data);
            return data;
        } catch (e) {
            console.error('Error obteniendo plantilla:', e);
            return null;
        }
    },

    // Goleadores, asistentes y jugadores con mas tarjetas del torneo
    async getTopScorers() {
        const cached = this.cached('top-scorers', 60000);
        if (cached) return cached;
        try {
            const data = await this.fetch(`${API}/api/top-scorers`);
            this.set('top-scorers', data);
            return data;
        } catch (e) {
            console.error('Error obteniendo goleadores:', e);
            return null;
        }
    },

    // Alineacion de un equipo en un partido concreto.
    // Combina la API Core de ESPN (formacion oficial) con la API Site (nombres de jugadores).
    // Cache de 5 minutos porque la alineacion no cambia durante el partido.
    async getLineup(eventId, teamId) {
        const key = `lineup_${eventId}_${teamId}`;
        const cached = this.cached(key, 300000);
        if (cached) return cached;
        try {
            const data = await this.fetch(`${API}/api/lineup?eventId=${eventId}&teamId=${teamId}`);
            this.set(key, data);
            return data;
        } catch (e) {
            console.error('Error obteniendo alineacion:', e);
            return null;
        }
    },

    // Todos los equipos del torneo con su grupo y estadisticas
    async getTeams() {
        const cached = this.cached('teams', 60000);
        if (cached) return cached;
        try {
            const data = await this.fetch(`${API}/api/teams`);
            this.set('teams', data);
            return data;
        } catch (e) {
            console.error('Error obteniendo equipos:', e);
            return null;
        }
    },

    // Todos los partidos de una seleccion en el torneo completo.
    // El servidor itera las 39 fechas del Mundial y filtra por codigo de equipo.
    // Cache de 5 minutos (los horarios son estables, solo cambian los resultados).
    async getTeamSchedule(teamCode) {
        const key = `team_schedule_${teamCode}`;
        const cached = this.cached(key, 300000);
        if (cached) return cached;
        try {
            const data = await this.fetch(`${API}/api/team-schedule?code=${teamCode}`);
            this.set(key, data);
            return data;
        } catch (e) {
            console.error('Error obteniendo calendario del equipo:', e);
            return { matches: [] };
        }
    },

    // Foto de un jugador de TheSportsDB (API gratuita sin clave de API).
    // Estrategia de cache en tres capas:
    //   1. Memoria (Map): la mas rapida, dura lo que dure la sesion del navegador
    //   2. localStorage: persiste entre navegaciones y recargas de pagina
    //   3. API del servidor: solo se llama si no esta en ninguno de los dos caches
    async getPlayerPhoto(name) {
        const cleanName = name.trim();
        const key = `photo_${cleanName}`;

        // Capa 1: cache en memoria (no requiere parse)
        const inMemory = this.cached(key, Infinity);
        if (inMemory) return inMemory;

        // Capa 2: localStorage (persiste entre equipos y recargas)
        try {
            const stored = localStorage.getItem(key);
            if (stored) {
                const parsed = JSON.parse(stored);
                this.set(key, parsed);
                return parsed;
            }
        } catch (_) {}

        // Capa 3: llamada al servidor (TheSportsDB con nombres normalizados)
        try {
            const data = await this.fetch(`${API}/api/player-photo?name=${encodeURIComponent(cleanName)}`);
            this.set(key, data);
            // Solo persiste en localStorage si se encontro foto
            // (evita llenar localStorage con entradas vacias)
            if (data.found) {
                try { localStorage.setItem(key, JSON.stringify(data)); } catch (_) {}
            }
            return data;
        } catch (e) {
            return { thumb: '', cutout: '', found: false };
        }
    }
};

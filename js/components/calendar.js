import { Scraper } from '../scraper.js';
import { getFavoriteTeam } from '../config.js';

const STAGE_NAMES = {
    'FIFA World Cup, Group A': 'Grupo A', 'FIFA World Cup, Group B': 'Grupo B',
    'FIFA World Cup, Group C': 'Grupo C', 'FIFA World Cup, Group D': 'Grupo D',
    'FIFA World Cup, Group E': 'Grupo E', 'FIFA World Cup, Group F': 'Grupo F',
    'FIFA World Cup, Group G': 'Grupo G', 'FIFA World Cup, Group H': 'Grupo H',
    'FIFA World Cup, Group I': 'Grupo I', 'FIFA World Cup, Group J': 'Grupo J',
    'FIFA World Cup, Group K': 'Grupo K', 'FIFA World Cup, Group L': 'Grupo L',
    'Round of 32': 'Octavos de final', 'Rd of 16': 'Octavos de final',
    'Quarterfinals': 'Cuartos de final', 'Semifinals': 'Semifinal',
    'Third Place': 'Tercer puesto', 'Final': 'FINAL'
};

function dateToKey(d) {
    return d.getFullYear().toString() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
}

function formatDateLabel(dateStr) {
    const y = dateStr.slice(0, 4);
    const m = parseInt(dateStr.slice(4, 6)) - 1;
    const d = parseInt(dateStr.slice(6, 8));
    const date = new Date(y, m, d);
    return {
        short: date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
        long: date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }),
        full: date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    };
}

export const Calendar = {
    allMatches: [],
    matchesByDate: {},
    loadedDates: new Set(),
    selectedDate: null,
    currentMonth: null,
    currentYear: null,

    async render(container) {
        const now = new Date();
        this.currentMonth = now.getMonth();
        this.currentYear = now.getFullYear();
        this.matchesByDate = {};
        this.loadedDates = new Set();
        this.allMatches = [];
        this.selectedDate = null;

        const today = new Date();
        this.selectedDate = dateToKey(today);

        container.innerHTML = `
            <div class="calendar-page">
                <div class="page-header">
                    <h1>Calendario Mundial 2026</h1>
                    <div class="cal-phase-tabs" id="cal-phase-tabs"></div>
                </div>
                <div class="cal-widget">
                    <div class="cal-grid-header">
                        <button class="cal-nav-btn" id="cal-prev">&lt;</button>
                        <span class="cal-month-title" id="cal-month-title"></span>
                        <button class="cal-nav-btn" id="cal-next">&gt;</button>
                    </div>
                    <div class="cal-grid-days">
                        <span class="cal-day-name">Lun</span>
                        <span class="cal-day-name">Mar</span>
                        <span class="cal-day-name">Mie</span>
                        <span class="cal-day-name">Jue</span>
                        <span class="cal-day-name">Vie</span>
                        <span class="cal-day-name">Sab</span>
                        <span class="cal-day-name">Dom</span>
                    </div>
                    <div class="cal-grid" id="cal-grid"></div>
                </div>
                <div id="cal-matches" class="cal-matches"><div class="loading">Cargando partidos...</div></div>
            </div>`;

        this.renderPhaseTabs();
        document.getElementById('cal-prev')?.addEventListener('click', () => this.changeMonth(-1));
        document.getElementById('cal-next')?.addEventListener('click', () => this.changeMonth(1));
        await this.loadMonth();
    },

    renderPhaseTabs() {
        const el = document.getElementById('cal-phase-tabs');
        if (!el) return;
        el.innerHTML = `
            <button class="phase-tab active" data-phase="group">Fase de Grupos</button>
            <button class="phase-tab" data-phase="knockout">Eliminatorias</button>
        `;
        el.querySelectorAll('.phase-tab').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                el.querySelectorAll('.phase-tab').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                if (e.target.dataset.phase === 'group') {
                    this.currentMonth = 5;
                    this.currentYear = 2026;
                } else {
                    this.currentMonth = 6;
                    this.currentYear = 2026;
                }
                await this.loadMonth();
            });
        });
    },

    changeMonth(dir) {
        this.currentMonth += dir;
        if (this.currentMonth > 11) { this.currentMonth = 0; this.currentYear++; }
        if (this.currentMonth < 0) { this.currentMonth = 11; this.currentYear--; }
        this.loadMonth();
    },

    async loadMonth() {
        const titleEl = document.getElementById('cal-month-title');
        if (titleEl) {
            const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
            titleEl.textContent = `${monthNames[this.currentMonth]} ${this.currentYear}`;
        }

        const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();
        const firstDay = new Date(this.currentYear, this.currentMonth, 1).getDay();
        const startDay = firstDay === 0 ? 6 : firstDay - 1;

        const datesToLoad = [];
        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(this.currentYear, this.currentMonth, d);
            const key = dateToKey(date);
            const n = parseInt(key);
            if (n >= 20260611 && n <= 20260719 && !this.loadedDates.has(key)) {
                datesToLoad.push(key);
            }
        }

        if (datesToLoad.length > 0) {
            const batchSize = 5;
            for (let i = 0; i < datesToLoad.length; i += batchSize) {
                const batch = datesToLoad.slice(i, i + batchSize);
                const results = await Promise.all(batch.map(d => Scraper.getCalendar(d)));
                results.forEach((data, idx) => {
                    const fallbackKey = batch[idx];
                    // Agrupa por fecha Madrid del partido (no por fecha UTC de ESPN)
                    (data?.matches || []).forEach(match => {
                        const key = match.dateMadridDate || fallbackKey;
                        if (!this.matchesByDate[key]) this.matchesByDate[key] = [];
                        if (!this.matchesByDate[key].find(m => m.id === match.id)) {
                            this.matchesByDate[key].push(match);
                        }
                    });
                    this.loadedDates.add(fallbackKey);
                });
            }
        }

        this.renderGrid(daysInMonth, startDay);

        if (this.selectedDate) {
            const selKey = this.selectedDate;
            const selMonth = parseInt(selKey.slice(4, 6)) - 1;
            const selYear = parseInt(selKey.slice(0, 4));
            if (selMonth === this.currentMonth && selYear === this.currentYear) {
                this.showDate(selKey);
            } else {
                this.showNoSelection();
            }
        } else {
            this.showNoSelection();
        }
    },

    renderGrid(daysInMonth, startDay) {
        const grid = document.getElementById('cal-grid');
        if (!grid) return;

        let html = '';
        for (let i = 0; i < startDay; i++) {
            html += '<div class="cal-cell empty"></div>';
        }

        const today = new Date();
        const todayKey = dateToKey(today);
        const fav = getFavoriteTeam();

        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(this.currentYear, this.currentMonth, d);
            const key = dateToKey(date);
            const n = parseInt(key);
            const isTournament = n >= 20260611 && n <= 20260719;
            const matchCount = this.matchesByDate[key]?.length || 0;
            const hasLive = this.matchesByDate[key]?.some(m => m.status === 'live');
            const isToday = key === todayKey;
            const isSelected = key === this.selectedDate;

            // Comprueba si el equipo favorito juega este dia (para marcarlo en el calendario)
            const hasFavMatch = isTournament && (this.matchesByDate[key] || []).some(
                m => m.homeCode === fav.code || m.awayCode === fav.code
            );

            let classes = 'cal-cell';
            if (isTournament && matchCount > 0) classes += ' has-matches';
            if (hasLive) classes += ' has-live';
            if (hasFavMatch) classes += ' has-fav';
            if (isToday) classes += ' today';
            if (isSelected) classes += ' selected';
            if (!isTournament) classes += ' disabled';

            html += `<div class="${classes}" data-date="${key}">
                <span class="cal-cell-day">${d}</span>
                ${matchCount > 0 ? `<span class="cal-cell-count">${matchCount}</span>` : ''}
            </div>`;
        }

        grid.innerHTML = html;

        grid.querySelectorAll('.cal-cell.has-matches').forEach(cell => {
            cell.addEventListener('click', () => {
                grid.querySelectorAll('.cal-cell').forEach(c => c.classList.remove('selected'));
                cell.classList.add('selected');
                this.showDate(cell.dataset.date);
            });
        });
    },

    showNoSelection() {
        const el = document.getElementById('cal-matches');
        if (!el) return;
        el.innerHTML = '<div class="no-matches">Selecciona un dia con partidos</div>';
    },

    showDate(date) {
        this.selectedDate = date;
        const el = document.getElementById('cal-matches');
        if (!el) return;
        const matches = this.matchesByDate[date] || [];
        if (!matches.length) {
            el.innerHTML = '<div class="no-matches">Sin partidos esta fecha</div>';
            return;
        }
        const info = formatDateLabel(date);
        el.innerHTML = `
            <div class="cal-date-section cal-fade-in">
                <h2 class="cal-date-title">${info.full}</h2>
                <div class="cal-date-group">
                    ${matches.map(m => this.card(m, date)).join('')}
                </div>
            </div>`;
    },

    card(m, calendarDate) {
        const stageLabel = STAGE_NAMES[m.group] || m.group?.replace('FIFA World Cup, ', '') || '';
        const isLive = m.status === 'live';
        const isFinished = m.status === 'finished';
        const fav = getFavoriteTeam();
        const isFav = m.homeCode === fav.code || m.awayCode === fav.code || m.homeTeam === fav.name || m.awayTeam === fav.name;
        const timeStr = m.dateMadrid || '';
        // Usar la fecha del calendario (no la UTC del partido) para que el detalle encuentre
        // el partido en el cache correcto (ej: Uruguay-Espana a las 00:00Z del dia 27
        // aparece en el calendario del dia 26 pero su date UTC es el 27)
        const dateParam = calendarDate || m.date?.split('T')[0]?.replace(/-/g, '') || '';

        return `
        <a href="#/match/${m.id}?date=${dateParam}" class="cal-match ${isFinished ? 'finished' : ''} ${isLive ? 'live' : ''} ${isFav ? 'favorite' : ''}">
            <div class="cal-match-time">${timeStr}</div>
            <div class="cal-match-teams">
                <div class="cal-team">
                    <span class="cal-team-name">${m.homeTeam}</span>
                    ${m.homeLogo ? `<img class="cal-flag" src="${m.homeLogo}" alt="${m.homeCode}">` : ''}
                </div>
                <div class="cal-score">
                    ${m.homeScore != null ? `<span>${m.homeScore}</span><span>-</span><span>${m.awayScore}</span>` : `<span class="cal-vs">VS</span>`}
                </div>
                <div class="cal-team cal-team-right">
                    ${m.awayLogo ? `<img class="cal-flag" src="${m.awayLogo}" alt="${m.awayCode}">` : ''}
                    <span class="cal-team-name">${m.awayTeam}</span>
                </div>
            </div>
            <div class="cal-match-info">
                <span class="cal-stage">${stageLabel}</span>
            </div>
        </a>`;
    }
};

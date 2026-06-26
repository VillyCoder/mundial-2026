/*
 * sidebar.js
 * Barra lateral de navegacion. Muestra el menu principal y el equipo favorito
 * del usuario (guardado en localStorage desde la pantalla "Mi Equipo").
 * Los iconos son SVG inline para no depender de fuentes de iconos externas.
 */

import { getFavoriteTeam } from '../config.js';

export const Sidebar = {
    render(container) {
        const fav = getFavoriteTeam();
        const routes = [
            { path: '/', icon: 'home', label: 'Inicio', badge: null },
            { path: '/live', icon: 'zap', label: 'Hoy', badge: null },
            { path: '/calendar', icon: 'calendar', label: 'Calendario', badge: null },
            { path: '/standings', icon: 'list', label: 'Clasificación', badge: null },
            { path: '/stats', icon: 'bar-chart', label: 'Estadísticas', badge: null },
            { path: '/teams', icon: 'users', label: 'Equipos', badge: null },
            { path: '/my-team', icon: 'heart', label: 'Mi Equipo', badge: null }
        ];

        container.innerHTML = `
            <nav class="sidebar">
                <div class="sidebar-section">
                    <span class="sidebar-label">NAVEGACIÓN</span>
                    <ul class="nav-list">
                        ${routes.map(route => `
                            <li>
                                <a href="#${route.path}" class="nav-item" data-route="${route.path}" onclick="document.querySelector('#sidebar').classList.remove('active');document.querySelector('#sidebarOverlay')?.classList.remove('active')">
                                    <span class="nav-icon">${this.getIcon(route.icon)}</span>
                                    <span class="nav-text">${route.label}</span>
                                    ${route.badge ? `<span class="nav-badge">${route.badge}</span>` : ''}
                                </a>
                            </li>
                        `).join('')}
                    </ul>
                </div>

                <div class="sidebar-section">
                    <span class="sidebar-label">FAVORITO</span>
                    <div class="favorite-team">
                        <div class="team-badge spain">
                            <img src="https://a.espncdn.com/i/teamlogos/countries/500/${fav.code.toLowerCase()}.png" alt="${fav.code}">
                        </div>
                        <div class="team-info">
                            <span class="team-name">${fav.name}</span>
                            <span class="team-nickname">${fav.nickname}</span>
                        </div>
                    </div>
                </div>

                <div class="sidebar-footer">
                    <span class="version">© Antonio Vilarta 2026</span>
                </div>
            </nav>
        `;
    },

    getIcon(name) {
        const icons = {
            home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
            zap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
            calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
            list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
            'bar-chart': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>',
            users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
            heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>'
        };
        return icons[name] || '';
    }
};

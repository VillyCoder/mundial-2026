export const Header = {
    render(container) {
        container.innerHTML = `
            <div class="header">
                <button class="menu-toggle" id="menuToggle" aria-label="Toggle menu">
                    <span></span><span></span><span></span>
                </button>

                <a href="#/" class="header-brand">
                    <img class="brand-logo" src="https://a.espncdn.com/i/leaguelogos/soccer/500/4.png" alt="FIFA World Cup">
                    <span class="brand-text">Mundial 2026</span>
                </a>

                <button class="btn-icon btn-theme" id="themeToggleBtn" title="Cambiar tema">
                    <svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                        <circle cx="12" cy="12" r="5"/>
                        <line x1="12" y1="1" x2="12" y2="3"/>
                        <line x1="12" y1="21" x2="12" y2="23"/>
                        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                        <line x1="1" y1="12" x2="3" y2="12"/>
                        <line x1="21" y1="12" x2="23" y2="12"/>
                        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                    </svg>
                    <svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                    </svg>
                </button>

                <div class="header-actions">
                    <button class="btn-icon" id="refreshBtn" title="Actualizar">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 12a9 9 0 11-6.219-8.56"/>
                            <polyline points="21 3 21 9 15 9"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;

        this.setupEvents();
    },

    setupEvents() {
        const menuToggle = document.getElementById('menuToggle');
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebarOverlay');

        if (menuToggle && sidebar) {
            menuToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                sidebar.classList.toggle('active');
                overlay?.classList.toggle('active');
            });
        }

        if (overlay) {
            overlay.addEventListener('click', () => {
                sidebar?.classList.remove('active');
                overlay.classList.remove('active');
            });
        }

        if (sidebar) {
            sidebar.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }

        document.addEventListener('click', (e) => {
            if (sidebar?.classList.contains('active') && !sidebar.contains(e.target) && !menuToggle?.contains(e.target)) {
                sidebar.classList.remove('active');
                overlay?.classList.remove('active');
            }
        });

        const themeToggleBtn = document.getElementById('themeToggleBtn');
        if (themeToggleBtn) {
            themeToggleBtn.addEventListener('click', () => {
                const isLight = document.documentElement.classList.toggle('light-mode');
                localStorage.setItem('mundial-tema', isLight ? 'claro' : 'oscuro');
                const metaTheme = document.querySelector('meta[name="theme-color"]');
                if (metaTheme) metaTheme.content = isLight ? '#F5F2ED' : '#1A1A1D';
            });
        }

        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                refreshBtn.classList.add('spinning');
                try {
                    const { Scraper } = await import('../scraper.js');
                    Scraper.cache = new Map();
                    const contentEl = document.getElementById('content');
                    if (contentEl) {
                        contentEl.innerHTML = '<div class="loading">Actualizando...</div>';
                    }
                    window.dispatchEvent(new HashChangeEvent('hashchange'));
                } catch (_) {
                    window.location.reload();
                }
                setTimeout(() => refreshBtn.classList.remove('spinning'), 1000);
            });
        }
    }
};

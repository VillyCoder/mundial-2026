export class Router {
    constructor() {
        this.routes = [];
        this.contentEl = null;
        window.addEventListener('hashchange', () => this.handleRoute());
    }

    init(contentElement) {
        this.contentEl = contentElement;
        this.handleRoute();
    }

    register(pattern, component) {
        this.routes.push({ pattern, component });
    }

    handleRoute() {
        const fullHash = window.location.hash.slice(1) || '/';
        const qIdx = fullHash.indexOf('?');
        const hash = qIdx >= 0 ? fullHash.slice(0, qIdx) : fullHash;
        const queryStr = qIdx >= 0 ? fullHash.slice(qIdx + 1) : '';
        const queryParams = {};
        if (queryStr) {
            queryStr.split('&').forEach(p => {
                const [k, v] = p.split('=');
                if (k) queryParams[decodeURIComponent(k)] = decodeURIComponent(v || '');
            });
        }
        for (const route of this.routes) {
            const params = this.matchRoute(route.pattern, hash);
            if (params !== null) {
                Object.assign(params, queryParams);
                this.contentEl.innerHTML = '';
                route.component.render(this.contentEl, params);
                document.querySelectorAll('[data-route]').forEach(el => {
                    const routePath = el.dataset.route;
                    el.classList.toggle('active', hash === routePath || hash.startsWith(routePath + '/'));
                });
                return;
            }
        }
    }

    matchRoute(pattern, hash) {
        const patternParts = pattern.split('/');
        const hashParts = hash.split('/');
        if (patternParts.length !== hashParts.length) return null;
        const params = {};
        for (let i = 0; i < patternParts.length; i++) {
            if (patternParts[i].startsWith(':')) {
                params[patternParts[i].slice(1)] = hashParts[i];
            } else if (patternParts[i] !== hashParts[i]) {
                return null;
            }
        }
        return params;
    }

    navigate(path) {
        window.location.hash = path;
    }
}

const STORAGE_KEY = 'mundial2026_data';

export const Storage = {
    getDefaultData() {
        return {
            favoriteTeam: 'ESP',
            notifications: true,
            lastUpdate: null
        };
    },

    load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : this.getDefaultData();
        } catch {
            return this.getDefaultData();
        }
    },

    save(data) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            return true;
        } catch {
            return false;
        }
    },

    update(partial) {
        const current = this.load();
        const updated = { ...current, ...partial, lastUpdate: Date.now() };
        return this.save(updated);
    },

    get(key) {
        return this.load()[key];
    },

    set(key, value) {
        return this.update({ [key]: value });
    }
};

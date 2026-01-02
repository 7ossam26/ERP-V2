const STORAGE_DELAY = 300; // Simulated network delay

export const createMockService = (storageKey) => {
    // Helper to get data from local storage
    const getData = () => {
        const data = localStorage.getItem(storageKey);
        return data ? JSON.parse(data) : [];
    };

    // Helper to save data to local storage
    const setData = (data) => {
        localStorage.setItem(storageKey, JSON.stringify(data));
    };

    return {
        getAll: async () => {
            return new Promise((resolve) => {
                setTimeout(() => {
                    resolve(getData());
                }, STORAGE_DELAY);
            });
        },

        getById: async (id) => {
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    const items = getData();
                    const item = items.find(i => i.id === id);
                    if (item) resolve(item);
                    else reject(new Error('Item not found'));
                }, STORAGE_DELAY);
            });
        },

        create: async (item) => {
            return new Promise((resolve) => {
                setTimeout(() => {
                    const items = getData();
                    const newItem = { ...item, id: Date.now() }; // Simple ID generation
                    items.push(newItem);
                    setData(items);
                    resolve(newItem);
                }, STORAGE_DELAY);
            });
        },

        update: async (id, updates) => {
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    const items = getData();
                    const index = items.findIndex(i => i.id === id);
                    if (index !== -1) {
                        items[index] = { ...items[index], ...updates };
                        setData(items);
                        resolve(items[index]);
                    } else {
                        reject(new Error('Item not found'));
                    }
                }, STORAGE_DELAY);
            });
        },

        delete: async (id) => {
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    const items = getData();
                    const filteredItems = items.filter(i => i.id !== id);
                    if (filteredItems.length !== items.length) {
                        setData(filteredItems);
                        resolve(true);
                    } else {
                        reject(new Error('Item not found'));
                    }
                }, STORAGE_DELAY);
            });
        }
    };
};

window.StorageDB = (function() {
    const DB_NAME = 'TexturePainterDB';
    const DB_VERSION = 1;
    const STORE_NAME = 'projectData';
    let db;

    function init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            
            request.onerror = (e) => reject("IndexedDB Error: " + e.target.error);
            
            request.onsuccess = (e) => {
                db = e.target.result;
                resolve();
            };
            
            request.onupgradeneeded = (e) => {
                const tempDB = e.target.result;
                if (!tempDB.objectStoreNames.contains(STORE_NAME)) {
                    tempDB.createObjectStore(STORE_NAME);
                }
            };
        });
    }

    function saveProject(modelText, layersData) {
        return new Promise((resolve, reject) => {
            if (!db) return reject("DB not initialized");
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            
            const data = {
                modelText: modelText,
                layers: layersData,
                timestamp: Date.now()
            };
            
            const request = store.put(data, 'autosave');
            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e.target.error);
        });
    }

    function loadProject() {
        return new Promise((resolve, reject) => {
            if (!db) return reject("DB not initialized");
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get('autosave');
            
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    function clearProject() {
        return new Promise((resolve, reject) => {
            if (!db) return reject("DB not initialized");
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete('autosave');
            
            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e.target.error);
        });
    }

    return {
        init,
        saveProject,
        loadProject,
        clearProject
    };
})();

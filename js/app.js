/// <summary>
/// Application Bootstrapper
/// </summary>

function triggerAutosave() {
    if (!window.StorageDB) return;
    if (typeof window.syncLayersToHost === 'function') window.syncLayersToHost();
    if (autosaveTimeout) clearTimeout(autosaveTimeout);
    autosaveTimeout = setTimeout(() => {
        const layersData = [];
        for (let i = 0; i < layers.length; i++) {
            const l = layers[i];
            layersData.push({
                id: l.id,
                name: l.name,
                opacity: l.opacity,
                isVisible: l.isVisible,
                imageData: getLayerPreviewDataUrl(l)
            });
        }
        window.StorageDB.saveProject(currentModelText, layersData)
            .then(() => {
                console.log('Autosaved locally!');
            })
            .catch(e => console.error('Autosave failed:', e));
    }, 1000);
}



// Initialize Application
async function init() {
    initUI();
    
    try {
        await window.StorageDB.init();
        const savedData = await window.StorageDB.loadProject();
        
        initThreeJS(); // MUST be called before initLayers because layers use WebGL!

        if (savedData && savedData.layers) {
            await initLayers(savedData.layers);
            if (savedData.modelText) {
                currentModelText = savedData.modelText;
                loadModelFromText(currentModelText, true);
            }
        } else {
            await initLayers();
        }
    } catch (e) {
        console.error("IndexedDB error:", e);
        if (typeof renderer === 'undefined') {
            initThreeJS();
        }
        await initLayers();
    }
    
    initTools();
    registerServiceWorker();
    
    try {
        if (screen.orientation && screen.orientation.unlock) {
            screen.orientation.unlock();
        }
    } catch(e) {
        console.log("Orientation unlock not supported or already unlocked.");
    }
    
    // Initial Blit
    blitLayers();
    
    // Save the initial state so the user can undo their very first action
    HistoryManager.saveState();
    
    animate();
}

function registerServiceWorker() {
    if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
        let refreshing = false;

        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (refreshing) return;
            refreshing = true;
            window.location.reload();
        });

        navigator.serviceWorker.register('./sw.js')
            .then(reg => {
                console.log('SW Registered', reg);
                
                // Sürüm güncellemesi varsa kullanıcıyı uyar
                reg.addEventListener('updatefound', () => {
                    const newWorker = reg.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            showUpdateToast(newWorker);
                        }
                    });
                });
            })
            .catch(err => console.error('SW Error', err));
    } else if (window.location.protocol === 'file:') {
        console.warn('Service workers are disabled on the file:// protocol. Please use a local web server to enable caching.');
    }
}

function showUpdateToast(newWorker) {
    const toast = document.getElementById('update-toast');
    const btn = document.getElementById('btn-update-app');
    if (toast && btn) {
        toast.classList.remove('hidden');
        btn.onclick = () => {
            toast.classList.add('hidden');
            newWorker.postMessage('SKIP_WAITING');
        };
    }
}

window.onload = init;

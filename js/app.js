/// <summary>
/// Application Bootstrapper
/// </summary>

function triggerAutosave() {
    if (!window.StorageDB) return;
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
                imageData: l.canvas.toDataURL('image/png')
            });
        }
        window.StorageDB.saveProject(currentModelText, layersData)
            .then(() => console.log('Autosaved!'))
            .catch(e => console.error('Autosave failed:', e));
    }, 1000);
}

function loadImageToCanvas(dataURL, ctx) {
    return new Promise(resolve => {
        if (!dataURL) return resolve();
        const img = new Image();
        img.onload = () => {
            ctx.globalCompositeOperation = 'copy';
            ctx.drawImage(img, 0, 0);
            ctx.globalCompositeOperation = 'source-over';
            resolve();
        };
        img.src = dataURL;
    });
}

// Initialize Application
async function init() {
    initUI();
    
    try {
        await window.StorageDB.init();
        const savedData = await window.StorageDB.loadProject();
        
        if (savedData && savedData.layers) {
            await initLayers(savedData.layers);
            initThreeJS();
            if (savedData.modelText) {
                currentModelText = savedData.modelText;
                loadModelFromText(currentModelText, true);
            }
        } else {
            await initLayers();
            initThreeJS();
        }
    } catch (e) {
        console.error("IndexedDB error:", e);
        await initLayers();
        initThreeJS();
    }
    
    initTools();
    registerServiceWorker();
    
    // Initial Blit
    blitLayers();
    animate();
}

function registerServiceWorker() {
    if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('SW Registered', reg))
            .catch(err => console.error('SW Error', err));
    } else if (window.location.protocol === 'file:') {
        console.warn('Service workers are disabled on the file:// protocol. Please use a local web server to enable caching.');
    }
}

window.onload = init;

// Custom Confirm UI
window.onload = init;

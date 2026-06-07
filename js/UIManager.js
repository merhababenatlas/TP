/// <summary>
/// UI Events & Helpers
/// </summary>

window.showToast = function(message, duration = 3000, color = '#4ade80') {
    const toast = document.getElementById('notification-toast');
    const text = document.getElementById('notification-text');
    if (!toast || !text) return;
    
    text.innerText = message;
    text.style.color = color;
    toast.classList.remove('hidden');
    toast.style.opacity = '1';
    
    if (window.toastTimeout) clearTimeout(window.toastTimeout);
    window.toastTimeout = setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.classList.add('hidden'), 300);
    }, duration);
};

function initUI() {
    // Main Menu Toggle
    const btnMainMenu = document.getElementById('btn-main-menu');
    const mainMenuOverlay = document.getElementById('main-menu-overlay');
    const btnCloseMenu = document.getElementById('btn-close-menu');
    
    function toggleMainMenu(show) {
        if (show) {
            mainMenuOverlay.classList.remove('hidden');
            document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden'));
            
            // Check for last connected host
            const lastHostId = localStorage.getItem('lastConnectedHostId');
            const btnQuick = document.getElementById('btn-quick-connect');
            if (lastHostId && btnQuick) btnQuick.classList.remove('hidden');
            
            // Check for last connected tablet
            const lastTabletId = localStorage.getItem('lastConnectedTabletId');
            const btnQuickTablet = document.getElementById('btn-quick-connect-tablet');
            if (lastTabletId && btnQuickTablet) btnQuickTablet.classList.remove('hidden');
            
            // Update indicator
            const dot = document.getElementById('connection-status-dot');
            const text = document.getElementById('connection-status-text');
            if (window.NetworkManager && window.NetworkManager.conn && window.NetworkManager.conn.open) {
                dot.style.background = '#4ade80';
                dot.style.boxShadow = '0 0 8px #4ade80';
                text.innerText = 'Cihaza Bağlı';
                text.style.color = '#4ade80';
            } else {
                dot.style.background = '#ef4444';
                dot.style.boxShadow = '0 0 8px #ef4444';
                text.innerText = 'Bağlantı Yok';
                text.style.color = '#aaa';
            }
        } else {
            mainMenuOverlay.classList.add('hidden');
            document.querySelectorAll('.panel').forEach(p => p.classList.remove('hidden'));
        }
    }

    btnMainMenu.addEventListener('click', () => toggleMainMenu(true));
    btnCloseMenu.addEventListener('click', () => toggleMainMenu(false));
    
    mainMenuOverlay.addEventListener('click', (e) => {
        if (e.target === mainMenuOverlay) {
            toggleMainMenu(false);
        }
    });

    // Texture Preview Close & UV Toggle
    let showUVOverlay = false;
    const previewOverlay = document.getElementById('texture-preview-overlay');
    const btnToggleUV = document.getElementById('btn-toggle-uv');
    const uvWireframeImage = document.getElementById('uv-wireframe-image');

    document.getElementById('btn-close-preview').addEventListener('click', () => {
        previewOverlay.classList.add('hidden');
    });
    previewOverlay.addEventListener('click', (e) => {
        if (e.target === previewOverlay) {
            previewOverlay.classList.add('hidden');
        }
    });

    btnToggleUV.addEventListener('click', () => {
        showUVOverlay = !showUVOverlay;
        if (showUVOverlay) {
            btnToggleUV.innerText = '🕸 UV Ağı: Açık';
            btnToggleUV.classList.add('wireframe-active');
            uvWireframeImage.classList.remove('hidden');
            
            const uvCanvas = generateUvWireframeCanvas();
            uvWireframeImage.src = uvCanvas.toDataURL('image/png');
        } else {
            btnToggleUV.innerText = '🕸 UV Ağı: Kapalı';
            btnToggleUV.classList.remove('wireframe-active');
            uvWireframeImage.classList.add('hidden');
        }
    });

    // Wireframe Toggle
    const btnWireframe = document.getElementById('btn-wireframe');
    btnWireframe.addEventListener('click', () => {
        wireframeMode = (wireframeMode + 1) % 3;
        
        if (wireframeMode === 0) {
            btnWireframe.innerText = '🕸 Kapalı';
            btnWireframe.classList.remove('wireframe-active');
        } else if (wireframeMode === 1) {
            btnWireframe.innerText = '🕸 Çizgisel';
            btnWireframe.classList.add('wireframe-active');
        } else {
            btnWireframe.innerText = '🕸 Doku+Ağ';
            btnWireframe.classList.add('wireframe-active');
        }
        
        applyWireframeMode();
    });

    // Cull Mode Toggle (Yön)
    const btnCullMode = document.getElementById('btn-cull-mode');
    btnCullMode.addEventListener('click', () => {
        cullMode = (cullMode + 1) % 3;
        if (cullMode === 0) {
            btnCullMode.innerText = '🔄 Yön: Ön';
            btnCullMode.classList.remove('wireframe-active');
        } else if (cullMode === 1) {
            btnCullMode.innerText = '🔄 Yön: Arka';
            btnCullMode.classList.add('wireframe-active');
        } else {
            btnCullMode.innerText = '🔄 Yön: Çift';
            btnCullMode.classList.add('wireframe-active');
        }
        applyMaterialMode();
    });

    // Lit / Unlit Toggle
    const btnLitMode = document.getElementById('btn-lit-mode');
    btnLitMode.addEventListener('click', () => {
        isLitMode = !isLitMode;
        if (isLitMode) {
            btnLitMode.innerText = '💡 Işık: Açık';
            btnLitMode.classList.add('wireframe-active');
        } else {
            btnLitMode.innerText = '💡 Işık: Kapalı';
            btnLitMode.classList.remove('wireframe-active');
        }
        applyMaterialMode();
    });

    // Axes Toggle
    const btnAxes = document.getElementById('btn-axes');
    btnAxes.addEventListener('click', () => {
        if (!axesHelper) return;
        axesMode = (axesMode + 1) % 3;
        
        if (axesMode === 0) {
            axesHelper.visible = false;
            btnAxes.innerText = '📍 Eksen: Kapalı';
            btnAxes.classList.remove('wireframe-active');
        } else if (axesMode === 1) {
            axesHelper.visible = true;
            axesHelper.rotation.set(-Math.PI / 2, 0, 0); // Blender (Z-Up)
            btnAxes.innerText = '📍 Eksen: Blender';
            btnAxes.classList.add('wireframe-active');
        } else {
            axesHelper.visible = true;
            axesHelper.rotation.set(0, 0, 0); // Unity (Y-Up)
            btnAxes.innerText = '📍 Eksen: Unity';
            btnAxes.classList.add('wireframe-active');
        }
    });

    // Import Model
    const btnImportModel = document.getElementById('btn-import-model');
    const fileImportModel = document.getElementById('file-import-model');

    btnImportModel.addEventListener('click', () => {
        fileImportModel.click();
    });

    fileImportModel.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(evt) {
            try {
                loadModelFromText(evt.target.result);
                alert("Model Başarıyla Yüklendi!\nDosya: " + file.name + "\nBoyut: " + (file.size / 1024).toFixed(2) + " KB");
            } catch (err) {
                alert("Model yüklenirken bir hata oluştu:\n" + err);
            }
        };
        reader.readAsText(file);
        e.target.value = ''; // Aynı dosyayı tekrar seçebilmek için sıfırla
    });

    // Import Image to Layer
    const fileImportImage = document.getElementById('file-import-image');
    fileImportImage.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file || targetLayerIndexForImage === -1) return;

        const reader = new FileReader();
        reader.onload = function(evt) {
            const img = new Image();
            img.onload = () => {
                const targetLayer = targetLayerIndexForImage >= 0 ? layers[targetLayerIndexForImage] : layers[activeLayerIndex];
                renderImageToRT(img, targetLayer.rt);
                blitLayers();
                targetLayerIndexForImage = -1; // Reset
                triggerAutosave();
                HistoryManager.saveState();
            }
            img.src = evt.target.result;
        };
        reader.readAsDataURL(file);
        e.target.value = ''; // Aynı dosyayı tekrar seçebilmek için sıfırla
    });

    // Export Button
    // Add Layer Button
    document.getElementById('btn-add-layer').addEventListener('click', async () => {
        const layerObj = await createLayerObj(null, false);
        layers.push(layerObj);
        document.getElementById('layer-list').appendChild(buildLayerDOM(layerObj));
        selectLayer(layers.length - 1);
        blitLayers();
        triggerAutosave();
        HistoryManager.saveState();
    });

    // History UI
    document.getElementById('btn-host-pc').addEventListener('click', () => {
        toggleMainMenu(false);
        if (window.NetworkManager) window.NetworkManager.startHostMode();
    });

    document.getElementById('btn-connect-tablet').addEventListener('click', () => {
        toggleMainMenu(false);
        if (window.NetworkManager) window.NetworkManager.startClientMode();
    });

    const btnQuickConnect = document.getElementById('btn-quick-connect');
    if (btnQuickConnect) {
        btnQuickConnect.addEventListener('click', () => {
            toggleMainMenu(false);
            const lastHostId = localStorage.getItem('lastConnectedHostId');
            if (lastHostId && window.NetworkManager) {
                if (typeof window.showToast === 'function') {
                    window.showToast("Bağlanılıyor...", 2000, '#a855f7');
                }
                window.NetworkManager.connectToHost(lastHostId);
            }
        });
    }

    const btnQuickConnectTablet = document.getElementById('btn-quick-connect-tablet');
    if (btnQuickConnectTablet) {
        btnQuickConnectTablet.addEventListener('click', () => {
            toggleMainMenu(false);
            const lastTabletId = localStorage.getItem('lastConnectedTabletId');
            if (lastTabletId && window.NetworkManager) {
                window.NetworkManager.connectToTablet(lastTabletId);
            }
        });
    }

    document.getElementById('btn-undo').addEventListener('click', () => HistoryManager.undo());
    document.getElementById('btn-redo').addEventListener('click', () => HistoryManager.redo());
    
    // FPS Toggle
    const btnToggleFps = document.getElementById('btn-toggle-fps');
    if (btnToggleFps) {
        let currentFps = 0; // 0 = unlimited, 1 = 60, 2 = 30
        const fpsStates = [
            { limit: 0, text: '⚡ FPS: Sınırsız' },
            { limit: 60, text: '⚡ FPS: 60' },
            { limit: 30, text: '⚡ FPS: 30' }
        ];
        
        btnToggleFps.addEventListener('click', () => {
            currentFps = (currentFps + 1) % fpsStates.length;
            const state = fpsStates[currentFps];
            btnToggleFps.innerText = state.text;
            if (typeof window.setFPSLimit === 'function') {
                window.setFPSLimit(state.limit);
            }
        });
    }

    document.addEventListener('keydown', (e) => {
        const isZ = e.key.toLowerCase() === 'z' || e.code === 'KeyZ';
        const isY = e.key.toLowerCase() === 'y' || e.code === 'KeyY';

        if (e.ctrlKey && !e.altKey && !e.shiftKey && isZ) {
            e.preventDefault();
            HistoryManager.undo();
        } 
        else if (e.ctrlKey && (e.altKey || e.shiftKey) && isZ) {
            // Redo: Ctrl+Alt+Z or Ctrl+Shift+Z
            e.preventDefault();
            HistoryManager.redo();
        }
        else if (e.ctrlKey && !e.altKey && !e.shiftKey && isY) {
            // Redo: Ctrl+Y
            e.preventDefault();
            HistoryManager.redo();
        }
    });

    document.getElementById('btn-export').addEventListener('click', () => {
        // Tablet tarafına PNG olarak indir
        const link = document.createElement('a');
        link.download = 'texture.png';
        link.href = getLayerPreviewDataUrl({ rt: mainRT }); 
        link.click();

        // Eğer PC'ye (Host) bağlıysa, projeyi PC'ye yedekle
        if (window.NetworkManager && window.NetworkManager.conn && !window.NetworkManager.isHost) {
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
            window.NetworkManager.sendMessage('BACKUP_PROJECT', { 
                projectData: { modelText: currentModelText, layers: layersData } 
            });
            alert("Proje dosyası (TP) PC'ye gönderildi.");
        }
    });

    const btnManualRefresh = document.getElementById('btn-manual-refresh');
    if (btnManualRefresh) {
        btnManualRefresh.addEventListener('click', () => {
            window.location.reload(true);
        });
    }

    // Slider Elements
    const sizeSlider = document.getElementById('size-slider');
    const intensitySlider = document.getElementById('intensity-slider');
    const hardnessSlider = document.getElementById('hardness-slider');

    // Tool Selection
    const toolBtns = document.querySelectorAll('.tool-btn');
    toolBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            toolBtns.forEach(b => b.classList.remove('active'));
            const target = e.currentTarget;
            target.classList.add('active');
            currentTool = target.dataset.tool;
            
            // Update UI sliders to match the newly selected tool's settings
            const settings = toolSettings[currentTool];
            if (settings) {
                sizeSlider.value = settings.size;
                intensitySlider.value = settings.intensity;
                hardnessSlider.value = settings.hardness;
            }
        });
    });

    // Initialize sliders with default brush settings
    if (toolSettings['brush']) {
        sizeSlider.value = toolSettings['brush'].size;
        intensitySlider.value = toolSettings['brush'].intensity;
        hardnessSlider.value = toolSettings['brush'].hardness;
    }

    // Inputs
    // Tool Size Slider
    sizeSlider.addEventListener('input', (e) => {
        if (toolSettings[currentTool]) {
            toolSettings[currentTool].size = parseInt(e.target.value, 10);
        }
    });

    // Tool Intensity Slider
    intensitySlider.addEventListener('input', (e) => {
        if (toolSettings[currentTool]) {
            toolSettings[currentTool].intensity = parseInt(e.target.value, 10);
        }
    });

    // Tool Hardness Slider
    hardnessSlider.addEventListener('input', (e) => {
        if (toolSettings[currentTool]) {
            toolSettings[currentTool].hardness = parseInt(e.target.value, 10);
        }
    });

    // Color Picker
    const colorPicker = document.getElementById('color-picker');
    colorPicker.addEventListener('input', (e) => { currentColor = e.target.value; });
}

function decodeFloat16(binary) {
    const exponent = (binary & 0x7C00) >> 10;
    const fraction = binary & 0x03FF;
    return (binary >> 15 ? -1 : 1) * (
        exponent ?
        (
            exponent === 0x1F ?
            (fraction ? NaN : Infinity) :
            Math.pow(2, exponent - 15) * (1 + fraction / 0x400)
        ) :
        6.103515625e-5 * (fraction / 0x400)
    );
}

function updatePickerPreview(uv) {
    if (!mainRT) return;

    const x = Math.max(0, Math.min(TEX_SIZE - 1, Math.floor(uv.x * TEX_SIZE)));
    const y = Math.max(0, Math.min(TEX_SIZE - 1, Math.floor(uv.y * TEX_SIZE))); 
    
    // mainRT is HalfFloatType, so we must read into a Uint16Array
    const buffer = new Uint16Array(4);
    renderer.readRenderTargetPixels(mainRT, x, y, 1, 1, buffer);
    
    const r = Math.min(255, Math.max(0, Math.round(decodeFloat16(buffer[0]) * 255)));
    const g = Math.min(255, Math.max(0, Math.round(decodeFloat16(buffer[1]) * 255)));
    const b = Math.min(255, Math.max(0, Math.round(decodeFloat16(buffer[2]) * 255)));
    
    const hex = rgbToHex(r, g, b);
    previewColor = hex;
    
    const preview = document.getElementById('picker-preview');
    preview.style.backgroundColor = hex;
    preview.classList.remove('hidden');
}

function rgbToHex(r, g, b) {
    return "#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1);
}

function showCustomConfirm(title, message, onConfirm) {
    document.getElementById('custom-confirm-title').innerText = title;
    document.getElementById('custom-confirm-message').innerText = message;
    
    const overlay = document.getElementById('custom-confirm-overlay');
    overlay.classList.remove('hidden');
    
    customConfirmCallback = onConfirm;
}

document.getElementById('custom-confirm-cancel').addEventListener('click', () => {
    document.getElementById('custom-confirm-overlay').classList.add('hidden');
    customConfirmCallback = null;
});

document.getElementById('custom-confirm-ok').addEventListener('click', () => {
    document.getElementById('custom-confirm-overlay').classList.add('hidden');
    if (customConfirmCallback) {
        customConfirmCallback();
        customConfirmCallback = null;
    }
});

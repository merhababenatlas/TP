/// <summary>
/// Layer Management
/// </summary>

function createLayerObj(savedLayer = null, isFirst = false) {
    const canvas = document.createElement('canvas');
    canvas.width = TEX_SIZE;
    canvas.height = TEX_SIZE;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (savedLayer && savedLayer.imageData) {
        loadImageToCanvas(savedLayer.imageData, ctx).then(() => blitLayers());
    } else if (isFirst) {
        ctx.fillStyle = '#e0e0e0';
        ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
    }

    const layerObj = {
        id: savedLayer ? savedLayer.id : layerIdCounter++,
        canvas: canvas,
        ctx: ctx,
        isVisible: savedLayer ? savedLayer.isVisible : true,
        opacity: savedLayer ? savedLayer.opacity : 100,
        name: savedLayer ? savedLayer.name : `Katman ${layers.length + 1}`
    };
    if (layerObj.id >= layerIdCounter) layerIdCounter = layerObj.id + 1;
    return layerObj;
}

function buildLayerDOM(layerObj) {
    const itemEl = document.createElement('div');
    itemEl.className = 'layer-item';
    if (layers.indexOf(layerObj) === activeLayerIndex) itemEl.classList.add('active');

    // --- DRAG AND DROP START ---
    itemEl.draggable = true;
    itemEl._layerObj = layerObj;

    // Prevent dragging when interacting with sliders/inputs/buttons
    itemEl.addEventListener('mouseover', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') {
            itemEl.draggable = false;
        }
    });
    itemEl.addEventListener('mouseout', (e) => {
        itemEl.draggable = true;
    });

    itemEl.addEventListener('dragstart', (e) => {
        draggedItemEl = itemEl;
        e.dataTransfer.setData('text/plain', '');
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => { itemEl.classList.add('dragging'); }, 0);
    });

    itemEl.addEventListener('dragend', () => {
        if (!draggedItemEl) return;
        itemEl.classList.remove('dragging');
        draggedItemEl = null;
        
        const layerListEl = document.getElementById('layer-list');
        const newArray = [];
        let newActiveIndex = activeLayerIndex;
        
        Array.from(layerListEl.children).forEach((childEl, index) => {
            newArray.push(childEl._layerObj);
            if (childEl.classList.contains('active')) {
                newActiveIndex = index;
            }
        });
        
        layers.length = 0;
        layers.push(...newArray);
        activeLayerIndex = newActiveIndex;
        
        blitLayers();
        triggerAutosave();
        HistoryManager.saveState();
    });

    itemEl.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (!draggedItemEl || draggedItemEl === itemEl) return;
        
        const layerListEl = document.getElementById('layer-list');
        const bounding = itemEl.getBoundingClientRect();
        const offset = bounding.y + (bounding.height / 2);
        
        if (e.clientY < offset) {
            layerListEl.insertBefore(draggedItemEl, itemEl.nextSibling);
        } else {
            layerListEl.insertBefore(draggedItemEl, itemEl);
        }
    });

    itemEl.addEventListener('drop', (e) => { e.preventDefault(); });
    // --- DRAG AND DROP END ---

    const layerHeader = document.createElement('div');
    layerHeader.className = 'layer-header';
    
    const nameEl = document.createElement('input');
    nameEl.type = 'text';
    nameEl.className = 'layer-name-input';
    nameEl.value = layerObj.name;
    
    nameEl.addEventListener('click', (e) => e.stopPropagation());
    nameEl.addEventListener('pointerdown', (e) => e.stopPropagation());
    nameEl.addEventListener('change', (e) => {
        layerObj.name = e.target.value;
        triggerAutosave();
    });
    nameEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') e.target.blur();
    });
    
    layerHeader.appendChild(nameEl);

    const layerActionsRow = document.createElement('div');
    layerActionsRow.className = 'layer-actions-row';

    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn-remove-layer layer-import-btn'; 
    removeBtn.innerText = '🗑️';
    removeBtn.title = 'Katmanı Sil';
    removeBtn.onclick = (e) => {
        e.stopPropagation();
        if (layers.length <= 1) {
            alert('En az 1 katman kalmalıdır!');
            return;
        }
        showCustomConfirm(
            'Emin misiniz?',
            `"${layerObj.name}" katmanını silmek istediğinize emin misiniz?`,
            () => {
                const idx = layers.indexOf(layerObj);
                layers.splice(idx, 1);
                itemEl.remove();
                
                if (activeLayerIndex === idx) {
                    selectLayer(Math.max(0, idx - 1));
                } else if (activeLayerIndex > idx) {
                    activeLayerIndex--;
                    selectLayer(activeLayerIndex);
                }
                
                blitLayers();
                triggerAutosave();
                HistoryManager.saveState();
            }
        );
    };

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-clear-layer layer-import-btn'; 
    deleteBtn.innerText = '🧹';
    deleteBtn.title = 'Katmanı Temizle';
    deleteBtn.onclick = (e) => {
        e.stopPropagation();
        layerObj.ctx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);
        blitLayers();
        triggerAutosave();
        HistoryManager.saveState();
    };

    const previewBtn = document.createElement('button');
    previewBtn.className = 'layer-preview-btn';
    previewBtn.innerText = '🖼';
    previewBtn.title = 'Doku Önizleme';
    previewBtn.onclick = (e) => {
        e.stopPropagation();
        document.getElementById('texture-preview-image').src = layerObj.canvas.toDataURL('image/png');
        document.getElementById('texture-preview-overlay').classList.remove('hidden');
    };

    const importBtn = document.createElement('button');
    importBtn.className = 'layer-import-btn';
    importBtn.innerText = '📥';
    importBtn.title = 'Resim Yükle';
    importBtn.onclick = (e) => {
        e.stopPropagation();
        targetLayerIndexForImage = layers.indexOf(layerObj);
        document.getElementById('file-import-image').click();
    };

    layerActionsRow.appendChild(removeBtn);
    layerActionsRow.appendChild(deleteBtn);
    layerActionsRow.appendChild(previewBtn);
    layerActionsRow.appendChild(importBtn);

    const layerOpacityRow = document.createElement('div');
    layerOpacityRow.className = 'layer-opacity-row';
    
    const opacitySlider = document.createElement('input');
    opacitySlider.type = 'range';
    opacitySlider.min = '0';
    opacitySlider.max = '100';
    opacitySlider.value = layerObj.opacity;
    opacitySlider.title = 'Katman Opaklığı';
    
    opacitySlider.addEventListener('input', (e) => {
        e.stopPropagation();
        layerObj.opacity = parseInt(e.target.value);
        blitLayers();
    });
    opacitySlider.addEventListener('change', (e) => {
        e.stopPropagation();
        triggerAutosave();
    });
    opacitySlider.addEventListener('click', (e) => e.stopPropagation());
    opacitySlider.addEventListener('pointerdown', (e) => e.stopPropagation());

    layerOpacityRow.appendChild(opacitySlider);

    itemEl.appendChild(layerHeader);
    itemEl.appendChild(layerActionsRow);
    itemEl.appendChild(layerOpacityRow);
    itemEl.onclick = () => { selectLayer(layers.indexOf(layerObj)); };

    return itemEl;
}

async function initLayers(savedLayersData = null) {
    const layerListEl = document.getElementById('layer-list');
    layerListEl.innerHTML = '';
    
    mainCanvas = document.createElement('canvas');
    mainCanvas.width = TEX_SIZE;
    mainCanvas.height = TEX_SIZE;
    mainCtx = mainCanvas.getContext('2d', { willReadFrequently: true });
    
    layers.length = 0;
    activeLayerIndex = 0;

    if (savedLayersData && savedLayersData.length > 0) {
        for (let i = 0; i < savedLayersData.length; i++) {
            const layerObj = createLayerObj(savedLayersData[i], false);
            layers.push(layerObj);
            layerListEl.appendChild(buildLayerDOM(layerObj));
        }
    } else {
        const layerObj = createLayerObj(null, true);
        layers.push(layerObj);
        layerListEl.appendChild(buildLayerDOM(layerObj));
    }
    
    // Save initial state
    HistoryManager.saveState();
}

function selectLayer(index) {
    activeLayerIndex = index;
    const items = document.querySelectorAll('.layer-item');
    items.forEach(el => el.classList.remove('active'));
    // Since we appended normally and CSS handles reverse order, DOM index corresponds to array index
    items[index].classList.add('active');
}

function blitLayers(dirtyRect = null) {
    if (dirtyRect) {
        let x = Math.floor(dirtyRect.x);
        let y = Math.floor(dirtyRect.y);
        let w = Math.ceil(dirtyRect.w);
        let h = Math.ceil(dirtyRect.h);
        
        if (x < 0) { w += x; x = 0; }
        if (y < 0) { h += y; y = 0; }
        if (x + w > TEX_SIZE) w = TEX_SIZE - x;
        if (y + h > TEX_SIZE) h = TEX_SIZE - y;
        
        if (w > 0 && h > 0) {
            mainCtx.drawImage(baseBgCanvas, x, y, w, h, x, y, w, h);
            for (let i = 0; i < layers.length; i++) {
                const l = layers[i];
                if (!l.isVisible) continue;
                
                if (i === activeLayerIndex && isStrokeActive) {
                    const settings = toolSettings[currentTool];
                    const intensity = settings ? settings.intensity : 100;
                    
                    // Render to tempCanvas first
                    tempCtx.clearRect(x, y, w, h);
                    tempCtx.drawImage(l.canvas, x, y, w, h, x, y, w, h);
                    
                    if (currentTool === 'eraser') {
                        tempCtx.globalCompositeOperation = 'destination-out';
                    } else {
                        tempCtx.globalCompositeOperation = 'source-over';
                    }
                    tempCtx.globalAlpha = intensity / 100;
                    tempCtx.drawImage(strokeCanvas, x, y, w, h, x, y, w, h);
                    tempCtx.globalCompositeOperation = 'source-over';
                    tempCtx.globalAlpha = 1.0;
                    
                    // Now draw tempCanvas to mainCtx
                    mainCtx.globalAlpha = l.opacity / 100;
                    mainCtx.drawImage(tempCanvas, x, y, w, h, x, y, w, h);
                } else {
                    mainCtx.globalAlpha = l.opacity / 100;
                    mainCtx.drawImage(l.canvas, x, y, w, h, x, y, w, h);
                }
            }
            mainCtx.globalAlpha = 1.0;
        }
    } else {
        mainCtx.drawImage(baseBgCanvas, 0, 0);
        for (let i = 0; i < layers.length; i++) {
            const l = layers[i];
            if (!l.isVisible) continue;
            
            if (i === activeLayerIndex && isStrokeActive) {
                const settings = toolSettings[currentTool];
                const intensity = settings ? settings.intensity : 100;
                
                tempCtx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);
                tempCtx.drawImage(l.canvas, 0, 0);
                
                if (currentTool === 'eraser') {
                    tempCtx.globalCompositeOperation = 'destination-out';
                } else {
                    tempCtx.globalCompositeOperation = 'source-over';
                }
                tempCtx.globalAlpha = intensity / 100;
                tempCtx.drawImage(strokeCanvas, 0, 0);
                tempCtx.globalCompositeOperation = 'source-over';
                tempCtx.globalAlpha = 1.0;
                
                mainCtx.globalAlpha = l.opacity / 100;
                mainCtx.drawImage(tempCanvas, 0, 0);
            } else {
                mainCtx.globalAlpha = l.opacity / 100;
                mainCtx.drawImage(l.canvas, 0, 0);
            }
        }
        mainCtx.globalAlpha = 1.0;
    }
    mainTexture.needsUpdate = true;
}


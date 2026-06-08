/// <summary>
/// Layer UI Management (DOM Events, Drag & Drop, Sync)
/// </summary>

window.LayerUIManager = {
    buildLayerDOM: function(layerObj) {
        const itemEl = document.createElement('div');
        itemEl.className = 'layer-item';
        // Note: layers and activeLayerIndex are global in globals.js
        if (layers.indexOf(layerObj) === activeLayerIndex) itemEl.classList.add('active');

        itemEl.draggable = true;
        itemEl._layerObj = layerObj;

        itemEl.addEventListener('mouseover', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') {
                itemEl.draggable = false;
            }
        });
        itemEl.addEventListener('mouseout', (e) => {
            itemEl.draggable = true;
        });

        itemEl.addEventListener('dragstart', (e) => {
            draggedItemEl = itemEl; // global from globals.js
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
            
            // Update global layers array
            layers.length = 0;
            layers.push(...newArray);
            activeLayerIndex = newActiveIndex;
            
            if (typeof blitLayers === 'function') blitLayers();
            if (typeof triggerAutosave === 'function') triggerAutosave();
            if (window.HistoryManager) window.HistoryManager.saveState();
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
            if (typeof triggerAutosave === 'function') triggerAutosave();
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
            if (typeof showCustomConfirm === 'function') {
                showCustomConfirm(
                    'Emin misiniz?',
                    `"${layerObj.name}" katmanını silmek istediğinize emin misiniz?`,
                    () => {
                        const idx = layers.indexOf(layerObj);
                        if (layerObj.rt) layerObj.rt.dispose(); // Free GPU memory
                        layers.splice(idx, 1);
                        itemEl.remove();
                        
                        if (activeLayerIndex === idx) {
                            if (typeof selectLayer === 'function') selectLayer(Math.max(0, idx - 1));
                        } else if (activeLayerIndex > idx) {
                            activeLayerIndex--;
                            if (typeof selectLayer === 'function') selectLayer(activeLayerIndex);
                        }
                        
                        if (typeof blitLayers === 'function') blitLayers();
                        if (typeof triggerAutosave === 'function') triggerAutosave();
                        if (window.HistoryManager) window.HistoryManager.saveState();
                    }
                );
            }
        };

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-clear-layer layer-import-btn'; 
        deleteBtn.innerText = '🧹';
        deleteBtn.title = 'Katmanı Temizle';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            if (renderer && layerObj.rt) {
                const oldTarget = renderer.getRenderTarget();
                renderer.setRenderTarget(layerObj.rt);
                renderer.clear();
                renderer.setRenderTarget(oldTarget);
            }
            
            if (typeof blitLayers === 'function') blitLayers();
            if (typeof triggerAutosave === 'function') triggerAutosave();
            if (window.HistoryManager) window.HistoryManager.saveState();
        };

        const previewBtn = document.createElement('button');
        previewBtn.className = 'layer-preview-btn';
        previewBtn.innerText = layerObj.isVisible !== false ? '👁️' : '🙈'; // Modified logic for visibility toggle? 
        // Wait, original previewBtn showed texture preview. Let's keep original logic.
        // Original logic from LayerManager.js line 300:
        previewBtn.innerText = '🖼️';
        previewBtn.title = 'Doku Önizleme';
        previewBtn.onclick = (e) => {
            e.stopPropagation();
            const previewImg = document.getElementById('texture-preview-image');
            const previewOverlay = document.getElementById('texture-preview-overlay');
            if (previewImg && typeof getLayerPreviewDataUrl === 'function') {
                previewImg.src = getLayerPreviewDataUrl(layerObj);
            }
            if (previewOverlay) {
                previewOverlay.classList.remove('hidden');
            }
            document.body.classList.add('preview-mode-active');
        };

        const importBtn = document.createElement('button');
        importBtn.className = 'layer-import-btn';
        importBtn.innerText = '📥';
        importBtn.title = 'Resim Yükle';
        importBtn.onclick = (e) => {
            e.stopPropagation();
            // Assuming targetLayerIndexForImage is global in UIManager
            window.targetLayerIndexForImage = layers.indexOf(layerObj);
            const fileImportImage = document.getElementById('file-import-image');
            if (fileImportImage) fileImportImage.click();
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
            if (typeof blitLayers === 'function') blitLayers();
        });
        opacitySlider.addEventListener('change', (e) => {
            e.stopPropagation();
            if (typeof triggerAutosave === 'function') triggerAutosave();
        });
        opacitySlider.addEventListener('click', (e) => e.stopPropagation());
        opacitySlider.addEventListener('pointerdown', (e) => e.stopPropagation());

        layerOpacityRow.appendChild(opacitySlider);

        itemEl.appendChild(layerHeader);
        itemEl.appendChild(layerActionsRow);
        itemEl.appendChild(layerOpacityRow);
        itemEl.onclick = () => { 
            if (typeof selectLayer === 'function') selectLayer(layers.indexOf(layerObj)); 
        };

        return itemEl;
    },

    syncFromMeta: function(layersMeta) {
        const listEl = document.getElementById('layer-list');
        if (!listEl) return;
        
        listEl.innerHTML = '';
        layersMeta.forEach(meta => {
            const itemEl = document.createElement('div');
            itemEl.className = 'layer-item';
            if (meta.isActive) itemEl.classList.add('active');
            
            const header = document.createElement('div');
            header.className = 'layer-header';
            
            const nameEl = document.createElement('input');
            nameEl.type = 'text';
            nameEl.className = 'layer-name-input';
            nameEl.value = meta.name;
            header.appendChild(nameEl);
            
            const actionsRow = document.createElement('div');
            actionsRow.className = 'layer-actions-row';
            
            const removeBtn = document.createElement('button');
            removeBtn.className = 'btn-remove-layer layer-import-btn'; 
            removeBtn.innerText = '🗑️';
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn-clear-layer layer-import-btn';
            deleteBtn.innerText = '🧹';
            
            const previewBtn = document.createElement('button');
            previewBtn.className = 'btn-preview-layer layer-import-btn';
            previewBtn.innerText = meta.isVisible !== false ? '👁️' : '🙈';
            
            const importBtn = document.createElement('button');
            importBtn.className = 'btn-import-layer layer-import-btn';
            importBtn.innerText = '🖼️'; // The NetworkManager code used 🖼️ for importBtn visually in SYNC_LAYERS_META
            
            actionsRow.appendChild(removeBtn);
            actionsRow.appendChild(deleteBtn);
            actionsRow.appendChild(previewBtn);
            actionsRow.appendChild(importBtn);
            
            const opacityRow = document.createElement('div');
            opacityRow.className = 'layer-opacity-row';
            
            const opacitySlider = document.createElement('input');
            opacitySlider.type = 'range';
            opacitySlider.min = '0';
            opacitySlider.max = '100';
            opacitySlider.value = meta.opacity;
            
            opacityRow.appendChild(opacitySlider);
            
            itemEl.appendChild(header);
            itemEl.appendChild(actionsRow);
            itemEl.appendChild(opacityRow);
            
            listEl.appendChild(itemEl);
        });
    },

    addLayerToUI: function(layerObj) {
        const layerListEl = document.getElementById('layer-list');
        if (layerListEl) {
            layerListEl.appendChild(this.buildLayerDOM(layerObj));
        }
    }
};

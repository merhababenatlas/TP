/// <summary>
/// Three.js Input Controller (Pointer Events & Raycasting)
/// </summary>

window.initTools = function() {
    const container = document.getElementById('canvas-container');
    
    container.addEventListener('pointerdown', window.onPointerDown);
    container.addEventListener('pointermove', window.onPointerMove);
    window.addEventListener('pointerup', window.onPointerUp);
};

window.onPointerDown = function(event) {
    if (window.NetworkManager && window.NetworkManager.isHost) return; // Host modunda boyama kapalı
    if (event.button !== 0) return; // Sadece sol tık (0) veya dokunmatiğe izin ver

    if (document.activeElement && document.activeElement.tagName === 'INPUT' && document.activeElement.type === 'text') {
        document.activeElement.blur();
    }

    if (event.target !== renderer.domElement) return;
    
    const intersect = window.getIntersectionFromEvent(event);
    if (intersect && intersect.uv) {
        controls.enabled = false;
        isDrawing = true;
        if (currentTool === 'picker') {
            if (typeof updatePickerPreview === 'function') updatePickerPreview(intersect.uv);
        } else {
            isStrokeActive = true;
            
            lastMouse = { x: event.clientX, y: event.clientY };
            lastUvPosition = { x: intersect.uv.x, y: intersect.uv.y };
            lastMouseMoveTime = Date.now();
            
            if (typeof applyTool === 'function') applyTool(intersect.uv.x, intersect.uv.y);
            
            if (airbrushInterval) clearInterval(airbrushInterval);
            airbrushInterval = setInterval(() => {
                if (isDrawing && lastUvPosition) {
                    const isStationary = (Date.now() - lastMouseMoveTime) > 50;
                    if (isStationary) {
                        if (typeof applyTool === 'function') applyTool(lastUvPosition.x, lastUvPosition.y);
                    }
                }
            }, 50);
        }
    }
};

window.onPointerMove = function(event) {
    const intersect = window.getIntersectionFromEvent(event);
    
    if (intersect && intersect.uv) {
        if (currentTool === 'picker') {
            if (typeof updatePickerPreview === 'function') updatePickerPreview(intersect.uv);
        } else {
            const preview = document.getElementById('picker-preview');
            if (preview) preview.classList.add('hidden');
        }
    } else {
        const preview = document.getElementById('picker-preview');
        if (preview) preview.classList.add('hidden');
    }

    if (!isDrawing) return;
    
    if (currentTool !== 'picker') {
        if (intersect && intersect.uv) {
            const oldUvPosition = lastUvPosition ? { x: lastUvPosition.x, y: lastUvPosition.y } : { x: intersect.uv.x, y: intersect.uv.y };
            lastUvPosition = { x: intersect.uv.x, y: intersect.uv.y };
            lastMouseMoveTime = Date.now();
            
            const currentMouse = { x: event.clientX, y: event.clientY };
            if (lastMouse) {
                const dx = currentMouse.x - lastMouse.x;
                const dy = currentMouse.y - lastMouse.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                
                const settings = toolSettings[currentTool];
                const sSize = settings ? settings.size : 50;
                
                // For blur and smear, take fewer steps to prevent severe interpolation loss (blocky artifacts)
                // For brush and eraser, take dense steps to prevent caterpillar effect
                let stepMultiplier = (currentTool === 'blur' || currentTool === 'smear') ? 0.25 : 0.05;
                const stampDist = Math.max(1, sSize * stepMultiplier); 
                const steps = Math.max(1, Math.floor(dist / stampDist));
                
                for (let i = 1; i <= steps; i++) {
                    const lerpX = lastMouse.x + dx * (i / steps);
                    const lerpY = lastMouse.y + dy * (i / steps);
                    
                    const synthIntersect = window.getIntersectionFromEvent({ clientX: lerpX, clientY: lerpY });
                    if (synthIntersect && synthIntersect.uv) {
                        if (typeof applyTool === 'function') applyTool(synthIntersect.uv.x, synthIntersect.uv.y, oldUvPosition.x, oldUvPosition.y);
                    }
                }
            } else {
                if (typeof applyTool === 'function') applyTool(intersect.uv.x, intersect.uv.y, oldUvPosition.x, oldUvPosition.y);
            }
            lastMouse = currentMouse;
        } else {
            lastMouse = null;
            lastUvPosition = null;
        }
    }
};

window.onPointerUp = function(event) {
    if (airbrushInterval) {
        clearInterval(airbrushInterval);
        airbrushInterval = null;
    }

    if (isDrawing && currentTool === 'picker' && previewColor) {
        currentColor = previewColor;
        document.getElementById('color-picker').value = previewColor;
        currentTool = 'brush';
        const brushBtn = document.querySelector('[data-tool="brush"]');
        if (brushBtn) brushBtn.click();
        const preview = document.getElementById('picker-preview');
        if (preview) preview.classList.add('hidden');
    }

    if (isDrawing && currentTool !== 'picker') {
        isStrokeActive = false;
        if (typeof blitLayers === 'function') blitLayers(); // Final blend
        
        if (typeof triggerAutosave === 'function') triggerAutosave();
        if (window.HistoryManager) window.HistoryManager.saveState();
    }

    isDrawing = false;
    if (controls) controls.enabled = true;
    lastMouse = null;
    lastUvPosition = null;
};

window.getIntersectionFromEvent = function(event) {
    if (!renderer || !cube) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const mouse = new THREE.Vector2(x, y);
    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObject(cube, true);
    
    // Find the first intersection that has UV coordinates and is NOT a wireframe line
    for (let i = 0; i < intersects.length; i++) {
        const intersect = intersects[i];
        if (intersect.object && !intersect.object.userData.isWireframeHelper && intersect.uv) {
            return intersect;
        }
    }
    
    return null;
};

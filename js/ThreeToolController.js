/// <summary>
/// 3D Pointer Events, Raycasting, and Paint Brush Mechanics
/// </summary>

function initTools() {
    const container = document.getElementById('canvas-container');
    
    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
}

function onPointerDown(event) {
    if (window.NetworkManager && window.NetworkManager.isHost) return; // Host modunda boyama kapalı
    if (event.button !== 0) return; // Sadece sol tık (0) veya dokunmatiğe izin ver

    // Tablet Kontrol Modu (Yarı Serbest ve Kısıtlı modda sadece kalemle boyama yapılabilir)
    if ((tabletControlMode === 'semi' || tabletControlMode === 'restricted') && event.pointerType !== 'pen') {
        // Return without calling preventDefault or stopPropagation. 
        // This disables drawing, but allows OrbitControls to handle the touch event for camera rotation.
        return; 
    }

    if (document.activeElement && document.activeElement.tagName === 'INPUT' && document.activeElement.type === 'text') {
        document.activeElement.blur();
    }

    if (event.target !== renderer.domElement) return;
    
    const intersect = getIntersectionFromEvent(event);
    if (intersect && intersect.uv) {
        controls.enabled = false;
        isDrawing = true;
        if (currentTool === 'picker') {
            if (typeof updatePickerPreview === 'function') updatePickerPreview(intersect.uv);
        } else {
            isStrokeActive = true;
            
            lastMouse = { x: event.clientX, y: event.clientY };
            strokePoints = [lastMouse];
            lastUvPosition = { x: intersect.uv.x, y: intersect.uv.y };
            lastMouseMoveTime = Date.now();
            
            applyTool(intersect.uv.x, intersect.uv.y);
            
            if (airbrushInterval) clearInterval(airbrushInterval);
            airbrushInterval = setInterval(() => {
                if (isDrawing && lastUvPosition) {
                    const isStationary = (Date.now() - lastMouseMoveTime) > 50;
                    if (isStationary) {
                        applyTool(lastUvPosition.x, lastUvPosition.y);
                    }
                }
            }, 50);
        }
    }
}

function onPointerMove(event) {
    if (event.isPrimary === false) return; // Ignore multi-touch secondary points
    
    const intersect = getIntersectionFromEvent(event);
    
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
            strokePoints.push(currentMouse);
            
            if (strokePoints.length >= 3) {
                const p0 = strokePoints[strokePoints.length - 3];
                const p1 = strokePoints[strokePoints.length - 2];
                const p2 = strokePoints[strokePoints.length - 1];
                
                // Smooth quadratic curve from mid(p0,p1) to mid(p1,p2)
                const startX = (p0.x + p1.x) / 2;
                const startY = (p0.y + p1.y) / 2;
                const endX = (p1.x + p2.x) / 2;
                const endY = (p1.y + p2.y) / 2;
                const controlX = p1.x;
                const controlY = p1.y;
                
                const dx = endX - startX;
                const dy = endY - startY;
                const dist = Math.sqrt(dx*dx + dy*dy);
                
                const settings = toolSettings[currentTool];
                const sSize = settings ? settings.size : 50;
                
                // Daha performanslı adım aralıkları (öncekinden 2.5 kat daha az raycast atacak)
                let stepMultiplier = (currentTool === 'blur' || currentTool === 'smear') ? 0.7 : 0.35;
                const stampDist = Math.max(4, sSize * stepMultiplier); 
                
                // Darboğazı önlemek için tek bir fare hareketinde maksimum raycast sınırı (20'den 12'ye düşürüldü)
                const steps = Math.min(12, Math.max(1, Math.floor(dist / stampDist)));
                
                // Bezier üzerinde gezin
                for (let i = 1; i <= steps; i++) {
                    const t = i / steps;
                    const mt = 1 - t;
                    const bX = mt * mt * startX + 2 * mt * t * controlX + t * t * endX;
                    const bY = mt * mt * startY + 2 * mt * t * controlY + t * t * endY;
                    
                    const synthIntersect = getIntersectionFromEvent({ clientX: bX, clientY: bY });
                    if (synthIntersect && synthIntersect.uv) {
                        applyTool(synthIntersect.uv.x, synthIntersect.uv.y, oldUvPosition.x, oldUvPosition.y);
                        oldUvPosition.x = synthIntersect.uv.x;
                        oldUvPosition.y = synthIntersect.uv.y;
                    }
                }
            } else if (strokePoints.length === 2) {
                // Sadece iki nokta varsa düz çizgi çiz (hareketin başı)
                const p0 = strokePoints[0];
                const p1 = strokePoints[1];
                const dx = p1.x - p0.x;
                const dy = p1.y - p0.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                
                const settings = toolSettings[currentTool];
                const sSize = settings ? settings.size : 50;
                let stepMultiplier = (currentTool === 'blur' || currentTool === 'smear') ? 0.7 : 0.35;
                const stampDist = Math.max(4, sSize * stepMultiplier); 
                const steps = Math.min(12, Math.max(1, Math.floor(dist / stampDist)));
                
                for (let i = 1; i <= steps; i++) {
                    const lerpX = p0.x + dx * (i / steps);
                    const lerpY = p0.y + dy * (i / steps);
                    const synthIntersect = getIntersectionFromEvent({ clientX: lerpX, clientY: lerpY });
                    if (synthIntersect && synthIntersect.uv) {
                        applyTool(synthIntersect.uv.x, synthIntersect.uv.y, oldUvPosition.x, oldUvPosition.y);
                        oldUvPosition.x = synthIntersect.uv.x;
                        oldUvPosition.y = synthIntersect.uv.y;
                    }
                }
            } else {
                applyTool(intersect.uv.x, intersect.uv.y, oldUvPosition.x, oldUvPosition.y);
            }
            lastMouse = currentMouse;
        } else {
            lastMouse = null;
            lastUvPosition = null;
        }
    }
}

function onPointerUp(event) {
    if (airbrushInterval) {
        clearInterval(airbrushInterval);
        airbrushInterval = null;
    }

    if (isDrawing && currentTool === 'picker' && previewColor) {
        currentColor = previewColor;
        document.getElementById('color-picker').value = previewColor;
        currentTool = 'brush';
        document.querySelector('[data-tool="brush"]').click();
        document.getElementById('picker-preview').classList.add('hidden');
    }

    if (isDrawing && currentTool !== 'picker') {
        isStrokeActive = false;
        strokePoints = []; // Çizim bitince noktaları temizle
        if (typeof blitLayers === 'function') blitLayers(); // Final blend
        
        if (typeof triggerAutosave === 'function') triggerAutosave();
        if (window.HistoryManager) window.HistoryManager.saveState();
    }

    isDrawing = false;
    controls.enabled = true;
    lastMouse = null;
    lastUvPosition = null;
}

function getIntersectionFromEvent(event) {
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
}

function applyTool(uvX, uvY, oldUvX = null, oldUvY = null) {
    if (!isStrokeActive) return;
    
    const activeLayer = layers[activeLayerIndex];
    if (!activeLayer || !activeLayer.rt) return;

    const settings = toolSettings[currentTool];
    const sSize = settings ? settings.size : 50;
    const sInt = settings ? settings.intensity : 50;
    const sHard = settings ? settings.hardness : 50;
    
    const uCenter = new THREE.Vector2(uvX, uvY);
    const uRadius = (sSize / 2.0) / TEX_SIZE;
    
    const oldTarget = renderer.getRenderTarget();
    const paintQuad = paintScene.children[0];

    if (currentTool === 'brush' || currentTool === 'eraser') {
        renderer.setRenderTarget(activeLayer.rt);
        
        paintQuad.material = brushMaterial;
        brushMaterial.uniforms.uCenter.value = uCenter;
        brushMaterial.uniforms.uRadius.value = uRadius;
        brushMaterial.uniforms.uIntensity.value = sInt / 100.0;
        brushMaterial.uniforms.uHardness.value = sHard / 100.0;
        
        if (currentTool === 'brush') {
            brushMaterial.uniforms.uColor.value.set(currentColor);
            brushMaterial.blending = THREE.CustomBlending;
            brushMaterial.blendEquation = THREE.AddEquation;
            brushMaterial.blendSrc = THREE.OneFactor;
            brushMaterial.blendDst = THREE.OneMinusSrcAlphaFactor;
            brushMaterial.blendSrcAlpha = THREE.OneFactor;
            brushMaterial.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
        } else {
            brushMaterial.uniforms.uColor.value.set(0xffffff);
            brushMaterial.blending = THREE.CustomBlending;
            brushMaterial.blendEquation = THREE.AddEquation;
            brushMaterial.blendSrc = THREE.ZeroFactor;
            brushMaterial.blendDst = THREE.OneMinusSrcAlphaFactor;
            brushMaterial.blendSrcAlpha = THREE.ZeroFactor;
            brushMaterial.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
        }
        
        renderer.render(paintScene, paintCamera);
        
    } else if (currentTool === 'blur' || currentTool === 'smear') {
        // Ping-pong to tempRT
        renderer.setRenderTarget(tempRT);
        
        if (currentTool === 'blur') {
            paintQuad.material = blurMaterial;
            blurMaterial.uniforms.tDiffuse.value = activeLayer.rt.texture;
            blurMaterial.uniforms.uCenter.value = uCenter;
            blurMaterial.uniforms.uRadius.value = uRadius;
            blurMaterial.uniforms.uIntensity.value = sInt / 100.0;
            blurMaterial.uniforms.uHardness.value = sHard / 100.0;
        } else {
            paintQuad.material = smearMaterial;
            smearMaterial.uniforms.tDiffuse.value = activeLayer.rt.texture;
            smearMaterial.uniforms.uCenter.value = uCenter;
            smearMaterial.uniforms.uRadius.value = uRadius;
            smearMaterial.uniforms.uIntensity.value = sInt / 100.0;
            smearMaterial.uniforms.uHardness.value = sHard / 100.0;
            
            const dir = new THREE.Vector2(0, 0);
            if (oldUvX !== null && oldUvY !== null) {
                // Direction from previous mouse position to current
                dir.set(uvX - oldUvX, uvY - oldUvY);
            }
            smearMaterial.uniforms.uDirection.value = dir;
        }
        
        renderer.render(paintScene, paintCamera);
        
        // Copy back to activeLayer.rt
        renderer.setRenderTarget(activeLayer.rt);
        renderer.clear();
        paintQuad.material = paintMaterial;

        paintMaterial.uniforms.tLayer.value = tempRT.texture;
        paintMaterial.uniforms.uOpacity.value = 1.0;
        paintMaterial.blending = THREE.NoBlending; // Direct copy
        renderer.render(paintScene, paintCamera);
        paintMaterial.blending = THREE.NormalBlending; // Restore
    }
    
    renderer.setRenderTarget(oldTarget);
    if (typeof blitLayers === 'function') blitLayers(); // Composite and update 3D model
}

function generateUvWireframeCanvas() {
    const canvas = document.createElement('canvas');
    canvas.width = TEX_SIZE;
    canvas.height = TEX_SIZE;
    const ctx = canvas.getContext('2d');
    
    ctx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);
    
    const wireColor = window.wireframeColor || 0x00ff00;
    const r = (wireColor >> 16) & 255;
    const g = (wireColor >> 8) & 255;
    const b = wireColor & 255;
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.6)`;
    
    ctx.lineWidth = 1;
    
    if (!cube) return canvas;

    function drawLine(uvAttr, idx1, idx2) {
        const u1 = uvAttr.getX(idx1);
        const v1 = uvAttr.getY(idx1);
        const u2 = uvAttr.getX(idx2);
        const v2 = uvAttr.getY(idx2);
        
        ctx.moveTo(u1 * TEX_SIZE, (1 - v1) * TEX_SIZE);
        ctx.lineTo(u2 * TEX_SIZE, (1 - v2) * TEX_SIZE);
    }

    cube.traverse((child) => {
        if (child.isMesh && child.geometry) {
            const geo = child.geometry;
            const uvAttr = geo.attributes.uv;
            if (!uvAttr) return;

            const index = geo.index;
            ctx.beginPath();
            
            if (index) {
                for (let i = 0; i < index.count; i += 3) {
                    const a = index.getX(i);
                    const b = index.getX(i + 1);
                    const c = index.getX(i + 2);
                    
                    drawLine(uvAttr, a, b);
                    drawLine(uvAttr, b, c);
                    drawLine(uvAttr, c, a);
                }
            } else {
                for (let i = 0; i < uvAttr.count; i += 3) {
                    drawLine(uvAttr, i, i + 1);
                    drawLine(uvAttr, i + 1, i + 2);
                    drawLine(uvAttr, i + 2, i);
                }
            }
            ctx.stroke();
        }
    });
    
    return canvas;
}

window.generateUvWireframeCanvas = generateUvWireframeCanvas;

/// <summary>
/// Three.js Rendering Engine & Pointer Events
/// </summary>

function initThreeJS() {
    const container = document.getElementById('canvas-container');
    
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(2, 2, -3); // Ön-Sol-Üst (Front-Left-Top)

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.mouseButtons = {
        LEFT: null, // Sol tık döndürmeyi iptal et (sadece boyama yapacak)
        MIDDLE: THREE.MOUSE.PAN, // Orta tık (tekerlek) kaydıracak (Pan)
        RIGHT: THREE.MOUSE.ROTATE // Sağ tık döndürecek (Rotate)
    };

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(5, 5, 5);
    scene.add(dirLight);

    // Texture
    mainTexture = new THREE.CanvasTexture(mainCanvas);
    mainTexture.magFilter = THREE.NearestFilter;
    mainTexture.minFilter = THREE.NearestFilter;
    mainTexture.generateMipmaps = false;
    mainTexture.colorSpace = THREE.SRGBColorSpace;

    // Cube
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({ 
        map: mainTexture,
        transparent: true,
        alphaTest: 0.01
    });
    cube = new THREE.Mesh(geometry, material);
    scene.add(cube);
    
    // Axes Helper Group (Positive & Negative)
    axesHelper = new THREE.Group();
    
    const posAxes = new THREE.AxesHelper(5);
    const negAxes = new THREE.AxesHelper(5);
    
    negAxes.scale.set(-1, -1, -1);
    negAxes.material.transparent = true;
    negAxes.material.opacity = 0.3;
    
    axesHelper.add(posAxes);
    axesHelper.add(negAxes);

    // Blender Standard: Z is Up, Y is Depth
    axesHelper.rotation.x = -Math.PI / 2;
    axesHelper.visible = false;
    scene.add(axesHelper);

    // Ensure correct material is applied based on state
    applyMaterialMode();

    raycaster = new THREE.Raycaster();

    // Resize Handler
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

function initTools() {
    const container = document.getElementById('canvas-container');
    
    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
}

function onPointerDown(event) {
    if (event.button !== 0) return; // Sadece sol tık (0) veya dokunmatiğe izin ver

    if (document.activeElement && document.activeElement.tagName === 'INPUT' && document.activeElement.type === 'text') {
        document.activeElement.blur();
    }

    if (event.target !== renderer.domElement) return;
    
    const intersect = getIntersectionFromEvent(event);
    if (intersect && intersect.uv) {
        controls.enabled = false;
        isDrawing = true;
        if (currentTool === 'picker') {
            updatePickerPreview(intersect.uv);
        } else {
            if (currentTool === 'brush' || currentTool === 'eraser') {
                strokeCtx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);
                isStrokeActive = true;
                strokeDirtyRect = null;
            } else {
                isStrokeActive = false;
            }
            
            lastMouse = { x: event.clientX, y: event.clientY };
            applyTool(intersect.uv.x, intersect.uv.y);
        }
    }
}

function onPointerMove(event) {
    const intersect = getIntersectionFromEvent(event);
    
    if (intersect && intersect.uv) {
        if (currentTool === 'picker') {
            updatePickerPreview(intersect.uv);
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
            const currentMouse = { x: event.clientX, y: event.clientY };
            if (lastMouse) {
                const dx = currentMouse.x - lastMouse.x;
                const dy = currentMouse.y - lastMouse.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                
                const stampDist = 5; 
                const steps = Math.max(1, Math.floor(dist / stampDist));
                
                for (let i = 1; i <= steps; i++) {
                    const lerpX = lastMouse.x + dx * (i / steps);
                    const lerpY = lastMouse.y + dy * (i / steps);
                    
                    const synthIntersect = getIntersectionFromEvent({ clientX: lerpX, clientY: lerpY });
                    if (synthIntersect && synthIntersect.uv) {
                        applyTool(synthIntersect.uv.x, synthIntersect.uv.y);
                    }
                }
            } else {
                applyTool(intersect.uv.x, intersect.uv.y);
            }
            lastMouse = currentMouse;
        } else {
            lastMouse = null;
        }
    }
}

function onPointerUp(event) {
    if (isDrawing && currentTool === 'picker' && previewColor) {
        currentColor = previewColor;
        document.getElementById('color-picker').value = previewColor;
        currentTool = 'brush';
        document.querySelector('[data-tool="brush"]').click();
        document.getElementById('picker-preview').classList.add('hidden');
    }

    if (isDrawing && currentTool !== 'picker') {
        if (isStrokeActive) {
            // Commit stroke to active layer
            const activeLayer = layers[activeLayerIndex];
            const ctx = activeLayer.ctx;
            const settings = toolSettings[currentTool];
            const intensity = settings ? settings.intensity : 100;
            
            ctx.save();
            if (currentTool === 'eraser') {
                ctx.globalCompositeOperation = 'destination-out';
            } else {
                ctx.globalCompositeOperation = 'source-over';
            }
            ctx.globalAlpha = intensity / 100;
            
            if (strokeDirtyRect) {
                // Ensure dirty rect is clamped
                let dx = Math.floor(strokeDirtyRect.x);
                let dy = Math.floor(strokeDirtyRect.y);
                let dw = Math.ceil(strokeDirtyRect.w);
                let dh = Math.ceil(strokeDirtyRect.h);
                if (dx < 0) { dw += dx; dx = 0; }
                if (dy < 0) { dh += dy; dy = 0; }
                if (dx + dw > TEX_SIZE) dw = TEX_SIZE - dx;
                if (dy + dh > TEX_SIZE) dh = TEX_SIZE - dy;
                
                if (dw > 0 && dh > 0) {
                    ctx.drawImage(strokeCanvas, dx, dy, dw, dh, dx, dy, dw, dh);
                }
            } else {
                ctx.drawImage(strokeCanvas, 0, 0);
            }
            ctx.restore();
            
            isStrokeActive = false;
            strokeDirtyRect = null;
            blitLayers(); // Final render without the preview
        }
        
        triggerAutosave();
        HistoryManager.saveState();
    }

    isDrawing = false;
    controls.enabled = true;
    lastMouse = null;
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

function disposeObject(obj) {
    if (!obj) return;
    obj.traverse((child) => {
        if (child.isMesh) {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material.dispose();
                }
            }
        }
    });
}

function loadModelFromText(contents, skipSave = false) {
    const loader = new THREE.OBJLoader();
    const object = loader.parse(contents);
    currentModelText = contents;

    // Remove old cube
    if (cube) {
        scene.remove(cube);
        disposeObject(cube);
    }
    
    // Auto-center and scale
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3()).length();
    const center = box.getCenter(new THREE.Vector3());

    // Auto-center (Removed so axes match model's original 0,0,0)
    // object.position.x += (object.position.x - center.x);
    // object.position.y += (object.position.y - center.y);
    // object.position.z += (object.position.z - center.z);

    const targetSize = 2.0;
    const scale = size > 0 ? targetSize / size : 1;
    object.scale.set(scale, scale, scale);

    cube = object;
    scene.add(cube);
    applyMaterialMode();
    applyWireframeMode();
    if (!skipSave) triggerAutosave();
}

function applyMaterialMode() {
    if (!cube) return;

    // Clean up any remaining clones just in case
    const clonesToRemove = [];
    cube.traverse((child) => {
        if (child.userData.isBackMeshClone) clonesToRemove.push(child);
    });
    clonesToRemove.forEach(c => {
        if (c.material) c.material.dispose();
        c.parent.remove(c);
    });

    let sideSetting = THREE.FrontSide;
    if (cullMode === 1) sideSetting = THREE.BackSide;
    else if (cullMode === 2) sideSetting = THREE.DoubleSide;

    let baseMaterial;
    if (isLitMode) {
        baseMaterial = new THREE.MeshStandardMaterial({ 
            map: mainTexture, transparent: false, side: sideSetting
        });
    } else {
        baseMaterial = new THREE.MeshBasicMaterial({ 
            map: mainTexture, transparent: false, side: sideSetting
        });
    }

    cube.traverse((child) => {
        if (child.isMesh && !child.userData.isWireframeHelper) {
            const hadWireframe = child.material && child.material.wireframe;
            let mat = baseMaterial.clone();
            mat.wireframe = hadWireframe;
            
            if (child.material && child.material.dispose) child.material.dispose();
            child.material = mat;
        }
    });
}


function applyWireframeMode() {
    if (!cube) return;

    cube.traverse((child) => {
        if (child.isMesh && child.material && !child.userData.isBackMeshClone) {
            const helpers = child.children.filter(c => c.isLineSegments && c.userData.isWireframeHelper);
            helpers.forEach(h => {
                child.remove(h);
                if (h.geometry) h.geometry.dispose();
                if (h.material) h.material.dispose();
            });

            if (wireframeMode === 0) {
                child.material.wireframe = false;
            } else if (wireframeMode === 1) {
                child.material.wireframe = true;
            } else if (wireframeMode === 2) {
                child.material.wireframe = false;
                
                const wireframeGeometry = new THREE.WireframeGeometry(child.geometry);
                const wireframeMaterial = new THREE.LineBasicMaterial({
                    color: 0x00ff00,
                    depthTest: true,
                    opacity: 0.5,
                    transparent: true
                });
                const line = new THREE.LineSegments(wireframeGeometry, wireframeMaterial);
                line.userData.isWireframeHelper = true;
                child.add(line);
            }
        }
    });
}

function applyTool(uvX, uvY) {
    const activeLayer = layers[activeLayerIndex];
    const targetCtx = isStrokeActive ? strokeCtx : activeLayer.ctx;

    const x = uvX * TEX_SIZE;
    const y = (1 - uvY) * TEX_SIZE;

    let dirtyRect = null;
    const settings = toolSettings[currentTool];
    const sSize = settings ? settings.size : 50;
    const sInt = settings ? settings.intensity : 50;
    const sHard = settings ? settings.hardness : 50;

    if (window.PaintTools && window.PaintTools[currentTool]) {
        if (currentTool === 'brush') {
            dirtyRect = window.PaintTools['brush'](targetCtx, x, y, sSize, 100, sHard, currentColor);
        } else if (currentTool === 'eraser') {
            dirtyRect = window.PaintTools['eraser'](targetCtx, x, y, sSize, 100, sHard);
        } else if (currentTool === 'blur') {
            dirtyRect = window.PaintTools['blur'](targetCtx, x, y, sSize, sInt, sHard, activeLayer.canvas);
        } else if (currentTool === 'smear') {
            dirtyRect = window.PaintTools['smear'](targetCtx, x, y, sSize, sInt, sHard, activeLayer.canvas);
        }
    }
    
    if (isStrokeActive && dirtyRect) {
        if (!strokeDirtyRect) {
            strokeDirtyRect = { ...dirtyRect };
        } else {
            const minX = Math.min(strokeDirtyRect.x, dirtyRect.x);
            const minY = Math.min(strokeDirtyRect.y, dirtyRect.y);
            const maxX = Math.max(strokeDirtyRect.x + strokeDirtyRect.w, dirtyRect.x + dirtyRect.w);
            const maxY = Math.max(strokeDirtyRect.y + strokeDirtyRect.h, dirtyRect.y + dirtyRect.h);
            strokeDirtyRect = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
        }
    }

    blitLayers(isStrokeActive ? strokeDirtyRect : dirtyRect);
}

function generateUvWireframeCanvas() {
    const canvas = document.createElement('canvas');
    canvas.width = TEX_SIZE;
    canvas.height = TEX_SIZE;
    const ctx = canvas.getContext('2d');
    
    ctx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.6)';
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

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}


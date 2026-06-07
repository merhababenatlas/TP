/// <summary>
/// Three.js Rendering Engine & Pointer Events
/// </summary>

function initThreeJS() {
    const container = document.getElementById('canvas-container');
    
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(2, 2, -3); // Ön-Sol-Üst (Front-Left-Top)

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.autoClear = false; // CRITICAL: Prevent auto-clearing during layer composition and brushing!
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

    // --- WebGL Painting Initialization ---
    paintScene = new THREE.Scene();
    paintCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    
    tempRT = new THREE.WebGLRenderTarget(TEX_SIZE, TEX_SIZE, {
        minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
        format: THREE.RGBAFormat, type: THREE.HalfFloatType, colorSpace: THREE.SRGBColorSpace, depthBuffer: false
    });

    paintMaterial = new THREE.ShaderMaterial({
        vertexShader: window.PaintShaders.vertexShader,
        fragmentShader: window.PaintShaders.compositeFragmentShader,
        uniforms: {
            tLayer: { value: null },
            uOpacity: { value: 1.0 }
        },
        transparent: true,
        blending: THREE.NormalBlending
    });
    
    brushMaterial = new THREE.ShaderMaterial({
        vertexShader: window.PaintShaders.vertexShader,
        fragmentShader: window.PaintShaders.brushFragmentShader,
        uniforms: {
            uCenter: { value: new THREE.Vector2(0.5, 0.5) },
            uRadius: { value: 0.1 },
            uColor: { value: new THREE.Color() },
            uIntensity: { value: 1.0 },
            uHardness: { value: 0.5 }
        },
        transparent: true,
        blending: THREE.NormalBlending
    });
    
    blurMaterial = new THREE.ShaderMaterial({
        vertexShader: window.PaintShaders.vertexShader,
        fragmentShader: window.PaintShaders.blurFragmentShader,
        uniforms: {
            tDiffuse: { value: null },
            uCenter: { value: new THREE.Vector2(0.5, 0.5) },
            uRadius: { value: 0.1 },
            uIntensity: { value: 1.0 },
            uHardness: { value: 0.5 },
            uTexSize: { value: TEX_SIZE }
        }
    });

    smearMaterial = new THREE.ShaderMaterial({
        vertexShader: window.PaintShaders.vertexShader,
        fragmentShader: window.PaintShaders.smearFragmentShader,
        uniforms: {
            tDiffuse: { value: null },
            uCenter: { value: new THREE.Vector2(0.5, 0.5) },
            uRadius: { value: 0.1 },
            uIntensity: { value: 1.0 },
            uHardness: { value: 0.5 },
            uDirection: { value: new THREE.Vector2(0, 0) }
        }
    });

    const paintQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), paintMaterial);
    paintScene.add(paintQuad);

    // Cube Material Initialization (map will be set by LayerManager)
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({ 
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
    const handleResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    };
    
    window.addEventListener('resize', handleResize);
    
    // Mobil cihazlarda ekran döndürmeyi algılamak için
    window.addEventListener('orientationchange', () => {
        // Ekran döndürüldüğünde boyutların güncellenmesi biraz zaman alabilir
        setTimeout(handleResize, 100);
        setTimeout(handleResize, 300);
        setTimeout(handleResize, 600);
    });
}

function initTools() {
    const container = document.getElementById('canvas-container');
    
    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
}

function onPointerDown(event) {
    if (window.NetworkManager && window.NetworkManager.isHost) return; // Host modunda boyama kapalı
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
            isStrokeActive = true;
            
            lastMouse = { x: event.clientX, y: event.clientY };
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
                    
                    const synthIntersect = getIntersectionFromEvent({ clientX: lerpX, clientY: lerpY });
                    if (synthIntersect && synthIntersect.uv) {
                        applyTool(synthIntersect.uv.x, synthIntersect.uv.y, oldUvPosition.x, oldUvPosition.y);
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
        blitLayers(); // Final blend
        
        triggerAutosave();
        HistoryManager.saveState();
    }

    isDrawing = false;
    controls.enabled = true;
    lastMouse = null;
    lastUvPosition = null;
}

function commitStroke() {
    // Obsolete in WebGL Flow architecture, as we draw directly to activeLayer.rt
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
    const currentMap = mainRT ? mainRT.texture : null;
    
    if (isLitMode) {
        baseMaterial = new THREE.MeshStandardMaterial({ 
            map: currentMap, transparent: false, side: sideSetting
        });
    } else {
        baseMaterial = new THREE.MeshBasicMaterial({ 
            map: currentMap, transparent: false, side: sideSetting
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
        // We don't need to restore blending since we always set it explicitly above
        
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
    blitLayers(); // Composite and update 3D model
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

let fpsLimit = 30; // 0 = Sınırsız, default 30
let fpsClock = new THREE.Clock();
let fpsDelta = 0;

window.setFPSLimit = function(limit) {
    fpsLimit = limit;
};

function animate() {
    requestAnimationFrame(animate);
    
    if (fpsLimit > 0) {
        fpsDelta += fpsClock.getDelta();
        const interval = 1 / fpsLimit;
        
        if (fpsDelta > interval) {
            controls.update();
            renderer.setRenderTarget(null);
            renderer.clear();
            renderer.render(scene, camera);
            
            // Eğer çok uzun süre donduysa delta'yı sıfırla ki hızlanma yapmasın
            if (fpsDelta > interval * 3) fpsDelta = interval;
            fpsDelta -= interval;
        }
    } else {
        fpsClock.getDelta(); // Sınırsızken bile clock'u temizle
        controls.update();
        renderer.setRenderTarget(null);
        renderer.clear();
        renderer.render(scene, camera);
    }
}


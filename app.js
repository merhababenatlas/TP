/// <summary>
/// 3D Texture Painter Application Logic
/// </summary>

// Core Constants
const TEX_SIZE = 1024;
const MAX_LAYERS = 5;

// State Variables
let currentTool = 'brush';
let currentSize = 10;
let currentIntensity = 100;
let currentHardness = 100;
let currentColor = '#ffffff';
let activeLayerIndex = 0;
let isUIVisible = true;

// Layer Data Structure
const layers = [];
let mainCanvas, mainCtx, mainTexture;

// Three.js Variables
let scene, camera, renderer, cube, controls, raycaster, brushCursor;

// Pointer State
let isDrawing = false;
let lastMouse = null;
let previewColor = null;

// Global State
let wireframeMode = 0; // 0 = Off, 1 = Lines, 2 = Overlay
let targetLayerIndexForImage = -1;

// Initialize Application
function init() {
    initUI();
    initLayers();
    initThreeJS();
    initTools();
    registerServiceWorker();
    
    // Initial Blit
    blitLayers();
    animate();
}

function initUI() {
    // UI Toggles
    const btnToggleUI = document.getElementById('btn-toggle-ui');
    const leftPanel = document.getElementById('left-panel');
    const rightPanel = document.getElementById('right-panel');

    btnToggleUI.addEventListener('click', () => {
        isUIVisible = !isUIVisible;
        if (isUIVisible) {
            leftPanel.classList.remove('hidden');
            rightPanel.classList.remove('hidden');
            btnToggleUI.innerText = '👁 Gizle';
        } else {
            leftPanel.classList.add('hidden');
            rightPanel.classList.add('hidden');
            btnToggleUI.innerText = '👁 Göster';
        }
    });

    // Texture Preview Close
    const previewOverlay = document.getElementById('texture-preview-overlay');
    document.getElementById('btn-close-preview').addEventListener('click', () => {
        previewOverlay.classList.add('hidden');
    });
    previewOverlay.addEventListener('click', (e) => {
        if (e.target === previewOverlay) {
            previewOverlay.classList.add('hidden');
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
        reader.onload = function(event) {
            const contents = event.target.result;
            loadModelFromText(contents);
        };
        reader.readAsText(file);
        
        e.target.value = '';
    });

    // Import Image to Layer
    const fileImportImage = document.getElementById('file-import-image');
    fileImportImage.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file || targetLayerIndexForImage === -1) return;

        const reader = new FileReader();
        reader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
                const ctx = layers[targetLayerIndexForImage].ctx;
                ctx.globalCompositeOperation = 'source-over';
                ctx.drawImage(img, 0, 0, TEX_SIZE, TEX_SIZE);
                blitLayers();
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
        
        e.target.value = '';
    });

    // Export Button
    document.getElementById('btn-export').addEventListener('click', () => {
        const link = document.createElement('a');
        link.download = 'texture.png';
        link.href = mainCanvas.toDataURL();
        link.click();
    });

    // Tool Selection
    const toolBtns = document.querySelectorAll('.tool-btn');
    toolBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            toolBtns.forEach(b => b.classList.remove('active'));
            const target = e.currentTarget;
            target.classList.add('active');
            currentTool = target.dataset.tool;
        });
    });

    // Inputs
    // Tool Size Slider
    document.getElementById('size-slider').addEventListener('input', (e) => {
        currentSize = parseInt(e.target.value, 10);
    });

    // Tool Intensity Slider
    document.getElementById('intensity-slider').addEventListener('input', (e) => {
        currentIntensity = parseInt(e.target.value, 10);
    });

    // Tool Hardness Slider
    document.getElementById('hardness-slider').addEventListener('input', (e) => {
        currentHardness = parseInt(e.target.value, 10);
    });

    // Color Picker
    const colorPicker = document.getElementById('color-picker');
    colorPicker.addEventListener('input', (e) => { currentColor = e.target.value; });
}

function initLayers() {
    const layerListEl = document.getElementById('layer-list');
    
    // Create Main Canvas
    mainCanvas = document.createElement('canvas');
    mainCanvas.width = TEX_SIZE;
    mainCanvas.height = TEX_SIZE;
    mainCtx = mainCanvas.getContext('2d', { willReadFrequently: true });

    // Create 5 Layers
    for (let i = 0; i < MAX_LAYERS; i++) {
        const canvas = document.createElement('canvas');
        canvas.width = TEX_SIZE;
        canvas.height = TEX_SIZE;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        // Layer 1 default color
        if (i === 0) {
            ctx.fillStyle = '#e0e0e0';
            ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
        }

        const layerObj = {
            id: i,
            canvas: canvas,
            ctx: ctx,
            isVisible: true,
            opacity: 100,
            name: `Katman ${i + 1}`
        };
        layers.push(layerObj);

        // UI for Layer
        const itemEl = document.createElement('div');
        itemEl.className = 'layer-item';
        if (i === 0) itemEl.classList.add('active');
        itemEl.dataset.id = i;

        const visBtn = document.createElement('button');
        visBtn.className = 'layer-visibility';
        visBtn.innerText = '👁';
        visBtn.title = 'Görünürlük';
        visBtn.onclick = (e) => {
            e.stopPropagation();
            layerObj.isVisible = !layerObj.isVisible;
            visBtn.style.opacity = layerObj.isVisible ? '1' : '0.3';
            blitLayers();
        };

        const previewBtn = document.createElement('button');
        previewBtn.className = 'layer-preview-btn';
        previewBtn.innerText = '🖼';
        previewBtn.title = 'Doku Önizleme';
        previewBtn.onclick = (e) => {
            e.stopPropagation();
            const overlay = document.getElementById('texture-preview-overlay');
            const img = document.getElementById('texture-preview-image');
            img.src = layerObj.canvas.toDataURL('image/png');
            overlay.classList.remove('hidden');
        };

        const importBtn = document.createElement('button');
        importBtn.className = 'layer-import-btn';
        importBtn.innerText = '📥';
        importBtn.title = 'Resim Yükle';
        importBtn.onclick = (e) => {
            e.stopPropagation();
            targetLayerIndexForImage = i;
            document.getElementById('file-import-image').click();
        };

        const nameEl = document.createElement('span');
        nameEl.className = 'layer-name';
        nameEl.innerText = layerObj.name;

        itemEl.appendChild(visBtn);
        itemEl.appendChild(previewBtn);
        itemEl.appendChild(importBtn);
        itemEl.appendChild(nameEl);
        itemEl.onclick = () => { selectLayer(i); };

        layerListEl.appendChild(itemEl);
    }

    // Layer Controls
    const opacitySlider = document.getElementById('opacity-slider');
    opacitySlider.addEventListener('input', (e) => {
        layers[activeLayerIndex].opacity = parseInt(e.target.value);
        blitLayers();
    });

    document.getElementById('btn-add-layer').addEventListener('click', () => {
        alert('Maksimum 5 katman limiti.');
    });
    
    document.getElementById('btn-delete-layer').addEventListener('click', () => {
        const ctx = layers[activeLayerIndex].ctx;
        ctx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);
        if(activeLayerIndex === 0) {
            ctx.fillStyle = '#e0e0e0';
            ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
        }
        blitLayers();
    });
}

function selectLayer(index) {
    activeLayerIndex = index;
    const items = document.querySelectorAll('.layer-item');
    items.forEach(el => el.classList.remove('active'));
    // Since we appended normally and CSS handles reverse order, DOM index corresponds to array index
    items[index].classList.add('active');
    
    const opacitySlider = document.getElementById('opacity-slider');
    opacitySlider.value = layers[index].opacity;
}

function blitLayers() {
    mainCtx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);
    
    for (let i = 0; i < layers.length; i++) {
        const layer = layers[i];
        if (layer.isVisible) {
            mainCtx.globalAlpha = layer.opacity / 100;
            mainCtx.drawImage(layer.canvas, 0, 0);
        }
    }
    mainCtx.globalAlpha = 1.0;

    if (mainTexture) {
        mainTexture.needsUpdate = true;
    }
}

function initThreeJS() {
    const container = document.getElementById('canvas-container');
    
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.z = 3;

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(5, 5, 5);
    scene.add(dirLight);

    // Texture
    mainTexture = new THREE.CanvasTexture(mainCanvas);
    mainTexture.magFilter = THREE.NearestFilter;

    // Cube
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({ map: mainTexture });
    cube = new THREE.Mesh(geometry, material);
    scene.add(cube);

    raycaster = new THREE.Raycaster();

    // Resize Handler
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Brush Cursor
    const cursorGeo = new THREE.RingGeometry(0.85, 1.0, 32);
    const cursorMat = new THREE.MeshBasicMaterial({ 
        color: 0xffffff, 
        side: THREE.DoubleSide, 
        transparent: true, 
        opacity: 0.8,
        depthTest: false
    });
    brushCursor = new THREE.Mesh(cursorGeo, cursorMat);
    brushCursor.visible = false;
    scene.add(brushCursor);
}

function initTools() {
    const container = document.getElementById('canvas-container');
    
    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
}

    function onPointerDown(event) {
    if (event.target !== renderer.domElement) return;
    
    const intersect = getIntersectionFromEvent(event);
    if (intersect) {
        controls.enabled = false;
        isDrawing = true;
        updateBrushCursor(intersect);
        if (currentTool === 'picker') {
            updatePickerPreview(intersect.uv);
        } else {
            lastMouse = { x: event.clientX, y: event.clientY };
            applyTool(intersect.uv.x, intersect.uv.y);
        }
    }
}

function onPointerMove(event) {
    const intersect = getIntersectionFromEvent(event);
    
    if (intersect) {
        updateBrushCursor(intersect);
        if (currentTool === 'picker') {
            updatePickerPreview(intersect.uv);
        } else {
            const preview = document.getElementById('picker-preview');
            if (preview) preview.classList.add('hidden');
        }
    } else {
        brushCursor.visible = false;
        const preview = document.getElementById('picker-preview');
        if (preview) preview.classList.add('hidden');
    }

    if (!isDrawing) return;
    
    if (currentTool !== 'picker') {
        if (intersect) {
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
                    if (synthIntersect) {
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

    isDrawing = false;
    controls.enabled = true;
    lastMouse = null;
}

function updateBrushCursor(intersect) {
    brushCursor.visible = true;
    brushCursor.position.copy(intersect.point);
    
    if (intersect.face) {
        const normalMatrix = new THREE.Matrix3().getNormalMatrix(intersect.object.matrixWorld);
        const worldNormal = intersect.face.normal.clone().applyMatrix3(normalMatrix).normalize();
        brushCursor.lookAt(intersect.point.clone().add(worldNormal));
    }

    const scale = (currentSize / 100) * 0.5;
    brushCursor.scale.set(scale, scale, scale);
    
    if (currentTool === 'eraser') {
        brushCursor.material.color.setHex(0xff0000);
    } else if (currentTool === 'picker') {
        brushCursor.material.color.setHex(0x00ff00);
    } else if (currentTool === 'blur' || currentTool === 'smudge') {
        brushCursor.material.color.setHex(0x00aaff);
    } else {
        brushCursor.material.color.set(currentColor);
    }
}

function updatePickerPreview(uv) {
    const x = Math.floor(uv.x * TEX_SIZE);
    const y = Math.floor((1 - uv.y) * TEX_SIZE);
    const pixel = mainCtx.getImageData(x, y, 1, 1).data;
    const hex = rgbToHex(pixel[0], pixel[1], pixel[2]);
    previewColor = hex;
    
    const preview = document.getElementById('picker-preview');
    preview.style.backgroundColor = hex;
    preview.classList.remove('hidden');
}

function getIntersectionFromEvent(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const mouse = new THREE.Vector2(x, y);
    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObject(cube, true);
    if (intersects.length > 0) {
        return intersects[0];
    }
    return null;
}

function loadModelFromText(text) {
    const loader = new THREE.OBJLoader();
    const object = loader.parse(text);

    // Remove old cube
    if (cube) {
        scene.remove(cube);
    }

    // Apply texture
    const material = new THREE.MeshStandardMaterial({ map: mainTexture });
    object.traverse(function (child) {
        if (child.isMesh) {
            child.material = material;
        }
    });

    // Auto-center and scale
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3()).length();
    const center = box.getCenter(new THREE.Vector3());

    object.position.x += (object.position.x - center.x);
    object.position.y += (object.position.y - center.y);
    object.position.z += (object.position.z - center.z);

    const targetSize = 2.0;
    const scale = size > 0 ? targetSize / size : 1;
    object.scale.set(scale, scale, scale);

    cube = object;
    scene.add(cube);
    applyWireframeMode();
}

function applyWireframeMode() {
    if (!cube) return;

    cube.traverse((child) => {
        if (child.isMesh && child.material) {
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

function getRadialGradient(ctx, x, y, radius, colorHex, hardness) {
    const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
    
    let r=0, g=0, b=0, a=1;
    if (colorHex.startsWith('rgba')) {
        const parts = colorHex.substring(5, colorHex.length-1).split(',');
        r = parseInt(parts[0].trim()); 
        g = parseInt(parts[1].trim()); 
        b = parseInt(parts[2].trim()); 
        a = parseFloat(parts[3].trim());
    } else {
        const color = new THREE.Color(colorHex);
        r = Math.floor(color.r * 255);
        g = Math.floor(color.g * 255);
        b = Math.floor(color.b * 255);
    }

    const stopPoint = Math.max(0.001, hardness / 100);
    
    grad.addColorStop(0, `rgba(${r},${g},${b},${a})`);
    if (stopPoint < 1) {
        grad.addColorStop(stopPoint, `rgba(${r},${g},${b},${a})`);
    }
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    
    return grad;
}

function applyTool(uvX, uvY) {
    const activeLayer = layers[activeLayerIndex];
    const ctx = activeLayer.ctx;

    const x = uvX * TEX_SIZE;
    const y = (1 - uvY) * TEX_SIZE;
    const radius = currentSize / 2;
    const intensityAlpha = currentIntensity / 100;

    if (currentTool === 'brush') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = intensityAlpha;
        ctx.fillStyle = getRadialGradient(ctx, x, y, radius, currentColor, currentHardness);
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
        blitLayers();
    } else if (currentTool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.globalAlpha = intensityAlpha;
        ctx.fillStyle = getRadialGradient(ctx, x, y, radius, 'rgba(0,0,0,1)', currentHardness);
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
        blitLayers();
    } else if (currentTool === 'blur' || currentTool === 'smudge') {
        if (!window.tempStampCanvas) {
            window.tempStampCanvas = document.createElement('canvas');
            window.tempStampCtx = window.tempStampCanvas.getContext('2d');
        }
        
        const sSize = currentSize + 10;
        window.tempStampCanvas.width = sSize;
        window.tempStampCanvas.height = sSize;
        const tCtx = window.tempStampCtx;
        
        const cx = sSize / 2;
        const cy = sSize / 2;
        
        const shiftScale = (currentIntensity / 50); // up to 2x random shift
        const shiftX = (Math.random() * 4 - 2) * shiftScale;
        const shiftY = (Math.random() * 4 - 2) * shiftScale;
        
        const sourceCanvas = currentTool === 'blur' ? activeLayer.canvas : mainCanvas;
        
        tCtx.drawImage(
            sourceCanvas, 
            x - cx - shiftX, y - cy - shiftY, sSize, sSize,
            0, 0, sSize, sSize
        );
        
        tCtx.globalCompositeOperation = 'destination-in';
        tCtx.fillStyle = getRadialGradient(tCtx, cx, cy, radius, 'rgba(0,0,0,1)', currentHardness);
        tCtx.beginPath();
        tCtx.arc(cx, cy, radius, 0, Math.PI * 2);
        tCtx.fill();
        
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = (currentTool === 'blur' ? 0.4 : 0.8) * intensityAlpha;
        ctx.drawImage(window.tempStampCanvas, x - cx, y - cy);
        
        ctx.globalAlpha = 1.0;
        blitLayers();
    }
}

function rgbToHex(r, g, b) {
    return "#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1);
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('SW Registered', reg))
            .catch(err => console.error('SW Error', err));
    }
}

window.onload = init;

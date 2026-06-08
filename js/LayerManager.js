/// <summary>
/// WebGL Layer Management
/// </summary>

let mainRT = null; // The final merged WebGLRenderTarget

window.syncLayersToHost = function() {
    if (window.NetworkManager && window.NetworkManager.conn && !window.NetworkManager.isHost) {
        const meta = layers.map((l, index) => ({
            id: l.id,
            name: l.name,
            opacity: l.opacity,
            isVisible: l.isVisible,
            isActive: (index === activeLayerIndex)
        }));
        window.NetworkManager.sendMessage('SYNC_LAYERS_META', { layers: meta });
    }
};

function renderImageToRT(img, rt) {
    if (!renderer || !paintScene) return;
    const tex = new THREE.Texture(img);
    tex.needsUpdate = true;
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    
    const oldTarget = renderer.getRenderTarget();
    
    if (paintScene && paintScene.children.length > 0) {
        paintScene.children[0].material = paintMaterial;
    }
    
    renderer.setRenderTarget(rt);

    paintMaterial.uniforms.tLayer.value = tex;
    paintMaterial.uniforms.uOpacity.value = 1.0;
    paintMaterial.blending = THREE.NoBlending; // Replace existing contents
    renderer.render(paintScene, paintCamera);
    paintMaterial.blending = THREE.NormalBlending;
    renderer.setRenderTarget(oldTarget);
    
    tex.dispose();
}

function createLayerObj(savedLayer = null, isFirst = false) {
    return new Promise((resolve) => {
        const rt = new THREE.WebGLRenderTarget(TEX_SIZE, TEX_SIZE, {
            minFilter: THREE.NearestFilter,
            magFilter: THREE.NearestFilter,
            format: THREE.RGBAFormat,
            type: THREE.HalfFloatType,
            depthBuffer: false,
            stencilBuffer: false
        });

        const finish = (layer) => {
            if (layer.id >= layerIdCounter) layerIdCounter = layer.id + 1;
            resolve(layer);
        };

        if (savedLayer && savedLayer.imageData) {
            // Load image data into RenderTarget
            const img = new Image();
            img.onload = () => {
                renderImageToRT(img, rt);
                blitLayers();
                
                finish({
                    id: savedLayer.id,
                    name: savedLayer.name || 'Layer',
                    opacity: savedLayer.opacity !== undefined ? savedLayer.opacity : 100,
                    isVisible: savedLayer.isVisible !== undefined ? savedLayer.isVisible : true,
                    rt: rt
                });
            };
            img.onerror = () => {
                console.error("Failed to load layer image data");
                finish({
                    id: savedLayer.id,
                    name: savedLayer.name || 'Layer',
                    opacity: savedLayer.opacity !== undefined ? savedLayer.opacity : 100,
                    isVisible: savedLayer.isVisible !== undefined ? savedLayer.isVisible : true,
                    rt: rt
                });
            };
            img.src = savedLayer.imageData;
        } else {
            if (isFirst) {
                // Transparent clear
                const oldTarget = renderer.getRenderTarget();
                
                if (paintScene && paintScene.children.length > 0) {
                    paintScene.children[0].material = paintMaterial;
                }
                
                renderer.setRenderTarget(rt);
                renderer.clear();
                renderer.setRenderTarget(oldTarget);
            }
            
            finish({
                id: savedLayer ? savedLayer.id : layerIdCounter,
                name: savedLayer ? savedLayer.name : `Katman ${layers.length + 1}`,
                opacity: savedLayer && savedLayer.opacity !== undefined ? savedLayer.opacity : 100,
                isVisible: savedLayer && savedLayer.isVisible !== undefined ? savedLayer.isVisible : true,
                rt: rt
            });
        }
    });
}

function getLayerPreviewDataUrl(layerObj) {
    if (!renderer || !paintScene) return '';
    const width = TEX_SIZE;
    const height = TEX_SIZE;
    const temp8BitRT = new THREE.WebGLRenderTarget(width, height, { format: THREE.RGBAFormat, type: THREE.UnsignedByteType });
    
    const oldTarget = renderer.getRenderTarget();
    
    if (paintScene && paintScene.children.length > 0) {
        paintScene.children[0].material = paintMaterial;
    }
    
    renderer.setRenderTarget(temp8BitRT);
    renderer.clear(); // Ensure transparent background
    
    // If it's a layer, draw it using NoBlending directly to copy colors and alpha

    paintMaterial.uniforms.tLayer.value = layerObj.rt.texture;
    paintMaterial.uniforms.uOpacity.value = 1.0;
    paintMaterial.blending = THREE.NoBlending;
    renderer.render(paintScene, paintCamera);
    paintMaterial.blending = THREE.NormalBlending; // Restore
    
    const pixels = new Uint8Array(width * height * 4);
    renderer.readRenderTargetPixels(temp8BitRT, 0, 0, width, height, pixels);
    renderer.setRenderTarget(oldTarget);
    temp8BitRT.dispose();
    
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(width, height);
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const srcIdx = (y * width + x) * 4;
            const dstIdx = ((height - 1 - y) * width + x) * 4;
            imgData.data[dstIdx] = pixels[srcIdx];
            imgData.data[dstIdx+1] = pixels[srcIdx+1];
            imgData.data[dstIdx+2] = pixels[srcIdx+2];
            imgData.data[dstIdx+3] = pixels[srcIdx+3];
        }
    }
    ctx.putImageData(imgData, 0, 0);
    return canvas.toDataURL('image/png');
}

async function initLayers(savedLayersData = null) {
    const layerListEl = document.getElementById('layer-list');
    layerListEl.innerHTML = '';
    
    if (!mainRT) {
        mainRT = new THREE.WebGLRenderTarget(TEX_SIZE, TEX_SIZE, {
            minFilter: THREE.NearestFilter,
            magFilter: THREE.NearestFilter,
            format: THREE.RGBAFormat,
            type: THREE.HalfFloatType,
            depthBuffer: false,
            stencilBuffer: false
        });
    }
    
    layers.forEach(l => l.rt.dispose());
    layers.length = 0;
    activeLayerIndex = 0;

    if (savedLayersData && savedLayersData.length > 0) {
        for (let i = 0; i < savedLayersData.length; i++) {
            const layerObj = await createLayerObj(savedLayersData[i], false);
            layers.push(layerObj);
            window.LayerUIManager.addLayerToUI(layerObj);
        }
        layerIdCounter = Math.max(...layers.map(l => l.id)) + 1;
        selectLayer(0);
    } else {
        const layerObj = await createLayerObj(null, true);
        layers.push(layerObj);
        window.LayerUIManager.addLayerToUI(layerObj);
        layerIdCounter = 1;
        selectLayer(0);
    }
}

function selectLayer(index) {
    activeLayerIndex = index;
    const items = document.querySelectorAll('.layer-item');
    items.forEach(el => el.classList.remove('active'));
    if (items[index]) items[index].classList.add('active');
}

function blitLayers() {
    if (!paintScene || !paintCamera || !mainRT) return;
    
    // Ensure paintQuad is using paintMaterial for full-screen compositing
    if (paintScene.children.length > 0) {
        paintScene.children[0].material = paintMaterial;
    }

    const oldTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(mainRT);
    renderer.clear();
    
    // Render checkerboard background
    if (typeof checkerTexture !== 'undefined' && checkerTexture.image) {
    
        paintMaterial.uniforms.tLayer.value = checkerTexture;
        paintMaterial.uniforms.uOpacity.value = 1.0;
        paintMaterial.blending = THREE.NoBlending;
        renderer.render(paintScene, paintCamera);
    } else {
        // Fallback white background
        renderer.setClearColor(0xffffff, 1);
        renderer.clear();
        renderer.setClearColor(0x000000, 0); // Reset
    }
    
    // Render each visible layer
    for (let i = 0; i < layers.length; i++) {
        const l = layers[i];
        if (!l.isVisible) continue;
        
     
        paintMaterial.uniforms.tLayer.value = l.rt.texture;
        paintMaterial.uniforms.uOpacity.value = l.opacity / 100.0;
        
        paintMaterial.blending = THREE.CustomBlending;
        paintMaterial.blendEquation = THREE.AddEquation;
        paintMaterial.blendSrc = THREE.OneFactor;
        paintMaterial.blendDst = THREE.OneMinusSrcAlphaFactor;
        paintMaterial.blendSrcAlpha = THREE.OneFactor;
        paintMaterial.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
        paintMaterial.transparent = true;
        
        renderer.render(paintScene, paintCamera);
    }
    
    renderer.setRenderTarget(oldTarget);
    
    if (cube) {
        cube.traverse((child) => {
            if (child.isMesh && child.material && !child.userData.isWireframeHelper) {
                if (child.material.map !== mainRT.texture) {
                    child.material.map = mainRT.texture;
                    child.material.needsUpdate = true;
                }
            }
        });
    }
}

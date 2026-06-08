function cloneRenderTarget(sourceRT) {
    const targetRT = new THREE.WebGLRenderTarget(TEX_SIZE, TEX_SIZE, {
        minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
        format: THREE.RGBAFormat, type: THREE.HalfFloatType, depthBuffer: false
    });
    const oldTarget = renderer.getRenderTarget();
    
    if (paintScene && paintScene.children.length > 0) {
        paintScene.children[0].material = paintMaterial;
    }
    
    renderer.setRenderTarget(targetRT);
    renderer.clear();

    paintMaterial.uniforms.tLayer.value = sourceRT.texture;
    paintMaterial.uniforms.uOpacity.value = 1.0;
    paintMaterial.blending = THREE.NoBlending;
    renderer.render(paintScene, paintCamera);
    paintMaterial.blending = THREE.NormalBlending;
    renderer.setRenderTarget(oldTarget);
    return targetRT;
}

const HistoryManager = {
    states: [],
    currentIndex: -1,
    maxStates: 20,

    saveState: function() {
        if (!renderer || !paintScene) return; // Not fully initialized yet

        if (this.currentIndex < this.states.length - 1) {
            const removedStates = this.states.slice(this.currentIndex + 1);
            removedStates.forEach(s => s.layers.forEach(l => l.rt.dispose()));
            this.states = this.states.slice(0, this.currentIndex + 1);
        }

        const state = {
            activeLayerIndex: activeLayerIndex,
            layers: layers.map(l => ({
                id: l.id,
                name: l.name,
                opacity: l.opacity,
                isVisible: l.isVisible,
                rt: cloneRenderTarget(l.rt)
            }))
        };

        this.states.push(state);
        if (this.states.length > this.maxStates) {
            const discarded = this.states.shift();
            discarded.layers.forEach(l => l.rt.dispose());
        } else {
            this.currentIndex++;
        }
        this.updateUI();
    },

    undo: function() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.restoreState(this.states[this.currentIndex]);
        } else {
            console.log("Undo: No more history");
        }
        this.updateUI();
    },

    redo: function() {
        if (this.currentIndex < this.states.length - 1) {
            this.currentIndex++;
            this.restoreState(this.states[this.currentIndex]);
        } else {
            console.log("Redo: No more future states. Current index:", this.currentIndex, "States:", this.states.length);
        }
        this.updateUI();
    },

    updateUI: function() {
        const undoCount = document.getElementById('undo-count');
        const redoCount = document.getElementById('redo-count');
        
        if (undoCount && redoCount) {
            const undoSteps = Math.max(0, this.currentIndex);
            const redoSteps = Math.max(0, this.states.length - 1 - this.currentIndex);
            
            undoCount.innerText = undoSteps > 0 ? undoSteps : '';
            redoCount.innerText = redoSteps > 0 ? redoSteps : '';
        }
    },

    restoreState: function(state) {
        // Preserve current UI state (opacity, name, visibility) so they aren't undone
        const currentLayerData = {};
        layers.forEach(l => {
            currentLayerData[l.id] = {
                opacity: l.opacity,
                name: l.name,
                isVisible: l.isVisible
            };
        });

        // Clear DOM and Arrays
        const layerListEl = document.getElementById('layer-list');
        layerListEl.innerHTML = '';
        
        layers.forEach(l => l.rt.dispose());
        layers.length = 0;
        
        let maxId = 0;

        state.layers.forEach(savedLayer => {
            const currentData = currentLayerData[savedLayer.id];

            const layerObj = {
                id: savedLayer.id,
                rt: cloneRenderTarget(savedLayer.rt),
                isVisible: currentData ? currentData.isVisible : savedLayer.isVisible,
                opacity: currentData ? currentData.opacity : savedLayer.opacity,
                name: currentData ? currentData.name : savedLayer.name
            };
            
            if (layerObj.id >= maxId) maxId = layerObj.id + 1;
            layers.push(layerObj);
            layerListEl.appendChild(window.LayerUIManager.buildLayerDOM(layerObj));
        });

        layerIdCounter = Math.max(layerIdCounter, maxId);
        selectLayer(state.activeLayerIndex);
        blitLayers();
        triggerAutosave();
    }
};

window.HistoryManager = HistoryManager;

// Base Background
// We still need base checkerboard logic in blitLayers, but we'll use a texture instead.
const checkerTexture = new THREE.TextureLoader().load('./checker.jpg', () => {
    checkerTexture.wrapS = THREE.RepeatWrapping;
    checkerTexture.wrapT = THREE.RepeatWrapping;
    if (mainRT) blitLayers();
});


let targetLayerIndexForImage = -1;

let currentModelText = null;
let autosaveTimeout = null;


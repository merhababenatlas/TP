const HistoryManager = {
    states: [],
    currentIndex: -1,
    maxStates: 20,

    saveState: function() {
        if (this.currentIndex < this.states.length - 1) {
            this.states = this.states.slice(0, this.currentIndex + 1);
        }

        const state = {
            activeLayerIndex: activeLayerIndex,
            layers: layers.map(l => ({
                id: l.id,
                name: l.name,
                opacity: l.opacity,
                isVisible: l.isVisible,
                imageData: l.ctx.getImageData(0, 0, TEX_SIZE, TEX_SIZE)
            }))
        };

        this.states.push(state);
        if (this.states.length > this.maxStates) {
            this.states.shift();
        } else {
            this.currentIndex++;
        }
        this.updateUI();
    },

    undo: function() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.restoreState(this.states[this.currentIndex]);
        }
        this.updateUI();
    },

    redo: function() {
        if (this.currentIndex < this.states.length - 1) {
            this.currentIndex++;
            this.restoreState(this.states[this.currentIndex]);
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
        layers.length = 0;
        
        let maxId = 0;

        state.layers.forEach(savedLayer => {
            const canvas = document.createElement('canvas');
            canvas.width = TEX_SIZE;
            canvas.height = TEX_SIZE;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            ctx.putImageData(savedLayer.imageData, 0, 0);

            const currentData = currentLayerData[savedLayer.id];

            const layerObj = {
                id: savedLayer.id,
                canvas: canvas,
                ctx: ctx,
                isVisible: currentData ? currentData.isVisible : savedLayer.isVisible,
                opacity: currentData ? currentData.opacity : savedLayer.opacity,
                name: currentData ? currentData.name : savedLayer.name
            };
            
            if (layerObj.id >= maxId) maxId = layerObj.id + 1;
            layers.push(layerObj);
            layerListEl.appendChild(buildLayerDOM(layerObj));
        });

        layerIdCounter = Math.max(layerIdCounter, maxId);
        selectLayer(state.activeLayerIndex);
        blitLayers();
        triggerAutosave();
    }
};

// Base Background (Checker Map)
const baseBgCanvas = document.createElement('canvas');
baseBgCanvas.width = TEX_SIZE;
baseBgCanvas.height = TEX_SIZE;
const baseBgCtx = baseBgCanvas.getContext('2d');
baseBgCtx.fillStyle = '#ffffff'; // Default to white while loading
baseBgCtx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

const checkerImg = new Image();
checkerImg.onload = () => {
    baseBgCtx.drawImage(checkerImg, 0, 0, TEX_SIZE, TEX_SIZE);
    if (mainCtx) {
        blitLayers(); // Redraw when loaded
    }
};
checkerImg.src = './checker.jpg';
let targetLayerIndexForImage = -1;

let currentModelText = null;
let autosaveTimeout = null;


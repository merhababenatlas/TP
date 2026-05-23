/// <summary>
/// 3D Texture Painter Application Logic
/// </summary>

// Core Constants
const TEX_SIZE = 1024;

// State Variables
let currentTool = 'brush';
const toolSettings = {
    'brush': { size: 50, intensity: 100, hardness: 50 },
    'eraser': { size: 50, intensity: 100, hardness: 50 },
    'blur': { size: 50, intensity: 50, hardness: 50 },
    'smear': { size: 50, intensity: 50, hardness: 50 },
    'picker': { size: 50, intensity: 100, hardness: 50 }
};
let currentColor = '#3296ff';
let activeLayerIndex = 0;
let isUIVisible = true;

// Layer Data Structure
const layers = [];
let mainCanvas, mainCtx, mainTexture;

// Three.js Variables
let scene, camera, renderer, cube, controls, raycaster, axesHelper;

// WebGL Painting Architecture Variables
let paintScene, paintCamera;
let paintMaterial, brushMaterial, blurMaterial, smearMaterial;

// Stroke Layer Tracking (WebGL)
let isStrokeActive = false;
let strokeRT = null; // Target for building up the stroke
let tempRT = null;   // Target for ping-ponging (Blur, Smear)

// Pointer State
let isDrawing = false;
let lastMouse = null;
let airbrushInterval = null;
let lastUvPosition = null;
let lastMouseMoveTime = 0;
let previewColor = null;
let draggedItemEl = null; // Used for drag and drop

// Global State
let wireframeMode = 0; // 0 = Off, 1 = Lines, 2 = Overlay
let isLitMode = false;
let cullMode = 0; // 0 = Front, 1 = Back, 2 = Double
let axesMode = 0; // 0 = Off, 1 = Blender, 2 = Unity

// History Management (Undo/Redo)
let layerIdCounter = 0;
let customConfirmCallback = null;

/// <summary>
/// Three.js Rendering Engine & Core Setup
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
    
    window.premultiplyMaterial = new THREE.ShaderMaterial({
        vertexShader: window.PaintShaders.vertexShader,
        fragmentShader: window.PaintShaders.premultiplyFragmentShader,
        uniforms: {
            tLayer: { value: null },
            uOpacity: { value: 1.0 }
        },
        transparent: true,
        blending: THREE.NoBlending
    });

    window.unpackMaterial = new THREE.ShaderMaterial({
        vertexShader: window.PaintShaders.vertexShader,
        fragmentShader: window.PaintShaders.unpackFragmentShader,
        uniforms: {
            tPacked: { value: null }
        },
        transparent: true,
        blending: THREE.NoBlending
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
    if (typeof applyMaterialMode === 'function') applyMaterialMode();

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

let fpsLimit = 30; // 0 = Sınırsız, default 30
let fpsClock = new THREE.Clock();
let fpsDelta = 0;

window.setFPSLimit = function(limit) {
    fpsLimit = limit;
};

window.wireframeColor = 0x00ff00;

window.setWireframeColor = function(hexStr) {
    window.wireframeColor = parseInt(hexStr.replace('#', '0x'), 16);
    if (cube) {
        cube.traverse((child) => {
            if (child.isLineSegments && child.userData.isWireframeHelper && child.material) {
                child.material.color.setHex(window.wireframeColor);
            }
        });
    }
};

window.setBackgroundColor = function(hexColor) {
    if (renderer && scene) {
        renderer.setClearColor(hexColor, 1);
        scene.background = new THREE.Color(hexColor);
    }
    document.body.style.backgroundColor = hexColor;
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

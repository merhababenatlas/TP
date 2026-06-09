/// <summary>
/// 3D Model Loading, Materials and Wireframe Management
/// </summary>

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

    const targetSize = 2.0;
    const scale = size > 0 ? targetSize / size : 1;
    object.scale.set(scale, scale, scale);

    // Compute BVH for all meshes in the loaded object
    if (window.MeshBVH) {
        object.traverse((child) => {
            if (child.isMesh && child.geometry && child.geometry.computeBoundsTree) {
                try {
                    child.geometry.computeBoundsTree();
                } catch(e) {
                    console.warn("BVH generation failed for mesh, skipping...", e);
                }
            }
        });
    }

    cube = object;
    scene.add(cube);
    applyMaterialMode();
    applyWireframeMode();
    if (!skipSave && typeof triggerAutosave === 'function') triggerAutosave();
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
    // mainRT is from LayerManager.js, so it's a global variable
    const currentMap = (typeof mainRT !== 'undefined' && mainRT) ? mainRT.texture : null;
    
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
                child.material.colorWrite = true;
                child.material.depthWrite = true;
            } else if (wireframeMode === 1) {
                child.material.wireframe = false;
                child.material.colorWrite = false;
                child.material.depthWrite = false;
                
                const wireframeGeometry = new THREE.WireframeGeometry(child.geometry);
                const wireframeMaterial = new THREE.LineBasicMaterial({
                    color: window.wireframeColor || 0x00ff00,
                    depthTest: true,
                    opacity: 0.5,
                    transparent: true
                });
                const line = new THREE.LineSegments(wireframeGeometry, wireframeMaterial);
                line.userData.isWireframeHelper = true;
                child.add(line);
            } else if (wireframeMode === 2) {
                child.material.wireframe = false;
                child.material.colorWrite = true;
                child.material.depthWrite = true;
                
                const wireframeGeometry = new THREE.WireframeGeometry(child.geometry);
                const wireframeMaterial = new THREE.LineBasicMaterial({
                    color: window.wireframeColor || 0x00ff00,
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

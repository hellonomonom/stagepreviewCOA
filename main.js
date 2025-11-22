import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0.012, 0.012, 0.012);

// Camera setup
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
// Default camera position (will be set to camera position 1 after presets are defined)
camera.position.set(5, 5, 5);
camera.lookAt(0, 0, 0);

// Renderer setup
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.outputColorSpace = THREE.SRGBColorSpace; // Use sRGB for accurate color display
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

// OrbitControls setup
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.target.set(0, 0, 0);

// Note: Default camera position will be set after cameraPositions array is defined

// Create material with custom shader (used for texture management, referenced by LED shaders)
const material = new THREE.ShaderMaterial({
  uniforms: {
    uTexture: { value: null },
    uHasTexture: { value: 0.0 },
    uIsImageTexture: { value: 0.0 }
  },
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vPosition;
    
    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      vPosition = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D uTexture;
    uniform float uHasTexture;
    uniform float uIsImageTexture;
    varying vec2 vUv;
    varying vec3 vNormal;
    
    void main() {
      // Check if this is the back face
      if (!gl_FrontFacing) {
        // Backside is black
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
      } else {
        // Front side shows texture or white
        if (uHasTexture > 0.5) {
          vec4 texColor = texture2D(uTexture, vUv);
          // Use texture directly for both images and videos
          gl_FragColor = vec4(texColor.rgb, texColor.a);
        } else {
          gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
        }
      }
    }
  `,
  side: THREE.DoubleSide
});

// Create groups for organizing meshes
const ledsGroup = new THREE.Group();
ledsGroup.name = 'LEDs';
const stageGroup = new THREE.Group();
stageGroup.name = 'Stage';
let djLiftableMesh = null; // Reference to the DJ liftable stage mesh
let artistsMeshes = []; // Array to store individual meshes from artists.glb
let djArtistMesh = null; // Reference to the DJ artist mesh

// Store reference to LED front mesh
let ledFrontMesh = null;

// Store references to all loaded LED meshes for swapping
const loadedLEDMeshes = [];

// Add groups to scene
scene.add(ledsGroup);
scene.add(stageGroup);

// GLTF Loader
const gltfLoader = new GLTFLoader();

// Shader material factory function with PBR properties
function createPBRShaderMaterial(defaultBaseColor = [0.8, 0.8, 0.8], defaultRoughness = 0.5, defaultSpecular = 0.5) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uBaseColor: { value: new THREE.Vector3(...defaultBaseColor) },
      uRoughness: { value: defaultRoughness },
      uSpecular: { value: defaultSpecular },
      uCameraPosition: { value: new THREE.Vector3() }
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec2 vUv;
      varying vec3 vWorldPosition;
      
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vPosition = position;
        vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uBaseColor;
      uniform float uRoughness;
      uniform float uSpecular;
      uniform vec3 uCameraPosition;
      
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec2 vUv;
      varying vec3 vWorldPosition;
      
      void main() {
        vec3 normal = normalize(vNormal);
        
        // Calculate view direction from world position to camera
        vec3 viewDir = normalize(uCameraPosition - vWorldPosition);
        
        // Simple lighting calculation
        vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
        float NdotL = max(dot(normal, lightDir), 0.0);
        
        // Ambient light
        vec3 ambient = uBaseColor * 0.3;
        
        // Diffuse lighting
        vec3 diffuse = uBaseColor * NdotL * 0.7;
        
        // Specular highlight
        vec3 halfDir = normalize(lightDir + viewDir);
        float NdotH = max(dot(normal, halfDir), 0.0);
        float specPower = mix(1.0, 256.0, 1.0 - uRoughness);
        vec3 specular = vec3(pow(NdotH, specPower)) * uSpecular;
        
        // Combine
        vec3 finalColor = ambient + diffuse + specular;
        
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `,
    side: THREE.DoubleSide
  });
}

// Create shader materials for different asset types
const shaderMaterials = {
  base: createPBRShaderMaterial([0.188, 0.188, 0.188], 0.905, 0.300),
  artists: createPBRShaderMaterial([0.722, 0.722, 0.722], 0.604, 0.500),
  stage: createPBRShaderMaterial([0.239, 0.239, 0.239], 0.700, 0.200),
  pillars: createPBRShaderMaterial([0.420, 0.420, 0.420], 1.000, 0.211),
  floor: createPBRShaderMaterial([0.129, 0.129, 0.129], 0.900, 0.000)
};

// Update all shader materials to ensure correct values
shaderMaterials.base.uniforms.uBaseColor.value.set(0.188, 0.188, 0.188);
shaderMaterials.base.uniforms.uRoughness.value = 0.905;
shaderMaterials.base.uniforms.uSpecular.value = 0.300;

shaderMaterials.artists.uniforms.uBaseColor.value.set(0.722, 0.722, 0.722);
shaderMaterials.artists.uniforms.uRoughness.value = 0.604;
shaderMaterials.artists.uniforms.uSpecular.value = 0.500;

shaderMaterials.stage.uniforms.uBaseColor.value.set(0.239, 0.239, 0.239);
shaderMaterials.stage.uniforms.uRoughness.value = 0.700;
shaderMaterials.stage.uniforms.uSpecular.value = 0.200;

shaderMaterials.pillars.uniforms.uBaseColor.value.set(0.420, 0.420, 0.420);
shaderMaterials.pillars.uniforms.uRoughness.value = 1.000;
shaderMaterials.pillars.uniforms.uSpecular.value = 0.211;

shaderMaterials.floor.uniforms.uBaseColor.value.set(0.129, 0.129, 0.129);
shaderMaterials.floor.uniforms.uRoughness.value = 0.900;
shaderMaterials.floor.uniforms.uSpecular.value = 0.000;

// Store references to all materials for UI control
const materialReferences = {
  base: [],
  artists: [],
  stage: [],
  pillars: [],
  floor: []
};

// Double-sided shader material for stage meshes (legacy, kept for backwards compatibility)
const stageShaderMaterial = shaderMaterials.stage;

// Shader material for LED meshes that uses the video texture
function createLEDShaderMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTexture: { value: material.uniforms.uTexture.value }, // Reference to the video texture
      uHasTexture: { value: material.uniforms.uHasTexture.value },
      uIsImageTexture: { value: material.uniforms.uIsImageTexture.value }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vPosition;
      
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uTexture;
      uniform float uHasTexture;
      uniform float uIsImageTexture;
      varying vec2 vUv;
      varying vec3 vNormal;
      
      void main() {
        // Check if this is the back face
        if (!gl_FrontFacing) {
          // Backside is black
          gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        } else {
          // Front side shows texture or white
          if (uHasTexture > 0.5) {
            // Invert V coordinate
            vec2 invertedUv = vec2(vUv.x, 1.0 - vUv.y);
            vec4 texColor = texture2D(uTexture, invertedUv);
            // Use texture directly for both images and videos
            gl_FragColor = vec4(texColor.rgb, texColor.a);
          } else {
            gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
          }
        }
      }
    `,
    side: THREE.DoubleSide
  });
}

// Function to update LED shader textures when video texture changes
function updateLEDShaders() {
  const videoTexture = material.uniforms.uTexture.value;
  const hasTexture = material.uniforms.uHasTexture.value;
  const isImageTexture = material.uniforms.uIsImageTexture.value;
  
  ledsGroup.traverse((child) => {
    if (child.isMesh && child.material && child.material.uniforms) {
      // Update the texture reference in LED shader
      child.material.uniforms.uTexture.value = videoTexture;
      child.material.uniforms.uHasTexture.value = hasTexture;
      child.material.uniforms.uIsImageTexture.value = isImageTexture;
      child.material.needsUpdate = true;
    }
  });
}

// Function to apply shader to all meshes in a group
function applyShaderToGroup(group, shaderMaterial) {
  group.traverse((child) => {
    if (child.isMesh) {
      // Store original material if needed
      if (!child.userData.originalMaterial) {
        child.userData.originalMaterial = child.material;
      }
      child.material = shaderMaterial.clone();
    }
  });
}

// LED mesh file paths for different mapping types
const ledMeshFiles = {
  festival: [
    '/assets/meshes/FestivalMapping/ANYMA_Coachella_Stage_v007_LED_FRONT.glb',
    '/assets/meshes/FestivalMapping/ANYMA_Coachella_Stage_v007_LED_SL_GARAGE.glb',
    '/assets/meshes/FestivalMapping/ANYMA_Coachella_Stage_v008_LED_SL_WING.glb',
    '/assets/meshes/FestivalMapping/ANYMA_Coachella_Stage_v008_LED_SR_GARAGE.glb',
    '/assets/meshes/FestivalMapping/ANYMA_Coachella_Stage_v008_LED_SR_WING.glb',
    '/assets/meshes/FestivalMapping/ANYMA_Coachella_Stage_v008_LED_US_WALL.glb'
  ],
  frontProjection: [
    '/assets/meshes/FrontProjection/ANYMA_Coachella_Stage_v010_LED_Front_FrontP.glb',
    '/assets/meshes/FrontProjection/ANYMA_Coachella_Stage_v010_LED_SL_GARAGE_FrontP.glb',
    '/assets/meshes/FrontProjection/ANYMA_Coachella_Stage_v010_LED_SL_WING_FrontP.glb',
    '/assets/meshes/FrontProjection/ANYMA_Coachella_Stage_v010_LED_SR_GARAGE_FrontP.glb',
    '/assets/meshes/FrontProjection/ANYMA_Coachella_Stage_v010_LED_SR_WING_FrontP.glb',
    '/assets/meshes/FrontProjection/ANYMA_Coachella_Stage_v010_LED_US_WALL_FrontP.glb'
  ],
  frontProjectionPerspective: [
    '/assets/meshes/FrontProjection_perspective/ANYMA_Coachella_Stage_v013_LED_FRONT.glb',
    '/assets/meshes/FrontProjection_perspective/ANYMA_Coachella_Stage_v013_LED_SL_GARAGE.glb',
    '/assets/meshes/FrontProjection_perspective/ANYMA_Coachella_Stage_v013_LED_SL_WING.glb',
    '/assets/meshes/FrontProjection_perspective/ANYMA_Coachella_Stage_v013_LED_SR_GARAGE.glb',
    '/assets/meshes/FrontProjection_perspective/ANYMA_Coachella_Stage_v013_LED_SR_WING.glb',
    '/assets/meshes/FrontProjection_perspective/ANYMA_Coachella_Stage_v013_LED_US_WALL.glb'
  ]
};

// Current mapping type (default to frontProjection)
let currentMappingType = 'frontProjection';

// Mesh file paths organized by category
const meshFiles = {
  leds: ledMeshFiles[currentMappingType],
  stage: [
    '/assets/meshes/ANYMA_Coachella_Stage_v008_CATWALK.glb',
    '/assets/meshes/ANYMA_Coachella_Stage_v008_PILLARS.glb',
    '/assets/meshes/ANYMA_Coachella_Stage_v008_STAGE_CROWD.glb',
    '/assets/meshes/ANYMA_Coachella_Stage_v008_STAGE_DJ_LIFTABLE.glb',
    '/assets/meshes/ANYMA_Coachella_Stage_v008_STAGE_GROUND.glb',
    '/assets/meshes/ANYMA_Coachella_Stage_v010_STAGE_ARTISTS.glb',
    '/assets/meshes/ANYMA_Coachella_Stage_v010_FLOOR.glb'
  ]
};

// Function to determine which shader type to use based on filename
function getShaderType(path) {
  const lowerPath = path.toLowerCase();
  
  // Base shader: CATWALK, STAGE_GROUND, STAGE_DJ
  if (lowerPath.includes('catwalk') || lowerPath.includes('stage_ground') || lowerPath.includes('stage_dj')) {
    return 'base';
  }
  
  // Artists shader
  if (lowerPath.includes('artists')) {
    return 'artists';
  }
  
  // Stage shader: LIFTABLE, CROWD
  if (lowerPath.includes('liftable') || lowerPath.includes('crowd')) {
    return 'stage';
  }
  
  // Pillars shader
  if (lowerPath.includes('pillars')) {
    return 'pillars';
  }
  
  // Floor shader
  if (lowerPath.includes('floor')) {
    return 'floor';
  }
  
  // Default to stage shader for other stage meshes
  return 'stage';
}

// Function to load a single mesh
function loadMesh(path, targetGroup, isStage = false) {
  gltfLoader.load(
    path,
    (gltf) => {
      const model = gltf.scene;
      targetGroup.add(model);
      
      // Store reference to LED mesh if it's an LED mesh
      if (!isStage && targetGroup === ledsGroup) {
        loadedLEDMeshes.push(model);
        
        // Store reference to LED front mesh (check for both FRONT and Front naming)
        if (path.includes('LED_FRONT') || path.includes('LED_Front')) {
          ledFrontMesh = model;
        }
      }
      
      if (isStage) {
        // Store reference to DJ liftable mesh
        if (path.includes('STAGE_DJ_LIFTABLE') || path.includes('Stage_DJ_Liftable')) {
          djLiftableMesh = model;
          console.log('DJ liftable mesh loaded');
          
          // If DJ artist mesh is already loaded, parent it to the liftable stage
          if (djArtistMesh) {
            // Remove from current parent
            if (djArtistMesh.parent) {
              djArtistMesh.parent.remove(djArtistMesh);
            }
            // Add to liftable stage mesh
            djLiftableMesh.add(djArtistMesh);
            console.log('Parented DJ artist mesh to liftable stage');
          }
        }
        
        // Store individual meshes from artists model for individual control
        if (path.includes('ARTISTS') || path.includes('Artists') || path.includes('artists')) {
          model.traverse((child) => {
            if (child.isMesh) {
              artistsMeshes.push({
                mesh: child,
                name: child.name || 'Unnamed',
                parent: child.parent
              });
              console.log(`Stored artists mesh: ${child.name || 'Unnamed'} (parent: ${child.parent?.name || 'root'})`);
              
              // Store reference to DJ artist mesh
              if (child.name && (child.name.includes('DJ') || child.name.includes('dj'))) {
                djArtistMesh = child;
                console.log(`Found DJ artist mesh: ${child.name}`);
                
                // Parent DJ artist mesh to liftable stage if it's already loaded
                if (djLiftableMesh) {
                  // Remove from current parent
                  if (child.parent) {
                    child.parent.remove(child);
                  }
                  // Add to liftable stage mesh
                  djLiftableMesh.add(child);
                  console.log('Parented DJ artist mesh to liftable stage');
                }
              }
            }
          });
        }
        
        // Determine shader type based on filename
        const shaderType = getShaderType(path);
        const shaderMaterial = shaderMaterials[shaderType];
        
        model.traverse((child) => {
          if (child.isMesh) {
            // Store original material if needed
            if (!child.userData.originalMaterial) {
              child.userData.originalMaterial = child.material;
            }
            
            // Clone the shader material for this mesh
            const clonedMaterial = shaderMaterial.clone();
            child.material = clonedMaterial;
            
            // Store reference for UI control
            if (!materialReferences[shaderType]) {
              materialReferences[shaderType] = [];
            }
            materialReferences[shaderType].push(clonedMaterial);
          }
        });
      } else {
        // Apply LED shader to LED meshes
        model.traverse((child) => {
          if (child.isMesh) {
            // Store original material if needed
            if (!child.userData.originalMaterial) {
              child.userData.originalMaterial = child.material;
            }
            child.material = createLEDShaderMaterial();
          }
        });
      }
      
      console.log(`Loaded mesh: ${path}`);
    },
    (progress) => {
      // Loading progress (optional)
      if (progress.lengthComputable) {
        const percentComplete = (progress.loaded / progress.total) * 100;
        console.log(`Loading ${path}: ${percentComplete.toFixed(0)}%`);
      }
    },
    (error) => {
      console.error(`Error loading mesh ${path}:`, error);
    }
  );
}

// Function to load LED meshes
function loadLEDMeshes(mappingType) {
  // Clear existing LED meshes
  loadedLEDMeshes.forEach(mesh => {
    ledsGroup.remove(mesh);
    // Dispose of geometry and materials
    mesh.traverse((child) => {
      if (child.isMesh) {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(mat => mat.dispose());
          } else {
            child.material.dispose();
          }
        }
      }
    });
  });
  loadedLEDMeshes.length = 0;
  ledFrontMesh = null;
  
  // Load new LED meshes
  const paths = ledMeshFiles[mappingType];
  paths.forEach(path => {
    loadMesh(path, ledsGroup, false);
  });
}

// Load initial LED meshes (Front Projection by default)
loadLEDMeshes(currentMappingType);

// Hide front screen by default for Festival Mapping, show for Front Projection types
setTimeout(() => {
  const hideLedFrontCheckbox = document.getElementById('hideLedFront');
  if (ledFrontMesh) {
    if (currentMappingType === 'festival') {
      ledFrontMesh.visible = false;
      if (hideLedFrontCheckbox) {
        hideLedFrontCheckbox.checked = true;
      }
    } else if (currentMappingType === 'frontProjection' || currentMappingType === 'frontProjectionPerspective') {
      ledFrontMesh.visible = true;
      if (hideLedFrontCheckbox) {
        hideLedFrontCheckbox.checked = false;
      }
    }
  }
}, 100);

// Load all Stage meshes
meshFiles.stage.forEach(path => {
  loadMesh(path, stageGroup, true);
});

// Add lights - brighter and more neutral for accurate color display
const ambientLight = new THREE.AmbientLight(0xffffff, 1.0); // Increased intensity
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2); // Increased intensity
directionalLight.position.set(0, 0, 5); // Front lighting for better visibility
directionalLight.castShadow = true;
scene.add(directionalLight);

// Texture loading
const settingsPanel = document.getElementById('settingsPanel');
const textureInput = document.getElementById('textureInput');
const textureStatus = document.getElementById('textureStatus'); // May be null - element was removed

// Make control panel draggable
let isDragging = false;
let isDraggingCamera = false;
let isDraggingStyleShader = false;
let dragStartX = 0;
let dragStartY = 0;
let panelStartX = 0;
let panelStartY = 0;

const cameraPanel = document.getElementById('cameraPanel');
const styleShaderPanel = document.getElementById('styleShaderPanel');

// Helper function to make panel draggable
function makePanelDraggable(panel, dragStateVar) {
  if (!panel) return;
  
  panel.addEventListener('mousedown', (e) => {
    // Only start dragging if clicking on the panel background or labels (not interactive elements)
    const target = e.target;
    const isInteractive = target.tagName === 'INPUT' || 
                         target.tagName === 'SELECT' || 
                         target.tagName === 'BUTTON' ||
                         (target.tagName === 'LABEL' && target.getAttribute('for'));
    
    if (!isInteractive && (target === panel || target.closest('.control-group label') || target.closest('.control-section-header'))) {
      if (dragStateVar === 'control') {
        isDragging = true;
      } else if (dragStateVar === 'camera') {
        isDraggingCamera = true;
      } else if (dragStateVar === 'styleShader') {
        isDraggingStyleShader = true;
      }
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      
      const rect = panel.getBoundingClientRect();
      panelStartX = rect.left;
      panelStartY = rect.top;
      
      panel.style.cursor = 'grabbing';
      e.preventDefault();
    }
  });
}

// Make control panel draggable
makePanelDraggable(settingsPanel, 'control');

// Make camera panel draggable
makePanelDraggable(cameraPanel, 'camera');

// Make combined style-shader panel draggable
makePanelDraggable(styleShaderPanel, 'styleShader');

// Tab switching
const styleTabBtn = document.getElementById('styleTabBtn');
const shaderTabBtn = document.getElementById('shaderTabBtn');
const styleTabPanel = document.getElementById('styleTabPanel');
const shaderTabPanel = document.getElementById('shaderTabPanel');

function switchTab(activeTabName) {
  // Update buttons
  styleTabBtn?.classList.toggle('active', activeTabName === 'style');
  shaderTabBtn?.classList.toggle('active', activeTabName === 'shader');
  
  // Update panels
  styleTabPanel?.classList.toggle('active', activeTabName === 'style');
  shaderTabPanel?.classList.toggle('active', activeTabName === 'shader');
}

if (styleTabBtn) {
  styleTabBtn.addEventListener('click', () => {
    switchTab('style');
  });
}

if (shaderTabBtn) {
  shaderTabBtn.addEventListener('click', () => {
    switchTab('shader');
  });
}

// Initialize with Style tab active
switchTab('style');

// Style-Shader panel minimize toggle
const styleShaderPanelToggle = document.getElementById('styleShaderPanelToggle');
if (styleShaderPanelToggle && styleShaderPanel) {
  // Initialize as minimized (class is already in HTML)
  
  styleShaderPanelToggle.addEventListener('click', () => {
    styleShaderPanel.classList.toggle('minimized');
    styleShaderPanelToggle.textContent = styleShaderPanel.classList.contains('minimized') ? '+' : '−';
  });
}

// Settings panel minimize toggle
const settingsPanelToggle = document.getElementById('settingsPanelToggle');
if (settingsPanelToggle && settingsPanel) {
  settingsPanelToggle.addEventListener('click', () => {
    settingsPanel.classList.toggle('minimized');
    settingsPanelToggle.textContent = settingsPanel.classList.contains('minimized') ? '+' : '−';
  });
}

// Camera panel minimize toggle
const cameraPanelToggle = document.getElementById('cameraPanelToggle');
if (cameraPanelToggle && cameraPanel) {
  cameraPanelToggle.addEventListener('click', () => {
    cameraPanel.classList.toggle('minimized');
    cameraPanelToggle.textContent = cameraPanel.classList.contains('minimized') ? '+' : '−';
  });
}

// Handle mouse move for all panels
document.addEventListener('mousemove', (e) => {
  if (isDragging && settingsPanel) {
    const deltaX = e.clientX - dragStartX;
    const deltaY = e.clientY - dragStartY;
    
    let newX = panelStartX + deltaX;
    let newY = panelStartY + deltaY;
    
    // Keep panel within viewport bounds
    const panelRect = settingsPanel.getBoundingClientRect();
    const maxX = window.innerWidth - panelRect.width;
    const maxY = window.innerHeight - panelRect.height;
    
    newX = Math.max(0, Math.min(newX, maxX));
    newY = Math.max(0, Math.min(newY, maxY));
    
    settingsPanel.style.left = `${newX}px`;
    settingsPanel.style.top = `${newY}px`;
    settingsPanel.style.right = 'auto';
  }
  
  if (isDraggingCamera && cameraPanel) {
    const deltaX = e.clientX - dragStartX;
    const deltaY = e.clientY - dragStartY;
    
    let newX = panelStartX + deltaX;
    let newY = panelStartY + deltaY;
    
    // Keep panel within viewport bounds
    const panelRect = cameraPanel.getBoundingClientRect();
    const maxX = window.innerWidth - panelRect.width;
    const maxY = window.innerHeight - panelRect.height;
    
    newX = Math.max(0, Math.min(newX, maxX));
    newY = Math.max(0, Math.min(newY, maxY));
    
    cameraPanel.style.left = `${newX}px`;
    cameraPanel.style.top = `${newY}px`;
    cameraPanel.style.right = 'auto';
  }
  
  if (isDraggingStyleShader && styleShaderPanel) {
    const deltaX = e.clientX - dragStartX;
    const deltaY = e.clientY - dragStartY;
    
    let newX = panelStartX + deltaX;
    let newY = panelStartY + deltaY;
    
    // Keep panel within viewport bounds
    const panelRect = styleShaderPanel.getBoundingClientRect();
    const maxX = window.innerWidth - panelRect.width;
    const maxY = window.innerHeight - panelRect.height;
    
    newX = Math.max(0, Math.min(newX, maxX));
    newY = Math.max(0, Math.min(newY, maxY));
    
    styleShaderPanel.style.left = `${newX}px`;
    styleShaderPanel.style.top = `${newY}px`;
    styleShaderPanel.style.transform = 'none';
  }
});

// Handle mouse up for all panels
document.addEventListener('mouseup', () => {
  if (isDragging && settingsPanel) {
    isDragging = false;
    settingsPanel.style.cursor = 'grab';
  }
  if (isDraggingCamera && cameraPanel) {
    isDraggingCamera = false;
    cameraPanel.style.cursor = 'grab';
  }
  if (isDraggingStyleShader && styleShaderPanel) {
    isDraggingStyleShader = false;
    styleShaderPanel.style.cursor = 'grab';
  }
});

// Shader Controls - Wire up UI to update shader uniforms
function updateShaderUniforms(shaderType, uniformName, value) {
  if (!materialReferences[shaderType] || materialReferences[shaderType].length === 0) {
    console.log(`No materials found for shader type: ${shaderType}`);
    return;
  }
  
  materialReferences[shaderType].forEach(material => {
    if (material && material.uniforms && material.uniforms[uniformName]) {
      if (uniformName === 'uBaseColor') {
        material.uniforms[uniformName].value.set(...value);
      } else {
        material.uniforms[uniformName].value = value;
      }
      material.needsUpdate = true;
    }
  });
}

// Function to update UI controls to match current shader material values
function syncControlsToShaderValues(shaderType, material) {
  if (!material || !material.uniforms) return;
  
  const baseColor = material.uniforms.uBaseColor.value;
  const roughness = material.uniforms.uRoughness.value;
  const specular = material.uniforms.uSpecular.value;
  
  // Update sliders and value displays
  const colorR = document.getElementById(`${shaderType}ColorR`);
  const colorG = document.getElementById(`${shaderType}ColorG`);
  const colorB = document.getElementById(`${shaderType}ColorB`);
  const colorPicker = document.getElementById(`${shaderType}ColorPicker`);
  const roughnessSlider = document.getElementById(`${shaderType}Roughness`);
  const specularSlider = document.getElementById(`${shaderType}Specular`);
  
  if (colorR) {
    colorR.value = baseColor.x.toFixed(3);
    const valueEl = document.getElementById(`${shaderType}ColorRValue`);
    if (valueEl) valueEl.textContent = baseColor.x.toFixed(3);
  }
  if (colorG) {
    colorG.value = baseColor.y.toFixed(3);
    const valueEl = document.getElementById(`${shaderType}ColorGValue`);
    if (valueEl) valueEl.textContent = baseColor.y.toFixed(3);
  }
  if (colorB) {
    colorB.value = baseColor.z.toFixed(3);
    const valueEl = document.getElementById(`${shaderType}ColorBValue`);
    if (valueEl) valueEl.textContent = baseColor.z.toFixed(3);
  }
  
  // Update color picker
  if (colorPicker) {
    const hex = '#' + [baseColor.x, baseColor.y, baseColor.z].map(x => {
      const hex = Math.round(x * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
    colorPicker.value = hex;
  }
  
  if (roughnessSlider) {
    roughnessSlider.value = roughness.toFixed(3);
    const valueEl = document.getElementById(`${shaderType}RoughnessValue`);
    if (valueEl) valueEl.textContent = roughness.toFixed(3);
  }
  
  if (specularSlider) {
    specularSlider.value = specular.toFixed(3);
    const valueEl = document.getElementById(`${shaderType}SpecularValue`);
    if (valueEl) valueEl.textContent = specular.toFixed(3);
  }
}

// Initialize shader controls
function initShaderControls() {
  console.log('Initializing shader controls...');
  console.log('Material references:', materialReferences);
  
  // Sync all controls to match current shader material values
  Object.keys(shaderMaterials).forEach(shaderType => {
    const material = shaderMaterials[shaderType];
    syncControlsToShaderValues(shaderType, material);
  });
  
  // Artists shader controls
  const artistsColorR = document.getElementById('artistsColorR');
  const artistsColorG = document.getElementById('artistsColorG');
  const artistsColorB = document.getElementById('artistsColorB');
  const artistsColorPicker = document.getElementById('artistsColorPicker');
  const artistsRoughness = document.getElementById('artistsRoughness');
  const artistsSpecular = document.getElementById('artistsSpecular');

  function updateArtistsColor() {
    const r = parseFloat(artistsColorR.value);
    const g = parseFloat(artistsColorG.value);
    const b = parseFloat(artistsColorB.value);
    console.log(`Updating artists color to: ${r}, ${g}, ${b}`);
    console.log(`Materials in artists array:`, materialReferences['artists']);
    updateShaderUniforms('artists', 'uBaseColor', [r, g, b]);
    if (document.getElementById('artistsColorRValue')) document.getElementById('artistsColorRValue').textContent = r.toFixed(2);
    if (document.getElementById('artistsColorGValue')) document.getElementById('artistsColorGValue').textContent = g.toFixed(2);
    if (document.getElementById('artistsColorBValue')) document.getElementById('artistsColorBValue').textContent = b.toFixed(2);
    
    const hex = '#' + [r, g, b].map(x => {
      const hex = Math.round(x * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
    if (artistsColorPicker) artistsColorPicker.value = hex;
  }

  if (artistsColorR && artistsColorG && artistsColorB) {
    artistsColorR.addEventListener('input', updateArtistsColor);
    artistsColorG.addEventListener('input', updateArtistsColor);
    artistsColorB.addEventListener('input', updateArtistsColor);
    console.log('Artists color controls wired up');
  }

  if (artistsColorPicker) {
    artistsColorPicker.addEventListener('input', (e) => {
      const hex = e.target.value;
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      artistsColorR.value = r;
      artistsColorG.value = g;
      artistsColorB.value = b;
      updateArtistsColor();
    });
  }

  if (artistsRoughness) {
    artistsRoughness.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      updateShaderUniforms('artists', 'uRoughness', value);
      if (document.getElementById('artistsRoughnessValue')) document.getElementById('artistsRoughnessValue').textContent = value.toFixed(2);
    });
  }

  if (artistsSpecular) {
    artistsSpecular.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      updateShaderUniforms('artists', 'uSpecular', value);
      if (document.getElementById('artistsSpecularValue')) document.getElementById('artistsSpecularValue').textContent = value.toFixed(2);
    });
  }

  // Base shader controls
  const baseColorR = document.getElementById('baseColorR');
  const baseColorG = document.getElementById('baseColorG');
  const baseColorB = document.getElementById('baseColorB');
  const baseColorPicker = document.getElementById('baseColorPicker');
  const baseRoughness = document.getElementById('baseRoughness');
  const baseSpecular = document.getElementById('baseSpecular');

  function updateBaseColor() {
    const r = parseFloat(baseColorR.value);
    const g = parseFloat(baseColorG.value);
    const b = parseFloat(baseColorB.value);
    updateShaderUniforms('base', 'uBaseColor', [r, g, b]);
    if (document.getElementById('baseColorRValue')) document.getElementById('baseColorRValue').textContent = r.toFixed(2);
    if (document.getElementById('baseColorGValue')) document.getElementById('baseColorGValue').textContent = g.toFixed(2);
    if (document.getElementById('baseColorBValue')) document.getElementById('baseColorBValue').textContent = b.toFixed(2);
    
    const hex = '#' + [r, g, b].map(x => {
      const hex = Math.round(x * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
    if (baseColorPicker) baseColorPicker.value = hex;
  }

  if (baseColorR && baseColorG && baseColorB) {
    baseColorR.addEventListener('input', updateBaseColor);
    baseColorG.addEventListener('input', updateBaseColor);
    baseColorB.addEventListener('input', updateBaseColor);
  }

  if (baseColorPicker) {
    baseColorPicker.addEventListener('input', (e) => {
      const hex = e.target.value;
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      baseColorR.value = r;
      baseColorG.value = g;
      baseColorB.value = b;
      updateBaseColor();
    });
  }

  if (baseRoughness) {
    baseRoughness.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      updateShaderUniforms('base', 'uRoughness', value);
      if (document.getElementById('baseRoughnessValue')) document.getElementById('baseRoughnessValue').textContent = value.toFixed(2);
    });
  }

  if (baseSpecular) {
    baseSpecular.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      updateShaderUniforms('base', 'uSpecular', value);
      if (document.getElementById('baseSpecularValue')) document.getElementById('baseSpecularValue').textContent = value.toFixed(2);
    });
  }

  // Stage shader controls
  const stageColorR = document.getElementById('stageColorR');
  const stageColorG = document.getElementById('stageColorG');
  const stageColorB = document.getElementById('stageColorB');
  const stageColorPicker = document.getElementById('stageColorPicker');
  const stageRoughness = document.getElementById('stageRoughness');
  const stageSpecular = document.getElementById('stageSpecular');

  function updateStageColor() {
    const r = parseFloat(stageColorR.value);
    const g = parseFloat(stageColorG.value);
    const b = parseFloat(stageColorB.value);
    updateShaderUniforms('stage', 'uBaseColor', [r, g, b]);
    if (document.getElementById('stageColorRValue')) document.getElementById('stageColorRValue').textContent = r.toFixed(2);
    if (document.getElementById('stageColorGValue')) document.getElementById('stageColorGValue').textContent = g.toFixed(2);
    if (document.getElementById('stageColorBValue')) document.getElementById('stageColorBValue').textContent = b.toFixed(2);
    
    const hex = '#' + [r, g, b].map(x => {
      const hex = Math.round(x * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
    if (stageColorPicker) stageColorPicker.value = hex;
  }

  if (stageColorR && stageColorG && stageColorB) {
    stageColorR.addEventListener('input', updateStageColor);
    stageColorG.addEventListener('input', updateStageColor);
    stageColorB.addEventListener('input', updateStageColor);
  }

  if (stageColorPicker) {
    stageColorPicker.addEventListener('input', (e) => {
      const hex = e.target.value;
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      stageColorR.value = r;
      stageColorG.value = g;
      stageColorB.value = b;
      updateStageColor();
    });
  }

  if (stageRoughness) {
    stageRoughness.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      updateShaderUniforms('stage', 'uRoughness', value);
      if (document.getElementById('stageRoughnessValue')) document.getElementById('stageRoughnessValue').textContent = value.toFixed(2);
    });
  }

  if (stageSpecular) {
    stageSpecular.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      updateShaderUniforms('stage', 'uSpecular', value);
      if (document.getElementById('stageSpecularValue')) document.getElementById('stageSpecularValue').textContent = value.toFixed(2);
    });
  }

  // Pillars shader controls
  const pillarsColorR = document.getElementById('pillarsColorR');
  const pillarsColorG = document.getElementById('pillarsColorG');
  const pillarsColorB = document.getElementById('pillarsColorB');
  const pillarsColorPicker = document.getElementById('pillarsColorPicker');
  const pillarsRoughness = document.getElementById('pillarsRoughness');
  const pillarsSpecular = document.getElementById('pillarsSpecular');

  function updatePillarsColor() {
    const r = parseFloat(pillarsColorR.value);
    const g = parseFloat(pillarsColorG.value);
    const b = parseFloat(pillarsColorB.value);
    updateShaderUniforms('pillars', 'uBaseColor', [r, g, b]);
    if (document.getElementById('pillarsColorRValue')) document.getElementById('pillarsColorRValue').textContent = r.toFixed(2);
    if (document.getElementById('pillarsColorGValue')) document.getElementById('pillarsColorGValue').textContent = g.toFixed(2);
    if (document.getElementById('pillarsColorBValue')) document.getElementById('pillarsColorBValue').textContent = b.toFixed(2);
    
    const hex = '#' + [r, g, b].map(x => {
      const hex = Math.round(x * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
    if (pillarsColorPicker) pillarsColorPicker.value = hex;
  }

  if (pillarsColorR && pillarsColorG && pillarsColorB) {
    pillarsColorR.addEventListener('input', updatePillarsColor);
    pillarsColorG.addEventListener('input', updatePillarsColor);
    pillarsColorB.addEventListener('input', updatePillarsColor);
  }

  if (pillarsColorPicker) {
    pillarsColorPicker.addEventListener('input', (e) => {
      const hex = e.target.value;
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      pillarsColorR.value = r;
      pillarsColorG.value = g;
      pillarsColorB.value = b;
      updatePillarsColor();
    });
  }

  if (pillarsRoughness) {
    pillarsRoughness.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      updateShaderUniforms('pillars', 'uRoughness', value);
      if (document.getElementById('pillarsRoughnessValue')) document.getElementById('pillarsRoughnessValue').textContent = value.toFixed(2);
    });
  }

  if (pillarsSpecular) {
    pillarsSpecular.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      updateShaderUniforms('pillars', 'uSpecular', value);
      if (document.getElementById('pillarsSpecularValue')) document.getElementById('pillarsSpecularValue').textContent = value.toFixed(2);
    });
  }

  // Floor shader controls
  const floorColorR = document.getElementById('floorColorR');
  const floorColorG = document.getElementById('floorColorG');
  const floorColorB = document.getElementById('floorColorB');
  const floorColorPicker = document.getElementById('floorColorPicker');
  const floorRoughness = document.getElementById('floorRoughness');
  const floorSpecular = document.getElementById('floorSpecular');

  function updateFloorColor() {
    const r = parseFloat(floorColorR.value);
    const g = parseFloat(floorColorG.value);
    const b = parseFloat(floorColorB.value);
    updateShaderUniforms('floor', 'uBaseColor', [r, g, b]);
    if (document.getElementById('floorColorRValue')) document.getElementById('floorColorRValue').textContent = r.toFixed(2);
    if (document.getElementById('floorColorGValue')) document.getElementById('floorColorGValue').textContent = g.toFixed(2);
    if (document.getElementById('floorColorBValue')) document.getElementById('floorColorBValue').textContent = b.toFixed(2);
    
    const hex = '#' + [r, g, b].map(x => {
      const hex = Math.round(x * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
    if (floorColorPicker) floorColorPicker.value = hex;
  }

  if (floorColorR && floorColorG && floorColorB) {
    floorColorR.addEventListener('input', updateFloorColor);
    floorColorG.addEventListener('input', updateFloorColor);
    floorColorB.addEventListener('input', updateFloorColor);
  }

  if (floorColorPicker) {
    floorColorPicker.addEventListener('input', (e) => {
      const hex = e.target.value;
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      floorColorR.value = r;
      floorColorG.value = g;
      floorColorB.value = b;
      updateFloorColor();
    });
  }

  if (floorRoughness) {
    floorRoughness.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      updateShaderUniforms('floor', 'uRoughness', value);
      if (document.getElementById('floorRoughnessValue')) document.getElementById('floorRoughnessValue').textContent = value.toFixed(2);
    });
  }

  if (floorSpecular) {
    floorSpecular.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      updateShaderUniforms('floor', 'uSpecular', value);
      if (document.getElementById('floorSpecularValue')) document.getElementById('floorSpecularValue').textContent = value.toFixed(2);
    });
  }

  // Copy button functionality - reads current values from UI controls
  function copyShaderValues(shaderType) {
    // Get current values from UI controls
    const colorR = document.getElementById(`${shaderType}ColorR`);
    const colorG = document.getElementById(`${shaderType}ColorG`);
    const colorB = document.getElementById(`${shaderType}ColorB`);
    const roughnessSlider = document.getElementById(`${shaderType}Roughness`);
    const specularSlider = document.getElementById(`${shaderType}Specular`);
    
    if (!colorR || !colorG || !colorB || !roughnessSlider || !specularSlider) {
      console.error(`Could not find controls for shader type: ${shaderType}`);
      return;
    }
    
    // Get current values from sliders
    const r = parseFloat(colorR.value);
    const g = parseFloat(colorG.value);
    const b = parseFloat(colorB.value);
    const roughness = parseFloat(roughnessSlider.value);
    const specular = parseFloat(specularSlider.value);

    const valuesString = `${shaderType}: {
  baseColor: [${r.toFixed(3)}, ${g.toFixed(3)}, ${b.toFixed(3)}],
  roughness: ${roughness.toFixed(3)},
  specular: ${specular.toFixed(3)}
}`;

    // Copy to clipboard
    navigator.clipboard.writeText(valuesString).then(() => {
      console.log(`Copied ${shaderType} shader values to clipboard:`);
      console.log(valuesString);
      alert(`Copied ${shaderType} shader values to clipboard!`);
    }).catch(err => {
      console.error('Failed to copy:', err);
      // Fallback: log to console
      console.log(`\n${shaderType} shader values:\n${valuesString}`);
      prompt('Copy these values:', valuesString);
    });
  }

  // Wire up copy buttons
  const copyBaseBtn = document.getElementById('copyBaseShaderBtn');
  const copyArtistsBtn = document.getElementById('copyArtistsShaderBtn');
  const copyStageBtn = document.getElementById('copyStageShaderBtn');
  const copyPillarsBtn = document.getElementById('copyPillarsShaderBtn');
  const copyFloorBtn = document.getElementById('copyFloorShaderBtn');

  if (copyBaseBtn) {
    copyBaseBtn.addEventListener('click', () => copyShaderValues('base'));
  }
  if (copyArtistsBtn) {
    copyArtistsBtn.addEventListener('click', () => copyShaderValues('artists'));
  }
  if (copyStageBtn) {
    copyStageBtn.addEventListener('click', () => copyShaderValues('stage'));
  }
  if (copyPillarsBtn) {
    copyPillarsBtn.addEventListener('click', () => copyShaderValues('pillars'));
  }
  if (copyFloorBtn) {
    copyFloorBtn.addEventListener('click', () => copyShaderValues('floor'));
  }

  // Copy all shader values function
  function copyAllShaderValues() {
    const shaderTypes = ['base', 'artists', 'stage', 'pillars', 'floor'];
    const allValues = {};
    
    shaderTypes.forEach(shaderType => {
      const colorR = document.getElementById(`${shaderType}ColorR`);
      const colorG = document.getElementById(`${shaderType}ColorG`);
      const colorB = document.getElementById(`${shaderType}ColorB`);
      const roughnessSlider = document.getElementById(`${shaderType}Roughness`);
      const specularSlider = document.getElementById(`${shaderType}Specular`);
      
      if (colorR && colorG && colorB && roughnessSlider && specularSlider) {
        const r = parseFloat(colorR.value);
        const g = parseFloat(colorG.value);
        const b = parseFloat(colorB.value);
        const roughness = parseFloat(roughnessSlider.value);
        const specular = parseFloat(specularSlider.value);
        
        allValues[shaderType] = {
          baseColor: [r.toFixed(3), g.toFixed(3), b.toFixed(3)],
          roughness: roughness.toFixed(3),
          specular: specular.toFixed(3)
        };
      }
    });
    
    // Format as a JavaScript object
    let valuesString = '';
    Object.keys(allValues).forEach(shaderType => {
      const values = allValues[shaderType];
      valuesString += `${shaderType}: {\n  baseColor: [${values.baseColor.join(', ')}],\n  roughness: ${values.roughness},\n  specular: ${values.specular}\n}`;
      if (shaderType !== Object.keys(allValues)[Object.keys(allValues).length - 1]) {
        valuesString += ',\n\n';
      }
    });
    
    const fullString = valuesString;
    
    // Copy to clipboard
    navigator.clipboard.writeText(fullString).then(() => {
      console.log('Copied all shader values to clipboard:');
      console.log(fullString);
      alert('Copied all shader values to clipboard!');
    }).catch(err => {
      console.error('Failed to copy:', err);
      // Fallback: log to console
      console.log('\nAll shader values:\n' + fullString);
      prompt('Copy these values:', fullString);
    });
  }

  // Wire up copy all button
  const copyAllShadersBtn = document.getElementById('copyAllShadersBtn');
  if (copyAllShadersBtn) {
    copyAllShadersBtn.addEventListener('click', copyAllShaderValues);
  }
  
  // Sync all controls to match current shader material values after setup
  Object.keys(shaderMaterials).forEach(shaderType => {
    const material = shaderMaterials[shaderType];
    if (material && material.uniforms) {
      syncControlsToShaderValues(shaderType, material);
    }
  });
}

// Initialize shader controls after meshes are loaded (delay to ensure materials are ready)
setTimeout(() => {
  initShaderControls();
}, 2000);

// NDI streams list
const refreshNdiBtn = document.getElementById('refreshNdiBtn');
const ndiStreamSelect = document.getElementById('ndiStreamSelect');

// Source type dropdown
const sourceTypeSelect = document.getElementById('sourceTypeSelect');
const textureInputGroup = document.getElementById('textureInputGroup');
const ndiStreamGroup = document.getElementById('ndiStreamGroup');

// Handle source type change
sourceTypeSelect.addEventListener('change', (e) => {
  const selectedType = e.target.value;
  
  if (selectedType === 'texture') {
    // Show texture input, hide NDI controls
    textureInputGroup.style.display = 'block';
    ndiStreamGroup.style.display = 'none';
  } else if (selectedType === 'ndi') {
    // Show NDI controls, hide texture input
    textureInputGroup.style.display = 'none';
    ndiStreamGroup.style.display = 'block';
    // Auto-discover NDI streams when switching to NDI mode
    discoverNDIStreams();
  }
});

// Mapping type dropdown change handler
const mappingTypeSelect = document.getElementById('mappingTypeSelect');
if (mappingTypeSelect) {
  mappingTypeSelect.addEventListener('change', (e) => {
    const selectedType = e.target.value;
    currentMappingType = selectedType;
    
    // Swap LED meshes
    loadLEDMeshes(selectedType);
    
    // Hide front screen by default for Festival Mapping, show for Front Projection types
    setTimeout(() => {
      const hideLedFrontCheckbox = document.getElementById('hideLedFront');
      if (selectedType === 'festival') {
        // Hide front screen for Festival Mapping
        if (ledFrontMesh) {
          ledFrontMesh.visible = false;
        }
        if (hideLedFrontCheckbox) {
          hideLedFrontCheckbox.checked = true;
        }
      } else if (selectedType === 'frontProjection' || selectedType === 'frontProjectionPerspective') {
        // Show front screen for Front Projection types
        if (ledFrontMesh) {
          ledFrontMesh.visible = true;
        }
        if (hideLedFrontCheckbox) {
          hideLedFrontCheckbox.checked = false;
        }
      }
      
      // Update LED shaders with current texture after loading
      updateLEDShaders();
    }, 100);
  });
}

// Function to fetch and display available NDI streams
async function discoverNDIStreams() {
  // Add cache-busting parameter to ensure fresh data
  const discoveryUrl = `http://localhost:8080/ndi/discover?t=${Date.now()}`;
  
  // Clear and show loading state
  ndiStreamSelect.innerHTML = '<option value="">Discovering NDI streams...</option>';
  ndiStreamSelect.disabled = true;
  
  try {
    console.log('Attempting to discover NDI streams from:', discoveryUrl);
    const response = await fetch(discoveryUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      cache: 'no-cache', // Prevent browser caching
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Discovery failed:', response.status, errorText);
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const streams = await response.json();
    console.log('Received streams data:', streams);
    
    // Clear and populate the dropdown
    ndiStreamSelect.innerHTML = '';
    
    if (Array.isArray(streams) && streams.length > 0) {
      // Add default option
      const defaultOption = document.createElement('option');
      defaultOption.value = '';
      defaultOption.textContent = 'Select an NDI stream...';
      ndiStreamSelect.appendChild(defaultOption);
      
      // Add stream options
      streams.forEach((stream) => {
        const streamName = typeof stream === 'string' ? stream : (stream.name || stream.sourceName || stream.ndi_name || 'Unknown');
        const option = document.createElement('option');
        option.value = streamName;
        option.textContent = streamName;
        ndiStreamSelect.appendChild(option);
      });
      
      ndiStreamSelect.disabled = false;
      
      // Auto-show first stream in separate window
      const firstStream = streams[0];
      const firstStreamName = typeof firstStream === 'string' ? firstStream : (firstStream.name || firstStream.sourceName || firstStream.ndi_name || 'Unknown');
      showNDIStreamInWindow(firstStreamName);
    } else {
      const noStreamsOption = document.createElement('option');
      noStreamsOption.value = '';
      noStreamsOption.textContent = 'No NDI streams found';
      ndiStreamSelect.appendChild(noStreamsOption);
      ndiStreamSelect.disabled = true;
    }
  } catch (error) {
    console.error('Error discovering NDI streams:', error);
    ndiStreamSelect.innerHTML = '<option value="">Error: Could not discover NDI streams. Check backend service.</option>';
    ndiStreamSelect.disabled = true;
    console.log('Note: NDI discovery requires a backend service at:', discoveryUrl);
  }
}

// Refresh NDI streams button
refreshNdiBtn.addEventListener('click', () => {
  discoverNDIStreams();
});

// Handle NDI stream selection change
ndiStreamSelect.addEventListener('change', (e) => {
  const selectedStream = e.target.value;
  if (selectedStream && selectedStream !== '') {
    loadNDIStream(selectedStream);
  }
});

// Don't auto-discover on page load - only when switching to NDI mode

// Store reference to NDI stream windows
const ndiStreamWindows = new Map();

// Function to show NDI stream in a separate window
function showNDIStreamInWindow(streamName) {
  console.log('Opening NDI stream in separate window:', streamName);
  
  // Check if window already exists for this stream
  if (ndiStreamWindows.has(streamName)) {
    const existingWindow = ndiStreamWindows.get(streamName);
    if (!existingWindow.closed) {
      existingWindow.focus();
      return;
    } else {
      ndiStreamWindows.delete(streamName);
    }
  }
  
  // Encode stream name for URL
  const encodedStreamName = encodeURIComponent(streamName);
  const ndiStreamUrl = `http://localhost:8080/ndi/stream/${encodedStreamName}`;
  
  // Create HTML content for the popup window
  const popupHTML = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>NDI Stream: ${streamName}</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            body {
                background: #000;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                overflow: hidden;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            }
            .stream-container {
                position: relative;
                width: 100%;
                height: 100%;
                display: flex;
                justify-content: center;
                align-items: center;
            }
            video {
                max-width: 100%;
                max-height: 100%;
                width: auto;
                height: auto;
                object-fit: contain;
            }
            .stream-info {
                position: absolute;
                top: 10px;
                left: 10px;
                background: rgba(0, 255, 136, 0.9);
                color: #000;
                padding: 8px 12px;
                border-radius: 6px;
                font-size: 12px;
                font-weight: 500;
                z-index: 100;
            }
            .error-message {
                color: #ff6b6b;
                text-align: center;
                padding: 20px;
                font-size: 14px;
            }
        </style>
    </head>
    <body>
        <div class="stream-container">
            <div class="stream-info">NDI: ${streamName}</div>
            <video id="streamVideo" muted playsinline autoplay></video>
            <div id="errorMessage" class="error-message" style="display: none;"></div>
        </div>
        <script>
            const video = document.getElementById('streamVideo');
            const errorMessage = document.getElementById('errorMessage');
            const streamUrl = '${ndiStreamUrl}';
            
            // First, check if the endpoint returns an error
            fetch(streamUrl, { method: 'HEAD' })
              .then(response => {
                if (!response.ok) {
                  // If it's an error response, try to get the error details
                  return fetch(streamUrl)
                    .then(res => res.json())
                    .then(errorData => {
                      let errorText = 'Error loading NDI stream.\\n\\n';
                      if (errorData.message) {
                        errorText += errorData.message + '\\n\\n';
                      }
                      if (errorData.solution) {
                        errorText += 'Solution: ' + errorData.solution + '\\n\\n';
                      }
                      if (errorData.instructions && Array.isArray(errorData.instructions)) {
                        errorText += 'Instructions:\\n' + errorData.instructions.join('\\n');
                      } else if (errorData.troubleshooting && Array.isArray(errorData.troubleshooting)) {
                        errorText += 'Troubleshooting:\\n' + errorData.troubleshooting.join('\\n');
                      }
                      errorMessage.textContent = errorText.replace(/\\\\n/g, '\\n');
                      errorMessage.style.display = 'block';
                      errorMessage.style.whiteSpace = 'pre-line';
                    })
                    .catch(() => {
                      errorMessage.textContent = 'Error: Backend returned status ' + response.status;
                      errorMessage.style.display = 'block';
                    });
                } else {
                  // Response is OK, try to load as video
                  video.src = streamUrl;
                  video.crossOrigin = 'anonymous';
                  
                  video.addEventListener('loadeddata', () => {
                    console.log('NDI stream loaded in popup');
                    video.play().catch(err => {
                      console.error('Error playing video:', err);
                      errorMessage.textContent = 'Error: Could not play stream. ' + err.message;
                      errorMessage.style.display = 'block';
                    });
                  });
                  
                  video.addEventListener('error', (error) => {
                    console.error('Error loading NDI stream:', error);
                    errorMessage.textContent = 'Error loading NDI stream. The stream may not be available or FFmpeg does not have NDI support.';
                    errorMessage.style.display = 'block';
                  });
                  
                  video.load();
                }
              })
              .catch(err => {
                console.error('Error checking stream:', err);
                errorMessage.textContent = 'Error: Could not connect to backend service.';
                errorMessage.style.display = 'block';
              });
            
            // Handle window close
            window.addEventListener('beforeunload', () => {
                if (window.opener) {
                    window.opener.postMessage({ type: 'ndiWindowClosed', streamName: '${streamName}' }, '*');
                }
            });
        </script>
    </body>
    </html>
  `;
  
  // Open new window
  const popupWindow = window.open('', `ndi-${streamName}`, 'width=640,height=360,resizable=yes,scrollbars=no');
  
  if (popupWindow) {
    popupWindow.document.write(popupHTML);
    popupWindow.document.close();
    ndiStreamWindows.set(streamName, popupWindow);
    
    // Listen for window close message
    window.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'ndiWindowClosed' && event.data.streamName === streamName) {
        ndiStreamWindows.delete(streamName);
      }
    });
    
    // Also check if window was closed manually
    const checkClosed = setInterval(() => {
      if (popupWindow.closed) {
        ndiStreamWindows.delete(streamName);
        clearInterval(checkClosed);
      }
    }, 1000);
  } else {
    console.error('Failed to open popup window. Popup blocker may be active.');
    alert('Failed to open popup window. Please allow popups for this site.');
  }
}

const mapping = document.getElementById('mapping');
const overlayVideo = document.getElementById('overlayVideo');
const overlayImage = document.getElementById('overlayImage');
const frameInfo = document.getElementById('frameInfo');
const timelineContainer = document.getElementById('timelineContainer');
const timelineSlider = document.getElementById('timelineSlider');
let currentVideoElement = null;
let currentVideoPath = null; // Store current video path/filename
let videoFrameRate = 30; // Default frame rate, will be updated if available
let isSeeking = false;

// Function to adjust mapping overlay to match aspect ratio
function adjustMappingAspectRatio(width, height) {
  const maxWidth = 400; // Maximum width in pixels
  const maxHeight = 300; // Maximum height in pixels
  const minWidth = 200; // Minimum width in pixels
  const minHeight = 100; // Minimum height in pixels
  
  // Calculate exact aspect ratio
  const aspectRatio = width / height;
  
  let overlayWidth, overlayHeight;
  
  // Calculate optimal size maintaining exact aspect ratio
  // Try fitting to max width first
  overlayWidth = maxWidth;
  overlayHeight = overlayWidth / aspectRatio;
  
  // If height exceeds max, fit to max height instead
  if (overlayHeight > maxHeight) {
    overlayHeight = maxHeight;
    overlayWidth = overlayHeight * aspectRatio;
  }
  
  // Ensure minimum size while maintaining aspect ratio
  if (overlayWidth < minWidth) {
    overlayWidth = minWidth;
    overlayHeight = overlayWidth / aspectRatio;
  }
  if (overlayHeight < minHeight) {
    overlayHeight = minHeight;
    overlayWidth = overlayHeight * aspectRatio;
  }
  
  // Set dimensions with high precision to maintain exact aspect ratio
  // This prevents black bars on very wide images
  mapping.style.width = `${overlayWidth}px`;
  mapping.style.height = `${overlayHeight}px`;
  
  // Reset scale to 1 when adjusting aspect ratio
  const currentScale = parseFloat(overlaySizeSlider.value) || 1.0;
  mapping.style.transform = `translateX(-50%) scale(${currentScale})`;
}

// Video overlay size control
const overlaySizeSlider = document.getElementById('overlaySizeSlider');
const overlaySizeValue = document.getElementById('overlaySizeValue');

overlaySizeSlider.addEventListener('input', (e) => {
  const value = parseFloat(e.target.value);
  const scale = value;
  mapping.style.transform = `translateX(-50%) scale(${scale})`;
  overlaySizeValue.textContent = value.toFixed(1);
});

// Function to extract filename from path
function getFileName(path) {
  if (!path) return '';
  // Handle both forward and backslashes
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
}

// Function to detect codec from video element or path
function getVideoCodec(video, path) {
  if (!video) return 'unknown';
  
  // Try to detect codec from file extension
  if (path) {
    const ext = path.toLowerCase().split('.').pop();
    // MP4 typically uses H.264 or H.265
    if (ext === 'mp4') {
      // Try to detect from video capabilities
      if (video.canPlayType && video.canPlayType('video/mp4; codecs="avc1.42E01E"')) {
        return 'H.264';
      } else if (video.canPlayType && video.canPlayType('video/mp4; codecs="hev1.1.6.L93.B0"')) {
        return 'H.265';
      }
      return 'H.264'; // Default assumption for MP4
    }
    if (ext === 'webm') return 'VP8/VP9';
    if (ext === 'ogg' || ext === 'ogv') return 'Theora';
  }
  
  // Fallback: try to detect from video src or canPlayType
  if (video.src) {
    if (video.src.includes('.mp4')) {
      return 'H.264'; // Default for MP4
    }
  }
  
  return 'unknown';
}

// Function to update frame info display
function updateFrameInfo(video) {
  const fileNameDisplay = document.getElementById('fileNameDisplay');
  const timeDisplay = document.getElementById('timeDisplay');
  const totalTimeDisplay = document.getElementById('totalTimeDisplay');
  
  // Helper function to format time as mm:ss
  const formatTime = (timeInSeconds) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };
  
  // Extract filename and codec
  const fileName = getFileName(currentVideoPath);
  const codec = getVideoCodec(video, currentVideoPath);
  
  if (!video || !isFinite(video.duration) || video.duration === 0) {
    if (frameInfo) {
      const frameText = frameInfo.querySelector('span:nth-child(3)');
      if (frameText) frameText.textContent = 'Frame: 0 / 0';
    }
    if (fileNameDisplay) {
      fileNameDisplay.textContent = fileName ? `${fileName} (${videoFrameRate} fps, ${codec})` : '';
    }
    if (timeDisplay) timeDisplay.textContent = '00:00';
    if (totalTimeDisplay) totalTimeDisplay.textContent = '00:00';
    return;
  }
  
  const currentTime = video.currentTime || 0;
  const duration = video.duration;
  const currentFrame = Math.floor(currentTime * videoFrameRate);
  const totalFrames = Math.floor(duration * videoFrameRate);
  
  // Update filename display with codec info
  if (fileNameDisplay) {
    fileNameDisplay.textContent = `${fileName} (${videoFrameRate} fps, ${codec})`;
  }
  
  // Update frame counter
  if (frameInfo) {
    // Find the span that contains "Frame:" (third span, after fileNameDisplay and separator)
    const frameText = frameInfo.querySelector('span:nth-child(3)');
    if (frameText) frameText.textContent = `Frame: ${currentFrame} / ${totalFrames}`;
  }
  
  // Update current time display (format as mm:ss)
  if (timeDisplay) {
    timeDisplay.textContent = formatTime(currentTime);
  }
  
  // Update total time display (format as mm:ss)
  if (totalTimeDisplay) {
    totalTimeDisplay.textContent = formatTime(duration);
  }
  
  // Update timeline slider (only if not currently seeking)
  if (!isSeeking && duration > 0) {
    const percentage = (currentTime / duration) * 100;
    timelineSlider.value = percentage;
  }
}

// Timeline slider event handlers
timelineSlider.addEventListener('mousedown', () => {
  isSeeking = true;
});

timelineSlider.addEventListener('mouseup', () => {
  isSeeking = false;
  if (currentVideoElement && isFinite(currentVideoElement.duration)) {
    const percentage = parseFloat(timelineSlider.value);
    const newTime = (percentage / 100) * currentVideoElement.duration;
    currentVideoElement.currentTime = newTime;
    overlayVideo.currentTime = newTime;
    updateFrameInfo(currentVideoElement);
  }
});

timelineSlider.addEventListener('input', () => {
  if (currentVideoElement && isFinite(currentVideoElement.duration)) {
    const percentage = parseFloat(timelineSlider.value);
    const newTime = (percentage / 100) * currentVideoElement.duration;
    currentVideoElement.currentTime = newTime;
    overlayVideo.currentTime = newTime;
    updateFrameInfo(currentVideoElement);
  }
});

// Background color controls
function updateBackgroundColor() {
  const r = parseFloat(document.getElementById('backgroundColorR')?.value || 0.164);
  const g = parseFloat(document.getElementById('backgroundColorG')?.value || 0.164);
  const b = parseFloat(document.getElementById('backgroundColorB')?.value || 0.164);
  
  // Update scene background
  scene.background = new THREE.Color(r, g, b);
}

// Initialize background color controls
const backgroundColorR = document.getElementById('backgroundColorR');
const backgroundColorG = document.getElementById('backgroundColorG');
const backgroundColorB = document.getElementById('backgroundColorB');
const backgroundColorPicker = document.getElementById('backgroundColorPicker');

if (backgroundColorR && backgroundColorG && backgroundColorB) {
  // RGB sliders
  backgroundColorR.addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    updateBackgroundColor();
    const valueEl = document.getElementById('backgroundColorRValue');
    if (valueEl) valueEl.textContent = value.toFixed(3);
    // Update color picker
    if (backgroundColorPicker) {
      const g = parseFloat(backgroundColorG.value);
      const b = parseFloat(backgroundColorB.value);
      const hex = '#' + [value, g, b].map(x => {
        const hex = Math.round(x * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      }).join('');
      backgroundColorPicker.value = hex;
    }
  });

  backgroundColorG.addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    updateBackgroundColor();
    const valueEl = document.getElementById('backgroundColorGValue');
    if (valueEl) valueEl.textContent = value.toFixed(3);
    // Update color picker
    if (backgroundColorPicker) {
      const r = parseFloat(backgroundColorR.value);
      const b = parseFloat(backgroundColorB.value);
      const hex = '#' + [r, value, b].map(x => {
        const hex = Math.round(x * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      }).join('');
      backgroundColorPicker.value = hex;
    }
  });

  backgroundColorB.addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    updateBackgroundColor();
    const valueEl = document.getElementById('backgroundColorBValue');
    if (valueEl) valueEl.textContent = value.toFixed(3);
    // Update color picker
    if (backgroundColorPicker) {
      const r = parseFloat(backgroundColorR.value);
      const g = parseFloat(backgroundColorG.value);
      const hex = '#' + [r, g, value].map(x => {
        const hex = Math.round(x * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      }).join('');
      backgroundColorPicker.value = hex;
    }
  });

  // Color picker
  if (backgroundColorPicker) {
    backgroundColorPicker.addEventListener('input', (e) => {
      const hex = e.target.value;
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      
      // Update RGB sliders
      backgroundColorR.value = r;
      backgroundColorG.value = g;
      backgroundColorB.value = b;
      
      // Update value displays
      const valueElR = document.getElementById('backgroundColorRValue');
      const valueElG = document.getElementById('backgroundColorGValue');
      const valueElB = document.getElementById('backgroundColorBValue');
      if (valueElR) valueElR.textContent = r.toFixed(3);
      if (valueElG) valueElG.textContent = g.toFixed(3);
      if (valueElB) valueElB.textContent = b.toFixed(3);
      
      // Update scene background
      updateBackgroundColor();
    });
  }
}

// Function to copy background color values
function copyBackgroundColorValues() {
  const r = parseFloat(backgroundColorR?.value || 0.164);
  const g = parseFloat(backgroundColorG?.value || 0.164);
  const b = parseFloat(backgroundColorB?.value || 0.164);
  
  const values = {
    backgroundColor: [r.toFixed(3), g.toFixed(3), b.toFixed(3)]
  };
  
  // Format as a JavaScript object
  const valuesString = JSON.stringify(values, null, 2);
  
  // Copy to clipboard
  navigator.clipboard.writeText(valuesString).then(() => {
    console.log('Background color values copied to clipboard');
  }).catch(err => {
    console.error('Failed to copy background color values:', err);
    // Fallback: show in prompt
    prompt('Copy these values:', valuesString);
  });
}

// Wire up copy background color button
const copyBackgroundColorBtn = document.getElementById('copyBackgroundColorBtn');
if (copyBackgroundColorBtn) {
  copyBackgroundColorBtn.addEventListener('click', copyBackgroundColorValues);
}

// Checkbox to toggle mapping visibility
const showMappingCheckbox = document.getElementById('showMapping');
const hideLedFrontCheckbox = document.getElementById('hideLedFront');
const djDeckHeightSlider = document.getElementById('djDeckHeightSlider');
const djDeckHeightValue = document.getElementById('djDeckHeightValue');

// Handle hide LED front checkbox
hideLedFrontCheckbox.addEventListener('change', (e) => {
  if (ledFrontMesh) {
    ledFrontMesh.visible = !e.target.checked;
  }
});

// Handle DJ deck height slider
djDeckHeightSlider.addEventListener('input', (e) => {
  const value = parseFloat(e.target.value); // Value in meters (0-12)
  djDeckHeightValue.textContent = value.toFixed(1) + 'm';
  
  // Control the height of the DJ liftable stage mesh
  // Convert meters to Three.js units (assuming 1 meter = 1 unit, or adjust as needed)
  if (djLiftableMesh) {
    djLiftableMesh.position.y = value;
  }
});

showMappingCheckbox.addEventListener('change', (e) => {
  if (e.target.checked) {
    // Show if there's a video or texture loaded
    if (currentVideoElement || material.uniforms.uHasTexture.value === 1.0) {
      mapping.classList.add('active');
    }
  } else {
    mapping.classList.remove('active');
  }
});

// ============================================
// Playback Controls
// ============================================
const playbackControls = {
  // DOM Elements (will be set in init)
  playPauseBtn: null,
  jumpToStartBtn: null,
  rewindBtn: null,
  jumpToEndBtn: null,
  muteBtn: null,
  playbackMenu: null,
  
  // Constants
  TIME_JUMP_AMOUNT: 10, // Jump amount in seconds
  
  // Icons
  icons: {
    play: '<span class="material-icons">play_arrow</span>',
    pause: '<span class="material-icons">pause</span>',
    rewind: '<span class="material-icons">replay_10</span>',
    forward: '<span class="material-icons">forward_10</span>',
    unmuted: '<span class="material-icons">volume_up</span>',
    muted: '<span class="material-icons">volume_off</span>'
  },
  
  // Update play/pause button icon
  updatePlayPauseIcon() {
    if (!this.playPauseBtn) return;
    if (!currentVideoElement) {
      this.playPauseBtn.innerHTML = this.icons.play;
      return;
    }
    this.playPauseBtn.innerHTML = currentVideoElement.paused ? this.icons.play : this.icons.pause;
  },
  
  // Update mute button icon
  updateMuteIcon() {
    if (!this.muteBtn) return;
    if (!currentVideoElement) {
      this.muteBtn.innerHTML = this.icons.unmuted;
      return;
    }
    this.muteBtn.innerHTML = currentVideoElement.muted ? this.icons.muted : this.icons.unmuted;
  },
  
  // Toggle play/pause
  togglePlayPause() {
    if (!currentVideoElement) return;
    
    if (currentVideoElement.paused) {
      currentVideoElement.play().catch(err => console.error('Error playing video:', err));
      overlayVideo.play().catch(err => console.error('Error playing overlay video:', err));
    } else {
      currentVideoElement.pause();
      overlayVideo.pause();
    }
    this.updatePlayPauseIcon();
  },
  
  // Jump to beginning
  jumpToStart() {
    if (!currentVideoElement) return;
    
    currentVideoElement.currentTime = 0;
    overlayVideo.currentTime = 0;
    updateFrameInfo(currentVideoElement);
  },
  
  // Jump by seconds (positive for forward, negative for backward)
  jumpSeconds(seconds) {
    if (!currentVideoElement) return;
    
    const newTime = Math.max(0, Math.min(
      currentVideoElement.duration || Infinity,
      currentVideoElement.currentTime + seconds
    ));
    
    currentVideoElement.currentTime = newTime;
    overlayVideo.currentTime = newTime;
    updateFrameInfo(currentVideoElement);
  },
  
  // Jump by frames (kept for backwards compatibility, converts to seconds)
  jumpFrames(frames) {
    if (!currentVideoElement || videoFrameRate <= 0) return;
    const timeOffset = frames / videoFrameRate;
    this.jumpSeconds(timeOffset);
  },
  
  // Toggle mute
  toggleMute() {
    if (!currentVideoElement) return;
    currentVideoElement.muted = !currentVideoElement.muted;
    this.updateMuteIcon();
  },
  
  // Enable/disable all controls
  setEnabled(enabled) {
    if (!this.playPauseBtn || !this.jumpToStartBtn || !this.rewindBtn || !this.jumpToEndBtn || !this.muteBtn) {
      return;
    }
    
    this.playPauseBtn.disabled = !enabled;
    this.jumpToStartBtn.disabled = !enabled;
    this.rewindBtn.disabled = !enabled;
    this.jumpToEndBtn.disabled = !enabled;
    this.muteBtn.disabled = !enabled;
    
    if (enabled && currentVideoElement) {
      this.updatePlayPauseIcon();
      this.updateMuteIcon();
      // Set volume to 100% when video is enabled
      currentVideoElement.volume = 1.0;
    }
  },
  
  // Initialize event listeners
  init() {
    // Get DOM elements
    this.playPauseBtn = document.getElementById('playPauseBtn');
    this.jumpToStartBtn = document.getElementById('jumpToStartBtn');
    this.rewindBtn = document.getElementById('rewindBtn');
    this.jumpToEndBtn = document.getElementById('jumpToEndBtn');
    this.muteBtn = document.getElementById('muteBtn');
    this.playbackMenu = document.getElementById('playbackMenu');
    
    // Check if elements exist
    if (!this.playPauseBtn || !this.jumpToStartBtn || !this.rewindBtn || !this.jumpToEndBtn || !this.muteBtn) {
      console.error('Playback control elements not found', {
        playPauseBtn: !!this.playPauseBtn,
        jumpToStartBtn: !!this.jumpToStartBtn,
        rewindBtn: !!this.rewindBtn,
        jumpToEndBtn: !!this.jumpToEndBtn,
        muteBtn: !!this.muteBtn
      });
      return;
    }
    
    // Bind event listeners with proper context
    this.playPauseBtn.addEventListener('click', (e) => {
      console.log('Play/Pause button clicked');
      this.togglePlayPause();
    }, true); // Use capture phase
    
    this.jumpToStartBtn.addEventListener('click', (e) => {
      console.log('Jump to start button clicked');
      this.jumpToStart();
    }, true);
    
    this.rewindBtn.addEventListener('click', (e) => {
      console.log('Rewind button clicked');
      this.jumpSeconds(-this.TIME_JUMP_AMOUNT);
    }, true);
    
    this.jumpToEndBtn.addEventListener('click', (e) => {
      console.log('Forward button clicked');
      this.jumpSeconds(this.TIME_JUMP_AMOUNT);
    }, true);
    
    this.muteBtn.addEventListener('click', (e) => {
      console.log('Mute button clicked');
      this.toggleMute();
    }, true);
    
    // Ensure buttons are clickable
    this.playPauseBtn.style.pointerEvents = 'auto';
    this.jumpToStartBtn.style.pointerEvents = 'auto';
    this.rewindBtn.style.pointerEvents = 'auto';
    this.jumpToEndBtn.style.pointerEvents = 'auto';
    this.muteBtn.style.pointerEvents = 'auto';
    
    // Make sure buttons aren't disabled unless needed
    if (!this.playPauseBtn.disabled) {
      console.log('Playback controls initialized successfully');
    }
    
    // Initialize state
    this.setEnabled(!!currentVideoElement);
  }
};

// Initialize playback controls when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    playbackControls.init();
  });
} else {
  playbackControls.init();
}

// Update button states based on video availability (wrapper for compatibility)
function updatePlaybackButtons() {
  playbackControls.setEnabled(currentVideoElement !== null);
}

// Wrapper functions for backwards compatibility
function updatePlayPauseButton() {
  playbackControls.updatePlayPauseIcon();
}

function updateMuteButton() {
  playbackControls.updateMuteIcon();
}

// Initialize button states
updatePlaybackButtons();

// WebSocket connection for frame streaming
let ndiWebSocket = null;
let canvasTexture = null;
let frameCanvas = null;
let frameContext = null;

// Function to load NDI stream as texture using WebSocket + Canvas
function loadNDIStream(streamName) {
  // Clean up previous video element and texture if they exist
  if (currentVideoElement) {
    // Stop and remove the old video
    currentVideoElement.pause();
    currentVideoElement.currentTime = 0;
    currentVideoElement.src = '';
    currentVideoElement.load();
    
    // Dispose of the old video texture if it exists
    const oldTexture = material.uniforms.uTexture.value;
    if (oldTexture) {
      if (oldTexture instanceof THREE.VideoTexture) {
        oldTexture.dispose();
      } else if (oldTexture instanceof THREE.CanvasTexture) {
        oldTexture.dispose();
      }
      console.log('Disposed old texture');
    }
    
    currentVideoElement = null;
    updatePlaybackButtons();
  }
  
  // Close existing WebSocket connection
  if (ndiWebSocket) {
    ndiWebSocket.send(JSON.stringify({ type: 'disconnect' }));
    ndiWebSocket.close();
    ndiWebSocket = null;
  }
  
  // Clear the texture from material temporarily
    material.uniforms.uTexture.value = null;
    material.uniforms.uHasTexture.value = 0.0;
    
    // Update LED shaders (clear texture)
    updateLEDShaders();
  material.needsUpdate = true;
  
  // Hide overlay and frame info until new stream is loaded
  mapping.classList.remove('active');
  frameInfo.classList.remove('active');
  timelineContainer.classList.remove('active');
  overlayVideo.src = '';
  overlayImage.src = '';
  
  // Hide playback menu until stream is loaded
  if (playbackMenu) {
    playbackMenu.style.display = 'none';
  }
  
  // Update status
    if (textureStatus) {
      textureStatus.textContent = `Connecting to NDI stream: ${streamName}...`;
      textureStatus.classList.remove('loaded');
    }
  
  console.log('Loading NDI stream via WebSocket:', streamName);
  
  // Create canvas for frame rendering
  if (!frameCanvas) {
    frameCanvas = document.createElement('canvas');
    frameCanvas.width = 1920;
    frameCanvas.height = 1080;
    frameContext = frameCanvas.getContext('2d');
  }
  
  // Create CanvasTexture
  canvasTexture = new THREE.CanvasTexture(frameCanvas);
  canvasTexture.wrapS = THREE.RepeatWrapping;
  canvasTexture.wrapT = THREE.RepeatWrapping;
  canvasTexture.minFilter = THREE.LinearFilter;
  canvasTexture.magFilter = THREE.LinearFilter;
  canvasTexture.colorSpace = THREE.SRGBColorSpace;
  
  // Connect to WebSocket for frame streaming
  const wsUrl = 'ws://localhost:8080/ndi/ws';
  ndiWebSocket = new WebSocket(wsUrl);
  
  ndiWebSocket.onopen = () => {
    console.log('WebSocket connected, requesting stream:', streamName);
    // Request the stream
    ndiWebSocket.send(JSON.stringify({
      type: 'connect',
      streamName: streamName
    }));
    if (textureStatus) {
      if (textureStatus) {
        textureStatus.textContent = `Connected to ${streamName}, receiving frames...`;
      }
    }
  };
  
  ndiWebSocket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      
      if (data.type === 'frame') {
        // Received a frame - draw it to canvas and update texture
        const img = new Image();
        img.onload = () => {
          // Draw image to canvas
          frameContext.drawImage(img, 0, 0, frameCanvas.width, frameCanvas.height);
          
          // Update texture
          canvasTexture.needsUpdate = true;
          
          // Apply texture to material if not already applied
          if (material.uniforms.uTexture.value !== canvasTexture) {
            material.uniforms.uTexture.value = canvasTexture;
            material.uniforms.uHasTexture.value = 1.0;
            material.uniforms.uIsImageTexture.value = 0.0; // NDI stream is video, not image
            
            // Update LED shaders with the new texture
            updateLEDShaders();
            material.needsUpdate = true;
            console.log('NDI stream texture applied to plane via Canvas');
          }
          
          // Update status on first frame
          if (textureStatus && !textureStatus.classList.contains('loaded')) {
            textureStatus.textContent = `Loaded NDI Stream: ${streamName}`;
            textureStatus.classList.add('loaded');
          }
          updatePlaybackButtons();
        };
        img.onerror = (err) => {
          console.error('Error loading frame image:', err);
        };
        img.src = 'data:image/jpeg;base64,' + data.data;
        
      } else if (data.type === 'error') {
        console.error('WebSocket error:', data.message);
        if (textureStatus) {
          if (textureStatus) {
            textureStatus.textContent = `Error: ${data.message}`;
            textureStatus.classList.remove('loaded');
          }
        }
        
        if (data.instructions && Array.isArray(data.instructions)) {
          console.log('Instructions:', data.instructions);
        }
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  };
  
  ndiWebSocket.onerror = (error) => {
    console.error('WebSocket error:', error);
    if (textureStatus) {
      if (textureStatus) {
        textureStatus.textContent = 'Error: WebSocket connection failed';
        textureStatus.classList.remove('loaded');
      }
    }
  };
  
  ndiWebSocket.onclose = () => {
    console.log('WebSocket closed');
    ndiWebSocket = null;
  };
}

// Default video path
const DEFAULT_VIDEO_PATH = '/assets/videos/shG010_Eva_v12.mp4';

// Video assets dropdown
const videoAssetSelect = document.getElementById('videoAssetSelect');
if (videoAssetSelect) {
  videoAssetSelect.addEventListener('change', (e) => {
    const selectedVideo = e.target.value;
    if (selectedVideo) {
      loadVideoFromPath(selectedVideo);
      // Reset file input
      if (textureInput) {
        textureInput.value = '';
      }
    }
  });
}

// Function to load video from path
function loadVideoFromPath(videoPath) {
  // Store current video path
  currentVideoPath = videoPath;
  
  // Clean up previous video element if it exists
  if (currentVideoElement) {
    currentVideoElement.pause();
    currentVideoElement.src = '';
    currentVideoElement.load();
    currentVideoElement = null;
    updatePlaybackButtons();
  }
  
  // Hide overlay and frame info until new video is loaded
  mapping.classList.remove('active');
  frameInfo.classList.remove('active');
  timelineContainer.classList.remove('active');
  overlayVideo.src = '';
  overlayImage.src = '';
  
  // Hide playback menu until video is loaded
  if (playbackMenu) {
    playbackMenu.style.display = 'none';
  }

  // Determine video URL
  let videoUrl;
  // If path starts with /assets/videos/, it's from the dropdown (public folder)
  if (videoPath.startsWith('/assets/videos/')) {
    videoUrl = videoPath; // Use path directly (served by Vite from public folder)
  } else if (videoPath === DEFAULT_VIDEO_PATH) {
    // Use public folder path (automatically served by Vite)
    videoUrl = '/assets/videos/shG010_Eva_v12.mp4';
  } else {
    // Try file:// URL as fallback (may not work due to browser security)
    videoUrl = 'file:///' + videoPath.replace(/\\/g, '/');
  }
  
  // Create video element
  const video = document.createElement('video');
  video.src = videoUrl;
  video.crossOrigin = 'anonymous';
  video.loop = true;
  video.muted = true; // Start muted for autoplay to work (browser policy)
  video.volume = 1.0; // Set volume to 100%
  video.playsInline = true;
  
  // Adjust mapping overlay to match video aspect ratio as soon as metadata is available
  // Add listener immediately (before loadeddata) to catch the event
  const handleVideoMetadata = () => {
    if (video.videoWidth && video.videoHeight) {
      adjustMappingAspectRatio(video.videoWidth, video.videoHeight);
    }
  };
  video.addEventListener('loadedmetadata', handleVideoMetadata);
  // If metadata is already loaded, call immediately
  if (video.readyState >= 1 && video.videoWidth && video.videoHeight) {
    adjustMappingAspectRatio(video.videoWidth, video.videoHeight);
  }
  
  video.addEventListener('loadeddata', () => {
    // Create video texture
    const videoTexture = new THREE.VideoTexture(video);
    videoTexture.wrapS = THREE.RepeatWrapping;
    videoTexture.wrapT = THREE.RepeatWrapping;
    videoTexture.minFilter = THREE.LinearFilter;
    videoTexture.magFilter = THREE.LinearFilter;
    videoTexture.colorSpace = THREE.SRGBColorSpace; // Use sRGB for accurate colors
    videoTexture.flipY = true; // Flip Y to match Three.js coordinate system
    
    // Apply texture to shader material
    material.uniforms.uTexture.value = videoTexture;
    material.uniforms.uHasTexture.value = 1.0;
    material.uniforms.uIsImageTexture.value = 0.0; // Mark as video texture
    material.needsUpdate = true;
    
    // Update LED shaders with the new video texture
    updateLEDShaders();
    
    // Set up overlay video to show current frame
    overlayVideo.src = videoUrl;
    overlayVideo.crossOrigin = 'anonymous';
    overlayVideo.loop = true;
    overlayVideo.muted = true;
    overlayVideo.playsInline = true;
    overlayVideo.style.display = 'block';
    overlayImage.style.display = 'none';
    
    // Also listen to overlayVideo as fallback for aspect ratio
    const handleOverlayMetadata = () => {
      if (overlayVideo.videoWidth && overlayVideo.videoHeight && (!video.videoWidth || !video.videoHeight)) {
        adjustMappingAspectRatio(overlayVideo.videoWidth, overlayVideo.videoHeight);
      }
    };
    overlayVideo.addEventListener('loadedmetadata', handleOverlayMetadata);
    // If overlay metadata is already loaded, call immediately
    if (overlayVideo.readyState >= 1 && overlayVideo.videoWidth && overlayVideo.videoHeight && (!video.videoWidth || !video.videoHeight)) {
      adjustMappingAspectRatio(overlayVideo.videoWidth, overlayVideo.videoHeight);
    }
    
    // Try to get frame rate from video metadata (default to 30fps)
    videoFrameRate = 30; // Default, could be improved with actual video metadata
    
    // Sync overlay video with main video and update frame info
    const syncOverlay = () => {
      if (video.readyState >= 2) {
        overlayVideo.currentTime = video.currentTime;
        updateFrameInfo(video);
      }
    };
    
    // Sync on timeupdate
    video.addEventListener('timeupdate', syncOverlay);
    
    // Show overlay if checkbox is checked
    if (showMappingCheckbox.checked) {
      mapping.classList.add('active');
    }
    
    // Show frame info and timeline, update them
    frameInfo.classList.add('active');
    timelineContainer.classList.add('active');
    
    // Show playback menu for videos
    if (playbackMenu) {
      playbackMenu.style.display = 'block';
    }
    // Initialize timeline max value
    if (isFinite(video.duration) && video.duration > 0) {
      timelineSlider.max = 100;
    }
    updateFrameInfo(video);
    
    // Play both videos
    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.then(() => {
        overlayVideo.play().catch(err => {
          console.error('Error playing overlay video:', err);
        });
        updatePlayPauseButton();
        updateMuteButton();
      }).catch(err => {
        console.error('Error playing video:', err);
        // If autoplay fails, don't show error - user can click play manually
        // The video is still loaded and ready to play
        updatePlayPauseButton();
        updateMuteButton();
      });
    }
    
    currentVideoElement = video;
    const fileName = videoPath.split('\\').pop() || videoPath.split('/').pop();
    if (textureStatus) {
      textureStatus.textContent = fileName;
      textureStatus.classList.add('loaded');
    }
    
    // Update video asset dropdown to show current selection
    if (videoAssetSelect && videoPath.startsWith('/assets/videos/')) {
      videoAssetSelect.value = videoPath;
    }
    
    // Enable playback buttons
    updatePlaybackButtons();
  });
  
  video.addEventListener('error', (error) => {
    if (textureStatus) {
      textureStatus.textContent = 'Error loading video (check file path)';
      textureStatus.classList.remove('loaded');
    }
    console.error('Error loading video:', error);
  });
  
  // Start loading the video
  video.load();
}

textureInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  // Store current video path (filename for uploaded files)
  currentVideoPath = file.name;
  
  // Reset video asset dropdown when file is selected
  if (videoAssetSelect) {
    videoAssetSelect.value = '';
  }

  // Clean up previous video element if it exists
  if (currentVideoElement) {
    currentVideoElement.pause();
    currentVideoElement.src = '';
    currentVideoElement.load();
    currentVideoElement = null;
    updatePlaybackButtons();
  }
  
  // Hide overlay and frame info until new video is loaded
  mapping.classList.remove('active');
  frameInfo.classList.remove('active');
  timelineContainer.classList.remove('active');
  overlayVideo.src = '';
  overlayImage.src = '';

  // Check if it's a video file
  if (file.type.startsWith('video/') || file.name.toLowerCase().endsWith('.mp4')) {
    const reader = new FileReader();
    reader.onload = (event) => {
      const videoUrl = event.target.result;
      
      // Create video element
      const video = document.createElement('video');
      video.src = videoUrl;
      video.crossOrigin = 'anonymous';
      video.loop = true;
      video.muted = true; // Start muted for autoplay to work (browser policy)
      video.volume = 1.0; // Set volume to 100%
      video.playsInline = true;
      
      video.addEventListener('loadeddata', () => {
        // Create video texture
        const videoTexture = new THREE.VideoTexture(video);
        videoTexture.wrapS = THREE.RepeatWrapping;
        videoTexture.wrapT = THREE.RepeatWrapping;
        videoTexture.minFilter = THREE.LinearFilter;
        videoTexture.magFilter = THREE.LinearFilter;
        videoTexture.colorSpace = THREE.SRGBColorSpace; // Use sRGB for accurate colors
        videoTexture.flipY = true; // Flip Y to match Three.js coordinate system
        
        // Apply texture to shader material
        material.uniforms.uTexture.value = videoTexture;
        material.uniforms.uHasTexture.value = 1.0;
        material.uniforms.uIsImageTexture.value = 0.0; // Mark as video texture
        material.needsUpdate = true;
        
        // Update LED shaders with the new video texture
        updateLEDShaders();
        
        // Set up overlay video to show current frame
        overlayVideo.src = videoUrl;
        overlayVideo.crossOrigin = 'anonymous';
        overlayVideo.loop = true;
        overlayVideo.muted = true;
        overlayVideo.playsInline = true;
        overlayVideo.style.display = 'block';
        overlayImage.style.display = 'none';
        
        // Adjust mapping overlay to match video aspect ratio
        // Use the main video element dimensions for more accurate aspect ratio
        video.addEventListener('loadedmetadata', () => {
          if (video.videoWidth && video.videoHeight) {
            adjustMappingAspectRatio(video.videoWidth, video.videoHeight);
          }
        });
        // Also listen to overlayVideo as fallback
        overlayVideo.addEventListener('loadedmetadata', () => {
          if (overlayVideo.videoWidth && overlayVideo.videoHeight && (!video.videoWidth || !video.videoHeight)) {
            adjustMappingAspectRatio(overlayVideo.videoWidth, overlayVideo.videoHeight);
          }
        });
        
        // Sync overlay video with main video
        const syncOverlay = () => {
          if (video.readyState >= 2) {
            overlayVideo.currentTime = video.currentTime;
            updateFrameInfo(video);
          }
        };
        
        // Sync on timeupdate
        video.addEventListener('timeupdate', syncOverlay);
        
        // Show frame info and timeline for videos
        frameInfo.classList.add('active');
        timelineContainer.classList.add('active');
        // Initialize timeline max value
        if (isFinite(video.duration) && video.duration > 0) {
          timelineSlider.max = 100;
        }
        updateFrameInfo(video);
        
        // Show overlay if checkbox is checked
        if (showMappingCheckbox.checked) {
          mapping.classList.add('active');
        }
        
        // Play both videos
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            overlayVideo.play().catch(err => {
              console.error('Error playing overlay video:', err);
            });
            updatePlayPauseButton();
            updateMuteButton();
          }).catch(err => {
            console.error('Error playing video:', err);
            // If autoplay fails, don't show error - user can click play manually
            // The video is still loaded and ready to play
            updatePlayPauseButton();
            updateMuteButton();
          });
        }
        
        currentVideoElement = video;
        
        // Reset video asset dropdown when file is loaded
        if (videoAssetSelect) {
          videoAssetSelect.value = '';
        }
        
        updatePlaybackButtons(); // Enable playback controls
        if (textureStatus) {
          textureStatus.textContent = file.name;
          textureStatus.classList.add('loaded');
        }
      });
      
      video.addEventListener('error', (error) => {
        if (textureStatus) {
          textureStatus.textContent = 'Error loading video';
          textureStatus.classList.remove('loaded');
        }
        console.error('Error loading video:', error);
      });
      
      // Start loading the video
      video.load();
    };

    reader.onerror = () => {
      if (textureStatus) {
        if (textureStatus) {
          textureStatus.textContent = 'Error reading file';
          textureStatus.classList.remove('loaded');
        }
      }
    };

    reader.readAsDataURL(file);
    return;
  }

  // Handle image files
  if (!file.type.startsWith('image/')) {
    if (textureStatus) {
      textureStatus.textContent = 'Error: Please select an image or video file';
      textureStatus.classList.remove('loaded');
    }
    return;
  }

  const reader = new FileReader();
  reader.onload = (event) => {
    const imageUrl = event.target.result;
    
    // Create texture loader
    const loader = new THREE.TextureLoader();
    
    loader.load(
      imageUrl,
      // onLoad callback
      (texture) => {
        // Apply texture to plane material
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        // Don't set colorSpace for images - we'll handle conversion manually in shader
        // This prevents Three.js from doing automatic conversion that doesn't work with custom shaders
        
        // Apply texture to shader material
        material.uniforms.uTexture.value = texture;
        material.uniforms.uHasTexture.value = 1.0;
        
        // Update LED shaders with the new texture
        updateLEDShaders();
        material.uniforms.uIsImageTexture.value = 1.0; // Mark as image texture
        
        // Show image in mapping overlay
        overlayImage.src = imageUrl;
        overlayImage.style.display = 'block';
        overlayVideo.style.display = 'none';
        
        // Adjust mapping overlay to match image aspect ratio
        overlayImage.onload = () => {
          if (overlayImage.naturalWidth && overlayImage.naturalHeight) {
            adjustMappingAspectRatio(overlayImage.naturalWidth, overlayImage.naturalHeight);
          }
        };
        
        // Hide frame info and timeline for images (only show for videos)
        frameInfo.classList.remove('active');
        timelineContainer.classList.remove('active');
        
        // Hide playback menu for images
        if (playbackMenu) {
          playbackMenu.style.display = 'none';
        }
        
        // Show mapping overlay if checkbox is checked
        if (showMappingCheckbox.checked) {
          mapping.classList.add('active');
        }
        
        // Disable playback buttons for images
        updatePlaybackButtons();
        
        if (textureStatus) {
          textureStatus.textContent = `Loaded: ${file.name}`;
          textureStatus.classList.add('loaded');
        }
      },
      // onProgress callback (optional)
      undefined,
      // onError callback
      (error) => {
        if (textureStatus) {
          textureStatus.textContent = 'Error loading texture';
          textureStatus.classList.remove('loaded');
        }
        console.error('Error loading texture:', error);
      }
    );
  };

  reader.onerror = () => {
    if (textureStatus) {
      textureStatus.textContent = 'Error reading file';
      textureStatus.classList.remove('loaded');
    }
  };

  reader.readAsDataURL(file);
});

// Camera debug panel elements
const cameraPosX = document.getElementById('cameraPosX');
const cameraPosY = document.getElementById('cameraPosY');
const cameraPosZ = document.getElementById('cameraPosZ');
const cameraRotX = document.getElementById('cameraRotX');
const cameraRotY = document.getElementById('cameraRotY');
const cameraRotZ = document.getElementById('cameraRotZ');
const cameraTargetX = document.getElementById('cameraTargetX');
const cameraTargetY = document.getElementById('cameraTargetY');
const cameraTargetZ = document.getElementById('cameraTargetZ');
const copyCameraBtn = document.getElementById('copyCameraBtn');
const cameraDebugPanel = document.getElementById('cameraDebugPanel');

// Function to update camera debug info
function updateCameraDebug() {
  if (cameraPosX && cameraPosY && cameraPosZ) {
    // Position
    cameraPosX.textContent = camera.position.x.toFixed(2);
    cameraPosY.textContent = camera.position.y.toFixed(2);
    cameraPosZ.textContent = camera.position.z.toFixed(2);
  }
  
  if (cameraRotX && cameraRotY && cameraRotZ) {
    // Rotation (Euler angles in radians, converted to degrees)
    cameraRotX.textContent = (camera.rotation.x * 180 / Math.PI).toFixed(2);
    cameraRotY.textContent = (camera.rotation.y * 180 / Math.PI).toFixed(2);
    cameraRotZ.textContent = (camera.rotation.z * 180 / Math.PI).toFixed(2);
  }
  
  if (cameraTargetX && cameraTargetY && cameraTargetZ) {
    // OrbitControls target
    cameraTargetX.textContent = controls.target.x.toFixed(2);
    cameraTargetY.textContent = controls.target.y.toFixed(2);
    cameraTargetZ.textContent = controls.target.z.toFixed(2);
  }
}

// Function to copy camera values to clipboard
function copyCameraValues() {
  const pos = {
    x: parseFloat(camera.position.x.toFixed(2)),
    y: parseFloat(camera.position.y.toFixed(2)),
    z: parseFloat(camera.position.z.toFixed(2))
  };
  
  const rot = {
    x: parseFloat((camera.rotation.x * 180 / Math.PI).toFixed(2)),
    y: parseFloat((camera.rotation.y * 180 / Math.PI).toFixed(2)),
    z: parseFloat((camera.rotation.z * 180 / Math.PI).toFixed(2))
  };
  
  const target = {
    x: parseFloat(controls.target.x.toFixed(2)),
    y: parseFloat(controls.target.y.toFixed(2)),
    z: parseFloat(controls.target.z.toFixed(2))
  };
  
  const cameraData = {
    position: pos,
    rotation: rot,
    target: target
  };
  
  // Format as readable text
  const textFormat = `Position: (${pos.x}, ${pos.y}, ${pos.z})
Rotation: (${rot.x}, ${rot.y}, ${rot.z})
Target: (${target.x}, ${target.y}, ${target.z})`;
  
  // Copy to clipboard
  navigator.clipboard.writeText(textFormat).then(() => {
    // Visual feedback
    const originalText = copyCameraBtn.textContent;
    copyCameraBtn.textContent = 'Copied!';
    copyCameraBtn.style.background = 'var(--color-primary)';
    setTimeout(() => {
      copyCameraBtn.textContent = originalText;
      copyCameraBtn.style.background = '';
    }, 2000);
  }).catch(err => {
    console.error('Failed to copy camera values:', err);
    alert('Failed to copy to clipboard. Please copy manually:\n\n' + textFormat);
  });
}

// Add click handler to copy button
if (copyCameraBtn) {
  copyCameraBtn.addEventListener('click', copyCameraValues);
}

// Store/Load camera position during session
let storedCameraState = null;

const storeCameraBtn = document.getElementById('storeCameraBtn');
const loadCameraBtn = document.getElementById('loadCameraBtn');

// Function to store current camera state
function storeCameraState() {
  storedCameraState = {
    position: {
      x: camera.position.x,
      y: camera.position.y,
      z: camera.position.z
    },
    rotation: {
      x: camera.rotation.x * 180 / Math.PI, // Convert to degrees
      y: camera.rotation.y * 180 / Math.PI,
      z: camera.rotation.z * 180 / Math.PI
    },
    target: {
      x: controls.target.x,
      y: controls.target.y,
      z: controls.target.z
    }
  };
  
  // Visual feedback
  const originalText = storeCameraBtn.textContent;
  storeCameraBtn.textContent = 'Stored!';
  storeCameraBtn.style.background = 'var(--color-primary)';
  setTimeout(() => {
    storeCameraBtn.textContent = originalText;
    storeCameraBtn.style.background = '';
  }, 2000);
  
  // Enable load button
  if (loadCameraBtn) {
    loadCameraBtn.disabled = false;
  }
}

// Function to load stored camera state
function loadCameraState() {
  if (!storedCameraState) {
    console.warn('No camera state stored');
    return;
  }
  
  // Set camera position
  camera.position.set(
    storedCameraState.position.x,
    storedCameraState.position.y,
    storedCameraState.position.z
  );
  
  // Set OrbitControls target
  controls.target.set(
    storedCameraState.target.x,
    storedCameraState.target.y,
    storedCameraState.target.z
  );
  
  // Set camera rotation (convert degrees to radians)
  camera.rotation.set(
    storedCameraState.rotation.x * Math.PI / 180,
    storedCameraState.rotation.y * Math.PI / 180,
    storedCameraState.rotation.z * Math.PI / 180
  );
  
  // Update controls
  controls.update();
  
  // Update debug display
  updateCameraDebug();
  
  // Visual feedback
  const originalText = loadCameraBtn.textContent;
  loadCameraBtn.textContent = 'Loaded!';
  loadCameraBtn.style.background = 'var(--color-primary)';
  setTimeout(() => {
    loadCameraBtn.textContent = originalText;
    loadCameraBtn.style.background = '';
  }, 2000);
}

// Add event listeners
if (storeCameraBtn) {
  storeCameraBtn.addEventListener('click', storeCameraState);
}
if (loadCameraBtn) {
  loadCameraBtn.addEventListener('click', loadCameraState);
  // Initially disable load button until something is stored
  loadCameraBtn.disabled = true;
}

// Camera position presets
const cameraPositions = [
  {
    position: { x: -1.63, y: 4.54, z: 65.35 },
    rotation: { x: -1.52, y: -2.01, z: 0 },
    target: { x: 0.67, y: 2.81, z: 0.15 }
  },
  {
    position: { x: -28.71, y: 9.17, z: 37.13 },
    rotation: { x: -9.76, y: -38.05, z: -6.06 },
    target: { x: 0.67, y: 2.81, z: 0.15 }
  },
  {
    position: { x: -0.6, y: 4.31, z: 56.73 },
    rotation: { x: -1.52, y: -1.28, z: -0.03 },
    target: { x: 0.67, y: 2.81, z: 0.15 }
  },
  {
    position: { x: 7.3, y: 38.62, z: 80.96 },
    rotation: { x: -25.44, y: 2.85, z: 1.35 },
    target: { x: 3.63, y: 6.96, z: 14.39 }
  }
];

// Function to set camera position and target
function setCameraPosition(positionIndex) {
  if (positionIndex < 0 || positionIndex >= cameraPositions.length) {
    console.error('Invalid camera position index:', positionIndex);
    return;
  }
  
  const preset = cameraPositions[positionIndex];
  
  // Set camera position
  camera.position.set(preset.position.x, preset.position.y, preset.position.z);
  
  // Set OrbitControls target
  controls.target.set(preset.target.x, preset.target.y, preset.target.z);
  
  // If rotation is specified, set it directly (convert degrees to radians)
  if (preset.rotation) {
    camera.rotation.set(
      preset.rotation.x * Math.PI / 180,
      preset.rotation.y * Math.PI / 180,
      preset.rotation.z * Math.PI / 180
    );
  } else {
    // Otherwise, look at target (OrbitControls will handle rotation)
    camera.lookAt(preset.target.x, preset.target.y, preset.target.z);
  }
  
  // Update controls to apply changes immediately
  controls.update();
  
  // Update debug display
  updateCameraDebug();
}

// Add event listeners for camera position buttons
const cameraPos1Btn = document.getElementById('cameraPos1');
const cameraPos2Btn = document.getElementById('cameraPos2');
const cameraPos3Btn = document.getElementById('cameraPos3');
const cameraPos4Btn = document.getElementById('cameraPos4');

if (cameraPos1Btn) {
  cameraPos1Btn.addEventListener('click', () => setCameraPosition(0));
}
if (cameraPos2Btn) {
  cameraPos2Btn.addEventListener('click', () => setCameraPosition(1));
}
if (cameraPos3Btn) {
  cameraPos3Btn.addEventListener('click', () => setCameraPosition(2));
}
if (cameraPos4Btn) {
  cameraPos4Btn.addEventListener('click', () => setCameraPosition(3));
}

// Set default camera to position 1 after everything is initialized
setCameraPosition(0);

// Set default video in dropdown
if (videoAssetSelect) {
  videoAssetSelect.value = DEFAULT_VIDEO_PATH;
}

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  
  // Update controls
  controls.update();
  
  // Update camera position in all shader materials
  Object.values(shaderMaterials).forEach(shaderMaterial => {
    if (shaderMaterial.uniforms && shaderMaterial.uniforms.uCameraPosition) {
      shaderMaterial.uniforms.uCameraPosition.value.copy(camera.position);
    }
  });
  
  // Update camera position in all cloned materials
  Object.values(materialReferences).forEach(materialArray => {
    materialArray.forEach(material => {
      if (material.uniforms && material.uniforms.uCameraPosition) {
        material.uniforms.uCameraPosition.value.copy(camera.position);
      }
    });
  });
  
  // Update video texture if it exists (VideoTexture auto-updates, but ensure it's marked)
  if (material.uniforms.uTexture.value) {
    const texture = material.uniforms.uTexture.value;
    if (texture instanceof THREE.VideoTexture && texture.source && texture.source.data) {
      // VideoTexture auto-updates, but ensure it's marked for update
      texture.needsUpdate = true;
    }
  }
  
  // Update camera debug info
  updateCameraDebug();
  
  // Render the scene
  renderer.render(scene, camera);
}

// Handle window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Start the animation loop
animate();

// Load default video at startup
// Since this is a module script, DOM is already ready
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', () => {
    loadVideoFromPath(DEFAULT_VIDEO_PATH);
  });
} else {
  // DOM already loaded, call immediately
  loadVideoFromPath(DEFAULT_VIDEO_PATH);
}



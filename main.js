import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ledMeshFiles, stageMeshFiles, crowdMeshPaths, DEFAULT_MAPPING_TYPE, correctedWingMeshes } from './src/config/meshPaths.js';
import { shaderConfigs } from './src/config/shaderConfig.js';
import { cameraPositions, DEFAULT_CAMERA_POSITION_INDEX } from './src/config/cameraPresets.js';
import { createShaderMaterials, createTextureShaderMaterial, createLEDShaderMaterial, updateLEDShaders, applyShaderToGroup, updateCameraPositionInShaders } from './src/core/ShaderManager.js';
import { getShaderType } from './src/utils/shaderUtils.js';
import { getElement } from './src/utils/domUtils.js';
import { PlaybackControls, setupKeyboardControls } from './src/ui/PlaybackControls.js';
import { CameraControls } from './src/ui/CameraControls.js';
import { SettingsPanel } from './src/ui/SettingsPanel.js';
import { PanelManager } from './src/ui/PanelManager.js';
import { ShaderControls } from './src/ui/ShaderControls.js';
import { MeshLoader } from './src/core/MeshLoader.js';
import { LEDMapping } from './src/features/LEDMapping.js';
import { CrowdSpawner } from './src/features/CrowdSpawner.js';
import { MediaManager } from './src/features/MediaManager.js';

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0.004, 0.004, 0.004);

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
const material = createTextureShaderMaterial();

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

// Store references to wing meshes for swapping
let slWingMesh = null;
let srWingMesh = null;

// Store references to garage meshes
let slGarageMesh = null;
let srGarageMesh = null;

// Store reference to floor mesh
let floorMesh = null;


// Store LED front visibility state for restoration during mesh reload (to prevent flash)
let restoreLedFrontVisible = true;

// Store references to all loaded LED meshes for swapping
const loadedLEDMeshes = [];

// Add groups to scene
scene.add(ledsGroup);
scene.add(stageGroup);

// Create shader materials for different asset types using config
const shaderMaterials = createShaderMaterials();

// Store references to all materials for UI control
const materialReferences = {
  base: [],
  artists: [],
  stage: [],
  pillars: [],
  floor: [],
  crowd: []
};

// Double-sided shader material for stage meshes (legacy, kept for backwards compatibility)
const stageShaderMaterial = shaderMaterials.stage;

// Initialize Mesh Loader
let meshLoader = new MeshLoader(scene, shaderMaterials, materialReferences, createLEDShaderMaterial);

// Set up mesh loader callbacks for stage meshes
meshLoader.setCallbacks({
  onDJLiftableLoaded: (mesh) => {
    djLiftableMesh = mesh;
    console.log('DJ liftable mesh loaded');
    // If DJ artist mesh is already loaded, parent it to the liftable stage
    if (djArtistMesh) {
      if (djArtistMesh.parent) {
        djArtistMesh.parent.remove(djArtistMesh);
      }
      djLiftableMesh.add(djArtistMesh);
      console.log('Parented DJ artist mesh to liftable stage');
    }
  },
  onFloorLoaded: (mesh) => {
    floorMesh = mesh;
    console.log('Floor mesh loaded');
    // Initialize crowd spawner when floor is loaded
    if (!crowdSpawner) {
      crowdSpawner = new CrowdSpawner(scene, floorMesh, shaderMaterials, materialReferences);
    } else {
      crowdSpawner.setFloorMesh(floorMesh);
    }
    // Spawn crowd cubes on the floor after a short delay
    setTimeout(() => {
      if (crowdSpawner) {
        const slider = document.getElementById('crowdInstanceCountSlider');
        const count = slider ? parseInt(slider.value) || 4000 : 4000;
        crowdSpawner.spawnCrowd(count);
      }
    }, 100);
  },
  onArtistsLoaded: (mesh) => {
    artistsMeshes.push({
      mesh: mesh,
      name: mesh.name || 'Unnamed',
      parent: mesh.parent
    });
    console.log(`Stored artists mesh: ${mesh.name || 'Unnamed'}`);
  },
  onDJArtistLoaded: (mesh) => {
    djArtistMesh = mesh;
    console.log(`Found DJ artist mesh: ${mesh.name}`);
    // Explicitly ensure DJ artist mesh gets the artists shader
    const artistsMaterial = shaderMaterials.artists.clone();
    mesh.material = artistsMaterial;
    if (!materialReferences.artists) {
      materialReferences.artists = [];
    }
    materialReferences.artists.push(artistsMaterial);
    // Parent DJ artist mesh to liftable stage if it's already loaded
    if (djLiftableMesh) {
      if (mesh.parent) {
        mesh.parent.remove(mesh);
      }
      djLiftableMesh.add(mesh);
      console.log('Parented DJ artist mesh to liftable stage');
    }
  }
});

// Initialize LED Mapping
let ledMapping = new LEDMapping(meshLoader, ledsGroup, material, (apply) => {
  applyBlackToGarages(apply);
});

// Initialize Crowd Spawner (will be set when floor loads)
let crowdSpawner = null;

// LED mesh file paths for different mapping types
// Current mapping type (default to frontProjectionPerspective)
let currentMappingType = DEFAULT_MAPPING_TYPE;

// Mesh file paths organized by category
const meshFiles = {
  leds: ledMeshFiles[currentMappingType],
  stage: stageMeshFiles
};

// getShaderType is imported from utils

// Function to load a single mesh (wrapper for MeshLoader)
function loadMesh(path, targetGroup, isStage = false) {
  if (!meshLoader) {
    console.error('MeshLoader not initialized');
    return;
  }
  meshLoader.loadMesh(path, targetGroup, isStage, material);
}

// Function to load LED meshes (wrapper for LEDMapping)
function loadLEDMeshes(mappingType, useCorrected = false) {
  if (!ledMapping) {
    console.error('LEDMapping not initialized');
    return;
  }
  ledMapping.loadLEDMeshes(mappingType, useCorrected);
  // Update global references for backwards compatibility
  ledFrontMesh = ledMapping.getLEDFrontMesh();
  const garages = ledMapping.getGarageMeshes();
  slGarageMesh = garages.sl;
  srGarageMesh = garages.sr;
}

// Load initial LED meshes (Front Projection by default)
// Note: useCorrectedMeshCheckbox will be defined later, so we default to false
loadLEDMeshes(currentMappingType, false);

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
let stageMeshesLoaded = 0;
const totalStageMeshes = meshFiles.stage.length;

meshFiles.stage.forEach(path => {
  loadMesh(path, stageGroup, true);
  // Track when all stage meshes are loaded
  // Note: loadMesh is async, so we'll check after a delay
});


// Crowd spawning - individual crowd meshes on the floor mesh with random mesh selection
let crowdInstances = null;
let crowdMeshes = []; // Array to store individual meshes
let crowdGeometry = null;
let crowdMaterial = null;

// Store pre-loaded crowd mesh geometries and materials
const crowdMeshData = []; // Array of {geometry, material} objects
// crowdMeshPaths is imported from config

// Function to spawn crowd (wrapper for CrowdSpawner)
async function spawnCrowdCubes() {
  if (!crowdSpawner) {
    if (!floorMesh) {
      console.warn('Floor mesh not available for crowd spawning');
      return;
    }
    crowdSpawner = new CrowdSpawner(scene, floorMesh, shaderMaterials, materialReferences);
  }
  
  const slider = document.getElementById('crowdInstanceCountSlider');
  const instanceCount = slider ? parseInt(slider.value) || 4000 : 4000;
  await crowdSpawner.spawnCrowd(instanceCount);
}

// Function to spawn crowd instances (wrapper for CrowdSpawner)
function spawnCrowdInstances() {
  if (!crowdSpawner) {
    if (!floorMesh) {
      console.error('No floor mesh available');
      return;
    }
    crowdSpawner = new CrowdSpawner(scene, floorMesh, shaderMaterials);
  }
  
  const slider = document.getElementById('crowdInstanceCountSlider');
  const instanceCount = slider ? parseInt(slider.value) || 4000 : 4000;
  
  if (instanceCount === 0) {
    crowdSpawner.cleanup();
    return;
  }
  
  // Pre-load meshes if needed, then spawn
  crowdSpawner.spawnCrowd(instanceCount).catch(err => {
    console.error('Error spawning crowd:', err);
  });
}

// Add lights - brighter and more neutral for accurate color display
const ambientLight = new THREE.AmbientLight(0xffffff, 1.0); // Increased intensity
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2); // Increased intensity
directionalLight.position.set(0, 0, 5); // Front lighting for better visibility
directionalLight.castShadow = true;
scene.add(directionalLight);

// Texture loading
const settingsPanel = document.getElementById('settingsPanel');

const cameraPanel = document.getElementById('cameraPanel');
const styleShaderPanel = document.getElementById('styleShaderPanel');

// Initialize Settings Panel Manager
const settingsPanelManager = new SettingsPanel();

// Initialize Panel Manager
const panelManager = new PanelManager();

// Register draggable panels
panelManager.registerPanel(settingsPanel, 'control');
panelManager.registerPanel(cameraPanel, 'camera');
panelManager.registerPanel(styleShaderPanel, 'styleShader');

// Style/Shader tab switching
const styleTabBtn = getElement('styleTabBtn');
const shaderTabBtn = getElement('shaderTabBtn');
const styleTabPanel = getElement('styleTabPanel');
const shaderTabPanel = getElement('shaderTabPanel');

panelManager.setupTabs({
  tabs: [
    { button: styleTabBtn, panel: styleTabPanel, name: 'style' },
    { button: shaderTabBtn, panel: shaderTabPanel, name: 'shader' }
  ],
  defaultTab: 'style'
});

// Settings panel tab switching
const mediaTabBtn = getElement('mediaTabBtn');
const mappingTabBtn = getElement('mappingTabBtn');
const stageTabBtn = getElement('stageTabBtn');
const cameraTabBtn = getElement('cameraTabBtn');
const devTabBtn = getElement('devTabBtn');
const mediaTabPanel = getElement('mediaTabPanel');
const mappingTabPanel = getElement('mappingTabPanel');
const stageTabPanel = getElement('stageTabPanel');
const cameraTabPanel = getElement('cameraTabPanel');
const devTabPanel = getElement('devTabPanel');

panelManager.setupTabs({
  tabs: [
    { button: mediaTabBtn, panel: mediaTabPanel, name: 'media' },
    { button: mappingTabBtn, panel: mappingTabPanel, name: 'mapping' },
    { button: stageTabBtn, panel: stageTabPanel, name: 'stage' },
    { button: cameraTabBtn, panel: cameraTabPanel, name: 'camera' },
    { button: devTabBtn, panel: devTabPanel, name: 'dev' }
  ],
  defaultTab: 'media'
});

// Version info display
const versionInfoEl = document.getElementById('versionInfo');
if (versionInfoEl) {
  // @ts-ignore - These are injected by Vite define
  const version = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
  // @ts-ignore
  const buildTime = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : null;
  // @ts-ignore
  const gitCommit = typeof __GIT_COMMIT__ !== 'undefined' ? __GIT_COMMIT__ : 'unknown';
  
  const lines = [`v${version}`];
  
  if (buildTime) {
    const date = new Date(buildTime);
    const formattedDate = date.toLocaleString('en-US', { 
      month: 'numeric', 
      day: 'numeric', 
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    lines.push(`Built: ${formattedDate}`);
  } else {
    lines.push('Built: development');
  }
  
  lines.push(`Commit: ${gitCommit}`);
  
  versionInfoEl.textContent = lines.join('\n');
}

// Style-Shader panel visibility checkbox
const showStyleShaderPanelCheckbox = document.getElementById('showStyleShaderPanel');
if (showStyleShaderPanelCheckbox && styleShaderPanel) {
  // Initialize as hidden (unchecked by default)
  styleShaderPanel.style.display = 'none';
  
  showStyleShaderPanelCheckbox.addEventListener('change', (e) => {
    if (e.target.checked) {
      styleShaderPanel.style.display = 'block';
      // Ensure it's not minimized when shown
      styleShaderPanel.classList.remove('minimized');
      if (styleShaderPanelToggle) {
        styleShaderPanelToggle.textContent = '−';
      }
    } else {
      styleShaderPanel.style.display = 'none';
    }
  });
}

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
const settingsPanelBurger = document.getElementById('settingsPanelBurger');
if (settingsPanelToggle && settingsPanel) {
  // Initialize as minimized (class is already in HTML)
  settingsPanelToggle.textContent = '+';
  // Show burger menu since panel is minimized
  if (settingsPanelBurger) {
    settingsPanelBurger.style.display = 'flex';
  }
  
  settingsPanelToggle.addEventListener('click', () => {
    settingsPanel.classList.toggle('minimized');
    settingsPanelToggle.textContent = settingsPanel.classList.contains('minimized') ? '+' : '−';
    // Update burger menu visibility
    if (settingsPanelBurger) {
      settingsPanelBurger.style.display = settingsPanel.classList.contains('minimized') ? 'flex' : 'none';
    }
  });
}

// Settings panel burger menu (shows when minimized)
if (settingsPanelBurger && settingsPanel) {
  // Initialize burger menu as visible since panel starts minimized
  settingsPanelBurger.style.display = 'flex';
  
  settingsPanelBurger.addEventListener('click', () => {
    settingsPanel.classList.remove('minimized');
    if (settingsPanelToggle) {
      settingsPanelToggle.textContent = '−';
    }
    settingsPanelBurger.style.display = 'none';
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

// Panel dragging is now handled by PanelManager

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

// Initialize Shader Controls
const shaderControls = new ShaderControls(shaderMaterials, materialReferences, updateShaderUniforms, syncControlsToShaderValues);

// Initialize shader controls after meshes are loaded (delay to ensure materials are ready)
setTimeout(() => {
  shaderControls.init();
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
const useCorrectedMeshCheckbox = document.getElementById('useCorrectedMesh');
const correctedMeshGroup = document.getElementById('correctedMeshGroup');

if (mappingTypeSelect) {
  mappingTypeSelect.addEventListener('change', (e) => {
    const selectedType = e.target.value;
    currentMappingType = selectedType;
    
    // Show/hide corrected mesh checkbox
    if (correctedMeshGroup) {
      if (selectedType === 'frontProjection' || selectedType === 'frontProjectionPerspective') {
        correctedMeshGroup.style.display = 'block';
      } else {
        correctedMeshGroup.style.display = 'none';
        // Uncheck when hidden
        if (useCorrectedMeshCheckbox) {
          useCorrectedMeshCheckbox.checked = false;
        }
      }
    }
    
    // Get checkbox state
    const useCorrected = useCorrectedMeshCheckbox ? useCorrectedMeshCheckbox.checked : false;
    
    // Swap LED meshes
    loadLEDMeshes(selectedType, useCorrected);
    
    // Hide front screen by default for Festival Mapping, show for Front Projection types
    setTimeout(() => {
      const hideLedFrontCheckbox = document.getElementById('hideLedFront');
      // Get current LED front mesh from LEDMapping
      const currentLedFrontMesh = ledMapping ? ledMapping.getLEDFrontMesh() : ledFrontMesh;
      if (selectedType === 'festival') {
        // Hide front screen for Festival Mapping
        if (currentLedFrontMesh) {
          currentLedFrontMesh.visible = false;
          ledFrontMesh = currentLedFrontMesh; // Update global reference
        }
        if (hideLedFrontCheckbox) {
          hideLedFrontCheckbox.checked = true;
        }
      } else if (selectedType === 'frontProjection' || selectedType === 'frontProjectionPerspective') {
        // Show front screen for Front Projection types
        if (currentLedFrontMesh) {
          currentLedFrontMesh.visible = true;
          ledFrontMesh = currentLedFrontMesh; // Update global reference
        }
        if (hideLedFrontCheckbox) {
          hideLedFrontCheckbox.checked = false;
        }
      }
      
      // Update LED shaders with current texture after loading
      updateLEDShaders(ledsGroup, material);
    }, 100);
  });
}

// Corrected mesh checkbox change handler
if (useCorrectedMeshCheckbox) {
  useCorrectedMeshCheckbox.addEventListener('change', (e) => {
    const useCorrected = e.target.checked;
    // Get current visibility state before reloading
    const hideLedFrontCheckbox = document.getElementById('hideLedFront');
    const shouldHideLedFront = hideLedFrontCheckbox ? hideLedFrontCheckbox.checked : false;
    
    // Reload LED meshes with corrected state
    loadLEDMeshes(currentMappingType, useCorrected);
    
    // Wait for meshes to load and then restore visibility state
    setTimeout(() => {
      // Get LED front mesh from LEDMapping (it manages the mesh)
      const currentLedFrontMesh = ledMapping ? ledMapping.getLEDFrontMesh() : ledFrontMesh;
      
      // Restore LED front visibility state based on checkbox
      if (currentLedFrontMesh && hideLedFrontCheckbox) {
        currentLedFrontMesh.visible = !shouldHideLedFront;
        ledFrontMesh = currentLedFrontMesh; // Update global reference
      }
      
      // Update LED shaders with current texture after loading
      updateLEDShaders(ledsGroup, material);
    }, 200);
  });
  
  // Reload corrected wings if checkbox is checked and mapping type supports it
  if (useCorrectedMeshCheckbox.checked && (currentMappingType === 'frontProjection' || currentMappingType === 'frontProjectionPerspective')) {
    // Get current visibility state
    const hideLedFrontCheckbox = document.getElementById('hideLedFront');
    const shouldHideLedFront = hideLedFrontCheckbox ? hideLedFrontCheckbox.checked : false;
    
    // Reload LED meshes with corrected state
    loadLEDMeshes(currentMappingType, true);
    
    // Wait for meshes to load and then restore visibility state
    setTimeout(() => {
      // Get LED front mesh from LEDMapping (it manages the mesh)
      const currentLedFrontMesh = ledMapping ? ledMapping.getLEDFrontMesh() : ledFrontMesh;
      
      // Restore LED front visibility state
      if (currentLedFrontMesh && hideLedFrontCheckbox) {
        currentLedFrontMesh.visible = !shouldHideLedFront;
        ledFrontMesh = currentLedFrontMesh; // Update global reference
      }
      
      // Update LED shaders with current texture after loading
      updateLEDShaders(ledsGroup, material);
    }, 200);
  }
}

// Initialize checkbox visibility on page load
// Use setTimeout to ensure DOM is ready
setTimeout(() => {
  if (correctedMeshGroup) {
    if (currentMappingType === 'frontProjection' || currentMappingType === 'frontProjectionPerspective') {
      correctedMeshGroup.style.display = 'block';
    } else {
      correctedMeshGroup.style.display = 'none';
    }
  }
}, 0);

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
const stillInfo = document.getElementById('stillInfo');
const stillFileNameDisplay = document.getElementById('stillFileNameDisplay');
const showFileInfoCheckbox = document.getElementById('showFileInfo');
const timelineContainer = document.getElementById('timelineContainer');
const timelineSlider = document.getElementById('timelineSlider');
const textureInput = document.getElementById('textureInput');
const textureStatus = document.getElementById('textureStatus');
const showMappingCheckbox = document.getElementById('showMapping');
const videoAssetSelect = document.getElementById('videoAssetSelect');
let isSeeking = false;

// MediaManager will be initialized after playbackControls and other dependencies are ready
let mediaManager = null;

// Function to parse MP4 header to extract frame rate
async function parseMP4FrameRate(file) {
  if (!file || !file.name.toLowerCase().endsWith('.mp4')) {
    return null;
  }
  
  try {
    // Read first 64KB of file to find moov atom
    const chunkSize = 64 * 1024;
    const blob = file.slice(0, chunkSize);
    const arrayBuffer = await blob.arrayBuffer();
    const view = new DataView(arrayBuffer);
    
    let offset = 0;
    const maxOffset = Math.min(arrayBuffer.byteLength, chunkSize);
    
    // Search for 'moov' atom (movie header atom)
    while (offset < maxOffset - 8) {
      const size = view.getUint32(offset);
      const type = String.fromCharCode(
        view.getUint8(offset + 4),
        view.getUint8(offset + 5),
        view.getUint8(offset + 6),
        view.getUint8(offset + 7)
      );
      
      if (type === 'moov') {
        // Found moov atom, now search for 'mvhd' (movie header)
        const moovSize = size;
        const moovEnd = offset + moovSize;
        let moovOffset = offset + 8;
        
        while (moovOffset < moovEnd - 8) {
          const atomSize = view.getUint32(moovOffset);
          const atomType = String.fromCharCode(
            view.getUint8(moovOffset + 4),
            view.getUint8(moovOffset + 5),
            view.getUint8(moovOffset + 6),
            view.getUint8(moovOffset + 7)
          );
          
          if (atomType === 'mvhd') {
            // Found mvhd atom - version is at offset 8
            const version = view.getUint8(moovOffset + 8);
            let timescaleOffset, durationOffset;
            
            if (version === 1) {
              // 64-bit version
              timescaleOffset = moovOffset + 20;
              durationOffset = moovOffset + 28;
            } else {
              // 32-bit version
              timescaleOffset = moovOffset + 12;
              durationOffset = moovOffset + 16;
            }
            
            const timescale = view.getUint32(timescaleOffset);
            
            // Now search for 'trak' atoms to find video track
            let trakOffset = moovOffset + atomSize;
            while (trakOffset < moovEnd - 8) {
              const trakSize = view.getUint32(trakOffset);
              const trakType = String.fromCharCode(
                view.getUint8(trakOffset + 4),
                view.getUint8(trakOffset + 5),
                view.getUint8(trakOffset + 6),
                view.getUint8(trakOffset + 7)
              );
              
              if (trakType === 'trak') {
                // Search for 'mdia' -> 'mdhd' to get track timescale
                // Search for 'stbl' -> 'stts' to get time-to-sample
                // This is complex, so let's try a simpler approach
                // Look for 'stsd' which contains sample description
                let mdiaOffset = trakOffset + 8;
                const trakEnd = trakOffset + trakSize;
                
                while (mdiaOffset < trakEnd - 8) {
                  const mdiaSize = view.getUint32(mdiaOffset);
                  const mdiaType = String.fromCharCode(
                    view.getUint8(mdiaOffset + 4),
                    view.getUint8(mdiaOffset + 5),
                    view.getUint8(mdiaOffset + 6),
                    view.getUint8(mdiaOffset + 7)
                  );
                  
                  if (mdiaType === 'mdia') {
                    // Found mdia, look for mdhd
                    let mdhdOffset = mdiaOffset + 8;
                    const mdiaEnd = mdiaOffset + mdiaSize;
                    
                    while (mdhdOffset < mdiaEnd - 8) {
                      const mdhdSize = view.getUint32(mdhdOffset);
                      const mdhdType = String.fromCharCode(
                        view.getUint8(mdhdOffset + 4),
                        view.getUint8(mdhdOffset + 5),
                        view.getUint8(mdhdOffset + 6),
                        view.getUint8(mdhdOffset + 7)
                      );
                      
                      if (mdhdType === 'mdhd') {
                        const mdhdVersion = view.getUint8(mdhdOffset + 8);
                        let trackTimescaleOffset;
                        
                        if (mdhdVersion === 1) {
                          trackTimescaleOffset = mdhdOffset + 20;
                        } else {
                          trackTimescaleOffset = mdhdOffset + 12;
                        }
                        
                        const trackTimescale = view.getUint32(trackTimescaleOffset);
                        
                        // If we have timescale, we can calculate frame rate
                        // But we need sample count and duration from stts
                        // For now, return timescale as it's often close to frame rate
                        if (trackTimescale > 0 && trackTimescale <= 120) {
                          return trackTimescale;
                        }
                      }
                      
                      mdhdOffset += mdhdSize;
                    }
                  }
                  
                  mdiaOffset += mdiaSize;
                }
              }
              
              trakOffset += trakSize;
            }
            
            // If we found timescale but not track timescale, use movie timescale
            if (timescale > 0 && timescale <= 120) {
              return timescale;
            }
          }
          
          moovOffset += atomSize;
        }
      }
      
      offset += size || 1;
    }
  } catch (e) {
    console.error('Error parsing MP4 header:', e);
  }
  
  return null;
}

// Function to detect frame rate from server using ffprobe
async function detectFrameRateFromServer(videoPath) {
  try {
    const response = await fetch(`/api/video/framerate?videoPath=${encodeURIComponent(videoPath)}`);
    
    if (!response.ok) {
      // If server endpoint fails, return null (will fall back to other methods)
      console.warn('Server frame rate detection failed:', response.status, response.statusText);
      return null;
    }
    
    const data = await response.json();
    if (data.fps && data.fps > 0 && data.fps <= 120) {
      return Math.round(data.fps);
    }
    
    return null;
  } catch (error) {
    console.warn('Error fetching frame rate from server:', error);
    return null;
  }
}

// Function to detect frame rate from video metadata only
async function detectVideoFrameRate(videoElement, file = null, videoPath = null) {
  // First try server-side detection if we have a video path
  if (videoPath) {
    const serverFps = await detectFrameRateFromServer(videoPath);
    if (serverFps) {
      return serverFps;
    }
  }
  
  // Fall back to parsing MP4 header if we have a file
  if (file) {
    const headerFps = await parseMP4FrameRate(file);
    if (headerFps) {
      return headerFps;
    }
  }
  
  if (!videoElement) {
    return null;
  }
  
  // Try to get from video element metadata (if available)
  // Note: HTML5 video API doesn't directly expose frame rate,
  // but we can try to calculate it from duration and frame count if available
  try {
    // Some browsers might expose this via webkitDecodedFrameCount
    // This is a workaround - not all browsers support this
    if (videoElement.webkitDecodedFrameCount !== undefined && videoElement.duration) {
      const frameCount = videoElement.webkitDecodedFrameCount;
      const duration = videoElement.duration;
      if (frameCount > 0 && duration > 0) {
        const calculatedFps = Math.round(frameCount / duration);
        if (calculatedFps > 0 && calculatedFps <= 120) {
          return calculatedFps;
        }
      }
    }
  } catch (e) {
    // Ignore errors
  }
  
  // Return null if frame rate cannot be detected from metadata
  return null;
}

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

// Function to get image metadata (bit depth and colorspace)
function getImageMetadata(file, imageElement) {
  // Default values
  let bitDepth = '8bit';
  let colorspace = 'sRGB';
  
  // Try to detect bit depth from file extension or type
  const fileName = file ? file.name.toLowerCase() : '';
  if (fileName.endsWith('.png') || fileName.endsWith('.tiff') || fileName.endsWith('.tif')) {
    // PNG and TIFF can be 16bit, but we'll default to 8bit unless we can detect otherwise
    bitDepth = '8bit';
  }
  
  // Try to detect from image data if available
  if (imageElement && imageElement.naturalWidth) {
    // For now, we'll use defaults. In a real implementation, you might:
    // - Use EXIF data for bit depth
    // - Check image color profile for colorspace
    // - Use canvas to analyze pixel data
  }
  
  return { bitDepth, colorspace };
}

// Function to update still info display
function updateStillInfo(file) {
  if (!stillInfo || !stillFileNameDisplay) return;
  
  const imagePath = mediaManager ? mediaManager.getCurrentImagePath() : null;
  const fileName = getFileName(file ? file.name : (imagePath || ''));
  const metadata = getImageMetadata(file, overlayImage);
  
  stillFileNameDisplay.textContent = `${fileName} (${metadata.bitDepth}, ${metadata.colorspace})`;
  
  // Show stillInfo at top if checkbox is checked
  if (showFileInfoCheckbox && showFileInfoCheckbox.checked) {
    stillInfo.classList.add('active');
  } else {
    stillInfo.classList.remove('active');
  }
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
  const videoPath = mediaManager ? mediaManager.getCurrentVideoPath() : null;
  const fileName = getFileName(videoPath);
  const codec = getVideoCodec(video, videoPath);
  
  if (!video || !isFinite(video.duration) || video.duration === 0) {
    if (frameInfo) {
      const frameText = frameInfo.querySelector('span:nth-child(3)');
      if (frameText) frameText.textContent = 'Frame: 0 / 0';
    }
    if (fileNameDisplay) {
      fileNameDisplay.textContent = fileName ? `${fileName} (${codec})` : '';
    }
    if (timeDisplay) timeDisplay.textContent = '00:00';
    if (totalTimeDisplay) totalTimeDisplay.textContent = '00:00';
    return;
  }
  
  const currentTime = video.currentTime || 0;
  const duration = video.duration;
  const frameRate = mediaManager ? mediaManager.getVideoFrameRate() : 30;
  const currentFrame = Math.floor(currentTime * frameRate);
  const totalFrames = Math.floor(duration * frameRate);
  
  // Update filename display with codec info
  if (fileNameDisplay) {
    fileNameDisplay.textContent = `${fileName} (${codec})`;
  }
  
  // Update frame counter
  if (frameInfo) {
    // Find the span that contains "Frame:" (third span, after fileNameDisplay and separator)
    const frameText = frameInfo.querySelector('span:nth-child(3)');
    if (frameText) frameText.textContent = `Frame: ${currentFrame} / ${totalFrames}`;
    // Show frameInfo at top if checkbox is checked
    if (showFileInfoCheckbox && showFileInfoCheckbox.checked) {
      frameInfo.classList.add('active');
    } else {
      frameInfo.classList.remove('active');
    }
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
  const videoElement = mediaManager ? mediaManager.getCurrentVideoElement() : null;
  if (videoElement && isFinite(videoElement.duration)) {
    const percentage = parseFloat(timelineSlider.value);
    const newTime = (percentage / 100) * videoElement.duration;
    videoElement.currentTime = newTime;
    if (overlayVideo) overlayVideo.currentTime = newTime;
    updateFrameInfo(videoElement);
  }
});

timelineSlider.addEventListener('input', () => {
  const videoElement = mediaManager ? mediaManager.getCurrentVideoElement() : null;
  if (videoElement && isFinite(videoElement.duration)) {
    const percentage = parseFloat(timelineSlider.value);
    const newTime = (percentage / 100) * videoElement.duration;
    videoElement.currentTime = newTime;
    if (overlayVideo) overlayVideo.currentTime = newTime;
    updateFrameInfo(videoElement);
  }
});

// Background color controls
function updateBackgroundColor() {
  const r = parseFloat(document.getElementById('backgroundColorR')?.value || 0.004);
  const g = parseFloat(document.getElementById('backgroundColorG')?.value || 0.004);
  const b = parseFloat(document.getElementById('backgroundColorB')?.value || 0.004);
  
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
  const r = parseFloat(backgroundColorR?.value || 0.004);
  const g = parseFloat(backgroundColorG?.value || 0.004);
  const b = parseFloat(backgroundColorB?.value || 0.004);
  
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
const hideLedFrontCheckbox = document.getElementById('hideLedFront');
const blackGaragesCheckbox = document.getElementById('blackGarages');
const djDeckHeightSlider = document.getElementById('djDeckHeightSlider');
const djDeckHeightValue = document.getElementById('djDeckHeightValue');

// Create a black material for garage meshes
const blackMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });

// Function to apply black material to garage meshes
function applyBlackToGarages(apply) {
  // Get garage meshes from LEDMapping (it manages the meshes)
  const garages = ledMapping ? ledMapping.getGarageMeshes() : { sl: slGarageMesh, sr: srGarageMesh };
  const garageMeshes = [garages.sl, garages.sr];
  
  console.log('applyBlackToGarages called:', { apply, sl: !!garages.sl, sr: !!garages.sr });
  
  // Update global references for backwards compatibility
  if (garages.sl) slGarageMesh = garages.sl;
  if (garages.sr) srGarageMesh = garages.sr;
  
  let meshCount = 0;
  garageMeshes.forEach((garageMesh, index) => {
    if (!garageMesh) {
      console.warn(`Garage mesh ${index === 0 ? 'SL' : 'SR'} not found`);
      return;
    }
    
    garageMesh.traverse((child) => {
      if (child.isMesh) {
        meshCount++;
        if (apply) {
          // Store original material if not already stored
          if (!child.userData.originalMaterial) {
            child.userData.originalMaterial = child.material;
          }
          // Apply black material
          child.material = blackMaterial;
          console.log(`Applied black material to mesh in ${index === 0 ? 'SL' : 'SR'} garage`);
        } else {
          // Restore LED shader material (always create fresh to ensure uniforms are current)
          // Pass the texture material reference to createLEDShaderMaterial
          child.material = createLEDShaderMaterial(material);
          // Update shader with current texture
          updateLEDShaders(ledsGroup, material);
          child.userData.originalMaterial = null;
          console.log(`Restored LED shader material to mesh in ${index === 0 ? 'SL' : 'SR'} garage`);
        }
      }
    });
  });
  
  if (meshCount === 0) {
    console.warn('No meshes found in garage meshes. They may not be loaded yet.');
  } else {
    console.log(`Processed ${meshCount} meshes in garage meshes`);
  }
}

// Handle hide LED front checkbox
hideLedFrontCheckbox.addEventListener('change', (e) => {
  // Get the current LED front mesh from LEDMapping (it manages the mesh)
  const currentLedFrontMesh = ledMapping ? ledMapping.getLEDFrontMesh() : ledFrontMesh;
  if (currentLedFrontMesh) {
    currentLedFrontMesh.visible = !e.target.checked;
    // Also update the global reference for backwards compatibility
    ledFrontMesh = currentLedFrontMesh;
    console.log('LED front visibility set to:', !e.target.checked);
  } else {
    console.warn('LED front mesh not found, checkbox state:', e.target.checked);
  }
});

// Handle black garages checkbox
if (blackGaragesCheckbox) {
  blackGaragesCheckbox.addEventListener('change', (e) => {
    console.log('Black garages checkbox changed:', e.target.checked);
    applyBlackToGarages(e.target.checked);
  });
}

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

// Crowd instance count slider
const crowdInstanceCountSlider = document.getElementById('crowdInstanceCountSlider');
const crowdInstanceCountValue = document.getElementById('crowdInstanceCountValue');

if (crowdInstanceCountSlider && crowdInstanceCountValue) {
  // Update display value
  crowdInstanceCountValue.textContent = crowdInstanceCountSlider.value;
  
  crowdInstanceCountSlider.addEventListener('input', (e) => {
    const value = parseInt(e.target.value);
    crowdInstanceCountValue.textContent = value;
    
    // Respawn crowd instances with new count
    if (floorMesh) {
      spawnCrowdCubes();
    }
  });
}

showMappingCheckbox.addEventListener('change', (e) => {
  if (e.target.checked) {
    // Show if there's a video or texture loaded
    const videoElement = mediaManager ? mediaManager.getCurrentVideoElement() : null;
    if (videoElement || material.uniforms.uHasTexture.value === 1.0) {
      mapping.classList.add('active');
    }
  } else {
    mapping.classList.remove('active');
  }
});

// ============================================
// Playback Controls
// ============================================
// Initialize playback controls instance
let playbackControls = null;

// Initialize MediaManager
function initializeMediaManager() {
  mediaManager = new MediaManager({
    material: material,
    ledsGroup: ledsGroup,
    updateLEDShaders: updateLEDShaders,
    overlayVideo: overlayVideo,
    overlayImage: overlayImage,
    mapping: mapping,
    frameInfo: frameInfo,
    stillInfo: stillInfo,
    timelineContainer: timelineContainer,
    timelineSlider: timelineSlider,
    textureStatus: textureStatus,
    showMappingCheckbox: showMappingCheckbox,
    showFileInfoCheckbox: showFileInfoCheckbox,
    playbackControls: playbackControls,
    updateFrameInfo: updateFrameInfo,
    updatePlaybackButtons: updatePlaybackButtons,
    updatePlayPauseButton: updatePlayPauseButton,
    updateMuteButton: updateMuteButton,
    updateStillInfo: updateStillInfo,
    videoAssetSelect: videoAssetSelect
  });
}

// Initialize playback controls when DOM is ready
function initializePlaybackControls() {
  // Initialize MediaManager first
  initializeMediaManager();
  
  // Get initial video element from MediaManager (will be null initially)
  const initialVideoElement = mediaManager ? mediaManager.getCurrentVideoElement() : null;
  const initialFrameRate = mediaManager ? mediaManager.getVideoFrameRate() : 30;
  
  playbackControls = new PlaybackControls(initialVideoElement, overlayVideo, initialFrameRate, updateFrameInfo);
  playbackControls.init();
  setupKeyboardControls(playbackControls);
  
  // Update MediaManager with playbackControls reference
  if (mediaManager) {
    mediaManager.playbackControls = playbackControls;
  }
  
  // Make playback menu draggable after initialization
  if (playbackControls && playbackControls.playbackMenu) {
    panelManager.registerPanel(playbackControls.playbackMenu, 'playback');
    playbackControls.playbackMenu.style.cursor = 'grab';
  }
  
  // Make file info top draggable
  const fileInfoTop = getElement('fileInfoTop');
  if (fileInfoTop) {
    panelManager.registerPanel(fileInfoTop, 'fileInfo');
    fileInfoTop.style.cursor = 'grab';
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePlaybackControls);
} else {
  initializePlaybackControls();
}

// Update button states based on video availability (wrapper for compatibility)
function updatePlaybackButtons() {
  if (playbackControls && mediaManager) {
    playbackControls.setEnabled(mediaManager.getCurrentVideoElement() !== null);
  }
}

// Wrapper functions for backwards compatibility
function updatePlayPauseButton() {
  if (playbackControls) {
    playbackControls.updatePlayPauseIcon();
  }
}

function updateMuteButton() {
  if (playbackControls) {
    playbackControls.updateMuteIcon();
  }
}

// Function to load NDI stream as texture using WebSocket + Canvas
function loadNDIStream(streamName) {
  if (!mediaManager) {
    console.error('MediaManager not initialized');
    return;
  }
  mediaManager.loadNDIStream(streamName);
}

// Legacy function wrapper - replaced by MediaManager
function loadNDIStream_OLD(streamName) {
  // Hide file info displays for NDI streams
  if (frameInfo) frameInfo.classList.remove('active');
  if (stillInfo) stillInfo.classList.remove('active');
  currentImagePath = null;
  
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
    updateLEDShaders(ledsGroup, material);
  material.needsUpdate = true;
  
  // Hide overlay and frame info until new stream is loaded
  mapping.classList.remove('active');
    frameInfo.classList.remove('active');
    if (stillInfo) stillInfo.classList.remove('active');
    timelineContainer.classList.remove('active');
    overlayVideo.src = '';
    overlayImage.src = '';
  
  // Hide playback menu until stream is loaded
  if (playbackControls && playbackControls.playbackMenu) {
    playbackControls.playbackMenu.style.display = 'none';
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
            updateLEDShaders(ledsGroup, material);
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
const DEFAULT_VIDEO_PATH = '/assets/videos/shG010_Eva_v12_55FP.mp4';

// Function to load checkerboard texture
function loadCheckerboardTexture() {
  const loader = new THREE.TextureLoader();
  loader.load(
    '/assets/textures/UVGrid55to1.png',
    // onLoad callback
    (texture) => {
      // Apply texture to shader material
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      
      material.uniforms.uTexture.value = texture;
      material.uniforms.uHasTexture.value = 1.0;
      material.uniforms.uIsImageTexture.value = 1.0;
      
      // Update LED shaders with the checkerboard texture
      updateLEDShaders(ledsGroup, material);
      
      // Hide overlay
      if (overlayImage) overlayImage.style.display = 'none';
      if (overlayVideo) overlayVideo.style.display = 'none';
      
      // Hide frame info and timeline for checkerboard
      if (frameInfo) frameInfo.classList.remove('active');
      if (timelineContainer) timelineContainer.classList.remove('active');
      if (stillInfo) stillInfo.classList.remove('active');
      
      // Hide playback menu for checkerboard
      if (playbackControls && playbackControls.playbackMenu) {
        playbackControls.playbackMenu.style.display = 'none';
      }
      
      // Show mapping overlay if checkbox is checked
      if (showMappingCheckbox && showMappingCheckbox.checked && mapping) {
        mapping.classList.add('active');
      }
      
      if (textureStatus) {
        textureStatus.textContent = 'Loaded: Checkerboard';
        textureStatus.classList.add('loaded');
      }
    },
    // onProgress callback (optional)
    undefined,
    // onError callback
    (error) => {
      console.error('Error loading checkerboard texture:', error);
      if (textureStatus) {
        textureStatus.textContent = 'Error loading checkerboard texture';
        textureStatus.classList.remove('loaded');
      }
      alert('Error loading checkerboard texture. Please ensure UVGrid55to1.png exists in /assets/textures/');
    }
  );
}

// Video assets dropdown
if (videoAssetSelect) {
  videoAssetSelect.addEventListener('change', (e) => {
    const selectedValue = e.target.value;
    console.log('Video asset selected:', selectedValue);
    if (selectedValue) {
      if (selectedValue === 'checkerboard') {
        console.log('Loading checkerboard texture...');
        loadCheckerboardTexture();
        // Reset file input
        if (textureInput) {
          textureInput.value = '';
        }
      } else {
        console.log('Loading video from dropdown selection...');
        loadVideoFromPath(selectedValue);
        // Reset file input
        if (textureInput) {
          textureInput.value = '';
        }
      }
    } else {
      console.log('No video selected (empty value)');
    }
  });
  console.log('Video asset select dropdown initialized');
} else {
  console.error('Video asset select dropdown not found!');
}

// Handle show file info checkbox
const fileInfoSizeWrapper = document.getElementById('fileInfoSizeWrapper');
if (showFileInfoCheckbox) {
  // Initialize slider visibility based on checkbox state
  if (fileInfoSizeWrapper) {
    fileInfoSizeWrapper.style.display = showFileInfoCheckbox.checked ? 'flex' : 'none';
  }
  
  showFileInfoCheckbox.addEventListener('change', (e) => {
    const isChecked = e.target.checked;
    
    // Show/hide size slider based on checkbox state
    if (fileInfoSizeWrapper) {
      fileInfoSizeWrapper.style.display = isChecked ? 'flex' : 'none';
    }
    
    // Update frameInfo visibility for videos
    const videoElement = mediaManager ? mediaManager.getCurrentVideoElement() : null;
    if (videoElement && frameInfo) {
      if (isChecked) {
        frameInfo.classList.add('active');
      } else {
        frameInfo.classList.remove('active');
      }
    }
    // Update stillInfo visibility for images
    if (overlayImage && overlayImage.style.display !== 'none' && stillInfo) {
      if (isChecked) {
        stillInfo.classList.add('active');
      } else {
        stillInfo.classList.remove('active');
      }
    }
  });
}

// Handle file info size slider
const fileInfoSizeSlider = document.getElementById('fileInfoSize');
const fileInfoSizeValue = document.getElementById('fileInfoSizeValue');

function updateFileInfoSize(sizePercent) {
  const sizeMultiplier = sizePercent / 100;
  
  // Use transform scale to scale from center
  if (frameInfo) {
    frameInfo.style.transform = `scale(${sizeMultiplier})`;
    frameInfo.style.transformOrigin = 'center';
  }
  if (stillInfo) {
    stillInfo.style.transform = `scale(${sizeMultiplier})`;
    stillInfo.style.transformOrigin = 'center';
  }
}

if (fileInfoSizeSlider && fileInfoSizeValue) {
  // Initialize with default value (100%)
  const initialValue = parseFloat(fileInfoSizeSlider.value);
  fileInfoSizeValue.textContent = `${initialValue}%`;
  updateFileInfoSize(initialValue);
  
  fileInfoSizeSlider.addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    fileInfoSizeValue.textContent = `${value}%`;
    updateFileInfoSize(value);
  });
} else {
  // Initialize scale to 1.0 (100%) even if slider doesn't exist yet
  if (frameInfo) {
    frameInfo.style.transform = 'scale(1)';
    frameInfo.style.transformOrigin = 'center';
  }
  if (stillInfo) {
    stillInfo.style.transform = 'scale(1)';
    stillInfo.style.transformOrigin = 'center';
  }
}

// Function to load video from path
function loadVideoFromPath(videoPath) {
  if (!mediaManager) {
    console.error('MediaManager not initialized');
    return;
  }
  mediaManager.loadVideoFromPath(videoPath);
  // Update global reference for backwards compatibility
  if (playbackControls && mediaManager.getCurrentVideoElement()) {
    playbackControls.setVideoElement(mediaManager.getCurrentVideoElement(), overlayVideo);
    playbackControls.setFrameRate(mediaManager.getVideoFrameRate());
  }
}

// Legacy function wrapper - replaced by MediaManager
function loadVideoFromPath_OLD(videoPath) {
  // Store current video path
  currentVideoPath = videoPath;
  currentImagePath = null; // Clear image path when loading video
  
  // Hide stillInfo when loading video
  if (stillInfo) stillInfo.classList.remove('active');
  
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
    if (stillInfo) stillInfo.classList.remove('active');
    timelineContainer.classList.remove('active');
    overlayVideo.src = '';
    overlayImage.src = '';
  
  // Hide playback menu until video is loaded
  if (playbackControls && playbackControls.playbackMenu) {
    playbackControls.playbackMenu.style.display = 'none';
  }

  // Determine video URL
  let videoUrl;
  // If path starts with /assets/videos/, it's from the dropdown (public folder)
  if (videoPath.startsWith('/assets/videos/')) {
    videoUrl = videoPath; // Use path directly (served by Vite from public folder)
  } else if (videoPath === DEFAULT_VIDEO_PATH) {
    // Use public folder path (automatically served by Vite)
    videoUrl = '/assets/videos/shG010_Eva_v12_55FP.mp4';
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
  video.preload = 'auto'; // Ensure video preloads
  
  console.log('Loading video from URL:', videoUrl);
  console.log('Video element created:', {
    src: video.src,
    crossOrigin: video.crossOrigin,
    loop: video.loop,
    muted: video.muted
  });
  
  // Add event listeners for debugging
  video.addEventListener('loadstart', () => {
    console.log('Video loadstart event fired');
  });
  
  video.addEventListener('progress', () => {
    console.log('Video progress:', {
      buffered: video.buffered.length > 0 ? `${video.buffered.start(0)}-${video.buffered.end(0)}` : 'none',
      readyState: video.readyState
    });
  });
  
  video.addEventListener('canplay', () => {
    console.log('Video canplay event fired');
  });
  
  video.addEventListener('canplaythrough', () => {
    console.log('Video canplaythrough event fired');
  });
  
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
    // Try to get frame rate from video metadata (default to 30fps)
    videoFrameRate = 30; // Default, could be improved with actual video metadata
    
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
    updateLEDShaders(ledsGroup, material);
    
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
    if (showFileInfoCheckbox && showFileInfoCheckbox.checked) {
      frameInfo.classList.add('active');
    }
    if (stillInfo) stillInfo.classList.remove('active');
    timelineContainer.classList.add('active');
    
    // Show playback menu for videos
    if (playbackControls && playbackControls.playbackMenu) {
      playbackControls.playbackMenu.style.display = 'block';
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
    console.log('Video loaded successfully:', {
      duration: video.duration,
      width: video.videoWidth,
      height: video.videoHeight,
      readyState: video.readyState
    });
    
    // Update playback controls with new video element
    if (playbackControls) {
      playbackControls.setVideoElement(video, overlayVideo);
      playbackControls.setFrameRate(videoFrameRate);
      console.log('Playback controls updated with new video');
    } else {
      console.warn('Playback controls not initialized yet, video loaded but controls not updated');
    }
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
    console.error('Video loading error:', error);
    console.error('Video element error details:', {
      error: video.error,
      errorCode: video.error ? video.error.code : null,
      errorMessage: video.error ? video.error.message : null,
      networkState: video.networkState,
      readyState: video.readyState,
      src: video.src,
      currentSrc: video.currentSrc
    });
    
    // Network state codes: 0=EMPTY, 1=IDLE, 2=LOADING, 3=NO_SOURCE
    // Error codes: 1=MEDIA_ERR_ABORTED, 2=MEDIA_ERR_NETWORK, 3=MEDIA_ERR_DECODE, 4=MEDIA_ERR_SRC_NOT_SUPPORTED
    if (video.error) {
      const errorMessages = {
        1: 'Video loading aborted',
        2: 'Network error while loading video',
        3: 'Video decoding error',
        4: 'Video source not supported or not found'
      };
      const errorMsg = errorMessages[video.error.code] || 'Unknown error';
      console.error(`Video error ${video.error.code}: ${errorMsg}`);
    }
    
    if (textureStatus) {
      const errorMsg = video.error ? `${video.error.code}: ${video.error.message || 'Unknown error'}` : 'Unknown error';
      textureStatus.textContent = `Error loading video: ${errorMsg} (URL: ${videoUrl})`;
      textureStatus.classList.remove('loaded');
    }
    // Show playback menu even on error so user can see controls
    if (playbackControls && playbackControls.playbackMenu) {
      playbackControls.playbackMenu.style.display = 'block';
    }
  });
  
  // Start loading the video
  console.log('Calling video.load()...');
  video.load();
  console.log('Video.load() called, waiting for events...');
}

if (textureInput) {
  textureInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!mediaManager) {
      console.error('MediaManager not initialized');
      return;
    }
    
    // Check if it's a video file
    if (file.type.startsWith('video/') || file.name.toLowerCase().endsWith('.mp4')) {
      mediaManager.loadVideoFromFile(file);
      // Update playback controls
      if (playbackControls && mediaManager.getCurrentVideoElement()) {
        playbackControls.setVideoElement(mediaManager.getCurrentVideoElement(), overlayVideo);
        playbackControls.setFrameRate(mediaManager.getVideoFrameRate());
      }
    } else if (file.type.startsWith('image/')) {
      mediaManager.loadImageFromFile(file);
    } else {
      if (textureStatus) {
        textureStatus.textContent = 'Error: Please select an image or video file';
        textureStatus.classList.remove('loaded');
      }
    }
  });
}


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
const showCameraDebugPanelCheckbox = document.getElementById('showCameraDebugPanel');

// Camera debug panel visibility checkbox handler
if (showCameraDebugPanelCheckbox && cameraDebugPanel) {
  // Initialize as hidden (unchecked by default)
  cameraDebugPanel.classList.add('hidden');
  showCameraDebugPanelCheckbox.checked = false;
  
  showCameraDebugPanelCheckbox.addEventListener('change', (e) => {
    if (e.target.checked) {
      cameraDebugPanel.classList.remove('hidden');
    } else {
      cameraDebugPanel.classList.add('hidden');
    }
  });
}

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

// Camera Controls
// ============================================
// Initialize camera controls
let cameraControls = null;

function initializeCameraControls() {
  cameraControls = new CameraControls(camera, controls, updateCameraDebug);
  cameraControls.init();
}

// Initialize camera controls when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeCameraControls);
} else {
  initializeCameraControls();
}

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
  updateCameraPositionInShaders(shaderMaterials, materialReferences, camera);
  
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

// Prevent scaling issues on orientation change
window.addEventListener('orientationchange', () => {
  // Force viewport recalculation after orientation change
  setTimeout(() => {
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');
    }
    // Trigger resize to ensure proper layout
    window.dispatchEvent(new Event('resize'));
  }, 100);
});

// Start the animation loop
animate();

// Load default video at startup
// Ensure playback controls are initialized first, then load video
function loadDefaultVideo() {
  // Wait a bit to ensure playback controls and MediaManager are initialized
  if (!playbackControls || !mediaManager) {
    setTimeout(loadDefaultVideo, 100);
    return;
  }
  console.log('Loading default video:', DEFAULT_VIDEO_PATH);
  loadVideoFromPath(DEFAULT_VIDEO_PATH);
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', () => {
    // Wait for playback controls to initialize
    setTimeout(loadDefaultVideo, 200);
  });
} else {
  // DOM already loaded, wait a bit for playback controls
  setTimeout(loadDefaultVideo, 200);
}



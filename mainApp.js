import * as THREE from 'three';
import { ledMeshFiles, stageMeshFiles, crowdMeshPaths, DEFAULT_MAPPING_TYPE, correctedWingMeshes, djMeshFiles } from './src/config/meshPaths.js';
import { shaderConfigs } from './src/config/shaderConfig.js';
import { cameraPositions, DEFAULT_CAMERA_POSITION_INDEX } from './src/config/cameraPresets.js';
import { vrCameraPresets, DEFAULT_VR_CAMERA_PRESET } from './src/config/vrCameraPresets.js';
import { createShaderMaterials, createTextureShaderMaterial, createLEDShaderMaterial, updateLEDShaders, applyShaderToGroup, updateCameraPositionInShaders, loadMaskTexture } from './src/core/ShaderManager.js';
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
import { FileInfoManager } from './src/features/FileInfoManager.js';
import { OverlayManager } from './src/features/OverlayManager.js';
import { SceneControls } from './src/features/SceneControls.js';
import { VRManager } from './src/vr/VRManager.js';
import { LoadingManager } from './src/core/LoadingManager.js';
import { InitializationManager } from './src/core/InitializationManager.js';
import { registerInitSteps } from './src/app/initSteps.js';
import { registerLoadingStates } from './src/app/loadingStates.js';
import { attachRenderer, createCamera, createControls, createRenderer, setupResizeHandlers, startAnimationLoop } from './src/app/engine.js';

// Initialize loading and initialization managers
const loadingManager = new LoadingManager();
const initManager = new InitializationManager(loadingManager);

// Register loading states
registerLoadingStates(loadingManager);

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0.004, 0.004, 0.004);

// SceneControls will be initialized after DOM is ready
let sceneControls = null;

// VR Manager (will be initialized later)
let vrManager = null;
let vrFloorMesh = null; // store floor mesh for VR features

// Engine (camera/renderer/controls)
const camera = createCamera();
const renderer = createRenderer();
attachRenderer(renderer);
const controls = createControls(camera, renderer);

setupResizeHandlers({
  renderer,
  camera,
  isVRActive: () => (vrManager ? vrManager.getIsVRActive() : false),
});

// Note: Default camera position will be set after cameraPositions array is defined

// Create material with custom shader (used for texture management, referenced by LED shaders)
const material = createTextureShaderMaterial();

// Create groups for organizing meshes
const ledsGroup = new THREE.Group();
ledsGroup.name = 'LEDs';
const stageGroup = new THREE.Group();
stageGroup.name = 'Stage';
let djLiftableMesh = null; // Reference to the DJ liftable stage mesh (deprecated - kept for compatibility)
let artistsMeshes = []; // Array to store individual meshes from artists.glb
let djArtistMesh = null; // Reference to the DJ artist mesh
let djLowMesh = null; // Reference to the DJ low mesh
let djHighMesh = null; // Reference to the DJ high mesh
let currentDJMesh = null; // Track which DJ mesh is active

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
  crowd: [],
  roof: [],
  marble: [],
  cables: []
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
  onFloorLoaded: async (mesh) => {
    floorMesh = mesh;
    vrFloorMesh = mesh;
    console.log('Floor mesh loaded');
    loadingManager.setLoaded('floorMesh');
    
    // Set floor mesh reference in VRManager for teleportation
    if (vrManager) {
      vrManager.setFloorMesh(floorMesh);
    }
    
    // Create floating VR button once floor is available
    createVRFloatingButton();
    
    // Initialize crowd spawner when floor is loaded
    if (!crowdSpawner) {
      crowdSpawner = new CrowdSpawner(scene, floorMesh, shaderMaterials, materialReferences);
    } else {
      crowdSpawner.setFloorMesh(floorMesh);
    }
    
    // Try to wait for UI, but don't fail if it's not ready yet
    // Use a longer timeout and fallback to default value
    try {
      await loadingManager.waitFor('ui', 15000);
    } catch (error) {
      console.warn('UI not ready yet, using default crowd count:', error);
    }
    
    // Spawn crowd with slider value or default
    try {
      const slider = document.getElementById('crowdInstanceCountSlider');
      const count = slider ? parseInt(slider.value) || 4000 : 4000;
      await crowdSpawner.spawnCrowd(count);
      loadingManager.setLoaded('crowdMeshes');
    } catch (error) {
      console.warn('Failed to spawn crowd:', error);
      // Still mark as loaded even if crowd spawning fails
      loadingManager.setLoaded('crowdMeshes');
    }
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
    // Parent DJ artist mesh to current DJ mesh if available
    if (currentDJMesh) {
      if (mesh.parent) {
        mesh.parent.remove(mesh);
      }
      currentDJMesh.add(mesh);
      console.log('Parented DJ artist mesh to current DJ mesh');
    } else if (djLiftableMesh) {
      // Fallback to old liftable mesh for compatibility
      if (mesh.parent) {
        mesh.parent.remove(mesh);
      }
      djLiftableMesh.add(mesh);
      console.log('Parented DJ artist mesh to liftable stage');
    }
  },
  onDJLowLoaded: (mesh) => {
    djLowMesh = mesh;
    console.log('DJ low mesh loaded');
    // Make it visible by default
    mesh.visible = true;
    if (!currentDJMesh) {
      currentDJMesh = mesh;
    }
    // If DJ artist mesh is already loaded, parent it to the low mesh
    if (djArtistMesh) {
      if (djArtistMesh.parent) {
        djArtistMesh.parent.remove(djArtistMesh);
      }
      mesh.add(djArtistMesh);
      console.log('Parented DJ artist mesh to DJ low mesh');
    }
    // Add to stage group
    stageGroup.add(mesh);
  },
  onDJHighLoaded: (mesh) => {
    djHighMesh = mesh;
    console.log('DJ high mesh loaded');
    // Hidden by default
    mesh.visible = false;
    // If DJ artist mesh is already loaded and we're on low, don't parent yet
    // It will be parented when toggling
    // Add to stage group
    stageGroup.add(mesh);
  }
});

// Load mask texture on initialization
loadMaskTexture().then(() => {
  console.log('Mask texture loaded successfully');
  loadingManager.setLoaded('maskTexture');
}).catch((error) => {
  console.warn('Failed to load mask texture:', error);
  loadingManager.setError('maskTexture', error);
});

// Initialize LED Mapping
let ledMapping = new LEDMapping(meshLoader, ledsGroup, material, createLEDShaderMaterial, updateLEDShaders);

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
function loadLEDMeshes(mappingType, useCorrected = false, useGaragefix = true) {
  if (!ledMapping) {
    console.error('LEDMapping not initialized');
    return;
  }
  ledMapping.loadLEDMeshes(mappingType, useCorrected, useGaragefix);
  // Update global references for backwards compatibility
  ledFrontMesh = ledMapping.getLEDFrontMesh();
  const garages = ledMapping.getGarageMeshes();
  slGarageMesh = garages.sl;
  srGarageMesh = garages.sr;
}

// Track mesh loading
let stageMeshesLoaded = 0;
const totalStageMeshes = meshFiles.stage.length;
let ledMeshesLoaded = false;

// Function to check if all stage meshes are loaded
function checkStageMeshesLoaded() {
  stageMeshesLoaded++;
  if (stageMeshesLoaded >= totalStageMeshes) {
    loadingManager.setLoaded('stageMeshes');
  }
}

// Function to check if LED meshes are loaded
function checkLEDMeshesLoaded() {
  if (!ledMeshesLoaded) {
    ledMeshesLoaded = true;
    loadingManager.setLoaded('ledMeshes');
    
    // Hide front screen by default for Festival Mapping, show for Front Projection types
    // Set mesh visibility immediately (doesn't require UI)
    if (ledFrontMesh) {
      if (currentMappingType === 'festival') {
        ledFrontMesh.visible = false;
      } else if (currentMappingType === 'frontProjection' || currentMappingType === 'frontProjectionPerspective') {
        ledFrontMesh.visible = true;
      }
    }
    
    // Update checkbox when UI is ready (non-blocking)
    loadingManager.waitFor('ui', 15000).then(() => {
      const hideLedFrontCheckbox = document.getElementById('hideLedFront');
      if (ledFrontMesh && hideLedFrontCheckbox) {
        if (currentMappingType === 'festival') {
          hideLedFrontCheckbox.checked = true;
        } else if (currentMappingType === 'frontProjection' || currentMappingType === 'frontProjectionPerspective') {
          hideLedFrontCheckbox.checked = false;
        }
      }
    }).catch(err => {
      // UI not ready yet, but mesh visibility is already set, so this is fine
      console.debug('UI not ready for LED front checkbox update (mesh visibility already set):', err);
    });
  }
}

// Load initial LED meshes (Front Projection by default)
// Note: useCorrectedMeshCheckbox will be defined later, so we default to false
loadLEDMeshes(currentMappingType, false, true);
// Mark LED meshes as loaded after a short delay (they load asynchronously)
// This will be improved when MeshLoader returns promises
setTimeout(checkLEDMeshesLoaded, 500);

// Load all Stage meshes
meshFiles.stage.forEach(path => {
  loadMesh(path, stageGroup, true);
  // Track when all stage meshes are loaded
  // This will be improved when MeshLoader returns promises
  setTimeout(checkStageMeshesLoaded, 100);
});

// Load DJ meshes (low and high)
loadMesh(djMeshFiles.low, stageGroup, true);
loadMesh(djMeshFiles.high, stageGroup, true);


// Crowd spawning - individual crowd meshes on the floor mesh with random mesh selection
// Crowd spawning is handled by src/features/CrowdSpawner.js (instanced implementation)

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
  const instanceCount = slider ? parseInt(slider.value) || 5000 : 5000;
  console.log(`[spawnCrowdCubes] Spawning ${instanceCount} crowd instances (slider value: ${slider ? slider.value : 'N/A'})`);
  await crowdSpawner.spawnCrowd(instanceCount);
}

// Function to spawn crowd instances (wrapper for CrowdSpawner)
function spawnCrowdInstances() {
  if (!crowdSpawner) {
    if (!floorMesh) {
      console.error('No floor mesh available');
      return;
    }
    crowdSpawner = new CrowdSpawner(scene, floorMesh, shaderMaterials, materialReferences);
  }
  
  const slider = document.getElementById('crowdInstanceCountSlider');
  const instanceCount = slider ? parseInt(slider.value) || 5000 : 5000;
  
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
// Version is read from package.json via vite.config.js -> __APP_VERSION__
// This ensures the displayed version always matches package.json version
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

// Helper function to handle toggle button click/touch
function handleToggleButton(button, panel, burgerMenu = null) {
  if (!button || !panel) return;
  
  const togglePanel = () => {
    panel.classList.toggle('minimized');
    // Special handling for playback menu
    if (panel.id === 'playbackMenu') {
      if (panel.classList.contains('minimized')) {
        button.innerHTML = '<span class="material-icons">keyboard_onscreen</span>';
      } else {
        button.textContent = '−';
      }
    } else {
      button.textContent = panel.classList.contains('minimized') ? '+' : '−';
    }
    if (burgerMenu) {
      burgerMenu.style.display = panel.classList.contains('minimized') ? 'flex' : 'none';
    }
  };
  
  // Support both click and touch events for mobile
  // Use capture phase to ensure event fires before panel drag handlers
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    togglePanel();
  }, true);
  
  button.addEventListener('touchend', (e) => {
    e.preventDefault();
    e.stopPropagation();
    togglePanel();
  }, true);
}

// Style-Shader panel minimize toggle
const styleShaderPanelToggle = document.getElementById('styleShaderPanelToggle');
if (styleShaderPanelToggle && styleShaderPanel) {
  // Initialize as minimized (class is already in HTML)
  handleToggleButton(styleShaderPanelToggle, styleShaderPanel);
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
  
  handleToggleButton(settingsPanelToggle, settingsPanel, settingsPanelBurger);
}

// Settings panel burger menu (shows when minimized)
if (settingsPanelBurger && settingsPanel) {
  // Initialize burger menu as visible since panel starts minimized
  settingsPanelBurger.style.display = 'flex';
  
  const handleBurgerClick = () => {
    settingsPanel.classList.remove('minimized');
    if (settingsPanelToggle) {
      settingsPanelToggle.textContent = '−';
    }
    settingsPanelBurger.style.display = 'none';
  };
  
  settingsPanelBurger.addEventListener('click', (e) => {
    e.stopPropagation();
    handleBurgerClick();
  });
  
  settingsPanelBurger.addEventListener('touchend', (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleBurgerClick();
  });
}

// Camera panel minimize toggle
const cameraPanelToggle = document.getElementById('cameraPanelToggle');
if (cameraPanelToggle && cameraPanel) {
  handleToggleButton(cameraPanelToggle, cameraPanel);
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

// NDI stream status
let ndiStreamStatus = null;
let currentNdiStreamName = null;
let pendingNdiFileInfo = null;

// Source type dropdown (will be initialized when UI is ready)
let sourceTypeSelect = null;
let textureInputGroup = null;
let ndiStreamGroup = null;

// Initialize NDI UI components
function initializeNDIUI() {
  // Get DOM elements
  ndiStreamStatus = document.getElementById('ndiStreamStatus');
  sourceTypeSelect = document.getElementById('sourceTypeSelect');
  textureInputGroup = document.getElementById('textureInputGroup');
  ndiStreamGroup = document.getElementById('ndiStreamGroup');
  
  if (!sourceTypeSelect || !textureInputGroup || !ndiStreamGroup) {
    return false; // Elements not ready yet
  }
  
  // Handle source type change
  sourceTypeSelect.addEventListener('change', (e) => {
    const selectedType = e.target.value;
    
    if (selectedType === 'texture') {
      // Show texture input, hide NDI controls
      textureInputGroup.style.display = 'block';
      textureInputGroup.classList.remove('hidden');
      const fileInputWrapper = document.getElementById('fileInputWrapper');
      if (fileInputWrapper) {
        fileInputWrapper.style.display = 'flex';
      }
      ndiStreamGroup.style.display = 'none';
      ndiStreamGroup.classList.add('hidden');
      // Show frame info when using texture/video (if checkbox is checked)
      if (frameInfo) {
        frameInfo.style.display = '';
        const showFileInfoCheckbox = document.getElementById('showFileInfo');
        const videoElement = mediaManager ? mediaManager.getCurrentVideoElement() : null;
        if (showFileInfoCheckbox && showFileInfoCheckbox.checked && videoElement) {
          frameInfo.classList.add('active');
        }
      }
      
      // Restore last selected video asset or load default
      if (videoAssetSelect && lastSelectedVideoAsset) {
        videoAssetSelect.value = lastSelectedVideoAsset;
        // Trigger the change event to load the video
        const event = new Event('change', { bubbles: true });
        videoAssetSelect.dispatchEvent(event);
      } else if (videoAssetSelect && !lastSelectedVideoAsset) {
        // Load default video if no previous selection
        const defaultPath = DEFAULT_VIDEO_PATH;
        videoAssetSelect.value = defaultPath;
        loadVideoFromPath(defaultPath);
      }
    } else if (selectedType === 'ndi') {
      // Show NDI controls, hide texture input
      textureInputGroup.style.display = 'none';
      textureInputGroup.classList.add('hidden');
      const fileInputWrapper = document.getElementById('fileInputWrapper');
      if (fileInputWrapper) {
        fileInputWrapper.style.display = 'none';
      }
      ndiStreamGroup.style.display = 'block';
      ndiStreamGroup.classList.remove('hidden');
      // Hide frame info when using NDI
      if (frameInfo) {
        frameInfo.classList.remove('active');
        frameInfo.style.display = 'none';
      }
      // Try to load OBS Virtual Camera directly (bypasses NDI discovery)
      console.log('Source type changed to NDI, loading OBS Virtual Camera...');
      loadOBSVirtualCamera().catch(error => {
        console.warn('OBS Virtual Camera not available, trying NDI discovery:', error.message);
        // Fallback to NDI discovery if OBS Virtual Camera not found
        discoverNDIStreams().catch(err => {
          console.error('Error during NDI discovery:', err);
          setNdiStatus('No OBS Virtual Camera or NDI streams found');
        });
      });
    }
  });
  
  // Initialize UI state based on default selection
  const initialSourceType = sourceTypeSelect.value;
  if (initialSourceType === 'ndi') {
    // Show NDI controls, hide texture input
    textureInputGroup.style.display = 'none';
    textureInputGroup.classList.add('hidden');
    const fileInputWrapper = document.getElementById('fileInputWrapper');
    if (fileInputWrapper) {
      fileInputWrapper.style.display = 'none';
    }
    ndiStreamGroup.style.display = 'block';
    ndiStreamGroup.classList.remove('hidden');
    // Hide frame info when using NDI
    if (frameInfo) {
      frameInfo.classList.remove('active');
      frameInfo.style.display = 'none';
    }
    // Try to load OBS Virtual Camera directly (bypasses NDI discovery)
    console.log('Initial source type is NDI, loading OBS Virtual Camera...');
    loadOBSVirtualCamera().catch(error => {
      console.warn('OBS Virtual Camera not available, trying NDI discovery:', error.message);
      // Fallback to NDI discovery if OBS Virtual Camera not found
      discoverNDIStreams().catch(err => {
        console.error('Error during initial NDI discovery:', err);
        setNdiStatus('No OBS Virtual Camera or NDI streams found');
      });
    });
  } else {
    // Show texture input, hide NDI controls
    textureInputGroup.style.display = 'block';
    textureInputGroup.classList.remove('hidden');
    const fileInputWrapper = document.getElementById('fileInputWrapper');
    if (fileInputWrapper) {
      fileInputWrapper.style.display = 'flex';
    }
    ndiStreamGroup.style.display = 'none';
    ndiStreamGroup.classList.add('hidden');
  }
  
  return true; // Successfully initialized
}

// Try to initialize NDI UI when UI is ready
function tryInitializeNDIUI() {
  if (initializeNDIUI()) {
    return true;
  }
  // If not ready, wait a bit and try again
  setTimeout(() => {
    if (!initializeNDIUI()) {
      // Try one more time after a longer delay
      setTimeout(tryInitializeNDIUI, 500);
    }
  }, 100);
  return false;
}

// Start trying to initialize NDI UI
tryInitializeNDIUI();

// Also try when UI loading state is set
loadingManager.addListener('ui', () => {
  if (loadingManager.isLoaded('ui')) {
    tryInitializeNDIUI();
  }
});

// Mapping type dropdown change handler
const mappingTypeSelect = document.getElementById('mappingTypeSelect');
const useCorrectedMeshCheckbox = document.getElementById('useCorrectedMesh');
const correctedMeshGroup = document.getElementById('correctedMeshGroup');
const hideLedFrontGroup = document.getElementById('hideLedFrontGroup');

// Hide LED Front checkbox is permanently hidden
// if (hideLedFrontGroup) {
//   if (currentMappingType === 'renderOption1' || currentMappingType === 'renderOption1NoFront') {
//     hideLedFrontGroup.style.display = 'block';
//   } else {
//     hideLedFrontGroup.style.display = 'none';
//   }
// }

if (mappingTypeSelect) {
  mappingTypeSelect.addEventListener('change', (e) => {
    const selectedType = e.target.value;
    currentMappingType = selectedType;
    
    // Get current state of "hide LED front" checkbox before switching
    const hideLedFrontCheckbox = document.getElementById('hideLedFront');
    const hideLedFrontGroup = document.getElementById('hideLedFrontGroup');
    // Don't capture the state yet - we'll update it based on the selected type
    
    // Hide LED Front checkbox is permanently hidden - no longer shown for any mapping type
    // if (hideLedFrontGroup) {
    //   if (selectedType === 'renderOption1' || selectedType === 'renderOption1NoFront') {
    //     hideLedFrontGroup.style.display = 'block';
    //   } else {
    //     hideLedFrontGroup.style.display = 'none';
    //   }
    // }
    
    // Handle front mesh visibility based on mapping type
    // This is independent of garagefix - garagefix only affects which GLB file is loaded
    if (selectedType === 'renderOption1NoFront') {
      // Automatically check the hide LED front checkbox
      if (hideLedFrontCheckbox) {
        hideLedFrontCheckbox.checked = true;
      }
    } else if (selectedType === 'renderOption1') {
      // Auto-show LED front for renderOption1 - uncheck the checkbox to show front
      if (hideLedFrontCheckbox) {
        hideLedFrontCheckbox.checked = false;
      }
    }
    
    // Show/hide corrected mesh checkbox
    // Hide for FarCam options (A-E) and festival, show only for frontProjection types
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
    
  // Show/hide Garagefix checkbox - only for renderOption1NoFront
    const useGaragefixGroup = document.getElementById('useGaragefixGroup');
    const useGaragefixCheckbox = document.getElementById('useGaragefix');
    const overlapMaskGroup = document.getElementById('overlapMaskGroup');
    const overlapMaskCheckbox = document.getElementById('enableOverlapMask');
    if (useGaragefixGroup) {
      if (selectedType === 'renderOption1NoFront') {
        useGaragefixGroup.style.display = 'block';
      } else {
        useGaragefixGroup.style.display = 'none';
      }
    }
    // Overlap mask checkbox is only visible when Garagefix is supported AND enabled (Option 1 - no Front)
    if (overlapMaskGroup) {
      const isNoFront = selectedType === 'renderOption1NoFront';
      const garagefixOn = useGaragefixCheckbox ? useGaragefixCheckbox.checked : true;
      if (isNoFront && garagefixOn) {
        overlapMaskGroup.style.display = 'block';
      } else {
        overlapMaskGroup.style.display = 'none';
      }
    }
    
    // Get checkbox states
    const useCorrected = useCorrectedMeshCheckbox ? useCorrectedMeshCheckbox.checked : false;
    const useGaragefix = useGaragefixCheckbox ? useGaragefixCheckbox.checked : true;
    
    // Swap LED meshes
    loadLEDMeshes(selectedType, useCorrected, useGaragefix);
    
    // Update front mesh visibility after meshes load
    // LEDMapping will handle this, but we'll also trigger an update after a delay
    setTimeout(() => {
      if (ledMapping) {
        ledMapping.updateFrontMeshVisibility();
      }
      // Update LED shaders with current texture after loading
      updateLEDShaders(ledsGroup, material, selectedType);
    }, 400);
  });
}

// Corrected mesh checkbox change handler
if (useCorrectedMeshCheckbox) {
  useCorrectedMeshCheckbox.addEventListener('change', (e) => {
    const useCorrected = e.target.checked;
    // Get current visibility state before reloading
    const hideLedFrontCheckbox = document.getElementById('hideLedFront');
    const shouldHideLedFront = hideLedFrontCheckbox ? hideLedFrontCheckbox.checked : false;
    
    // Get Garagefix checkbox state
    const useGaragefixCheckbox = document.getElementById('useGaragefix');
    const useGaragefix = useGaragefixCheckbox ? useGaragefixCheckbox.checked : true;
    
    // Reload LED meshes with corrected state
    loadLEDMeshes(currentMappingType, useCorrected, useGaragefix);
    
    // Wait for meshes to load and then update visibility
    setTimeout(() => {
      if (ledMapping) {
        ledMapping.updateFrontMeshVisibility();
      }
      // Update LED shaders with current texture after loading
      updateLEDShaders(ledsGroup, material, currentMappingType);
    }, 400);
  });
  
  // Reload corrected wings if checkbox is checked and mapping type supports it
  if (useCorrectedMeshCheckbox.checked && (currentMappingType === 'frontProjection' || currentMappingType === 'frontProjectionPerspective')) {
    // Get current visibility state
    const hideLedFrontCheckbox = document.getElementById('hideLedFront');
    const shouldHideLedFront = hideLedFrontCheckbox ? hideLedFrontCheckbox.checked : false;
    
    // Get Garagefix checkbox state
    const useGaragefixCheckbox = document.getElementById('useGaragefix');
    const useGaragefix = useGaragefixCheckbox ? useGaragefixCheckbox.checked : true;
    
    // Reload LED meshes with corrected state
    loadLEDMeshes(currentMappingType, true, useGaragefix);
    
      // Wait for meshes to load and then update visibility
      setTimeout(() => {
        if (ledMapping) {
          ledMapping.updateFrontMeshVisibility();
        }
        // Update LED shaders with current texture after loading
        updateLEDShaders(ledsGroup, material, currentMappingType);
      }, 400);
  }
}

// Garagefix checkbox change handler
const useGaragefixCheckbox = document.getElementById('useGaragefix');
if (useGaragefixCheckbox) {
  useGaragefixCheckbox.addEventListener('change', (e) => {
    const useGaragefix = e.target.checked;
    // Get current visibility state before reloading
    const hideLedFrontCheckbox = document.getElementById('hideLedFront');
    const shouldHideLedFront = hideLedFrontCheckbox ? hideLedFrontCheckbox.checked : false;
    
    // Get corrected mesh checkbox state
    const useCorrected = useCorrectedMeshCheckbox ? useCorrectedMeshCheckbox.checked : false;
    
    // Update overlap mask checkbox visibility when Garagefix is toggled (only for Option 1 - no Front)
    const overlapMaskGroup = document.getElementById('overlapMaskGroup');
    if (overlapMaskGroup) {
      const isNoFront = currentMappingType === 'renderOption1NoFront';
      if (isNoFront && useGaragefix) {
        overlapMaskGroup.style.display = 'block';
      } else {
        overlapMaskGroup.style.display = 'none';
      }
    }
    
    // Only reload if mapping type supports Garagefix (Option 1 - no Front)
    if (currentMappingType === 'renderOption1NoFront') {
      // Reload LED meshes with Garagefix state
      loadLEDMeshes(currentMappingType, useCorrected, useGaragefix);
      
      // Wait for meshes to load and then update visibility
      setTimeout(() => {
        if (ledMapping) {
          ledMapping.updateFrontMeshVisibility();
        }
        // Update LED shaders with current texture after loading (to apply/remove mask)
        updateLEDShaders(ledsGroup, material, currentMappingType);
      }, 400);
    }
  });
}

// Overlap mask checkbox change handler - just reapply LED shaders with current toggle state
const overlapMaskCheckbox = document.getElementById('enableOverlapMask');
if (overlapMaskCheckbox) {
  overlapMaskCheckbox.addEventListener('change', () => {
    updateLEDShaders(ledsGroup, material, currentMappingType);
  });
}

// Initialize checkbox visibility on page load
// Note: mainApp.js is imported only after DOMContentLoaded (see root main.js).
function initializeUI() {
  // Initialize all UI elements that are available
  const correctedMeshGroup = document.getElementById('correctedMeshGroup');
  if (correctedMeshGroup) {
    // Hide for FarCam options (A-E) and festival, show only for frontProjection types
    if (currentMappingType === 'frontProjection' || currentMappingType === 'frontProjectionPerspective') {
      correctedMeshGroup.style.display = 'block';
    } else {
      correctedMeshGroup.style.display = 'none';
    }
  }
  
  // Initialize Garagefix checkbox visibility
  const useGaragefixGroup = document.getElementById('useGaragefixGroup');
  if (useGaragefixGroup) {
    if (currentMappingType === 'renderOption1NoFront') {
      useGaragefixGroup.style.display = 'block';
    } else {
      useGaragefixGroup.style.display = 'none';
    }
  }
  
  // Initialize overlap mask checkbox visibility
  const overlapMaskGroup = document.getElementById('overlapMaskGroup');
  const useGaragefixCheckboxInit = document.getElementById('useGaragefix');
  if (overlapMaskGroup) {
    const isNoFront = currentMappingType === 'renderOption1NoFront';
    const garagefixOn = useGaragefixCheckboxInit ? useGaragefixCheckboxInit.checked : true;
    if (isNoFront && garagefixOn) {
      overlapMaskGroup.style.display = 'block';
    } else {
      overlapMaskGroup.style.display = 'none';
    }
  }
  
  // Initialize cables color control in Stage tab
  const stageCablesColorPicker = document.getElementById('stageCablesColorPicker');
  const stageCablesColorValue = document.getElementById('stageCablesColorValue');
  if (stageCablesColorPicker) {
    // Helper to convert hex to [0-1] RGB
    const hexToRgb01 = (hex) => {
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      return [r, g, b];
    };
    
    // Initialize picker from current cables shader config if available
    try {
      const cablesMaterial = shaderMaterials.cables;
      if (cablesMaterial && cablesMaterial.uniforms && cablesMaterial.uniforms.uBaseColor) {
        const v = cablesMaterial.uniforms.uBaseColor.value;
        const r = Math.round(v.x * 255).toString(16).padStart(2, '0');
        const g = Math.round(v.y * 255).toString(16).padStart(2, '0');
        const b = Math.round(v.z * 255).toString(16).padStart(2, '0');
        stageCablesColorPicker.value = `#${r}${g}${b}`;
      }
    } catch (e) {
      console.warn('Could not initialize cables color picker from shader:', e);
    }
    
    stageCablesColorPicker.addEventListener('input', (e) => {
      const rgb = hexToRgb01(e.target.value);
      // Update cables shader base color
      updateShaderUniforms('cables', 'uBaseColor', rgb);
      if (stageCablesColorValue) {
        stageCablesColorValue.textContent = e.target.value.toUpperCase();
      }
    });
  }
  
  // Mark UI as loaded if DOM is ready and we found key elements
  // Key elements: settingsPanel, crowdInstanceCountSlider, sourceTypeSelect, etc.
  const keyElementsExist = !!(
    document.getElementById('settingsPanel') &&
    document.getElementById('crowdInstanceCountSlider') &&
    document.getElementById('sourceTypeSelect')
  );
  
  if (keyElementsExist) {
    loadingManager.setLoaded('ui');
    // Try to initialize NDI UI now that elements are available
    tryInitializeNDIUI();
    return true;
  }
  
  return false;
}

// Texture scale slider handler
const textureScaleSlider = document.getElementById('textureScaleSlider');
const textureScaleValue = document.getElementById('textureScaleValue');

if (textureScaleSlider && textureScaleValue) {
  textureScaleSlider.addEventListener('input', (e) => {
    const scale = parseFloat(e.target.value);
    textureScaleValue.textContent = scale.toFixed(2);
    
    // Update texture scale uniform in the main material
    if (material && material.uniforms && material.uniforms.uTextureScale) {
      material.uniforms.uTextureScale.value = scale;
      material.needsUpdate = true;
    }
    
    // Update texture scale in all LED shaders
    updateLEDShaders(ledsGroup, material, currentMappingType);
  });
}

// Texture offset U slider handler
const textureOffsetUSlider = document.getElementById('textureOffsetUSlider');
const textureOffsetUValue = document.getElementById('textureOffsetUValue');

if (textureOffsetUSlider && textureOffsetUValue) {
  textureOffsetUSlider.addEventListener('input', (e) => {
    const offset = parseFloat(e.target.value);
    textureOffsetUValue.textContent = offset.toFixed(2);
    
    // Update texture offset U uniform in the main material
    if (material && material.uniforms && material.uniforms.uTextureOffsetU) {
      material.uniforms.uTextureOffsetU.value = offset;
      material.needsUpdate = true;
    }
    
    // Update texture offset U in all LED shaders
    updateLEDShaders(ledsGroup, material, currentMappingType);
  });
}

// Texture offset V slider handler
const textureOffsetVSlider = document.getElementById('textureOffsetVSlider');
const textureOffsetVValue = document.getElementById('textureOffsetVValue');

if (textureOffsetVSlider && textureOffsetVValue) {
  textureOffsetVSlider.addEventListener('input', (e) => {
    const offset = parseFloat(e.target.value);
    textureOffsetVValue.textContent = offset.toFixed(2);
    
    // Update texture offset V uniform in the main material
    if (material && material.uniforms && material.uniforms.uTextureOffsetV) {
      material.uniforms.uTextureOffsetV.value = offset;
      material.needsUpdate = true;
    }
    
    // Update texture offset V in all LED shaders
    updateLEDShaders(ledsGroup, material, currentMappingType);
  });
}

// Texture scale reset button handler
const textureScaleResetBtn = document.getElementById('textureScaleResetBtn');
if (textureScaleResetBtn && textureScaleSlider && textureScaleValue) {
  textureScaleResetBtn.addEventListener('click', () => {
    const defaultValue = 1.0;
    textureScaleSlider.value = defaultValue;
    textureScaleValue.textContent = defaultValue.toFixed(2);
    
    // Update texture scale uniform in the main material
    if (material && material.uniforms && material.uniforms.uTextureScale) {
      material.uniforms.uTextureScale.value = defaultValue;
      material.needsUpdate = true;
    }
    
    // Update texture scale in all LED shaders
    updateLEDShaders(ledsGroup, material, currentMappingType);
  });
}

// Texture offset U reset button handler
const textureOffsetUResetBtn = document.getElementById('textureOffsetUResetBtn');
if (textureOffsetUResetBtn && textureOffsetUSlider && textureOffsetUValue) {
  textureOffsetUResetBtn.addEventListener('click', () => {
    const defaultValue = 0.0;
    textureOffsetUSlider.value = defaultValue;
    textureOffsetUValue.textContent = defaultValue.toFixed(2);
    
    // Update texture offset U uniform in the main material
    if (material && material.uniforms && material.uniforms.uTextureOffsetU) {
      material.uniforms.uTextureOffsetU.value = defaultValue;
      material.needsUpdate = true;
    }
    
    // Update texture offset U in all LED shaders
    updateLEDShaders(ledsGroup, material, currentMappingType);
  });
}

// Texture offset V reset button handler
const textureOffsetVResetBtn = document.getElementById('textureOffsetVResetBtn');
if (textureOffsetVResetBtn && textureOffsetVSlider && textureOffsetVValue) {
  textureOffsetVResetBtn.addEventListener('click', () => {
    const defaultValue = 0.0;
    textureOffsetVSlider.value = defaultValue;
    textureOffsetVValue.textContent = defaultValue.toFixed(2);
    
    // Update texture offset V uniform in the main material
    if (material && material.uniforms && material.uniforms.uTextureOffsetV) {
      material.uniforms.uTextureOffsetV.value = defaultValue;
      material.needsUpdate = true;
    }
    
    // Update texture offset V in all LED shaders
    updateLEDShaders(ledsGroup, material, currentMappingType);
  });
}

function setNdiStatus(message, type = 'info') {
  // Try to get element if not already cached
  if (!ndiStreamStatus) {
    ndiStreamStatus = document.getElementById('ndiStreamStatus');
  }
  if (!ndiStreamStatus) {
    // Silently return if element not found (not critical, just UI feedback)
    return;
  }
  ndiStreamStatus.textContent = message;
  ndiStreamStatus.dataset.state = type;
}

function updateNdiFileInfo(streamName) {
  pendingNdiFileInfo = streamName;
  if (fileInfoManager && typeof fileInfoManager.setNDIStreamName === 'function') {
    fileInfoManager.setNDIStreamName(streamName);
  }
}

// Track if discovery is in progress to prevent duplicate calls
let ndiDiscoveryInProgress = false;

// Function to fetch and display available NDI streams
async function discoverNDIStreams() {
  // Prevent multiple simultaneous discovery calls
  if (ndiDiscoveryInProgress) {
    return;
  }
  
  ndiDiscoveryInProgress = true;
  const discoveryUrl = `http://localhost:8080/ndi/discover?t=${Date.now()}`;
  setNdiStatus('Discovering NDI streams...');
  currentNdiStreamName = null;
  
  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
  
  try {
    const response = await fetch(discoveryUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      cache: 'no-cache',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const streams = await response.json();
    console.log('Received streams data:', streams);
    
    if (Array.isArray(streams) && streams.length > 0) {
      // Prioritize OBS Virtual Camera streams
      // Look for streams that might be from OBS (common OBS NDI source names)
      const obsStreamPatterns = [
        /obs/i,
        /virtual.*camera/i,
        /obs.*studio/i,
        /obs.*virtual/i
      ];
      
      let selectedStream = null;
      let selectedStreamName = null;
      
      // First, try to find an OBS-related stream
      for (const stream of streams) {
        const streamName = typeof stream === 'string'
          ? stream
          : (stream.name || stream.sourceName || stream.ndi_name || '');
        
        // Check if this stream matches OBS patterns
        const isOBSStream = obsStreamPatterns.some(pattern => pattern.test(streamName));
        
        if (isOBSStream) {
          selectedStream = stream;
          selectedStreamName = streamName;
          console.log('Found OBS Virtual Camera stream:', streamName);
          break;
        }
      }
      
      // If no OBS stream found, use the first stream
      if (!selectedStream) {
        selectedStream = streams[0];
        selectedStreamName = typeof selectedStream === 'string'
          ? selectedStream
          : (selectedStream.name || selectedStream.sourceName || selectedStream.ndi_name || 'Unknown');
        console.log('No OBS stream found, using first available stream:', selectedStreamName);
      }
      
      currentNdiStreamName = selectedStreamName;
      setNdiStatus(`NDI Stream: ${selectedStreamName}`);
      updateNdiFileInfo(selectedStreamName);
      // Load NDI stream (will wait for MediaManager if needed)
      loadNDIStream(selectedStreamName).catch(error => {
        console.error('Failed to load NDI stream:', error);
        setNdiStatus(`Error loading stream: ${error.message}`);
      });
    } else {
      setNdiStatus('No NDI streams found');
      updateNdiFileInfo(null);
    }
  } catch (error) {
    // Handle connection refused and other network errors gracefully
    if (error.name === 'AbortError' || error.message.includes('Failed to fetch') || error.message.includes('ERR_CONNECTION_REFUSED')) {
      // Backend server is not running - this is expected in some cases
      setNdiStatus('Backend server not available');
      console.debug('NDI backend server not available at:', discoveryUrl);
      console.debug('Note: Start the backend server (server.js) to enable NDI stream discovery');
    } else {
      // Other errors - log but don't spam
      console.warn('Error discovering NDI streams:', error.message);
      setNdiStatus('Error discovering NDI streams');
    }
    updateNdiFileInfo(null);
  } finally {
    clearTimeout(timeoutId);
    ndiDiscoveryInProgress = false;
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

// OverlayManager will be initialized after mediaManager
let overlayManager = null;

// FileInfoManager will be initialized after mediaManager
let fileInfoManager = null;

// Track last selected video asset for restoration when switching back to texture mode
let lastSelectedVideoAsset = null;

// Wrapper functions for backwards compatibility
function updateFrameInfo(video) {
  if (fileInfoManager) {
    fileInfoManager.updateFrameInfo(video, timelineSlider, isSeeking);
  }
}

function updateStillInfo(file) {
  if (fileInfoManager) {
    fileInfoManager.updateStillInfo(file);
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

// Checkbox to toggle mapping visibility
const hideLedFrontCheckbox = document.getElementById('hideLedFront');


// Handle hide LED front checkbox
// Hide LED front checkbox change handler
if (hideLedFrontCheckbox) {
  hideLedFrontCheckbox.addEventListener('change', (e) => {
    // Use LEDMapping's method to update visibility based on mapping type and checkbox
    if (ledMapping) {
      ledMapping.updateFrontMeshVisibility();
    } else {
      // Fallback for backwards compatibility
      const shouldHide = e.target.checked;
      const shouldShow = !shouldHide;
      const currentLedFrontMesh = ledFrontMesh;
      if (currentLedFrontMesh) {
        currentLedFrontMesh.visible = shouldShow;
        // Also traverse and hide/show LED_FRONT_* meshes
        if (ledsGroup) {
          ledsGroup.traverse((child) => {
            if (child.isMesh && child.name && child.name.includes('LED_FRONT_')) {
              child.visible = shouldShow;
            }
          });
        }
      }
    }
    
    console.log('LED front visibility updated based on checkbox and mapping type');
  });
}

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
    if (floorMesh && crowdSpawner) {
      spawnCrowdCubes().catch(err => {
        console.error('Error respawning crowd:', err);
      });
    }
  });
}

// Show mapping checkbox handler is now in OverlayManager

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
    videoAssetSelect: videoAssetSelect,
    adjustMappingAspectRatio: (width, height) => {
      if (overlayManager) {
        overlayManager.adjustMappingAspectRatio(width, height);
      }
    }
  });
  
  // Initialize FileInfoManager after MediaManager
  fileInfoManager = new FileInfoManager(mediaManager);
  
  // Set FileInfoManager reference in MediaManager
  if (mediaManager) {
    mediaManager.fileInfoManager = fileInfoManager;
  }
  
  if (pendingNdiFileInfo) {
    fileInfoManager.setNDIStreamName(pendingNdiFileInfo);
  }
  
  // Initialize OverlayManager after MediaManager
  overlayManager = new OverlayManager(mediaManager, material);
  
  // Update MediaManager with overlayManager reference
  if (mediaManager) {
    mediaManager.overlayManager = overlayManager;
  }
  
  loadingManager.setLoaded('mediaManager');
}

// Handle DJ height toggle button
const djHeightToggleBtn = document.getElementById('djHeightToggleBtn');
if (djHeightToggleBtn) {
  djHeightToggleBtn.addEventListener('click', () => {
    if (!djLowMesh || !djHighMesh) {
      console.warn('DJ meshes not loaded yet');
      return;
    }
    
    if (currentDJMesh === djLowMesh) {
      // Switch to high
      djLowMesh.visible = false;
      djHighMesh.visible = true;
      currentDJMesh = djHighMesh;
      // Reparent DJ artist mesh if it exists
      if (djArtistMesh) {
        if (djArtistMesh.parent) {
          djArtistMesh.parent.remove(djArtistMesh);
        }
        djHighMesh.add(djArtistMesh);
      }
    } else {
      // Switch to low
      djHighMesh.visible = false;
      djLowMesh.visible = true;
      currentDJMesh = djLowMesh;
      // Reparent DJ artist mesh if it exists
      if (djArtistMesh) {
        if (djArtistMesh.parent) {
          djArtistMesh.parent.remove(djArtistMesh);
        }
        djLowMesh.add(djArtistMesh);
      }
    }
  });
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

// Function to load OBS Virtual Camera directly (bypasses NDI discovery)
async function loadOBSVirtualCamera() {
  // Wait for MediaManager to be initialized
  try {
    await loadingManager.waitFor('mediaManager', 10000);
  } catch (error) {
    console.error('MediaManager not initialized, cannot load OBS Virtual Camera:', error);
    setNdiStatus('Error: MediaManager not ready');
    throw error;
  }
  
  if (!mediaManager) {
    console.error('MediaManager not available after waiting');
    setNdiStatus('Error: MediaManager not available');
    throw new Error('MediaManager not available');
  }
  
  console.log('Loading OBS Virtual Camera directly...');
  setNdiStatus('Connecting to OBS Virtual Camera...');
  
  // Call loadNDIStream - it will try loadNDIStreamViaCamera first
  // which looks for OBS Virtual Camera in browser devices
  // The streamName parameter is mostly ignored when using camera method
  try {
    await mediaManager.loadNDIStream('OBS Virtual Camera');
    setNdiStatus('OBS Virtual Camera connected');
    currentNdiStreamName = 'OBS Virtual Camera';
    updateNdiFileInfo('OBS Virtual Camera');
    console.log('Successfully loaded OBS Virtual Camera');
  } catch (error) {
    console.error('Failed to load OBS Virtual Camera:', error);
    setNdiStatus('OBS Virtual Camera not found: ' + error.message);
    throw error;
  }
}

// Function to load NDI stream as texture using WebSocket + Canvas
async function loadNDIStream(streamName) {
  // Wait for MediaManager to be initialized
  try {
    await loadingManager.waitFor('mediaManager', 10000);
  } catch (error) {
    console.error('MediaManager not initialized, cannot load NDI stream:', error);
    setNdiStatus('Error: MediaManager not ready');
    return;
  }
  
  if (!mediaManager) {
    console.error('MediaManager not available after waiting');
    setNdiStatus('Error: MediaManager not available');
    return;
  }
  
  console.log('Loading NDI stream:', streamName);
  mediaManager.loadNDIStream(streamName);
}

// Legacy function wrapper - replaced by MediaManager
// Default video path
const DEFAULT_VIDEO_PATH = '/assets/videos/ANYMA_DunDun_Option1_47to1.mp4';

// Function to load checkerboard texture
function loadCheckerboardTexture(checkerboardType = '55to1') {
  const texturePath = checkerboardType === '5to1' 
    ? '/assets/textures/UVGrid5to1.png'
    : '/assets/textures/UVGrid55to1.png';
  
  const loader = new THREE.TextureLoader();
  loader.load(
    texturePath,
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
      updateLEDShaders(ledsGroup, material, currentMappingType);
      
      // Setup overlay image for mapping preview
      if (overlayImage) {
        overlayImage.src = texturePath;
        overlayImage.style.display = 'block';
        overlayImage.onload = () => {
          if (overlayImage.naturalWidth && overlayImage.naturalHeight) {
            if (overlayManager) {
              overlayManager.adjustMappingAspectRatio(overlayImage.naturalWidth, overlayImage.naturalHeight);
            }
          }
        };
      }
      if (overlayVideo) {
        overlayVideo.style.display = 'none';
      }
      
      // Pause any currently playing video
      if (mediaManager) {
        const currentVideo = mediaManager.getCurrentVideoElement();
        if (currentVideo && !currentVideo.paused) {
          currentVideo.pause();
        }
        // Also cleanup video state
        mediaManager.cleanupPreviousVideo();
      }
      
      // Update file info display for checkerboard texture
      if (fileInfoManager) {
        // Create a mock file object for updateStillInfo
        const mockFile = {
          name: texturePath.split('/').pop() // Get filename from path
        };
        fileInfoManager.updateStillInfo(mockFile);
      }
      
      // Hide timeline for checkerboard (frameInfo visibility is handled by updateStillInfo)
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
        textureStatus.textContent = `Loaded: Checkerboard (${checkerboardType === '5to1' ? '5:1' : '5.5:1'})`;
        textureStatus.classList.add('loaded');
      }
      
      // Also update MediaManager's current image path so it's tracked
      if (mediaManager) {
        mediaManager.currentImagePath = texturePath;
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
      alert(`Error loading checkerboard texture. Please ensure ${texturePath.split('/').pop()} exists in /assets/textures/`);
    }
  );
}

// Function to load character texture
function loadCharacterTexture(characterType = '55to1') {
  const texturePath = characterType === '5to1' 
    ? '/assets/textures/Character_5to1.png'
    : '/assets/textures/Character_55to1.png';
  
  const loader = new THREE.TextureLoader();
  loader.load(
    texturePath,
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
      
      // Update LED shaders with the character texture
      updateLEDShaders(ledsGroup, material, currentMappingType);
      
      // Setup overlay image for mapping preview
      if (overlayImage) {
        overlayImage.src = texturePath;
        overlayImage.style.display = 'block';
        overlayImage.onload = () => {
          if (overlayImage.naturalWidth && overlayImage.naturalHeight) {
            if (overlayManager) {
              overlayManager.adjustMappingAspectRatio(overlayImage.naturalWidth, overlayImage.naturalHeight);
            }
          }
        };
      }
      if (overlayVideo) {
        overlayVideo.style.display = 'none';
      }
      
      // Pause any currently playing video
      if (mediaManager) {
        const currentVideo = mediaManager.getCurrentVideoElement();
        if (currentVideo && !currentVideo.paused) {
          currentVideo.pause();
        }
        // Also cleanup video state
        mediaManager.cleanupPreviousVideo();
      }
      
      // Update file info display for character texture
      if (fileInfoManager) {
        // Create a mock file object for updateStillInfo
        const mockFile = {
          name: texturePath.split('/').pop() // Get filename from path
        };
        fileInfoManager.updateStillInfo(mockFile);
      }
      
      // Hide timeline for character texture (frameInfo visibility is handled by updateStillInfo)
      if (timelineContainer) timelineContainer.classList.remove('active');
      if (stillInfo) stillInfo.classList.remove('active');
      
      // Hide playback menu for character texture
      if (playbackControls && playbackControls.playbackMenu) {
        playbackControls.playbackMenu.style.display = 'none';
      }
      
      // Show mapping overlay if checkbox is checked
      if (showMappingCheckbox && showMappingCheckbox.checked && mapping) {
        mapping.classList.add('active');
      }
      
      if (textureStatus) {
        textureStatus.textContent = `Loaded: Character (${characterType === '5to1' ? '5:1' : '5.5:1'})`;
        textureStatus.classList.add('loaded');
      }
      
      // Also update MediaManager's current image path so it's tracked
      if (mediaManager) {
        mediaManager.currentImagePath = texturePath;
      }
    },
    // onProgress callback (optional)
    undefined,
    // onError callback
    (error) => {
      console.error('Error loading character texture:', error);
      if (textureStatus) {
        textureStatus.textContent = 'Error loading character texture';
        textureStatus.classList.remove('loaded');
      }
      alert(`Error loading character texture. Please ensure ${texturePath.split('/').pop()} exists in /assets/textures/`);
    }
  );
}

// Video assets dropdown
if (videoAssetSelect) {
  videoAssetSelect.addEventListener('change', (e) => {
    const selectedValue = e.target.value;
    console.log('Video asset selected:', selectedValue);
    
    // Store the selected asset for restoration when switching back to texture mode
    if (selectedValue) {
      lastSelectedVideoAsset = selectedValue;
    }
    
    if (selectedValue) {
      // Image assets from bundled textures (e.g., UV grids)
      const isImageAsset = selectedValue.endsWith('.png') || selectedValue.endsWith('.jpg') || selectedValue.endsWith('.jpeg');
      
      if (isImageAsset) {
        console.log('Loading image from dropdown selection:', selectedValue);
        if (mediaManager && typeof mediaManager.loadImageFromPath === 'function') {
          mediaManager.loadImageFromPath(selectedValue);
        } else {
          console.warn('MediaManager.loadImageFromPath is not available, falling back to video loader');
          loadVideoFromPath(selectedValue);
        }
        // Reset file input
        if (textureInput) {
          textureInput.value = '';
        }
      } else if (selectedValue === 'checkerboard5to1') {
        console.log('Loading checkerboard texture (5:1)...');
        loadCheckerboardTexture('5to1');
        // Reset file input
        if (textureInput) {
          textureInput.value = '';
        }
      } else if (selectedValue === 'checkerboard55to1') {
        console.log('Loading checkerboard texture (5.5:1)...');
        loadCheckerboardTexture('55to1');
        // Reset file input
        if (textureInput) {
          textureInput.value = '';
        }
      } else if (selectedValue === 'character5to1') {
        console.log('Loading character texture (5:1)...');
        loadCharacterTexture('5to1');
        // Reset file input
        if (textureInput) {
          textureInput.value = '';
        }
      } else if (selectedValue === 'character55to1') {
        console.log('Loading character texture (5.5:1)...');
        loadCharacterTexture('55to1');
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




// Camera Controls
// ============================================
// Initialize camera controls
let cameraControls = null;

function initializeCameraControls() {
  cameraControls = new CameraControls(camera, controls);
  cameraControls.init();
  
  // Initialize SceneControls after DOM is ready
  if (!sceneControls) {
    sceneControls = new SceneControls(scene);
  }
}

// VR Manager
// ============================================
// Initialize VR manager (will be initialized after camera controls)
// Note: vrManager is declared at the top of the file

async function initializeVRManager() {
  try {
    vrManager = new VRManager(renderer, scene, camera, controls);
  } catch (error) {
    console.error('Failed to initialize VR Manager:', error);
    vrManager = null;
    return;
  }
  
  // Wait a bit for WebXR initialization
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Check VR availability and show button if supported
  // VR button is temporarily hidden - functionality kept intact
  // if (vrManager && vrManager.isVRAvailable()) {
  //   const vrButton = document.getElementById('vrToggleButton');
  //   if (vrButton) {
  //     vrButton.style.display = 'flex';
  //     
  //     // Setup VR button click handler
  //     vrButton.addEventListener('click', async () => {
  //       if (!vrManager.getIsVRActive()) {
  //         // Enter VR
  //         const success = await vrManager.enterVR();
  //         if (success) {
  //           vrButton.querySelector('.vr-button-text').textContent = 'Exit VR';
  //           vrButton.classList.add('vr-active');
  //         }
  //       } else {
  //         // Exit VR
  //         vrManager.exitVR();
  //         vrButton.querySelector('.vr-button-text').textContent = 'Enter VR';
  //         vrButton.classList.remove('vr-active');
  //       }
  //     });
  //   }
  // }
  
  // Update button state when VR session ends
  if (vrManager) {
    vrManager.onVRExit(() => {
      const vrButton = document.getElementById('vrToggleButton');
      if (vrButton) {
        vrButton.querySelector('.vr-button-text').textContent = 'Enter VR';
        vrButton.classList.remove('vr-active');
      }
    });
  
    // Wire up VR references (will be set after components are initialized)
    // Wait for playback controls and media manager to be ready
    try {
      await loadingManager.waitForAll(['playbackControls', 'mediaManager'], 10000);
      if (playbackControls && vrManager) {
        vrManager.setPlaybackControls(playbackControls);
      }
      if (mediaManager && vrManager) {
        const videoEl = mediaManager.getCurrentVideoElement();
        if (videoEl) {
          vrManager.setVideoElement(videoEl);
        }
      }
      // Settings panel is already set globally
      if (settingsPanelManager && vrManager) {
        vrManager.setSettingsPanel(settingsPanelManager);
      }
    } catch (error) {
      console.warn('VR references not ready:', error);
    }
    
    // Setup VR preset selector in camera tab
    setupVRPresetSelector();
  }
}

/**
 * Setup VR preset selector in camera tab
 */
function setupVRPresetSelector() {
  const vrPresetSelect = document.getElementById('vrPresetSelect');
  const cycleVRPresetBtn = document.getElementById('cycleVRPresetBtn');
  
  if (!vrPresetSelect || !cycleVRPresetBtn) {
    console.warn('VR preset selector elements not found');
    return;
  }
  
  // Populate dropdown with presets
  Object.entries(vrCameraPresets).forEach(([key, preset]) => {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = preset.label || key;
    if (key === DEFAULT_VR_CAMERA_PRESET) {
      option.selected = true;
    }
    vrPresetSelect.appendChild(option);
  });
  
  // Handle preset selection from dropdown
  vrPresetSelect.addEventListener('change', (e) => {
    const presetName = e.target.value;
    if (presetName && vrManager) {
      if (vrManager.getIsVRActive()) {
        // If in VR, teleport to preset
        vrManager.teleportToPreset(presetName);
      } else {
        // If not in VR, just set the preset (will be used when entering VR)
        vrManager.setVRCameraPreset(presetName);
      }
    }
  });
  
  // Handle cycle button
  let currentPresetIndex = 0;
  const presetKeys = Object.keys(vrCameraPresets);
  
  // Find current preset index
  const currentPreset = vrManager ? vrManager.vrCameraPreset : DEFAULT_VR_CAMERA_PRESET;
  currentPresetIndex = presetKeys.indexOf(currentPreset);
  if (currentPresetIndex === -1) currentPresetIndex = 0;
  
  cycleVRPresetBtn.addEventListener('click', () => {
    // Cycle to next preset
    currentPresetIndex = (currentPresetIndex + 1) % presetKeys.length;
    const nextPreset = presetKeys[currentPresetIndex];
    
    // Update dropdown
    vrPresetSelect.value = nextPreset;
    
    // Apply preset
    if (vrManager) {
      if (vrManager.getIsVRActive()) {
        // If in VR, teleport to preset
        vrManager.teleportToPreset(nextPreset);
      } else {
        // If not in VR, just set the preset
        vrManager.setVRCameraPreset(nextPreset);
      }
    }
  });
  
  // Update dropdown when VR preset changes (from VR input)
  if (vrManager && vrManager.presetNavigation) {
    // Listen for preset changes (if available)
    const originalTeleport = vrManager.presetNavigation.teleportToPreset;
    if (originalTeleport) {
      vrManager.presetNavigation.teleportToPreset = async function(presetName, smooth) {
        const result = await originalTeleport.call(this, presetName, smooth);
        // Update dropdown to reflect current preset
        if (vrPresetSelect) {
          vrPresetSelect.value = presetName;
          // Update current index
          currentPresetIndex = presetKeys.indexOf(presetName);
          if (currentPresetIndex === -1) currentPresetIndex = 0;
        }
        return result;
      };
    }
  }
}

/**
 * Create a test interactive object for VR input testing
 * Places it 2m in front of the default VR spawn position
 */
// Test VR object creation removed

// Ensure floating button creation when VR session starts (in case floor is ready first)
if (vrManager) {
  vrManager.onVREnter(() => {
    createVRFloatingButton();
  });
}

/**
 * Create a simple floating VR button that teleports to a random floor location
 */
function createVRFloatingButton() {
  // Only relevant in an active VR session.
  if (!vrManager || !vrManager.getIsVRActive()) {
    return;
  }

  // Guard: need floor mesh (input manager can be deferred)
  if (!vrFloorMesh) {
    // Retry shortly until ready
    setTimeout(createVRFloatingButton, 500);
    return;
  }

  // Avoid duplicate creation
  if (vrManager._nextCamButton) return;

  // Button geometry
  const geom = new THREE.BoxGeometry(0.25, 0.1, 0.02);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x0077ff,
    emissive: 0x001122,
    metalness: 0.1,
    roughness: 0.5
  });
  const button = new THREE.Mesh(geom, mat);
  button.name = 'VRNextCamButton';
  // Position the button 2 meters in front of player start (world origin)
  // Player starts at (0, 1.6, 0) at eye level, so button at (0, 1.6, -2) for 2m in front
  button.position.set(0, 1.6, -2); // Eye level (1.6m), 2 meters forward (-2m in Z)
  button.userData.originalColor = mat.color.clone();
  button.userData.originalEmissive = mat.emissive.clone();

  // Add label (simple canvas texture)
  const labelGeom = new THREE.PlaneGeometry(0.22, 0.06);
  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 256;
  labelCanvas.height = 64;
  const ctx = labelCanvas.getContext('2d');
  ctx.fillStyle = '#0b1a2b';
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = '#ffffff';
  ctx.font = '32px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Next Cam', 128, 32);
  const labelTex = new THREE.CanvasTexture(labelCanvas);
  labelTex.colorSpace = THREE.SRGBColorSpace;
  const labelMat = new THREE.MeshBasicMaterial({ map: labelTex, transparent: true });
  const label = new THREE.Mesh(labelGeom, labelMat);
  label.position.set(0, 0, 0.012); // slightly in front
  button.add(label);

  // Add button to scene in world space (not attached to player)
  // This keeps it at a fixed position 2m in front of player start
  vrManager.addToScene(button);

  // Register as interactive (only if VRManager provides an input manager hook)
  if (typeof vrManager.waitForInputManager !== 'function') {
    console.warn('VR Next Cam Button: VRManager.waitForInputManager() not available; skipping registration');
    vrManager._nextCamButton = button;
    return;
  }

  vrManager.waitForInputManager((inputManager) => {
    if (!inputManager) {
      console.error('VR Next Cam Button: Failed to get inputManager');
      return;
    }
    
    inputManager.registerInteractiveObject(button);

    // Hover feedback
    inputManager.onHoverStart((object) => {
      if (object === button) {
        mat.color.setHex(0x33aaff);
        mat.emissive.setHex(0x113355);
        button.scale.set(1.05, 1.05, 1.05);
      }
    });
    inputManager.onHoverEnd((object) => {
      if (object === button) {
        mat.color.copy(button.userData.originalColor);
        mat.emissive.copy(button.userData.originalEmissive);
        button.scale.set(1, 1, 1);
      }
    });

    // Select action: teleport to random floor location
    inputManager.onSelectStart((object) => {
      if (object === button) {
        teleportToRandomFloorLocation();
      }
    });
    
    console.log('VR Next Cam Button: Successfully registered with inputManager');
  }).catch((error) => {
    console.error('VR Next Cam Button: Error waiting for inputManager:', error);
  });

  // Store reference to avoid duplicates
  vrManager._nextCamButton = button;
}

/**
 * Teleport to a random point on the floor mesh
 */
function teleportToRandomFloorLocation() {
  if (!vrManager || !vrManager.vrSceneOffset || !vrFloorMesh) {
    console.warn('VR Next Cam: Missing VR manager, offset group, or floor mesh');
    return;
  }

  // Compute bounding box of floor mesh (world space)
  const bbox = new THREE.Box3().setFromObject(vrFloorMesh);
  if (!bbox.isEmpty()) {
    // Try a few times to find a valid point on the floor
    const raycaster = new THREE.Raycaster();
    const attempts = 8;
    for (let i = 0; i < attempts; i++) {
      const x = THREE.MathUtils.lerp(bbox.min.x, bbox.max.x, Math.random());
      const z = THREE.MathUtils.lerp(bbox.min.z, bbox.max.z, Math.random());
      // Cast down from above the bbox
      const origin = new THREE.Vector3(x, bbox.max.y + 5, z);
      const dir = new THREE.Vector3(0, -1, 0);
      raycaster.set(origin, dir);
      raycaster.far = bbox.max.y - bbox.min.y + 10;
      const hits = raycaster.intersectObject(vrFloorMesh, true);
      if (hits.length > 0) {
        const target = hits[0].point;
        // Move scene offset so user appears at target
        const offset = new THREE.Vector3(-target.x, -target.y, -target.z);
        vrManager.vrSceneOffset.position.copy(offset);
        console.log('VR Next Cam: Teleported to', target);
        return;
      }
    }
  }
  console.warn('VR Next Cam: Could not find a valid floor point');
}

// Set default video in dropdown
if (videoAssetSelect) {
  videoAssetSelect.value = DEFAULT_VIDEO_PATH;
}

// Animation loop
// Use setAnimationLoop for WebXR compatibility (works for both desktop and VR)
startAnimationLoop({
  renderer,
  scene,
  camera,
  onFrame: () => {
    // Update controls (only if not in VR mode)
    if (controls && (!vrManager || !vrManager.getIsVRActive())) {
      controls.update();
      
      // Limit camera position to never go below 1.2m above ground
      const minHeight = 1.2;
      if (camera.position.y < minHeight) {
        camera.position.y = minHeight;
        controls.update(); // Update controls again after position constraint
      }
    }

    // Update camera position in all shader materials
    updateCameraPositionInShaders(shaderMaterials, materialReferences, camera);

    // Update camera debug info (only if not in VR mode)
    if (cameraControls && (!vrManager || !vrManager.getIsVRActive())) {
      cameraControls.updateCameraDebug();
    }

    // Update VR systems (if VR is active)
    if (vrManager) {
      vrManager.update();
    }

    // Update frame info smoothly in animation loop (only when not seeking)
    // This provides smooth 60fps updates instead of the choppy 4fps from timeupdate events
    if (mediaManager && !isSeeking) {
      const videoElement = mediaManager.getCurrentVideoElement();
      if (videoElement && isFinite(videoElement.duration) && videoElement.duration > 0) {
        updateFrameInfo(videoElement);
      }
    }
  },
});

// ----------------------------
// Init step registration
// ----------------------------
registerInitSteps({
  initManager,
  steps: [
    {
      name: 'ui',
      initFn: async () => {
        if (loadingManager.isLoaded('ui')) return;
        const ok = initializeUI();
        if (!ok) {
          console.warn('[ui] Key UI elements not found; continuing without marking UI as loaded');
        }
      },
    },
    {
      name: 'mediaManager',
      initFn: async () => {
        await loadingManager.waitFor('ui', 5000);
        initializeMediaManager();
      },
      loadingStates: ['ui'],
    },
    {
      name: 'playbackControls',
      initFn: async () => {
        await loadingManager.waitFor('ui', 5000);
        await loadingManager.waitFor('mediaManager', 10000);

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

        // Wire up VR references if VR manager is initialized
        if (vrManager) {
          vrManager.setPlaybackControls(playbackControls);
          const videoEl = mediaManager ? mediaManager.getCurrentVideoElement() : null;
          if (videoEl) {
            vrManager.setVideoElement(videoEl);
          }
          if (settingsPanelManager) {
            vrManager.setSettingsPanel(settingsPanelManager);
          }
        }

        // Playback menu is now non-draggable and fixed at bottom
        // Add minimize toggle functionality
        const playbackMenuToggle = document.getElementById('playbackMenuToggle');
        const playbackMenu = playbackControls ? playbackControls.playbackMenu : document.getElementById('playbackMenu');
        if (playbackMenuToggle && playbackMenu) {
          handleToggleButton(playbackMenuToggle, playbackMenu);
        }

        // Make file info top draggable
        const fileInfoTop = getElement('fileInfoTop');
        if (fileInfoTop) {
          panelManager.registerPanel(fileInfoTop, 'fileInfo');
          fileInfoTop.style.cursor = 'grab';
        }

        loadingManager.setLoaded('playbackControls');
      },
      dependsOn: ['mediaManager'],
      loadingStates: ['ui', 'mediaManager'],
    },
    {
      name: 'cameraControls',
      initFn: async () => {
        await loadingManager.waitFor('ui', 5000);
        initializeCameraControls();
        loadingManager.setLoaded('cameraControls');
      },
      loadingStates: ['ui'],
    },
    {
      name: 'vrManager',
      initFn: async () => {
        await loadingManager.waitFor('ui', 5000);
        initializeVRManager();
        loadingManager.setLoaded('vrManager');
      },
      loadingStates: ['ui'],
    },
    {
      name: 'loadDefaultVideo',
      initFn: async () => {
        await loadingManager.waitForAll(['playbackControls', 'mediaManager'], 10000);
        console.log('Loading default video:', DEFAULT_VIDEO_PATH);
        loadVideoFromPath(DEFAULT_VIDEO_PATH);
      },
      dependsOn: ['playbackControls', 'mediaManager'],
      loadingStates: ['playbackControls', 'mediaManager'],
    },
    {
      name: 'shaderControls',
      initFn: async () => {
        await loadingManager.waitForAll(['stageMeshes', 'ledMeshes'], 10000);
        shaderControls.init();
        loadingManager.setLoaded('shaderControls');
      },
      loadingStates: ['stageMeshes', 'ledMeshes'],
    },
  ],
});

// Start initialization when DOM is ready
async function startInitialization() {
  // Mark DOM as loaded
  loadingManager.setLoaded('dom');
  
  // Start initialization process
  try {
    await initManager.initializeAll();
    console.log('Initialization complete!');
  } catch (error) {
    console.error('Initialization error:', error);
  }
}

// Start initialization
startInitialization();



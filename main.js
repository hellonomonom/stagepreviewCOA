import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a1a);

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

// Store reference to LED front mesh
let ledFrontMesh = null;

// Add groups to scene
scene.add(ledsGroup);
scene.add(stageGroup);

// GLTF Loader
const gltfLoader = new GLTFLoader();

// Double-sided shader material for stage meshes
const stageShaderMaterial = new THREE.ShaderMaterial({
  vertexShader: `
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec2 vUv;
    
    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      vPosition = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec2 vUv;
    
    void main() {
      // Simple lighting calculation
      vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
      float lightIntensity = max(dot(vNormal, lightDir), 0.3);
      
      // Base color (can be customized)
      vec3 baseColor = vec3(0.8, 0.8, 0.8);
      
      gl_FragColor = vec4(baseColor * lightIntensity, 1.0);
    }
  `,
  side: THREE.DoubleSide
});

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

// Mesh file paths organized by category
const meshFiles = {
  leds: [
    '/assets/meshes/ANYMA_Coachella_Stage_v007_LED_FRONT.glb',
    '/assets/meshes/ANYMA_Coachella_Stage_v007_LED_SL_GARAGE.glb',
    '/assets/meshes/ANYMA_Coachella_Stage_v008_LED_SL_WING.glb',
    '/assets/meshes/ANYMA_Coachella_Stage_v008_LED_SR_GARAGE.glb',
    '/assets/meshes/ANYMA_Coachella_Stage_v008_LED_SR_WING.glb',
    '/assets/meshes/ANYMA_Coachella_Stage_v008_LED_US_WALL.glb'
  ],
  stage: [
    '/assets/meshes/ANYMA_Coachella_Stage_v008_CATWALK.glb',
    '/assets/meshes/ANYMA_Coachella_Stage_v008_PILLARS.glb',
    '/assets/meshes/ANYMA_Coachella_Stage_v008_STAGE_CROWD.glb',
    '/assets/meshes/ANYMA_Coachella_Stage_v008_STAGE_DJ_LIFTABLE.glb',
    '/assets/meshes/ANYMA_Coachella_Stage_v008_STAGE_GROUND.glb',
    '/assets/meshes/ANYMA_Coachella_Stage_v008_STAGE_LIFTABLE.glb'
  ]
};

// Function to load a single mesh
function loadMesh(path, targetGroup, isStage = false) {
  gltfLoader.load(
    path,
    (gltf) => {
      const model = gltf.scene;
      targetGroup.add(model);
      
      // Store reference to LED front mesh
      if (path.includes('LED_FRONT')) {
        ledFrontMesh = model;
      }
      
      // Apply shader to stage meshes
      if (isStage) {
        model.traverse((child) => {
          if (child.isMesh) {
            // Store original material if needed
            if (!child.userData.originalMaterial) {
              child.userData.originalMaterial = child.material;
            }
            child.material = stageShaderMaterial.clone();
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

// Load all LED meshes
meshFiles.leds.forEach(path => {
  loadMesh(path, ledsGroup, false);
});

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
const controlPanel = document.getElementById('controlPanel');
const textureInput = document.getElementById('textureInput');
const textureStatus = document.getElementById('textureStatus');

// Make control panel draggable
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let panelStartX = 0;
let panelStartY = 0;

if (controlPanel) {
  controlPanel.addEventListener('mousedown', (e) => {
    // Only start dragging if clicking on the panel background or labels (not interactive elements)
    const target = e.target;
    const isInteractive = target.tagName === 'INPUT' || 
                         target.tagName === 'SELECT' || 
                         target.tagName === 'BUTTON' ||
                         target.tagName === 'LABEL' && target.getAttribute('for');
    
    if (!isInteractive && (target === controlPanel || target.closest('.control-group label'))) {
      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      
      const rect = controlPanel.getBoundingClientRect();
      panelStartX = rect.left;
      panelStartY = rect.top;
      
      controlPanel.style.cursor = 'grabbing';
      e.preventDefault();
    }
  });

  document.addEventListener('mousemove', (e) => {
    if (isDragging) {
      const deltaX = e.clientX - dragStartX;
      const deltaY = e.clientY - dragStartY;
      
      let newX = panelStartX + deltaX;
      let newY = panelStartY + deltaY;
      
      // Keep panel within viewport bounds
      const panelRect = controlPanel.getBoundingClientRect();
      const maxX = window.innerWidth - panelRect.width;
      const maxY = window.innerHeight - panelRect.height;
      
      newX = Math.max(0, Math.min(newX, maxX));
      newY = Math.max(0, Math.min(newY, maxY));
      
      controlPanel.style.left = `${newX}px`;
      controlPanel.style.top = `${newY}px`;
      controlPanel.style.right = 'auto';
    }
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      controlPanel.style.cursor = 'grab';
    }
  });
}

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

// Function to update frame info display
function updateFrameInfo(video) {
  if (!video || !isFinite(video.duration) || video.duration === 0) {
    frameInfo.textContent = 'Frame: 0 / 0';
    return;
  }
  
  const currentTime = video.currentTime || 0;
  const duration = video.duration;
  const currentFrame = Math.floor(currentTime * videoFrameRate);
  const totalFrames = Math.floor(duration * videoFrameRate);
  
  frameInfo.textContent = `Frame: ${currentFrame} / ${totalFrames}`;
  
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
  const value = parseFloat(e.target.value);
  djDeckHeightValue.textContent = Math.round(value);
  
  // TODO: Connect to DJ deck object when available
  // Example: if (djDeckObject) { djDeckObject.position.y = value; }
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

// Playback controls
const playPauseBtn = document.getElementById('playPauseBtn');
const rewindBtn = document.getElementById('rewindBtn');
const jumpToEndBtn = document.getElementById('jumpToEndBtn');
const muteBtn = document.getElementById('muteBtn');
const volumeSlider = document.getElementById('volumeSlider');
const volumeValue = document.getElementById('volumeValue');
const playbackMenu = document.getElementById('playbackMenu');

// Function to update play/pause button icon
function updatePlayPauseButton() {
  if (!currentVideoElement) {
    playPauseBtn.textContent = '▶';
    return;
  }
  
  const isPaused = currentVideoElement.paused;
  playPauseBtn.textContent = isPaused ? '▶' : '⏸';
}

playPauseBtn.addEventListener('click', () => {
  if (currentVideoElement) {
    if (currentVideoElement.paused) {
      currentVideoElement.play().catch(err => {
        console.error('Error playing video:', err);
      });
      overlayVideo.play().catch(err => {
        console.error('Error playing overlay video:', err);
      });
    } else {
      currentVideoElement.pause();
      overlayVideo.pause();
    }
    updatePlayPauseButton();
  }
});

rewindBtn.addEventListener('click', () => {
  if (currentVideoElement && videoFrameRate > 0) {
    // Jump backward by 100 frames
    const frameOffset = -100;
    const timeOffset = frameOffset / videoFrameRate;
    const newTime = Math.max(0, currentVideoElement.currentTime + timeOffset);
    currentVideoElement.currentTime = newTime;
    overlayVideo.currentTime = newTime;
    updateFrameInfo(currentVideoElement);
  }
});

jumpToEndBtn.addEventListener('click', () => {
  if (currentVideoElement && isFinite(currentVideoElement.duration) && videoFrameRate > 0) {
    // Jump forward by 100 frames
    const frameOffset = 100;
    const timeOffset = frameOffset / videoFrameRate;
    const maxTime = currentVideoElement.duration;
    const newTime = Math.min(maxTime, currentVideoElement.currentTime + timeOffset);
    currentVideoElement.currentTime = newTime;
    overlayVideo.currentTime = newTime;
    updateFrameInfo(currentVideoElement);
  }
});

// Mute button functionality
muteBtn.addEventListener('click', () => {
  if (currentVideoElement) {
    currentVideoElement.muted = !currentVideoElement.muted;
    updateMuteButton();
  }
});

// Function to update mute button icon
function updateMuteButton() {
  if (!currentVideoElement) {
    muteBtn.textContent = '🔊';
    return;
  }
  muteBtn.textContent = currentVideoElement.muted ? '🔇' : '🔊';
}

// Volume slider functionality
volumeSlider.addEventListener('input', (e) => {
  const volume = parseFloat(e.target.value) / 100; // Convert 0-100 to 0-1
  if (currentVideoElement) {
    currentVideoElement.volume = volume;
    // If volume is set above 0, unmute the video
    if (volume > 0 && currentVideoElement.muted) {
      currentVideoElement.muted = false;
      updateMuteButton();
    }
    // If volume is set to 0, mute the video
    if (volume === 0 && !currentVideoElement.muted) {
      currentVideoElement.muted = true;
      updateMuteButton();
    }
  }
  volumeValue.textContent = Math.round(e.target.value);
});

// Update button states based on video availability
function updatePlaybackButtons() {
  const hasVideo = currentVideoElement !== null;
  playPauseBtn.disabled = !hasVideo;
  rewindBtn.disabled = !hasVideo;
  jumpToEndBtn.disabled = !hasVideo;
  muteBtn.disabled = !hasVideo;
  volumeSlider.disabled = !hasVideo;
  updatePlayPauseButton();
  updateMuteButton();
  
  // Sync volume slider with video volume when video is loaded
  if (hasVideo && currentVideoElement) {
    const volumePercent = Math.round(currentVideoElement.volume * 100);
    volumeSlider.value = volumePercent;
    volumeValue.textContent = volumePercent;
  }
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
  textureStatus.textContent = `Connecting to NDI stream: ${streamName}...`;
  textureStatus.classList.remove('loaded');
  
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
    textureStatus.textContent = `Connected to ${streamName}, receiving frames...`;
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
          if (!textureStatus.classList.contains('loaded')) {
            textureStatus.textContent = `Loaded NDI Stream: ${streamName}`;
            textureStatus.classList.add('loaded');
            updatePlaybackButtons();
          }
        };
        img.onerror = (err) => {
          console.error('Error loading frame image:', err);
        };
        img.src = 'data:image/jpeg;base64,' + data.data;
        
      } else if (data.type === 'error') {
        console.error('WebSocket error:', data.message);
        textureStatus.textContent = `Error: ${data.message}`;
        textureStatus.classList.remove('loaded');
        
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
    textureStatus.textContent = 'Error: WebSocket connection failed';
    textureStatus.classList.remove('loaded');
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
    textureStatus.textContent = `Loaded Video: ${fileName}`;
    textureStatus.classList.add('loaded');
    
    // Update video asset dropdown to show current selection
    if (videoAssetSelect && videoPath.startsWith('/assets/videos/')) {
      videoAssetSelect.value = videoPath;
    }
    
    // Enable playback buttons
    updatePlaybackButtons();
  });
  
  video.addEventListener('error', (error) => {
    textureStatus.textContent = 'Error loading video (check file path)';
    textureStatus.classList.remove('loaded');
    console.error('Error loading video:', error);
  });
  
  // Start loading the video
  video.load();
}

textureInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
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
        textureStatus.textContent = `Loaded Video: ${file.name}`;
        textureStatus.classList.add('loaded');
      });
      
      video.addEventListener('error', (error) => {
        textureStatus.textContent = 'Error loading video';
        textureStatus.classList.remove('loaded');
        console.error('Error loading video:', error);
      });
      
      // Start loading the video
      video.load();
    };

    reader.onerror = () => {
      textureStatus.textContent = 'Error reading file';
      textureStatus.classList.remove('loaded');
    };

    reader.readAsDataURL(file);
    return;
  }

  // Handle image files
  if (!file.type.startsWith('image/')) {
    textureStatus.textContent = 'Error: Please select an image or video file';
    textureStatus.classList.remove('loaded');
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
        
        textureStatus.textContent = `Loaded: ${file.name}`;
        textureStatus.classList.add('loaded');
      },
      // onProgress callback (optional)
      undefined,
      // onError callback
      (error) => {
        textureStatus.textContent = 'Error loading texture';
        textureStatus.classList.remove('loaded');
        console.error('Error loading texture:', error);
      }
    );
  };

  reader.onerror = () => {
    textureStatus.textContent = 'Error reading file';
    textureStatus.classList.remove('loaded');
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


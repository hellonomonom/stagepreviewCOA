import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

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

// Add a plane with 16:9 aspect ratio
const planeWidth = 8;
const planeHeight = 4.5; // 16:9 aspect ratio (8:4.5)
const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);

// Create material with custom shader for black backside
const material = new THREE.ShaderMaterial({
  uniforms: {
    uTexture: { value: null },
    uHasTexture: { value: 0.0 }
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
          gl_FragColor = vec4(texColor.rgb, 1.0);
        } else {
          gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
        }
      }
    }
  `,
  side: THREE.DoubleSide
});

const displayPlane = new THREE.Mesh(geometry, material);
scene.add(displayPlane);

// Add lights - brighter and more neutral for accurate color display
const ambientLight = new THREE.AmbientLight(0xffffff, 1.0); // Increased intensity
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2); // Increased intensity
directionalLight.position.set(0, 0, 5); // Front lighting for better visibility
directionalLight.castShadow = true;
scene.add(directionalLight);

// Texture loading
const textureInput = document.getElementById('textureInput');
const textureStatus = document.getElementById('textureStatus');

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

const videoOverlay = document.getElementById('videoOverlay');
const overlayVideo = document.getElementById('overlayVideo');
const frameInfo = document.getElementById('frameInfo');
const timelineContainer = document.getElementById('timelineContainer');
const timelineSlider = document.getElementById('timelineSlider');
let currentVideoElement = null;
let videoFrameRate = 30; // Default frame rate, will be updated if available
let isSeeking = false;

// Video overlay size control
const overlaySizeSlider = document.getElementById('overlaySizeSlider');
const overlaySizeValue = document.getElementById('overlaySizeValue');

overlaySizeSlider.addEventListener('input', (e) => {
  const value = parseFloat(e.target.value);
  const scale = value;
  videoOverlay.style.transform = `translateX(-50%) scale(${scale})`;
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

// Checkbox to toggle video overlay visibility
const showVideoOverlayCheckbox = document.getElementById('showVideoOverlay');

showVideoOverlayCheckbox.addEventListener('change', (e) => {
  if (e.target.checked) {
    // Only show if there's a video loaded
    if (currentVideoElement) {
      videoOverlay.classList.add('active');
    }
  } else {
    videoOverlay.classList.remove('active');
  }
});

// Playback controls
const playPauseBtn = document.getElementById('playPauseBtn');
const jumpToStartBtn = document.getElementById('jumpToStartBtn');

// Function to update play/pause button text
function updatePlayPauseButton() {
  if (!currentVideoElement) {
    playPauseBtn.textContent = 'Play';
    return;
  }
  
  const isPaused = currentVideoElement.paused;
  playPauseBtn.textContent = isPaused ? 'Play' : 'Pause';
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

jumpToStartBtn.addEventListener('click', () => {
  if (currentVideoElement) {
    currentVideoElement.currentTime = 0;
    overlayVideo.currentTime = 0;
    updateFrameInfo(currentVideoElement);
    updatePlayPauseButton();
  }
});

// Update button states based on video availability
function updatePlaybackButtons() {
  const hasVideo = currentVideoElement !== null;
  playPauseBtn.disabled = !hasVideo;
  jumpToStartBtn.disabled = !hasVideo;
  updatePlayPauseButton();
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
  material.needsUpdate = true;
  
  // Hide overlay and frame info until new stream is loaded
  videoOverlay.classList.remove('active');
  frameInfo.classList.remove('active');
  timelineContainer.classList.remove('active');
  overlayVideo.src = '';
  
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
const DEFAULT_VIDEO_PATH = 'C:\\Users\\tobia\\Downloads\\HealthCareShowCase.mp4';

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
  videoOverlay.classList.remove('active');
  frameInfo.classList.remove('active');
  timelineContainer.classList.remove('active');
  overlayVideo.src = '';

  // For default video, use Vite-served URL
  // For other paths (from file input), use the provided file data
  let videoUrl;
  if (videoPath === DEFAULT_VIDEO_PATH) {
    // Use Vite server endpoint
    videoUrl = '/default-video.mp4';
  } else {
    // Try file:// URL as fallback (may not work due to browser security)
    videoUrl = 'file:///' + videoPath.replace(/\\/g, '/');
  }
  
  // Create video element
  const video = document.createElement('video');
  video.src = videoUrl;
  video.crossOrigin = 'anonymous';
  video.loop = true;
  video.muted = true; // Required for autoplay in most browsers
  video.playsInline = true;
  
  video.addEventListener('loadeddata', () => {
    // Create video texture
    const videoTexture = new THREE.VideoTexture(video);
    videoTexture.wrapS = THREE.RepeatWrapping;
    videoTexture.wrapT = THREE.RepeatWrapping;
    videoTexture.minFilter = THREE.LinearFilter;
    videoTexture.magFilter = THREE.LinearFilter;
    videoTexture.colorSpace = THREE.SRGBColorSpace; // Use sRGB for accurate colors
    
    // Apply texture to shader material
    material.uniforms.uTexture.value = videoTexture;
    material.uniforms.uHasTexture.value = 1.0;
    
    // Set up overlay video to show current frame
    overlayVideo.src = videoUrl;
    overlayVideo.crossOrigin = 'anonymous';
    overlayVideo.loop = true;
    overlayVideo.muted = true;
    overlayVideo.playsInline = true;
    
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
    if (showVideoOverlayCheckbox.checked) {
      videoOverlay.classList.add('active');
    }
    
    // Show frame info and timeline, update them
    frameInfo.classList.add('active');
    timelineContainer.classList.add('active');
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
      }).catch(err => {
        console.error('Error playing video:', err);
        textureStatus.textContent = 'Error: Could not play video';
        textureStatus.classList.remove('loaded');
        updatePlayPauseButton();
      });
    }
    
    currentVideoElement = video;
    const fileName = videoPath.split('\\').pop() || videoPath.split('/').pop();
    textureStatus.textContent = `Loaded Video: ${fileName}`;
    textureStatus.classList.add('loaded');
    
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

  // Clean up previous video element if it exists
  if (currentVideoElement) {
    currentVideoElement.pause();
    currentVideoElement.src = '';
    currentVideoElement.load();
    currentVideoElement = null;
    updatePlaybackButtons();
  }
  
  // Hide overlay and frame info until new video is loaded
  videoOverlay.classList.remove('active');
  frameInfo.classList.remove('active');
  timelineContainer.classList.remove('active');
  overlayVideo.src = '';

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
      video.muted = true; // Required for autoplay in most browsers
      video.playsInline = true;
      
      video.addEventListener('loadeddata', () => {
        // Create video texture
        const videoTexture = new THREE.VideoTexture(video);
        videoTexture.wrapS = THREE.RepeatWrapping;
        videoTexture.wrapT = THREE.RepeatWrapping;
        videoTexture.minFilter = THREE.LinearFilter;
        videoTexture.magFilter = THREE.LinearFilter;
        videoTexture.colorSpace = THREE.SRGBColorSpace; // Use sRGB for accurate colors
        
        // Apply texture to shader material
        material.uniforms.uTexture.value = videoTexture;
        material.uniforms.uHasTexture.value = 1.0;
        
        // Set up overlay video to show current frame
        overlayVideo.src = videoUrl;
        overlayVideo.crossOrigin = 'anonymous';
        overlayVideo.loop = true;
        overlayVideo.muted = true;
        overlayVideo.playsInline = true;
        
        // Sync overlay video with main video
        const syncOverlay = () => {
          if (video.readyState >= 2) {
            overlayVideo.currentTime = video.currentTime;
          }
        };
        
        // Sync on timeupdate
        video.addEventListener('timeupdate', syncOverlay);
        
        // Show overlay
        videoOverlay.classList.add('active');
        
        // Play both videos
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            overlayVideo.play().catch(err => {
              console.error('Error playing overlay video:', err);
            });
          }).catch(err => {
            console.error('Error playing video:', err);
            textureStatus.textContent = 'Error: Could not play video';
            textureStatus.classList.remove('loaded');
          });
        }
        
        currentVideoElement = video;
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
        texture.colorSpace = THREE.SRGBColorSpace; // Use sRGB for accurate colors
        
        // Apply texture to shader material
        material.uniforms.uTexture.value = texture;
        material.uniforms.uHasTexture.value = 1.0;
        
        // Hide overlay and frame info for images (only show for videos)
        videoOverlay.classList.remove('active');
        frameInfo.classList.remove('active');
        timelineContainer.classList.remove('active');
        
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

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  
  // Update controls
  controls.update();
  
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


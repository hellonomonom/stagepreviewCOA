# VR Technical Specification

## Technology Overview

### WebXR API Support
- **Quest 3**: Full WebXR support via Quest Browser (Chromium-based)
  - Session type: `immersive-vr`
  - Input: Controllers + Hand tracking
  - Target framerate: 72fps
  - Reference space: `local` or `local-floor`
  
- **Apple Vision Pro**: Full WebXR support via Safari (visionOS 1.0+)
  - Session type: `immersive-vr`
  - Input: Hand tracking with gaze-and-pinch (`transient-pointer`)
  - Target framerate: 90fps
  - Reference space: `local` or `local-floor`

### Three.js WebXR Integration
- Three.js v0.181.1 includes `WebXRManager`
- No additional dependencies required
- Built-in controller support via `XRControllerModelFactory`

## Code Architecture

### 1. VRManager Class Structure

```javascript
// src/vr/VRManager.js
export class VRManager {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.xrSession = null;
    this.isVRActive = false;
    this.originalAnimationLoop = null;
    this.controllers = [];
  }

  async checkVRAvailability() {
    // Check if WebXR is available
  }

  async enterVR() {
    // Request immersive VR session
  }

  exitVR() {
    // End VR session and restore desktop mode
  }

  onSessionStart(session) {
    // Setup VR session
  }

  onSessionEnd() {
    // Cleanup VR session
  }
}
```

### 2. Integration Points in main.js

**Renderer Setup:**
```javascript
// Enable WebXR
renderer.xr.enabled = true;

// Optional: Set reference space type
renderer.xr.setReferenceSpaceType('local-floor');

// Optional: Set framerate limits
renderer.setAnimationLoop = null; // Will be set by VRManager
```

**Animation Loop Changes:**
```javascript
// Current desktop loop
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

// VR mode - handled automatically by WebXRManager
// No need for requestAnimationFrame in VR
```

### 3. Controls Integration

**Desktop Mode:**
- OrbitControls enabled
- Mouse/touch input for camera control

**VR Mode:**
- OrbitControls disabled (head tracking replaces it)
- Controllers optional for movement/interaction

### 4. UI Adaptations

**Strategy 1: Simple Toggle (MVP)**
- Hide all 2D UI panels in VR
- Minimal overlay for exit button
- User relies on head movement only

**Strategy 2: 3D UI Panels (Future)**
- Convert panels to 3D objects in scene
- Position in front of user
- Ray-casting for interaction

## Implementation Details

### Session Initialization

```javascript
async enterVR() {
  if (!navigator.xr) {
    console.error('WebXR not supported');
    return;
  }

  try {
    // Request immersive VR session
    this.xrSession = await navigator.xr.requestSession('immersive-vr', {
      requiredFeatures: ['local-floor'],
      optionalFeatures: ['hand-tracking', 'bounded-floor']
    });

    // Bind renderer to XR session
    await this.renderer.xr.setSession(this.xrSession);
    
    this.isVRActive = true;
    this.onSessionStart(this.xrSession);
  } catch (error) {
    console.error('Failed to enter VR:', error);
  }
}
```

### Controller Support

```javascript
setupControllers() {
  // Get controllers from WebXR
  const controller1 = this.renderer.xr.getController(0);
  const controller2 = this.renderer.xr.getController(1);

  // Add controller models to scene
  this.scene.add(controller1);
  this.scene.add(controller2);

  // Handle controller events
  controller1.addEventListener('selectstart', this.onControllerSelect);
  controller1.addEventListener('selectend', this.onControllerSelectEnd);
}
```

### Camera Management

**In VR:**
- Camera position is controlled by head tracking
- No manual camera controls needed
- Can reset/recenter camera position
- Can adjust scale for comfortable viewing

**Camera Presets:**
```javascript
const vrCameraPresets = {
  stageFront: {
    position: new THREE.Vector3(0, 1.6, 5), // 1.6m = average eye height
    rotation: new THREE.Euler(0, 0, 0)
  },
  crowdView: {
    position: new THREE.Vector3(0, 1.6, 10),
    rotation: new THREE.Euler(0, 0, 0)
  },
  // ... more presets
};
```

### Performance Considerations

**Framerate Targets:**
- Quest 3: 72fps (13.9ms per frame)
- Vision Pro: 90fps (11.1ms per frame)

**Optimization Strategies:**
1. Reduce render quality automatically in VR
2. Lower LOD for distant objects
3. Reduce shadow quality
4. Simplify shaders if needed
5. Reduce crowd instances if performance drops

**Quality Settings:**
```javascript
const vrQualitySettings = {
  low: {
    shadowMapSize: 512,
    maxCrowdInstances: 2000,
    antialias: false
  },
  medium: {
    shadowMapSize: 1024,
    maxCrowdInstances: 4000,
    antialias: true
  },
  high: {
    shadowMapSize: 2048,
    maxCrowdInstances: 5000,
    antialias: true
  }
};
```

## Device-Specific Considerations

### Quest 3
- **Browser**: Quest Browser (default) or Firefox Reality
- **Input**: Touch controllers (primary), Hand tracking (optional)
- **Features**: Room-scale tracking, guardian boundaries
- **Performance**: Solid 72fps target, can handle complex scenes

### Apple Vision Pro
- **Browser**: Safari only (WebXR enabled by default in visionOS 2+)
- **Input**: Hand tracking with gaze-and-pinch (transient-pointer mode)
- **Features**: High-resolution passthrough, spatial audio
- **Performance**: 90fps target, high-quality rendering

**Vision Pro Specific Code:**
```javascript
// Request transient-pointer for Vision Pro hand tracking
this.xrSession = await navigator.xr.requestSession('immersive-vr', {
  requiredFeatures: ['local-floor'],
  optionalFeatures: ['hand-tracking', 'transient-pointer']
});
```

## File Modifications Required

### 1. main.js
- Add VR button UI element
- Import VRManager
- Initialize VRManager with renderer, scene, camera
- Handle VR mode switching
- Disable OrbitControls in VR mode

### 2. index.html
- Add VR toggle button
- Add VR status indicator (optional)
- Update viewport meta tag if needed

### 3. New Files
- `src/vr/VRManager.js` - Core VR session management
- `src/vr/VRControls.js` - VR-specific controls (optional)
- `src/vr/VRUI.js` - 3D UI system (optional, future)
- `src/config/vrCameraPresets.js` - VR camera positions

### 4. Styles (styles.css)
- Add VR button styling
- Add VR mode indicator
- Hide/show UI elements based on VR state

## Testing Checklist

### Desktop Testing
- [ ] WebXR Emulator extension (Chrome/Edge)
- [ ] Verify VR button appears
- [ ] Test enter/exit VR flow
- [ ] Check error handling

### Quest 3 Testing
- [ ] Load app in Quest Browser
- [ ] Enter VR mode
- [ ] Verify head tracking
- [ ] Test controller interaction (if implemented)
- [ ] Check performance/framerate
- [ ] Test exit VR

### Vision Pro Testing
- [ ] Load app in Safari
- [ ] Enter VR mode
- [ ] Verify head tracking
- [ ] Test hand tracking (gaze-and-pinch)
- [ ] Check performance/framerate
- [ ] Test exit VR

## Security & HTTPS

**Critical**: WebXR requires HTTPS (except localhost)

```javascript
// Check if secure context
if (!window.isSecureContext) {
  console.error('WebXR requires HTTPS (except localhost)');
  // Show error message to user
}
```

## Error Handling

```javascript
async enterVR() {
  try {
    // Check WebXR support
    if (!navigator.xr) {
      throw new Error('WebXR not supported in this browser');
    }

    // Request session
    const session = await navigator.xr.requestSession('immersive-vr');
    // ...
  } catch (error) {
    if (error.name === 'NotSupportedError') {
      console.error('VR not available on this device');
    } else if (error.name === 'SecurityError') {
      console.error('WebXR requires HTTPS');
    } else {
      console.error('VR error:', error);
    }
    
    // Show user-friendly error message
    this.showVRError(error);
  }
}
```

## Migration Path

### Phase 1: MVP (Minimal Viable Product)
1. Basic VR enter/exit
2. Head tracking only
3. Simple UI toggle
4. Scene renders in VR

### Phase 2: Enhanced
1. VR camera presets
2. Scale adjustments
3. Basic controller support
4. Performance optimizations

### Phase 3: Advanced
1. Full 3D UI system
2. Teleportation
3. Advanced interactions
4. Custom VR features

## Performance Monitoring

```javascript
// Add FPS counter for VR
let frameCount = 0;
let lastTime = performance.now();

function checkVRPerformance() {
  frameCount++;
  const now = performance.now();
  if (now >= lastTime + 1000) {
    const fps = frameCount;
    frameCount = 0;
    lastTime = now;
    
    if (fps < 60) {
      console.warn('VR performance below target:', fps);
      // Reduce quality settings
    }
  }
}
```

## Browser Compatibility Matrix

| Platform | Browser | WebXR Support | Status |
|----------|---------|---------------|--------|
| Quest 3 | Quest Browser | ✅ Full | Ready |
| Quest 3 | Firefox Reality | ✅ Full | Ready |
| Vision Pro | Safari | ✅ Full (visionOS 2+) | Ready |
| Desktop | Chrome | ✅ (with emulator) | Dev only |
| Desktop | Edge | ✅ (with emulator) | Dev only |
| Desktop | Firefox | ⚠️ Limited | Not recommended |













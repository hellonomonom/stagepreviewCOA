# VR Implementation - Quick Reference

## Overview
Add WebXR support to enable VR viewing on Quest 3 and Apple Vision Pro browsers.

## Key Documents
- **VR_IMPLEMENTATION_PLAN.md** - Detailed implementation plan with phases
- **VR_TECHNICAL_SPEC.md** - Technical specifications and code examples

## Quick Start (MVP Implementation)

### 1. Enable WebXR in Renderer
```javascript
// In main.js, after renderer creation
renderer.xr.enabled = true;
```

### 2. Create VRManager
- New file: `src/vr/VRManager.js`
- Handles: Enter/exit VR, session management
- Methods: `checkVRAvailability()`, `enterVR()`, `exitVR()`

### 3. Add VR Button to UI
- Location: Settings panel or floating button
- Action: Calls `VRManager.enterVR()`
- Shows when VR is available

### 4. Handle Mode Switching
- Disable OrbitControls when in VR
- Switch animation loop
- Show/hide 2D UI panels

## Implementation Order

### Phase 1: Core (Week 1)
1. ✅ Create `VRManager.js`
2. ✅ Add VR button to UI
3. ✅ Enable WebXR on renderer
4. ✅ Test enter/exit VR

### Phase 2: Enhanced (Week 2)
5. ✅ Add VR camera presets
6. ✅ Scale adjustments
7. ✅ Basic controller support

### Phase 3: Polish (Week 3)
8. ✅ Performance optimization
9. ✅ Error handling
10. ✅ Documentation

## Key Files to Create

```
src/
  vr/
    VRManager.js          # Core VR session management
    VRControls.js         # VR controls (optional)
    VRUI.js              # 3D UI (optional, future)
  config/
    vrCameraPresets.js   # VR camera positions
```

## Key Files to Modify

```
main.js                  # Add VRManager, VR button handler
index.html              # Add VR button element
styles.css              # VR button styling
```

## Device Requirements

### Quest 3
- Browser: Quest Browser (default)
- URL: Navigate to app URL
- Action: Tap "Enter VR" button

### Apple Vision Pro
- Browser: Safari
- URL: Navigate to app URL
- Action: Tap "Enter VR" button
- Note: Requires visionOS 2+ for WebXR (enabled by default)

## Testing

### Desktop
- Use WebXR Emulator Chrome extension
- Test basic functionality without device

### Devices
- Quest 3: Test via Quest Browser
- Vision Pro: Test via Safari
- Verify: Enter/exit, head tracking, performance

## Critical Requirements

1. **HTTPS Required** (except localhost)
   - WebXR only works over HTTPS
   - Production must use SSL

2. **Browser Compatibility**
   - Quest 3: Quest Browser ✅
   - Vision Pro: Safari ✅ (visionOS 2+)

3. **Performance**
   - Target: 72fps (Quest 3) / 90fps (Vision Pro)
   - May need quality reduction in VR

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| WebXR not available | Check HTTPS, browser support |
| Low framerate | Reduce quality, simplify scene |
| UI not visible | Hide 2D UI in VR mode |
| Controllers not working | Verify controller initialization |

## Code Snippets

### Basic VR Entry
```javascript
import { VRManager } from './src/vr/VRManager.js';

const vrManager = new VRManager(renderer, scene, camera);

// VR button click handler
vrButton.addEventListener('click', async () => {
  if (!vrManager.isVRActive) {
    await vrManager.enterVR();
  } else {
    vrManager.exitVR();
  }
});
```

### Check VR Availability
```javascript
async function checkVR() {
  if (navigator.xr) {
    const supported = await navigator.xr.isSessionSupported('immersive-vr');
    if (supported) {
      // Show VR button
      vrButton.style.display = 'block';
    }
  }
}
```

## Next Steps

1. Read **VR_IMPLEMENTATION_PLAN.md** for detailed steps
2. Read **VR_TECHNICAL_SPEC.md** for code examples
3. Start with Phase 1 implementation
4. Test on device early and often

## Questions?

- Check device documentation
- Test with WebXR Emulator first
- Verify HTTPS in production
- Monitor performance metrics



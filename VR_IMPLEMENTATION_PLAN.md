# VR Implementation Plan for Stage Preview COA

## Overview
Add WebXR support to enable VR viewing on Quest 3 (via browser) and Apple Vision Pro (via Safari). This will allow users to experience the 3D stage preview in immersive VR.

## Technology Stack

### WebXR API
- **Standard**: Use WebXR Device API (browser-native, no additional libraries needed)
- **Three.js Integration**: Use Three.js WebXRManager (built into Three.js)
- **Compatibility**:
  - Quest 3: Supports WebXR via Quest Browser (based on Chromium)
  - Apple Vision Pro: Supports WebXR via Safari (visionOS 1.0+)

## Architecture Overview

### 1. Core VR Integration (`src/vr/VRManager.js`)
- **Purpose**: Central manager for VR session lifecycle
- **Responsibilities**:
  - Detect VR capability
  - Initialize/exit VR sessions
  - Handle mode switching (desktop ↔ VR)
  - Manage VR render loop
  - Coordinate with existing Three.js scene

### 2. VR Controls (`src/vr/VRControls.js`)
- **Purpose**: Replace OrbitControls in VR mode
- **Responsibilities**:
  - Head tracking (automatic via WebXR)
  - Controller input (if available)
  - Teleportation/movement
  - UI interaction in VR space

### 3. VR UI (`src/vr/VRUI.js`)
- **Purpose**: 3D UI elements in VR space
- **Responsibilities**:
  - Convert 2D UI panels to 3D floating panels
  - Ray-casting interaction
  - Spatial UI positioning
  - Maintain existing controls functionality

### 4. VR Camera Presets (`src/config/vrCameraPresets.js`)
- **Purpose**: Optimized camera positions for VR
- **Responsibilities**:
  - Define default VR viewing positions
  - Handle scale/orientation adjustments
  - Provide quick navigation options

## Implementation Steps

### Phase 1: Core VR Infrastructure

#### 1.1 Update Dependencies
- No new dependencies needed (WebXR is built into browsers, Three.js has WebXRManager)
- Verify Three.js version supports WebXRManager (v0.181.1 should have it)

#### 1.2 Create VRManager (`src/vr/VRManager.js`)
```javascript
Key features:
- Check WebXR availability (navigator.xr)
- Request VR session (immersive-vr mode)
- Initialize WebXRManager in Three.js renderer
- Handle session start/end events
- Manage render loop switching
```

#### 1.3 Modify Renderer Setup (`main.js`)
```javascript
Changes needed:
- Enable xr property on renderer: renderer.xr.enabled = true
- Add VR button to UI for entering VR
- Switch animation loop for VR (renderer.setAnimationLoop)
- Handle window resize differently in VR mode
```

### Phase 2: VR Controls & Navigation

#### 2.1 Create VRControls (`src/vr/VRControls.js`)
```javascript
Features:
- Disable OrbitControls when in VR (automatic via head tracking)
- Add teleportation controller (optional, for movement)
- Handle controller ray-casting for interaction
- Scale adjustments for comfortable viewing
```

#### 2.2 VR Camera Presets (`src/config/vrCameraPresets.js`)
```javascript
Presets:
- "Stage Front" - Close to stage
- "Crowd View" - From audience perspective  
- "Above Stage" - Aerial view
- "DJ Position" - On-stage view
```

#### 2.3 Add VR Navigation UI
- 3D floating buttons in VR space
- Quick teleport to preset positions
- Scale adjustment slider in VR

### Phase 3: VR UI System

#### 3.1 Create VRUI Manager (`src/vr/VRUI.js`)
```javascript
Features:
- Convert existing 2D panels to 3D panels
- Position panels in VR space (front-left, front-right)
- Ray-casting interaction with panels
- Maintain all existing functionality
- Optional: Minimize panels to wrist-mounted UI
```

#### 3.2 Panel Adaptations
- Settings Panel → 3D floating panel
- Camera Panel → 3D floating panel
- Playback Controls → Wrist-mounted or floating panel
- File Info → Smaller 3D text display

### Phase 4: Optimization & Polish

#### 4.1 Performance Optimization
- Reduce quality settings automatically in VR
- Optimize shader complexity for VR framerates (72fps Quest 3, 90fps Vision Pro)
- LOD (Level of Detail) for complex meshes
- Reduce crowd instances in VR mode if needed

#### 4.2 Visual Adjustments
- Adjust tone mapping for VR displays
- Comfort settings (vignette, snap turn)
- IPD (Inter-Pupillary Distance) adjustments
- FOV (Field of View) settings

#### 4.3 Controller Support
- Hand tracking (Quest 3, Vision Pro)
- Controller tracking (Quest controllers)
- Gesture recognition for basic interactions

## File Structure

```
src/
  vr/
    VRManager.js          # Core VR session management
    VRControls.js         # VR-specific controls
    VRUI.js              # 3D UI system
    VRHelpers.js         # Utility functions
    
  config/
    vrCameraPresets.js   # VR-optimized camera positions
    
  ui/
    VRPanel.js           # 3D panel component (extends existing panels)
```

## UI Changes Required

### 1. Add VR Toggle Button
- Location: Settings panel or floating button
- States: "Enter VR" / "Exit VR"
- Visual indicator when VR is available

### 2. VR Status Indicator
- Show current VR session state
- Display headset type (Quest 3 / Vision Pro)
- Performance metrics (fps)

### 3. VR Settings Tab
New tab in Settings Panel:
- VR Camera Presets dropdown
- Scale adjustment slider
- Comfort settings (snap turn, vignette)
- Performance quality (auto/medium/high)

## Browser Compatibility

### Quest 3
- **Browser**: Quest Browser (Chromium-based)
- **URL Entry**: Users navigate to app URL
- **Activation**: Tap "Enter VR" button
- **Features**: Full 6DOF tracking, hand/controller support

### Apple Vision Pro
- **Browser**: Safari
- **URL Entry**: Users navigate to app URL  
- **Activation**: Tap "Enter VR" button
- **Features**: Full 6DOF tracking, hand/eye tracking, spatial audio

## Testing Strategy

### 1. Development Testing
- Use WebXR Emulator extension (Chrome) for desktop testing
- Test UI interactions without physical headset
- Validate performance with browser DevTools

### 2. Device Testing
- Quest 3: Test via Quest Browser
- Vision Pro: Test via Safari
- Verify all features work on both platforms

### 3. Performance Testing
- Target framerates: 72fps (Quest 3), 90fps (Vision Pro)
- Monitor draw calls, texture memory
- Test with complex scenes (full crowd, all meshes)

## Implementation Priority

### High Priority (MVP)
1. ✅ Core VR session management (enter/exit)
2. ✅ Basic head tracking
3. ✅ Scene rendering in VR
4. ✅ VR toggle button in UI

### Medium Priority
5. VR camera presets
6. Scale adjustments
7. Basic controller support

### Low Priority (Future Enhancements)
8. Full 3D UI system
9. Teleportation movement
10. Advanced controller interactions
11. Hand tracking gestures

## Security & Permissions

### WebXR Permissions
- Request required permissions on session start
- Handle permission denial gracefully
- Show clear instructions to users

### HTTPS Requirement
- WebXR requires HTTPS (except localhost)
- Ensure production deployment uses SSL
- Document HTTPS requirement in README

## Documentation Updates

1. **README.md**: Add VR section
   - How to access VR mode
   - Browser requirements
   - Supported devices
   - Known limitations

2. **QUICK_START.md**: Add VR quick start guide

3. **VR_GUIDE.md**: Comprehensive VR documentation
   - Setup instructions
   - Controls reference
   - Troubleshooting

## Potential Challenges & Solutions

### Challenge 1: UI Adaptation
- **Problem**: 2D UI panels don't work well in VR
- **Solution**: Start with simple toggle, migrate to 3D UI later

### Challenge 2: Performance
- **Problem**: VR requires higher framerates
- **Solution**: Automatic quality reduction, LOD system

### Challenge 3: Controller Input
- **Problem**: Different controllers per device
- **Solution**: Abstract input layer, support common patterns

### Challenge 4: Scale/Orientation
- **Problem**: Scene may be wrong size/orientation in VR
- **Solution**: VR-specific camera presets, scale adjustments

## Success Criteria

1. ✅ Users can enter VR mode from Quest 3 browser
2. ✅ Users can enter VR mode from Vision Pro Safari
3. ✅ Scene renders correctly in VR
4. ✅ Head tracking works smoothly
5. ✅ Can exit VR mode and return to desktop
6. ✅ Performance is acceptable (60+ fps)

## Next Steps After Implementation

1. Gather user feedback
2. Iterate on VR UI/UX
3. Add advanced features (teleportation, gestures)
4. Optimize further based on performance data
5. Consider AR mode (pass-through) for Quest 3

---

## Quick Start Implementation Order

1. **Create VRManager** - Basic enter/exit functionality
2. **Add VR button to UI** - Simple toggle
3. **Integrate with renderer** - Enable WebXR
4. **Test on device** - Verify basic functionality
5. **Add VR camera presets** - Improve experience
6. **Polish and optimize** - Performance tuning



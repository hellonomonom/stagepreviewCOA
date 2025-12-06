# VR Debug Overlay Usage Guide

The VR Debug Overlay provides real-time debugging information directly in VR space, making it easy to verify input modes, interactions, and system status without needing to use the browser console.

## Features

- **Input Mode Status**: Shows current input mode (controller/hand/gaze) with color coding
- **Controller Status**: Shows which controllers are connected
- **Hand Tracking Status**: Shows hand tracking and pinch state
- **Interaction State**: Shows currently hovered and selected objects
- **Recent Logs**: Displays recent VR-related console logs
- **Real-time Updates**: Updates automatically every 100ms

## How to Use

### Toggle the Overlay

**Keyboard Shortcut**: Press **`D`** key (while in VR) to toggle the debug overlay on/off

The overlay is hidden by default when entering VR. Press `D` to show it.

### Position

The overlay appears:
- **1.5 meters** in front of you
- **0.2 meters** above eye level
- Always faces you (billboard effect)
- Follows your head movement

## What's Displayed

### Input Mode Section

Shows the current input mode with color coding:
- **GREEN** = Controller mode
- **YELLOW** = Hand tracking mode  
- **ORANGE** = Gaze mode (fallback)

Also shows availability status for:
- Controllers (Left/Right)
- Hand Tracking (Left/Right)
- Gaze (always available)

### Interaction Section

Shows:
- **Hovered Object**: Name of object currently being hovered (or "NONE")
- **Selecting Object**: Name of object currently being selected (or "NONE")
- **Is Selecting**: Whether a selection action is active

### Controller Details

Shows connection status for:
- Left controller: CONNECTED or DISCONNECTED
- Right controller: CONNECTED or DISCONNECTED

### Hand Tracking Details

Shows:
- Left hand: TRACKING or NOT TRACKING
- Right hand: TRACKING or NOT TRACKING
- Left Pinch: YES or NO
- Right Pinch: YES or NO

### Recent Logs

Displays the last 10 VR-related log messages with:
- Timestamp
- Color coding:
  - **GREEN** = Info messages
  - **YELLOW** = Warning messages
  - **RED** = Error messages

## Verifying Gaze Fallback

To verify gaze fallback is working:

1. **Enter VR** without controllers/hands
2. **Press `D`** to show debug overlay
3. **Check Input Mode**: Should show "GAZE" in orange
4. **Check Controllers**: Should show "NO" for both
5. **Check Hand Tracking**: Should show "NOT TRACKING" for both
6. **Check Logs**: Should see "Switched to gaze mode (fallback)"

### Test Mode Switching

1. **Start in Gaze Mode**: Verify overlay shows "GAZE"
2. **Connect Controllers**: Watch overlay switch to "CONTROLLER" (green)
3. **Disconnect Controllers**: Watch overlay switch back to "GAZE" (orange)
4. **Enable Hand Tracking**: Watch overlay switch to "HAND" (yellow)

## Programmatic Access

You can also control the overlay from code:

```javascript
// Show overlay
vrManager.debugOverlay.show();

// Hide overlay
vrManager.debugOverlay.hide();

// Toggle overlay
vrManager.debugOverlay.toggle();

// Add custom log
vrManager.debugOverlay.addLog('Custom message', 'info');
vrManager.debugOverlay.addLog('Warning message', 'warn');
vrManager.debugOverlay.addLog('Error message', 'error');

// Disable overlay entirely
vrManager.debugOverlay.setEnabled(false);

// Re-enable overlay
vrManager.debugOverlay.setEnabled(true);
```

## Troubleshooting

### Overlay Not Showing

1. **Check if enabled**: Overlay might be disabled
2. **Check VR is active**: Overlay only works in VR
3. **Check initialization**: Look for "VR Debug Overlay: Initialized" in console
4. **Try pressing `D`**: Overlay is hidden by default

### Overlay Not Updating

1. **Check update loop**: Overlay updates every 100ms (throttled for performance)
2. **Check VR session**: Updates only happen when VR is active
3. **Check console**: Look for errors in browser console

### Overlay Position Issues

1. **Check camera**: Overlay follows camera position
2. **Check offset**: Default is 1.5m in front, 0.2m up
3. **Reposition**: You can modify `positionOffset` in code if needed

## Performance

The overlay is optimized for VR:
- **Throttled updates**: Only updates every 100ms (10 FPS for text)
- **Canvas rendering**: Uses efficient canvas texture
- **Depth disabled**: Renders on top (no depth testing)
- **Small texture**: 512x512 canvas (sufficient for text)

## Customization

You can customize the overlay by modifying `src/vr/VRDebugOverlay.js`:

- **Size**: Change `width` and `height` properties
- **Position**: Change `distance` and `positionOffset`
- **Text**: Modify `fontSize`, `lineHeight`, `padding`
- **Colors**: Modify fill styles in `updateDisplay()` method
- **Update rate**: Change `updateInterval` (milliseconds)

## Integration

The overlay is automatically:
- ✅ Created when VR features initialize
- ✅ Added to scene (hidden by default)
- ✅ Updated each frame
- ✅ Cleaned up on VR exit
- ✅ Captures VR-related console logs

## Example: Verifying Phase 1 Requirements

Use the debug overlay to verify Phase 1 checklist items:

1. **Input Mode Detection**: Check overlay shows correct mode
2. **Gaze Fallback**: Verify falls back to gaze when no controllers/hands
3. **Mode Switching**: Watch mode change when connecting/disconnecting devices
4. **Hover Detection**: Check "Hovered" field when looking at objects
5. **Selection Detection**: Check "Selecting" field when selecting objects
6. **Controller Status**: Verify controller connection status
7. **Hand Tracking**: Verify hand tracking status

---

**Tip**: Keep the overlay visible while testing to see real-time feedback on all VR interactions!



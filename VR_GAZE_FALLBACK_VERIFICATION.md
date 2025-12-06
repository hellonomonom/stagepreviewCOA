# Gaze Fallback Verification Guide

This guide helps you verify that the gaze fallback is working correctly in VR Phase 1.

## What Was Fixed

The gaze fallback detection was improved to check if controllers are **actually connected** (not just if controller objects exist). Previously, it would check if a ray exists, but controller objects can exist and provide rays even when not connected.

## Changes Made

1. **Fixed `detectInputMode()`**: Now checks `isControllerConnected()` instead of just checking if rays exist
2. **Added debug logging**: Console logs when input mode switches
3. **Added `getInputModeStatus()`**: New method to get detailed status for verification

---

## Verification Steps

### Step 1: Open Browser Console

1. Start your dev server
2. Open the app in your browser
3. Open Developer Tools (F12)
4. Go to the Console tab

### Step 2: Enter VR Mode

1. Click the VR button to enter VR
2. Wait for initialization messages in console
3. Look for: `VRInputManager: Initialized and ready`

### Step 3: Check Initial Mode (No Controllers/Hands)

In the console, run:

```javascript
// Wait for inputManager to be ready
vrManager.waitForInputManager((inputManager) => {
  if (!inputManager) {
    console.error('InputManager not available');
    return;
  }
  
  // Get current status
  const status = inputManager.getInputModeStatus();
  console.log('Input Mode Status:', status);
  console.log('Current Mode:', inputManager.getCurrentInputMode());
  
  // Verify gaze fallback
  if (status.currentMode === 'gaze') {
    console.log('✅ Gaze fallback is working!');
  } else {
    console.warn('⚠️ Expected gaze mode, got:', status.currentMode);
  }
});
```

**Expected Result:**
- `currentMode: 'gaze'`
- `controllerAvailable: false`
- `handTrackingAvailable: false`
- `gazeAvailable: true`
- Console log: `VRInputManager: Switched to gaze mode (fallback)`

### Step 4: Test Gaze Ray

Verify that gaze ray is working:

```javascript
vrManager.waitForInputManager((inputManager) => {
  const gazeRay = inputManager.getGazeRay();
  console.log('Gaze Ray:', {
    origin: gazeRay.origin,
    direction: gazeRay.direction
  });
  
  // Verify ray is valid
  if (gazeRay && gazeRay.origin && gazeRay.direction) {
    console.log('✅ Gaze ray is valid');
  } else {
    console.error('❌ Gaze ray is invalid');
  }
});
```

**Expected Result:**
- Ray object with `origin` (Vector3) and `direction` (Vector3)
- Direction should be normalized (length ≈ 1.0)
- Origin should be camera position

### Step 5: Test with Controllers (if available)

If you have VR controllers:

1. **Connect controllers** while in VR
2. **Watch console** for mode switch message
3. **Check status again:**

```javascript
vrManager.waitForInputManager((inputManager) => {
  const status = inputManager.getInputModeStatus();
  console.log('Status with controllers:', status);
  
  if (status.currentMode === 'controller') {
    console.log('✅ Controller mode detected');
  }
});
```

**Expected Result:**
- Mode switches to `'controller'`
- Console log: `VRInputManager: Switched to controller mode`
- `controllerAvailable: true`

### Step 6: Test Disconnecting Controllers

1. **Disconnect controllers** (or put them down)
2. **Watch console** for fallback message
3. **Check status:**

```javascript
vrManager.waitForInputManager((inputManager) => {
  // Wait a moment for mode detection
  setTimeout(() => {
    const status = inputManager.getInputModeStatus();
    console.log('Status after disconnect:', status);
    
    if (status.currentMode === 'gaze') {
      console.log('✅ Gaze fallback works after disconnect!');
    }
  }, 1000);
});
```

**Expected Result:**
- Mode switches back to `'gaze'`
- Console log: `VRInputManager: Switched to gaze mode (fallback)`

### Step 7: Test with Hand Tracking (if available)

If you have hand tracking:

1. **Enable hand tracking** in VR
2. **Raise your hands** so they're tracked
3. **Check status:**

```javascript
vrManager.waitForInputManager((inputManager) => {
  const status = inputManager.getInputModeStatus();
  console.log('Status with hands:', status);
  
  if (status.currentMode === 'hand') {
    console.log('✅ Hand tracking mode detected');
  }
});
```

**Expected Result:**
- Mode switches to `'hand'`
- Console log: `VRInputManager: Switched to hand tracking mode`
- `handTrackingAvailable: true`

### Step 8: Test Mode Priority

Verify priority order: controller → hand → gaze

```javascript
vrManager.waitForInputManager((inputManager) => {
  const status = inputManager.getInputModeStatus();
  
  console.log('=== Input Mode Priority Test ===');
  console.log('Controller available:', status.controllerAvailable);
  console.log('Hand tracking available:', status.handTrackingAvailable);
  console.log('Current mode:', status.currentMode);
  
  // Priority should be: controller > hand > gaze
  if (status.controllerAvailable && status.currentMode !== 'controller') {
    console.error('❌ Priority issue: Controllers available but mode is', status.currentMode);
  } else if (!status.controllerAvailable && status.handTrackingAvailable && status.currentMode !== 'hand') {
    console.error('❌ Priority issue: Hands available but mode is', status.currentMode);
  } else if (!status.controllerAvailable && !status.handTrackingAvailable && status.currentMode !== 'gaze') {
    console.error('❌ Priority issue: Should be gaze but mode is', status.currentMode);
  } else {
    console.log('✅ Priority order is correct!');
  }
});
```

---

## Continuous Monitoring

To continuously monitor input mode changes, you can set up a watcher:

```javascript
vrManager.waitForInputManager((inputManager) => {
  let lastMode = inputManager.getCurrentInputMode();
  
  // Monitor every second
  const monitor = setInterval(() => {
    const currentMode = inputManager.getCurrentInputMode();
    if (currentMode !== lastMode) {
      console.log(`Mode changed: ${lastMode} → ${currentMode}`);
      const status = inputManager.getInputModeStatus();
      console.log('Status:', status);
      lastMode = currentMode;
    }
  }, 1000);
  
  // Stop monitoring after 30 seconds (or adjust as needed)
  setTimeout(() => {
    clearInterval(monitor);
    console.log('Stopped monitoring');
  }, 30000);
});
```

---

## Testing Gaze Interaction

To test if gaze can actually interact with objects:

1. **Create a test object** in VR space (if you don't have one)
2. **Register it** with inputManager
3. **Look at it** (gaze at it)
4. **Check hover state:**

```javascript
vrManager.waitForInputManager((inputManager) => {
  // Check if any object is hovered
  const hovered = inputManager.getHoveredObject();
  if (hovered) {
    console.log('✅ Gaze is hovering over:', hovered.name || 'unnamed object');
  } else {
    console.log('No object hovered (look at an interactive object)');
  }
  
  // Monitor hover changes
  inputManager.onHoverStart((object) => {
    console.log('Gaze hover start:', object.name || 'unnamed');
  });
  
  inputManager.onHoverEnd((object) => {
    console.log('Gaze hover end:', object.name || 'unnamed');
  });
});
```

**Note:** Gaze selection (click/select) is not yet implemented. Gaze can hover but cannot select without controllers/hands or additional implementation (dwell time, external trigger, etc.).

---

## Expected Console Output

When everything is working correctly, you should see:

```
VRInputManager: Initialized and ready
VRInputManager: Switched to gaze mode (fallback)
Input Mode Status: {
  currentMode: 'gaze',
  controllerAvailable: false,
  handTrackingAvailable: false,
  gazeAvailable: true,
  details: { controllers: { left: false, right: false }, hands: { left: false, right: false } }
}
✅ Gaze fallback is working!
```

---

## Troubleshooting

### Issue: Mode stays as 'controller' even without controllers

**Solution:** The fix should resolve this. Make sure you've reloaded the page after the fix.

### Issue: No console logs for mode switching

**Check:**
- Is `detectInputMode()` being called? (It's called in `update()`)
- Is `update()` being called each frame? (Check VRManager)

### Issue: Gaze ray is null or invalid

**Check:**
- Is camera available?
- Is VR session active?
- Check camera position and quaternion

### Issue: Mode doesn't switch when controllers disconnect

**Check:**
- Are controllers actually disconnecting? (Check `isControllerConnected()`)
- Is `detectInputMode()` being called each frame?
- Check for errors in console

---

## Summary Checklist

- [ ] Gaze mode activates when no controllers/hands
- [ ] Console shows "Switched to gaze mode (fallback)"
- [ ] `getInputModeStatus()` shows `currentMode: 'gaze'`
- [ ] Gaze ray is valid and points forward from camera
- [ ] Mode switches to controller when controllers connect
- [ ] Mode switches back to gaze when controllers disconnect
- [ ] Priority order is correct (controller > hand > gaze)
- [ ] Gaze can hover over interactive objects

---

## Next Steps

After verifying gaze fallback:
1. Mark checklist items as complete
2. Test gaze interaction with objects
3. Consider implementing gaze selection (dwell time, external trigger, etc.) if needed
4. Move on to Phase 2 implementation



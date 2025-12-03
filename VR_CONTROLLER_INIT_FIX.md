# VR Controller Initialization Fix

## Problem
Controllers weren't being recognized/initialized properly when entering VR mode.

## Root Cause
The controller initialization was using filtered input sources and incorrect index mapping. Three.js WebXR maps controller indices directly to input source indices in the `xrSession.inputSources` array, so we need to use the original array indices, not filtered indices.

## Solution Implemented

### 1. Fixed Controller Index Mapping
- Now iterates through the **original** `xrSession.inputSources` array
- Uses the **actual index** from the input sources array to get controllers
- This ensures controllers match their corresponding input sources

### 2. Improved Controller Matching
- Controllers are matched by their index position in the input sources array
- Each input source's index directly corresponds to the controller index
- Properly tracks which controller belongs to which hand

### 3. Better Initialization Flow
- Checks input sources immediately on init
- Sets up controllers only once per hand
- Always updates input source references
- Stores hand information on controller userData

### 4. Enhanced Connection Handling
- Listens for `inputsourceschange` events
- Automatically sets up controllers when they connect
- Multiple retry attempts (100ms, 500ms, 1.5s, 3s)
- Continuous checking in update loop if controllers aren't found

## Code Changes

### Before:
```javascript
const controllerInputSources = xrSession.inputSources.filter(...);
controllerInputSources.forEach((inputSource, index) => {
  controller = this.renderer.xr.getController(index); // Wrong index!
});
```

### After:
```javascript
xrSession.inputSources.forEach((inputSource, index) => {
  if (inputSource.targetRayMode === 'tracked-pointer' && inputSource.handedness) {
    controller = this.renderer.xr.getController(index); // Correct index!
  }
});
```

## Testing

When entering VR:
1. Controllers should be detected immediately or within a few seconds
2. Check browser console for messages like:
   - `Checking X input sources`
   - `✓ Left controller created and set up at index 0`
   - `✓ Right controller created and set up at index 1`
3. Debug text should appear on controllers showing button states
4. Controllers should be visible in VR with rays/lasers

## If Controllers Still Don't Work

1. **Check Console:**
   - Look for "No input sources available yet" - means controllers haven't connected
   - Check for "Could not get controller at index X" errors

2. **Verify Controllers Are On:**
   - Make sure Quest 3 controllers are powered on
   - Controllers should be tracked (visible in Quest home)

3. **Wait for Connection:**
   - Controllers may take 1-3 seconds to connect after entering VR
   - Check console for connection messages

4. **Try:**
   - Exit and re-enter VR
   - Turn controllers off and on
   - Make sure controllers are on before entering VR

---

**Controllers should now be properly recognized and initialized!**


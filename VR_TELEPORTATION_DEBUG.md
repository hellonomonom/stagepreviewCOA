# VR Teleportation Debug Guide

## Current Issue
User sees white laser pointer but no blue arc and target indicator.

## What to Check

### 1. Is Teleportation Mode Activating?
- Press and **hold** the right controller trigger
- Check browser console for "VR Teleportation: Started" message
- If you don't see this, teleportation isn't activating

### 2. Is the Arc Showing?
- When you hold the trigger, you should see a blue arc
- The arc should appear immediately when trigger is pressed
- If arc doesn't show, check:
  - Browser console for errors
  - Whether visual indicators are created (check console logs)

### 3. Is the Floor Mesh Set?
- Check browser console for "VR Teleportation: Floor mesh set" message
- If you see "No floor mesh set" warnings, the floor mesh isn't being passed correctly

### 4. Is the Raycast Working?
- Point the controller at the floor while holding trigger
- Check console for intersection messages
- If no intersections, the raycast might not be finding the floor

## Debugging Steps

1. **Open browser console** (F12)
2. **Enter VR mode**
3. **Press and hold right controller trigger**
4. **Look for console messages:**
   - "VR Teleportation: Started" - confirms teleportation activated
   - "VR Teleportation: No ray available" - raycast problem
   - "VR Teleportation: No floor mesh set" - floor mesh not passed
   - "VR Teleportation: Visual indicators not created" - indicator creation failed

## What Should Happen

When you press and hold the right controller trigger:
1. ✅ Teleportation mode activates (`isTeleporting = true`)
2. ✅ Blue arc appears from controller pointing forward
3. ✅ When pointing at floor, target indicator appears
4. ✅ Target indicator is green if valid, red if out of range
5. ✅ Release trigger to teleport (if valid target)

## Possible Issues

### Issue: White laser pointer but no blue arc
- **Cause**: Teleportation not activating OR visual indicators not created
- **Fix**: Check console for "VR Teleportation: Started" message

### Issue: Arc shows but no target indicator
- **Cause**: Raycast not finding floor mesh
- **Fix**: Check floor mesh is set and raycast is working

### Issue: Nothing shows when pressing trigger
- **Cause**: Trigger event not firing OR teleportation not initialized
- **Fix**: Check `setupTeleportationWithControllers()` is called

## Console Commands for Testing

```javascript
// Check if teleportation is initialized
vrManager?.teleportation?.isTeleporting

// Check if floor mesh is set
vrManager?.teleportation?.floorMesh

// Manually start teleportation (for testing)
vrManager?.teleportation?.startTeleport('controller', 'right')
```


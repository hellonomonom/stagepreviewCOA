# VR Teleportation Guide

## Overview

Teleportation allows you to move to positions on the floor mesh in VR using controllers or hand tracking.

## How to Use

### With Controllers (Quest 3)
1. **Point** your controller at the floor where you want to teleport
2. **Hold trigger** - A teleportation arc will appear showing your path
3. **Release trigger** - If the target is valid (green ring), you'll teleport there

### With Hand Tracking (Quest 3 / Vision Pro)
1. **Point** your hand at the floor where you want to teleport
2. **Pinch** (thumb + index finger) - A teleportation arc will appear
3. **Release pinch** - If the target is valid (green ring), you'll teleport there

## Visual Indicators

- **Blue Arc**: Shows the teleportation path from your controller/hand
- **Green Ring**: Valid teleportation target (you can teleport here)
- **No Ring**: Invalid target (too far or not on floor)

## Teleportation Limits

- **Max Distance**: 10 meters from your current position
- **Floor Only**: Can only teleport to positions on the floor mesh
- **Smooth Animation**: Teleportation is animated for comfort

## Technical Details

The teleportation system:
- Uses ray-casting to detect floor intersections
- Shows visual feedback with an arc and target indicator
- Smoothly animates the scene offset to move you to the target
- Works with both controller and hand tracking input

## Customization

You can adjust teleportation settings:
- Max distance: `teleportation.setMaxDistance(15)` (in meters)
- Arc height: Adjustable in VRTeleportation class
- Animation duration: Currently 300ms (smooth easing)

Enjoy teleporting around the stage! 🚀












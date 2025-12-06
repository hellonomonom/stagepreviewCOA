/**
 * VR Camera Presets - Optimized starting positions for VR mode
 * These positions are applied when entering VR mode
 */

export const vrCameraPresets = {
  /**
   * Default VR launch position - starts at world origin
   */
  default: {
    position: { x: 0, y: 1.6, z: 0 }, // World origin at eye level (1.6m)
    rotation: { x: 0, y: 0, z: 0 },
    target: { x: 0, y: 1.6, z: -1 }, // Looking forward
    label: 'Default View (Origin)'
  },
  
  /**
   * Stage front view - close to stage
   */
  stageFront: {
    position: { x: 0, y: 1.6, z: 5 },
    rotation: { x: 0, y: 0, z: 0 },
    target: { x: 0, y: 2, z: 0 },
    label: 'Stage Front'
  },
  
  /**
   * Crowd view - from audience perspective
   */
  crowdView: {
    position: { x: 0, y: 1.6, z: 10 },
    rotation: { x: 0, y: 0, z: 0 },
    target: { x: 0, y: 2, z: 0 },
    label: 'Crowd View'
  },
  
  /**
   * High angle view - above the stage
   */
  highAngle: {
    position: { x: 0, y: 7.86, z: 48.918 },
    rotation: { x: 0, y: 0, z: 0 },
    target: { x: 0, y: 7.8638, z: 0 },
    label: 'High Angle'
  },
  
  /**
   * Far view - distant perspective
   */
  farView: {
    position: { x: 0, y: 7.86, z: 100 },
    rotation: { x: 0, y: 0, z: 0 },
    target: { x: 0, y: 7.86, z: 0 },
    label: 'Far View'
  },
  
  /**
   * Side view - from the side
   */
  sideView: {
    position: { x: -1.63, y: 4.54, z: 65.35 },
    rotation: { x: -1.52, y: -2.01, z: 0 },
    target: { x: 0.67, y: 2.81, z: 0.15 },
    label: 'Side View'
  }
};

// Default VR camera preset
export const DEFAULT_VR_CAMERA_PRESET = 'default';

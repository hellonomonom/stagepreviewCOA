/**
 * VR Quality Settings
 * Manages quality settings specifically optimized for VR
 */

export class VRQualitySettings {
  constructor(renderer, scene) {
    this.renderer = renderer;
    this.scene = scene;
    
    // Quality presets
    this.presets = {
      ultra: {
        name: 'Ultra',
        antialias: true,
        shadowQuality: 'high',
        textureQuality: 'high',
        renderScale: 1.0,
        msaa: 4
      },
      high: {
        name: 'High',
        antialias: true,
        shadowQuality: 'high',
        textureQuality: 'high',
        renderScale: 1.0,
        msaa: 2
      },
      medium: {
        name: 'Medium',
        antialias: true,
        shadowQuality: 'medium',
        textureQuality: 'medium',
        renderScale: 0.9,
        msaa: 2
      },
      low: {
        name: 'Low',
        antialias: false,
        shadowQuality: 'low',
        textureQuality: 'low',
        renderScale: 0.75,
        msaa: 1
      }
    };

    this.currentPreset = 'high';
    this.originalSettings = null;
  }

  /**
   * Store original renderer settings
   */
  storeOriginalSettings() {
    if (this.originalSettings) return;

    this.originalSettings = {
      antialias: true,
      pixelRatio: this.renderer.getPixelRatio()
    };
  }

  /**
   * Apply quality preset for VR
   * @param {string} presetName - Name of the preset
   */
  applyPreset(presetName) {
    if (!this.presets[presetName]) {
      console.warn('Unknown quality preset:', presetName);
      return;
    }

    this.storeOriginalSettings();
    const preset = this.presets[presetName];
    this.currentPreset = presetName;

    // Apply settings
    this.applyShadowQuality(preset.shadowQuality);
    this.applyRenderScale(preset.renderScale);
    
    // MSAA is typically set during renderer creation, but we can adjust pixel ratio
    // For WebXR, MSAA is handled by the browser/device
    
    console.log(`VR quality preset applied: ${preset.name}`);
  }

  /**
   * Apply shadow quality
   * @private
   */
  applyShadowQuality(quality) {
    const sizes = {
      high: 2048,
      medium: 1024,
      low: 512
    };

    const size = sizes[quality] || 1024;

    this.scene.traverse((object) => {
      if (object.isLight && object.shadow) {
        object.shadow.mapSize.width = size;
        object.shadow.mapSize.height = size;
        if (object.shadow.map) {
          object.shadow.map.dispose();
          object.shadow.map = null;
        }
      }
    });
  }

  /**
   * Apply render scale (pixel ratio adjustment)
   * @private
   */
  applyRenderScale(scale) {
    const basePixelRatio = Math.min(window.devicePixelRatio, 1.0);
    const targetPixelRatio = basePixelRatio * scale;
    this.renderer.setPixelRatio(targetPixelRatio);
  }

  /**
   * Restore original settings
   */
  restoreOriginalSettings() {
    if (!this.originalSettings) return;

    this.renderer.setPixelRatio(this.originalSettings.pixelRatio);
  }

  /**
   * Get current preset
   * @returns {string}
   */
  getCurrentPreset() {
    return this.currentPreset;
  }

  /**
   * Get available presets
   * @returns {string[]}
   */
  getAvailablePresets() {
    return Object.keys(this.presets);
  }
}












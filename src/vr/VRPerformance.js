/**
 * VR Performance Monitor and Optimizer
 * Monitors FPS and automatically adjusts quality settings for smooth VR experience
 */

export class VRPerformance {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    
    // Performance monitoring
    this.fpsHistory = [];
    this.fpsHistorySize = 60; // Store last 60 frames
    this.lastFrameTime = performance.now();
    this.frameCount = 0;
    this.currentFPS = 60;
    
    // Quality levels
    this.qualityLevels = {
      high: {
        name: 'High',
        shadowMapSize: 2048,
        antialias: true,
        pixelRatio: 1.0,
        crowdInstanceCount: 4000
      },
      medium: {
        name: 'Medium',
        shadowMapSize: 1024,
        antialias: true,
        pixelRatio: 0.75,
        crowdInstanceCount: 2500
      },
      low: {
        name: 'Low',
        shadowMapSize: 512,
        antialias: false,
        pixelRatio: 0.5,
        crowdInstanceCount: 1500
      }
    };

    this.currentQuality = 'high';
    this.targetFPS = 72; // Quest 3 target (90 for Vision Pro)
    this.minFPS = 60; // Minimum acceptable FPS
    
    // Callbacks
    this.onQualityChangeCallbacks = [];
    this.onFPSUpdateCallbacks = [];
    
    // Auto-adjustment
    this.autoAdjustEnabled = true;
    this.adjustmentCooldown = 5000; // ms between adjustments
    this.lastAdjustmentTime = 0;
    
    // Original settings (for restoration)
    this.originalSettings = null;
    this.isVROptimized = false;
  }

  /**
   * Initialize performance monitoring
   */
  init() {
    this.storeOriginalSettings();
  }

  /**
   * Store original renderer settings for restoration
   * @private
   */
  storeOriginalSettings() {
    if (this.originalSettings) return; // Already stored
    
    // Store current renderer settings
    this.originalSettings = {
      shadowMapSize: this.renderer.shadowMap ? 2048 : 0, // Default size
      pixelRatio: this.renderer.getPixelRatio(),
      antialias: true // Assume antialias was enabled
    };
  }

  /**
   * Enable VR optimization
   */
  enableVROptimization() {
    if (this.isVROptimized) return;
    
    this.storeOriginalSettings();
    this.applyQualitySettings(this.currentQuality);
    this.isVROptimized = true;
    console.log('VR performance optimization enabled');
  }

  /**
   * Disable VR optimization (restore original settings)
   */
  disableVROptimization() {
    if (!this.isVROptimized) return;
    
    this.restoreOriginalSettings();
    this.isVROptimized = false;
    console.log('VR performance optimization disabled');
  }

  /**
   * Apply quality settings
   * @param {string} quality - Quality level name
   */
  applyQualitySettings(quality) {
    if (!this.qualityLevels[quality]) {
      console.warn('Unknown quality level:', quality);
      return;
    }

    const settings = this.qualityLevels[quality];
    this.currentQuality = quality;

    // Apply renderer settings
    if (this.renderer.shadowMap) {
      // Note: Shadow map size is set per light, not renderer
      // We'll need to iterate through lights in the scene
      this.scene.traverse((object) => {
        if (object.isLight && object.shadow) {
          object.shadow.mapSize.width = settings.shadowMapSize;
          object.shadow.mapSize.height = settings.shadowMapSize;
          object.shadow.map?.dispose();
          object.shadow.map = null;
        }
      });
    }

    // Pixel ratio
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, settings.pixelRatio));

    // Trigger quality change callbacks
    this.triggerQualityChange(quality, settings);

    console.log(`Quality set to: ${settings.name}`);
  }

  /**
   * Restore original settings
   * @private
   */
  restoreOriginalSettings() {
    if (!this.originalSettings) return;

    // Restore pixel ratio
    this.renderer.setPixelRatio(this.originalSettings.pixelRatio);

    // Restore shadow map sizes
    this.scene.traverse((object) => {
      if (object.isLight && object.shadow) {
        object.shadow.mapSize.width = this.originalSettings.shadowMapSize;
        object.shadow.mapSize.height = this.originalSettings.shadowMapSize;
        object.shadow.map?.dispose();
        object.shadow.map = null;
      }
    });
  }

  /**
   * Update FPS monitoring (call each frame)
   */
  update() {
    const now = performance.now();
    const deltaTime = now - this.lastFrameTime;
    
    if (deltaTime > 0) {
      const fps = 1000 / deltaTime;
      this.currentFPS = fps;
      
      // Add to history
      this.fpsHistory.push(fps);
      if (this.fpsHistory.length > this.fpsHistorySize) {
        this.fpsHistory.shift();
      }
      
      // Trigger FPS update callbacks
      this.triggerFPSUpdate(fps);
      
      // Auto-adjust quality if enabled
      if (this.autoAdjustEnabled && this.isVROptimized) {
        this.checkAndAdjustQuality();
      }
    }
    
    this.lastFrameTime = now;
    this.frameCount++;
  }

  /**
   * Check FPS and adjust quality if needed
   * @private
   */
  checkAndAdjustQuality() {
    const now = Date.now();
    if (now - this.lastAdjustmentTime < this.adjustmentCooldown) {
      return; // Cooldown active
    }

    if (this.fpsHistory.length < 30) {
      return; // Not enough data
    }

    // Calculate average FPS over recent history
    const recentFPS = this.fpsHistory.slice(-30);
    const avgFPS = recentFPS.reduce((sum, fps) => sum + fps, 0) / recentFPS.length;

    // Determine target quality based on average FPS
    if (avgFPS < this.minFPS) {
      // FPS too low, reduce quality
      if (this.currentQuality === 'high') {
        this.applyQualitySettings('medium');
        this.lastAdjustmentTime = now;
        console.log('Auto-adjusted quality: High → Medium (FPS:', avgFPS.toFixed(1), ')');
      } else if (this.currentQuality === 'medium') {
        this.applyQualitySettings('low');
        this.lastAdjustmentTime = now;
        console.log('Auto-adjusted quality: Medium → Low (FPS:', avgFPS.toFixed(1), ')');
      }
    } else if (avgFPS > this.targetFPS + 10) {
      // FPS is good, can increase quality
      if (this.currentQuality === 'low') {
        this.applyQualitySettings('medium');
        this.lastAdjustmentTime = now;
        console.log('Auto-adjusted quality: Low → Medium (FPS:', avgFPS.toFixed(1), ')');
      } else if (this.currentQuality === 'medium') {
        this.applyQualitySettings('high');
        this.lastAdjustmentTime = now;
        console.log('Auto-adjusted quality: Medium → High (FPS:', avgFPS.toFixed(1), ')');
      }
    }
  }

  /**
   * Get current FPS
   * @returns {number}
   */
  getCurrentFPS() {
    return this.currentFPS;
  }

  /**
   * Get average FPS
   * @returns {number}
   */
  getAverageFPS() {
    if (this.fpsHistory.length === 0) return 0;
    return this.fpsHistory.reduce((sum, fps) => sum + fps, 0) / this.fpsHistory.length;
  }

  /**
   * Get current quality level
   * @returns {string}
   */
  getCurrentQuality() {
    return this.currentQuality;
  }

  /**
   * Get quality settings
   * @returns {Object}
   */
  getQualitySettings() {
    return this.qualityLevels[this.currentQuality];
  }

  /**
   * Set auto-adjustment enabled
   * @param {boolean} enabled
   */
  setAutoAdjustEnabled(enabled) {
    this.autoAdjustEnabled = enabled;
  }

  /**
   * Register callback for quality changes
   * @param {Function} callback
   */
  onQualityChange(callback) {
    if (typeof callback === 'function') {
      this.onQualityChangeCallbacks.push(callback);
    }
  }

  /**
   * Register callback for FPS updates
   * @param {Function} callback
   */
  onFPSUpdate(callback) {
    if (typeof callback === 'function') {
      this.onFPSUpdateCallbacks.push(callback);
    }
  }

  /**
   * Trigger quality change callbacks
   * @private
   */
  triggerQualityChange(quality, settings) {
    this.onQualityChangeCallbacks.forEach(callback => {
      try {
        callback(quality, settings);
      } catch (error) {
        console.error('Error in quality change callback:', error);
      }
    });
  }

  /**
   * Trigger FPS update callbacks
   * @private
   */
  triggerFPSUpdate(fps) {
    this.onFPSUpdateCallbacks.forEach(callback => {
      try {
        callback(fps);
      } catch (error) {
        console.error('Error in FPS update callback:', error);
      }
    });
  }

  /**
   * Cleanup
   */
  dispose() {
    this.fpsHistory = [];
    this.onQualityChangeCallbacks = [];
    this.onFPSUpdateCallbacks = [];
    
    if (this.isVROptimized) {
      this.disableVROptimization();
    }
  }
}




import { vrCameraPresets, DEFAULT_VR_CAMERA_PRESET } from '../config/vrCameraPresets.js';
import * as THREE from 'three';
import { VRPresetNavigation } from './VRPresetNavigation.js';
import { VRPerformance } from './VRPerformance.js';
import { VRQualitySettings } from './VRQualitySettings.js';
import { VRControllers } from './VRControllers.js';
import { VRHandTracking } from './VRHandTracking.js';
import { VRInputManager } from './VRInputManager.js';
import { VRTeleportation } from './VRTeleportation.js';

/**
 * VRManager - Manages WebXR VR sessions
 * Handles entering/exiting VR mode and session lifecycle
 * Integrates all VR features: navigation, performance, controllers, hand tracking, UI panels
 */
export class VRManager {
  constructor(renderer, scene, camera, controls) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.controls = controls;
    
    this.xrSession = null;
    this.isVRActive = false;
    this.originalAnimationLoop = null;
    this.vrSupported = false;
    
    // VR scene offset (for positioning user in VR)
    this.vrSceneOffset = null;
    this.vrCameraPreset = DEFAULT_VR_CAMERA_PRESET;
    
    // VR Features
    this.presetNavigation = null;
    this.performance = null;
    this.qualitySettings = null;
    this.controllers = null;
    this.handTracking = null;
    this.inputManager = null; // Unified input manager (Phase 1)
    this.teleportation = null;
    this.playbackPanel = null;
    this.settingsPanel = null;
    
    // External references (will be set via setter methods)
    this.playbackControlsRef = null;
    this.videoElementRef = null;
    this.settingsPanelRef = null;
    this.floorMeshRef = null;
    
    // Callbacks
    this.onVREnterCallbacks = [];
    this.onVRExitCallbacks = [];
    
    // Initialize WebXR support check (don't initialize VR features yet - lazy load)
    this.init();
  }

  /**
   * Initialize VR feature systems
   * @private
   */
  initVRFeatures() {
    try {
      // Preset navigation
      this.presetNavigation = new VRPresetNavigation(this);
    } catch (error) {
      console.error('Failed to initialize VR Preset Navigation:', error);
      this.presetNavigation = null;
    }
    
    try {
      // Performance monitoring
      this.performance = new VRPerformance(this.scene, this.renderer);
      this.performance.init();
    } catch (error) {
      console.error('Failed to initialize VR Performance:', error);
      this.performance = null;
    }
    
    try {
      // Quality settings
      this.qualitySettings = new VRQualitySettings(this.renderer, this.scene);
    } catch (error) {
      console.error('Failed to initialize VR Quality Settings:', error);
      this.qualitySettings = null;
    }
    
    try {
      // Controllers (will be initialized when entering VR)
      this.controllers = new VRControllers(this.renderer, this.scene, this.camera);
    } catch (error) {
      console.error('Failed to initialize VR Controllers:', error);
      this.controllers = null;
    }
    
    try {
      // Hand tracking (will be initialized when entering VR)
      this.handTracking = new VRHandTracking(this.renderer, this.scene, this.camera);
    } catch (error) {
      console.error('Failed to initialize VR Hand Tracking:', error);
      this.handTracking = null;
    }
    
    try {
      // Unified Input Manager (Phase 1) - requires controllers and handTracking
      this.inputManager = new VRInputManager(
        this.renderer,
        this.scene,
        this.camera,
        this.controllers,
        this.handTracking
      );
    } catch (error) {
      console.error('Failed to initialize VR Input Manager:', error);
      this.inputManager = null;
    }
    
    try {
      // Teleportation system
      this.teleportation = new VRTeleportation(
        this.renderer,
        this.scene,
        this.camera,
        this.controllers,
        this.handTracking,
        this.floorMeshRef,
        this
      );
    } catch (error) {
      console.error('Failed to initialize VR Teleportation:', error);
      this.teleportation = null;
    }
  }

  /**
   * Initialize VR support detection
   */
  async init() {
    // Check if WebXR is available
    if (!navigator.xr) {
      console.log('WebXR not supported in this browser');
      this.vrSupported = false;
      return;
    }

    // Check if immersive-vr session is supported
    try {
      const supported = await navigator.xr.isSessionSupported('immersive-vr');
      this.vrSupported = supported;
      
      if (supported) {
        console.log('WebXR VR is supported');
        // Enable WebXR on renderer
        this.renderer.xr.enabled = true;
        this.renderer.xr.setReferenceSpaceType('local-floor');
      } else {
        console.log('Immersive VR not supported on this device');
      }
    } catch (error) {
      console.error('Error checking WebXR support:', error);
      this.vrSupported = false;
    }
  }

  /**
   * Check if VR is available
   * @returns {boolean}
   */
  isVRAvailable() {
    return this.vrSupported;
  }

  /**
   * Enter VR mode
   * @returns {Promise<boolean>} Success status
   */
  async enterVR() {
    if (!this.vrSupported) {
      console.error('VR is not supported');
      this.showVRError('VR is not supported on this device or browser');
      return false;
    }

    if (this.isVRActive) {
      console.warn('Already in VR mode');
      return true;
    }

    // Check if we're in a secure context (HTTPS required except localhost)
    if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      console.error('WebXR requires HTTPS (except localhost)');
      this.showVRError('WebXR requires HTTPS. Please access this site via HTTPS.');
      return false;
    }

    try {
      // Request immersive VR session
      this.xrSession = await navigator.xr.requestSession('immersive-vr', {
        requiredFeatures: ['local-floor'],
        optionalFeatures: ['hand-tracking', 'bounded-floor']
      });

      // Set the XR session on the renderer first
      await this.renderer.xr.setSession(this.xrSession);
      
      // IMMEDIATELY set VR scene offset (synchronously, before any frames render)
      // This prevents the user from seeing the origin position
      this.setVRStartingPosition(this.vrCameraPreset);
      
      this.isVRActive = true;

      // Immediately initialize controllers so laser pointers are created right away
      try {
        if (this.controllers && this.xrSession) {
          this.controllers.init(this.xrSession);
          console.log('VRControllers: Initialized immediately on enterVR');
        }
      } catch (error) {
        console.error('Failed to initialize controllers immediately on enterVR:', error);
      }
      
      // Disable OrbitControls in VR (head tracking replaces it)
      if (this.controls) {
        this.controls.enabled = false;
      }
      
      // Store original animation loop if not already stored
      // The WebXRManager will handle the render loop automatically
      
      // Hide 2D UI panels when entering VR
      this.hideUI();
      
      // Setup session end handler
      this.xrSession.addEventListener('end', () => {
        this.onSessionEnd();
      });
      
      // Initialize other VR features after session is established
      // Use a small delay to ensure VR session is fully ready
      setTimeout(() => {
        requestAnimationFrame(() => {
          this.initVRComponents();
          
          // Ensure any objects added to scene after offset group creation are moved to offset group
          this.ensureObjectsInOffsetGroup();
        });
      }, 100);
      
      console.log('Entered VR mode');
      this.triggerVREnter();
      
      return true;
    } catch (error) {
      console.error('Failed to enter VR:', error);
      this.isVRActive = false;
      
      // Show user-friendly error message
      let errorMessage = 'Failed to enter VR mode';
      if (error.name === 'NotSupportedError') {
        errorMessage = 'VR not available on this device';
      } else if (error.name === 'SecurityError') {
        errorMessage = 'WebXR requires HTTPS (except localhost)';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      this.showVRError(errorMessage);
      return false;
    }
  }

  /**
   * Exit VR mode
   */
  exitVR() {
    if (!this.isVRActive || !this.xrSession) {
      return;
    }

    try {
      // End the XR session
      this.xrSession.end();
    } catch (error) {
      console.error('Error ending VR session:', error);
      // Force cleanup even if end() fails
      this.onSessionEnd();
    }
  }

  /**
   * Initialize VR components after session starts
   * Initializes elements asynchronously with delays to improve performance
   * @private
   */
  initVRComponents() {
    // Lazy-load VR features if not already initialized
    // This ensures inputManager is created before we try to initialize it
    if (!this.presetNavigation || !this.performance || !this.inputManager) {
      this.initVRFeatures();
    }
    
    // Initialize with staggered delays to prevent frame drops
    
    // Immediate: Core performance settings (no visual impact)
    try {
      if (this.performance) {
        this.performance.enableVROptimization();
      }
    } catch (error) {
      console.error('Failed to enable performance optimization:', error);
    }
    
    try {
      if (this.qualitySettings) {
        this.qualitySettings.applyPreset('high');
      }
    } catch (error) {
      console.error('Failed to apply quality settings:', error);
    }
    
    // Short delay (100ms): Controllers and laser rays
    setTimeout(() => {
      if (!this.isVRActive || !this.xrSession) return;
      
      try {
        if (this.controllers && this.xrSession) {
          this.controllers.init(this.xrSession);
          console.log('VRControllers: Initialized (delayed)');
        }
      } catch (error) {
        console.error('Failed to initialize controllers:', error);
      }
    }, 100);
    
    // Medium delay (200ms): Hand tracking
    setTimeout(() => {
      if (!this.isVRActive || !this.xrSession) return;
      
      try {
        if (this.handTracking && this.xrSession) {
          this.handTracking.init(this.xrSession).catch(err => {
            console.warn('Hand tracking initialization failed:', err);
          });
          console.log('VRHandTracking: Initialized (delayed)');
        }
      } catch (error) {
        console.error('Failed to initialize hand tracking:', error);
      }
    }, 200);
    
    // Medium delay (300ms): Input manager and teleportation inputs
    setTimeout(() => {
      if (!this.isVRActive || !this.xrSession) return;
      
      // Ensure inputManager exists before initializing
      if (!this.inputManager) {
        // Initialize VR features if not already done
        if (!this.presetNavigation || !this.performance) {
          this.initVRFeatures();
        }
      }
      
      try {
        if (this.inputManager && this.xrSession) {
          this.inputManager.init(this.xrSession);
          console.log('VRInputManager: Initialized (delayed)');
        } else {
          console.warn('VRInputManager: Not available for initialization');
        }
      } catch (error) {
        console.error('Failed to initialize input manager:', error);
        // Retry initialization
        setTimeout(() => {
          if (this.inputManager && this.xrSession && !this.inputManager.isReady()) {
            try {
              this.inputManager.init(this.xrSession);
            } catch (retryError) {
              console.error('VRInputManager: Retry initialization failed:', retryError);
            }
          }
        }, 500);
      }
      
      try {
        // Setup teleportation inputs
        if (this.teleportation && this.controllers) {
          // Right controller trigger to teleport
          this.controllers.onSelectStart((event, hand) => {
            // Don't teleport if interacting with UI/Objects
            if (this.inputManager && this.inputManager.getHoveredObject()) return;
            
            if (hand === 'right') this.teleportation.startTeleport('controller', 'right');
          });
          this.controllers.onSelectEnd((event, hand) => {
            if (hand === 'right') this.teleportation.executeTeleport();
          });
        }
        
        if (this.teleportation && this.handTracking) {
          // Right hand pinch to teleport
          this.handTracking.onPinchStart((hand) => {
            // Don't teleport if interacting with UI/Objects
            if (this.inputManager && this.inputManager.getHoveredObject()) return;
            
            if (hand === 'right') this.teleportation.startTeleport('hand', 'right');
          });
          this.handTracking.onPinchEnd((hand) => {
            if (hand === 'right') this.teleportation.executeTeleport();
          });
        }
      } catch (error) {
        console.error('Failed to setup teleportation inputs:', error);
      }
    }, 300);
    
    // Longer delay (500ms): VR UI panels and preset indicators (teleportation locations)
    setTimeout(() => {
      if (!this.isVRActive || !this.xrSession) return;
      
      try {
        // Initialize VR UI panels
        this.initVRUI();
        console.log('VR UI: Initialized (delayed)');
      } catch (error) {
        console.error('Failed to initialize VR UI:', error);
      }
      
      try {
        // Create preset indicators (teleportation locations)
        if (this.presetNavigation) {
          this.presetNavigation.createPresetIndicators(this.scene);
          console.log('Preset indicators: Created (delayed)');
        }
      } catch (error) {
        console.error('Failed to create preset indicators:', error);
      }
    }, 500);
  }

  /**
   * Initialize VR UI panels
   * @private
   */
  initVRUI() {
    // VR menu panels removed - no longer creating playback or settings panels
    this.playbackPanel = null;
    this.settingsPanel = null;
  }

  /**
   * Handle session end
   * @private
   */
  onSessionEnd() {
    console.log('VR session ended');
    
    this.isVRActive = false;
    
    // Cleanup VR components
    this.cleanupVRComponents();
    
    this.xrSession = null;
    
    // Reset VR scene offset
    this.resetVRSceneOffset();
    
    // Re-enable OrbitControls
    if (this.controls) {
      this.controls.enabled = true;
    }
    
    // Show UI panels again
    this.showUI();
    
    // Trigger exit callbacks
    this.triggerVRExit();
  }

  /**
   * Cleanup VR components
   * @private
   */
  cleanupVRComponents() {
    // Disable performance optimization
    if (this.performance) {
      this.performance.disableVROptimization();
    }
    
    // Remove preset indicators
    if (this.presetNavigation) {
      this.presetNavigation.clearPresetIndicators();
    }
    
    // Dispose controllers
    if (this.controllers) {
      this.controllers.dispose();
    }
    
    // Dispose hand tracking
    if (this.handTracking) {
      this.handTracking.dispose();
    }
    
    // Dispose input manager
    if (this.inputManager) {
      this.inputManager.dispose();
    }
    
    // Dispose teleportation
    if (this.teleportation) {
      this.teleportation.dispose();
    }
    
    // VR menu panels removed - no cleanup needed
  }

  /**
   * Update VR systems (call each frame)
   */
  update() {
    if (!this.isVRActive) return;
    
    try {
      // Update performance monitoring
      if (this.performance) {
        this.performance.update();
      }
    } catch (error) {
      console.error('Error updating VR performance:', error);
    }
    
    try {
      // Update controllers
      if (this.controllers) {
        this.controllers.update();
      }
    } catch (error) {
      console.error('Error updating controllers:', error);
    }
    
    try {
      // Update hand tracking
      if (this.handTracking) {
        this.handTracking.update();
      }
    } catch (error) {
      console.error('Error updating hand tracking:', error);
    }
    
    try {
      // Update unified input manager (Phase 1)
      if (this.inputManager) {
        this.inputManager.update();
      }
    } catch (error) {
      console.error('Error updating input manager:', error);
    }
    
    try {
      // Update teleportation
      if (this.teleportation) {
        this.teleportation.update();
      }
    } catch (error) {
      console.error('Error updating teleportation:', error);
    }
    
    
    // VR menu panels removed - no longer updating
  }

  /**
   * Prepare VR scene offset group (before entering VR to avoid origin flash)
   * @param {string} presetName - Name of the preset to use
   * @private
   */
  prepareVRSceneOffset(presetName = DEFAULT_VR_CAMERA_PRESET) {
    const preset = vrCameraPresets[presetName] || vrCameraPresets[DEFAULT_VR_CAMERA_PRESET];
    
    if (!preset) {
      console.warn('VR camera preset not found:', presetName);
      return;
    }
    
    // Create scene offset group if it doesn't exist
    if (!this.vrSceneOffset) {
      // Create a wrapper group for all scene content
      this.vrSceneOffset = new THREE.Group();
      this.vrSceneOffset.name = 'VRSceneOffset';
      
      // Store original scene children and move them to offset group
      // EXCEPT controllers and hands - they must stay in scene root to track relative to VR origin
      const children = [...this.scene.children];
      children.forEach(child => {
        // Skip the offset group itself if it exists
        if (child !== this.vrSceneOffset) {
          // Don't move controllers or hands - they track relative to VR origin
          const isController = child.userData && (child.userData.hand || child.userData.isController);
          const isHand = child.userData && (child.userData.handedness || child.userData.isHand);
          const isControllerRay = child.name && child.name.includes('ControllerRay');
          
          if (!isController && !isHand && !isControllerRay) {
            this.scene.remove(child);
            this.vrSceneOffset.add(child);
          }
        }
      });
      
      // Add offset group to scene
      this.scene.add(this.vrSceneOffset);
    }
    
    // Pre-calculate and set offset immediately (before VR session starts)
    const offsetX = -preset.position.x;
    const offsetY = -preset.position.y;
    const offsetZ = -preset.position.z;
    
    // Set the offset position immediately
    this.vrSceneOffset.position.set(offsetX, offsetY, offsetZ);
  }

  /**
   * Set VR starting position by offsetting the scene
   * In WebXR, we offset the scene relative to the VR origin to position the user
   * This is called IMMEDIATELY when entering VR to prevent origin flash
   * @param {string} presetName - Name of the preset to use
   * @private
   */
  setVRStartingPosition(presetName = DEFAULT_VR_CAMERA_PRESET) {
    const preset = vrCameraPresets[presetName] || vrCameraPresets[DEFAULT_VR_CAMERA_PRESET];
    
    if (!preset) {
      console.warn('VR camera preset not found:', presetName);
      return;
    }
    
    // Calculate offset immediately
    const offsetX = -preset.position.x;
    const offsetY = -preset.position.y;
    const offsetZ = -preset.position.z;
    
    // Create scene offset group if it doesn't exist and set position IMMEDIATELY
    // This must happen synchronously to prevent origin flash
    if (!this.vrSceneOffset) {
      // Create wrapper group for all scene content
      this.vrSceneOffset = new THREE.Group();
      this.vrSceneOffset.name = 'VRSceneOffset';
      
      // Set position IMMEDIATELY before doing anything else (prevents origin flash)
      this.vrSceneOffset.position.set(offsetX, offsetY, offsetZ);
      
      // Now move all scene children into offset group
      // Children will inherit the offset position immediately
      // EXCEPT controllers and hands - they must stay in scene root to track relative to VR origin
      const children = [...this.scene.children];
      children.forEach(child => {
        if (child !== this.vrSceneOffset) {
          // Don't move controllers or hands - they track relative to VR origin
          const isController = child.userData && child.userData.hand;
          const isHand = child.userData && child.userData.handedness;
          const isControllerRay = child.name && child.name.includes('ControllerRay');
          
          if (!isController && !isHand && !isControllerRay) {
            this.scene.remove(child);
            this.vrSceneOffset.add(child);
          }
        }
      });
      
      // Add offset group to scene (position already set at correct offset)
      this.scene.add(this.vrSceneOffset);
    } else {
      // Group already exists, update position immediately
      this.vrSceneOffset.position.set(offsetX, offsetY, offsetZ);
    }
    
    // Apply rotation offset - rotate scene opposite to desired view direction
    // For WebXR, we typically don't rotate the scene, but adjust if needed
    if (preset.rotation && false) { // Disabled for now - position only
      const rotationX = THREE.MathUtils.degToRad(preset.rotation.x);
      const rotationY = THREE.MathUtils.degToRad(preset.rotation.y);
      const rotationZ = THREE.MathUtils.degToRad(preset.rotation.z);
      this.vrSceneOffset.rotation.set(rotationX, rotationY, rotationZ);
    }
    
    console.log('VR starting position set:', {
      preset: presetName,
      sceneOffset: { x: offsetX.toFixed(2), y: offsetY.toFixed(2), z: offsetZ.toFixed(2) },
      userPosition: preset.position,
      target: preset.target
    });
  }

  /**
   * Reset VR scene offset (restore original scene layout)
   * @private
   */
  resetVRSceneOffset() {
    if (this.vrSceneOffset) {
      // Move all children back to scene
      const children = [...this.vrSceneOffset.children];
      children.forEach(child => {
        this.vrSceneOffset.remove(child);
        this.scene.add(child);
      });
      
      // Remove offset group
      this.scene.remove(this.vrSceneOffset);
      this.vrSceneOffset = null;
      
      console.log('VR scene offset reset');
    }
  }

  /**
   * Add object to scene - automatically handles VR offset group
   * Use this method instead of scene.add() to ensure objects are in the correct parent
   * @param {THREE.Object3D} object - Object to add to scene
   */
  addToScene(object) {
    if (!object) return;
    
    // If VR offset group exists, add to it; otherwise add to scene
    if (this.vrSceneOffset) {
      // Remove from current parent if any
      if (object.parent) {
        object.parent.remove(object);
      }
      this.vrSceneOffset.add(object);
    } else {
      // Remove from current parent if any
      if (object.parent) {
        object.parent.remove(object);
      }
      this.scene.add(object);
    }
  }

  /**
   * Ensure all scene children are in the offset group (if VR is active)
   * Call this after adding objects to scene when VR is active
   * @private
   */
  ensureObjectsInOffsetGroup() {
    if (!this.vrSceneOffset || !this.isVRActive) return;
    
    // Move any objects in scene (except offset group itself) to offset group
    // EXCEPT controllers and hands - they must stay in scene root to track relative to VR origin
    const children = [...this.scene.children];
    children.forEach(child => {
      if (child !== this.vrSceneOffset && child.parent === this.scene) {
        // Don't move controllers or hands - they track relative to VR origin
        const isController = child.userData && (child.userData.hand || child.userData.isController);
        const isHand = child.userData && (child.userData.handedness || child.userData.isHand);
        const isControllerRay = child.name && child.name.includes('ControllerRay');
        
        if (!isController && !isHand && !isControllerRay) {
          this.scene.remove(child);
          this.vrSceneOffset.add(child);
        }
      }
    });
  }

  /**
   * Set VR camera preset
   * @param {string} presetName - Name of the preset to use
   */
  setVRCameraPreset(presetName) {
    this.vrCameraPreset = presetName;
    
    // If already in VR, update position immediately
    if (this.isVRActive) {
      this.setVRStartingPosition(presetName);
    }
  }

  /**
   * Hide 2D UI elements when in VR
   * @private
   */
  hideUI() {
    // Hide settings panel
    const settingsPanel = document.getElementById('settingsPanel');
    if (settingsPanel) {
      settingsPanel.dataset.vrHidden = 'true';
      settingsPanel.style.display = 'none';
    }
    
    // Hide style/shader panel
    const styleShaderPanel = document.getElementById('styleShaderPanel');
    if (styleShaderPanel) {
      styleShaderPanel.dataset.vrHidden = 'true';
      styleShaderPanel.style.display = 'none';
    }
    
    // Hide playback menu
    const playbackMenu = document.getElementById('playbackMenu');
    if (playbackMenu) {
      playbackMenu.dataset.vrHidden = 'true';
      playbackMenu.style.display = 'none';
    }
    
    // Hide file info
    const fileInfoTop = document.getElementById('fileInfoTop');
    if (fileInfoTop) {
      fileInfoTop.dataset.vrHidden = 'true';
      fileInfoTop.style.display = 'none';
    }
    
    // Hide burger menu
    const settingsPanelBurger = document.getElementById('settingsPanelBurger');
    if (settingsPanelBurger) {
      settingsPanelBurger.dataset.vrHidden = 'true';
      settingsPanelBurger.style.display = 'none';
    }
    
    // Add VR overlay indicator (simple exit button will be added in future)
    this.createVROverlay();
  }

  /**
   * Show 2D UI elements after exiting VR
   * @private
   */
  showUI() {
    // Restore settings panel if it was visible before
    const settingsPanel = document.getElementById('settingsPanel');
    if (settingsPanel && settingsPanel.dataset.vrHidden === 'true') {
      settingsPanel.style.display = '';
      delete settingsPanel.dataset.vrHidden;
    }
    
    // Restore style/shader panel
    const styleShaderPanel = document.getElementById('styleShaderPanel');
    if (styleShaderPanel && styleShaderPanel.dataset.vrHidden === 'true') {
      styleShaderPanel.style.display = '';
      delete styleShaderPanel.dataset.vrHidden;
    }
    
    // Restore playback menu
    const playbackMenu = document.getElementById('playbackMenu');
    if (playbackMenu && playbackMenu.dataset.vrHidden === 'true') {
      playbackMenu.style.display = '';
      delete playbackMenu.dataset.vrHidden;
    }
    
    // Restore file info
    const fileInfoTop = document.getElementById('fileInfoTop');
    if (fileInfoTop && fileInfoTop.dataset.vrHidden === 'true') {
      fileInfoTop.style.display = '';
      delete fileInfoTop.dataset.vrHidden;
    }
    
    // Restore burger menu
    const settingsPanelBurger = document.getElementById('settingsPanelBurger');
    if (settingsPanelBurger && settingsPanelBurger.dataset.vrHidden === 'true') {
      settingsPanelBurger.style.display = '';
      delete settingsPanelBurger.dataset.vrHidden;
    }
    
    // Remove VR overlay
    this.removeVROverlay();
  }

  /**
   * Create minimal VR overlay (for future exit button)
   * @private
   */
  createVROverlay() {
    // Create a simple overlay container for future VR UI
    let overlay = document.getElementById('vrOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'vrOverlay';
      overlay.className = 'vr-overlay';
      document.body.appendChild(overlay);
    }
  }

  /**
   * Remove VR overlay
   * @private
   */
  removeVROverlay() {
    const overlay = document.getElementById('vrOverlay');
    if (overlay) {
      overlay.remove();
    }
  }

  /**
   * Show VR error message
   * @private
   */
  showVRError(message) {
    // Create or update error message element
    let errorEl = document.getElementById('vrErrorMessage');
    if (!errorEl) {
      errorEl = document.createElement('div');
      errorEl.id = 'vrErrorMessage';
      errorEl.className = 'vr-error-message';
      document.body.appendChild(errorEl);
    }
    
    errorEl.textContent = message;
    errorEl.style.display = 'block';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      if (errorEl) {
        errorEl.style.display = 'none';
      }
    }, 5000);
  }

  /**
   * Register callback for VR enter event
   * @param {Function} callback
   */
  onVREnter(callback) {
    if (typeof callback === 'function') {
      this.onVREnterCallbacks.push(callback);
    }
  }

  /**
   * Register callback for VR exit event
   * @param {Function} callback
   */
  onVRExit(callback) {
    if (typeof callback === 'function') {
      this.onVRExitCallbacks.push(callback);
    }
  }

  /**
   * Trigger VR enter callbacks
   * @private
   */
  triggerVREnter() {
    this.onVREnterCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('Error in VR enter callback:', error);
      }
    });
  }

  /**
   * Trigger VR exit callbacks
   * @private
   */
  triggerVRExit() {
    this.onVRExitCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('Error in VR exit callback:', error);
      }
    });
  }

  /**
   * Get current VR session state
   * @returns {boolean}
   */
  getIsVRActive() {
    return this.isVRActive;
  }

  /**
   * Set playback controls reference
   * @param {PlaybackControls} playbackControls
   */
  setPlaybackControls(playbackControls) {
    this.playbackControlsRef = playbackControls;
    if (this.playbackPanel) {
      this.playbackPanel.setPlaybackControls(playbackControls);
    }
  }

  /**
   * Set video element reference
   * @param {HTMLVideoElement} videoElement
   */
  setVideoElement(videoElement) {
    this.videoElementRef = videoElement;
    if (this.playbackPanel) {
      this.playbackPanel.setVideoElement(videoElement);
    }
  }

  /**
   * Set settings panel reference
   * @param {SettingsPanel} settingsPanel
   */
  setSettingsPanel(settingsPanel) {
    this.settingsPanelRef = settingsPanel;
  }

  /**
   * Teleport to preset
   * @param {string} presetName
   */
  teleportToPreset(presetName) {
    if (this.presetNavigation) {
      this.presetNavigation.teleportToPreset(presetName);
    }
  }

  /**
   * Get available presets
   * @returns {string[]}
   */
  getAvailablePresets() {
    return this.presetNavigation ? this.presetNavigation.getAvailablePresets() : [];
  }

  /**
   * Set floor mesh reference (kept for potential future use)
   * @param {THREE.Mesh} floorMesh
   */
  setFloorMesh(floorMesh) {
    this.floorMeshRef = floorMesh;
    if (this.teleportation) {
      this.teleportation.setFloorMesh(floorMesh);
    }
  }

  /**
   * Toggle VR menu visibility
   * @deprecated VR menu has been removed
   */
  toggleVRMenu() {
    // VR menu removed - method kept for compatibility but does nothing
  }

  /**
   * Wait for input manager to be ready
   * Helper method for UI/navigation elements to reliably wait for inputManager initialization
   * @param {Function} callback - Callback to execute when inputManager is ready
   * @param {number} timeout - Timeout in milliseconds (default: 10000)
   * @returns {Promise<VRInputManager>} Promise that resolves with inputManager when ready
   * 
   * @example
   * // Using promise
   * vrManager.waitForInputManager().then(inputManager => {
   *   inputManager.registerInteractiveObject(myButton);
   * });
   * 
   * @example
   * // Using callback
   * vrManager.waitForInputManager((inputManager) => {
   *   inputManager.registerInteractiveObject(myButton);
   * });
   */
  async waitForInputManager(callback, timeout = 10000) {
    // Ensure inputManager is created (lazy initialization)
    if (!this.inputManager) {
      // Initialize VR features if not already done
      if (!this.presetNavigation || !this.performance) {
        this.initVRFeatures();
      }
      
      // Wait a bit for inputManager to be created
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (!this.inputManager) {
      const error = new Error('VRInputManager not available');
      console.error('VRManager.waitForInputManager:', error);
      if (callback) callback(null);
      return Promise.reject(error);
    }
    
    // Wait for inputManager to be ready
    try {
      await this.inputManager.waitForReady();
      
      if (callback) {
        callback(this.inputManager);
      }
      
      return Promise.resolve(this.inputManager);
    } catch (error) {
      console.error('VRManager.waitForInputManager: Error waiting for ready state:', error);
      if (callback) callback(null);
      return Promise.reject(error);
    }
  }

}



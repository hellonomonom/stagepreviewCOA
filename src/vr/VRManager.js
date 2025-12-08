/**
 * VRManager - Minimal VR Manager
 * Handles WebXR VR sessions with proper initialization order
 */

import * as THREE from 'three';
import { vrCameraPresets, DEFAULT_VR_CAMERA_PRESET } from '../config/vrCameraPresets.js';
import { VRControllers } from './VRControllers.js';
import { VRHandTracking } from './VRHandTracking.js';
import { VRTeleportation } from './VRTeleportation.js';
import { VRPresetNavigation } from './VRPresetNavigation.js';
import { VRMenu } from './VRMenu.js';

export class VRManager {
  constructor(renderer, scene, camera, controls) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.controls = controls;
    
    this.xrSession = null;
    this.isVRActive = false;
    this.vrSupported = false;
    
    // VR scene offset for positioning
    this.vrSceneOffset = null;
    this.vrCameraPreset = DEFAULT_VR_CAMERA_PRESET;
    
    // VR systems
    this.controllers = null;
    this.handTracking = null;
    this.teleportation = null;
    this.presetNavigation = null;
    this.menu = null;
    
    // External references
    this.floorMeshRef = null;
    
    // Callbacks
    this.onVREnterCallbacks = [];
    this.onVRExitCallbacks = [];
    
    // Initialize WebXR support check
    this.init();
  }

  /**
   * Initialize WebXR support
   */
  init() {
    if ('xr' in navigator) {
      navigator.xr.isSessionSupported('immersive-vr').then((supported) => {
        this.vrSupported = supported;
        if (supported) {
          console.log('VRManager: WebXR VR is supported');
        } else {
          console.log('VRManager: WebXR VR is not supported');
        }
      }).catch((error) => {
        console.error('VRManager: Error checking VR support:', error);
        this.vrSupported = false;
      });
    } else {
      console.log('VRManager: WebXR not available');
      this.vrSupported = false;
    }
  }

  /**
   * Check if VR is available
   */
  isVRAvailable() {
    return this.vrSupported;
  }

  /**
   * Enter VR mode
   */
  async enterVR() {
    if (!this.vrSupported) {
      console.error('VR is not supported');
      return false;
    }

    if (this.isVRActive) {
      console.warn('Already in VR mode');
      return true;
    }

    try {
      // Request VR session
      this.xrSession = await navigator.xr.requestSession('immersive-vr', {
        requiredFeatures: ['local-floor'],
        optionalFeatures: ['hand-tracking', 'bounded-floor']
      });

      // Set XR session on renderer
      await this.renderer.xr.setSession(this.xrSession);
      
      this.isVRActive = true;
      
      // Disable OrbitControls in VR
      if (this.controls) {
        this.controls.enabled = false;
      }
      
      // Setup session end handler
      this.xrSession.addEventListener('end', () => {
        this.onSessionEnd();
      });
      
      // Set VR starting position FIRST (creates scene offset)
      this.setVRStartingPosition(this.vrCameraPreset);
      
      // Wait a frame for scene offset to be ready
      await new Promise(resolve => requestAnimationFrame(resolve));
      
      // Initialize VR systems in proper order (after scene offset is ready)
      await this.initializeVRSystems();
      
      console.log('VRManager: Entered VR mode');
      this.triggerVREnter();
      
      return true;
    } catch (error) {
      console.error('VRManager: Failed to enter VR:', error);
      this.isVRActive = false;
      return false;
    }
  }

  /**
   * Initialize VR systems in proper order
   */
  async initializeVRSystems() {
    console.log('VRManager: Initializing VR systems...');
    
    // Step 1: Create systems (no session needed yet)
    if (!this.controllers) {
      this.controllers = new VRControllers(this.renderer, this.scene, this.camera);
    }
    
    if (!this.handTracking) {
      this.handTracking = new VRHandTracking(this.renderer, this.scene, this.camera);
    }
    
    if (!this.presetNavigation) {
      this.presetNavigation = new VRPresetNavigation(this);
    }
    
    if (!this.teleportation) {
      this.teleportation = new VRTeleportation(
        this.renderer,
        this.scene,
        this.camera,
        this.controllers,
        this.handTracking,
        this.floorMeshRef,
        this
      );
    }
    
    // Step 2: Initialize controllers (synchronous)
    if (this.controllers && this.xrSession) {
      this.controllers.init(this.xrSession);
      console.log('VRManager: Controllers initialized');
      await new Promise(resolve => requestAnimationFrame(resolve));
    }
    
    // Step 3: Initialize hand tracking (async)
    if (this.handTracking && this.xrSession) {
      try {
        await this.handTracking.init(this.xrSession);
        console.log('VRManager: Hand tracking initialized');
        await new Promise(resolve => requestAnimationFrame(resolve));
      } catch (error) {
        console.warn('VRManager: Hand tracking not available:', error);
      }
    }
    
    // Step 4: Setup teleportation floor mesh
    if (this.teleportation && this.floorMeshRef) {
      this.teleportation.setFloorMesh(this.floorMeshRef);
      console.log('VRManager: Teleportation floor mesh set');
    }
    
    // Step 5: Setup input handlers (AFTER everything is initialized)
    this.setupInputHandlers();
    console.log('VRManager: Input handlers setup complete');
    
    // Step 6: Create preset indicators
    if (this.presetNavigation) {
      this.presetNavigation.createPresetIndicators(this.scene);
      console.log('VRManager: Preset indicators created');
    }
    
    // Step 7: Create floating menu (AFTER all systems are fully initialized)
    // Menu must be created after controllers are initialized and ready for raycasting
    // Use a delay to ensure everything is ready
    setTimeout(() => {
      if (!this.isVRActive || !this.xrSession) return;
      
      if (!this.menu && this.vrSceneOffset && this.controllers) {
        this.menu = new VRMenu(this.camera, this);
        const menuGroup = this.menu.getGroup();
        
        // Position menu in front of user at eye level
        const preset = vrCameraPresets[this.vrCameraPreset];
        const presetY = preset ? preset.position.y : 1.6;
        // Offset Y is negative of preset Y, so to get world Y = 0, we need menu Y = presetY
        menuGroup.position.set(0, presetY, -1.5);
        
        // Add to scene offset group (not directly to scene)
        this.vrSceneOffset.add(menuGroup);
        
        console.log('VRManager: Floating menu created and added to scene offset');
        console.log('VRManager: Menu local position:', menuGroup.position);
        console.log('VRManager: Menu visible:', menuGroup.visible);
        console.log('VRManager: VR scene offset position:', this.vrSceneOffset.position);
        console.log('VRManager: Controllers available:', !!this.controllers);
        console.log('VRManager: Hand tracking available:', !!this.handTracking);
        
        // Force menu to be visible
        menuGroup.visible = true;
        menuGroup.traverse((child) => {
          if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) {
            child.visible = true;
            child.frustumCulled = false; // Don't cull, always render
          }
        });
        
        // Log menu world position after adding to scene
        const worldPos = new THREE.Vector3();
        menuGroup.getWorldPosition(worldPos);
        console.log('VRManager: Menu world position:', worldPos);
        console.log('VRManager: Menu initialization complete - raycasting should work now');
      } else {
        if (!this.vrSceneOffset) {
          console.warn('VRManager: Cannot create menu - scene offset not ready');
        }
        if (!this.controllers) {
          console.warn('VRManager: Cannot create menu - controllers not ready');
        }
      }
    }, 500); // Wait 500ms after all systems are initialized to ensure controllers are ready
    
    console.log('VRManager: All VR systems initialized');
  }

  /**
   * Setup input handlers for teleportation and preset cycling
   */
  setupInputHandlers() {
    // Right controller/hand: Teleportation (or menu interaction if hovering)
    if (this.controllers) {
      this.controllers.onSelectStart((event, hand) => {
        // Check if hovering menu button first
        if (this.menu && this.checkMenuInteraction('controller', hand)) {
          return; // Menu handled the interaction
        }
        
        if (hand === 'right' && this.teleportation) {
          console.log('VRManager: Right controller trigger - start teleport');
          this.teleportation.startTeleport('controller', 'right');
        }
      });
      
      this.controllers.onSelectEnd((event, hand) => {
        if (hand === 'right' && this.teleportation && this.teleportation.isTeleporting) {
          console.log('VRManager: Right controller release - execute teleport');
          this.teleportation.executeTeleport();
        }
      });
    }
    
    if (this.handTracking) {
      this.handTracking.onPinchStart((hand) => {
        // Check if hovering menu button first
        if (this.menu && this.checkMenuInteraction('hand', hand)) {
          return; // Menu handled the interaction
        }
        
        if (hand === 'right' && this.teleportation) {
          console.log('VRManager: Right hand pinch - start teleport');
          this.teleportation.startTeleport('hand', 'right');
        }
      });
      
      this.handTracking.onPinchEnd((hand) => {
        if (hand === 'right' && this.teleportation && this.teleportation.isTeleporting) {
          console.log('VRManager: Right hand release - execute teleport');
          this.teleportation.executeTeleport();
        }
      });
    }
    
    // Left controller/hand: Cycle presets
    if (this.controllers) {
      this.controllers.onSelectStart((event, hand) => {
        if (hand === 'left' && this.presetNavigation) {
          console.log('VRManager: Left controller trigger - cycle preset');
          this.cycleCameraPreset();
        }
      });
    }
    
    if (this.handTracking) {
      this.handTracking.onPinchStart((hand) => {
        if (hand === 'left' && this.presetNavigation) {
          console.log('VRManager: Left hand pinch - cycle preset');
          this.cycleCameraPreset();
        }
      });
    }
  }

  /**
   * Check if user is interacting with menu
   */
  checkMenuInteraction(inputType, hand) {
    if (!this.menu || !this.controllers) return false;
    
    // Get controller ray
    const controller = hand === 'left' ? this.controllers.leftController : this.controllers.rightController;
    if (!controller) return false;
    
    // Get ray from controller
    const ray = this.controllers.getControllerRay(hand);
    if (!ray || !ray.origin || !ray.direction) return false;
    
    // Create raycaster from controller ray
    const raycaster = new THREE.Raycaster();
    raycaster.set(ray.origin, ray.direction);
    
    // Check menu button intersection
    const button = this.menu.getButtonByRay(raycaster);
    if (button) {
      console.log('VRManager: Menu button clicked:', button.label);
      this.menu.handleButtonClick(button);
      return true;
    }
    
    return false;
  }

  /**
   * Cycle to next camera preset
   */
  cycleCameraPreset() {
    if (!this.presetNavigation) return;
    
    const presets = this.presetNavigation.getAvailablePresets();
    if (!presets || presets.length === 0) return;
    
    const currentPreset = this.presetNavigation.getCurrentPreset();
    const currentIndex = presets.indexOf(currentPreset);
    const nextIndex = (currentIndex + 1) % presets.length;
    const nextPreset = presets[nextIndex];
    
    this.presetNavigation.teleportToPreset(nextPreset, true);
    console.log('VRManager: Cycling to preset:', nextPreset);
  }

  /**
   * Exit VR mode
   */
  exitVR() {
    if (!this.isVRActive || !this.xrSession) {
      return;
    }

    try {
      this.xrSession.end();
    } catch (error) {
      console.error('VRManager: Error ending VR session:', error);
      this.onSessionEnd();
    }
  }

  /**
   * Handle session end
   */
  onSessionEnd() {
    console.log('VRManager: VR session ended');
    
    this.isVRActive = false;
    this.xrSession = null;
    
    // Reset VR scene offset
    this.resetVRSceneOffset();
    
    // Re-enable OrbitControls
    if (this.controls) {
      this.controls.enabled = true;
    }
    
    // Cleanup
    this.cleanupVRComponents();
    
    // Trigger exit callbacks
    this.triggerVRExit();
  }

  /**
   * Cleanup VR components
   */
  cleanupVRComponents() {
    // Dispose menu
    if (this.menu) {
      this.menu.dispose();
      this.menu = null;
    }
    
    // Controllers and hand tracking cleanup is handled by their dispose methods
    // which are called automatically when session ends
  }

  /**
   * Set VR starting position
   */
  setVRStartingPosition(presetName = DEFAULT_VR_CAMERA_PRESET) {
    const preset = vrCameraPresets[presetName];
    if (!preset) {
      console.warn('VRManager: Preset not found:', presetName);
      return;
    }
    
    // Create or update scene offset group
    if (!this.vrSceneOffset) {
      this.vrSceneOffset = new THREE.Group();
      this.scene.add(this.vrSceneOffset);
      
      // Move all existing objects to offset group
      const objectsToMove = [];
      this.scene.traverse((child) => {
        if (child !== this.vrSceneOffset && child.parent === this.scene) {
          objectsToMove.push(child);
        }
      });
      
      objectsToMove.forEach((obj) => {
        this.vrSceneOffset.add(obj);
      });
    }
    
    // Set offset position (inverse of preset position)
    const presetPos = preset.position;
    this.vrSceneOffset.position.set(-presetPos.x, -presetPos.y, -presetPos.z);
    
    console.log('VRManager: Set VR starting position:', presetName, presetPos);
  }

  /**
   * Reset VR scene offset
   */
  resetVRSceneOffset() {
    if (this.vrSceneOffset) {
      // Move objects back to scene
      const objectsToMove = [];
      this.vrSceneOffset.traverse((child) => {
        if (child !== this.vrSceneOffset && child.parent === this.vrSceneOffset) {
          objectsToMove.push(child);
        }
      });
      
      objectsToMove.forEach((obj) => {
        this.scene.add(obj);
      });
      
      this.scene.remove(this.vrSceneOffset);
      this.vrSceneOffset = null;
    }
  }

  /**
   * Update VR systems (called from animation loop)
   */
  update() {
    if (!this.isVRActive) return;
    
    try {
      // Update teleportation
      if (this.teleportation) {
        this.teleportation.update();
      }
      
      // Update menu (face camera)
      if (this.menu) {
        this.menu.update();
      }
    } catch (error) {
      console.error('VRManager: Error updating VR systems:', error);
    }
  }

  /**
   * Set floor mesh reference
   */
  setFloorMesh(floorMesh) {
    this.floorMeshRef = floorMesh;
    if (this.teleportation) {
      this.teleportation.setFloorMesh(floorMesh);
    }
  }

  /**
   * Teleport to preset
   */
  teleportToPreset(presetName) {
    if (this.presetNavigation) {
      this.presetNavigation.teleportToPreset(presetName);
    }
  }

  /**
   * Get available presets
   */
  getAvailablePresets() {
    return this.presetNavigation ? this.presetNavigation.getAvailablePresets() : [];
  }

  /**
   * Get VR active state
   */
  getIsVRActive() {
    return this.isVRActive;
  }

  /**
   * Register VR enter callback
   */
  onVREnter(callback) {
    if (typeof callback === 'function') {
      this.onVREnterCallbacks.push(callback);
    }
  }

  /**
   * Register VR exit callback
   */
  onVRExit(callback) {
    if (typeof callback === 'function') {
      this.onVRExitCallbacks.push(callback);
    }
  }

  /**
   * Trigger VR enter callbacks
   */
  triggerVREnter() {
    this.onVREnterCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('VRManager: Error in VR enter callback:', error);
      }
    });
  }

  /**
   * Trigger VR exit callbacks
   */
  triggerVRExit() {
    this.onVRExitCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('VRManager: Error in VR exit callback:', error);
      }
    });
  }

  // Compatibility methods for existing code
  setPlaybackControls(playbackControls) {
    // Not used in minimal version
  }

  setVideoElement(videoElement) {
    // Not used in minimal version
  }

  setSettingsPanel(settingsPanel) {
    // Not used in minimal version
  }

  /**
   * Add object to scene (helper for VR systems)
   */
  addToScene(object) {
    if (this.vrSceneOffset) {
      this.vrSceneOffset.add(object);
    } else {
      this.scene.add(object);
    }
  }
}

import * as THREE from 'three';

/**
 * VRControllers - Clean implementation for VR controller input
 * Handles controller tracking, ray casting, and button events
 * 
 * Design principles:
 * - Clean separation of concerns
 * - Simple API for getting controller rays
 * - Event-based button handling
 * - Automatic controller detection and setup
 */
export class VRControllers {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    
    // Controller objects (Three.js XRController instances)
    this.leftController = null;
    this.rightController = null;
    
    // XR session reference
    this.xrSession = null;
    
    // Controller state
    this.isConnected = {
      left: false,
      right: false
    };
    
    // Visual representation
    this.showRays = true;
    this.rayLength = 5;
    this.rayColor = 0x00aaff;
    this.rayOpacity = 0.8;
    
    // Event callbacks
    this.onControllerConnectedCallbacks = [];
    this.onControllerDisconnectedCallbacks = [];
    this.onSelectStartCallbacks = [];
    this.onSelectEndCallbacks = [];
    this.onSqueezeStartCallbacks = [];
    this.onSqueezeEndCallbacks = [];
    
    // Button state tracking
    this.buttonStates = {
      left: {},
      right: {}
    };
  }

  /**
   * Initialize controllers with XR session
   * @param {XRSession} xrSession
   */
  init(xrSession) {
    if (!xrSession) {
      console.warn('VRControllers: No XR session provided');
      return;
    }

    this.xrSession = xrSession;

    // Create controller spaces immediately (even if not connected yet)
    // This ensures rays are visible from the start
    this.leftController = this.renderer.xr.getController(0);
    this.rightController = this.renderer.xr.getController(1);

    // Add controllers to scene and set them up
    // Check if they are already in the scene (re-use existing)
    if (this.leftController) {
      if (!this.leftController.parent) {
        this.scene.add(this.leftController);
      }
      this.setupController(this.leftController, 'left');
    }

    if (this.rightController) {
      if (!this.rightController.parent) {
        this.scene.add(this.rightController);
      }
      this.setupController(this.rightController, 'right');
    }

    // Listen for input source changes
    xrSession.addEventListener('inputsourceschange', (event) => {
      this.handleInputSourcesChange(event);
    });

    // Check existing input sources
    this.checkInputSources(xrSession);

    // Poll for input sources for a short duration to ensure detection on first launch
    // Sometimes input sources are not immediately available in the session
    this._pollInterval = setInterval(() => {
      if (!this.xrSession) {
        this.clearPollInterval();
        return;
      }
      this.checkInputSources(this.xrSession);
      
      // Force visibility update if connected
      if (this.leftController) this.leftController.visible = true;
      if (this.rightController) this.rightController.visible = true;
      if (this.isConnected.left && this.leftController.userData.ray) this.leftController.userData.ray.visible = true;
      if (this.isConnected.right && this.rightController.userData.ray) this.rightController.userData.ray.visible = true;
      
    }, 300);

    // Stop polling after 5 seconds
    this._pollTimeout = setTimeout(() => {
      this.clearPollInterval();
    }, 5000);

    console.log('VRControllers: Initialized');
  }

  /**
   * Clear polling interval/timeouts
   * @private
   */
  clearPollInterval() {
    if (this._pollInterval) {
      clearInterval(this._pollInterval);
      this._pollInterval = null;
    }
    if (this._pollTimeout) {
      clearTimeout(this._pollTimeout);
      this._pollTimeout = null;
    }
  }

  /**
   * Setup a controller (ray, events, etc.)
   * @private
   */
  setupController(controller, hand) {
    // Check if already setup
    if (controller.userData.isSetup) {
      // Just ensure visibility
      if (controller.userData.ray) {
        controller.userData.ray.visible = true;
      }
      controller.visible = true;
      return;
    }
    
    // Create ray visualization
    if (this.showRays) {
      // Remove existing rays if any (cleanup from previous session if objects persisted)
      const existingRay = controller.getObjectByName(`ControllerRay_${hand}`);
      if (existingRay) {
        controller.remove(existingRay);
      }
      
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -this.rayLength)
      ]);

      const material = new THREE.LineBasicMaterial({
        color: this.rayColor,
        linewidth: 2,
        transparent: true,
        opacity: this.rayOpacity,
        depthTest: false,
        depthWrite: false
      });

      const ray = new THREE.Line(geometry, material);
      ray.name = `ControllerRay_${hand}`;
      ray.renderOrder = 1000;
      ray.visible = true;
      
      controller.add(ray);
      controller.userData.hand = hand;
      controller.userData.isController = true; // Mark as controller so it's not moved into scene offset
      controller.userData.ray = ray;
      
      // Ensure controller is visible
      controller.visible = true;
    }

    // Setup event listeners
    // Note: We don't remove listeners on dispose because we can't easily reference the specific bound functions
    // unless we store them. Since controllers persist, we should avoid adding duplicate listeners.
    // Ideally, we should clean up listeners in dispose()
    
    // Store bound listeners to allow removal later
    this.bindListeners(controller, hand);
    
    controller.userData.isSetup = true;
  }
  
  /**
   * Bind event listeners to controller
   * @private
   */
  bindListeners(controller, hand) {
    // Store listeners on controller userData for cleanup
    controller.userData.listeners = {
      connected: (event) => this.handleControllerConnected(event, hand),
      disconnected: (event) => this.handleControllerDisconnected(event, hand),
      selectstart: (event) => this.triggerSelectStart(event, hand),
      selectend: (event) => this.triggerSelectEnd(event, hand),
      squeezestart: (event) => this.triggerSqueezeStart(event, hand),
      squeezeend: (event) => this.triggerSqueezeEnd(event, hand)
    };
    
    Object.entries(controller.userData.listeners).forEach(([event, listener]) => {
      controller.addEventListener(event, listener);
    });
  }

  /**
   * Handle input sources change event
   * @private
   */
  handleInputSourcesChange(event) {
    // Handle added input sources
    event.added.forEach((inputSource) => {
      // Only treat as controller if it has a gamepad (not hand tracking)
      // Controllers have gamepad property, hand tracking has hand property
      const isGamepadConnected = inputSource.gamepad ? inputSource.gamepad.connected : false;
      
      if (inputSource.targetRayMode === 'tracked-pointer' && 
          inputSource.gamepad && 
          !inputSource.hand &&
          isGamepadConnected) {
        this.checkInputSource(inputSource);
      }
    });

    // Handle removed input sources
    event.removed.forEach((inputSource) => {
      // Check if this was a controller we were tracking
      // Don't need strict checks here, just if it matches handedness of a connected controller
      if (inputSource.targetRayMode === 'tracked-pointer') {
        const hand = inputSource.handedness;
        if ((hand === 'left' || hand === 'right') && this.isConnected[hand]) {
          // Verify it was actually the controller (has gamepad)
          if (inputSource.gamepad && !inputSource.hand) {
            this.isConnected[hand] = false;
            this.triggerControllerDisconnected(inputSource, hand);
          }
        }
      }
    });
  }

  /**
   * Check for input sources and connect controllers
   * @private
   */
  checkInputSources(xrSession) {
    if (!xrSession || !xrSession.inputSources) return;

    xrSession.inputSources.forEach((inputSource) => {
      // Only treat as controller if it has a gamepad (not hand tracking)
      // Controllers have gamepad property, hand tracking has hand property
      // Also ensure gamepad is connected if property exists
      const isGamepadConnected = inputSource.gamepad ? inputSource.gamepad.connected : false;
      
      if (inputSource.targetRayMode === 'tracked-pointer' && 
          inputSource.gamepad && 
          !inputSource.hand &&
          isGamepadConnected) {
        this.checkInputSource(inputSource);
      }
    });
  }

  /**
   * Check and connect a single input source
   * @private
   */
  checkInputSource(inputSource) {
    const hand = inputSource.handedness;
    
    if (hand !== 'left' && hand !== 'right') return;

    // Get the controller for this hand
    const controller = hand === 'left' ? this.leftController : this.rightController;
    
    if (!controller) {
      console.warn(`VRControllers: No controller object for ${hand} hand`);
      return;
    }

    // Mark as connected
    if (!this.isConnected[hand]) {
      this.isConnected[hand] = true;
      this.triggerControllerConnected(inputSource, hand);
    }
  }

  /**
   * Handle controller connected
   * @private
   */
  handleControllerConnected(event, hand) {
    console.log(`VRControllers: ${hand} controller connected`);
    this.isConnected[hand] = true;
  }

  /**
   * Handle controller disconnected
   * @private
   */
  handleControllerDisconnected(event, hand) {
    console.log(`VRControllers: ${hand} controller disconnected`);
    this.isConnected[hand] = false;
  }

  /**
   * Get controller ray for raycasting
   * @param {string} hand - 'left' or 'right'
   * @returns {Object|null} Ray object with origin and direction, or null if not available
   */
  getControllerRay(hand) {
    const controller = hand === 'left' ? this.leftController : this.rightController;
    
    if (!controller) {
      return null;
    }
    
    // Even if not connected yet, we can still get the ray position
    // This allows the ray to be visible before controllers are fully connected
    // The isConnected check is done in VRInputManager if needed

    // Get controller position and direction in world space
    const position = new THREE.Vector3();
    const direction = new THREE.Vector3(0, 0, -1);
    
    controller.getWorldPosition(position);
    controller.getWorldDirection(direction);
    
    // Normalize direction to ensure it's a unit vector
    direction.normalize();
    
    return {
      origin: position,
      direction: direction,
      controller: controller
    };
  }

  /**
   * Check if a controller is connected
   * @param {string} hand - 'left' or 'right'
   * @returns {boolean}
   */
  isControllerConnected(hand) {
    return this.isConnected[hand] || false;
  }

  /**
   * Get button state from gamepad
   * @param {string} hand - 'left' or 'right'
   * @param {number} buttonIndex - Button index
   * @returns {Object|null} Button state or null if not available
   */
  getButtonState(hand, buttonIndex) {
    if (!this.xrSession || !this.xrSession.inputSources) return null;

    const inputSource = this.xrSession.inputSources.find(
      src => src.handedness === hand && src.targetRayMode === 'tracked-pointer'
    );

    if (!inputSource || !inputSource.gamepad) return null;
    if (buttonIndex >= inputSource.gamepad.buttons.length) return null;

    return inputSource.gamepad.buttons[buttonIndex];
  }

  /**
   * Update controller states (call each frame)
   */
  update() {
    // Controllers are automatically updated by Three.js XR system
    // This method is here for future use (e.g., button polling)
  }

  /**
   * Register callback for controller connected event
   * @param {Function} callback - Callback function (inputSource, hand) => {}
   */
  onControllerConnected(callback) {
    this.onControllerConnectedCallbacks.push(callback);
  }

  /**
   * Register callback for controller disconnected event
   * @param {Function} callback - Callback function (inputSource, hand) => {}
   */
  onControllerDisconnected(callback) {
    this.onControllerDisconnectedCallbacks.push(callback);
  }

  /**
   * Register callback for select start event
   * @param {Function} callback - Callback function (event, hand) => {}
   */
  onSelectStart(callback) {
    this.onSelectStartCallbacks.push(callback);
  }

  /**
   * Register callback for select end event
   * @param {Function} callback - Callback function (event, hand) => {}
   */
  onSelectEnd(callback) {
    this.onSelectEndCallbacks.push(callback);
  }

  /**
   * Register callback for squeeze start event
   * @param {Function} callback - Callback function (event, hand) => {}
   */
  onSqueezeStart(callback) {
    this.onSqueezeStartCallbacks.push(callback);
  }

  /**
   * Register callback for squeeze end event
   * @param {Function} callback - Callback function (event, hand) => {}
   */
  onSqueezeEnd(callback) {
    this.onSqueezeEndCallbacks.push(callback);
  }

  /**
   * Trigger controller connected callbacks
   * @private
   */
  triggerControllerConnected(inputSource, hand) {
    this.onControllerConnectedCallbacks.forEach(callback => {
      try {
        callback(inputSource, hand);
      } catch (error) {
        console.error('Error in controller connected callback:', error);
      }
    });
  }

  /**
   * Trigger controller disconnected callbacks
   * @private
   */
  triggerControllerDisconnected(inputSource, hand) {
    this.onControllerDisconnectedCallbacks.forEach(callback => {
      try {
        callback(inputSource, hand);
      } catch (error) {
        console.error('Error in controller disconnected callback:', error);
      }
    });
  }

  /**
   * Trigger select start callbacks
   * @private
   */
  triggerSelectStart(event, hand) {
    this.onSelectStartCallbacks.forEach(callback => {
      try {
        callback(event, hand);
      } catch (error) {
        console.error('Error in select start callback:', error);
      }
    });
  }

  /**
   * Trigger select end callbacks
   * @private
   */
  triggerSelectEnd(event, hand) {
    this.onSelectEndCallbacks.forEach(callback => {
      try {
        callback(event, hand);
      } catch (error) {
        console.error('Error in select end callback:', error);
      }
    });
  }

  /**
   * Trigger squeeze start callbacks
   * @private
   */
  triggerSqueezeStart(event, hand) {
    this.onSqueezeStartCallbacks.forEach(callback => {
      try {
        callback(event, hand);
      } catch (error) {
        console.error('Error in squeeze start callback:', error);
      }
    });
  }

  /**
   * Trigger squeeze end callbacks
   * @private
   */
  triggerSqueezeEnd(event, hand) {
    this.onSqueezeEndCallbacks.forEach(callback => {
      try {
        callback(event, hand);
      } catch (error) {
        console.error('Error in squeeze end callback:', error);
      }
    });
  }

  /**
   * Dispose and clean up
   */
  dispose() {
    // Clean up listeners and visuals from controllers
    const cleanupController = (controller) => {
      if (!controller) return;
      
      // Remove listeners
      if (controller.userData.listeners) {
        Object.entries(controller.userData.listeners).forEach(([event, listener]) => {
          controller.removeEventListener(event, listener);
        });
        controller.userData.listeners = null;
      }
      
      // Remove ray
      if (controller.userData.ray) {
        controller.remove(controller.userData.ray);
        controller.userData.ray.geometry.dispose();
        controller.userData.ray.material.dispose();
        controller.userData.ray = null;
      }
      
      // Reset flags
      controller.userData.isSetup = false;
      controller.userData.isController = false;
      
      // Remove from scene (optional, as we might want to keep the object itself if managed by renderer)
      // But we remove it to be safe and re-add on next init
      if (controller.parent) {
        controller.parent.remove(controller);
      }
    };

    cleanupController(this.leftController);
    cleanupController(this.rightController);

    // Clear callbacks
    this.onControllerConnectedCallbacks = [];
    this.onControllerDisconnectedCallbacks = [];
    this.onSelectStartCallbacks = [];
    this.onSelectEndCallbacks = [];
    this.onSqueezeStartCallbacks = [];
    this.onSqueezeEndCallbacks = [];

    // Clear polling timers
    this.clearPollInterval();

    // Clear references
    this.leftController = null;
    this.rightController = null;
    this.xrSession = null;

    console.log('VRControllers: Disposed');
  }
}

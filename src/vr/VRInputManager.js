import * as THREE from 'three';

/**
 * VRInputManager - Unified input manager for VR interactions
 * Abstracts input from controllers, hands, and gaze into a unified event system
 * 
 * Design principles:
 * - Action-based, not device-based
 * - Automatic mode detection (controller → hand → gaze fallback)
 * - Unified events: onHoverStart, onHoverEnd, onSelectStart, onSelectEnd
 * - Clean API for registering interactive objects
 * 
 * Phase 1 Implementation:
 * - Detects available input modes
 * - Provides unified ray casting
 * - Emits unified events
 * - Tracks hovered/selected objects
 */
export class VRInputManager {
  constructor(renderer, scene, camera, controllers, handTracking) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.controllers = controllers;
    this.handTracking = handTracking;
    
    // XR session reference
    this.xrSession = null;
    
    // Raycaster for intersection detection
    this.raycaster = new THREE.Raycaster();
    
    // Interactive objects registry
    this.interactiveObjects = new Set();
    
    // Current state
    this.currentInputMode = 'gaze'; // 'controller', 'hand', or 'gaze'
    this.hoveredObject = null;
    this.selectingObject = null;
    this.isSelecting = false;
    
    // Reusable objects for raycasting to reduce GC
    this._tempRayOrigin = new THREE.Vector3();
    this._tempRayDirection = new THREE.Vector3();
    this._tempRay = {
      origin: this._tempRayOrigin,
      direction: this._tempRayDirection
    };
    this.onHoverStartCallbacks = [];
    this.onHoverEndCallbacks = [];
    this.onSelectStartCallbacks = [];
    this.onSelectEndCallbacks = [];
    
    // Selection state tracking
    this.selectionState = {
      left: false,
      right: false
    };
    
    // Ready state tracking
    this._isReady = false;
    this._readyPromise = null;
    this._readyResolve = null;
    this._initRetryCount = 0;
    this._maxInitRetries = 10;
  }

  /**
   * Initialize input manager with XR session
   * @param {XRSession} xrSession
   */
  init(xrSession) {
    if (!xrSession) {
      console.warn('VRInputManager: No XR session provided');
      this._tryRetryInit();
      return;
    }

    try {
      this.xrSession = xrSession;

      // Setup event listeners from controllers and hand tracking
      if (this.controllers) {
        this.controllers.onSelectStart((event, hand) => {
          this.handleSelectStart('controller', hand);
        });
        
        this.controllers.onSelectEnd((event, hand) => {
          this.handleSelectEnd('controller', hand);
        });
      }

      if (this.handTracking) {
        this.handTracking.onPinchStart((hand, thumbPos, indexPos) => {
          this.handleSelectStart('hand', hand);
        });
        
        this.handTracking.onPinchEnd((hand) => {
          this.handleSelectEnd('hand', hand);
        });
      }

      // Mark as ready
      this._isReady = true;
      this._initRetryCount = 0;
      
      // Resolve ready promise if it exists
      if (this._readyResolve) {
        this._readyResolve();
        this._readyResolve = null;
        this._readyPromise = null;
      }

      console.log('VRInputManager: Initialized and ready');
    } catch (error) {
      console.error('VRInputManager: Initialization error:', error);
      this._isReady = false;
      this._tryRetryInit();
    }
  }
  
  /**
   * Retry initialization if it failed
   * @private
   */
  _tryRetryInit() {
    if (this._initRetryCount >= this._maxInitRetries) {
      console.error('VRInputManager: Max retry attempts reached');
      return;
    }
    
    this._initRetryCount++;
    console.log(`VRInputManager: Retrying initialization (attempt ${this._initRetryCount}/${this._maxInitRetries})`);
    
    // Retry after a short delay
    setTimeout(() => {
      // This will be called from VRManager when xrSession is available
      // We just reset the ready state to allow retry
      this._isReady = false;
    }, 500);
  }
  
  /**
   * Wait for input manager to be ready
   * Returns a promise that resolves when inputManager is initialized
   * @returns {Promise<void>}
   */
  waitForReady() {
    if (this._isReady) {
      return Promise.resolve();
    }
    
    // Return existing promise if one is already pending
    if (this._readyPromise) {
      return this._readyPromise;
    }
    
    // Create new promise
    this._readyPromise = new Promise((resolve) => {
      this._readyResolve = resolve;
      
      // Timeout after 10 seconds
      setTimeout(() => {
        if (!this._isReady) {
          console.warn('VRInputManager: waitForReady timeout - inputManager may not be ready');
          resolve(); // Resolve anyway to prevent hanging
        }
      }, 10000);
    });
    
    return this._readyPromise;
  }
  
  /**
   * Check if input manager is ready
   * @returns {boolean}
   */
  isReady() {
    return this._isReady && this.xrSession !== null;
  }

  /**
   * Update input manager (call each frame)
   */
  update() {
    // Determine current input mode (priority: controller > hand > gaze)
    this.detectInputMode();
    
    // Get current ray based on input mode
    const ray = this.getCurrentRay();
    
    if (!ray) return;
    
    // Ensure we have interactive objects to check
    if (this.interactiveObjects.size === 0) {
      // Debug: Log if no interactive objects (only once per second to avoid spam)
      if (!this._lastNoObjectsWarning || Date.now() - this._lastNoObjectsWarning > 1000) {
        console.warn('VRInputManager: No interactive objects registered');
        this._lastNoObjectsWarning = Date.now();
      }
      return;
    }
    
    // Perform raycasting
    // Use world coordinates - raycaster handles coordinate space automatically
    this.raycaster.set(ray.origin, ray.direction);
    
    // Set a reasonable far distance for raycasting (cube is ~65m away)
    this.raycaster.far = 200;
    this.raycaster.near = 0.01;
    
    // Convert Set to Array for raycasting
    const objectsArray = Array.from(this.interactiveObjects);
    
    // Perform intersection test (recursive to check children)
    const intersects = this.raycaster.intersectObjects(objectsArray, true);
    
    // Find first interactive object (skip non-interactive children)
    let hitObject = null;
    if (intersects.length > 0) {
      // Find the first intersection that is an interactive object or has an interactive parent
      for (let i = 0; i < intersects.length; i++) {
        const intersected = intersects[i].object;
        
        // Check if this object is interactive
        if (intersected.userData.interactive || this.interactiveObjects.has(intersected)) {
          hitObject = intersected;
          break;
        }
        
        // Check if any parent is interactive
        let parent = intersected.parent;
        while (parent) {
          if (parent.userData.interactive || this.interactiveObjects.has(parent)) {
            hitObject = parent;
            break;
          }
          parent = parent.parent;
        }
        
        if (hitObject) break;
      }
    }
    
    // Handle hover state changes
    if (hitObject !== this.hoveredObject) {
      // End hover on previous object
      if (this.hoveredObject) {
        this.triggerHoverEnd(this.hoveredObject);
      }
      
      // Start hover on new object
      if (hitObject) {
        this.triggerHoverStart(hitObject);
      }
      
      this.hoveredObject = hitObject;
    }
    
    // Handle selection state
    // Selection is handled via event callbacks from controllers/hands
  }

  /**
   * Detect current input mode
   * Priority: controller > hand > gaze
   * @private
   */
  detectInputMode() {
    if (this.controllers) {
      // Check if controllers exist and can provide rays (even if not fully connected)
      const leftRay = this.controllers.getControllerRay('left');
      const rightRay = this.controllers.getControllerRay('right');
      if (leftRay || rightRay) {
        this.currentInputMode = 'controller';
        return;
      }
    }
    
    if (this.handTracking) {
      if (this.handTracking.isHandTracking('left') || 
          this.handTracking.isHandTracking('right')) {
        this.currentInputMode = 'hand';
        return;
      }
    }
    
    // Fallback to gaze
    this.currentInputMode = 'gaze';
  }

  /**
   * Get current ray based on input mode
   * @private
   * @returns {Object|null} Ray object with origin and direction
   */
  getCurrentRay() {
    switch (this.currentInputMode) {
      case 'controller':
        // Prefer right controller, fallback to left
        let ray = this.controllers.getControllerRay('right');
        if (!ray) {
          ray = this.controllers.getControllerRay('left');
        }
        return ray;
        
      case 'hand':
        // Prefer right hand, fallback to left
        ray = this.handTracking.getHandRay('right');
        if (!ray) {
          ray = this.handTracking.getHandRay('left');
        }
        return ray;
        
      case 'gaze':
      default:
        // Gaze ray from camera
        return this.getGazeRay();
    }
  }

  /**
   * Get controller ray
   * @param {string} hand - 'left' or 'right'
   * @returns {Object|null}
   */
  getControllerRay(hand) {
    if (!this.controllers) return null;
    return this.controllers.getControllerRay(hand);
  }

  /**
   * Get hand ray
   * @param {string} hand - 'left' or 'right'
   * @returns {Object|null}
   */
  getHandRay(hand) {
    if (!this.handTracking) return null;
    return this.handTracking.getHandRay(hand);
  }

  /**
   * Get gaze ray from camera
   * @returns {Object}
   */
  getGazeRay() {
    // Reuse vector objects
    const direction = this._tempRayDirection;
    const origin = this._tempRayOrigin;
    
    direction.set(0, 0, -1);
    direction.applyQuaternion(this.camera.quaternion);
    origin.copy(this.camera.position);
    
    return {
      origin: origin,
      direction: direction
    };
  }

  /**
   * Register an interactive object
   * @param {THREE.Object3D} object - Object to register
   */
  registerInteractiveObject(object) {
    if (!object) {
      console.warn('VRInputManager: Cannot register null/undefined object');
      return;
    }
    
    // Mark object as interactive
    object.userData.interactive = true;
    
    this.interactiveObjects.add(object);
    console.log(`VRInputManager: Registered interactive object "${object.name || 'unnamed'}" (total: ${this.interactiveObjects.size})`);
  }

  /**
   * Unregister an interactive object
   * @param {THREE.Object3D} object - Object to unregister
   */
  unregisterInteractiveObject(object) {
    if (!object) return;
    
    object.userData.interactive = false;
    this.interactiveObjects.delete(object);
    
    // Clear hover state if this was the hovered object
    if (this.hoveredObject === object) {
      this.triggerHoverEnd(object);
      this.hoveredObject = null;
    }
  }

  /**
   * Handle select start from input source
   * @private
   */
  handleSelectStart(inputType, hand) {
    if (this.isSelecting) return;
    
    this.isSelecting = true;
    this.selectingObject = this.hoveredObject;
    
    if (this.selectingObject) {
      this.triggerSelectStart(this.selectingObject, inputType, hand);
    }
  }

  /**
   * Handle select end from input source
   * @private
   */
  handleSelectEnd(inputType, hand) {
    if (!this.isSelecting) return;
    
    const wasSelecting = this.selectingObject;
    this.isSelecting = false;
    
    if (wasSelecting) {
      // Only trigger select end if still hovering over the same object
      if (this.hoveredObject === wasSelecting) {
        this.triggerSelectEnd(wasSelecting, inputType, hand);
      }
    }
    
    this.selectingObject = null;
  }

  /**
   * Trigger hover start event
   * @private
   */
  triggerHoverStart(object) {
    this.onHoverStartCallbacks.forEach(callback => {
      try {
        callback(object);
      } catch (error) {
        console.error('Error in hover start callback:', error);
      }
    });
  }

  /**
   * Trigger hover end event
   * @private
   */
  triggerHoverEnd(object) {
    this.onHoverEndCallbacks.forEach(callback => {
      try {
        callback(object);
      } catch (error) {
        console.error('Error in hover end callback:', error);
      }
    });
  }

  /**
   * Trigger select start event
   * @private
   */
  triggerSelectStart(object, inputType, hand) {
    this.onSelectStartCallbacks.forEach(callback => {
      try {
        callback(object, inputType, hand);
      } catch (error) {
        console.error('Error in select start callback:', error);
      }
    });
  }

  /**
   * Trigger select end event
   * @private
   */
  triggerSelectEnd(object, inputType, hand) {
    this.onSelectEndCallbacks.forEach(callback => {
      try {
        callback(object, inputType, hand);
      } catch (error) {
        console.error('Error in select end callback:', error);
      }
    });
  }

  /**
   * Register callback for hover start event
   * @param {Function} callback - Callback function (object) => {}
   */
  onHoverStart(callback) {
    this.onHoverStartCallbacks.push(callback);
  }

  /**
   * Register callback for hover end event
   * @param {Function} callback - Callback function (object) => {}
   */
  onHoverEnd(callback) {
    this.onHoverEndCallbacks.push(callback);
  }

  /**
   * Register callback for select start event
   * @param {Function} callback - Callback function (object, inputType, hand) => {}
   */
  onSelectStart(callback) {
    this.onSelectStartCallbacks.push(callback);
  }

  /**
   * Register callback for select end event
   * @param {Function} callback - Callback function (object, inputType, hand) => {}
   */
  onSelectEnd(callback) {
    this.onSelectEndCallbacks.push(callback);
  }

  /**
   * Get current input mode
   * @returns {string} 'controller', 'hand', or 'gaze'
   */
  getCurrentInputMode() {
    return this.currentInputMode;
  }

  /**
   * Get currently hovered object
   * @returns {THREE.Object3D|null}
   */
  getHoveredObject() {
    return this.hoveredObject;
  }

  /**
   * Get currently selecting object
   * @returns {THREE.Object3D|null}
   */
  getSelectingObject() {
    return this.selectingObject;
  }

  /**
   * Check if currently selecting
   * @returns {boolean}
   */
  isCurrentlySelecting() {
    return this.isSelecting;
  }

  /**
   * Dispose and clean up
   */
  dispose() {
    // Clear interactive objects
    this.interactiveObjects.clear();
    
    // Clear callbacks
    this.onHoverStartCallbacks = [];
    this.onHoverEndCallbacks = [];
    this.onSelectStartCallbacks = [];
    this.onSelectEndCallbacks = [];
    
    // Clear state
    this.hoveredObject = null;
    this.selectingObject = null;
    this.isSelecting = false;
    this.xrSession = null;
    
    // Reset ready state
    this._isReady = false;
    this._readyPromise = null;
    this._readyResolve = null;
    this._initRetryCount = 0;
    
    console.log('VRInputManager: Disposed');
  }
}

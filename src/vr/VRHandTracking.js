import * as THREE from 'three';

/**
 * VRHandTracking - Clean implementation for VR hand tracking input
 * Handles hand tracking, pinch detection, and gesture events
 * 
 * Design principles:
 * - Clean separation of concerns
 * - Simple API for getting hand rays
 * - Event-based gesture handling
 * - Automatic hand detection
 */
export class VRHandTracking {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    
    // Hand objects (Three.js XRHandSpace instances)
    this.leftHand = null;
    this.rightHand = null;
    
    // XR session reference
    this.xrSession = null;
    
    // Hand state
    this.isTracking = {
      left: false,
      right: false
    };
    
    // Pinch detection
    this.isPinching = {
      left: false,
      right: false
    };
    this.pinchThreshold = 0.03; // 3cm threshold for pinch detection
    
    // Visual representation
    this.showHandModels = false; // Set to true to visualize hands
    this.handMeshes = {
      left: null,
      right: null
    };
    
    // Event callbacks
    this.onHandTrackingStartCallbacks = [];
    this.onHandTrackingEndCallbacks = [];
    this.onPinchStartCallbacks = [];
    this.onPinchEndCallbacks = [];
    
    // Gaze point (for Vision Pro style interaction)
    this.gazePoint = new THREE.Vector3();
  }

  /**
   * Initialize hand tracking with XR session
   * @param {XRSession} xrSession
   * @returns {Promise}
   */
  async init(xrSession) {
    if (!xrSession) {
      console.warn('VRHandTracking: No XR session provided');
      return;
    }

    this.xrSession = xrSession;

    // Check if hand tracking is supported
    if (!xrSession.enabledFeatures || !xrSession.enabledFeatures.includes('hand-tracking')) {
      console.warn('VRHandTracking: Hand tracking not enabled in session');
      console.log('VRHandTracking: Available features:', xrSession.enabledFeatures);
      return;
    }

    console.log('VRHandTracking: Hand tracking feature is enabled');

    // Listen for hand tracking events FIRST, before checking input sources
    // This ensures we catch hands as soon as they appear
    xrSession.addEventListener('inputsourceschange', (event) => {
      this.handleInputSourcesChange(event);
    });

    // Check existing input sources - this will create hand objects dynamically
    this.checkInputSources(xrSession);

    console.log('VRHandTracking: Initialized, waiting for hand input sources');
  }

  /**
   * Setup a hand (visualization, etc.)
   * @private
   */
  setupHand(hand, handedness) {
    hand.userData.handedness = handedness;
    // Mark as hand so it's not moved into scene offset
    hand.userData.isHand = true;

    // Create visual representation if enabled
    if (this.showHandModels) {
      this.createHandMesh(hand, handedness);
    }
  }

  /**
   * Create hand mesh visualization
   * @private
   */
  createHandMesh(hand, handedness) {
    const handGroup = new THREE.Group();
    handGroup.name = `HandMesh_${handedness}`;

    // Create joints if available
    if (hand.joints) {
      Object.keys(hand.joints).forEach((jointName) => {
        const joint = hand.joints[jointName];
        if (joint) {
          const geometry = new THREE.SphereGeometry(0.005, 8, 8);
          const material = new THREE.MeshBasicMaterial({
            color: handedness === 'left' ? 0x00ff00 : 0xff0000,
            transparent: true,
            opacity: 0.8
          });
          const sphere = new THREE.Mesh(geometry, material);
          sphere.name = `Joint_${jointName}`;
          handGroup.add(sphere);
        }
      });
    }

    this.handMeshes[handedness] = handGroup;
    hand.add(handGroup);
  }

  /**
   * Handle input sources change event
   * @private
   */
  handleInputSourcesChange(event) {
    // Handle added input sources
    event.added.forEach((inputSource) => {
      if (inputSource.targetRayMode === 'tracked-pointer' && inputSource.hand) {
        this.checkInputSource(inputSource);
      }
    });

    // Handle removed input sources
    event.removed.forEach((inputSource) => {
      if (inputSource.targetRayMode === 'tracked-pointer' && inputSource.hand) {
        // Use handedness (string: 'left' or 'right'), not hand (XRHand object)
        const hand = inputSource.handedness;
        if (hand === 'left' || hand === 'right') {
          this.isTracking[hand] = false;
          this.triggerHandTrackingEnd(inputSource, hand);
          console.log(`VRHandTracking: Stopped tracking ${hand} hand`);
        }
      }
    });
  }

  /**
   * Check for input sources and track hands
   * @private
   */
  checkInputSources(xrSession) {
    if (!xrSession || !xrSession.inputSources) {
      console.log('VRHandTracking: No input sources available yet');
      return;
    }

    console.log(`VRHandTracking: Checking ${xrSession.inputSources.length} input sources`);
    
    xrSession.inputSources.forEach((inputSource, index) => {
      const hasHand = !!inputSource.hand;
      const handedness = inputSource.handedness;
      const targetRayMode = inputSource.targetRayMode;
      
      console.log(`VRHandTracking: Input source ${index}: targetRayMode=${targetRayMode}, handedness=${handedness}, hasHand=${hasHand}`);
      
      if (inputSource.targetRayMode === 'tracked-pointer' && inputSource.hand) {
        console.log(`VRHandTracking: Found hand tracking input source: ${handedness}`);
        this.checkInputSource(inputSource);
      }
    });
  }

  /**
   * Check and track a single input source
   * @private
   */
  checkInputSource(inputSource) {
    // Verify this is a hand tracking input source
    if (!inputSource.hand) {
      return; // Not a hand tracking input
    }

    // Use handedness (string: 'left' or 'right'), not hand (XRHand object)
    const handedness = inputSource.handedness;
    
    if (handedness !== 'left' && handedness !== 'right') {
      console.warn(`VRHandTracking: Unknown handedness: ${handedness}`);
      return;
    }

    // Get or create the hand object for this handedness
    let handObject = handedness === 'left' ? this.leftHand : this.rightHand;
    
    // If hand object doesn't exist, get it from Three.js XR system or create from input source
    if (!handObject) {
      console.log(`VRHandTracking: Setting up ${handedness} hand object from input source`);
      
      try {
        // Try to get hand space from Three.js renderer
        // getHand(index) where index 0 = left, 1 = right
        const handIndex = handedness === 'left' ? 0 : 1;
        let handSpace = this.renderer.xr.getHand(handIndex);
        
        // If getHand doesn't work, try to use the input source's hand directly
        if (!handSpace && inputSource.hand) {
          // The input source has a hand property that's an XRHandSpace
          // This should be added to the scene by Three.js automatically
          // But we can access it directly
          handSpace = inputSource.hand;
        }
        
        if (handSpace) {
          // Store reference to the hand space
          if (handedness === 'left') {
            this.leftHand = handSpace;
          } else {
            this.rightHand = handSpace;
          }
          
          // Setup the hand (add to scene if not already added)
          if (handSpace.parent !== this.scene) {
            this.scene.add(handSpace);
          }
          this.setupHand(handSpace, handedness);
          
          // Store input source reference for later use
          handSpace.userData.inputSource = inputSource;
          
          handObject = handSpace;
          
          const jointCount = handSpace.joints ? Object.keys(handSpace.joints).length : 0;
          console.log(`VRHandTracking: Set up ${handedness} hand object with ${jointCount} joints`);
        } else {
          console.warn(`VRHandTracking: Could not get hand space for ${handedness} hand`);
          return;
        }
      } catch (error) {
        console.error(`VRHandTracking: Error setting up ${handedness} hand object:`, error);
        return;
      }
    } else {
      // Update the input source reference if hand object already exists
      handObject.userData.inputSource = inputSource;
    }

    // Mark as tracking
    if (!this.isTracking[handedness]) {
      this.isTracking[handedness] = true;
      this.triggerHandTrackingStart(inputSource, handedness);
      console.log(`VRHandTracking: Started tracking ${handedness} hand`);
    }
  }

  /**
   * Get pinch ray for raycasting
   * @param {string} hand - 'left' or 'right'
   * @returns {Object|null} Ray object with origin and direction, or null if not available
   */
  getPinchRay(hand) {
    const handObject = hand === 'left' ? this.leftHand : this.rightHand;
    
    if (!handObject || !this.isTracking[hand]) {
      return null;
    }

    // The hand object is an XRHandSpace which has joints directly
    if (!handObject.joints) {
      return null;
    }

    const thumbTip = handObject.joints['thumb-tip'];
    const indexTip = handObject.joints['index-finger-tip'];

    if (!thumbTip || !indexTip) {
      return null;
    }

    // Calculate pinch point (midpoint between thumb and index)
    const thumbPos = new THREE.Vector3();
    const indexPos = new THREE.Vector3();
    
    thumbTip.getWorldPosition(thumbPos);
    indexTip.getWorldPosition(indexPos);
    
    const pinchPoint = new THREE.Vector3().addVectors(thumbPos, indexPos).multiplyScalar(0.5);
    
    // Calculate direction from pinch point forward
    const direction = new THREE.Vector3().subVectors(indexPos, thumbPos).normalize();
    
    return {
      origin: pinchPoint,
      direction: direction,
      hand: handObject
    };
  }

  /**
   * Get hand ray from index finger
   * @param {string} hand - 'left' or 'right'
   * @returns {Object|null} Ray object with origin and direction, or null if not available
   */
  getHandRay(hand) {
    const handObject = hand === 'left' ? this.leftHand : this.rightHand;
    
    if (!handObject || !this.isTracking[hand]) {
      return null;
    }

    // The hand object is an XRHandSpace which has joints directly
    if (!handObject.joints) {
      return null;
    }

    const indexTip = handObject.joints['index-finger-tip'];
    const indexMCP = handObject.joints['index-finger-metacarpal'];

    if (!indexTip || !indexMCP) {
      return null;
    }

    // Get position and direction from index finger
    const tipPos = new THREE.Vector3();
    const mcpPos = new THREE.Vector3();
    
    indexTip.getWorldPosition(tipPos);
    indexMCP.getWorldPosition(mcpPos);
    
    const direction = new THREE.Vector3().subVectors(tipPos, mcpPos).normalize();
    
    return {
      origin: tipPos,
      direction: direction,
      hand: handObject
    };
  }

  /**
   * Check if a hand is tracking
   * @param {string} hand - 'left' or 'right'
   * @returns {boolean}
   */
  isHandTracking(hand) {
    return this.isTracking[hand] || false;
  }

  /**
   * Check if a hand is pinching
   * @param {string} hand - 'left' or 'right'
   * @returns {boolean}
   */
  isHandPinching(hand) {
    return this.isPinching[hand] || false;
  }

  /**
   * Update hand tracking (call each frame)
   */
  update() {
    // Re-check input sources periodically to catch hands that appear later
    // This is important for Quest 3 which may not provide hands immediately
    if (this.xrSession && (!this.leftHand || !this.rightHand)) {
      // Only check occasionally to avoid spam (every 60 frames ~1 second at 60fps)
      if (!this._lastInputSourceCheck || this._frameCount - this._lastInputSourceCheck > 60) {
        this.checkInputSources(this.xrSession);
        this._lastInputSourceCheck = this._frameCount || 0;
      }
      this._frameCount = (this._frameCount || 0) + 1;
    }

    if (!this.leftHand && !this.rightHand) return;

    // Update pinch detection
    if (this.leftHand && this.isTracking.left) {
      this.updatePinchDetection('left');
    }
    if (this.rightHand && this.isTracking.right) {
      this.updatePinchDetection('right');
    }

    // Update gaze point (for Vision Pro style interaction)
    this.updateGazePoint();
  }

  /**
   * Update pinch detection for a hand
   * @private
   */
  updatePinchDetection(hand) {
    const handObject = hand === 'left' ? this.leftHand : this.rightHand;
    
    if (!handObject || !this.isTracking[hand]) {
      return;
    }

    // The hand object is an XRHandSpace which has joints directly
    if (!handObject.joints) {
      return;
    }

    const thumbTip = handObject.joints['thumb-tip'];
    const indexTip = handObject.joints['index-finger-tip'];

    if (!thumbTip || !indexTip) {
      return;
    }

    // Calculate distance between thumb and index finger tips
    const thumbPos = new THREE.Vector3();
    const indexPos = new THREE.Vector3();
    
    thumbTip.getWorldPosition(thumbPos);
    indexTip.getWorldPosition(indexPos);
    
    const distance = thumbPos.distanceTo(indexPos);
    const wasPinching = this.isPinching[hand];
    const isPinching = distance < this.pinchThreshold;

    // Trigger events on state change
    if (!wasPinching && isPinching) {
      this.isPinching[hand] = true;
      this.triggerPinchStart(hand, thumbPos, indexPos);
    } else if (wasPinching && !isPinching) {
      this.isPinching[hand] = false;
      this.triggerPinchEnd(hand);
    }
  }

  /**
   * Update gaze point (for Vision Pro style interaction)
   * @private
   */
  updateGazePoint() {
    // Gaze point is calculated from camera forward direction
    const direction = new THREE.Vector3(0, 0, -1);
    direction.applyQuaternion(this.camera.quaternion);
    
    // Gaze point is 1 meter in front of camera
    this.gazePoint.copy(this.camera.position).add(direction.multiplyScalar(1.0));
  }

  /**
   * Get gaze ray
   * @returns {Object} Ray object with origin and direction
   */
  getGazeRay() {
    const direction = new THREE.Vector3(0, 0, -1);
    direction.applyQuaternion(this.camera.quaternion);
    
    return {
      origin: this.camera.position.clone(),
      direction: direction
    };
  }

  /**
   * Register callback for hand tracking start event
   * @param {Function} callback - Callback function (inputSource, hand) => {}
   */
  onHandTrackingStart(callback) {
    this.onHandTrackingStartCallbacks.push(callback);
  }

  /**
   * Register callback for hand tracking end event
   * @param {Function} callback - Callback function (inputSource, hand) => {}
   */
  onHandTrackingEnd(callback) {
    this.onHandTrackingEndCallbacks.push(callback);
  }

  /**
   * Register callback for pinch start event
   * @param {Function} callback - Callback function (hand, thumbPos, indexPos) => {}
   */
  onPinchStart(callback) {
    this.onPinchStartCallbacks.push(callback);
  }

  /**
   * Register callback for pinch end event
   * @param {Function} callback - Callback function (hand) => {}
   */
  onPinchEnd(callback) {
    this.onPinchEndCallbacks.push(callback);
  }

  /**
   * Trigger hand tracking start callbacks
   * @private
   */
  triggerHandTrackingStart(inputSource, hand) {
    this.onHandTrackingStartCallbacks.forEach(callback => {
      try {
        callback(inputSource, hand);
      } catch (error) {
        console.error('Error in hand tracking start callback:', error);
      }
    });
  }

  /**
   * Trigger hand tracking end callbacks
   * @private
   */
  triggerHandTrackingEnd(inputSource, hand) {
    this.onHandTrackingEndCallbacks.forEach(callback => {
      try {
        callback(inputSource, hand);
      } catch (error) {
        console.error('Error in hand tracking end callback:', error);
      }
    });
  }

  /**
   * Trigger pinch start callbacks
   * @private
   */
  triggerPinchStart(hand, thumbPos, indexPos) {
    this.onPinchStartCallbacks.forEach(callback => {
      try {
        callback(hand, thumbPos, indexPos);
      } catch (error) {
        console.error('Error in pinch start callback:', error);
      }
    });
  }

  /**
   * Trigger pinch end callbacks
   * @private
   */
  triggerPinchEnd(hand) {
    this.onPinchEndCallbacks.forEach(callback => {
      try {
        callback(hand);
      } catch (error) {
        console.error('Error in pinch end callback:', error);
      }
    });
  }

  /**
   * Set hand models visible
   * @param {boolean} visible
   */
  setHandModelsVisible(visible) {
    this.showHandModels = visible;
    Object.values(this.handMeshes).forEach(mesh => {
      if (mesh) mesh.visible = visible;
    });
  }

  /**
   * Dispose and clean up
   */
  dispose() {
    // Remove hands from scene
    if (this.leftHand && this.leftHand.parent) {
      this.leftHand.parent.remove(this.leftHand);
    }
    if (this.rightHand && this.rightHand.parent) {
      this.rightHand.parent.remove(this.rightHand);
    }

    // Clear callbacks
    this.onHandTrackingStartCallbacks = [];
    this.onHandTrackingEndCallbacks = [];
    this.onPinchStartCallbacks = [];
    this.onPinchEndCallbacks = [];

    // Clear references
    this.leftHand = null;
    this.rightHand = null;
    this.xrSession = null;

    console.log('VRHandTracking: Disposed');
  }
}

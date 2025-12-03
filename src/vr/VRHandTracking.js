/**
 * VR Hand Tracking
 * Manages hand tracking for Quest 3 and Apple Vision Pro
 * Supports gaze-and-pinch interaction for Vision Pro
 */

import * as THREE from 'three';

export class VRHandTracking {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    
    this.handTracked = false;
    this.leftHand = null;
    this.rightHand = null;
    
    // Hand models
    this.showHandModels = false; // Set to true to visualize hands
    this.handMeshes = {
      left: null,
      right: null
    };
    
    // Gaze and pinch (Vision Pro style)
    this.gazePoint = new THREE.Vector3();
    this.isPinching = {
      left: false,
      right: false
    };
    
    // Pinch threshold
    this.pinchThreshold = 0.05; // Distance between thumb and index finger
    
    // Callbacks
    this.onHandTrackedCallbacks = [];
    this.onHandLostCallbacks = [];
    this.onPinchStartCallbacks = [];
    this.onPinchEndCallbacks = [];
  }

  /**
   * Initialize hand tracking
   */
  async init(xrSession) {
    if (!xrSession) {
      console.warn('No XR session provided for hand tracking initialization');
      return;
    }

    // Check if hand tracking is supported
    if (!xrSession.enabledFeatures.includes('hand-tracking')) {
      console.log('Hand tracking not enabled in session');
      return;
    }

    // Setup hand tracking spaces
    this.leftHand = this.renderer.xr.getHand(0);
    this.rightHand = this.renderer.xr.getHand(1);

    if (this.leftHand) {
      this.scene.add(this.leftHand);
      this.setupHand(this.leftHand, 'left');
    }

    if (this.rightHand) {
      this.scene.add(this.rightHand);
      this.setupHand(this.rightHand, 'right');
    }

    console.log('VR hand tracking initialized');
  }

  /**
   * Setup hand tracking
   * @private
   */
  setupHand(hand, handedness) {
    hand.userData.handedness = handedness;

    // Create visual representation if enabled
    if (this.showHandModels) {
      this.createHandMesh(hand, handedness);
    }

    // Setup joint tracking
    // Hand joints are automatically tracked by WebXR
    // We can access them via hand.joints
  }

  /**
   * Create hand mesh visualization
   * @private
   */
  createHandMesh(hand, handedness) {
    // Simple visualization - create spheres for each joint
    // In a full implementation, you'd load proper hand models
    
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
   * Update hand tracking (call each frame)
   */
  update() {
    if (!this.leftHand && !this.rightHand) return;

    // Update pinch detection
    if (this.leftHand) {
      this.updatePinchDetection('left');
    }
    if (this.rightHand) {
      this.updatePinchDetection('right');
    }

    // Update gaze point (for Vision Pro style interaction)
    this.updateGazePoint();
  }

  /**
   * Update pinch detection
   * @private
   */
  updatePinchDetection(hand) {
    const handObject = hand === 'left' ? this.leftHand : this.rightHand;
    if (!handObject || !handObject.joints) return;

    const thumbTip = handObject.joints['thumb-tip'];
    const indexTip = handObject.joints['index-finger-tip'];

    if (!thumbTip || !indexTip) return;

    // Calculate distance between thumb and index finger
    const thumbPos = new THREE.Vector3();
    thumbPos.setFromMatrixPosition(thumbTip.matrixWorld);

    const indexPos = new THREE.Vector3();
    indexPos.setFromMatrixPosition(indexTip.matrixWorld);

    const distance = thumbPos.distanceTo(indexPos);
    const wasPinching = this.isPinching[hand];
    const isPinchingNow = distance < this.pinchThreshold;

    // Detect pinch start/end
    if (!wasPinching && isPinchingNow) {
      this.isPinching[hand] = true;
      this.triggerPinchStart(hand, thumbPos, indexPos);
    } else if (wasPinching && !isPinchingNow) {
      this.isPinching[hand] = false;
      this.triggerPinchEnd(hand);
    }
  }

  /**
   * Update gaze point (center of view for Vision Pro style)
   * @private
   */
  updateGazePoint() {
    if (!this.camera) return;

    // Gaze point is forward from camera
    const direction = new THREE.Vector3(0, 0, -1);
    direction.applyQuaternion(this.camera.quaternion);

    this.gazePoint.copy(this.camera.position);
    this.gazePoint.add(direction.multiplyScalar(2)); // 2 meters ahead
  }

  /**
   * Get hand position
   * @param {string} hand - 'left' or 'right'
   * @returns {THREE.Vector3|null} Hand position
   */
  getHandPosition(hand = 'right') {
    const handObject = hand === 'left' ? this.leftHand : this.rightHand;
    if (!handObject) return null;

    const position = new THREE.Vector3();
    position.setFromMatrixPosition(handObject.matrixWorld);
    return position;
  }

  /**
   * Get hand joint position
   * @param {string} hand - 'left' or 'right'
   * @param {string} jointName - Name of the joint
   * @returns {THREE.Vector3|null} Joint position
   */
  getJointPosition(hand, jointName) {
    const handObject = hand === 'left' ? this.leftHand : this.rightHand;
    if (!handObject || !handObject.joints) return null;

    const joint = handObject.joints[jointName];
    if (!joint) return null;

    const position = new THREE.Vector3();
    position.setFromMatrixPosition(joint.matrixWorld);
    return position;
  }

  /**
   * Check if hand is pinching
   * @param {string} hand - 'left' or 'right'
   * @returns {boolean}
   */
  isPinching(hand) {
    return this.isPinching[hand] || false;
  }

  /**
   * Get gaze point
   * @returns {THREE.Vector3}
   */
  getGazePoint() {
    return this.gazePoint.clone();
  }

  /**
   * Check if hand tracking is active
   * @returns {boolean}
   */
  isHandTracked() {
    return (this.leftHand !== null) || (this.rightHand !== null);
  }

  /**
   * Set hand models visible
   * @param {boolean} visible
   */
  setHandModelsVisible(visible) {
    this.showHandModels = visible;
    
    Object.values(this.handMeshes).forEach(mesh => {
      if (mesh) {
        mesh.visible = visible;
      }
    });
  }

  /**
   * Register callback for hand tracked
   */
  onHandTracked(callback) {
    if (typeof callback === 'function') {
      this.onHandTrackedCallbacks.push(callback);
    }
  }

  /**
   * Register callback for hand lost
   */
  onHandLost(callback) {
    if (typeof callback === 'function') {
      this.onHandLostCallbacks.push(callback);
    }
  }

  /**
   * Register callback for pinch start
   */
  onPinchStart(callback) {
    if (typeof callback === 'function') {
      this.onPinchStartCallbacks.push(callback);
    }
  }

  /**
   * Register callback for pinch end
   */
  onPinchEnd(callback) {
    if (typeof callback === 'function') {
      this.onPinchEndCallbacks.push(callback);
    }
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
   * Cleanup
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
    this.onHandTrackedCallbacks = [];
    this.onHandLostCallbacks = [];
    this.onPinchStartCallbacks = [];
    this.onPinchEndCallbacks = [];

    this.leftHand = null;
    this.rightHand = null;
  }
}


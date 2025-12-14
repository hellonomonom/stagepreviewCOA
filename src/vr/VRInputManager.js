import * as THREE from 'three';

/**
 * VRInputManager (rewritten) - unified input handling for gaze, controllers, and hands.
 * - Priority: hand > controller > gaze (configurable)
 * - Gaze dwell selection (default 2000ms)
 * - Rays remain visible (handled by controller/hand providers)
 * - Events: hoverstart/hoverend/selectstart/selectend/squeezestart/squeezeend/modechange/devicechange
 */
export class VRInputManager {
  constructor(renderer, scene, camera, controllers, handTracking, options = {}) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.controllers = controllers;
    this.handTracking = handTracking;

    // Config
    this.dwellTimeMs = options.dwellTimeMs ?? 2000;
    this.priority = options.priority ?? ['hand', 'controller', 'gaze'];

    // XR session reference
    this.xrSession = null;

    // Raycaster
    this.raycaster = new THREE.Raycaster();

    // Interactive objects registry
    this.interactiveObjects = new Set();

    // State
    this.currentInputMode = 'gaze';
    this.hoveredObject = null;
    this.selectingObject = null;
    this.isSelecting = false;
    this.gazeHoverStartTime = null;

    // Reusable vectors
    this._tempRayOrigin = new THREE.Vector3();
    this._tempRayDirection = new THREE.Vector3();

    // Callbacks
    this.onHoverStartCallbacks = [];
    this.onHoverEndCallbacks = [];
    this.onSelectStartCallbacks = [];
    this.onSelectEndCallbacks = [];
    this.onSqueezeStartCallbacks = [];
    this.onSqueezeEndCallbacks = [];
    this.onModeChangeCallbacks = [];
    this.onDeviceChangeCallbacks = [];

    // Ready tracking
    this._isReady = false;
    this._readyPromise = null;
    this._readyResolve = null;
  }

  /**
   * Initialize with XR session and wire adapters
   */
  init(xrSession) {
    if (!xrSession) {
      console.warn('VRInputManager: No XR session provided');
      return;
    }

    this.xrSession = xrSession;

    // Wire controllers
    if (this.controllers) {
      this.controllers.onSelectStart((event, hand) => this.handleSelectStart('controller', hand));
      this.controllers.onSelectEnd((event, hand) => this.handleSelectEnd('controller', hand));
      this.controllers.onSqueezeStart((event, hand) => this.triggerSqueezeStart(hand));
      this.controllers.onSqueezeEnd((event, hand) => this.triggerSqueezeEnd(hand));
      this.controllers.onControllerConnected(() => this.triggerDeviceChange());
      this.controllers.onControllerDisconnected(() => this.triggerDeviceChange());
    }

    // Wire hands
    if (this.handTracking) {
      this.handTracking.onPinchStart((hand) => this.handleSelectStart('hand', hand));
      this.handTracking.onPinchEnd((hand) => this.handleSelectEnd('hand', hand));
      this.handTracking.onHandTrackingStart(() => this.triggerDeviceChange());
      this.handTracking.onHandTrackingEnd(() => this.triggerDeviceChange());
    }

    this._isReady = true;
    if (this._readyResolve) {
      this._readyResolve();
      this._readyResolve = null;
      this._readyPromise = null;
    }

    console.log('VRInputManager: Initialized (rewritten)');
  }

  waitForReady() {
    if (this._isReady) return Promise.resolve();
    if (this._readyPromise) return this._readyPromise;
    this._readyPromise = new Promise((resolve) => {
      this._readyResolve = resolve;
      setTimeout(() => resolve(), 10000);
    });
    return this._readyPromise;
  }

  isReady() {
    return this._isReady && this.xrSession !== null;
  }

  /**
   * Per-frame update
   */
  update() {
    const previousMode = this.currentInputMode;
    this.detectInputMode();
    if (previousMode !== this.currentInputMode) {
      this.triggerModeChange(this.currentInputMode, previousMode);
    }

    const ray = this.getCurrentRay();
    if (!ray) return;
    if (this.interactiveObjects.size === 0) return;

    this.raycaster.set(ray.origin, ray.direction);
    this.raycaster.far = 200;
    this.raycaster.near = 0.01;

    const objectsArray = Array.from(this.interactiveObjects);
    const intersects = this.raycaster.intersectObjects(objectsArray, true);

    let hitObject = null;
    if (intersects.length > 0) {
      for (let i = 0; i < intersects.length; i++) {
        const intersected = intersects[i].object;
        if (intersected.userData.interactive || this.interactiveObjects.has(intersected)) {
          hitObject = intersected;
          break;
        }
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

    // Hover transitions
    if (hitObject !== this.hoveredObject) {
      if (this.hoveredObject) {
        this.triggerHoverEnd(this.hoveredObject);
      }
      if (hitObject) {
        this.triggerHoverStart(hitObject);
        if (this.currentInputMode === 'gaze') {
          this.gazeHoverStartTime = Date.now();
        }
      } else {
        this.gazeHoverStartTime = null;
      }
      this.hoveredObject = hitObject;
    }

    // Gaze dwell selection
    if (this.currentInputMode === 'gaze' && this.hoveredObject && !this.isSelecting) {
      if (this.gazeHoverStartTime && Date.now() - this.gazeHoverStartTime >= this.dwellTimeMs) {
        this.handleSelectStart('gaze', null);
        setTimeout(() => {
          if (this.isSelecting && this.selectingObject === this.hoveredObject) {
            this.handleSelectEnd('gaze', null);
          }
        }, 100);
        this.gazeHoverStartTime = null;
      }
    } else if (this.currentInputMode !== 'gaze') {
      this.gazeHoverStartTime = null;
    }
  }

  /**
   * Detect input mode using configured priority
   */
  detectInputMode() {
    const availability = {
      hand: this.handTracking ? (this.handTracking.isHandTracking('left') || this.handTracking.isHandTracking('right')) : false,
      controller: this.controllers ? (this.controllers.isControllerConnected('left') || this.controllers.isControllerConnected('right')) : false,
      gaze: true
    };

    for (const mode of this.priority) {
      if (availability[mode]) {
        this.currentInputMode = mode;
        return;
      }
    }
    this.currentInputMode = 'gaze';
  }

  /**
   * Get ray for current mode (falls back within mode to any available hand/controller)
   */
  getCurrentRay() {
    switch (this.currentInputMode) {
      case 'controller':
        return this.getBestControllerRay();
      case 'hand':
        return this.getBestHandRay();
      case 'gaze':
      default:
        return this.getGazeRay();
    }
  }

  getBestControllerRay() {
    if (!this.controllers) return null;
    const rightRay = this.controllers.getControllerRay('right');
    const leftRay = this.controllers.getControllerRay('left');
    if (this.controllers.isControllerConnected('right') && rightRay) return rightRay;
    if (this.controllers.isControllerConnected('left') && leftRay) return leftRay;
    return rightRay || leftRay || null;
  }

  getBestHandRay() {
    if (!this.handTracking) return null;
    const rightRay = this.handTracking.getHandRay('right');
    const leftRay = this.handTracking.getHandRay('left');
    if (this.handTracking.isHandTracking('right') && rightRay) return rightRay;
    if (this.handTracking.isHandTracking('left') && leftRay) return leftRay;
    return rightRay || leftRay || null;
  }

  getGazeRay() {
    const direction = this._tempRayDirection;
    const origin = this._tempRayOrigin;
    direction.set(0, 0, -1);
    direction.applyQuaternion(this.camera.quaternion);
    origin.copy(this.camera.position);
    return { origin, direction };
  }

  /**
   * Interactive registry
   */
  registerInteractiveObject(object) {
    if (!object) return;
    object.userData.interactive = true;
    this.interactiveObjects.add(object);
  }

  unregisterInteractiveObject(object) {
    if (!object) return;
    object.userData.interactive = false;
    this.interactiveObjects.delete(object);
    if (this.hoveredObject === object) {
      this.triggerHoverEnd(object);
      this.hoveredObject = null;
    }
  }

  /**
   * Selection handling
   */
  handleSelectStart(inputType, hand) {
    if (this.isSelecting) return;
    this.isSelecting = true;
    this.selectingObject = this.hoveredObject;
    if (this.selectingObject) {
      this.triggerSelectStart(this.selectingObject, inputType, hand);
    }
  }

  handleSelectEnd(inputType, hand) {
    if (!this.isSelecting) return;
    const wasSelecting = this.selectingObject;
    this.isSelecting = false;
    if (wasSelecting && this.hoveredObject === wasSelecting) {
      this.triggerSelectEnd(wasSelecting, inputType, hand);
    }
    this.selectingObject = null;
  }

  /**
   * Event triggers
   */
  triggerHoverStart(object) {
    this.onHoverStartCallbacks.forEach(cb => { try { cb(object); } catch (e) { console.error(e); } });
  }

  triggerHoverEnd(object) {
    this.onHoverEndCallbacks.forEach(cb => { try { cb(object); } catch (e) { console.error(e); } });
  }

  triggerSelectStart(object, inputType, hand) {
    this.onSelectStartCallbacks.forEach(cb => { try { cb(object, inputType, hand); } catch (e) { console.error(e); } });
  }

  triggerSelectEnd(object, inputType, hand) {
    this.onSelectEndCallbacks.forEach(cb => { try { cb(object, inputType, hand); } catch (e) { console.error(e); } });
  }

  triggerSqueezeStart(hand) {
    this.onSqueezeStartCallbacks.forEach(cb => { try { cb(hand); } catch (e) { console.error(e); } });
  }

  triggerSqueezeEnd(hand) {
    this.onSqueezeEndCallbacks.forEach(cb => { try { cb(hand); } catch (e) { console.error(e); } });
  }

  triggerModeChange(newMode, prevMode) {
    this.onModeChangeCallbacks.forEach(cb => { try { cb(newMode, prevMode); } catch (e) { console.error(e); } });
  }

  triggerDeviceChange() {
    this.onDeviceChangeCallbacks.forEach(cb => { try { cb(); } catch (e) { console.error(e); } });
  }

  /**
   * Event registration
   */
  onHoverStart(cb) { if (cb) this.onHoverStartCallbacks.push(cb); }
  onHoverEnd(cb) { if (cb) this.onHoverEndCallbacks.push(cb); }
  onSelectStart(cb) { if (cb) this.onSelectStartCallbacks.push(cb); }
  onSelectEnd(cb) { if (cb) this.onSelectEndCallbacks.push(cb); }
  onSqueezeStart(cb) { if (cb) this.onSqueezeStartCallbacks.push(cb); }
  onSqueezeEnd(cb) { if (cb) this.onSqueezeEndCallbacks.push(cb); }
  onModeChange(cb) { if (cb) this.onModeChangeCallbacks.push(cb); }
  onDeviceChange(cb) { if (cb) this.onDeviceChangeCallbacks.push(cb); }

  /**
   * Status helpers (for debug overlay)
   */
  getInputModeStatus() {
    return {
      currentMode: this.currentInputMode,
      controllerAvailable: this.controllers ? (this.controllers.isControllerConnected('left') || this.controllers.isControllerConnected('right')) : false,
      handTrackingAvailable: this.handTracking ? (this.handTracking.isHandTracking('left') || this.handTracking.isHandTracking('right')) : false,
      gazeAvailable: true,
      details: {
        controllers: this.controllers ? {
          left: this.controllers.isControllerConnected('left'),
          right: this.controllers.isControllerConnected('right')
        } : {},
        hands: this.handTracking ? {
          left: this.handTracking.isHandTracking('left'),
          right: this.handTracking.isHandTracking('right')
        } : {}
      }
    };
  }

  getHoveredObject() { return this.hoveredObject; }
  getSelectingObject() { return this.selectingObject; }
  isCurrentlySelecting() { return this.isSelecting; }

  /**
   * Dispose
   */
  dispose() {
    this.interactiveObjects.clear();
    this.onHoverStartCallbacks = [];
    this.onHoverEndCallbacks = [];
    this.onSelectStartCallbacks = [];
    this.onSelectEndCallbacks = [];
    this.onSqueezeStartCallbacks = [];
    this.onSqueezeEndCallbacks = [];
    this.onModeChangeCallbacks = [];
    this.onDeviceChangeCallbacks = [];
    this.hoveredObject = null;
    this.selectingObject = null;
    this.isSelecting = false;
    this.xrSession = null;
    this._isReady = false;
    this._readyPromise = null;
    this._readyResolve = null;
    console.log('VRInputManager: Disposed (rewritten)');
  }
}









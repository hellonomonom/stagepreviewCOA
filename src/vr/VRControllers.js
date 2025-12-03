/**
 * VR Controllers
 * Manages VR controller input and interaction
 * Supports Quest 3 controllers and Vision Pro controllers
 */

import * as THREE from 'three';

export class VRControllers {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    
    this.controllers = [];
    this.controllerGrips = [];
    this.controllerModelFactory = null;
    this.raycaster = new THREE.Raycaster();
    
    // Controller state
    this.leftController = null;
    this.rightController = null;
    this.controllerSelecting = {
      left: false,
      right: false
    };
    
    // Callbacks
    this.onControllerConnectedCallbacks = [];
    this.onControllerDisconnectedCallbacks = [];
    this.onSelectStartCallbacks = [];
    this.onSelectEndCallbacks = [];
    this.onButtonPressCallbacks = []; // For B/Y button presses
    
    // Controller models (optional - for visualization)
    this.showControllerModels = true;
    
    // Button state tracking
    this.buttonStates = {
      left: {},
      right: {}
    };
    
    // Button mappings (Quest 3)
    // Right controller: B button = button 1
    // Left controller: Y button = button 3
    this.buttonMappings = {
      right: { menu: 1 }, // B button
      left: { menu: 3 }   // Y button
    };
    
    // Debug display
    this.debugEnabled = true;
    this.debugTexts = {
      left: null,
      right: null
    };
    
    // Controller connection retry
    this.connectionCheckCount = 0;
    this.maxConnectionChecks = 60; // Check for 60 frames (about 1 second at 60fps)
  }

  /**
   * Initialize controllers
   */
  init(xrSession) {
    if (!xrSession) {
      console.warn('No XR session provided for controller initialization');
      return;
    }

    // Store session reference for button polling
    this.xrSession = xrSession;

    // Listen for input source changes (controllers connecting/disconnecting)
    xrSession.addEventListener('inputsourceschange', (event) => {
      this.handleInputSourcesChange(event);
    });

    // Check existing input sources immediately and set up controllers
    this.checkInputSources(xrSession);

    // Setup controller models if available
    this.loadControllerModels(xrSession);

    console.log('VR controllers initialized');
    
    // Retry controller detection after delays (controllers might connect later)
    // Controllers often take a moment to be recognized after entering VR
    setTimeout(() => {
      this.checkInputSources(xrSession);
    }, 100);
    
    setTimeout(() => {
      this.checkInputSources(xrSession);
    }, 500);
    
    setTimeout(() => {
      this.checkInputSources(xrSession);
    }, 1500);
    
    setTimeout(() => {
      this.checkInputSources(xrSession);
    }, 3000);
  }

  /**
   * Check for input sources and connect controllers
   * @private
   */
  checkInputSources(xrSession) {
    if (!xrSession || !xrSession.inputSources) {
      console.log('No input sources available yet');
      return;
    }
    
    console.log(`Checking ${xrSession.inputSources.length} input sources`);
    
    // Process each input source in the session
    xrSession.inputSources.forEach((inputSource, index) => {
      // Only process tracked-pointer input sources with handedness
      if (inputSource.targetRayMode !== 'tracked-pointer' || !inputSource.handedness) {
        return;
      }
      
      const hand = inputSource.handedness;
      
      // Get or create controller for this input source
      // Use the actual index from inputSources array (not filtered)
      let controller = hand === 'left' ? this.leftController : this.rightController;
      
      if (!controller) {
        // Get controller at this index - Three.js matches controller indices to input source indices
        controller = this.renderer.xr.getController(index);
        
        if (!controller) {
          console.warn(`Could not get controller at index ${index} for ${hand} hand`);
          return;
        }
        
        // Store controller reference by hand
        if (hand === 'left') {
          this.leftController = controller;
        } else if (hand === 'right') {
          this.rightController = controller;
        }
        
        // Add to scene if not already added
        if (!controller.parent || controller.parent !== this.scene) {
          if (controller.parent) {
            controller.parent.remove(controller);
          }
          this.scene.add(controller);
        }
        
        // Setup controller if not already set up
        if (!controller.userData.hand) {
          this.setupController(controller, hand);
          console.log(`✓ ${hand.charAt(0).toUpperCase() + hand.slice(1)} controller created and set up at index ${index}`);
        }
      }
      
      // Always update input source reference on controller
      if (controller) {
        controller.userData.inputSource = inputSource;
        controller.userData.hand = hand;
        controller.userData.inputSourceIndex = index;
      }
    });
  }

  /**
   * Handle input source changes (controllers connecting/disconnecting)
   * @private
   */
  handleInputSourcesChange(event) {
    console.log(`Input sources changed: ${event.added.length} added, ${event.removed.length} removed`);
    
    // Handle added controllers
    event.added.forEach(inputSource => {
      if (inputSource.targetRayMode === 'tracked-pointer' && inputSource.handedness) {
        const hand = inputSource.handedness;
        console.log(`Controller connected: ${hand}`);
        this.checkInputSources(this.xrSession);
      }
    });
    
    // Handle removed controllers
    event.removed.forEach(inputSource => {
      if (inputSource.targetRayMode === 'tracked-pointer' && inputSource.handedness) {
        const hand = inputSource.handedness;
        console.log(`Controller disconnected: ${hand}`);
      }
    });
  }

  /**
   * Handle controller connection
   * @private
   */
  handleControllerConnected(inputSource) {
    const hand = inputSource.handedness;
    console.log(`Controller connected via inputSource: ${hand}`);

    // Get or create controller object
    let controller = null;
    if (hand === 'left') {
      if (!this.leftController) {
        this.leftController = this.renderer.xr.getController(0);
        if (this.leftController) {
          this.scene.add(this.leftController);
          this.setupController(this.leftController, 'left');
        }
      }
      controller = this.leftController;
    } else if (hand === 'right') {
      if (!this.rightController) {
        this.rightController = this.renderer.xr.getController(1);
        if (this.rightController) {
          this.scene.add(this.rightController);
          this.setupController(this.rightController, 'right');
        }
      }
      controller = this.rightController;
    }

    if (controller) {
      // Store input source reference
      controller.userData.inputSource = inputSource;
      console.log(`Controller ${hand} is now ready with gamepad:`, inputSource.gamepad ? 'Yes' : 'No');
    }
  }

  /**
   * Handle controller disconnection
   * @private
   */
  handleControllerDisconnected(inputSource) {
    const hand = inputSource.handedness;
    console.log(`Controller disconnected: ${hand}`);
  }

  /**
   * Setup a controller
   * @private
   */
  setupController(controller, hand) {
    // Create a visible representation (simple line/ray for now)
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -1)
    ]);
    
    const line = new THREE.Line(geometry);
    line.scale.z = 5; // Ray length
    line.name = `ControllerRay_${hand}`;
    
    controller.add(line);
    controller.userData.hand = hand;
    controller.userData.line = line;
    
    // Create debug text display
    if (this.debugEnabled) {
      this.createDebugText(controller, hand);
    }

    // Setup event listeners
    controller.addEventListener('connected', (event) => {
      this.onControllerConnected(event, hand);
    });

    controller.addEventListener('disconnected', (event) => {
      this.onControllerDisconnected(event, hand);
    });

    controller.addEventListener('selectstart', (event) => {
      this.onSelectStart(event, hand);
    });

    controller.addEventListener('selectend', (event) => {
      this.onSelectEnd(event, hand);
    });

    controller.addEventListener('squeezestart', (event) => {
      this.onSqueezeStart(event, hand);
    });

    controller.addEventListener('squeezeend', (event) => {
      this.onSqueezeEnd(event, hand);
    });

    // Setup gamepad button listeners for B/Y buttons
    controller.addEventListener('connected', (event) => {
      this.setupGamepadButtons(controller, hand);
    });
  }

  /**
   * Setup gamepad button handlers (B/Y buttons)
   * @private
   */
  setupGamepadButtons(controller, hand) {
    // We need to poll for button states since WebXR doesn't have button events
    // Store controller reference for polling
    controller.userData.gamepadHand = hand;
    
    // Note: Button polling will be done in update loop
  }

  /**
   * Load controller models (optional)
   * @private
   */
  async loadControllerModels(xrSession) {
    // Try to load controller models if available
    // This is optional and device-specific
    
    try {
      // For Quest 3, we could load models, but for simplicity we'll use simple rays
      // You can extend this to load actual controller models
      
      // Example: Load controller profiles
      if (xrSession.inputSources) {
        xrSession.inputSources.forEach((inputSource) => {
          if (inputSource.handedness && inputSource.targetRayMode === 'tracked-pointer') {
            // Controller is available
            this.createControllerVisualization(inputSource);
          }
        });
      }
    } catch (error) {
      console.warn('Could not load controller models:', error);
    }
  }

  /**
   * Create controller visualization
   * @private
   */
  createControllerVisualization(inputSource) {
    // Simple visualization - you can extend this with actual models
    const controller = inputSource.handedness === 'left' 
      ? this.leftController 
      : this.rightController;
    
    if (!controller) return;

    // Add a simple sphere at controller position for visualization
    if (this.showControllerModels) {
      const geometry = new THREE.SphereGeometry(0.02, 8, 8);
      const material = new THREE.MeshBasicMaterial({ color: 0x00aff0 });
      const sphere = new THREE.Mesh(geometry, material);
      sphere.name = `ControllerSphere_${inputSource.handedness}`;
      controller.add(sphere);
    }
  }

  /**
   * Handle controller connected
   * @private
   */
  onControllerConnected(event, hand) {
    console.log(`Controller connected: ${hand}`);
    this.triggerControllerConnected(event, hand);
  }

  /**
   * Handle controller disconnected
   * @private
   */
  onControllerDisconnected(event, hand) {
    console.log(`Controller disconnected: ${hand}`);
    this.triggerControllerDisconnected(event, hand);
  }

  /**
   * Handle select start (trigger/button press)
   * @private
   */
  onSelectStart(event, hand) {
    this.controllerSelecting[hand] = true;
    this.triggerSelectStart(event, hand);
  }

  /**
   * Handle select end (trigger/button release)
   * @private
   */
  onSelectEnd(event, hand) {
    this.controllerSelecting[hand] = false;
    this.triggerSelectEnd(event, hand);
  }

  /**
   * Handle squeeze start (grip button)
   * @private
   */
  onSqueezeStart(event, hand) {
    // Grip button pressed
    console.log(`Squeeze start: ${hand}`);
  }

  /**
   * Handle squeeze end (grip button release)
   * @private
   */
  onSqueezeEnd(event, hand) {
    // Grip button released
    console.log(`Squeeze end: ${hand}`);
  }

  /**
   * Get controller ray for ray-casting
   * @param {string} hand - 'left' or 'right'
   * @returns {THREE.Ray} Ray from controller
   */
  getControllerRay(hand = 'right') {
    const controller = hand === 'left' ? this.leftController : this.rightController;
    if (!controller) return null;

    const matrix = new THREE.Matrix4();
    matrix.identity().extractRotation(controller.matrixWorld);

    const ray = new THREE.Ray();
    ray.origin.setFromMatrixPosition(controller.matrixWorld);
    ray.direction.set(0, 0, -1).applyMatrix4(matrix);

    return ray;
  }

  /**
   * Perform ray-cast from controller
   * @param {string} hand - 'left' or 'right'
   * @param {THREE.Object3D[]} objects - Objects to test against
   * @returns {THREE.Intersection[]} Intersections
   */
  raycastFromController(hand, objects) {
    const ray = this.getControllerRay(hand);
    if (!ray) return [];

    this.raycaster.set(ray.origin, ray.direction);
    return this.raycaster.intersectObjects(objects, true);
  }

  /**
   * Get controller position
   * @param {string} hand - 'left' or 'right'
   * @returns {THREE.Vector3|null} Controller position in world space
   */
  getControllerPosition(hand = 'right') {
    const controller = hand === 'left' ? this.leftController : this.rightController;
    if (!controller) return null;

    const position = new THREE.Vector3();
    position.setFromMatrixPosition(controller.matrixWorld);
    return position;
  }

  /**
   * Get controller rotation
   * @param {string} hand - 'left' or 'right'
   * @returns {THREE.Quaternion|null} Controller rotation
   */
  getControllerRotation(hand = 'right') {
    const controller = hand === 'left' ? this.leftController : this.rightController;
    if (!controller) return null;

    const quaternion = new THREE.Quaternion();
    quaternion.setFromRotationMatrix(controller.matrixWorld);
    return quaternion;
  }

  /**
   * Check if controller is selecting
   * @param {string} hand - 'left' or 'right'
   * @returns {boolean}
   */
  isSelecting(hand = 'right') {
    return this.controllerSelecting[hand] || false;
  }

  /**
   * Register callback for controller connected
   */
  onControllerConnected(callback) {
    if (typeof callback === 'function') {
      this.onControllerConnectedCallbacks.push(callback);
    }
  }

  /**
   * Register callback for controller disconnected
   */
  onControllerDisconnected(callback) {
    if (typeof callback === 'function') {
      this.onControllerDisconnectedCallbacks.push(callback);
    }
  }

  /**
   * Register callback for select start
   */
  onSelectStart(callback) {
    if (typeof callback === 'function') {
      this.onSelectStartCallbacks.push(callback);
    }
  }

  /**
   * Register callback for select end
   */
  onSelectEnd(callback) {
    if (typeof callback === 'function') {
      this.onSelectEndCallbacks.push(callback);
    }
  }

  /**
   * Register callback for button press (B/Y buttons)
   * @param {Function} callback - (hand, buttonName, buttonIndex) => void
   */
  onButtonPress(callback) {
    if (typeof callback === 'function') {
      this.onButtonPressCallbacks.push(callback);
    }
  }

  /**
   * Trigger controller connected callbacks
   * @private
   */
  triggerControllerConnected(event, hand) {
    this.onControllerConnectedCallbacks.forEach(callback => {
      try {
        callback(event, hand);
      } catch (error) {
        console.error('Error in controller connected callback:', error);
      }
    });
  }

  /**
   * Trigger controller disconnected callbacks
   * @private
   */
  triggerControllerDisconnected(event, hand) {
    this.onControllerDisconnectedCallbacks.forEach(callback => {
      try {
        callback(event, hand);
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
   * Update controller button states (call each frame)
   * Detects B/Y button presses for menu toggle
   */
  update() {
    // Get input sources from XR session
    if (!this.xrSession) return;
    
    // Periodically check for controllers if they're not connected yet
    if (!this.leftController || !this.rightController) {
      this.connectionCheckCount++;
      if (this.connectionCheckCount <= this.maxConnectionChecks && this.connectionCheckCount % 10 === 0) {
        // Check every 10 frames
        this.checkInputSources(this.xrSession);
      }
    }
    
    if (!this.xrSession.inputSources) return;
    
    // Find controllers by handedness
    const rightInputSource = this.xrSession.inputSources.find(src => src.handedness === 'right');
    const leftInputSource = this.xrSession.inputSources.find(src => src.handedness === 'left');
    
    // Update debug text (even if controllers not connected yet)
    if (this.debugEnabled) {
      if (this.rightController) {
        this.updateDebugText(this.rightController, 'right');
      }
      if (this.leftController) {
        this.updateDebugText(this.leftController, 'left');
      }
    }
    
    // Check right controller (B button = button 1)
    if (rightInputSource && rightInputSource.gamepad) {
      const gamepad = rightInputSource.gamepad;
      const buttonIndex = this.buttonMappings.right.menu; // B button
      if (buttonIndex < gamepad.buttons.length) {
        const button = gamepad.buttons[buttonIndex];
        const wasPressed = this.buttonStates.right[buttonIndex] || false;
        const isPressed = button.pressed;
        
        if (!wasPressed && isPressed) {
          // Button just pressed
          this.triggerButtonPress('right', 'B', buttonIndex);
        }
        
        this.buttonStates.right[buttonIndex] = isPressed;
      }
    }
    
    // Check left controller (Y button = button 3)
    if (leftInputSource && leftInputSource.gamepad) {
      const gamepad = leftInputSource.gamepad;
      const buttonIndex = this.buttonMappings.left.menu; // Y button
      if (buttonIndex < gamepad.buttons.length) {
        const button = gamepad.buttons[buttonIndex];
        const wasPressed = this.buttonStates.left[buttonIndex] || false;
        const isPressed = button.pressed;
        
        if (!wasPressed && isPressed) {
          // Button just pressed
          this.triggerButtonPress('left', 'Y', buttonIndex);
        }
        
        this.buttonStates.left[buttonIndex] = isPressed;
      }
    }
  }

  /**
   * Create debug text display for controller
   * @private
   */
  createDebugText(controller, hand) {
    // Create canvas for text rendering
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    
    // Create texture from canvas
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    
    // Create sprite material
    const spriteMaterial = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false
    });
    
    // Create sprite
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(0.3, 0.15, 1); // Make it readable size
    sprite.position.set(0, 0.15, 0); // Position above controller
    
    // Store references
    controller.userData.debugCanvas = canvas;
    controller.userData.debugContext = context;
    controller.userData.debugTexture = texture;
    controller.userData.debugSprite = sprite;
    
    // Add to controller
    controller.add(sprite);
    
    // Store in debugTexts
    this.debugTexts[hand] = sprite;
    
    // Initial text
    this.updateDebugText(controller, hand);
  }

  /**
   * Update debug text display
   * @private
   */
  updateDebugText(controller, hand) {
    if (!controller || !controller.userData.debugCanvas || !controller.userData.debugContext) {
      // Controller not set up yet, but we still want to show debug text
      // Create a temporary debug display if controller object exists
      if (controller && !controller.userData.debugCanvas) {
        this.createDebugText(controller, hand);
      }
      return;
    }
    
    const canvas = controller.userData.debugCanvas;
    const ctx = controller.userData.debugContext;
    const texture = controller.userData.debugTexture;
    
    // Clear canvas
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Text style
    ctx.font = 'bold 24px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    
    let y = 10;
    const lineHeight = 30;
    
    // Header
    ctx.fillStyle = '#00ff00';
    ctx.font = 'bold 28px monospace';
    ctx.fillText(`${hand.toUpperCase()} Controller`, 10, y);
    y += lineHeight + 5;
    
    // Reset font
    ctx.font = 'bold 20px monospace';
    ctx.fillStyle = '#ffffff';
    
    // Get input source for gamepad data
    let gamepad = null;
    let inputSource = null;
    if (this.xrSession && this.xrSession.inputSources) {
      inputSource = this.xrSession.inputSources.find(src => src.handedness === hand);
      if (inputSource && inputSource.gamepad) {
        gamepad = inputSource.gamepad;
      }
    }
    
    // Check if controller input source is connected
    if (!inputSource) {
      ctx.fillStyle = '#ffaa00';
      ctx.font = 'bold 22px monospace';
      ctx.fillText('WAITING FOR', 10, y);
      y += lineHeight;
      ctx.fillText('CONTROLLER...', 10, y);
      texture.needsUpdate = true;
      return;
    }
    
    // Button states
    if (gamepad) {
      ctx.fillText(`Buttons: ${gamepad.buttons.length}`, 10, y);
      y += lineHeight;
      
      // Show each button state
      for (let i = 0; i < gamepad.buttons.length && i < 8; i++) {
        const button = gamepad.buttons[i];
        const isPressed = button.pressed;
        const value = button.value.toFixed(2);
        
        ctx.fillStyle = isPressed ? '#00ff00' : '#888888';
        ctx.fillText(`  B${i}: ${isPressed ? 'PRESSED' : '---'} (${value})`, 20, y);
        y += lineHeight - 5;
      }
      
      // Thumbstick/Axes
      if (gamepad.axes.length > 0) {
        y += 5;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`Axes: ${gamepad.axes.length}`, 10, y);
        y += lineHeight;
        
        for (let i = 0; i < gamepad.axes.length && i < 4; i++) {
          const axis = gamepad.axes[i];
          ctx.fillText(`  A${i}: ${axis.toFixed(2)}`, 20, y);
          y += lineHeight - 5;
        }
      }
    } else {
      ctx.fillStyle = '#ff0000';
      ctx.fillText('No gamepad data', 10, y);
    }
    
    // Trigger/Select state
    y += 5;
    ctx.font = 'bold 22px monospace';
    const isSelecting = this.controllerSelecting[hand] || false;
    ctx.fillStyle = isSelecting ? '#00ff00' : '#888888';
    ctx.fillText(`Select/Trigger: ${isSelecting ? 'PRESSED' : '---'}`, 10, y);
    
    // Update texture
    texture.needsUpdate = true;
  }

  /**
   * Trigger button press callbacks
   * @private
   */
  triggerButtonPress(hand, buttonName, buttonIndex) {
    this.onButtonPressCallbacks.forEach(callback => {
      try {
        callback(hand, buttonName, buttonIndex);
      } catch (error) {
        console.error('Error in button press callback:', error);
      }
    });
  }

  /**
   * Cleanup
   */
  dispose() {
    // Remove controllers from scene
    if (this.leftController && this.leftController.parent) {
      this.leftController.parent.remove(this.leftController);
    }
    if (this.rightController && this.rightController.parent) {
      this.rightController.parent.remove(this.rightController);
    }

    // Clear callbacks
    this.onControllerConnectedCallbacks = [];
    this.onControllerDisconnectedCallbacks = [];
    this.onSelectStartCallbacks = [];
    this.onSelectEndCallbacks = [];
    this.onButtonPressCallbacks = [];

    this.leftController = null;
    this.rightController = null;
  }
}


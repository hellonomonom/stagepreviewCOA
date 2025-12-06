import * as THREE from 'three';

/**
 * VRDebugOverlay - Debug information overlay for VR
 * Displays input mode status, logs, and other debug information in VR space
 */
export class VRDebugOverlay {
  constructor(camera, inputManager, controllers, handTracking, player = null, vrManager = null) {
    this.camera = camera;
    this.inputManager = inputManager;
    this.controllers = controllers;
    this.handTracking = handTracking;
    this.player = player; // VR player reference
    this.vrManager = vrManager; // VRManager reference to check VR state
    
    // Overlay group
    this.group = new THREE.Group();
    this.group.name = 'VRDebugOverlay';
    
    // Visibility
    this.visible = false;
    this.enabled = true; // Can be disabled entirely
    
    // Panel settings
    this.width = 1.2; // meters
    this.height = 1.8; // meters (increased to fit all content, matches canvas aspect ratio 512x768)
    this.distance = 1.5; // meters from camera
    this.positionOffset = new THREE.Vector3(0, 0.2, -1.5); // Offset from camera
    this.worldSpace = false; // Whether positioned in world space (fixed) or relative to camera
    this.worldPosition = new THREE.Vector3(0, 2.2, -2); // Fixed world position when worldSpace is true
    
    // Text settings (reduced to 75% of original)
    this.fontSize = 18; // was 24, now 18 (75%)
    this.lineHeight = 21; // was 28, now 21 (75%)
    this.padding = 8; // was 10, now 8 (75%)
    this.maxLogLines = 10;
    
    // FPS tracking
    this.fps = 0;
    this.frameCount = 0;
    this.lastFpsTime = performance.now();
    this.frameTimes = [];
    
    // Logs
    this.logs = [];
    this.maxLogs = 50;
    
    // Panel mesh and texture
    this.panelMesh = null;
    this.canvas = null;
    this.context = null;
    this.texture = null;
    this.material = null;
    
    // Update throttling
    this.lastUpdateTime = 0;
    this.updateInterval = 100; // Update every 100ms (10 FPS for text)
    
    // Create overlay
    this.createOverlay();
    
    // Keyboard shortcut (D key to toggle)
    this.setupKeyboardShortcut();
  }

  /**
   * Create overlay panel
   * @private
   */
  createOverlay() {
    // Create canvas for text rendering (higher resolution for better text quality)
    // Increased height to fit all content
    this.canvas = document.createElement('canvas');
    this.canvas.width = 512;
    this.canvas.height = 768; // Increased from 512 to fit all content
    this.context = this.canvas.getContext('2d');
    
    // Create texture from canvas
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.needsUpdate = true;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    
    // Create panel material
    this.material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false
    });
    
    // Create panel geometry (adjusted height to fit all content)
    const geometry = new THREE.PlaneGeometry(this.width, this.height);
    this.panelMesh = new THREE.Mesh(geometry, this.material);
    this.panelMesh.name = 'DebugPanel';
    this.panelMesh.renderOrder = 1000; // Render on top
    
    this.group.add(this.panelMesh);
    
    // Start hidden - will be shown when VR is active
    this.visible = true;
    this.group.visible = false; // Hidden by default until VR is active
    
    // Draw initial content
    this.updateDisplay();
  }

  /**
   * Setup keyboard shortcut to toggle overlay
   * @private
   */
  setupKeyboardShortcut() {
    document.addEventListener('keydown', (event) => {
      // D key to toggle debug overlay
      if (event.key === 'd' || event.key === 'D') {
        // Only toggle if not typing in an input field
        if (event.target.tagName !== 'INPUT' && event.target.tagName !== 'TEXTAREA') {
          this.toggle();
        }
      }
    });
  }

  /**
   * Update FPS counter (should be called every frame)
   * @private
   */
  updateFPS() {
    const now = performance.now();
    this.frameCount++;
    
    // Calculate FPS every second
    if (now - this.lastFpsTime >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastFpsTime = now;
    }
  }
  
  /**
   * Record a frame for FPS calculation
   * Call this every frame from the render loop
   */
  recordFrame() {
    this.updateFPS();
  }

  /**
   * Update display with current debug information
   */
  updateDisplay() {
    if (!this.enabled || !this.visible) return;
    
    // Update FPS
    this.updateFPS();
    
    const now = Date.now();
    if (now - this.lastUpdateTime < this.updateInterval) return;
    this.lastUpdateTime = now;
    
    const ctx = this.context;
    const canvas = this.canvas;
    
    // Clear canvas
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw border
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);
    
    // Set text style
    ctx.font = `bold ${this.fontSize}px monospace`;
    ctx.fillStyle = '#00ffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    
    let y = this.padding;
    
    // FPS Counter at the top
    ctx.fillStyle = '#00ff00';
    ctx.font = `bold ${this.fontSize + 2}px monospace`;
    ctx.textAlign = 'right';
    ctx.fillText(`FPS: ${this.fps}`, canvas.width - this.padding, y);
    ctx.textAlign = 'left';
    y += this.lineHeight + 3;
    
    // Title
    ctx.fillStyle = '#00ffff';
    ctx.font = `bold ${Math.round((this.fontSize + 4) * 0.75)}px monospace`; // 75% of original
    ctx.fillText('VR DEBUG OVERLAY', this.padding, y);
    y += this.lineHeight + 4;
    
    // Divider
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.moveTo(this.padding, y);
    ctx.lineTo(canvas.width - this.padding, y);
    ctx.stroke();
    y += 8;
    
    // Input Mode Status
    if (this.inputManager) {
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${this.fontSize}px monospace`;
      ctx.fillText('INPUT MODE:', this.padding, y);
      y += this.lineHeight;
      
      const status = this.inputManager.getInputModeStatus();
      const mode = status.currentMode.toUpperCase();
      
      // Color code mode
      if (mode === 'CONTROLLER') {
        ctx.fillStyle = '#00ff00';
      } else if (mode === 'HAND') {
        ctx.fillStyle = '#ffff00';
      } else {
        ctx.fillStyle = '#ff8800'; // Gaze
      }
      
      ctx.font = `${this.fontSize}px monospace`;
      ctx.fillText(`  Mode: ${mode}`, this.padding, y);
      y += this.lineHeight;
      
      ctx.fillStyle = '#cccccc';
      ctx.font = `${Math.round((this.fontSize - 2) * 0.75)}px monospace`; // 75% of original
      ctx.fillText(`  Controllers: ${status.controllerAvailable ? 'YES' : 'NO'}`, this.padding, y);
      y += this.lineHeight - 1;
      ctx.fillText(`  Hand Tracking: ${status.handTrackingAvailable ? 'YES' : 'NO'}`, this.padding, y);
      y += this.lineHeight - 1;
      ctx.fillText(`  Gaze: ${status.gazeAvailable ? 'YES' : 'NO'}`, this.padding, y);
      y += this.lineHeight;
    }
    
    // Divider
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.moveTo(this.padding, y);
    ctx.lineTo(canvas.width - this.padding, y);
    ctx.stroke();
    y += 8;
    
    // Interaction State
    if (this.inputManager) {
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${this.fontSize}px monospace`;
      ctx.fillText('INTERACTION:', this.padding, y);
      y += this.lineHeight;
      
      ctx.fillStyle = '#cccccc';
      ctx.font = `${Math.round((this.fontSize - 2) * 0.75)}px monospace`; // 75% of original
      
      const hovered = this.inputManager.getHoveredObject();
      ctx.fillText(`  Hovered: ${hovered ? (hovered.name || 'unnamed') : 'NONE'}`, this.padding, y);
      y += this.lineHeight - 1;
      
      const selecting = this.inputManager.getSelectingObject();
      ctx.fillText(`  Selecting: ${selecting ? (selecting.name || 'unnamed') : 'NONE'}`, this.padding, y);
      y += this.lineHeight - 1;
      
      const isSelecting = this.inputManager.isCurrentlySelecting();
      ctx.fillText(`  Is Selecting: ${isSelecting ? 'YES' : 'NO'}`, this.padding, y);
      y += this.lineHeight;
    }
    
    // Divider
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.moveTo(this.padding, y);
    ctx.lineTo(canvas.width - this.padding, y);
    ctx.stroke();
    y += 8;
    
    // Controller Details
    if (this.controllers) {
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${this.fontSize}px monospace`;
      ctx.fillText('CONTROLLERS:', this.padding, y);
      y += this.lineHeight;
      
      ctx.fillStyle = '#cccccc';
      ctx.font = `${Math.round((this.fontSize - 2) * 0.75)}px monospace`; // 75% of original
      
      const leftConnected = this.controllers.isControllerConnected('left');
      const rightConnected = this.controllers.isControllerConnected('right');
      ctx.fillText(`  Left: ${leftConnected ? 'CONNECTED' : 'DISCONNECTED'}`, this.padding, y);
      y += this.lineHeight - 1;
      ctx.fillText(`  Right: ${rightConnected ? 'CONNECTED' : 'DISCONNECTED'}`, this.padding, y);
      y += this.lineHeight;
    }
    
    // Hand Tracking Details
    if (this.handTracking) {
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${this.fontSize}px monospace`;
      ctx.fillText('HAND TRACKING:', this.padding, y);
      y += this.lineHeight;
      
      ctx.fillStyle = '#cccccc';
      ctx.font = `${Math.round((this.fontSize - 2) * 0.75)}px monospace`; // 75% of original
      
      const leftTracking = this.handTracking.isHandTracking('left');
      const rightTracking = this.handTracking.isHandTracking('right');
      ctx.fillText(`  Left: ${leftTracking ? 'TRACKING' : 'NOT TRACKING'}`, this.padding, y);
      y += this.lineHeight - 1;
      ctx.fillText(`  Right: ${rightTracking ? 'TRACKING' : 'NOT TRACKING'}`, this.padding, y);
      y += this.lineHeight - 1;
      
      const leftPinching = this.handTracking.isHandPinching('left');
      const rightPinching = this.handTracking.isHandPinching('right');
      ctx.fillText(`  Left Pinch: ${leftPinching ? 'YES' : 'NO'}`, this.padding, y);
      y += this.lineHeight - 1;
      ctx.fillText(`  Right Pinch: ${rightPinching ? 'YES' : 'NO'}`, this.padding, y);
      y += this.lineHeight;
    }
    
    // Divider
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.moveTo(this.padding, y);
    ctx.lineTo(canvas.width - this.padding, y);
    ctx.stroke();
    y += 8;
    
    // Recent Logs
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${this.fontSize}px monospace`;
    ctx.fillText('RECENT LOGS:', this.padding, y);
    y += this.lineHeight;
    
    ctx.fillStyle = '#888888';
    ctx.font = `${Math.round((this.fontSize - 4) * 0.75)}px monospace`; // 75% of original
    
    const recentLogs = this.logs.slice(-this.maxLogLines);
    recentLogs.forEach((log, index) => {
      if (y > canvas.height - this.padding) return; // Don't draw outside canvas
      
      // Color code log types
      if (log.type === 'error') {
        ctx.fillStyle = '#ff4444';
      } else if (log.type === 'warn') {
        ctx.fillStyle = '#ffaa00';
      } else if (log.type === 'info') {
        ctx.fillStyle = '#00ff00';
      } else {
        ctx.fillStyle = '#888888';
      }
      
      const time = new Date(log.timestamp).toLocaleTimeString();
      const text = `[${time}] ${log.message}`;
      ctx.fillText(text, this.padding, y);
      y += this.lineHeight - 3;
    });
    
    // Update texture
    this.texture.needsUpdate = true;
  }

  /**
   * Add log message
   * @param {string} message - Log message
   * @param {string} type - Log type ('info', 'warn', 'error')
   */
  addLog(message, type = 'info') {
    this.logs.push({
      message,
      type,
      timestamp: Date.now()
    });
    
    // Keep only recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
    
    // Update display if visible
    if (this.visible) {
      this.updateDisplay();
    }
  }

  /**
   * Update overlay position and content
   * @param {THREE.Camera} camera - Camera to follow
   */
  update(camera) {
    // Check if VR is active - hide if not in VR
    if (this.vrManager && !this.vrManager.getIsVRActive()) {
      this.group.visible = false;
      return;
    }
    
    if (!this.enabled || !this.visible) {
      this.group.visible = false;
      return;
    }
    
    // Show group when VR is active and overlay is enabled/visible
    this.group.visible = true;
    
    // Update FPS every frame (even if display update is throttled)
    this.updateFPS();
    
    // If in world space, use fixed position
    if (this.worldSpace) {
      // Fixed position in world space
      this.group.position.copy(this.worldPosition);
      
      // Face the camera so it's always readable
      if (camera) {
        this.group.lookAt(camera.position);
      } else {
        // Fallback: face forward (toward negative Z)
        this.group.lookAt(
          this.worldPosition.x,
          this.worldPosition.y,
          this.worldPosition.z - 1
        );
      }
    } else if (this.player) {
      // If attached to player, position is handled by parent transform
      // Just set local position offset
      this.group.position.copy(this.positionOffset);
      
      // Face forward (will be rotated by player's rotation)
      this.group.lookAt(
        this.group.position.x,
        this.group.position.y,
        this.group.position.z - 1
      );
    } else {
      // Fallback: update position relative to camera (old method)
      if (camera) {
        const offset = this.positionOffset.clone();
        offset.applyQuaternion(camera.quaternion);
        
        this.group.position.copy(camera.position);
        this.group.position.add(offset);
        
        // Face the camera
        this.group.lookAt(camera.position);
      }
    }
    
    // Update display
    this.updateDisplay();
  }
  
  /**
   * Set world space positioning
   * @param {boolean} enabled - Enable world space positioning
   * @param {THREE.Vector3} [position] - Optional world position (defaults to above test button)
   */
  setWorldSpace(enabled, position = null) {
    this.worldSpace = enabled;
    if (position) {
      this.worldPosition.copy(position);
    }
  }

  /**
   * Show overlay
   */
  show() {
    if (!this.enabled) return;
    this.visible = true;
    this.group.visible = true;
    this.updateDisplay();
    this.addLog('Debug overlay shown', 'info');
  }

  /**
   * Hide overlay
   */
  hide() {
    this.visible = false;
    this.group.visible = false;
  }

  /**
   * Toggle overlay visibility
   */
  toggle() {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Set enabled state
   * @param {boolean} enabled
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      this.hide();
    }
  }

  /**
   * Get overlay group (to add to scene)
   * @returns {THREE.Group}
   */
  getGroup() {
    return this.group;
  }

  /**
   * Dispose and clean up
   */
  dispose() {
    if (this.texture) {
      this.texture.dispose();
    }
    if (this.material) {
      this.material.dispose();
    }
    if (this.panelMesh && this.panelMesh.geometry) {
      this.panelMesh.geometry.dispose();
    }
    this.logs = [];
    this.group.clear();
  }
}


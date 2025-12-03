/**
 * VR Button - 3D button component for VR UI
 */

import * as THREE from 'three';

export class VRButton {
  constructor(options = {}) {
    this.label = options.label || 'Button';
    this.width = options.width || 0.4;
    this.height = options.height || 0.1;
    this.depth = options.depth || 0.02;
    
    // Button mesh
    this.buttonMesh = null;
    this.labelMesh = null;
    this.group = new THREE.Group();
    this.group.name = `VRButton_${this.label}`;
    
    // State
    this.isPressed = false;
    this.isHovered = false;
    
    // Colors
    this.colorNormal = options.color || 0x00aff0;
    this.colorHover = options.colorHover || 0x00d0ff;
    this.colorPressed = options.colorPressed || 0x0090cc;
    
    // Callbacks
    this.onClickCallbacks = [];
    this.onHoverCallbacks = [];
    this.onLeaveCallbacks = [];
    
    // Make interactive
    this.group.userData.interactive = true;
    this.group.userData.button = this;
    
    this.createButton();
  }

  /**
   * Create button mesh
   * @private
   */
  createButton() {
    // Button background
    const geometry = new THREE.BoxGeometry(this.width, this.height, this.depth);
    const material = new THREE.MeshBasicMaterial({
      color: this.colorNormal,
      transparent: true,
      opacity: 0.9
    });
    
    this.buttonMesh = new THREE.Mesh(geometry, material);
    this.buttonMesh.name = 'ButtonBackground';
    this.group.add(this.buttonMesh);
    
    // Label (simplified - use a simple plane with text texture or geometry)
    // For now, we'll create a simple text representation
    // In production, you'd use a proper text texture or 3D text library
    this.createLabel();
  }

  /**
   * Create label (simplified)
   * @private
   */
  createLabel() {
    // Simple placeholder - in production use proper text rendering
    // For now, we'll use a colored plane as placeholder
    const labelGeometry = new THREE.PlaneGeometry(this.width * 0.9, this.height * 0.5);
    const labelMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide
    });
    
    this.labelMesh = new THREE.Mesh(labelGeometry, labelMaterial);
    this.labelMesh.position.z = this.depth / 2 + 0.001;
    this.labelMesh.name = 'ButtonLabel';
    this.group.add(this.labelMesh);
    
    // Store label text for reference
    this.group.userData.labelText = this.label;
  }

  /**
   * Handle click
   */
  onClick() {
    this.isPressed = true;
    this.updateColor();
    
    // Trigger callbacks
    this.onClickCallbacks.forEach(callback => {
      try {
        callback(this);
      } catch (error) {
        console.error('Error in button click callback:', error);
      }
    });
    
    // Reset after animation
    setTimeout(() => {
      this.isPressed = false;
      this.updateColor();
    }, 200);
  }

  /**
   * Handle hover
   */
  onHover() {
    if (this.isHovered) return;
    
    this.isHovered = true;
    this.updateColor();
    
    // Trigger callbacks
    this.onHoverCallbacks.forEach(callback => {
      try {
        callback(this);
      } catch (error) {
        console.error('Error in button hover callback:', error);
      }
    });
  }

  /**
   * Handle leave
   */
  onLeave() {
    if (!this.isHovered) return;
    
    this.isHovered = false;
    this.updateColor();
    
    // Trigger callbacks
    this.onLeaveCallbacks.forEach(callback => {
      try {
        callback(this);
      } catch (error) {
        console.error('Error in button leave callback:', error);
      }
    });
  }

  /**
   * Update button color based on state
   * @private
   */
  updateColor() {
    if (!this.buttonMesh) return;
    
    let color = this.colorNormal;
    if (this.isPressed) {
      color = this.colorPressed;
    } else if (this.isHovered) {
      color = this.colorHover;
    }
    
    if (this.buttonMesh.material) {
      this.buttonMesh.material.color.setHex(color);
    }
  }

  /**
   * Register click callback
   * @param {Function} callback
   */
  onClick(callback) {
    if (typeof callback === 'function') {
      this.onClickCallbacks.push(callback);
    }
  }

  /**
   * Register hover callback
   * @param {Function} callback
   */
  onHover(callback) {
    if (typeof callback === 'function') {
      this.onHoverCallbacks.push(callback);
    }
  }

  /**
   * Register leave callback
   * @param {Function} callback
   */
  onLeave(callback) {
    if (typeof callback === 'function') {
      this.onLeaveCallbacks.push(callback);
    }
  }

  /**
   * Get button group
   * @returns {THREE.Group}
   */
  getGroup() {
    return this.group;
  }

  /**
   * Set position
   * @param {THREE.Vector3|number} x - X position or Vector3
   * @param {number} y - Y position (if x is number)
   * @param {number} z - Z position (if x is number)
   */
  setPosition(x, y, z) {
    if (x instanceof THREE.Vector3) {
      this.group.position.copy(x);
    } else {
      this.group.position.set(x, y, z);
    }
  }

  /**
   * Cleanup
   */
  dispose() {
    if (this.buttonMesh) {
      this.buttonMesh.geometry.dispose();
      if (this.buttonMesh.material) {
        this.buttonMesh.material.dispose();
      }
    }
    
    if (this.labelMesh) {
      this.labelMesh.geometry.dispose();
      if (this.labelMesh.material) {
        this.labelMesh.material.dispose();
      }
    }
    
    if (this.group.parent) {
      this.group.parent.remove(this.group);
    }
    
    this.onClickCallbacks = [];
    this.onHoverCallbacks = [];
    this.onLeaveCallbacks = [];
  }
}


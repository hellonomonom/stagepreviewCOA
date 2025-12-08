/**
 * VRMenu - Simple floating menu for VR
 * Displays a menu panel with buttons in VR space
 */

import * as THREE from 'three';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';

export class VRMenu {
  constructor(camera, vrManager = null) {
    this.camera = camera;
    this.vrManager = vrManager;
    
    // Menu group
    this.menuGroup = new THREE.Group();
    this.menuGroup.name = 'VRMenu';
    
    // Menu panel
    this.panel = null;
    this.buttons = [];
    
    // Menu state
    this.visible = true;
    this.position = new THREE.Vector3(0, 1.6, -1.5); // In front of user at eye level
    
    // Create menu
    this.createMenu();
    
    // Make menu more visible for debugging
    console.log('VRMenu: Created at position', this.position);
    console.log('VRMenu: Menu group visible:', this.menuGroup.visible);
  }

  /**
   * Create the menu panel and buttons
   */
  createMenu() {
    // Create panel background (make it bigger and more visible)
    const panelWidth = 1.0;
    const panelHeight = 0.6;
    const panelDepth = 0.02;
    
    const panelGeometry = new THREE.BoxGeometry(panelWidth, panelHeight, panelDepth);
    const panelMaterial = new THREE.MeshBasicMaterial({
      color: 0x444444, // Lighter gray for better visibility
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide // Render both sides
    });
    
    this.panel = new THREE.Mesh(panelGeometry, panelMaterial);
    this.panel.position.set(0, 0, 0);
    this.menuGroup.add(this.panel);
    
    // Add border for better visibility
    const borderGeometry = new THREE.EdgesGeometry(panelGeometry);
    const borderMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 });
    const border = new THREE.LineSegments(borderGeometry, borderMaterial);
    this.panel.add(border);
    
    // Create button
    const button = this.createButton('Test Button', 0, 0, () => {
      console.log('VR Menu: Button clicked!');
      // You can add button functionality here
    });
    
    this.buttons.push(button);
    this.menuGroup.add(button.group);
    
    // Position menu (will be set by VRManager)
    // this.menuGroup.position.copy(this.position);
    
    // Make menu visible and ensure it's in the scene
    this.menuGroup.visible = true;
    
    // Ensure all children are visible
    this.menuGroup.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) {
        child.visible = true;
        child.frustumCulled = false; // Don't cull, always render
      }
    });
    
    console.log('VRMenu: Menu created');
    console.log('VRMenu: Panel visible:', this.panel.visible);
    console.log('VRMenu: Button visible:', button.mesh.visible);
  }

  /**
   * Create a button
   */
  createButton(label, x, y, onClick) {
    const buttonGroup = new THREE.Group();
    
    // Button background (make it bigger and more visible)
    const buttonWidth = 0.8;
    const buttonHeight = 0.15;
    const buttonDepth = 0.05; // Increased depth for better raycasting
    
    const buttonGeometry = new THREE.BoxGeometry(buttonWidth, buttonHeight, buttonDepth);
    const buttonMaterial = new THREE.MeshBasicMaterial({
      color: 0x00aaff,
      transparent: true,
      opacity: 1.0, // Fully opaque
      side: THREE.DoubleSide
    });
    
    // Button background mesh - this is the main hoverable area
    const buttonMesh = new THREE.Mesh(buttonGeometry, buttonMaterial);
    buttonMesh.position.set(x, y, 0);
    // Make sure button is raycastable and visible
    buttonMesh.visible = true;
    buttonMesh.frustumCulled = false; // Always render
    // Ensure material is not transparent to raycasting
    buttonMesh.material.side = THREE.DoubleSide; // Render both sides
    buttonGroup.add(buttonMesh);
    
    // Button label (simple text using canvas texture)
    // Create canvas for text
    const canvas = document.createElement('canvas');
    canvas.width = 512; // Higher resolution for better text quality
    canvas.height = 128;
    const context = canvas.getContext('2d');
    
    // Clear canvas with transparent background
    context.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw text
    context.fillStyle = '#ffffff';
    context.font = 'Bold 72px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(label, canvas.width / 2, canvas.height / 2);
    
    // Create texture from canvas
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    
    // Create label geometry and material
    const labelGeometry = new THREE.PlaneGeometry(buttonWidth * 0.9, buttonHeight * 0.6);
    const labelMaterial = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 1.0, // Fully opaque
      side: THREE.DoubleSide,
      depthWrite: false // Prevent z-fighting with button
    });
    
    const labelMesh = new THREE.Mesh(labelGeometry, labelMaterial);
    labelMesh.position.set(x, y, 0.03); // Position slightly in front of button
    // Label is just visual - don't make it hoverable
    labelMesh.raycast = () => {}; // Disable raycasting on label
    labelMesh.visible = true; // Ensure label is visible
    labelMesh.frustumCulled = false; // Always render
    buttonGroup.add(labelMesh);
    
    // Store button data
    const button = {
      group: buttonGroup,
      mesh: buttonMesh,
      label: label,
      onClick: onClick,
      hovered: false,
      originalColor: 0x00aaff, // Store original color
      hoverColor: 0x00ffff, // Cyan for hover
      pressedColor: 0x00ff00 // Green for click
    };
    
    // Add hover effect - set userData on the button mesh
    buttonMesh.userData.button = button;
    buttonMesh.userData.isButton = true;
    buttonMesh.userData.buttonLabel = label; // For debugging
    
    // Also set on the group for fallback
    buttonGroup.userData.button = button;
    buttonGroup.userData.isButton = true;
    
    console.log('VRMenu: Created button mesh:', {
      position: buttonMesh.position,
      visible: buttonMesh.visible,
      geometry: buttonMesh.geometry.type,
      hasUserData: !!buttonMesh.userData.isButton
    });
    
    return button;
  }

  /**
   * Get menu group for adding to scene
   */
  getGroup() {
    return this.menuGroup;
  }

  /**
   * Update menu (face camera, handle interactions)
   */
  update() {
    if (!this.visible) return;
    
    // Ensure menu is visible
    if (!this.menuGroup.visible) {
      this.menuGroup.visible = true;
    }
    
    // Make menu face camera
    if (this.camera) {
      // In VR, camera position is at origin in head space
      // Menu should face the camera direction
      // Get camera world position
      const cameraWorldPos = new THREE.Vector3();
      this.camera.getWorldPosition(cameraWorldPos);
      
      // Get menu world position
      const menuWorldPos = new THREE.Vector3();
      this.menuGroup.getWorldPosition(menuWorldPos);
      
      // Calculate direction from menu to camera
      const direction = new THREE.Vector3();
      direction.subVectors(cameraWorldPos, menuWorldPos);
      
      // Make menu face camera (but keep it upright - only rotate around Y axis)
      if (direction.length() > 0) {
        // Only rotate around Y axis to keep menu upright
        const angle = Math.atan2(direction.x, direction.z);
        this.menuGroup.rotation.y = angle;
      }
    }
    
    // Update button hover states (can be extended for ray interaction)
    this.updateButtons();
  }

  /**
   * Update button states (check for hover)
   */
  updateButtons() {
    if (!this.vrManager || !this.visible) return;
    
    // Track which button is currently hovered
    let hoveredButton = null;
    
    // Check controller rays for hover (prioritize right controller)
    if (this.vrManager.controllers) {
      // Check right controller first (most common)
      const rightRay = this.vrManager.controllers.getControllerRay('right');
      if (rightRay && rightRay.origin && rightRay.direction) {
        const button = this.checkButtonHover(rightRay.origin, rightRay.direction);
        if (button) {
          hoveredButton = button;
        }
      }
      
      // Check left controller if right didn't hit
      if (!hoveredButton) {
        const leftRay = this.vrManager.controllers.getControllerRay('left');
        if (leftRay && leftRay.origin && leftRay.direction) {
          const button = this.checkButtonHover(leftRay.origin, leftRay.direction);
          if (button) {
            hoveredButton = button;
          }
        }
      }
    }
    
    // Debug: Log if we have rays but no hover (only once per second to avoid spam)
    if (!this._lastDebugLog || Date.now() - this._lastDebugLog > 1000) {
      if (this.vrManager.controllers) {
        const rightRay = this.vrManager.controllers.getControllerRay('right');
        if (rightRay && rightRay.origin && rightRay.direction && !hoveredButton) {
          // Check if ray is pointing in the general direction of menu
          const menuWorldPos = new THREE.Vector3();
          this.menuGroup.getWorldPosition(menuWorldPos);
          const toMenu = new THREE.Vector3().subVectors(menuWorldPos, rightRay.origin);
          const distance = toMenu.length();
          const dot = toMenu.normalize().dot(rightRay.direction);
          
          if (distance < 5 && dot > 0.5) {
            console.log('VRMenu: Ray pointing at menu but no intersection. Distance:', distance.toFixed(2), 'Dot:', dot.toFixed(2));
          }
        }
      }
      this._lastDebugLog = Date.now();
    }
    
    // Check hand tracking rays for hover (only if no controller hover)
    if (!hoveredButton && this.vrManager.handTracking) {
      // Check right hand first
      const rightHandRay = this.vrManager.handTracking.getHandRay('right');
      if (rightHandRay && rightHandRay.origin && rightHandRay.direction) {
        const button = this.checkButtonHover(rightHandRay.origin, rightHandRay.direction);
        if (button) {
          hoveredButton = button;
        }
      }
      
      // Check left hand if right didn't hit
      if (!hoveredButton) {
        const leftHandRay = this.vrManager.handTracking.getHandRay('left');
        if (leftHandRay && leftHandRay.origin && leftHandRay.direction) {
          const button = this.checkButtonHover(leftHandRay.origin, leftHandRay.direction);
          if (button) {
            hoveredButton = button;
          }
        }
      }
    }
    
    // Update button hover states
    this.buttons.forEach(button => {
      const isHovered = button === hoveredButton;
      
      if (isHovered && !button.hovered) {
        // Just started hovering
        button.hovered = true;
        button.mesh.material.color.setHex(button.hoverColor);
        button.group.scale.set(1.05, 1.05, 1.05);
        console.log('VRMenu: Button hovered:', button.label);
      } else if (!isHovered && button.hovered) {
        // Just stopped hovering
        button.hovered = false;
        button.mesh.material.color.setHex(button.originalColor);
        button.group.scale.set(1.0, 1.0, 1.0);
      }
    });
  }

  /**
   * Check if ray is hovering over a button
   * @param {THREE.Vector3} origin - Ray origin
   * @param {THREE.Vector3} direction - Ray direction
   * @returns {Object|null} Button that is being hovered, or null
   */
  checkButtonHover(origin, direction) {
    if (!this.visible || !origin || !direction) return null;
    
    // Validate direction is not zero
    if (direction.lengthSq() < 0.001) return null;
    
    // Create raycaster with a reasonable far distance
    const raycaster = new THREE.Raycaster();
    raycaster.set(origin, direction);
    raycaster.far = 10; // Check up to 10 meters
    
    // Collect all button background meshes to check
    const buttonMeshes = [];
    this.buttons.forEach(button => {
      if (button.mesh && button.mesh.visible) {
        buttonMeshes.push(button.mesh);
      }
    });
    
    if (buttonMeshes.length === 0) {
      console.warn('VRMenu: No button meshes to check for hover');
      return null;
    }
    
    // Check for intersections with button background meshes directly
    const intersects = raycaster.intersectObjects(buttonMeshes, false);
    
    if (intersects.length > 0) {
      const intersect = intersects[0];
      // Verify this is a button mesh
      if (intersect.object && intersect.object.userData && intersect.object.userData.isButton) {
        return intersect.object.userData.button;
      } else {
        console.warn('VRMenu: Intersection found but not a button:', intersect.object);
      }
    }
    
    // Fallback: check entire menu group recursively (but skip labels)
    const allIntersects = raycaster.intersectObjects(this.menuGroup.children, true);
    for (const intersect of allIntersects) {
      // Skip label meshes (they have raycast disabled)
      if (intersect.object.raycast && intersect.object.raycast.toString().includes('() => {}')) {
        continue;
      }
      
      // Check if it's a button mesh
      if (intersect.object && intersect.object.userData && intersect.object.userData.isButton) {
        return intersect.object.userData.button;
      }
    }
    
    return null;
  }

  /**
   * Handle button click (called from VR input system)
   */
  handleButtonClick(button) {
    if (button && button.onClick) {
      button.onClick();
      
      // Visual feedback - flash green
      button.mesh.material.color.setHex(button.pressedColor);
      button.group.scale.set(0.95, 0.95, 0.95);
      
      setTimeout(() => {
        // Return to hover state if still hovered, otherwise original color
        if (button.hovered) {
          button.mesh.material.color.setHex(button.hoverColor);
          button.group.scale.set(1.05, 1.05, 1.05);
        } else {
          button.mesh.material.color.setHex(button.originalColor);
          button.group.scale.set(1.0, 1.0, 1.0);
        }
      }, 200);
    }
  }

  /**
   * Set menu visibility
   */
  setVisible(visible) {
    this.visible = visible;
    this.menuGroup.visible = visible;
  }

  /**
   * Set menu position
   */
  setPosition(x, y, z) {
    this.position.set(x, y, z);
    this.menuGroup.position.copy(this.position);
  }

  /**
   * Get button by ray intersection (for VR input)
   */
  getButtonByRay(raycaster) {
    if (!this.visible) return null;
    
    const intersects = raycaster.intersectObjects(this.menuGroup.children, true);
    
    for (const intersect of intersects) {
      if (intersect.object.userData.isButton) {
        return intersect.object.userData.button;
      }
    }
    
    return null;
  }

  /**
   * Dispose of menu resources
   */
  dispose() {
    if (this.panel) {
      this.panel.geometry.dispose();
      this.panel.material.dispose();
    }
    
    this.buttons.forEach(button => {
      button.mesh.geometry.dispose();
      button.mesh.material.dispose();
      if (button.label && button.label.material) {
        button.label.material.dispose();
      }
    });
    
    if (this.menuGroup.parent) {
      this.menuGroup.parent.remove(this.menuGroup);
    }
  }
}


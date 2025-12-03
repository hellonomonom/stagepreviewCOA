/**
 * VR Panel - Base class for 3D UI panels in VR
 * Provides floating 3D panels that can be positioned in VR space
 */

import * as THREE from 'three';

export class VRPanel {
  constructor(options = {}) {
    // Panel options
    this.width = options.width || 2.0; // meters
    this.height = options.height || 1.5; // meters
    this.distance = options.distance || 1.5; // meters from user
    this.position = options.position || new THREE.Vector3(0, 1.6, -1.5); // Default: in front of user
    
    // Panel group
    this.group = new THREE.Group();
    this.group.name = options.name || 'VRPanel';
    
    // Panel mesh (background)
    this.panelMesh = null;
    this.createPanelMesh();
    
    // Content container
    this.contentGroup = new THREE.Group();
    this.contentGroup.name = 'PanelContent';
    this.group.add(this.contentGroup);
    
    // Ray-casting
    this.raycaster = new THREE.Raycaster();
    this.interactiveObjects = [];
    
    // Visibility
    this.visible = true;
    
    // Position tracking (for following user)
    this.followUser = options.followUser !== false; // Default: true
    this.positionOffset = new THREE.Vector3(0, 0, -1.5); // Offset from camera
  }

  /**
   * Create panel mesh (background)
   * @private
   */
  createPanelMesh() {
    const geometry = new THREE.PlaneGeometry(this.width, this.height);
    const material = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide
    });
    
    this.panelMesh = new THREE.Mesh(geometry, material);
    this.panelMesh.name = 'PanelBackground';
    this.group.add(this.panelMesh);
  }

  /**
   * Update panel position based on camera
   * @param {THREE.Camera} camera - Camera to follow
   */
  updatePosition(camera) {
    if (!this.followUser || !camera) return;
    
    // Calculate position relative to camera
    const direction = new THREE.Vector3(0, 0, -1);
    direction.applyQuaternion(camera.quaternion);
    
    const offset = this.positionOffset.clone();
    offset.applyQuaternion(camera.quaternion);
    
    this.group.position.copy(camera.position);
    this.group.position.add(offset);
    
    // Face the camera
    this.group.lookAt(camera.position);
  }

  /**
   * Add object to panel
   * @param {THREE.Object3D} object - Object to add
   */
  add(object) {
    this.contentGroup.add(object);
    
    // Check if object is interactive
    if (object.userData.interactive) {
      this.interactiveObjects.push(object);
    }
  }

  /**
   * Remove object from panel
   * @param {THREE.Object3D} object - Object to remove
   */
  remove(object) {
    this.contentGroup.remove(object);
    
    // Remove from interactive objects
    const index = this.interactiveObjects.indexOf(object);
    if (index > -1) {
      this.interactiveObjects.splice(index, 1);
    }
  }

  /**
   * Ray-cast to check for interactions
   * @param {THREE.Ray} ray - Ray to test
   * @returns {THREE.Intersection[]} Intersections
   */
  raycast(ray) {
    this.raycaster.set(ray.origin, ray.direction);
    return this.raycaster.intersectObjects(this.interactiveObjects, true);
  }

  /**
   * Set visibility
   * @param {boolean} visible
   */
  setVisible(visible) {
    this.visible = visible;
    this.group.visible = visible;
  }

  /**
   * Check if visible
   * @returns {boolean}
   */
  isVisible() {
    return this.visible;
  }

  /**
   * Get panel group (for adding to scene)
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
      this.position.copy(x);
      this.group.position.copy(x);
    } else {
      this.position.set(x, y, z);
      this.group.position.set(x, y, z);
    }
  }

  /**
   * Cleanup
   */
  dispose() {
    // Remove from parent
    if (this.group.parent) {
      this.group.parent.remove(this.group);
    }
    
    // Dispose geometry and materials
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(mat => mat.dispose());
          } else {
            child.material.dispose();
          }
        }
      }
    });
    
    this.interactiveObjects = [];
  }
}


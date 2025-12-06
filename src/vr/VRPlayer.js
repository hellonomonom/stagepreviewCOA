import * as THREE from 'three';

/**
 * VRPlayer - Represents the VR user/player/actor
 * All UI elements and player-attached objects should be children of this player
 * The player stays in scene root (relative to VR origin) and moves with the user
 */
export class VRPlayer {
  constructor(camera) {
    this.camera = camera;
    
    // Player group - this represents the user in VR space
    // Stays in scene root (relative to VR origin, like controllers/hands)
    this.group = new THREE.Group();
    this.group.name = 'VRPlayer';
    
    // Player position (tracks camera position in VR space)
    // Initialize at world origin
    this.position = new THREE.Vector3(0, 0, 0);
    this.rotation = new THREE.Quaternion();
    
    // Initialize group at origin
    this.group.position.set(0, 0, 0);
    this.group.quaternion.identity();
    
    // UI container - all UI elements should be added here
    this.uiContainer = new THREE.Group();
    this.uiContainer.name = 'VRPlayerUI';
    this.group.add(this.uiContainer);
    
    // Controller container - for controller-attached UI
    this.controllerContainer = new THREE.Group();
    this.controllerContainer.name = 'VRPlayerControllers';
    this.group.add(this.controllerContainer);
    
    // Hand container - for hand-attached UI
    this.handContainer = new THREE.Group();
    this.handContainer.name = 'VRPlayerHands';
    this.group.add(this.handContainer);
    
    // Head container - for head-attached UI (like debug overlay)
    this.headContainer = new THREE.Group();
    this.headContainer.name = 'VRPlayerHead';
    this.group.add(this.headContainer);
    
    // Player state
    this.isInitialized = false;
  }

  /**
   * Initialize player (add to scene)
   * @param {THREE.Scene} scene - Scene to add player to
   */
  init(scene) {
    if (this.isInitialized) return;
    
    // Reset to world origin
    this.resetToOrigin();
    
    // Add player to scene root (not in scene offset)
    scene.add(this.group);
    
    this.isInitialized = true;
    console.log('VRPlayer: Initialized at world origin');
  }
  
  /**
   * Reset player to world origin
   */
  resetToOrigin() {
    this.position.set(0, 0, 0);
    this.rotation.identity();
    this.group.position.set(0, 0, 0);
    this.group.quaternion.identity();
    
    // Reset all containers to origin
    this.uiContainer.position.set(0, 0, 0);
    this.uiContainer.quaternion.identity();
    this.controllerContainer.position.set(0, 0, 0);
    this.controllerContainer.quaternion.identity();
    this.handContainer.position.set(0, 0, 0);
    this.handContainer.quaternion.identity();
    this.headContainer.position.set(0, 0, 0);
    this.headContainer.quaternion.identity();
    
    console.log('VRPlayer: Reset to world origin');
  }

  /**
   * Update player position and rotation to match camera
   * Call this each frame
   */
  update() {
    if (!this.camera) return;
    
    // Update player position to match camera
    // In WebXR, camera position is relative to VR origin
    this.position.copy(this.camera.position);
    this.rotation.copy(this.camera.quaternion);
    
    // Update group transform to match camera
    this.group.position.copy(this.position);
    this.group.quaternion.copy(this.rotation);
    
    // Update head container to be at camera position (no offset needed since group matches camera)
    // Head-attached UI should use local offsets
    this.headContainer.position.set(0, 0, 0);
    this.headContainer.quaternion.identity();
  }

  /**
   * Add UI element to player
   * @param {THREE.Object3D} object - Object to add
   * @param {string} attachment - Attachment point: 'head', 'controller', 'hand', or 'ui' (default)
   */
  addUI(object, attachment = 'ui') {
    if (!object) return;
    
    let container = this.uiContainer;
    
    switch (attachment) {
      case 'head':
        container = this.headContainer;
        break;
      case 'controller':
        container = this.controllerContainer;
        break;
      case 'hand':
        container = this.handContainer;
        break;
      case 'ui':
      default:
        container = this.uiContainer;
        break;
    }
    
    // Remove from current parent if any
    if (object.parent) {
      object.parent.remove(object);
    }
    
    container.add(object);
    console.log(`VRPlayer: Added UI element "${object.name || 'unnamed'}" to ${attachment} container`);
  }

  /**
   * Remove UI element from player
   * @param {THREE.Object3D} object - Object to remove
   */
  removeUI(object) {
    if (!object) return;
    
    if (object.parent) {
      object.parent.remove(object);
    }
  }

  /**
   * Get UI container for a specific attachment point
   * @param {string} attachment - Attachment point: 'head', 'controller', 'hand', or 'ui'
   * @returns {THREE.Group}
   */
  getUIContainer(attachment = 'ui') {
    switch (attachment) {
      case 'head':
        return this.headContainer;
      case 'controller':
        return this.controllerContainer;
      case 'hand':
        return this.handContainer;
      case 'ui':
      default:
        return this.uiContainer;
    }
  }

  /**
   * Get player group
   * @returns {THREE.Group}
   */
  getGroup() {
    return this.group;
  }

  /**
   * Get player position
   * @returns {THREE.Vector3}
   */
  getPosition() {
    return this.position.clone();
  }

  /**
   * Get player rotation
   * @returns {THREE.Quaternion}
   */
  getRotation() {
    return this.rotation.clone();
  }

  /**
   * Dispose and clean up
   */
  dispose() {
    // Clear all containers
    this.uiContainer.clear();
    this.controllerContainer.clear();
    this.handContainer.clear();
    this.headContainer.clear();
    
    // Remove from scene
    if (this.group.parent) {
      this.group.parent.remove(this.group);
    }
    
    this.isInitialized = false;
    console.log('VRPlayer: Disposed');
  }
}


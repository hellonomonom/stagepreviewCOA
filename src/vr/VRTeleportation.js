/**
 * VR Teleportation
 * Allows teleporting to positions on the floor mesh in VR
 * Works with controllers and hand tracking
 */

import * as THREE from 'three';

export class VRTeleportation {
  constructor(renderer, scene, camera, controllers, handTracking, floorMesh, vrManager = null) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.controllers = controllers;
    this.handTracking = handTracking;
    this.floorMesh = floorMesh;
    this.vrManager = vrManager; // Reference to VRManager for accessing scene offset
    
    // Teleportation state
    this.isTeleporting = false;
    this.targetPosition = null;
    this.isValidTarget = false;
    
    // Raycaster for detecting floor
    this.raycaster = new THREE.Raycaster();
    
    // Visual indicators
    this.teleportArc = null;
    this.targetIndicator = null;
    this.createVisualIndicators();
    
    // Teleportation settings
    this.maxTeleportDistance = 10; // meters
    this.arcHeight = 2; // meters
    this.teleportDuration = 300; // ms
    
    // Active input source
    this.activeInputSource = null; // 'controller' or 'hand'
    this.activeHand = null; // 'left' or 'right'
    
    // Callbacks
    this.onTeleportCallbacks = [];
  }

  /**
   * Create visual indicators for teleportation
   * @private
   */
  createVisualIndicators() {
    // Create arc line for teleportation path
    const arcPoints = [];
    const segments = 20;
    for (let i = 0; i <= segments; i++) {
      arcPoints.push(new THREE.Vector3(0, 0, 0));
    }
    const arcGeometry = new THREE.BufferGeometry().setFromPoints(arcPoints);
    const arcMaterial = new THREE.LineBasicMaterial({
      color: 0x00aff0, // Bright blue
      linewidth: 4, // Thicker line (note: linewidth may not work in WebGL, we'll use scale)
      transparent: true,
      opacity: 1.0 // Fully visible
    });
    this.teleportArc = new THREE.Line(arcGeometry, arcMaterial);
    this.teleportArc.renderOrder = 999; // Render on top
    this.teleportArc.visible = false;
    
    // Ensure indicators are added to scene (will be visible in VR space)
    if (this.vrManager && this.vrManager.addToScene) {
      this.vrManager.addToScene(this.teleportArc);
    } else {
      this.scene.add(this.teleportArc);
    }
    
    // Create target indicator (ring on the ground) - make it more visible
    const ringGeometry = new THREE.RingGeometry(0.3, 0.4, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0x00aff0,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9, // More visible
      depthWrite: false // Prevent z-fighting
    });
    this.targetIndicator = new THREE.Mesh(ringGeometry, ringMaterial);
    this.targetIndicator.rotation.x = -Math.PI / 2; // Lay flat on ground
    this.targetIndicator.visible = false;
    if (this.vrManager && this.vrManager.addToScene) {
      this.vrManager.addToScene(this.targetIndicator);
    } else {
      this.scene.add(this.targetIndicator);
    }
    
    // Add inner circle for valid target
    const innerRingGeometry = new THREE.RingGeometry(0.1, 0.2, 16);
    const innerRingMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8
    });
    this.innerRing = new THREE.Mesh(innerRingGeometry, innerRingMaterial);
    this.innerRing.rotation.x = -Math.PI / 2;
    this.innerRing.position.y = 0.001; // Slightly above outer ring
    this.targetIndicator.add(this.innerRing);
  }

  /**
   * Update teleportation system (call each frame)
   */
  update() {
    if (!this.isTeleporting) return;
    
    // Get input ray from controller or hand
    const ray = this.getInputRay();
    if (!ray) {
      console.warn('VR Teleportation: No ray available');
      this.hideIndicators();
      return;
    }
    
    // Check for floor intersection
    const intersection = this.findFloorIntersection(ray);
    
    if (intersection && this.isWithinRange(intersection.point)) {
      this.targetPosition = intersection.point;
      this.isValidTarget = true;
      this.updateIndicators(ray.origin, intersection.point);
    } else {
      this.isValidTarget = false;
      this.targetPosition = null;
      
      // Always show the arc even if no valid target (so user can see where they're aiming)
      if (intersection) {
        // Show arc pointing to intersection point (even if out of range)
        this.updateIndicators(ray.origin, intersection.point);
        // Make indicator red if out of range
        if (this.targetIndicator && !this.isWithinRange(intersection.point)) {
          this.targetIndicator.material.color.setHex(0xff0000); // Red for invalid
          if (this.innerRing) {
            this.innerRing.material.color.setHex(0xff0000);
          }
        }
      } else {
        // No intersection - show arc pointing forward but no target indicator
        const forwardPoint = new THREE.Vector3()
          .copy(ray.origin)
          .add(ray.direction.clone().multiplyScalar(5));
        this.updateIndicators(ray.origin, forwardPoint);
        if (this.targetIndicator) {
          this.targetIndicator.visible = false;
        }
      }
    }
  }

  /**
   * Get input ray from controller or hand
   * @returns {THREE.Ray|null}
   */
  getInputRay() {
    if (this.activeInputSource === 'controller') {
      if (this.controllers) {
        return this.controllers.getControllerRay(this.activeHand || 'right');
      }
    } else if (this.activeInputSource === 'hand') {
      if (this.handTracking && this.activeHand) {
        const handPos = this.handTracking.getHandPosition(this.activeHand);
        const indexPos = this.handTracking.getJointPosition(this.activeHand, 'index-finger-tip');
        if (handPos && indexPos) {
          const direction = new THREE.Vector3().subVectors(indexPos, handPos).normalize();
          return new THREE.Ray(handPos, direction);
        }
      }
    }
    
    // Fallback: use camera forward direction
    const direction = new THREE.Vector3(0, 0, -1);
    direction.applyQuaternion(this.camera.quaternion);
    return new THREE.Ray(this.camera.position.clone(), direction);
  }

  /**
   * Find intersection with floor mesh
   * @param {THREE.Ray} ray - Ray to test
   * @returns {THREE.Intersection|null}
   */
  findFloorIntersection(ray) {
    if (!this.floorMesh) {
      return null;
    }
    
    // Set raycaster with the ray
    this.raycaster.set(ray.origin, ray.direction);
    
    // First, try direct intersection with floor mesh
    // Use recursive=true to check all children
    const intersections = this.raycaster.intersectObject(this.floorMesh, true);
    
    if (intersections.length > 0) {
      // Get the first valid intersection (closest hit)
      const intersection = intersections[0];
      
      // Verify we have a valid point
      if (intersection.point && intersection.point.isVector3) {
        return intersection;
      }
    }
    
    // If no direct hit, search the entire scene for floor-related objects
    // This handles cases where the floor mesh is nested in groups
    const allIntersections = this.raycaster.intersectObjects(this.scene.children, true);
    
    // Filter for intersections with floor mesh or floor-related objects
    for (const intersect of allIntersections) {
      let obj = intersect.object;
      
      // Traverse up the parent chain to find floor mesh
      while (obj) {
        if (obj === this.floorMesh) {
          return intersect;
        }
        // Also check if object name contains "floor"
        if (obj.name && obj.name.toLowerCase().includes('floor')) {
          return intersect;
        }
        obj = obj.parent;
      }
    }
    
    return null;
  }

  /**
   * Check if target position is within teleport range
   * @param {THREE.Vector3} point - Target point
   * @returns {boolean}
   */
  isWithinRange(point) {
    if (!this.camera) return false;
    
    const distance = this.camera.position.distanceTo(point);
    return distance <= this.maxTeleportDistance;
  }

  /**
   * Update visual indicators
   * @private
   */
  updateIndicators(start, end) {
    if (!this.teleportArc || !this.targetIndicator) {
      console.warn('VR Teleportation: Visual indicators not created');
      return;
    }
    
    // Always show the arc when teleporting
    this.teleportArc.visible = true;
    const positions = this.teleportArc.geometry.attributes.position;
    const segments = positions.count - 1;
    
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const point = this.calculateArcPoint(start, end, t);
      positions.setXYZ(i, point.x, point.y, point.z);
    }
    positions.needsUpdate = true;
    
    // Update target indicator - show it at the end point
    if (end && end.isVector3) {
      this.targetIndicator.visible = true;
      this.targetIndicator.position.copy(end);
      this.targetIndicator.position.y += 0.01; // Slightly above floor
      
      // Color based on validity (green if valid, red if invalid)
      const color = this.isValidTarget ? 0x00ff00 : 0xff0000;
      this.targetIndicator.material.color.setHex(color);
      if (this.innerRing) {
        this.innerRing.material.color.setHex(color);
        this.innerRing.visible = this.isValidTarget; // Only show inner ring if valid
      }
    } else {
      this.targetIndicator.visible = false;
    }
  }

  /**
   * Calculate point on teleportation arc
   * @private
   */
  calculateArcPoint(start, end, t) {
    const point = new THREE.Vector3().lerpVectors(start, end, t);
    // Add parabolic arc height
    const height = 4 * this.arcHeight * t * (1 - t);
    point.y += height;
    return point;
  }

  /**
   * Hide visual indicators
   * @private
   */
  hideIndicators() {
    if (this.teleportArc) {
      this.teleportArc.visible = false;
    }
    if (this.targetIndicator) {
      this.targetIndicator.visible = false;
    }
  }

  /**
   * Start teleportation mode
   * @param {string} inputSource - 'controller' or 'hand'
   * @param {string} hand - 'left' or 'right' (for hand tracking)
   */
  startTeleport(inputSource = 'controller', hand = 'right') {
    this.isTeleporting = true;
    this.activeInputSource = inputSource;
    this.activeHand = hand;
    this.targetPosition = null;
    this.isValidTarget = false;
    console.log('VR Teleportation: Started', { inputSource, hand, hasFloorMesh: !!this.floorMesh });
  }

  /**
   * Stop teleportation mode
   */
  stopTeleport() {
    this.isTeleporting = false;
    this.activeInputSource = null;
    this.activeHand = null;
    this.hideIndicators();
  }

  /**
   * Execute teleportation
   * @returns {boolean} Success status
   */
  executeTeleport() {
    if (!this.isValidTarget || !this.targetPosition) {
      return false;
    }
    
    // Trigger teleport
    this.performTeleport(this.targetPosition);
    
    // Stop teleportation mode
    this.stopTeleport();
    
    return true;
  }

  /**
   * Perform the actual teleportation
   * @param {THREE.Vector3} targetPosition - Target position in world space
   * @private
   */
  performTeleport(targetPosition) {
    // In WebXR, we need to update the scene offset to move the user
    // The user should appear at targetPosition, so we offset the scene by -targetPosition
    
    // Get VR scene offset group (either from VRManager or scene)
    let vrSceneOffset = null;
    if (this.vrManager && this.vrManager.vrSceneOffset) {
      vrSceneOffset = this.vrManager.vrSceneOffset;
    } else {
      vrSceneOffset = this.scene.getObjectByName('VRSceneOffset');
    }
    
    if (vrSceneOffset) {
      // Calculate offset: to place user at targetPosition, move scene by -targetPosition
      const offsetX = -targetPosition.x;
      const offsetY = -targetPosition.y;
      const offsetZ = -targetPosition.z;
      
      // Smoothly animate to new position
      this.animateTeleport(vrSceneOffset, new THREE.Vector3(offsetX, offsetY, offsetZ));
    } else {
      console.warn('Cannot teleport: VR scene offset not found');
      return;
    }
    
    // Trigger callbacks
    this.triggerTeleport(targetPosition);
    
    console.log('Teleported to:', targetPosition);
  }

  /**
   * Animate teleportation movement
   * @private
   */
  animateTeleport(vrSceneOffset, targetOffset) {
    const startOffset = vrSceneOffset.position.clone();
    const startTime = Date.now();
    const duration = this.teleportDuration;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease out cubic
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      
      vrSceneOffset.position.lerpVectors(startOffset, targetOffset, easedProgress);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    animate();
  }

  /**
   * Register callback for teleportation
   * @param {Function} callback - Callback function (targetPosition) => void
   */
  onTeleport(callback) {
    if (typeof callback === 'function') {
      this.onTeleportCallbacks.push(callback);
    }
  }

  /**
   * Trigger teleport callbacks
   * @private
   */
  triggerTeleport(targetPosition) {
    this.onTeleportCallbacks.forEach(callback => {
      try {
        callback(targetPosition);
      } catch (error) {
        console.error('Error in teleport callback:', error);
      }
    });
  }

  /**
   * Set floor mesh reference
   * @param {THREE.Mesh|THREE.Group} floorMesh
   */
  setFloorMesh(floorMesh) {
    this.floorMesh = floorMesh;
    if (floorMesh) {
      console.log('VR Teleportation: Floor mesh set', {
        name: floorMesh.name,
        type: floorMesh.type,
        visible: floorMesh.visible,
        inScene: !!floorMesh.parent,
        position: floorMesh.position,
        children: floorMesh.children ? floorMesh.children.length : 0
      });
      
      // Log all children to help debug
      if (floorMesh.children && floorMesh.children.length > 0) {
        floorMesh.children.forEach((child, index) => {
          console.log(`  Floor child ${index}:`, child.name || 'unnamed', child.type);
        });
      }
    } else {
      console.warn('VR Teleportation: Floor mesh cleared');
    }
  }

  /**
   * Set max teleport distance
   * @param {number} distance - Distance in meters
   */
  setMaxDistance(distance) {
    this.maxTeleportDistance = distance;
  }

  /**
   * Cleanup
   */
  dispose() {
    if (this.teleportArc) {
      this.scene.remove(this.teleportArc);
      this.teleportArc.geometry.dispose();
      this.teleportArc.material.dispose();
    }
    
    if (this.targetIndicator) {
      this.scene.remove(this.targetIndicator);
      this.targetIndicator.geometry.dispose();
      this.targetIndicator.material.dispose();
      if (this.innerRing) {
        this.innerRing.geometry.dispose();
        this.innerRing.material.dispose();
      }
    }
    
    this.onTeleportCallbacks = [];
  }
}


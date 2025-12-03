/**
 * VR Preset Navigation
 * Handles teleportation between VR camera presets
 */

import { vrCameraPresets, DEFAULT_VR_CAMERA_PRESET } from '../config/vrCameraPresets.js';
import * as THREE from 'three';

export class VRPresetNavigation {
  constructor(vrManager) {
    this.vrManager = vrManager;
    this.currentPreset = DEFAULT_VR_CAMERA_PRESET;
    this.teleportDuration = 1000; // ms
    this.isTeleporting = false;
    
    // Teleportation animation
    this.teleportStartTime = 0;
    this.teleportStartOffset = null;
    this.teleportTargetOffset = null;
    
    // Visual indicators for preset locations
    this.presetIndicators = [];
  }

  /**
   * Get available preset names
   * @returns {string[]}
   */
  getAvailablePresets() {
    return Object.keys(vrCameraPresets);
  }

  /**
   * Get current preset name
   * @returns {string}
   */
  getCurrentPreset() {
    return this.currentPreset;
  }

  /**
   * Teleport to a preset position
   * @param {string} presetName - Name of the preset to teleport to
   * @param {boolean} smooth - Whether to use smooth transition (default: true)
   */
  async teleportToPreset(presetName, smooth = true) {
    if (!this.vrManager.getIsVRActive()) {
      console.warn('Cannot teleport: VR is not active');
      return;
    }

    if (!vrCameraPresets[presetName]) {
      console.warn('Preset not found:', presetName);
      return;
    }

    if (this.isTeleporting) {
      console.warn('Teleportation already in progress');
      return;
    }

    if (presetName === this.currentPreset) {
      console.log('Already at preset:', presetName);
      return;
    }

    this.currentPreset = presetName;

    if (smooth) {
      await this.smoothTeleport(presetName);
    } else {
      this.instantTeleport(presetName);
    }
  }

  /**
   * Smooth teleportation with animation
   * @private
   */
  async smoothTeleport(presetName) {
    this.isTeleporting = true;
    const preset = vrCameraPresets[presetName];
    
    // Calculate target offset
    const targetOffset = {
      x: -preset.position.x,
      y: -preset.position.y,
      z: -preset.position.z
    };

    // Get current offset from VRManager
    const currentOffset = this.vrManager.vrSceneOffset?.position.clone() || new THREE.Vector3(0, 0, 0);
    
    // Store animation state
    this.teleportStartTime = Date.now();
    this.teleportStartOffset = currentOffset.clone();
    this.teleportTargetOffset = new THREE.Vector3(targetOffset.x, targetOffset.y, targetOffset.z);

    // Start animation loop
    const animate = () => {
      if (!this.isTeleporting) return;
      
      const elapsed = Date.now() - this.teleportStartTime;
      const progress = Math.min(elapsed / this.teleportDuration, 1);
      
      // Ease in-out cubic
      const easedProgress = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      // Interpolate position
      const currentPos = new THREE.Vector3().lerpVectors(
        this.teleportStartOffset,
        this.teleportTargetOffset,
        easedProgress
      );

      // Update scene offset
      if (this.vrManager.vrSceneOffset) {
        this.vrManager.vrSceneOffset.position.copy(currentPos);
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Final position
        this.vrManager.setVRCameraPreset(presetName);
        this.isTeleporting = false;
        console.log('Teleported to preset:', presetName);
      }
    };

    animate();
  }

  /**
   * Instant teleportation (no animation)
   * @private
   */
  instantTeleport(presetName) {
    this.vrManager.setVRCameraPreset(presetName);
    console.log('Instant teleport to preset:', presetName);
  }

  /**
   * Create visual indicators for preset locations
   * @param {THREE.Scene} scene - Scene to add indicators to
   */
  createPresetIndicators(scene) {
    this.clearPresetIndicators();

    Object.entries(vrCameraPresets).forEach(([name, preset]) => {
      const indicator = this.createIndicator(name, preset);
      scene.add(indicator);
      this.presetIndicators.push(indicator);
    });
  }

  /**
   * Create a visual indicator for a preset location
   * @private
   */
  createIndicator(name, preset) {
    const group = new THREE.Group();
    group.name = `VRPresetIndicator_${name}`;
    group.position.set(preset.position.x, preset.position.y, preset.position.z);

    // Create a ring/hoop to indicate location
    const geometry = new THREE.TorusGeometry(0.5, 0.05, 8, 16);
    const material = new THREE.MeshBasicMaterial({
      color: 0x00aff0,
      transparent: true,
      opacity: 0.6
    });
    const ring = new THREE.Mesh(geometry, material);
    ring.rotation.x = Math.PI / 2;
    group.add(ring);

    // Add label (text sprite - simplified as 3D text can be complex)
    // For now, just use a colored sphere as a simple indicator
    const sphereGeometry = new THREE.SphereGeometry(0.1, 8, 8);
    const sphereMaterial = new THREE.MeshBasicMaterial({
      color: 0x00aff0,
      transparent: true,
      opacity: 0.8
    });
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    group.add(sphere);

    return group;
  }

  /**
   * Clear all preset indicators
   */
  clearPresetIndicators() {
    this.presetIndicators.forEach(indicator => {
      if (indicator.parent) {
        indicator.parent.remove(indicator);
      }
      // Dispose geometry and materials
      indicator.traverse((child) => {
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
    });
    this.presetIndicators = [];
  }

  /**
   * Show/hide preset indicators
   * @param {boolean} visible
   */
  setIndicatorsVisible(visible) {
    this.presetIndicators.forEach(indicator => {
      indicator.visible = visible;
    });
  }

  /**
   * Cleanup
   */
  dispose() {
    this.clearPresetIndicators();
    this.isTeleporting = false;
  }
}


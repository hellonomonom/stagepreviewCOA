/**
 * Camera Controls
 * Manages camera position presets and camera state storage
 */

import { cameraPositions, DEFAULT_CAMERA_POSITION_INDEX } from '../config/cameraPresets.js';

export class CameraControls {
  constructor(camera, controls) {
    this.camera = camera;
    this.controls = controls;
    this.storedCameraState = null;
    
    // DOM Elements
    this.cameraPos1Btn = null;
    this.cameraPos2Btn = null;
    this.cameraPos3Btn = null;
    this.cameraPos4Btn = null;
    this.copyCameraBtn = null;
    this.storeCameraBtn = null;
    this.loadCameraBtn = null;
    
    // Debug panel elements
    this.cameraPosX = null;
    this.cameraPosY = null;
    this.cameraPosZ = null;
    this.cameraRotX = null;
    this.cameraRotY = null;
    this.cameraRotZ = null;
    this.cameraTargetX = null;
    this.cameraTargetY = null;
    this.cameraTargetZ = null;
    this.cameraDebugPanel = null;
    this.showCameraDebugPanelCheckbox = null;
  }
  
  /**
   * Update camera debug info display
   */
  updateCameraDebug() {
    if (this.cameraPosX && this.cameraPosY && this.cameraPosZ) {
      // Position
      this.cameraPosX.textContent = this.camera.position.x.toFixed(2);
      this.cameraPosY.textContent = this.camera.position.y.toFixed(2);
      this.cameraPosZ.textContent = this.camera.position.z.toFixed(2);
    }
    
    if (this.cameraRotX && this.cameraRotY && this.cameraRotZ) {
      // Rotation (Euler angles in radians, converted to degrees)
      this.cameraRotX.textContent = (this.camera.rotation.x * 180 / Math.PI).toFixed(2);
      this.cameraRotY.textContent = (this.camera.rotation.y * 180 / Math.PI).toFixed(2);
      this.cameraRotZ.textContent = (this.camera.rotation.z * 180 / Math.PI).toFixed(2);
    }
    
    if (this.cameraTargetX && this.cameraTargetY && this.cameraTargetZ) {
      // OrbitControls target
      this.cameraTargetX.textContent = this.controls.target.x.toFixed(2);
      this.cameraTargetY.textContent = this.controls.target.y.toFixed(2);
      this.cameraTargetZ.textContent = this.controls.target.z.toFixed(2);
    }
  }
  
  /**
   * Set camera position and target from preset
   * @param {number} positionIndex - Index of camera position preset
   */
  setCameraPosition(positionIndex) {
    if (positionIndex < 0 || positionIndex >= cameraPositions.length) {
      console.error('Invalid camera position index:', positionIndex);
      return;
    }
    
    const preset = cameraPositions[positionIndex];
    
    // Set camera position
    this.camera.position.set(preset.position.x, preset.position.y, preset.position.z);
    
    // Set OrbitControls target
    this.controls.target.set(preset.target.x, preset.target.y, preset.target.z);
    
    // If rotation is specified, set it directly (convert degrees to radians)
    if (preset.rotation) {
      this.camera.rotation.set(
        preset.rotation.x * Math.PI / 180,
        preset.rotation.y * Math.PI / 180,
        preset.rotation.z * Math.PI / 180
      );
    } else {
      // Otherwise, look at target (OrbitControls will handle rotation)
      this.camera.lookAt(preset.target.x, preset.target.y, preset.target.z);
    }
    
    // Update controls to apply changes immediately
    this.controls.update();
    
    // Update debug display
    this.updateCameraDebug();
  }
  
  /**
   * Copy camera values to clipboard
   */
  copyCameraValues() {
    const pos = {
      x: parseFloat(this.camera.position.x.toFixed(2)),
      y: parseFloat(this.camera.position.y.toFixed(2)),
      z: parseFloat(this.camera.position.z.toFixed(2))
    };
    
    const rot = {
      x: parseFloat((this.camera.rotation.x * 180 / Math.PI).toFixed(2)),
      y: parseFloat((this.camera.rotation.y * 180 / Math.PI).toFixed(2)),
      z: parseFloat((this.camera.rotation.z * 180 / Math.PI).toFixed(2))
    };
    
    const target = {
      x: parseFloat(this.controls.target.x.toFixed(2)),
      y: parseFloat(this.controls.target.y.toFixed(2)),
      z: parseFloat(this.controls.target.z.toFixed(2))
    };
    
    const cameraData = {
      position: pos,
      rotation: rot,
      target: target
    };
    
    // Format as readable text
    const textFormat = `Position: (${pos.x}, ${pos.y}, ${pos.z})
Rotation: (${rot.x}, ${rot.y}, ${rot.z})
Target: (${target.x}, ${target.y}, ${target.z})`;
    
    // Copy to clipboard
    navigator.clipboard.writeText(textFormat).then(() => {
      // Visual feedback
      const originalText = this.copyCameraBtn.textContent;
      this.copyCameraBtn.textContent = 'Copied!';
      this.copyCameraBtn.style.background = 'var(--color-primary)';
      setTimeout(() => {
        this.copyCameraBtn.textContent = originalText;
        this.copyCameraBtn.style.background = '';
      }, 2000);
    }).catch(err => {
      console.error('Failed to copy camera values:', err);
      alert('Failed to copy to clipboard. Please copy manually:\n\n' + textFormat);
    });
  }
  
  /**
   * Store current camera state
   */
  storeCameraState() {
    this.storedCameraState = {
      position: {
        x: this.camera.position.x,
        y: this.camera.position.y,
        z: this.camera.position.z
      },
      rotation: {
        x: this.camera.rotation.x * 180 / Math.PI, // Convert to degrees
        y: this.camera.rotation.y * 180 / Math.PI,
        z: this.camera.rotation.z * 180 / Math.PI
      },
      target: {
        x: this.controls.target.x,
        y: this.controls.target.y,
        z: this.controls.target.z
      }
    };
    
    // Visual feedback
    const originalText = this.storeCameraBtn.textContent;
    this.storeCameraBtn.textContent = 'Stored!';
    this.storeCameraBtn.style.background = 'var(--color-primary)';
    setTimeout(() => {
      this.storeCameraBtn.textContent = originalText;
      this.storeCameraBtn.style.background = '';
    }, 2000);
    
    // Enable load button
    if (this.loadCameraBtn) {
      this.loadCameraBtn.disabled = false;
    }
  }
  
  /**
   * Load stored camera state
   */
  loadCameraState() {
    if (!this.storedCameraState) {
      console.warn('No camera state stored');
      return;
    }
    
    // Set camera position
    this.camera.position.set(
      this.storedCameraState.position.x,
      this.storedCameraState.position.y,
      this.storedCameraState.position.z
    );
    
    // Set OrbitControls target
    this.controls.target.set(
      this.storedCameraState.target.x,
      this.storedCameraState.target.y,
      this.storedCameraState.target.z
    );
    
    // Set camera rotation (convert degrees to radians)
    this.camera.rotation.set(
      this.storedCameraState.rotation.x * Math.PI / 180,
      this.storedCameraState.rotation.y * Math.PI / 180,
      this.storedCameraState.rotation.z * Math.PI / 180
    );
    
    // Update controls
    this.controls.update();
    
    // Update debug display
    this.updateCameraDebug();
    
    // Visual feedback
    const originalText = this.loadCameraBtn.textContent;
    this.loadCameraBtn.textContent = 'Loaded!';
    this.loadCameraBtn.style.background = 'var(--color-primary)';
    setTimeout(() => {
      this.loadCameraBtn.textContent = originalText;
      this.loadCameraBtn.style.background = '';
    }, 2000);
  }
  
  /**
   * Initialize event listeners
   */
  init() {
    // Get DOM elements
    this.cameraPos1Btn = document.getElementById('cameraPos1');
    this.cameraPos2Btn = document.getElementById('cameraPos2');
    this.cameraPos3Btn = document.getElementById('cameraPos3');
    this.cameraPos4Btn = document.getElementById('cameraPos4');
    this.copyCameraBtn = document.getElementById('copyCameraBtn');
    this.storeCameraBtn = document.getElementById('storeCameraBtn');
    this.loadCameraBtn = document.getElementById('loadCameraBtn');
    
    // Debug panel elements
    this.cameraPosX = document.getElementById('cameraPosX');
    this.cameraPosY = document.getElementById('cameraPosY');
    this.cameraPosZ = document.getElementById('cameraPosZ');
    this.cameraRotX = document.getElementById('cameraRotX');
    this.cameraRotY = document.getElementById('cameraRotY');
    this.cameraRotZ = document.getElementById('cameraRotZ');
    this.cameraTargetX = document.getElementById('cameraTargetX');
    this.cameraTargetY = document.getElementById('cameraTargetY');
    this.cameraTargetZ = document.getElementById('cameraTargetZ');
    this.cameraDebugPanel = document.getElementById('cameraDebugPanel');
    this.showCameraDebugPanelCheckbox = document.getElementById('showCameraDebugPanel');
    
    // Camera debug panel visibility checkbox handler
    if (this.showCameraDebugPanelCheckbox && this.cameraDebugPanel) {
      // Initialize as hidden (unchecked by default)
      this.cameraDebugPanel.classList.add('hidden');
      this.showCameraDebugPanelCheckbox.checked = false;
      
      this.showCameraDebugPanelCheckbox.addEventListener('change', (e) => {
        if (e.target.checked) {
          this.cameraDebugPanel.classList.remove('hidden');
        } else {
          this.cameraDebugPanel.classList.add('hidden');
        }
      });
    }
    
    // Set up event listeners
    if (this.cameraPos1Btn) {
      this.cameraPos1Btn.addEventListener('click', () => this.setCameraPosition(0));
    }
    if (this.cameraPos2Btn) {
      this.cameraPos2Btn.addEventListener('click', () => this.setCameraPosition(1));
    }
    if (this.cameraPos3Btn) {
      this.cameraPos3Btn.addEventListener('click', () => this.setCameraPosition(2));
    }
    if (this.cameraPos4Btn) {
      this.cameraPos4Btn.addEventListener('click', () => this.setCameraPosition(3));
    }
    
    if (this.copyCameraBtn) {
      this.copyCameraBtn.addEventListener('click', () => this.copyCameraValues());
    }
    
    if (this.storeCameraBtn) {
      this.storeCameraBtn.addEventListener('click', () => this.storeCameraState());
    }
    
    if (this.loadCameraBtn) {
      this.loadCameraBtn.addEventListener('click', () => this.loadCameraState());
      // Initially disable load button until something is stored
      this.loadCameraBtn.disabled = true;
    }
    
    // Set default camera position
    this.setCameraPosition(DEFAULT_CAMERA_POSITION_INDEX);
  }
}


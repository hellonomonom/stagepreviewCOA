/**
 * LED Mapping Manager
 * Handles LED mesh loading, swapping, and management
 */

import { ledMeshFiles, correctedWingMeshes } from '../config/meshPaths.js';

export class LEDMapping {
  constructor(meshLoader, ledsGroup, material, applyBlackToGaragesFn) {
    this.meshLoader = meshLoader;
    this.ledsGroup = ledsGroup;
    this.material = material;
    this.applyBlackToGaragesFn = applyBlackToGaragesFn;
    
    // Mesh references
    this.loadedLEDMeshes = [];
    this.ledFrontMesh = null;
    this.slWingMesh = null;
    this.srWingMesh = null;
    this.slGarageMesh = null;
    this.srGarageMesh = null;
    this.restoreLedFrontVisible = true;
    
    // Current mapping type
    this.currentMappingType = 'frontProjectionPerspective';
  }
  
  /**
   * Get current mapping type
   * @returns {string} Current mapping type
   */
  getCurrentMappingType() {
    return this.currentMappingType;
  }
  
  /**
   * Get LED front mesh reference
   * @returns {THREE.Object3D|null} LED front mesh
   */
  getLEDFrontMesh() {
    return this.ledFrontMesh;
  }
  
  /**
   * Get garage meshes
   * @returns {Object} Object with sl and sr garage meshes
   */
  getGarageMeshes() {
    return {
      sl: this.slGarageMesh,
      sr: this.srGarageMesh
    };
  }
  
  /**
   * Load LED meshes for a specific mapping type
   * @param {string} mappingType - Mapping type (festival, frontProjection, frontProjectionPerspective)
   * @param {boolean} useCorrected - Whether to use corrected wing meshes
   */
  loadLEDMeshes(mappingType, useCorrected = false) {
    // Store LED front visibility state before clearing (to prevent flash)
    this.restoreLedFrontVisible = this.ledFrontMesh ? this.ledFrontMesh.visible : true;
    
    // Clear existing LED meshes
    this.loadedLEDMeshes.forEach(mesh => {
      this.ledsGroup.remove(mesh);
      // Dispose of geometry and materials
      mesh.traverse((child) => {
        if (child.isMesh) {
          if (child.geometry) child.geometry.dispose();
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
    this.loadedLEDMeshes.length = 0;
    this.ledFrontMesh = null;
    this.slWingMesh = null;
    this.srWingMesh = null;
    this.slGarageMesh = null;
    this.srGarageMesh = null;
    
    // Get paths and replace wing meshes if corrected is enabled
    let paths = [...ledMeshFiles[mappingType]];
    
    if (useCorrected && (mappingType === 'frontProjection' || mappingType === 'frontProjectionPerspective')) {
      const correctedMeshes = correctedWingMeshes[mappingType];
      if (correctedMeshes) {
        paths = paths.map(path => {
          if (path.includes('SL_WING') && !path.includes('GARAGE')) {
            return correctedMeshes.sl;
          }
          if (path.includes('SR_WING') && !path.includes('GARAGE')) {
            return correctedMeshes.sr;
          }
          return path;
        });
      }
    }
    
    // Set up callbacks for mesh loading
    this.meshLoader.setCallbacks({
      onLEDFrontLoaded: (mesh) => {
        this.ledFrontMesh = mesh;
        this.loadedLEDMeshes.push(mesh);
        // Immediately restore visibility state to prevent flash
        this.ledFrontMesh.visible = this.restoreLedFrontVisible;
      },
      onWingLoaded: (side, mesh) => {
        if (side === 'sl') {
          this.slWingMesh = mesh;
        } else {
          this.srWingMesh = mesh;
        }
        this.loadedLEDMeshes.push(mesh);
      },
      onGarageLoaded: (side, mesh) => {
        if (side === 'sl') {
          this.slGarageMesh = mesh;
        } else {
          this.srGarageMesh = mesh;
        }
        this.loadedLEDMeshes.push(mesh);
      }
    });
    
    // Load new LED meshes
    paths.forEach(path => {
      this.meshLoader.loadMesh(path, this.ledsGroup, false, this.material);
    });
    
    // Update current mapping type
    this.currentMappingType = mappingType;
    
    // Restore black material state if checkbox is checked
    // Wait a bit longer to ensure meshes are fully loaded
    setTimeout(() => {
      const blackGaragesCheckbox = document.getElementById('blackGarages');
      if (blackGaragesCheckbox && blackGaragesCheckbox.checked && this.applyBlackToGaragesFn) {
        // Check if garage meshes are loaded before applying
        const garages = this.getGarageMeshes();
        if (garages.sl || garages.sr) {
          console.log('Restoring black material state for garages after mesh reload');
          this.applyBlackToGaragesFn(true);
        } else {
          console.warn('Garage meshes not loaded yet, retrying...');
          // Retry after a longer delay
          setTimeout(() => {
            const garagesRetry = this.getGarageMeshes();
            if (garagesRetry.sl || garagesRetry.sr) {
              this.applyBlackToGaragesFn(true);
            } else {
              console.error('Garage meshes still not loaded after retry');
            }
          }, 500);
        }
      }
    }, 200);
  }
  
  /**
   * Set LED front mesh visibility
   * @param {boolean} visible - Whether to show the LED front mesh
   */
  setLEDFrontVisible(visible) {
    if (this.ledFrontMesh) {
      this.ledFrontMesh.visible = visible;
      this.restoreLedFrontVisible = visible;
    }
  }
}


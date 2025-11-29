/**
 * LED Mapping Manager
 * Handles LED mesh loading, swapping, and management
 */

import * as THREE from 'three';
import { ledMeshFiles, correctedWingMeshes } from '../config/meshPaths.js';

export class LEDMapping {
  constructor(meshLoader, ledsGroup, material, createLEDShaderMaterial, updateLEDShaders) {
    this.meshLoader = meshLoader;
    this.ledsGroup = ledsGroup;
    this.material = material;
    this.createLEDShaderMaterial = createLEDShaderMaterial;
    this.updateLEDShaders = updateLEDShaders;
    
    // Black material for garage meshes
    this.blackMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
    
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
      if (blackGaragesCheckbox && blackGaragesCheckbox.checked) {
        // Check if garage meshes are loaded before applying
        const garages = this.getGarageMeshes();
        if (garages.sl || garages.sr) {
          console.log('Restoring black material state for garages after mesh reload');
          this.applyBlackToGarages(true);
        } else {
          console.warn('Garage meshes not loaded yet, retrying...');
          // Retry after a longer delay
          setTimeout(() => {
            const garagesRetry = this.getGarageMeshes();
            if (garagesRetry.sl || garagesRetry.sr) {
              this.applyBlackToGarages(true);
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
  
  /**
   * Apply black material to garage meshes or restore LED shader material
   * @param {boolean} apply - Whether to apply black material (true) or restore LED shader (false)
   */
  applyBlackToGarages(apply) {
    const garages = this.getGarageMeshes();
    const garageMeshes = [garages.sl, garages.sr];
    
    console.log('applyBlackToGarages called:', { apply, sl: !!garages.sl, sr: !!garages.sr });
    
    let meshCount = 0;
    garageMeshes.forEach((garageMesh, index) => {
      if (!garageMesh) {
        console.warn(`Garage mesh ${index === 0 ? 'SL' : 'SR'} not found`);
        return;
      }
      
      garageMesh.traverse((child) => {
        if (child.isMesh) {
          meshCount++;
          if (apply) {
            // Store original material if not already stored
            if (!child.userData.originalMaterial) {
              child.userData.originalMaterial = child.material;
            }
            // Apply black material
            child.material = this.blackMaterial;
            console.log(`Applied black material to mesh in ${index === 0 ? 'SL' : 'SR'} garage`);
          } else {
            // Restore LED shader material (always create fresh to ensure uniforms are current)
            // Pass the texture material reference to createLEDShaderMaterial
            child.material = this.createLEDShaderMaterial(this.material);
            // Update shader with current texture
            this.updateLEDShaders(this.ledsGroup, this.material);
            child.userData.originalMaterial = null;
            console.log(`Restored LED shader material to mesh in ${index === 0 ? 'SL' : 'SR'} garage`);
          }
        }
      });
    });
    
    if (meshCount === 0) {
      console.warn('No meshes found in garage meshes. They may not be loaded yet.');
    } else {
      console.log(`Processed ${meshCount} meshes in garage meshes`);
    }
  }
}


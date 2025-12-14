/**
 * LED Mapping Manager
 * Handles LED mesh loading, swapping, and management
 */

import * as THREE from 'three';
import { ledMeshFiles, correctedWingMeshes, getLEDMeshFiles } from '../config/meshPaths.js';

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
   * @param {boolean} useGaragefix - Whether to use Garagefix version (for renderOption1/renderOption1NoFront)
   */
  loadLEDMeshes(mappingType, useCorrected = false, useGaragefix = true) {
    // Determine desired visibility based on mapping type ONLY
    // This is the single source of truth - garagefix doesn't affect front mesh visibility
    let desiredVisibility = true;
    if (mappingType === 'renderOption1NoFront') {
      desiredVisibility = false;
    } else if (mappingType === 'renderOption1') {
      // For renderOption1, show by default (checkbox can override later)
      desiredVisibility = true;
    }
    
    // Store LED front visibility state - this will be applied when mesh is found
    this.restoreLedFrontVisible = desiredVisibility;
    // Store mapping type FIRST so callbacks can use it
    this.currentMappingType = mappingType;
    
    // Clear ALL existing LED meshes from ledsGroup (more thorough cleanup)
    // Collect all direct children of ledsGroup to avoid issues with modifying array during iteration
    const childrenToRemove = [...this.ledsGroup.children];
    
    // Also collect from loadedLEDMeshes for proper disposal
    const meshesToDispose = [...this.loadedLEDMeshes];
    
    // Remove all direct children from ledsGroup
    childrenToRemove.forEach(child => {
      this.ledsGroup.remove(child);
    });
    
    // Dispose of geometry and materials from all meshes
    const allMeshesToDispose = new Set();
    
    // Add tracked meshes
    meshesToDispose.forEach(mesh => {
      allMeshesToDispose.add(mesh);
    });
    
    // Add children that weren't tracked
    childrenToRemove.forEach(child => {
      allMeshesToDispose.add(child);
    });
    
    // Dispose of all meshes
    allMeshesToDispose.forEach(mesh => {
      if (mesh && mesh.traverse) {
        mesh.traverse((child) => {
          if (child.isMesh) {
            if (child.geometry) {
              child.geometry.dispose();
            }
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach(mat => {
                  if (mat) mat.dispose();
                });
              } else {
                child.material.dispose();
              }
            }
          }
        });
      }
    });
    
    // Clear all references
    this.loadedLEDMeshes.length = 0;
    this.ledFrontMesh = null;
    this.slWingMesh = null;
    this.srWingMesh = null;
    this.slGarageMesh = null;
    this.srGarageMesh = null;
    
    // Get paths using getLEDMeshFiles to handle Garagefix toggle
    let paths = [...getLEDMeshFiles(mappingType, useGaragefix)];
    
    // Fallback to original ledMeshFiles if getLEDMeshFiles returns empty
    if (paths.length === 0) {
      paths = [...(ledMeshFiles[mappingType] || [])];
    }
    
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
        // Immediately apply visibility based on mapping type
        // Use restoreLedFrontVisible which was set based on mapping type
        this.ledFrontMesh.visible = this.restoreLedFrontVisible;
        console.log('[LEDMapping] Front mesh loaded, visibility set to:', this.restoreLedFrontVisible, 'for mapping type:', this.currentMappingType);
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
      this.meshLoader.loadMesh(path, this.ledsGroup, false, this.material, mappingType);
    });
    
    // Track FarCam meshes and render option meshes (and any other meshes that don't match callbacks)
    // after a delay to ensure they're loaded
    setTimeout(() => {
      this.ledsGroup.children.forEach(child => {
        if (child.userData && child.userData.path && 
            !this.loadedLEDMeshes.includes(child)) {
          // Track FarCam meshes
          if (child.userData.path.includes('FarCam')) {
            this.loadedLEDMeshes.push(child);
          }
          // Track render option meshes (single-file GLBs like FarCam)
          if (child.userData.path.includes('Release/Stage_static') || 
              child.userData.path.includes('Option1_Projection') ||
              child.userData.path.includes('Option2_noFront') ||
              child.userData.path.includes('Option2_wFront')) {
            this.loadedLEDMeshes.push(child);
          }
        }
      });
      
      // Final check: ensure front mesh visibility is correct
      // This handles cases where the mesh was found but visibility wasn't set
      if (this.ledFrontMesh) {
        // Use updateFrontMeshVisibility which will check current state
        this.updateFrontMeshVisibility();
      }
    }, 300);
    
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
   * Get the correct front mesh visibility based on current mapping type
   * @returns {boolean} Whether the front mesh should be visible
   */
  getFrontMeshVisibility() {
    if (this.currentMappingType === 'renderOption1NoFront') {
      return false;
    } else if (this.currentMappingType === 'renderOption1') {
      // Check checkbox state
      const hideLedFrontCheckbox = document.getElementById('hideLedFront');
      return hideLedFrontCheckbox ? !hideLedFrontCheckbox.checked : true;
    }
    // For other mapping types, check checkbox
    const hideLedFrontCheckbox = document.getElementById('hideLedFront');
    return hideLedFrontCheckbox ? !hideLedFrontCheckbox.checked : true;
  }
  
  /**
   * Set LED front mesh visibility based on current mapping type
   * This is the main method to call when you want to update front mesh visibility
   */
  updateFrontMeshVisibility() {
    const visibility = this.getFrontMeshVisibility();
    
    if (this.ledFrontMesh) {
      this.ledFrontMesh.visible = visibility;
      this.restoreLedFrontVisible = visibility;
    }
    
    // Also hide/show all meshes with names containing "FRONT" or "LED_FRONT" in loaded meshes
    this.loadedLEDMeshes.forEach(mesh => {
      mesh.traverse((child) => {
        if (child.isMesh && child.name && 
            (child.name.includes('LED_FRONT_') || 
             (this.currentMappingType === 'renderOption1' || this.currentMappingType === 'renderOption1NoFront') &&
             (child.name.includes('FRONT') || child.name.includes('Front')))) {
          child.visible = visibility;
        }
      });
    });
    
    // Also check ledsGroup directly to catch any meshes that might not be in loadedLEDMeshes
    if (this.ledsGroup) {
      this.ledsGroup.traverse((child) => {
        if (child.isMesh && child.name && 
            (child.name.includes('LED_FRONT_') || 
             (this.currentMappingType === 'renderOption1' || this.currentMappingType === 'renderOption1NoFront') &&
             (child.name.includes('FRONT') || child.name.includes('Front')))) {
          child.visible = visibility;
        }
      });
    }
    
    console.log('[LEDMapping] Updated front mesh visibility to:', visibility, 'for mapping type:', this.currentMappingType);
  }
  
  /**
   * Set LED front mesh visibility (legacy method for backwards compatibility)
   * @param {boolean} visible - Whether to show the LED front mesh
   */
  setLEDFrontVisible(visible) {
    this.restoreLedFrontVisible = visible;
    this.updateFrontMeshVisibility();
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
    
    // First, process garage meshes found by callbacks (for old mapping types)
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
            // Pass the texture material reference, mapping type, and garage flag to createLEDShaderMaterial
            child.material = this.createLEDShaderMaterial(this.material, this.currentMappingType, true);
            // Update shader with current texture
            this.updateLEDShaders(this.ledsGroup, this.material, this.currentMappingType);
            child.userData.originalMaterial = null;
            console.log(`Restored LED shader material to mesh in ${index === 0 ? 'SL' : 'SR'} garage`);
          }
        }
      });
    });
    
    // Use a Set to track processed meshes to avoid duplicates
    const processedMeshes = new Set();
    
    // Also search for garage meshes by name in all loaded meshes (for FarCam and other meshes)
    // This handles cases where garage meshes are inside a single GLB file
    this.loadedLEDMeshes.forEach(mesh => {
      mesh.traverse((child) => {
        if (child.isMesh && child.name && 
            (child.name.includes('GARAGE') || child.name.includes('Garage') || child.name.includes('garage'))) {
          // Skip if we already processed this mesh
          if (processedMeshes.has(child)) {
            return;
          }
          processedMeshes.add(child);
          
          meshCount++;
          if (apply) {
            // Store original material if not already stored
            if (!child.userData.originalMaterial) {
              child.userData.originalMaterial = child.material;
            }
            // Apply black material
            child.material = this.blackMaterial;
            console.log(`Applied black material to garage mesh by name: ${child.name}`);
          } else {
            // Restore LED shader material (this is a garage mesh)
            child.material = this.createLEDShaderMaterial(this.material, this.currentMappingType, true);
            this.updateLEDShaders(this.ledsGroup, this.material, this.currentMappingType);
            child.userData.originalMaterial = null;
            console.log(`Restored LED shader material to garage mesh by name: ${child.name}`);
          }
        }
      });
    });
    
    // Also check ledsGroup directly to catch any garage meshes that might not be in loadedLEDMeshes yet
    
    if (this.ledsGroup) {
      this.ledsGroup.traverse((child) => {
        if (child.isMesh && child.name && 
            (child.name.includes('GARAGE') || child.name.includes('Garage') || child.name.includes('garage'))) {
          // Skip if we already processed this mesh
          if (processedMeshes.has(child)) {
            return;
          }
          processedMeshes.add(child);
          
          meshCount++;
          if (apply) {
            // Store original material if not already stored
            if (!child.userData.originalMaterial) {
              child.userData.originalMaterial = child.material;
            }
            // Apply black material
            child.material = this.blackMaterial;
            console.log(`Applied black material to garage mesh in ledsGroup: ${child.name}`);
          } else {
            // Restore LED shader material (this is a garage mesh)
            child.material = this.createLEDShaderMaterial(this.material, this.currentMappingType, true);
            this.updateLEDShaders(this.ledsGroup, this.material, this.currentMappingType);
            child.userData.originalMaterial = null;
            console.log(`Restored LED shader material to garage mesh in ledsGroup: ${child.name}`);
          }
        }
      });
    }
    
    if (meshCount === 0) {
      console.warn('No meshes found in garage meshes. They may not be loaded yet.');
    } else {
      console.log(`Processed ${meshCount} meshes in garage meshes`);
    }
  }
}


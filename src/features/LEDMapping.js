/**
 * LED Mapping Manager
 * Handles LED mesh loading, swapping, and management
 */

import * as THREE from 'three';
import { ledMeshFiles, correctedWingMeshes, getLEDMeshFiles } from '../config/meshPaths.js';
import { debugLog } from '../utils/logger.js';

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
    
    // Store old meshes before removing them - keep them FULLY VISIBLE until new ones are ready
    const oldMeshesToRemove = [...this.ledsGroup.children];
    const oldMeshesToDispose = [...this.loadedLEDMeshes];
    
    // DO NOT hide old meshes - keep them visible to avoid black screen
    // They will be removed only after new meshes are confirmed visible
    
    // Clear all references (but keep meshes in scene and visible)
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
    
    // Track which paths have been loaded
    const loadedPaths = new Set();
    const totalPaths = paths.length;
    let hasRemovedOldMeshes = false;
    
    // Track new meshes that are confirmed visible
    const newMeshesLoaded = new Set();
    
    // Helper function to verify a mesh is actually visible in the scene
    const isMeshVisible = (mesh) => {
      if (!mesh) return false;
      let hasVisibleMesh = false;
      if (mesh.traverse) {
        mesh.traverse((child) => {
          if (child.isMesh && child.visible) {
            hasVisibleMesh = true;
          }
        });
      } else if (mesh.isMesh && mesh.visible) {
        hasVisibleMesh = true;
      }
      return hasVisibleMesh;
    };
    
    // Helper function to check if all meshes are loaded and remove old ones
    const checkAndRemoveOldMeshes = () => {
      if (hasRemovedOldMeshes) return; // Already removed
      
      // Check if we have new meshes in the scene that are actually visible
      const currentChildren = [...this.ledsGroup.children];
      const newMeshes = currentChildren.filter(child => !oldMeshesToRemove.includes(child));
      
      // Count visible meshes within new meshes
      let visibleMeshCount = 0;
      newMeshes.forEach(mesh => {
        if (isMeshVisible(mesh)) {
          visibleMeshCount++;
        }
      });
      
      // Only remove old meshes if we have at least one visible new mesh
      // For single-file GLBs (like renderOption1), one file might contain all meshes
      // So we only need 1 visible new mesh to proceed
      const hasVisibleNewMeshes = visibleMeshCount > 0;
      const hasEnoughNewMeshes = newMeshes.length >= Math.min(totalPaths, 1); // At least 1 new mesh
      
      if (hasVisibleNewMeshes && hasEnoughNewMeshes) {
        // New meshes are loaded and visible, now hide and remove old ones
        debugLog('logging.meshLoader.loaded', `[LEDMapping] Removing old meshes. New visible meshes: ${visibleMeshCount}, Total new meshes: ${newMeshes.length}`);
        
        oldMeshesToRemove.forEach(child => {
          if (this.ledsGroup.children.includes(child)) {
            // First hide old meshes
            if (child.traverse) {
              child.traverse((mesh) => {
                if (mesh.isMesh) {
                  mesh.visible = false;
                }
              });
            }
            // Then remove from scene
            this.ledsGroup.remove(child);
          }
        });
        
        // Dispose of old meshes
        const allMeshesToDispose = new Set();
        oldMeshesToDispose.forEach(mesh => {
          allMeshesToDispose.add(mesh);
        });
        oldMeshesToRemove.forEach(child => {
          allMeshesToDispose.add(child);
        });
        
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
        
        hasRemovedOldMeshes = true;
        debugLog('logging.meshLoader.loaded', '[LEDMapping] Old meshes removed after new meshes are visible');
      } else {
        // Debug why we're not removing yet
        debugLog('logging.meshLoader.loaded', `[LEDMapping] Waiting for visible meshes. Visible: ${visibleMeshCount}, New: ${newMeshes.length}, Total paths: ${totalPaths}`);
      }
    };
    
    // Set up callbacks for mesh loading
    this.meshLoader.setCallbacks({
      onLEDFrontLoaded: (mesh) => {
        this.ledFrontMesh = mesh;
        this.loadedLEDMeshes.push(mesh);
        newMeshesLoaded.add(mesh);
        
        // Ensure new mesh is visible (it should be by default, but make it explicit)
        if (mesh.traverse) {
          mesh.traverse((child) => {
            if (child.isMesh) {
              child.visible = true;
            }
          });
        }
        // Immediately apply visibility based on mapping type
        // Use restoreLedFrontVisible which was set based on mapping type
        this.ledFrontMesh.visible = this.restoreLedFrontVisible;
        debugLog('logging.meshLoader.loaded', '[LEDMapping] Front mesh loaded, visibility set to:', this.restoreLedFrontVisible, 'for mapping type:', this.currentMappingType);
        
        // Wait a bit longer to ensure mesh is fully rendered before removing old ones
        // Use requestAnimationFrame to ensure mesh is rendered before checking
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            // Double RAF ensures the frame is rendered
            if (isMeshVisible(mesh)) {
              checkAndRemoveOldMeshes();
            } else {
              // If not visible yet, try again after a short delay
              setTimeout(() => {
                if (isMeshVisible(mesh)) {
                  checkAndRemoveOldMeshes();
                }
              }, 50);
            }
          });
        });
      },
      onWingLoaded: (side, mesh) => {
        if (side === 'sl') {
          this.slWingMesh = mesh;
        } else {
          this.srWingMesh = mesh;
        }
        this.loadedLEDMeshes.push(mesh);
        newMeshesLoaded.add(mesh);
        
        // Ensure new mesh is visible
        if (mesh.traverse) {
          mesh.traverse((child) => {
            if (child.isMesh) {
              child.visible = true;
            }
          });
        }
        
        // Wait a bit to ensure mesh is fully rendered
        // Use requestAnimationFrame to ensure mesh is rendered before checking
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            // Double RAF ensures the frame is rendered
            if (isMeshVisible(mesh)) {
              checkAndRemoveOldMeshes();
            } else {
              // If not visible yet, try again after a short delay
              setTimeout(() => {
                if (isMeshVisible(mesh)) {
                  checkAndRemoveOldMeshes();
                }
              }, 50);
            }
          });
        });
      },
      onGarageLoaded: (side, mesh) => {
        if (side === 'sl') {
          this.slGarageMesh = mesh;
        } else {
          this.srGarageMesh = mesh;
        }
        this.loadedLEDMeshes.push(mesh);
        newMeshesLoaded.add(mesh);
        
        // Ensure new mesh is visible
        if (mesh.traverse) {
          mesh.traverse((child) => {
            if (child.isMesh) {
              child.visible = true;
            }
          });
        }
        
        // Wait a bit to ensure mesh is fully rendered
        // Use requestAnimationFrame to ensure mesh is rendered before checking
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            // Double RAF ensures the frame is rendered
            if (isMeshVisible(mesh)) {
              checkAndRemoveOldMeshes();
            } else {
              // If not visible yet, try again after a short delay
              setTimeout(() => {
                if (isMeshVisible(mesh)) {
                  checkAndRemoveOldMeshes();
                }
              }, 50);
            }
          });
        });
      }
    });
    
    // Load new LED meshes
    // Ensure meshes are visible immediately when added to scene
    paths.forEach((path) => {
      this.meshLoader.loadMesh(path, this.ledsGroup, false, this.material, mappingType);
      // Mark path as being loaded
      loadedPaths.add(path);
    });
    
    // Track FarCam meshes and render option meshes (and any other meshes that don't match callbacks)
    // after a delay to ensure they're loaded
    setTimeout(() => {
      this.ledsGroup.children.forEach(child => {
        if (child.userData && child.userData.path) {
          // Mark this path as loaded
          loadedPaths.add(child.userData.path);
          
          if (!this.loadedLEDMeshes.includes(child) &&
              !oldMeshesToRemove.includes(child)) {
            // Ensure new mesh is visible
            if (child.traverse) {
              child.traverse((mesh) => {
                if (mesh.isMesh) {
                  mesh.visible = true;
                }
              });
            }
            newMeshesLoaded.add(child);
            
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
        }
      });
      
      // Check if all new meshes are loaded and visible, then remove old ones
      // Use requestAnimationFrame to ensure meshes are rendered
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          // Double RAF ensures the frame is rendered
          checkAndRemoveOldMeshes();
          // Also check again after a short delay as fallback
          setTimeout(() => {
            checkAndRemoveOldMeshes();
          }, 100);
        });
      });
      
      // Final check: ensure front mesh visibility is correct
      // This handles cases where the mesh was found but visibility wasn't set
      if (this.ledFrontMesh) {
        // Use updateFrontMeshVisibility which will check current state
        this.updateFrontMeshVisibility();
      }
    }, 300);
    
    // Fallback: Remove old meshes after a maximum timeout even if not all new ones are loaded
    // This prevents old meshes from staying forever if something goes wrong
    setTimeout(() => {
      if (!hasRemovedOldMeshes) {
        // Double-check if old meshes are still there
        oldMeshesToRemove.forEach(child => {
          if (this.ledsGroup.children.includes(child)) {
            this.ledsGroup.remove(child);
            // Dispose
            if (child && child.traverse) {
              child.traverse((mesh) => {
                if (mesh.isMesh) {
                  if (mesh.geometry) mesh.geometry.dispose();
                  if (mesh.material) {
                    if (Array.isArray(mesh.material)) {
                      mesh.material.forEach(mat => mat && mat.dispose());
                    } else {
                      mesh.material.dispose();
                    }
                  }
                }
              });
            }
          }
        });
        hasRemovedOldMeshes = true;
        debugLog('logging.meshLoader.loaded', '[LEDMapping] Old meshes removed after timeout (fallback)');
      }
    }, 2000);
    
    // Restore black material state if checkbox is checked
    // Wait a bit longer to ensure meshes are fully loaded
    setTimeout(() => {
      const blackGaragesCheckbox = document.getElementById('blackGarages');
      if (blackGaragesCheckbox && blackGaragesCheckbox.checked) {
        // Check if garage meshes are loaded before applying
        const garages = this.getGarageMeshes();
        if (garages.sl || garages.sr) {
          debugLog('logging.meshLoader.loaded', 'Restoring black material state for garages after mesh reload');
          this.applyBlackToGarages(true);
        } else {
          debugLog('logging.meshLoader.loaded', 'Garage meshes not loaded yet, retrying...');
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
    
    debugLog('logging.meshLoader.loaded', '[LEDMapping] Updated front mesh visibility to:', visibility, 'for mapping type:', this.currentMappingType);
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
    
    debugLog('logging.meshLoader.loaded', 'applyBlackToGarages called:', { apply, sl: !!garages.sl, sr: !!garages.sr });
    
    let meshCount = 0;
    
    // First, process garage meshes found by callbacks (for old mapping types)
    garageMeshes.forEach((garageMesh, index) => {
      if (!garageMesh) {
        debugLog('logging.meshLoader.loaded', `Garage mesh ${index === 0 ? 'SL' : 'SR'} not found`);
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
            debugLog('logging.meshLoader.loaded', `Applied black material to mesh in ${index === 0 ? 'SL' : 'SR'} garage`);
          } else {
            // Restore LED shader material (always create fresh to ensure uniforms are current)
            // Pass the texture material reference, mapping type, and garage flag to createLEDShaderMaterial
            child.material = this.createLEDShaderMaterial(this.material, this.currentMappingType, true);
            // Update shader with current texture
            this.updateLEDShaders(this.ledsGroup, this.material, this.currentMappingType);
            child.userData.originalMaterial = null;
            debugLog('logging.meshLoader.loaded', `Restored LED shader material to mesh in ${index === 0 ? 'SL' : 'SR'} garage`);
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
            debugLog('logging.meshLoader.loaded', `Applied black material to garage mesh by name: ${child.name}`);
          } else {
            // Restore LED shader material (this is a garage mesh)
            child.material = this.createLEDShaderMaterial(this.material, this.currentMappingType, true);
            this.updateLEDShaders(this.ledsGroup, this.material, this.currentMappingType);
            child.userData.originalMaterial = null;
            debugLog('logging.meshLoader.loaded', `Restored LED shader material to garage mesh by name: ${child.name}`);
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
            debugLog('logging.meshLoader.loaded', `Applied black material to garage mesh in ledsGroup: ${child.name}`);
          } else {
            // Restore LED shader material (this is a garage mesh)
            child.material = this.createLEDShaderMaterial(this.material, this.currentMappingType, true);
            this.updateLEDShaders(this.ledsGroup, this.material, this.currentMappingType);
            child.userData.originalMaterial = null;
            debugLog('logging.meshLoader.loaded', `Restored LED shader material to garage mesh in ledsGroup: ${child.name}`);
          }
        }
      });
    }
    
    if (meshCount === 0) {
      debugLog('logging.meshLoader.loaded', 'No meshes found in garage meshes. They may not be loaded yet.');
    } else {
      debugLog('logging.meshLoader.loaded', `Processed ${meshCount} meshes in garage meshes`);
    }
  }
}


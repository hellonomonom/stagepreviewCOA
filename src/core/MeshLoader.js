/**
 * Mesh Loader
 * Handles loading and managing 3D meshes from GLB files
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { getShaderType } from '../utils/shaderUtils.js';
import { createLEDShaderMaterial } from './ShaderManager.js';

export class MeshLoader {
  constructor(scene, shaderMaterials, materialReferences, createLEDShaderMaterialFn) {
    this.scene = scene;
    this.shaderMaterials = shaderMaterials;
    this.materialReferences = materialReferences;
    this.createLEDShaderMaterialFn = createLEDShaderMaterialFn;
    this.gltfLoader = new GLTFLoader();
    
    // Mesh references (will be set by callbacks)
    this.meshCallbacks = {
      onLEDFrontLoaded: null,
      onWingLoaded: null,
      onGarageLoaded: null,
      onDJLiftableLoaded: null,
      onFloorLoaded: null,
      onArtistsLoaded: null,
      onDJArtistLoaded: null,
      onDJLowLoaded: null,
      onDJHighLoaded: null
    };
  }
  
  /**
   * Set callback functions for mesh loading events
   * @param {Object} callbacks - Object with callback functions
   */
  setCallbacks(callbacks) {
    Object.assign(this.meshCallbacks, callbacks);
  }
  
  /**
   * Load a single mesh from a GLB file
   * @param {string} path - Path to the GLB file
   * @param {THREE.Group} targetGroup - Group to add the mesh to
   * @param {boolean} isStage - Whether this is a stage mesh (true) or LED mesh (false)
   * @param {THREE.ShaderMaterial} textureMaterial - Texture material for LED meshes
   * @param {string} mappingType - Current mapping type (optional, for mask application)
   */
  loadMesh(path, targetGroup, isStage = false, textureMaterial = null, mappingType = null) {
    this.gltfLoader.load(
      path,
      (gltf) => {
        const model = gltf.scene;
        model.userData.path = path; // Store path for identification
        targetGroup.add(model);
        
        if (!isStage && targetGroup.name === 'LEDs') {
          // Handle LED meshes
          this.handleLEDMesh(model, path, textureMaterial, mappingType);
        } else if (isStage) {
          // Handle stage meshes
          this.handleStageMesh(model, path);
        }
        
        console.log(`Loaded mesh: ${path}`);
      },
      (progress) => {
        // Loading progress (optional)
        if (progress.lengthComputable) {
          const percentComplete = (progress.loaded / progress.total) * 100;
          console.log(`Loading ${path}: ${percentComplete.toFixed(0)}%`);
        }
      },
      (error) => {
        console.error(`Error loading mesh ${path}:`, error);
      }
    );
  }
  
  /**
   * Handle LED mesh loading
   * @param {THREE.Object3D} model - Loaded model
   * @param {string} path - Mesh path
   * @param {THREE.ShaderMaterial} textureMaterial - Texture material
   * @param {string} mappingType - Current mapping type (optional, for mask application)
   */
  handleLEDMesh(model, path, textureMaterial, mappingType = null) {
    // Store reference to LED front mesh
    // For separate front mesh files (old mapping types)
    if (path.includes('LED_FRONT') || path.includes('LED_Front')) {
      if (this.meshCallbacks.onLEDFrontLoaded) {
        this.meshCallbacks.onLEDFrontLoaded(model);
      }
    }
    
    // For renderOption1 meshes (single GLB containing front mesh inside)
    // Find front mesh immediately when loading
    if (path.includes('Option1_Projection')) {
      model.traverse((child) => {
        if (child.isMesh && child.name && 
            (child.name.includes('FRONT') || child.name.includes('Front') || 
             child.name.includes('LED_FRONT') || child.name.includes('LED_Front'))) {
          // Found front mesh inside the GLB - call the callback
          if (this.meshCallbacks.onLEDFrontLoaded) {
            this.meshCallbacks.onLEDFrontLoaded(child);
            console.log('[MeshLoader] Found front mesh in renderOption1 GLB:', child.name);
          }
        }
      });
    }
    
    // Store references to wing meshes
    if (path.includes('SL_WING')) {
      if (this.meshCallbacks.onWingLoaded) {
        this.meshCallbacks.onWingLoaded('sl', model);
      }
    }
    if (path.includes('SR_WING')) {
      if (this.meshCallbacks.onWingLoaded) {
        this.meshCallbacks.onWingLoaded('sr', model);
      }
    }
    
    // Store references to garage meshes
    if (path.includes('SL_GARAGE')) {
      if (this.meshCallbacks.onGarageLoaded) {
        this.meshCallbacks.onGarageLoaded('sl', model);
      }
    }
    if (path.includes('SR_GARAGE')) {
      if (this.meshCallbacks.onGarageLoaded) {
        this.meshCallbacks.onGarageLoaded('sr', model);
      }
    }
    
    // Apply LED shader to LED meshes
    // Check if this is a garage mesh (for mask application in mapping types B and D, or Garagefix)
    const isGarageMesh = path.includes('SL_GARAGE') || path.includes('SR_GARAGE') || 
                         path.includes('SL_Garage') || path.includes('SR_Garage');
    const isGaragefixMesh = path.includes('Garagefix');
    
    model.traverse((child) => {
      if (child.isMesh) {
        // Store original material if needed
        if (!child.userData.originalMaterial) {
          child.userData.originalMaterial = child.material;
        }
        if (textureMaterial && this.createLEDShaderMaterialFn) {
          // Check if this specific child is a garage mesh (by name)
          let childIsGarage = isGarageMesh;
          if (!childIsGarage && child.name) {
            childIsGarage = child.name.includes('SL_GARAGE') || child.name.includes('SR_GARAGE') ||
                           child.name.includes('SL_Garage') || child.name.includes('SR_Garage') ||
                           child.name.includes('GARAGE') || child.name.includes('Garage');
          }
          child.material = this.createLEDShaderMaterialFn(textureMaterial, mappingType, childIsGarage, path);
        }
      }
    });
  }
  
  /**
   * Handle stage mesh loading
   * @param {THREE.Object3D} model - Loaded model
   * @param {string} path - Mesh path
   */
  handleStageMesh(model, path) {
    // Store reference to DJ low mesh
    if (path.includes('DJDeck_Down') || path.includes('DJ_Deck_Down')) {
      if (this.meshCallbacks.onDJLowLoaded) {
        this.meshCallbacks.onDJLowLoaded(model);
      }
    }
    
    // Store reference to DJ high mesh
    if (path.includes('DJDeck_Elevated') || path.includes('DJ_Deck_Elevated')) {
      if (this.meshCallbacks.onDJHighLoaded) {
        this.meshCallbacks.onDJHighLoaded(model);
      }
    }
    
    // Store reference to floor mesh
    if (path.includes('FLOOR') || path.includes('Floor') || path.includes('floor')) {
      if (this.meshCallbacks.onFloorLoaded) {
        this.meshCallbacks.onFloorLoaded(model);
      }
    }
    
    // Store individual meshes from artists model
    if (path.includes('ARTISTS') || path.includes('Artists') || path.includes('artists')) {
      model.traverse((child) => {
        if (child.isMesh) {
          if (this.meshCallbacks.onArtistsLoaded) {
            this.meshCallbacks.onArtistsLoaded(child);
          }
          
          // Store reference to DJ artist mesh
          if (child.name && (child.name.includes('DJ') || child.name.includes('dj'))) {
            if (this.meshCallbacks.onDJArtistLoaded) {
              this.meshCallbacks.onDJArtistLoaded(child);
            }
          }
        }
      });
    }
    
    // Determine shader type based on filename
    const shaderType = getShaderType(path);
    const shaderMaterial = this.shaderMaterials[shaderType];
    
    if (!shaderMaterial) {
      console.warn(`No shader material found for type: ${shaderType}`);
      return;
    }
    
    model.traverse((child) => {
      if (child.isMesh) {
        // Handle Artist mesh in DJDeck GLBs - assign artists shader
        if (child.name && (child.name.includes('Artist') || child.name === 'Artist')) {
          const artistsMaterial = this.shaderMaterials.artists.clone();
          child.material = artistsMaterial;
          
          // Store reference for UI control
          if (!this.materialReferences.artists) {
            this.materialReferences.artists = [];
          }
          this.materialReferences.artists.push(artistsMaterial);
          console.log(`[MeshLoader] Applied artists shader to Artist mesh: ${child.name}`);
          return;
        }
        
        // Handle non-Artist meshes in CrowdStage.glb - assign marble shader
        if (path.includes('CrowdStage')) {
          const marbleMaterial = this.shaderMaterials.marble.clone();
          child.material = marbleMaterial;
          
          // Store reference for UI control
          if (!this.materialReferences.marble) {
            this.materialReferences.marble = [];
          }
          this.materialReferences.marble.push(marbleMaterial);
          console.log(`[MeshLoader] Applied marble shader to CrowdStage mesh: ${child.name}`);
          return;
        }
        
        // Handle meshes starting with "E" in DJDeck GLBs - assign marble shader
        if ((path.includes('DJDeck_Down') || path.includes('DJDeck_Elevated') || 
             path.includes('DJ_Deck_Down') || path.includes('DJ_Deck_Elevated')) &&
            child.name && child.name.startsWith('E')) {
          const marbleMaterial = this.shaderMaterials.marble.clone();
          child.material = marbleMaterial;
          
          // Store reference for UI control
          if (!this.materialReferences.marble) {
            this.materialReferences.marble = [];
          }
          this.materialReferences.marble.push(marbleMaterial);
          console.log(`[MeshLoader] Applied marble shader to mesh starting with E: ${child.name}`);
          return;
        }
        
        // Handle Extrusionk... meshes - assign marble shader
        if (child.name && child.name.includes('Extrusionk')) {
          const marbleMaterial = this.shaderMaterials.marble.clone();
          child.material = marbleMaterial;
          
          // Store reference for UI control
          if (!this.materialReferences.marble) {
            this.materialReferences.marble = [];
          }
          this.materialReferences.marble.push(marbleMaterial);
          console.log(`[MeshLoader] Applied marble shader to Extrusionk mesh: ${child.name}`);
          return;
        }
        
        // Handle Cables_top and Cables_down meshes - assign cables shader
        if (child.name && (child.name.includes('Cables_top') || child.name.includes('Cables_down') || 
            child.name === 'Cables_top' || child.name === 'Cables_down')) {
          const cablesMaterial = this.shaderMaterials.cables.clone();
          child.material = cablesMaterial;
          
          // Store reference for UI control
          if (!this.materialReferences.cables) {
            this.materialReferences.cables = [];
          }
          this.materialReferences.cables.push(cablesMaterial);
          console.log(`[MeshLoader] Applied cables shader to cables mesh: ${child.name}`);
          return;
        }
        
        // Handle Platform_fixed* meshes in Stage_Platform.glb - assign marble shader
        if (path.includes('Stage_Platform') && child.name && child.name.includes('Platform_fixed')) {
          const marbleMaterial = this.shaderMaterials.marble.clone();
          child.material = marbleMaterial;
          
          // Store reference for UI control
          if (!this.materialReferences.marble) {
            this.materialReferences.marble = [];
          }
          this.materialReferences.marble.push(marbleMaterial);
          console.log(`[MeshLoader] Applied marble shader to Platform_fixed mesh: ${child.name}`);
          return;
        }
        
        // Skip DJ artist mesh - it should be handled separately
        if (this.meshCallbacks.onDJArtistLoaded && 
            child.name && (child.name.includes('DJ') || child.name.includes('dj'))) {
          // Apply artists shader to DJ artist mesh
          const artistsMaterial = this.shaderMaterials.artists.clone();
          child.material = artistsMaterial;
          
          // Store reference for UI control
          if (!this.materialReferences.artists) {
            this.materialReferences.artists = [];
          }
          this.materialReferences.artists.push(artistsMaterial);
          return;
        }
        
        // Store original material if needed
        if (!child.userData.originalMaterial) {
          child.userData.originalMaterial = child.material;
        }
        
        // Clone the shader material for this mesh
        const clonedMaterial = shaderMaterial.clone();
        child.material = clonedMaterial;
        
        // Store reference for UI control
        if (!this.materialReferences[shaderType]) {
          this.materialReferences[shaderType] = [];
        }
        this.materialReferences[shaderType].push(clonedMaterial);
      }
    });
    
    // Ensure DJ artist mesh always has artists shader after all operations
    if (path.includes('ARTISTS')) {
      model.traverse((child) => {
        if (child.isMesh && child.name && (child.name.includes('DJ') || child.name.includes('dj'))) {
          const artistsMaterial = this.shaderMaterials.artists.clone();
          child.material = artistsMaterial;
          
          // Update material reference
          if (!this.materialReferences.artists) {
            this.materialReferences.artists = [];
          }
          const existingIndex = this.materialReferences.artists.findIndex(m => m === child.material);
          if (existingIndex === -1) {
            this.materialReferences.artists.push(artistsMaterial);
          }
        }
      });
    }
  }
}



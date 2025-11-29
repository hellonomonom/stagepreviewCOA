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
      onDJArtistLoaded: null
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
   */
  loadMesh(path, targetGroup, isStage = false, textureMaterial = null) {
    this.gltfLoader.load(
      path,
      (gltf) => {
        const model = gltf.scene;
        model.userData.path = path; // Store path for identification
        targetGroup.add(model);
        
        if (!isStage && targetGroup.name === 'LEDs') {
          // Handle LED meshes
          this.handleLEDMesh(model, path, textureMaterial);
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
   */
  handleLEDMesh(model, path, textureMaterial) {
    // Store reference to LED front mesh
    if (path.includes('LED_FRONT') || path.includes('LED_Front')) {
      if (this.meshCallbacks.onLEDFrontLoaded) {
        this.meshCallbacks.onLEDFrontLoaded(model);
      }
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
    model.traverse((child) => {
      if (child.isMesh) {
        // Store original material if needed
        if (!child.userData.originalMaterial) {
          child.userData.originalMaterial = child.material;
        }
        if (textureMaterial && this.createLEDShaderMaterialFn) {
          child.material = this.createLEDShaderMaterialFn(textureMaterial);
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
    // Store reference to DJ liftable mesh
    if (path.includes('STAGE_DJ_LIFTABLE') || path.includes('Stage_DJ_Liftable')) {
      if (this.meshCallbacks.onDJLiftableLoaded) {
        this.meshCallbacks.onDJLiftableLoaded(model);
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


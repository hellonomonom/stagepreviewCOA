/**
 * Crowd Spawner
 * Handles spawning and managing crowd meshes on the floor
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { crowdMeshPaths } from '../config/meshPaths.js';

export class CrowdSpawner {
  constructor(scene, floorMesh, shaderMaterials, materialReferences = null) {
    this.scene = scene;
    this.floorMesh = floorMesh;
    this.shaderMaterials = shaderMaterials;
    this.materialReferences = materialReferences;
    this.gltfLoader = new GLTFLoader();
    
    // Crowd mesh data
    this.crowdMeshData = []; // Array of {geometry} objects (materials are applied from shaderMaterials)
    this.crowdMeshes = []; // Array to store individual meshes
    this.crowdInstances = null;
  }
  
  /**
   * Set floor mesh reference
   * @param {THREE.Object3D} floorMesh - Floor mesh
   */
  setFloorMesh(floorMesh) {
    this.floorMesh = floorMesh;
  }
  
  /**
   * Pre-load all crowd meshes
   * @returns {Promise} Promise that resolves when all meshes are loaded
   */
  async preloadCrowdMeshes() {
    if (this.crowdMeshData.length > 0) {
      return Promise.resolve(); // Already loaded
    }
    
    return new Promise((resolve, reject) => {
      let loadedCount = 0;
      const totalMeshes = crowdMeshPaths.length;
      let hasError = false;
      
      if (totalMeshes === 0) {
        resolve();
        return;
      }
      
      crowdMeshPaths.forEach((path) => {
        this.gltfLoader.load(
          path,
          (gltf) => {
            const model = gltf.scene;
            let foundGeometry = null;
            let foundMaterial = null;
            
            model.traverse((child) => {
              if (child.isMesh) {
                if (!foundGeometry) {
                  foundGeometry = child.geometry;
                  foundMaterial = child.material;
                }
              }
            });
            
            if (foundGeometry) {
              // Clone geometry to avoid sharing issues
              const geometry = foundGeometry.clone();
              
              // Store only geometry - we'll use the crowd shader material when spawning
              this.crowdMeshData.push({
                geometry: geometry
              });
              
              console.log(`Loaded crowd mesh ${path}, total loaded: ${this.crowdMeshData.length}`);
            }
            
            loadedCount++;
            console.log(`Crowd mesh loading progress: ${loadedCount}/${totalMeshes}, loaded meshes: ${this.crowdMeshData.length}`);
            if (loadedCount === totalMeshes) {
              if (hasError && this.crowdMeshData.length === 0) {
                reject(new Error('Failed to load any crowd meshes'));
              } else {
                resolve();
              }
            }
          },
          undefined,
          (error) => {
            console.error(`Error loading crowd mesh ${path}:`, error);
            hasError = true;
            loadedCount++;
            if (loadedCount === totalMeshes) {
              if (this.crowdMeshData.length === 0) {
                reject(new Error('Failed to load any crowd meshes'));
              } else {
                resolve(); // Resolve with partial data
              }
            }
          }
        );
      });
    });
  }
  
  /**
   * Spawn crowd instances on the floor
   * @param {number} instanceCount - Number of crowd instances to spawn
   */
  spawnCrowdInstances(instanceCount = 100) {
    if (!this.floorMesh) {
      console.warn('Floor mesh not available for crowd spawning');
      return;
    }
    
    if (this.crowdMeshData.length === 0) {
      console.error('No crowd mesh data available');
      return;
    }
    
    // Clean up existing meshes
    this.cleanup();
    
    // Update floor mesh world matrix first
    this.floorMesh.updateMatrixWorld(true);
    
    // Find the actual floor mesh (floorMesh might be a Group)
    let actualFloorMesh = null;
    if (this.floorMesh.isMesh) {
      actualFloorMesh = this.floorMesh;
    } else {
      this.floorMesh.traverse((child) => {
        if (child.isMesh && !actualFloorMesh) {
          actualFloorMesh = child;
        }
      });
    }
    
    if (!actualFloorMesh) {
      console.error('Could not find actual floor mesh');
      return;
    }
    
    // Get floor bounding box
    const box = new THREE.Box3();
    box.setFromObject(actualFloorMesh);
    const floorMin = box.min;
    const floorMax = box.max;
    const floorSize = box.getSize(new THREE.Vector3());
    
    // Generate random positions on the floor mesh
    const margin = 0.1;
    const positions = [];
    for (let i = 0; i < instanceCount; i++) {
      positions.push({
        x: floorMin.x + margin + Math.random() * (floorSize.x - 2 * margin),
        y: 0, // Will be set based on raycast
        z: floorMin.z + margin + Math.random() * (floorSize.z - 2 * margin)
      });
    }
    
    // Create raycaster for positioning meshes on floor surface
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), new THREE.PerspectiveCamera());
    
    // Spawn meshes at positions
    positions.forEach((pos, index) => {
      // Raycast to find floor surface
      raycaster.set(
        new THREE.Vector3(pos.x, floorMax.y + 10, pos.z),
        new THREE.Vector3(0, -1, 0)
      );
      
      const intersects = raycaster.intersectObject(this.floorMesh, true);
      
      // Create a temporary mesh to calculate bounding box
      const randomMeshData = this.crowdMeshData[Math.floor(Math.random() * this.crowdMeshData.length)];
      // Use crowd shader material for temp mesh calculation
      const tempMaterial = this.shaderMaterials.crowd ? this.shaderMaterials.crowd.clone() : new THREE.MeshBasicMaterial({ color: 0x1e1e1e });
      const tempMesh = new THREE.Mesh(randomMeshData.geometry, tempMaterial);
      const meshBox = new THREE.Box3();
      meshBox.setFromObject(tempMesh);
      const meshMin = meshBox.min;
      const meshSize = meshBox.getSize(new THREE.Vector3());
      // Dispose temp mesh
      tempMaterial.dispose();
      
      let yPos = floorMin.y + floorSize.y * 0.5;
      
      if (intersects.length > 0) {
        // Position crowd mesh on top of the floor surface
        yPos = intersects[0].point.y - meshMin.y;
      } else {
        // Fallback: use bounding box top
        yPos = floorMin.y + floorSize.y - meshMin.y;
      }
      
      // Create a new mesh with the randomly selected geometry
      const clonedGeometry = randomMeshData.geometry.clone();
      
      // Ensure geometry is properly computed
      if (!clonedGeometry.boundingBox) {
        clonedGeometry.computeBoundingBox();
      }
      
      // Use crowd shader material instead of cloned material
      const crowdMaterial = this.shaderMaterials.crowd ? this.shaderMaterials.crowd.clone() : new THREE.MeshBasicMaterial({ color: 0x1e1e1e });
      crowdMaterial.needsUpdate = true;
      
      const mesh = new THREE.Mesh(clonedGeometry, crowdMaterial);
      mesh.position.set(pos.x, yPos, pos.z);
      mesh.rotation.y = -Math.PI / 2; // 90 degrees clockwise
      mesh.name = `CrowdInstance_${index}`;
      
      // Ensure mesh is visible and properly set up
      mesh.visible = true;
      mesh.frustumCulled = false;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      
      // Add to scene
      this.scene.add(mesh);
      this.crowdMeshes.push(mesh);
      
      // Register material in materialReferences for camera position updates
      if (this.materialReferences) {
        if (!this.materialReferences.crowd) {
          this.materialReferences.crowd = [];
        }
        this.materialReferences.crowd.push(crowdMaterial);
      }
      
      if (index < 5) {
        console.log(`Created mesh ${index} at position (${pos.x.toFixed(2)}, ${yPos.toFixed(2)}, ${pos.z.toFixed(2)})`);
      }
    });
    
    console.log(`Spawned ${instanceCount} crowd meshes on floor mesh with random mesh selection`);
  }
  
  /**
   * Clean up existing crowd meshes
   */
  cleanup() {
    // Remove existing crowd instances
    if (this.crowdInstances) {
      if (this.crowdInstances.parent) {
        this.crowdInstances.parent.remove(this.crowdInstances);
      }
      this.scene.remove(this.crowdInstances);
      this.crowdInstances.dispose();
      this.crowdInstances = null;
    }
    
    // Remove individual meshes and clear material references
    this.crowdMeshes.forEach(mesh => {
      if (mesh.parent) {
        mesh.parent.remove(mesh);
      }
      this.scene.remove(mesh);
      
      // Remove material from materialReferences
      if (this.materialReferences && this.materialReferences.crowd && mesh.material) {
        const index = this.materialReferences.crowd.indexOf(mesh.material);
        if (index > -1) {
          this.materialReferences.crowd.splice(index, 1);
        }
      }
      
      if (mesh.geometry) {
        mesh.geometry.dispose();
      }
      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(mat => mat.dispose());
        } else {
          mesh.material.dispose();
        }
      }
    });
    this.crowdMeshes = [];
    
    // Also search scene for any remaining crowd instances by name
    this.scene.traverse((object) => {
      if (object.name === 'CrowdInstances' && object !== this.crowdInstances) {
        this.scene.remove(object);
        if (object.dispose) {
          object.dispose();
        }
      }
    });
  }
  
  /**
   * Spawn crowd (loads meshes if needed, then spawns)
   * @param {number} instanceCount - Number of instances to spawn
   */
  async spawnCrowd(instanceCount = 100) {
    if (!this.floorMesh) {
      console.warn('Floor mesh not available for crowd spawning');
      return;
    }
    
    // Pre-load meshes if needed
    if (this.crowdMeshData.length === 0) {
      try {
        await this.preloadCrowdMeshes();
      } catch (error) {
        console.error('Failed to preload crowd meshes:', error);
        return;
      }
    }
    
    // Spawn instances
    this.spawnCrowdInstances(instanceCount);
  }
}


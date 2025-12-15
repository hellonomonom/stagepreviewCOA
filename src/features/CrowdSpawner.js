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
    
    // Spawn area mesh for position sampling
    this.spawnAreaMesh = null;
    this.spawnAreaPositions = []; // Cached positions sampled from spawn area
    this.cachedSpawnPositions = null; // Cached 5000 positions from file/localStorage
    this.usedPositionIndices = new Set(); // Track which positions have been used
  }
  
  /**
   * Set floor mesh reference
   * @param {THREE.Object3D} floorMesh - Floor mesh
   */
  setFloorMesh(floorMesh) {
    this.floorMesh = floorMesh;
  }
  
  /**
   * Find spawn area mesh in the scene and sample positions from it
   * @returns {Promise} Promise that resolves when spawn area is found and positions are sampled
   */
  async loadSpawnArea() {
    if (this.spawnAreaPositions.length > 0) {
      return Promise.resolve(); // Already loaded
    }
    
    // The SpawnArea mesh is already loaded as part of stage meshes
    // Since it contains "floor" in the path, it might be the floorMesh
    let spawnAreaMesh = null;
    
    // Method 1: Check if floorMesh is the SpawnArea (it contains "CrowdFloor_SpawnArea" in path)
    if (this.floorMesh) {
      const checkPath = (obj) => {
        if (obj.userData && obj.userData.path) {
          const path = obj.userData.path.toLowerCase();
          if (path.includes('spawnarea')) {
            return true;
          }
        }
        // Check children
        if (obj.children && obj.children.length > 0) {
          for (let child of obj.children) {
            if (checkPath(child)) return true;
          }
        }
        return false;
      };
      
      if (checkPath(this.floorMesh)) {
        spawnAreaMesh = this.floorMesh;
        console.log('[CrowdSpawner] Found SpawnArea mesh as floorMesh');
      }
    }
    
    // Method 2: Search the scene for SpawnArea mesh
    if (!spawnAreaMesh) {
      this.scene.traverse((object) => {
        if (!spawnAreaMesh && object.userData && object.userData.path) {
          const path = object.userData.path.toLowerCase();
          if (path.includes('spawnarea')) {
            spawnAreaMesh = object;
            console.log('[CrowdSpawner] Found SpawnArea mesh in scene:', object);
          }
        }
      });
    }
    
    if (spawnAreaMesh) {
      this.spawnAreaMesh = spawnAreaMesh;
      
      // Sample and save 5000 positions from the spawn area mesh
      await this.sampleAndSavePositions(spawnAreaMesh);
      
      console.log(`[CrowdSpawner] Loaded ${this.cachedSpawnPositions ? this.cachedSpawnPositions.length : 0} positions from cache/file`);
      
      if (!this.cachedSpawnPositions || this.cachedSpawnPositions.length === 0) {
        console.warn('[CrowdSpawner] No positions sampled from spawn area mesh. Mesh may not have geometry.');
      }
      
      return Promise.resolve();
    } else {
      console.warn('[CrowdSpawner] Could not find SpawnArea mesh in scene. Will use fallback positioning.');
      return Promise.reject(new Error('SpawnArea mesh not found in scene'));
    }
  }
  
  /**
   * Sample exactly 5000 positions from mesh and save to localStorage
   * @param {THREE.Object3D} mesh - Mesh to sample from
   * @returns {Promise} Promise that resolves with the positions array
   */
  async sampleAndSavePositions(mesh) {
    // Bump storage key version to force resampling with updated spawn area
    const STORAGE_KEY = 'crowdSpawnPositions_v2';
    const OLD_STORAGE_KEYS = ['crowdSpawnPositions'];
    const NUM_SAMPLES = 5000;
    
    // Check if positions are already cached in localStorage
    try {
      // Prefer new key; if missing or invalid, we'll resample
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const positions = JSON.parse(cached);
        if (Array.isArray(positions) && positions.length === NUM_SAMPLES) {
          console.log(`[CrowdSpawner] Loaded ${positions.length} cached positions from localStorage`);
          this.cachedSpawnPositions = positions;
          return positions;
        }
      }
    } catch (error) {
      console.warn('[CrowdSpawner] Error loading cached positions:', error);
    }
    
    // Sample new positions
    console.log(`[CrowdSpawner] Sampling ${NUM_SAMPLES} positions from mesh...`);
    const positions = this.samplePositionsFromMesh(mesh, NUM_SAMPLES);
    
    // Save to localStorage
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
      // Clean up any old keys to avoid confusion
      OLD_STORAGE_KEYS.forEach(key => {
        try {
          localStorage.removeItem(key);
        } catch (e) {
          // ignore
        }
      });
      console.log(`[CrowdSpawner] Saved ${positions.length} positions to localStorage`);
    } catch (error) {
      console.warn('[CrowdSpawner] Error saving positions to localStorage:', error);
    }
    
    this.cachedSpawnPositions = positions;
    return positions;
  }
  
  /**
   * Sample positions from a mesh by sampling random points on the surface
   * @param {THREE.Object3D} mesh - Mesh to sample from
   * @param {number} numSamples - Number of positions to sample (default: 5000)
   * @returns {Array} Array of {x, y, z} position objects
   */
  samplePositionsFromMesh(mesh, numSamples = 5000) {
    const positions = [];
    const v1 = new THREE.Vector3();
    const v2 = new THREE.Vector3();
    const v3 = new THREE.Vector3();
    const tempVector = new THREE.Vector3();
    const triangles = [];
    const triangleAreas = [];
    let totalArea = 0;
    
    mesh.traverse((child) => {
      if (child.isMesh && child.geometry) {
        const geometry = child.geometry;
        
        // Ensure geometry has position attribute
        if (!geometry.attributes.position) {
          return;
        }
        
        // Update world matrix
        child.updateMatrixWorld(true);
        
        const positionAttribute = geometry.attributes.position;
        const indexAttribute = geometry.index;
        
        // Get triangles from geometry
        if (indexAttribute) {
          // Indexed geometry
          const indexCount = indexAttribute.count;
          for (let i = 0; i < indexCount; i += 3) {
            const i1 = indexAttribute.getX(i);
            const i2 = indexAttribute.getX(i + 1);
            const i3 = indexAttribute.getX(i + 2);
            
            v1.fromBufferAttribute(positionAttribute, i1);
            v2.fromBufferAttribute(positionAttribute, i2);
            v3.fromBufferAttribute(positionAttribute, i3);
            
            // Transform to world space
            v1.applyMatrix4(child.matrixWorld);
            v2.applyMatrix4(child.matrixWorld);
            v3.applyMatrix4(child.matrixWorld);
            
            // Calculate triangle area
            const edge1 = new THREE.Vector3().subVectors(v2, v1);
            const edge2 = new THREE.Vector3().subVectors(v3, v1);
            const area = 0.5 * edge1.cross(edge2).length();
            
            if (area > 0) {
              triangles.push({
                v1: v1.clone(),
                v2: v2.clone(),
                v3: v3.clone(),
                area: area
              });
              triangleAreas.push(area);
              totalArea += area;
            }
          }
        } else {
          // Non-indexed geometry
          const vertexCount = positionAttribute.count;
          for (let i = 0; i < vertexCount; i += 3) {
            v1.fromBufferAttribute(positionAttribute, i);
            v2.fromBufferAttribute(positionAttribute, i + 1);
            v3.fromBufferAttribute(positionAttribute, i + 2);
            
            // Transform to world space
            v1.applyMatrix4(child.matrixWorld);
            v2.applyMatrix4(child.matrixWorld);
            v3.applyMatrix4(child.matrixWorld);
            
            // Calculate triangle area
            const edge1 = new THREE.Vector3().subVectors(v2, v1);
            const edge2 = new THREE.Vector3().subVectors(v3, v1);
            const area = 0.5 * edge1.cross(edge2).length();
            
            if (area > 0) {
              triangles.push({
                v1: v1.clone(),
                v2: v2.clone(),
                v3: v3.clone(),
                area: area
              });
              triangleAreas.push(area);
              totalArea += area;
            }
          }
        }
      }
    });
    
    if (triangles.length === 0) {
      console.warn('[CrowdSpawner] No triangles found in spawn area mesh.');
      return positions;
    }
    
    // Sample exactly numSamples random points on triangles (area-weighted)
    
    for (let i = 0; i < numSamples; i++) {
      // Select triangle based on area (larger triangles get more samples)
      let randomArea = Math.random() * totalArea;
      let triangleIndex = 0;
      let accumulatedArea = 0;
      
      for (let j = 0; j < triangleAreas.length; j++) {
        accumulatedArea += triangleAreas[j];
        if (randomArea <= accumulatedArea) {
          triangleIndex = j;
          break;
        }
      }
      
      const triangle = triangles[triangleIndex];
      
      // Sample random point on triangle using barycentric coordinates
      let u = Math.random();
      let v = Math.random();
      
      // Ensure point is inside triangle
      if (u + v > 1) {
        u = 1 - u;
        v = 1 - v;
      }
      
      const w = 1 - u - v;
      
      // Calculate point on triangle
      tempVector.set(0, 0, 0);
      tempVector.addScaledVector(triangle.v1, w);
      tempVector.addScaledVector(triangle.v2, u);
      tempVector.addScaledVector(triangle.v3, v);
      
      positions.push({
        x: tempVector.x,
        y: tempVector.y,
        z: tempVector.z
      });
    }
    
    console.log(`[CrowdSpawner] Sampled ${positions.length} positions from ${triangles.length} triangles (total area: ${totalArea.toFixed(2)})`);
    
    return positions;
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
    
    // Reset used positions when respawning
    this.usedPositionIndices.clear();
    
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
    
    // Get floor bounding box (for fallback raycasting)
    const box = new THREE.Box3();
    box.setFromObject(actualFloorMesh);
    const floorMin = box.min;
    const floorMax = box.max;
    const floorSize = box.getSize(new THREE.Vector3());
    
    // Generate positions from cached spawn positions if available, otherwise use bounding box
    let positions = [];
    if (this.cachedSpawnPositions && this.cachedSpawnPositions.length > 0) {
      // Reset used positions if we need more than available
      if (this.usedPositionIndices.size >= this.cachedSpawnPositions.length) {
        console.log('[CrowdSpawner] All positions used, resetting used positions set');
        this.usedPositionIndices.clear();
      }
      
      // Get available indices (not yet used)
      const availableIndices = [];
      for (let i = 0; i < this.cachedSpawnPositions.length; i++) {
        if (!this.usedPositionIndices.has(i)) {
          availableIndices.push(i);
        }
      }
      
      // Shuffle available indices for random selection
      for (let i = availableIndices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [availableIndices[i], availableIndices[j]] = [availableIndices[j], availableIndices[i]];
      }
      
      // Select positions from available indices, avoiding duplicates
      const positionsToUse = Math.min(instanceCount, availableIndices.length);
      console.log(`[CrowdSpawner] Selecting ${positionsToUse} unique positions from ${this.cachedSpawnPositions.length} cached positions (${availableIndices.length} available)`);
      
      for (let i = 0; i < positionsToUse; i++) {
        const index = availableIndices[i];
        this.usedPositionIndices.add(index);
        const sampledPos = this.cachedSpawnPositions[index];
        positions.push({
          x: sampledPos.x,
          y: null, // Will be set based on raycast to floor
          z: sampledPos.z
        });
      }
      
      // If we need more positions than available, reuse some (shuffled)
      if (instanceCount > positionsToUse) {
        console.warn(`[CrowdSpawner] Requested ${instanceCount} positions but only ${positionsToUse} unique positions available. Reusing positions.`);
        const remaining = instanceCount - positionsToUse;
        const shuffledIndices = Array.from({ length: this.cachedSpawnPositions.length }, (_, i) => i);
        for (let i = shuffledIndices.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffledIndices[i], shuffledIndices[j]] = [shuffledIndices[j], shuffledIndices[i]];
        }
        for (let i = 0; i < remaining; i++) {
          const index = shuffledIndices[i % shuffledIndices.length];
          const sampledPos = this.cachedSpawnPositions[index];
          positions.push({
            x: sampledPos.x,
            y: null,
            z: sampledPos.z
          });
        }
      }
      
      console.log(`[CrowdSpawner] Using ${positions.length} positions from cached spawn area (${positionsToUse} unique, ${instanceCount - positionsToUse} reused)`);
    } else {
      // Fallback to bounding box method
      console.warn('[CrowdSpawner] No spawn area positions available, using bounding box fallback');
      const margin = 0.1;
      for (let i = 0; i < instanceCount; i++) {
        positions.push({
          x: floorMin.x + margin + Math.random() * (floorSize.x - 2 * margin),
          y: null, // Will be set based on raycast
          z: floorMin.z + margin + Math.random() * (floorSize.z - 2 * margin)
        });
      }
      console.log(`[CrowdSpawner] Using bounding box fallback for crowd positions`);
    }
    
    if (positions.length === 0) {
      console.error('No positions generated for crowd spawning!');
      return;
    }
    
    // Create raycaster for positioning meshes on floor surface
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), new THREE.PerspectiveCamera());
    
    // Spawn meshes at positions
    console.log(`[CrowdSpawner] Starting to spawn ${positions.length} meshes...`);
    let spawnedCount = 0;
    
    positions.forEach((pos, index) => {
      try {
        // Raycast to find floor surface
        raycaster.set(
          new THREE.Vector3(pos.x, floorMax.y + 10, pos.z),
          new THREE.Vector3(0, -1, 0)
        );
        
        const intersects = raycaster.intersectObject(this.floorMesh, true);
        
        // Create a temporary mesh to calculate bounding box
        const randomMeshData = this.crowdMeshData[Math.floor(Math.random() * this.crowdMeshData.length)];
        if (!randomMeshData || !randomMeshData.geometry) {
          console.error(`[CrowdSpawner] Invalid mesh data at index ${index}`);
          return;
        }
        
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
        if (!crowdMaterial) {
          console.error(`[CrowdSpawner] Failed to create material at index ${index}`);
          return;
        }
        crowdMaterial.needsUpdate = true;
        
        const mesh = new THREE.Mesh(clonedGeometry, crowdMaterial);
        if (!mesh) {
          console.error(`[CrowdSpawner] Failed to create mesh at index ${index}`);
          return;
        }
        
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
        spawnedCount++;
        
        // Register material in materialReferences for camera position updates
        if (this.materialReferences) {
          if (!this.materialReferences.crowd) {
            this.materialReferences.crowd = [];
          }
          this.materialReferences.crowd.push(crowdMaterial);
        }
        
        if (index < 5) {
          console.log(`[CrowdSpawner] Created mesh ${index} at position (${pos.x.toFixed(2)}, ${yPos.toFixed(2)}, ${pos.z.toFixed(2)})`);
        }
      } catch (error) {
        console.error(`[CrowdSpawner] Error creating mesh at index ${index}:`, error);
      }
    });
    
    console.log(`[CrowdSpawner] Successfully spawned ${spawnedCount} out of ${positions.length} crowd meshes`);
    console.log(`[CrowdSpawner] Total crowd meshes in array: ${this.crowdMeshes.length}`);
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
    
    // Reset used positions when cleaning up
    this.usedPositionIndices.clear();
    
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
    console.log(`[CrowdSpawner] spawnCrowd called with count: ${instanceCount}`);
    
    if (!this.floorMesh) {
      console.warn('[CrowdSpawner] Floor mesh not available for crowd spawning');
      return;
    }
    
    // Pre-load meshes if needed
    if (this.crowdMeshData.length === 0) {
      console.log('[CrowdSpawner] Preloading crowd meshes...');
      try {
        await this.preloadCrowdMeshes();
        console.log(`[CrowdSpawner] Preloaded ${this.crowdMeshData.length} crowd meshes`);
      } catch (error) {
        console.error('[CrowdSpawner] Failed to preload crowd meshes:', error);
        return;
      }
    }
    
    // Load spawn area if not already loaded
    if (!this.cachedSpawnPositions || this.cachedSpawnPositions.length === 0) {
      console.log('[CrowdSpawner] Loading spawn area mesh...');
      try {
        await this.loadSpawnArea();
        console.log(`[CrowdSpawner] Spawn area loaded, ${this.cachedSpawnPositions ? this.cachedSpawnPositions.length : 0} positions cached`);
      } catch (error) {
        console.warn('[CrowdSpawner] Failed to load spawn area mesh, using fallback positioning:', error);
        // Continue with fallback method
      }
    }
    
    // Spawn instances
    console.log('[CrowdSpawner] Calling spawnCrowdInstances...');
    this.spawnCrowdInstances(instanceCount);
  }
}


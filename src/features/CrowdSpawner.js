/**
 * Crowd Spawner
 * Handles spawning and managing crowd meshes on the floor
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { crowdMeshPaths } from '../config/meshPaths.js';
import { debugLog } from '../utils/logger.js';

export class CrowdSpawner {
  constructor(scene, floorMesh, shaderMaterials, materialReferences = null) {
    this.scene = scene;
    this.floorMesh = floorMesh;
    this.shaderMaterials = shaderMaterials;
    this.materialReferences = materialReferences;
    this.gltfLoader = new GLTFLoader();
    
    // Crowd mesh data
    this.crowdMeshData = []; // Array of { geometry, bboxMinY } objects (materials come from shaderMaterials)
    this.crowdMeshes = []; // Array to store individual meshes
    // New: instanced crowd
    this.crowdInstancesGroup = null; // THREE.Group containing instanced meshes
    this.crowdInstancedMeshes = []; // Array<THREE.InstancedMesh>
    
    // Spawn area mesh for position sampling
    this.spawnAreaMesh = null;
    this.spawnAreaPositions = []; // Cached positions sampled from spawn area
    this.cachedSpawnPositions = null; // Cached 10000 positions from file/localStorage
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
        debugLog('logging.crowd.verbose', '[CrowdSpawner] Found SpawnArea mesh as floorMesh');
      }
    }
    
    // Method 2: Search the scene for SpawnArea mesh
    if (!spawnAreaMesh) {
      this.scene.traverse((object) => {
        if (!spawnAreaMesh && object.userData && object.userData.path) {
          const path = object.userData.path.toLowerCase();
          if (path.includes('spawnarea')) {
            spawnAreaMesh = object;
            debugLog('logging.crowd.verbose', '[CrowdSpawner] Found SpawnArea mesh in scene:', object);
          }
        }
      });
    }
    
    if (spawnAreaMesh) {
      this.spawnAreaMesh = spawnAreaMesh;
      
      // Sample and save 10000 positions from the spawn area mesh
      await this.sampleAndSavePositions(spawnAreaMesh);
      
      debugLog('logging.crowd.verbose', `[CrowdSpawner] Loaded ${this.cachedSpawnPositions ? this.cachedSpawnPositions.length : 0} positions from cache/file`);
      
      if (!this.cachedSpawnPositions || this.cachedSpawnPositions.length === 0) {
        debugLog('logging.crowd.verbose', '[CrowdSpawner] No positions sampled from spawn area mesh. Mesh may not have geometry.');
      }
      
      return Promise.resolve();
    } else {
      debugLog('logging.crowd.verbose', '[CrowdSpawner] Could not find SpawnArea mesh in scene. Will use fallback positioning.');
      return Promise.reject(new Error('SpawnArea mesh not found in scene'));
    }
  }
  
  /**
   * Sample exactly 10000 positions from mesh and save to localStorage
   * @param {THREE.Object3D} mesh - Mesh to sample from
   * @returns {Promise} Promise that resolves with the positions array
   */
  async sampleAndSavePositions(mesh) {
    // Bump storage key version to force resampling with updated spawn area
    const STORAGE_KEY = 'crowdSpawnPositions_v4';
    const OLD_STORAGE_KEYS = ['crowdSpawnPositions', 'crowdSpawnPositions_v2', 'crowdSpawnPositions_v3'];
    const NUM_SAMPLES = 10000;
    
    // Check if positions are already cached in localStorage
    try {
      // Prefer new key; if missing or invalid, we'll resample
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const positions = JSON.parse(cached);
        if (Array.isArray(positions) && positions.length === NUM_SAMPLES) {
          debugLog('logging.crowd.verbose', `[CrowdSpawner] Loaded ${positions.length} cached positions from localStorage`);
          this.cachedSpawnPositions = positions;
          return positions;
        }
      }
    } catch (error) {
      debugLog('logging.crowd.verbose', '[CrowdSpawner] Error loading cached positions:', error);
    }
    
    // Sample new positions
    debugLog('logging.crowd.verbose', `[CrowdSpawner] Sampling ${NUM_SAMPLES} positions from mesh...`);
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
      debugLog('logging.crowd.verbose', `[CrowdSpawner] Saved ${positions.length} positions to localStorage`);
    } catch (error) {
      debugLog('logging.crowd.verbose', '[CrowdSpawner] Error saving positions to localStorage:', error);
    }
    
    this.cachedSpawnPositions = positions;
    return positions;
  }
  
  /**
   * Sample positions from a mesh by sampling random points on the surface
   * @param {THREE.Object3D} mesh - Mesh to sample from
   * @param {number} numSamples - Number of positions to sample (default: 10000)
   * @returns {Array} Array of {x, y, z} position objects
   */
  samplePositionsFromMesh(mesh, numSamples = 10000) {
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
      debugLog('logging.crowd.verbose', '[CrowdSpawner] No triangles found in spawn area mesh.');
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
    
    debugLog('logging.crowd.verbose', `[CrowdSpawner] Sampled ${positions.length} positions from ${triangles.length} triangles (total area: ${totalArea.toFixed(2)})`);
    
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
              if (!geometry.boundingBox) {
                geometry.computeBoundingBox();
              }
              const bboxMinY = geometry.boundingBox ? geometry.boundingBox.min.y : 0;
              
              // Store only geometry - we'll use the crowd shader material when spawning
              this.crowdMeshData.push({
                geometry: geometry,
                bboxMinY
              });
              
              debugLog('logging.crowd.verbose', `Loaded crowd mesh ${path}, total loaded: ${this.crowdMeshData.length}`);
            }
            
            loadedCount++;
            debugLog('logging.crowd.verbose', `Crowd mesh loading progress: ${loadedCount}/${totalMeshes}, loaded meshes: ${this.crowdMeshData.length}`);
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
      debugLog('logging.crowd.verbose', 'Floor mesh not available for crowd spawning');
      return;
    }
    
    if (this.crowdMeshData.length === 0) {
      console.error('No crowd mesh data available');
      return;
    }
    
    // If instanceCount is 0, just clean up and return
    if (instanceCount === 0) {
      this.cleanup();
      return;
    }
    
    // Clean up existing crowd
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
    
    // Generate spawn positions.
    // Prefer cached spawn-area points (already on the surface, including y).
    // Fallback to random XZ + raycast to floor for Y.
    let positions = [];
    const hasCached = this.cachedSpawnPositions && this.cachedSpawnPositions.length > 0;
    if (hasCached) {
      // Reset used positions if we exhausted the cache.
      if (this.usedPositionIndices.size >= this.cachedSpawnPositions.length) {
        debugLog('logging.crowd.verbose', '[CrowdSpawner] All cached positions used, resetting used positions set');
        this.usedPositionIndices.clear();
      }

      // Select indices (avoid duplicates until cache is exhausted).
      const availableIndices = [];
      for (let i = 0; i < this.cachedSpawnPositions.length; i++) {
        if (!this.usedPositionIndices.has(i)) availableIndices.push(i);
      }
      // Shuffle indices for random selection
      for (let i = availableIndices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [availableIndices[i], availableIndices[j]] = [availableIndices[j], availableIndices[i]];
      }

      const positionsToUse = Math.min(instanceCount, availableIndices.length);
      for (let i = 0; i < positionsToUse; i++) {
        const idx = availableIndices[i];
        this.usedPositionIndices.add(idx);
        const p = this.cachedSpawnPositions[idx];
        positions.push({ x: p.x, y: p.y, z: p.z });
      }

      // If more requested than available unique indices, reuse randomly.
      if (instanceCount > positionsToUse) {
        const remaining = instanceCount - positionsToUse;
        for (let i = 0; i < remaining; i++) {
          const idx = Math.floor(Math.random() * this.cachedSpawnPositions.length);
          const p = this.cachedSpawnPositions[idx];
          positions.push({ x: p.x, y: p.y, z: p.z });
        }
      }
    } else {
      debugLog('logging.crowd.verbose', '[CrowdSpawner] No cached spawn area positions available, using bounding box + raycast fallback');
      const margin = 0.1;
      for (let i = 0; i < instanceCount; i++) {
        positions.push({
          x: floorMin.x + margin + Math.random() * (floorSize.x - 2 * margin),
          y: null,
          z: floorMin.z + margin + Math.random() * (floorSize.z - 2 * margin)
        });
      }
    }
    
    if (positions.length === 0) {
      console.error('No positions generated for crowd spawning!');
      return;
    }

    // For fallback positions without Y, raycast to floor once per position.
    const raycaster = new THREE.Raycaster();
    for (let i = 0; i < positions.length; i++) {
      if (positions[i].y !== null && positions[i].y !== undefined && Number.isFinite(positions[i].y)) {
        continue;
      }
      raycaster.set(
        new THREE.Vector3(positions[i].x, floorMax.y + 10, positions[i].z),
        new THREE.Vector3(0, -1, 0)
      );
      const hits = raycaster.intersectObject(this.floorMesh, true);
      if (hits.length > 0) {
        positions[i].y = hits[0].point.y;
      } else {
        positions[i].y = floorMin.y + floorSize.y * 0.5;
      }
    }

    // Create instanced meshes (one per crowd geometry) and distribute instances randomly.
    // Use the crowd material from shaderMaterials (all instances share the same material)
    const crowdMaterial = this.shaderMaterials?.crowd || new THREE.MeshBasicMaterial({ color: 0x1e1e1e });
    
    // Add crowd material to materialReferences so shader controls can update it
    // This ensures crowd instance materials are updated when shader controls change
    if (this.materialReferences && crowdMaterial && this.shaderMaterials?.crowd) {
      if (!this.materialReferences.crowd) {
        this.materialReferences.crowd = [];
      }
      // Only add if not already in the array (to avoid duplicates when respawning)
      if (!this.materialReferences.crowd.includes(crowdMaterial)) {
        this.materialReferences.crowd.push(crowdMaterial);
      }
    }

    // Pick which geometry each position uses.
    const geomCount = this.crowdMeshData.length;
    const assignments = new Array(positions.length);
    const counts = new Array(geomCount).fill(0);
    for (let i = 0; i < positions.length; i++) {
      const g = Math.floor(Math.random() * geomCount);
      assignments[i] = g;
      counts[g]++;
    }

    this.crowdInstancesGroup = new THREE.Group();
    this.crowdInstancesGroup.name = 'CrowdInstances';
    this.scene.add(this.crowdInstancesGroup);

    const tmpMatrix = new THREE.Matrix4();
    const tmpPos = new THREE.Vector3();
    const tmpQuat = new THREE.Quaternion();
    const tmpScale = new THREE.Vector3(1, 1, 1);

    // Build a list of indices for each geometry assignment
    const indicesByGeom = Array.from({ length: geomCount }, () => []);
    for (let i = 0; i < assignments.length; i++) {
      indicesByGeom[assignments[i]].push(i);
    }

    for (let g = 0; g < geomCount; g++) {
      const count = counts[g];
      if (count <= 0) continue;

      const data = this.crowdMeshData[g];
      if (!data || !data.geometry) continue;
      const bboxMinY = Number.isFinite(data.bboxMinY) ? data.bboxMinY : 0;

      const instanced = new THREE.InstancedMesh(data.geometry, crowdMaterial, count);
      instanced.name = `CrowdInstances_${g}`;
      instanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      instanced.frustumCulled = false; // wide spread; avoid incorrect culling
      instanced.castShadow = false;
      instanced.receiveShadow = false;

      const idxs = indicesByGeom[g];
      for (let j = 0; j < idxs.length; j++) {
        const p = positions[idxs[j]];
        // Place the mesh so its bottom touches the sampled floor Y.
        tmpPos.set(p.x, p.y - bboxMinY, p.z);

        // Preserve the previous orientation default (-90deg), plus a tiny random variation for naturalness.
        const rotY = (-Math.PI / 2) + (Math.random() - 0.5) * 0.35;
        tmpQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY);

        tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
        instanced.setMatrixAt(j, tmpMatrix);
      }
      instanced.instanceMatrix.needsUpdate = true;

      this.crowdInstancesGroup.add(instanced);
      this.crowdInstancedMeshes.push(instanced);
    }

    debugLog(
      'logging.crowd.verbose',
      `[CrowdSpawner] Spawned instanced crowd: ${positions.length} instances across ${this.crowdInstancedMeshes.length} instanced meshes`
    );
  }
  
  /**
   * Clean up existing crowd meshes
   */
  cleanup() {
    // Remove instanced crowd group
    if (this.crowdInstancesGroup) {
      if (this.crowdInstancesGroup.parent) {
        this.crowdInstancesGroup.parent.remove(this.crowdInstancesGroup);
      }
      this.scene.remove(this.crowdInstancesGroup);
      this.crowdInstancesGroup = null;
    }
    this.crowdInstancedMeshes = [];
    
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
      if (object.name === 'CrowdInstances') {
        this.scene.remove(object);
      }
    });
  }
  
  /**
   * Spawn crowd (loads meshes if needed, then spawns)
   * @param {number} instanceCount - Number of instances to spawn
   */
  async spawnCrowd(instanceCount = 100) {
    debugLog('logging.crowd.verbose', `[CrowdSpawner] spawnCrowd called with count: ${instanceCount}`);
    
    if (!this.floorMesh) {
      debugLog('logging.crowd.verbose', '[CrowdSpawner] Floor mesh not available for crowd spawning');
      return;
    }
    
    // If instanceCount is 0, just clean up and return
    if (instanceCount === 0) {
      this.cleanup();
      return;
    }
    
    // Pre-load meshes if needed
    if (this.crowdMeshData.length === 0) {
      debugLog('logging.crowd.verbose', '[CrowdSpawner] Preloading crowd meshes...');
      try {
        await this.preloadCrowdMeshes();
        debugLog('logging.crowd.verbose', `[CrowdSpawner] Preloaded ${this.crowdMeshData.length} crowd meshes`);
      } catch (error) {
        console.error('[CrowdSpawner] Failed to preload crowd meshes:', error);
        return;
      }
    }
    
    // Load spawn area if not already loaded
    if (!this.cachedSpawnPositions || this.cachedSpawnPositions.length === 0) {
      debugLog('logging.crowd.verbose', '[CrowdSpawner] Loading spawn area mesh...');
      try {
        await this.loadSpawnArea();
        debugLog('logging.crowd.verbose', `[CrowdSpawner] Spawn area loaded, ${this.cachedSpawnPositions ? this.cachedSpawnPositions.length : 0} positions cached`);
      } catch (error) {
        console.warn('[CrowdSpawner] Failed to load spawn area mesh, using fallback positioning:', error);
        // Continue with fallback method
      }
    }
    
    // Spawn instances
    debugLog('logging.crowd.verbose', '[CrowdSpawner] Calling spawnCrowdInstances...');
    this.spawnCrowdInstances(instanceCount);
  }
}


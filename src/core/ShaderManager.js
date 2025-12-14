/**
 * Shader Manager
 * Handles creation and management of shader materials
 */

import * as THREE from 'three';
import { shaderConfigs } from '../config/shaderConfig.js';
import { pbrVertexShader, pbrFragmentShader } from '../shaders/pbrShader.js';
import { textureVertexShader, textureFragmentShader } from '../shaders/textureShader.js';
import { ledVertexShader, ledFragmentShader } from '../shaders/ledShader.js';

/**
 * Create a PBR shader material
 * @param {Array<number>} defaultBaseColor - RGB color array [r, g, b]
 * @param {number} defaultRoughness - Roughness value (0-1)
 * @param {number} defaultSpecular - Specular value (0-1)
 * @returns {THREE.ShaderMaterial} PBR shader material
 */
export function createPBRShaderMaterial(defaultBaseColor = [0.8, 0.8, 0.8], defaultRoughness = 0.5, defaultSpecular = 0.5) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uBaseColor: { value: new THREE.Vector3(...defaultBaseColor) },
      uRoughness: { value: defaultRoughness },
      uSpecular: { value: defaultSpecular },
      uCameraPosition: { value: new THREE.Vector3() }
    },
    vertexShader: pbrVertexShader,
    fragmentShader: pbrFragmentShader,
    side: THREE.DoubleSide
  });
}

/**
 * Create all shader materials from config
 * @returns {Object} Object containing all shader materials
 */
export function createShaderMaterials() {
  const materials = {};
  Object.keys(shaderConfigs).forEach(shaderType => {
    const config = shaderConfigs[shaderType];
    materials[shaderType] = createPBRShaderMaterial(
      config.baseColor,
      config.roughness,
      config.specular
    );
    // Update uniforms to ensure correct values
    materials[shaderType].uniforms.uBaseColor.value.set(...config.baseColor);
    materials[shaderType].uniforms.uRoughness.value = config.roughness;
    materials[shaderType].uniforms.uSpecular.value = config.specular;
  });
  return materials;
}

/**
 * Create texture shader material (for texture management)
 * @returns {THREE.ShaderMaterial} Texture shader material
 */
export function createTextureShaderMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTexture: { value: null },
      uHasTexture: { value: 0.0 },
      uIsImageTexture: { value: 0.0 },
      uTextureScale: { value: 1.0 },
      uTextureOffsetU: { value: 0.0 },
      uTextureOffsetV: { value: 0.0 }
    },
    vertexShader: textureVertexShader,
    fragmentShader: textureFragmentShader,
    side: THREE.DoubleSide
  });
}

// Store mask texture globally
let maskTexture = null;

/**
 * Load mask texture
 * @returns {Promise<THREE.Texture>} Promise that resolves to the mask texture
 */
export function loadMaskTexture() {
  return new Promise((resolve, reject) => {
    if (maskTexture) {
      resolve(maskTexture);
      return;
    }
    
    const loader = new THREE.TextureLoader();
    loader.load(
      '/assets/textures/OverlapMask_4465x950.png',
      (texture) => {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.flipY = false; // Don't flip Y for mask
        maskTexture = texture;
        resolve(texture);
      },
      undefined,
      (error) => {
        console.error('Error loading mask texture:', error);
        reject(error);
      }
    );
  });
}

/**
 * Create LED shader material (uses video texture)
 * @param {THREE.ShaderMaterial} textureMaterial - Reference texture material
 * @param {string} mappingType - Current mapping type (optional)
 * @param {boolean} isGarageMesh - Whether this is a garage mesh (optional, for mask application)
 * @returns {THREE.ShaderMaterial} LED shader material
 */
export function createLEDShaderMaterial(textureMaterial, mappingType = null, isGarageMesh = false, meshPath = null) {
  // Determine if mask should be used:
  // - For mapping types B and D, only on garage meshes
  // - For renderOption1/renderOption1NoFront, ONLY on garage meshes from Garagefix mesh (not regular Projection)
  const isGaragefixMesh = meshPath && meshPath.includes('Garagefix');
  const useMask = isGarageMesh && (
    mappingType === 'farCamB' || 
    mappingType === 'farCamD' ||
    (isGaragefixMesh && (mappingType === 'renderOption1' || mappingType === 'renderOption1NoFront'))
  );
  
  // Create a default white texture if mask texture isn't loaded yet
  const defaultMaskTexture = maskTexture || new THREE.Texture();
  if (!maskTexture) {
    // Create a 1x1 white texture as placeholder
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 1, 1);
    defaultMaskTexture.image = canvas;
    defaultMaskTexture.needsUpdate = true;
  }
  
  return new THREE.ShaderMaterial({
    uniforms: {
      uTexture: { value: textureMaterial.uniforms.uTexture.value },
      uMaskTexture: { value: defaultMaskTexture },
      uHasTexture: { value: textureMaterial.uniforms.uHasTexture.value },
      uIsImageTexture: { value: textureMaterial.uniforms.uIsImageTexture.value },
      uTextureScale: { value: textureMaterial.uniforms.uTextureScale.value },
      uTextureOffsetU: { value: textureMaterial.uniforms.uTextureOffsetU.value },
      uTextureOffsetV: { value: textureMaterial.uniforms.uTextureOffsetV.value },
      uUseMask: { value: useMask ? 1.0 : 0.0 }
    },
    vertexShader: ledVertexShader,
    fragmentShader: ledFragmentShader,
    side: THREE.DoubleSide
  });
}

/**
 * Update LED shader textures when video texture changes
 * @param {THREE.Group} ledsGroup - Group containing LED meshes
 * @param {THREE.ShaderMaterial} textureMaterial - Reference texture material
 * @param {string} mappingType - Current mapping type (optional)
 */
export function updateLEDShaders(ledsGroup, textureMaterial, mappingType = null) {
  const videoTexture = textureMaterial.uniforms.uTexture.value;
  const hasTexture = textureMaterial.uniforms.uHasTexture.value;
  const isImageTexture = textureMaterial.uniforms.uIsImageTexture.value;
  const textureScale = textureMaterial.uniforms.uTextureScale.value;
  const textureOffsetU = textureMaterial.uniforms.uTextureOffsetU.value;
  const textureOffsetV = textureMaterial.uniforms.uTextureOffsetV.value;
  
  // Check if mapping type requires mask (B, D, or renderOption1/renderOption1NoFront with Garagefix)
  const mappingRequiresMask = mappingType === 'farCamB' || mappingType === 'farCamD' ||
                               mappingType === 'renderOption1' || mappingType === 'renderOption1NoFront';
  
  ledsGroup.traverse((child) => {
    if (child.isMesh && child.material && child.material.uniforms) {
      // Update the texture reference in LED shader
      child.material.uniforms.uTexture.value = videoTexture;
      child.material.uniforms.uHasTexture.value = hasTexture;
      child.material.uniforms.uIsImageTexture.value = isImageTexture;
      child.material.uniforms.uTextureScale.value = textureScale;
      child.material.uniforms.uTextureOffsetU.value = textureOffsetU;
      child.material.uniforms.uTextureOffsetV.value = textureOffsetV;
      
      // Update mask texture and use mask flag
      // Apply mask to garage meshes in mapping types B, D, or renderOption1/renderOption1NoFront with Garagefix
      if (child.material.uniforms.uMaskTexture) {
        child.material.uniforms.uMaskTexture.value = maskTexture || child.material.uniforms.uMaskTexture.value;
      }
      if (child.material.uniforms.uUseMask) {
        // Check if this mesh is a garage mesh by checking its parent path or mesh name
        let isGarageMesh = false;
        let isGaragefixMesh = false;
        let meshPath = null;
        
        // Check parent path (for separate garage mesh files or Garagefix mesh)
        if (child.parent && child.parent.userData && child.parent.userData.path) {
          meshPath = child.parent.userData.path;
          isGaragefixMesh = meshPath.includes('Garagefix');
          isGarageMesh = meshPath.includes('SL_GARAGE') || meshPath.includes('SR_GARAGE') ||
                         meshPath.includes('SL_Garage') || meshPath.includes('SR_Garage');
        }
        
        // Check mesh name (for FarCam files or Garagefix where garage meshes are inside the GLB)
        if (!isGarageMesh && child.name) {
          isGarageMesh = child.name.includes('SL_GARAGE') || child.name.includes('SR_GARAGE') ||
                         child.name.includes('SL_Garage') || child.name.includes('SR_Garage') ||
                         child.name.includes('GARAGE') || child.name.includes('Garage');
        }
        
        // Also check if parent is Garagefix mesh by traversing up
        if (!isGaragefixMesh) {
          let parent = child.parent;
          while (parent) {
            if (parent.userData && parent.userData.path && parent.userData.path.includes('Garagefix')) {
              isGaragefixMesh = true;
              meshPath = parent.userData.path;
              break;
            }
            parent = parent.parent;
          }
        }
        
        // Apply mask if:
        // - Mapping type is B or D and it's a garage mesh
        // - Mapping type is renderOption1/renderOption1NoFront and it's a garage mesh from Garagefix
        const useMask = isGarageMesh && (
          mappingType === 'farCamB' || mappingType === 'farCamD' ||
          (isGaragefixMesh && (mappingType === 'renderOption1' || mappingType === 'renderOption1NoFront'))
        );
        child.material.uniforms.uUseMask.value = useMask ? 1.0 : 0.0;
      }
      
      child.material.needsUpdate = true;
    }
  });
}

/**
 * Apply shader to all meshes in a group
 * @param {THREE.Group} group - Group to apply shader to
 * @param {THREE.ShaderMaterial} shaderMaterial - Shader material to apply
 */
export function applyShaderToGroup(group, shaderMaterial) {
  group.traverse((child) => {
    if (child.isMesh) {
      // Store original material if needed
      if (!child.userData.originalMaterial) {
        child.userData.originalMaterial = child.material;
      }
      child.material = shaderMaterial.clone();
    }
  });
}

/**
 * Update camera position in shader materials
 * @param {Object} shaderMaterials - Object containing shader materials
 * @param {Object} materialReferences - Object containing material references
 * @param {THREE.Camera} camera - Camera to get position from
 */
export function updateCameraPositionInShaders(shaderMaterials, materialReferences, camera) {
  // Update camera position in all shader materials
  Object.values(shaderMaterials).forEach(shaderMaterial => {
    if (shaderMaterial.uniforms && shaderMaterial.uniforms.uCameraPosition) {
      shaderMaterial.uniforms.uCameraPosition.value.copy(camera.position);
    }
  });
  
  // Update camera position in all cloned materials
  Object.values(materialReferences).forEach(materialArray => {
    materialArray.forEach(material => {
      if (material.uniforms && material.uniforms.uCameraPosition) {
        material.uniforms.uCameraPosition.value.copy(camera.position);
      }
    });
  });
}


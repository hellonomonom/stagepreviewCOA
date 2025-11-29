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

/**
 * Create LED shader material (uses video texture)
 * @param {THREE.ShaderMaterial} textureMaterial - Reference texture material
 * @returns {THREE.ShaderMaterial} LED shader material
 */
export function createLEDShaderMaterial(textureMaterial) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTexture: { value: textureMaterial.uniforms.uTexture.value },
      uHasTexture: { value: textureMaterial.uniforms.uHasTexture.value },
      uIsImageTexture: { value: textureMaterial.uniforms.uIsImageTexture.value },
      uTextureScale: { value: textureMaterial.uniforms.uTextureScale.value },
      uTextureOffsetU: { value: textureMaterial.uniforms.uTextureOffsetU.value },
      uTextureOffsetV: { value: textureMaterial.uniforms.uTextureOffsetV.value }
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
 */
export function updateLEDShaders(ledsGroup, textureMaterial) {
  const videoTexture = textureMaterial.uniforms.uTexture.value;
  const hasTexture = textureMaterial.uniforms.uHasTexture.value;
  const isImageTexture = textureMaterial.uniforms.uIsImageTexture.value;
  const textureScale = textureMaterial.uniforms.uTextureScale.value;
  const textureOffsetU = textureMaterial.uniforms.uTextureOffsetU.value;
  const textureOffsetV = textureMaterial.uniforms.uTextureOffsetV.value;
  
  ledsGroup.traverse((child) => {
    if (child.isMesh && child.material && child.material.uniforms) {
      // Update the texture reference in LED shader
      child.material.uniforms.uTexture.value = videoTexture;
      child.material.uniforms.uHasTexture.value = hasTexture;
      child.material.uniforms.uIsImageTexture.value = isImageTexture;
      child.material.uniforms.uTextureScale.value = textureScale;
      child.material.uniforms.uTextureOffsetU.value = textureOffsetU;
      child.material.uniforms.uTextureOffsetV.value = textureOffsetV;
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


/**
 * Shader material configurations
 * Defines base color, roughness, and specular values for each material type
 */

export const shaderConfigs = {
  base: {
    baseColor: [0.161, 0.161, 0.161],
    roughness: 0.000,
    specular: 0.013
  },
  artists: {
    baseColor: [0.733, 0.729, 0.749],
    roughness: 0.000,
    specular: 0.500
  },
  stage: {
    baseColor: [0.090, 0.090, 0.090],
    roughness: 0.700,
    specular: 0.200
  },
  pillars: {
    baseColor: [0.420, 0.420, 0.420],
    roughness: 1.000,
    specular: 0.211
  },
  floor: {
    baseColor: [0.102, 0.102, 0.102],
    roughness: 0.900,
    specular: 0.000
  },
  roof: {
    baseColor: [0.129, 0.129, 0.129],
    roughness: 0.700,
    specular: 0.200
  },
  crowd: {
    baseColor: [0.059, 0.059, 0.059],
    roughness: 0.081,
    specular: 0.000
  },
  marble: {
    baseColor: [0.271, 0.271, 0.271],
    roughness: 0.000,
    specular: 0.500
  },
  cables: {
    baseColor: [0.502, 0.129, 0.039],
    roughness: 0.500,
    specular: 0.200
  }
};


/**
 * LED Shader
 * Used for LED meshes with inverted V coordinate for texture mapping
 */

export const ledVertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;
  
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const ledFragmentShader = `
  uniform sampler2D uTexture;
  uniform float uHasTexture;
  uniform float uIsImageTexture;
  varying vec2 vUv;
  varying vec3 vNormal;
  
  void main() {
    // Check if this is the back face
    if (!gl_FrontFacing) {
      // Backside is black
      gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    } else {
      // Front side shows texture or white
      if (uHasTexture > 0.5) {
        // Invert V coordinate
        vec2 invertedUv = vec2(vUv.x, 1.0 - vUv.y);
        vec4 texColor = texture2D(uTexture, invertedUv);
        // Use texture directly for both images and videos
        gl_FragColor = vec4(texColor.rgb, texColor.a);
      } else {
        gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
      }
    }
  }
`;


/**
 * Texture Shader
 * Used for texture management, referenced by LED shaders
 */

export const textureVertexShader = `
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

export const textureFragmentShader = `
  uniform sampler2D uTexture;
  uniform float uHasTexture;
  uniform float uIsImageTexture;
  uniform float uTextureScale;
  uniform float uTextureOffsetU;
  uniform float uTextureOffsetV;
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
        // Apply offset FIRST (U offset is inverted), THEN scale from center (0.5, 0.5)
        // This makes offsets behave consistently even when uTextureScale != 1.0
        vec2 offsetUv = vUv + vec2(-uTextureOffsetU, uTextureOffsetV);
        vec2 scaledUv = (offsetUv - 0.5) / uTextureScale + 0.5;
        // Check if UVs are outside bounds - show black if outside
        if (scaledUv.x < 0.0 || scaledUv.x > 1.0 || scaledUv.y < 0.0 || scaledUv.y > 1.0) {
          gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        } else {
          vec4 texColor = texture2D(uTexture, scaledUv);
          // Use texture directly for both images and videos
          gl_FragColor = vec4(texColor.rgb, texColor.a);
        }
      } else {
        gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
      }
    }
  }
`;


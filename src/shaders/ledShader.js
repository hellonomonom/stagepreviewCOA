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
  uniform sampler2D uMaskTexture;
  uniform float uHasTexture;
  uniform float uIsImageTexture;
  uniform float uTextureScale;
  uniform float uTextureOffsetU;
  uniform float uTextureOffsetV;
  uniform float uUseMask;
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
          // Then invert V coordinate
          vec2 invertedUv = vec2(scaledUv.x, 1.0 - scaledUv.y);
          vec4 texColor = texture2D(uTexture, invertedUv);
          
          // Apply mask if enabled (for mapping types B and D)
          // Mask uses unscaled UV coordinates (only V is inverted)
          if (uUseMask > 0.5) {
            vec2 maskUv = vec2(vUv.x, 1.0 - vUv.y);
            vec4 maskColor = texture2D(uMaskTexture, maskUv);
            // Multiply texture with mask (using mask RGB and alpha)
            texColor.rgb *= maskColor.rgb;
            texColor.a *= maskColor.a;
          }
          
          // Use texture directly for both images and videos
          gl_FragColor = vec4(texColor.rgb, texColor.a);
        }
      } else {
        gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
      }
    }
  }
`;


/**
 * PBR (Physically Based Rendering) Shader
 * Used for stage meshes with lighting calculations
 */

export const pbrVertexShader = `
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUv;
  varying vec3 vWorldPosition;
  
  void main() {
    vUv = uv;
    vPosition = position;

    // Instancing support (THREE.InstancedMesh):
    // - Apply instanceMatrix to position
    // - Apply instanceMatrix to normal (approx; matches Three.js default pattern)
    #ifdef USE_INSTANCING
      vNormal = normalize(normalMatrix * mat3(instanceMatrix) * normal);
      vec4 worldPos = modelMatrix * instanceMatrix * vec4(position, 1.0);
      vWorldPosition = worldPos.xyz;
      gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    #else
      vNormal = normalize(normalMatrix * normal);
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPos.xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    #endif
  }
`;

export const pbrFragmentShader = `
  uniform vec3 uBaseColor;
  uniform float uRoughness;
  uniform float uSpecular;
  uniform vec3 uCameraPosition;
  
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUv;
  varying vec3 vWorldPosition;
  
  void main() {
    vec3 normal = normalize(vNormal);
    
    // Calculate view direction from world position to camera
    vec3 viewDir = normalize(uCameraPosition - vWorldPosition);
    
    // Simple lighting calculation
    vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
    float NdotL = max(dot(normal, lightDir), 0.0);
    
    // Ambient light
    vec3 ambient = uBaseColor * 0.3;
    
    // Diffuse lighting
    vec3 diffuse = uBaseColor * NdotL * 0.7;
    
    // Specular highlight
    vec3 halfDir = normalize(lightDir + viewDir);
    float NdotH = max(dot(normal, halfDir), 0.0);
    float specPower = mix(1.0, 256.0, 1.0 - uRoughness);
    vec3 specular = vec3(pow(NdotH, specPower)) * uSpecular;
    
    // Combine
    vec3 finalColor = ambient + diffuse + specular;
    
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;














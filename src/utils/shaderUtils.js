/**
 * Shader utility functions
 * Helper functions for shader-related operations
 */

/**
 * Determine which shader type to use based on filename
 * @param {string} path - File path
 * @returns {string} Shader type name
 */
export function getShaderType(path) {
  const lowerPath = path.toLowerCase();
  
  // Artists shader - check first to ensure artist meshes get correct shader
  if (lowerPath.includes('artists')) {
    return 'artists';
  }
  
  // Crowd shader - check for crowd folder/meshes (before general crowd check)
  if (lowerPath.includes('crowd/') || (lowerPath.includes('crowd') && lowerPath.includes('.glb') && !lowerPath.includes('stage_crowd'))) {
    return 'crowd';
  }
  
  // Stage shader: LIFTABLE (including DJ_LIFTABLE), CROWD - check before stage_dj
  if (lowerPath.includes('liftable') || lowerPath.includes('crowd')) {
    return 'stage';
  }
  
  // Base shader: CATWALK, STAGE_GROUND
  if (lowerPath.includes('catwalk') || lowerPath.includes('stage_ground')) {
    return 'base';
  }
  
  // Pillars shader (includes Columns)
  if (lowerPath.includes('pillars') || lowerPath.includes('columns')) {
    return 'pillars';
  }
  
  // Floor shader
  if (lowerPath.includes('floor')) {
    return 'floor';
  }
  
  // Roof shader
  if (lowerPath.includes('roof')) {
    return 'roof';
  }
  
  // Default to stage shader for other stage meshes
  return 'stage';
}














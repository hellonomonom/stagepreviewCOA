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
  
  // Base shader: CATWALK, STAGE_GROUND, STAGE_DJ (but not LIFTABLE)
  if (lowerPath.includes('catwalk') || lowerPath.includes('stage_ground') || lowerPath.includes('stage_dj')) {
    return 'base';
  }
  
  // Pillars shader
  if (lowerPath.includes('pillars')) {
    return 'pillars';
  }
  
  // Floor shader
  if (lowerPath.includes('floor')) {
    return 'floor';
  }
  
  // Default to stage shader for other stage meshes
  return 'stage';
}






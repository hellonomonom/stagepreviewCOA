/**
 * Mesh file paths configuration
 * Organized by category and mapping type
 */

export const ledMeshFiles = {
  festival: [
    '/assets/meshes/FestivalMapping/ANYMA_Coachella_Stage_v007_LED_FRONT.glb',
    '/assets/meshes/FestivalMapping/ANYMA_Coachella_Stage_v007_LED_SL_GARAGE.glb',
    '/assets/meshes/FestivalMapping/ANYMA_Coachella_Stage_v008_LED_SL_WING.glb',
    '/assets/meshes/FestivalMapping/ANYMA_Coachella_Stage_v008_LED_SR_GARAGE.glb',
    '/assets/meshes/FestivalMapping/ANYMA_Coachella_Stage_v008_LED_SR_WING.glb',
    '/assets/meshes/FestivalMapping/ANYMA_Coachella_Stage_v008_LED_US_WALL.glb'
  ],
  frontProjection: [
    '/assets/meshes/FrontProjection_ortho/ANYMA_Coachella_Stage_v013_LED_FRONT_ortho.glb',
    '/assets/meshes/FrontProjection_ortho/ANYMA_Coachella_Stage_v010_LED_SL_GARAGE_FrontP.glb',
    '/assets/meshes/FrontProjection_ortho/ANYMA_Coachella_Stage_v010_LED_SL_WING_FrontP.glb',
    '/assets/meshes/FrontProjection_ortho/ANYMA_Coachella_Stage_v010_LED_SR_GARAGE_FrontP.glb',
    '/assets/meshes/FrontProjection_ortho/ANYMA_Coachella_Stage_v010_LED_SR_WING_FrontP.glb',
    '/assets/meshes/FrontProjection_ortho/ANYMA_Coachella_Stage_v010_LED_US_WALL_FrontP.glb'
  ],
  frontProjectionPerspective: [
    '/assets/meshes/FrontProjection_perspective/ANYMA_Coachella_Stage_v017_LED_FRONT_Perspective.glb',
    '/assets/meshes/FrontProjection_perspective/ANYMA_Coachella_Stage_v017_LED_SL_GARAGE.glb',
    '/assets/meshes/FrontProjection_perspective/ANYMA_Coachella_Stage_v017_LED_SL_WING.glb',
    '/assets/meshes/FrontProjection_perspective/ANYMA_Coachella_Stage_v017_LED_SR_GARAGE.glb',
    '/assets/meshes/FrontProjection_perspective/ANYMA_Coachella_Stage_v017_LED_SR_WING.glb',
    '/assets/meshes/FrontProjection_perspective/ANYMA_Coachella_Stage_v017_LED_US_WALL.glb'
  ],
  farCamA: [
    '/assets/meshes/FarCam/ANYMA_Coachella_Stage_v023_A.glb'
  ],
  farCamB: [
    '/assets/meshes/FarCam/ANYMA_Coachella_Stage_v023_B.glb'
  ],
  farCamC: [
    '/assets/meshes/FarCam/ANYMA_Coachella_Stage_v023_C.glb'
  ],
  farCamD: [
    '/assets/meshes/FarCam/ANYMA_Coachella_Stage_v023_D.glb'
  ],
  farCamE: [
    '/assets/meshes/FarCam/ANYMA_Coachella_Stage_v023_E.glb'
  ],
  renderOption1: [
    '/assets/meshes/Release/Stage_static/ANYMA_Coachella_StageDec_v009_Option1_Projection_Garagefix.glb'
  ],
  renderOption1NoFront: [
    '/assets/meshes/Release/Stage_static/ANYMA_Coachella_StageDec_v009_Option1_Projection_Garagefix.glb'
  ],
  renderOption2NoFront: [
    '/assets/meshes/Release/Stage_static/ANYMA_Coachella_StageDec_v009_Option2_noFront.glb'
  ],
  renderOption2WithFront: [
    '/assets/meshes/Release/Stage_static/ANYMA_Coachella_StageDec_v009_Option2_wFront.glb'
  ]
};

export const stageMeshFiles = [
  '/assets/meshes/Release/Stage_static/ANYMA_Coachella_StageDec_v009_Columns.glb',
  // DJ_LIFTABLE removed - now using DJ Low/High toggle meshes
  '/public/assets/meshes/Release/Stage_static/ANYMA_Coachella_StageDec_v009_Stage_Platform.glb',
  '/public/assets/meshes/Release/Stage_static/ANYMA_Coachella_StageDec_v009_Roof.glb',
  '/public/assets/meshes/Release/Stage_static/ANYMA_Coachella_StageDec_v009_CrowdFloor_SpawnArea.glb'
];

export const djMeshFiles = {
  low: '/assets/meshes/Release/Stage_static/ANYMA_Coachella_StageDec_v009_DJDeck_Down.glb',
  high: '/assets/meshes/Release/Stage_static/ANYMA_Coachella_StageDec_v009_DJDeck_Elevated.glb'
};

export const crowdMeshPaths = [
  '/assets/meshes/Crowd/crowd_v001_female1.glb',
  '/assets/meshes/Crowd/crowd_v001_female2.glb',
  '/assets/meshes/Crowd/crowd_v001_female3.glb',
  '/assets/meshes/Crowd/crowd_v001_male1.glb',
  '/assets/meshes/Crowd/crowd_v001_male2.glb'
];

// Default mapping type
export const DEFAULT_MAPPING_TYPE = 'renderOption1';

/**
 * Get LED mesh files for a mapping type, with optional Garagefix toggle
 * @param {string} mappingType - Mapping type
 * @param {boolean} useGaragefix - Whether to use Garagefix version (for renderOption1/renderOption1NoFront)
 * @returns {Array} Array of mesh file paths
 */
export function getLEDMeshFiles(mappingType, useGaragefix = true) {
  if (mappingType === 'renderOption1' || mappingType === 'renderOption1NoFront') {
    if (useGaragefix) {
      return ['/assets/meshes/Release/Stage_static/ANYMA_Coachella_StageDec_v009_Option1_Projection_Garagefix.glb'];
    } else {
      return ['/assets/meshes/Release/Stage_static/ANYMA_Coachella_StageDec_v009_Option1_Projection.glb'];
    }
  }
  return ledMeshFiles[mappingType] || [];
}

// Corrected wing mesh paths for front projection types
export const correctedWingMeshes = {
  frontProjection: {
    sl: '/assets/meshes/WINGS_CORR/ANYMA_Coachella_Stage_v015_SL_WING_CORR_ORTHO.glb',
    sr: '/assets/meshes/WINGS_CORR/ANYMA_Coachella_Stage_v015_SR_WING_CORR_ORTHO.glb'
  },
  frontProjectionPerspective: {
    sl: '/assets/meshes/WINGS_CORR/ANYMA_Coachella_Stage_v015_SL_WING_CORR_PERSP.glb',
    sr: '/assets/meshes/WINGS_CORR/ANYMA_Coachella_Stage_v015_SR_WING_CORR_PERSP.glb'
  }
};















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
  ]
};

export const stageMeshFiles = [
  '/assets/meshes/ANYMA_Coachella_Stage_v008_CATWALK.glb',
  '/assets/meshes/ANYMA_Coachella_Stage_v008_PILLARS.glb',
  '/assets/meshes/ANYMA_Coachella_Stage_v008_STAGE_CROWD.glb',
  '/assets/meshes/ANYMA_Coachella_Stage_v008_STAGE_DJ_LIFTABLE.glb',
  '/assets/meshes/ANYMA_Coachella_Stage_v008_STAGE_GROUND.glb',
  '/assets/meshes/ANYMA_Coachella_Stage_v010_STAGE_ARTISTS.glb',
  '/assets/meshes/ANYMA_Coachella_Stage_v010_FLOOR.glb'
];

export const crowdMeshPaths = [
  '/assets/meshes/Crowd/crowd_v001_female1.glb',
  '/assets/meshes/Crowd/crowd_v001_female2.glb',
  '/assets/meshes/Crowd/crowd_v001_female3.glb',
  '/assets/meshes/Crowd/crowd_v001_male1.glb',
  '/assets/meshes/Crowd/crowd_v001_male2.glb'
];

// Default mapping type
export const DEFAULT_MAPPING_TYPE = 'frontProjectionPerspective';

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


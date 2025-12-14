# Meshes Currently in Use (NOT in assets/Release)

This document lists all meshes that are currently referenced in the codebase but are NOT located in the `assets/Release` directory.

## Stage Meshes (Always Loaded)

1. `/assets/meshes/ANYMA_Coachella_Stage_v008_STAGE_GROUND.glb`
2. `/assets/meshes/ANYMA_Coachella_Stage_v010_FLOOR.glb`

## LED Meshes by Mapping Type

### Festival Mapping (festival) - 6 meshes
3. `/assets/meshes/FestivalMapping/ANYMA_Coachella_Stage_v007_LED_FRONT.glb`
4. `/assets/meshes/FestivalMapping/ANYMA_Coachella_Stage_v007_LED_SL_GARAGE.glb`
5. `/assets/meshes/FestivalMapping/ANYMA_Coachella_Stage_v008_LED_SL_WING.glb`
6. `/assets/meshes/FestivalMapping/ANYMA_Coachella_Stage_v008_LED_SR_GARAGE.glb`
7. `/assets/meshes/FestivalMapping/ANYMA_Coachella_Stage_v008_LED_SR_WING.glb`
8. `/assets/meshes/FestivalMapping/ANYMA_Coachella_Stage_v008_LED_US_WALL.glb`

### Front Projection Orthographic (frontProjection) - 6 meshes
9. `/assets/meshes/FrontProjection_ortho/ANYMA_Coachella_Stage_v013_LED_FRONT_ortho.glb`
10. `/assets/meshes/FrontProjection_ortho/ANYMA_Coachella_Stage_v010_LED_SL_GARAGE_FrontP.glb`
11. `/assets/meshes/FrontProjection_ortho/ANYMA_Coachella_Stage_v010_LED_SL_WING_FrontP.glb`
12. `/assets/meshes/FrontProjection_ortho/ANYMA_Coachella_Stage_v010_LED_SR_GARAGE_FrontP.glb`
13. `/assets/meshes/FrontProjection_ortho/ANYMA_Coachella_Stage_v010_LED_SR_WING_FrontP.glb`
14. `/assets/meshes/FrontProjection_ortho/ANYMA_Coachella_Stage_v010_LED_US_WALL_FrontP.glb`

### Front Projection Perspective (frontProjectionPerspective) - 6 meshes
15. `/assets/meshes/FrontProjection_perspective/ANYMA_Coachella_Stage_v017_LED_FRONT_Perspective.glb`
16. `/assets/meshes/FrontProjection_perspective/ANYMA_Coachella_Stage_v017_LED_SL_GARAGE.glb`
17. `/assets/meshes/FrontProjection_perspective/ANYMA_Coachella_Stage_v017_LED_SL_WING.glb`
18. `/assets/meshes/FrontProjection_perspective/ANYMA_Coachella_Stage_v017_LED_SR_GARAGE.glb`
19. `/assets/meshes/FrontProjection_perspective/ANYMA_Coachella_Stage_v017_LED_SR_WING.glb`
20. `/assets/meshes/FrontProjection_perspective/ANYMA_Coachella_Stage_v017_LED_US_WALL.glb`

### FarCam Types (farCamA-E) - 5 meshes
21. `/assets/meshes/FarCam/ANYMA_Coachella_Stage_v023_A.glb`
22. `/assets/meshes/FarCam/ANYMA_Coachella_Stage_v023_B.glb`
23. `/assets/meshes/FarCam/ANYMA_Coachella_Stage_v023_C.glb`
24. `/assets/meshes/FarCam/ANYMA_Coachella_Stage_v023_D.glb`
25. `/assets/meshes/FarCam/ANYMA_Coachella_Stage_v023_E.glb`

## Crowd Meshes - 5 meshes
26. `/assets/meshes/Crowd/crowd_v001_female1.glb`
27. `/assets/meshes/Crowd/crowd_v001_female2.glb`
28. `/assets/meshes/Crowd/crowd_v001_female3.glb`
29. `/assets/meshes/Crowd/crowd_v001_male1.glb`
30. `/assets/meshes/Crowd/crowd_v001_male2.glb`

## Corrected Wing Meshes (Optional) - 4 meshes
31. `/assets/meshes/WINGS_CORR/ANYMA_Coachella_Stage_v015_SL_WING_CORR_ORTHO.glb`
32. `/assets/meshes/WINGS_CORR/ANYMA_Coachella_Stage_v015_SR_WING_CORR_ORTHO.glb`
33. `/assets/meshes/WINGS_CORR/ANYMA_Coachella_Stage_v015_SL_WING_CORR_PERSP.glb`
34. `/assets/meshes/WINGS_CORR/ANYMA_Coachella_Stage_v015_SR_WING_CORR_PERSP.glb`

---

## Summary

**Total: 34 meshes** currently in use that are NOT in the `assets/Release` directory.

### Breakdown by Category:
- **Stage Meshes:** 2 meshes
- **LED Meshes (Festival):** 6 meshes
- **LED Meshes (Front Projection Ortho):** 6 meshes
- **LED Meshes (Front Projection Perspective):** 6 meshes
- **LED Meshes (FarCam A-E):** 5 meshes
- **Crowd Meshes:** 5 meshes
- **Corrected Wing Meshes:** 4 meshes

### Note:
The default mapping type is `renderOption1`, which uses meshes from `assets/Release/Stage_static/`. The other mapping types (festival, frontProjection, frontProjectionPerspective, farCamA-E) are still available in the code but may not be actively used if the default mapping type is always selected.

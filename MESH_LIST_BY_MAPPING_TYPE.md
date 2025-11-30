# Meshes Loaded/Visible by Mapping Type

## Stage Meshes (Always Loaded - Same for All Mapping Types)
These meshes are loaded regardless of mapping type:
- CATWALK
- PILLARS
- STAGE_CROWD
- STAGE_DJ_LIFTABLE
- STAGE_GROUND
- STAGE_ARTISTS
- FLOOR

---

## LED Meshes by Mapping Type

### A - Far/Flaps/Bow/GarageFix (5:1) - `farCamA`
**GLB File:**
- `/assets/meshes/FarCam/ANYMA_Coachella_Stage_v023_A.glb`

**Contains (multiple meshes in single GLB):**
- Far mesh
- Flaps mesh(es)
- Bow mesh(es)
- Garage meshes (SL_Garage, SR_Garage)
- LED_FRONT_* meshes (can be hidden via checkbox)

**Note:** All meshes are in a single GLB file. LED_FRONT_* meshes can be hidden using the "Hide LED Front" checkbox.

---

### B - Far/Flaps/Bow/Mask (5:1) - `farCamB`
**GLB File:**
- `/assets/meshes/FarCam/ANYMA_Coachella_Stage_v023_B.glb`

**Contains (multiple meshes in single GLB):**
- Far mesh
- Flaps mesh(es)
- Bow mesh(es)
- Garage meshes (SL_Garage, SR_Garage) - **Mask applied**
- LED_FRONT_* meshes (can be hidden via checkbox)

**Special:** Mask texture (`OverlapMask_3600x720.png`) is applied to SL_Garage and SR_Garage meshes only.

---

### C - Far/Flaps/Bow/GarageFix/ShiftY (5:1) - `farCamC`
**GLB File:**
- `/assets/meshes/FarCam/ANYMA_Coachella_Stage_v023_C.glb`

**Contains (multiple meshes in single GLB):**
- Far mesh
- Flaps mesh(es)
- Bow mesh(es)
- Garage meshes (SL_Garage, SR_Garage)
- LED_FRONT_* meshes (can be hidden via checkbox)

---

### D - Far/Flaps/Bow/ShiftY/Mask (5:1) - `farCamD`
**GLB File:**
- `/assets/meshes/FarCam/ANYMA_Coachella_Stage_v023_D.glb`

**Contains (multiple meshes in single GLB):**
- Far mesh
- Flaps mesh(es)
- Bow mesh(es)
- Garage meshes (SL_Garage, SR_Garage) - **Mask applied**
- LED_FRONT_* meshes (can be hidden via checkbox)

**Special:** Mask texture (`OverlapMask_3600x720.png`) is applied to SL_Garage and SR_Garage meshes only.

---

### E - Flaps/Bow/GarageFix/ShiftY/Scale (5:1) - `farCamE`
**GLB File:**
- `/assets/meshes/FarCam/ANYMA_Coachella_Stage_v023_E.glb`

**Contains (multiple meshes in single GLB):**
- Flaps mesh(es)
- Bow mesh(es)
- Garage meshes (SL_Garage, SR_Garage)
- LED_FRONT_* meshes (can be hidden via checkbox)

**Note:** No Far mesh in this mapping type.

---

### Front Projection Perspective (5.1:1) (old) - `frontProjectionPerspective`
**GLB Files:**
- `/assets/meshes/FrontProjection_perspective/ANYMA_Coachella_Stage_v017_LED_FRONT_Perspective.glb` (LED_FRONT)
- `/assets/meshes/FrontProjection_perspective/ANYMA_Coachella_Stage_v017_LED_SL_GARAGE.glb` (SL_Garage)
- `/assets/meshes/FrontProjection_perspective/ANYMA_Coachella_Stage_v017_LED_SL_WING.glb` (SL_Wing)
- `/assets/meshes/FrontProjection_perspective/ANYMA_Coachella_Stage_v017_LED_SR_GARAGE.glb` (SR_Garage)
- `/assets/meshes/FrontProjection_perspective/ANYMA_Coachella_Stage_v017_LED_SR_WING.glb` (SR_Wing)
- `/assets/meshes/FrontProjection_perspective/ANYMA_Coachella_Stage_v017_LED_US_WALL.glb` (US_Wall)

**Optional (if "Use corrected mesh" is checked):**
- `/assets/meshes/WINGS_CORR/ANYMA_Coachella_Stage_v015_SL_WING_CORR_PERSP.glb` (replaces SL_Wing)
- `/assets/meshes/WINGS_CORR/ANYMA_Coachella_Stage_v015_SR_WING_CORR_PERSP.glb` (replaces SR_Wing)

**Visibility:** LED_FRONT is visible by default (can be hidden via checkbox).

---

### Front Projection Orthographic (5.1:1) (old) - `frontProjection`
**GLB Files:**
- `/assets/meshes/FrontProjection_ortho/ANYMA_Coachella_Stage_v013_LED_FRONT_ortho.glb` (LED_FRONT)
- `/assets/meshes/FrontProjection_ortho/ANYMA_Coachella_Stage_v010_LED_SL_GARAGE_FrontP.glb` (SL_Garage)
- `/assets/meshes/FrontProjection_ortho/ANYMA_Coachella_Stage_v010_LED_SL_WING_FrontP.glb` (SL_Wing)
- `/assets/meshes/FrontProjection_ortho/ANYMA_Coachella_Stage_v010_LED_SR_GARAGE_FrontP.glb` (SR_Garage)
- `/assets/meshes/FrontProjection_ortho/ANYMA_Coachella_Stage_v010_LED_SR_WING_FrontP.glb` (SR_Wing)
- `/assets/meshes/FrontProjection_ortho/ANYMA_Coachella_Stage_v010_LED_US_WALL_FrontP.glb` (US_Wall)

**Optional (if "Use corrected mesh" is checked):**
- `/assets/meshes/WINGS_CORR/ANYMA_Coachella_Stage_v015_SL_WING_CORR_ORTHO.glb` (replaces SL_Wing)
- `/assets/meshes/WINGS_CORR/ANYMA_Coachella_Stage_v015_SR_WING_CORR_ORTHO.glb` (replaces SR_Wing)

**Visibility:** LED_FRONT is visible by default (can be hidden via checkbox).

---

### Festival Mapping (7.4:1) (old) - `festival`
**GLB Files:**
- `/assets/meshes/FestivalMapping/ANYMA_Coachella_Stage_v007_LED_FRONT.glb` (LED_FRONT)
- `/assets/meshes/FestivalMapping/ANYMA_Coachella_Stage_v007_LED_SL_GARAGE.glb` (SL_Garage)
- `/assets/meshes/FestivalMapping/ANYMA_Coachella_Stage_v008_LED_SL_WING.glb` (SL_Wing)
- `/assets/meshes/FestivalMapping/ANYMA_Coachella_Stage_v008_LED_SR_GARAGE.glb` (SR_Garage)
- `/assets/meshes/FestivalMapping/ANYMA_Coachella_Stage_v008_LED_SR_WING.glb` (SR_Wing)
- `/assets/meshes/FestivalMapping/ANYMA_Coachella_Stage_v008_LED_US_WALL.glb` (US_Wall)

**Visibility:** LED_FRONT is hidden by default (checkbox auto-checked, can be shown by unchecking).

---

## Notes

1. **FarCam Types (A-E):** Each loads a single GLB file containing multiple meshes. The exact mesh names inside these GLB files are determined by the 3D model structure.

2. **LED_FRONT Visibility:**
   - **Festival Mapping:** Hidden by default
   - **All other types:** Visible by default
   - Can be toggled via "Hide LED Front" checkbox for all types

3. **Mask Application:**
   - Only applied to **SL_Garage** and **SR_Garage** meshes
   - Only for mapping types **B** (`farCamB`) and **D** (`farCamD`)
   - Uses mask texture: `/assets/textures/OverlapMask_3600x720.png`

4. **Corrected Wings:**
   - Only available for `frontProjection` and `frontProjectionPerspective`
   - Controlled by "Use corrected mesh" checkbox
   - Replaces the standard wing meshes when enabled

5. **Garage Black Material:**
   - Can be applied to garage meshes via "Turn Garages Black" checkbox
   - Works for all mapping types


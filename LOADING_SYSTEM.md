# Loading System Documentation

## Overview

The application now uses a robust loading and initialization system to ensure all elements and controls are initialized properly. This eliminates race conditions and ensures proper dependency management.

## Components

### LoadingManager (`src/core/LoadingManager.js`)

Tracks loading states and dependencies for all async operations.

**Key Features:**
- Register loading states with dependencies
- Wait for states to be loaded before proceeding
- Track errors and loading status
- Notify listeners when states change

**Usage:**
```javascript
// Register a loading state
loadingManager.register('dom', []);
loadingManager.register('floorMesh', ['stageMeshes']);

// Mark as loading
loadingManager.setLoading('floorMesh');

// Mark as loaded
loadingManager.setLoaded('floorMesh');

// Wait for a state
await loadingManager.waitFor('floorMesh', 30000);

// Wait for multiple states
await loadingManager.waitForAll(['dom', 'floorMesh'], 30000);
```

### InitializationManager (`src/core/InitializationManager.js`)

Handles proper initialization order and ensures dependencies are ready.

**Key Features:**
- Register initialization steps with dependencies
- Automatic dependency resolution
- Parallel initialization when possible
- Error handling and timeout management

**Usage:**
```javascript
// Register an initialization step
initManager.register(
  'playbackControls',           // Step name
  async () => {                  // Initialization function
    // Initialize playback controls
  },
  ['mediaManager'],              // Depends on these init steps
  ['ui', 'dom']                  // Depends on these loading states
);

// Initialize all steps
await initManager.initializeAll();
```

## Initialization Order

The system ensures proper initialization order:

1. **DOM** - DOM must be ready first
2. **UI** - UI elements are initialized after DOM
3. **Mask Texture** - Loaded in parallel with other assets
4. **LED Meshes** - Loaded asynchronously
5. **Stage Meshes** - Loaded asynchronously
6. **Floor Mesh** - Depends on stage meshes
7. **Crowd Meshes** - Depends on floor mesh
8. **Media Manager** - Depends on UI
9. **Playback Controls** - Depends on Media Manager and UI
10. **Camera Controls** - Depends on UI
11. **VR Manager** - Depends on UI
12. **Shader Controls** - Depends on meshes being loaded
13. **Load Default Video** - Depends on playback controls and media manager

## Improvements

### Before
- Multiple `setTimeout` calls with arbitrary delays
- Race conditions between initialization steps
- No way to track what's loaded
- Components initialized in various places without coordination
- DOM elements accessed before ready

### After
- Centralized loading state management
- Proper dependency tracking
- Async/await patterns instead of setTimeout
- Guaranteed initialization order
- Error handling and timeouts
- Better debugging with status tracking

## Loading States

The following loading states are registered:

- `dom` - DOM is ready
- `maskTexture` - Mask texture loaded
- `ledMeshes` - LED meshes loaded
- `stageMeshes` - Stage meshes loaded
- `floorMesh` - Floor mesh loaded (depends on stageMeshes)
- `crowdMeshes` - Crowd meshes spawned (depends on floorMesh)
- `ui` - UI elements initialized (depends on dom)
- `playbackControls` - Playback controls initialized (depends on ui, mediaManager)
- `mediaManager` - Media manager initialized (depends on ui)
- `cameraControls` - Camera controls initialized (depends on ui)
- `vrManager` - VR manager initialized (depends on ui)
- `shaderControls` - Shader controls initialized (depends on stageMeshes, ledMeshes)

## Future Improvements

1. **MeshLoader Promises**: Convert MeshLoader to return promises instead of using callbacks, eliminating the need for setTimeout workarounds.

2. **Progress Tracking**: Add progress tracking for mesh loading to show loading progress to users.

3. **Retry Logic**: Add automatic retry logic for failed loading operations.

4. **Loading UI**: Add a loading screen that shows initialization progress.

## Debugging

To check loading status:

```javascript
// Get loading status
const status = loadingManager.getStatus();
console.log(status);
// { total: 12, loaded: 8, loading: 2, errors: 0, pending: 2 }

// Get initialization status
const initStatus = initManager.getStatus();
console.log(initStatus);
// { total: 10, initialized: 8, pending: 2, order: [...] }
```

## Notes

- Some `setTimeout` calls remain for legitimate retry mechanisms (e.g., VR button creation, LED visibility retries)
- Mesh loading still uses setTimeout temporarily until MeshLoader is refactored to return promises
- All critical initialization steps now use the loading system


/**
 * Centralized loading state registration.
 * Keeps state keys consistent and avoids scattering register() calls.
 */

/**
 * @param {import('../core/LoadingManager.js').LoadingManager} loadingManager
 */
export function registerLoadingStates(loadingManager) {
  loadingManager.register('dom', []);
  loadingManager.register('maskTexture', []);
  loadingManager.register('ledMeshes', []);
  loadingManager.register('stageMeshes', []);
  loadingManager.register('floorMesh', ['stageMeshes']);
  loadingManager.register('crowdMeshes', ['floorMesh']);
  loadingManager.register('ui', ['dom']);
  loadingManager.register('playbackControls', ['ui', 'dom']);
  loadingManager.register('mediaManager', ['playbackControls']);
  loadingManager.register('cameraControls', ['ui', 'dom']);
  loadingManager.register('vrManager', ['ui', 'dom']);
  loadingManager.register('shaderControls', ['stageMeshes', 'ledMeshes']);
}





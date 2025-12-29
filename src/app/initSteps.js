/**
 * Centralized initialization step registration.
 * Keeps boot order declarative and out of the main entry file.
 */

/**
 * @typedef {Object} InitStep
 * @property {string} name
 * @property {Function} initFn
 * @property {string[]} [dependsOn]
 * @property {string[]} [loadingStates]
 */

/**
 * Register init steps on an InitializationManager.
 * @param {Object} params
 * @param {import('../core/InitializationManager.js').InitializationManager} params.initManager
 * @param {InitStep[]} params.steps
 */
export function registerInitSteps({ initManager, steps }) {
  for (const step of steps) {
    initManager.register(
      step.name,
      step.initFn,
      step.dependsOn ?? [],
      step.loadingStates ?? []
    );
  }
}



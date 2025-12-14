/**
 * Initialization Manager
 * Handles proper initialization order and ensures dependencies are ready
 */

export class InitializationManager {
  constructor(loadingManager) {
    this.loadingManager = loadingManager;
    this.initializationQueue = [];
    this.initialized = new Set();
    this.initializationOrder = [];
  }

  /**
   * Register an initialization step
   * @param {string} name - Unique name for this initialization step
   * @param {Function} initFn - Initialization function (can be async)
   * @param {Array<string>} dependsOn - Array of initialization step names this depends on
   * @param {Array<string>} loadingStates - Array of loading state keys that must be loaded before this step
   */
  register(name, initFn, dependsOn = [], loadingStates = []) {
    this.initializationQueue.push({
      name,
      initFn,
      dependsOn,
      loadingStates,
      initialized: false
    });
  }

  /**
   * Check if all dependencies are initialized
   * @param {Object} step - Initialization step
   * @returns {boolean} True if all dependencies are ready
   */
  async areDependenciesReady(step) {
    // Check initialization dependencies
    for (const dep of step.dependsOn) {
      if (!this.initialized.has(dep)) {
        return false;
      }
    }

    // Check loading state dependencies
    if (step.loadingStates.length > 0) {
      try {
        await this.loadingManager.waitForAll(step.loadingStates, 30000);
      } catch (error) {
        console.error(`InitializationManager: Loading states not ready for '${step.name}':`, error);
        return false;
      }
    }

    return true;
  }

  /**
   * Initialize a single step
   * @param {Object} step - Initialization step
   */
  async initializeStep(step) {
    if (step.initialized) {
      return;
    }

    // Wait for dependencies
    const maxRetries = 60; // 60 seconds max wait
    let retries = 0;
    while (!(await this.areDependenciesReady(step)) && retries < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      retries++;
    }

    if (retries >= maxRetries) {
      const missingDeps = step.dependsOn.filter(dep => !this.initialized.has(dep));
      const missingStates = step.loadingStates.filter(state => !this.loadingManager.isLoaded(state));
      throw new Error(
        `InitializationManager: Timeout waiting for dependencies for '${step.name}'. ` +
        `Missing init steps: ${missingDeps.join(', ')}. ` +
        `Missing loading states: ${missingStates.join(', ')}`
      );
    }

    // Execute initialization
    try {
      console.log(`InitializationManager: Initializing '${step.name}'...`);
      const result = await step.initFn();
      step.initialized = true;
      this.initialized.add(step.name);
      this.initializationOrder.push(step.name);
      console.log(`InitializationManager: '${step.name}' initialized successfully`);
      return result;
    } catch (error) {
      console.error(`InitializationManager: Error initializing '${step.name}':`, error);
      throw error;
    }
  }

  /**
   * Initialize all registered steps in dependency order
   * @returns {Promise} Promise that resolves when all steps are initialized
   */
  async initializeAll() {
    console.log(`InitializationManager: Starting initialization of ${this.initializationQueue.length} steps...`);

    const remaining = [...this.initializationQueue];
    let lastRemainingCount = remaining.length;

    while (remaining.length > 0) {
      // Find steps that can be initialized (all dependencies ready)
      const readySteps = [];
      for (const step of remaining) {
        if (await this.areDependenciesReady(step)) {
          readySteps.push(step);
        }
      }

      if (readySteps.length === 0) {
        // Check if we're stuck (no progress)
        if (remaining.length === lastRemainingCount) {
          const stuckSteps = remaining.map(s => s.name);
          throw new Error(
            `InitializationManager: Circular dependency or missing dependencies detected. ` +
            `Stuck steps: ${stuckSteps.join(', ')}`
          );
        }
        lastRemainingCount = remaining.length;

        // Wait a bit and retry
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }

      // Initialize ready steps in parallel
      const initPromises = readySteps.map(step => this.initializeStep(step));
      await Promise.all(initPromises);

      // Remove initialized steps from remaining
      readySteps.forEach(step => {
        const index = remaining.indexOf(step);
        if (index > -1) {
          remaining.splice(index, 1);
        }
      });
    }

    console.log(`InitializationManager: All steps initialized. Order: ${this.initializationOrder.join(' -> ')}`);
  }

  /**
   * Check if a step is initialized
   * @param {string} name - Step name
   * @returns {boolean} True if initialized
   */
  isInitialized(name) {
    return this.initialized.has(name);
  }

  /**
   * Get initialization status
   * @returns {Object} Status object
   */
  getStatus() {
    return {
      total: this.initializationQueue.length,
      initialized: this.initialized.size,
      pending: this.initializationQueue.length - this.initialized.size,
      order: [...this.initializationOrder]
    };
  }
}








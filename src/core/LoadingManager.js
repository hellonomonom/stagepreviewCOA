/**
 * Loading Manager
 * Tracks loading states and dependencies for all async operations
 */

export class LoadingManager {
  constructor() {
    this.states = new Map();
    this.listeners = new Map();
    this.dependencies = new Map();
  }

  /**
   * Register a loading state
   * @param {string} key - Unique identifier for the loading state
   * @param {Array<string>} dependsOn - Array of keys this state depends on
   */
  register(key, dependsOn = []) {
    this.states.set(key, {
      loaded: false,
      loading: false,
      error: null,
      dependsOn: dependsOn
    });
    this.dependencies.set(key, dependsOn);
  }

  /**
   * Check if all dependencies are loaded
   * @param {string} key - State key to check
   * @returns {boolean} True if all dependencies are loaded
   */
  areDependenciesLoaded(key) {
    const state = this.states.get(key);
    if (!state) return false;

    return state.dependsOn.every(depKey => {
      const depState = this.states.get(depKey);
      return depState && depState.loaded;
    });
  }

  /**
   * Mark a state as loading
   * @param {string} key - State key
   */
  setLoading(key) {
    const state = this.states.get(key);
    if (!state) {
      console.warn(`LoadingManager: State '${key}' not registered`);
      return;
    }

    if (!this.areDependenciesLoaded(key)) {
      const missing = state.dependsOn.filter(dep => {
        const depState = this.states.get(dep);
        return !depState || !depState.loaded;
      });
      console.warn(`LoadingManager: Dependencies not loaded for '${key}':`, missing);
      return;
    }

    state.loading = true;
    state.error = null;
    this.notifyListeners(key);
  }

  /**
   * Mark a state as loaded
   * @param {string} key - State key
   */
  setLoaded(key) {
    const state = this.states.get(key);
    if (!state) {
      console.warn(`LoadingManager: State '${key}' not registered`);
      return;
    }

    state.loaded = true;
    state.loading = false;
    state.error = null;
    this.notifyListeners(key);

    // Check if any other states were waiting for this one
    this.checkWaitingStates(key);
  }

  /**
   * Mark a state as error
   * @param {string} key - State key
   * @param {Error} error - Error object
   */
  setError(key, error) {
    const state = this.states.get(key);
    if (!state) {
      console.warn(`LoadingManager: State '${key}' not registered`);
      return;
    }

    state.loaded = false;
    state.loading = false;
    state.error = error;
    this.notifyListeners(key);
  }

  /**
   * Check if a state is loaded
   * @param {string} key - State key
   * @returns {boolean} True if loaded
   */
  isLoaded(key) {
    const state = this.states.get(key);
    return state ? state.loaded : false;
  }

  /**
   * Check if a state is loading
   * @param {string} key - State key
   * @returns {boolean} True if loading
   */
  isLoading(key) {
    const state = this.states.get(key);
    return state ? state.loading : false;
  }

  /**
   * Get error for a state
   * @param {string} key - State key
   * @returns {Error|null} Error if any
   */
  getError(key) {
    const state = this.states.get(key);
    return state ? state.error : null;
  }

  /**
   * Wait for a state to be loaded
   * @param {string} key - State key
   * @param {number} timeout - Timeout in milliseconds (default: 30000)
   * @returns {Promise} Promise that resolves when loaded or rejects on timeout/error
   */
  waitFor(key, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const state = this.states.get(key);
      if (!state) {
        reject(new Error(`LoadingManager: State '${key}' not registered`));
        return;
      }

      // If already loaded, resolve immediately
      if (state.loaded) {
        resolve();
        return;
      }

      // If there's an error, reject immediately
      if (state.error) {
        reject(state.error);
        return;
      }

      // Check dependencies first
      if (!this.areDependenciesLoaded(key)) {
        const missing = state.dependsOn.filter(dep => {
          const depState = this.states.get(dep);
          return !depState || !depState.loaded;
        });
        reject(new Error(`LoadingManager: Dependencies not loaded for '${key}': ${missing.join(', ')}`));
        return;
      }

      // Set up timeout
      const timeoutId = setTimeout(() => {
        this.removeListener(key, listener);
        reject(new Error(`LoadingManager: Timeout waiting for '${key}'`));
      }, timeout);

      // Set up listener
      const listener = (loadedKey, loaded, error) => {
        if (loadedKey === key) {
          clearTimeout(timeoutId);
          this.removeListener(key, listener);
          if (error) {
            reject(error);
          } else if (loaded) {
            resolve();
          }
        }
      };

      this.addListener(key, listener);
    });
  }

  /**
   * Wait for multiple states to be loaded
   * @param {Array<string>} keys - Array of state keys
   * @param {number} timeout - Timeout in milliseconds (default: 30000)
   * @returns {Promise} Promise that resolves when all are loaded
   */
  waitForAll(keys, timeout = 30000) {
    return Promise.all(keys.map(key => this.waitFor(key, timeout)));
  }

  /**
   * Add a listener for state changes
   * @param {string} key - State key
   * @param {Function} listener - Listener function (key, loaded, error) => void
   */
  addListener(key, listener) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, []);
    }
    this.listeners.get(key).push(listener);
  }

  /**
   * Remove a listener
   * @param {string} key - State key
   * @param {Function} listener - Listener function to remove
   */
  removeListener(key, listener) {
    const listeners = this.listeners.get(key);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Notify listeners of a state change
   * @param {string} key - State key
   */
  notifyListeners(key) {
    const listeners = this.listeners.get(key);
    if (listeners) {
      const state = this.states.get(key);
      listeners.forEach(listener => {
        try {
          listener(key, state.loaded, state.error);
        } catch (error) {
          console.error(`LoadingManager: Error in listener for '${key}':`, error);
        }
      });
    }
  }

  /**
   * Check states that were waiting for a dependency
   * @param {string} loadedKey - Key that was just loaded
   */
  checkWaitingStates(loadedKey) {
    // Find all states that depend on this key
    this.states.forEach((state, key) => {
      if (state.dependsOn.includes(loadedKey) && !state.loaded && !state.loading) {
        // If all dependencies are now loaded, notify listeners
        if (this.areDependenciesLoaded(key)) {
          this.notifyListeners(key);
        }
      }
    });
  }

  /**
   * Get loading status summary
   * @returns {Object} Status summary
   */
  getStatus() {
    const status = {
      total: this.states.size,
      loaded: 0,
      loading: 0,
      errors: 0,
      pending: 0
    };

    this.states.forEach(state => {
      if (state.error) {
        status.errors++;
      } else if (state.loaded) {
        status.loaded++;
      } else if (state.loading) {
        status.loading++;
      } else {
        status.pending++;
      }
    });

    return status;
  }

  /**
   * Reset a state (useful for reloading)
   * @param {string} key - State key
   */
  reset(key) {
    const state = this.states.get(key);
    if (state) {
      state.loaded = false;
      state.loading = false;
      state.error = null;
      this.notifyListeners(key);
    }
  }
}








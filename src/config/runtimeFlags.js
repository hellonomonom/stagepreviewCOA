/**
 * Runtime flags (client-side)
 * Keep all debug/perf toggles in one place so behavior is consistent.
 */
export const RUNTIME_FLAGS = {
  /** Media-related debug toggles */
  media: {
    /**
     * When true, MediaManager runs a secondary requestAnimationFrame loop that logs video texture status.
     * Leave false for normal use (it adds extra work every frame).
     */
    videoTextureDebugLoop: false,
  },
  /** Logging toggles (keep defaults quiet for production/dev use) */
  logging: {
    meshLoader: {
      progress: false,
      loaded: false,
      ledFrontDiscovery: false,
    },
    crowd: {
      verbose: false,
    },
    shaderControls: {
      verbose: false,
      missingControlsWarn: false,
    },
    media: {
      verbose: false,
    },
  },
};



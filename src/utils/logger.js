import { RUNTIME_FLAGS } from '../config/runtimeFlags.js';

function enabled(path, fallback = false) {
  try {
    const parts = path.split('.');
    let cur = RUNTIME_FLAGS;
    for (const p of parts) cur = cur?.[p];
    return typeof cur === 'boolean' ? cur : fallback;
  } catch {
    return fallback;
  }
}

export function debugLog(flagPath, ...args) {
  if (enabled(flagPath, false)) {
    // eslint-disable-next-line no-console
    console.log(...args);
  }
}

export function debugWarn(flagPath, ...args) {
  if (enabled(flagPath, false)) {
    // eslint-disable-next-line no-console
    console.warn(...args);
  }
}



/**
 * DOM utility functions
 * Provides helper functions for common DOM operations
 */

/**
 * Safely get an element by ID with optional warning
 * @param {string} id - Element ID
 * @param {boolean} warn - Whether to warn if element not found
 * @returns {HTMLElement|null} The element or null if not found
 */
export function getElement(id, warn = false) {
  const element = document.getElementById(id);
  if (!element && warn) {
    console.warn(`Element with id "${id}" not found`);
  }
  return element;
}

/**
 * Get multiple elements by their IDs
 * @param {string[]} ids - Array of element IDs
 * @returns {Object} Object with element IDs as keys and elements as values
 */
export function getElements(ids) {
  const elements = {};
  ids.forEach(id => {
    elements[id] = getElement(id);
  });
  return elements;
}

/**
 * Set up an event listener on an element
 * @param {string|HTMLElement} elementOrId - Element or element ID
 * @param {string} event - Event type
 * @param {Function} handler - Event handler
 * @param {Object} options - Event listener options
 * @returns {boolean} True if listener was added, false if element not found
 */
export function on(elementOrId, event, handler, options = {}) {
  const element = typeof elementOrId === 'string' ? getElement(elementOrId) : elementOrId;
  if (!element) {
    return false;
  }
  element.addEventListener(event, handler, options);
  return true;
}

/**
 * Set up a click event listener
 * @param {string|HTMLElement} elementOrId - Element or element ID
 * @param {Function} handler - Click handler
 * @returns {boolean} True if listener was added
 */
export function onClick(elementOrId, handler) {
  return on(elementOrId, 'click', handler);
}

/**
 * Toggle class on element(s)
 * @param {string|HTMLElement|Array} elementOrIdOrArray - Element(s) or ID(s)
 * @param {string} className - Class name to toggle
 * @param {boolean} force - Force add (true) or remove (false)
 */
export function toggleClass(elementOrIdOrArray, className, force) {
  const elements = Array.isArray(elementOrIdOrArray)
    ? elementOrIdOrArray.map(id => typeof id === 'string' ? getElement(id) : id).filter(Boolean)
    : [typeof elementOrIdOrArray === 'string' ? getElement(elementOrIdOrArray) : elementOrIdOrArray].filter(Boolean);
  
  elements.forEach(element => {
    if (element) {
      element.classList.toggle(className, force);
    }
  });
}

/**
 * Set text content of an element
 * @param {string|HTMLElement} elementOrId - Element or element ID
 * @param {string} text - Text to set
 */
export function setText(elementOrId, text) {
  const element = typeof elementOrId === 'string' ? getElement(elementOrId) : elementOrId;
  if (element) {
    element.textContent = text;
  }
}

/**
 * Set inner HTML of an element
 * @param {string|HTMLElement} elementOrId - Element or element ID
 * @param {string} html - HTML to set
 */
export function setHTML(elementOrId, html) {
  const element = typeof elementOrId === 'string' ? getElement(elementOrId) : elementOrId;
  if (element) {
    element.innerHTML = html;
  }
}

/**
 * Show/hide an element
 * @param {string|HTMLElement} elementOrId - Element or element ID
 * @param {boolean} show - Whether to show (true) or hide (false)
 */
export function setVisible(elementOrId, show) {
  const element = typeof elementOrId === 'string' ? getElement(elementOrId) : elementOrId;
  if (element) {
    element.style.display = show ? '' : 'none';
  }
}



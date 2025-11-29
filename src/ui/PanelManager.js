/**
 * Panel Manager
 * Handles panel dragging, tab switching, and panel visibility
 */

import { getElement, on } from '../utils/domUtils.js';

export class PanelManager {
  constructor() {
    this.draggingStates = {};
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.panelStartX = 0;
    this.panelStartY = 0;
    
    this.setupGlobalEventListeners();
  }
  
  /**
   * Get client coordinates from mouse or touch event
   * @param {Event} e - Mouse or touch event
   * @returns {Object} Object with x and y coordinates
   */
  getClientCoords(e) {
    if (e.touches && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  }
  
  /**
   * Make a panel draggable
   * @param {HTMLElement} panel - Panel element to make draggable
   * @param {string} dragStateKey - Unique key for this panel's drag state
   */
  makeDraggable(panel, dragStateKey) {
    if (!panel) return;
    
    const handleDragStart = (e) => {
      // Only start dragging if clicking on the panel background or labels (not interactive elements)
      const target = e.target;
      const isInteractive = target.tagName === 'INPUT' || 
                           target.tagName === 'SELECT' || 
                           target.tagName === 'BUTTON' ||
                           (target.tagName === 'LABEL' && target.getAttribute('for')) ||
                           // Exclude toggle buttons and their children (icons, spans, etc.)
                           target.closest('.settings-panel-toggle') ||
                           target.closest('.style-shader-panel-toggle') ||
                           target.closest('.camera-panel-toggle') ||
                           target.closest('.playback-menu-toggle') ||
                           target.closest('button[aria-label*="Minimize"]') ||
                           target.closest('button[aria-label*="Maximize"]');
      
      if (!isInteractive && (
        target === panel || 
        target.closest('.control-group label') || 
        target.closest('.control-section-header') || 
        target.closest('.playback-menu-content') || 
        target.closest('.frame-info') || 
        target.closest('.still-info')
      )) {
        const coords = this.getClientCoords(e);
        this.draggingStates[dragStateKey] = true;
        this.dragStartX = coords.x;
        this.dragStartY = coords.y;
        
        const rect = panel.getBoundingClientRect();
        this.panelStartX = rect.left;
        this.panelStartY = rect.top;
        
        panel.style.cursor = 'grabbing';
        e.preventDefault();
      }
    };
    
    on(panel, 'mousedown', handleDragStart);
    on(panel, 'touchstart', handleDragStart, { passive: false });
  }
  
  /**
   * Handle panel movement during drag
   * @param {Event} e - Mouse or touch move event
   * @param {HTMLElement} panel - Panel being dragged
   * @param {string} dragStateKey - Drag state key
   */
  handlePanelMove(e, panel, dragStateKey) {
    if (!this.draggingStates[dragStateKey] || !panel) return;
    
    const coords = this.getClientCoords(e);
    const deltaX = coords.x - this.dragStartX;
    const deltaY = coords.y - this.dragStartY;
    
    let newX = this.panelStartX + deltaX;
    let newY = this.panelStartY + deltaY;
    
    // Keep panel within viewport bounds
    const panelRect = panel.getBoundingClientRect();
    const maxX = window.innerWidth - panelRect.width;
    const maxY = window.innerHeight - panelRect.height;
    
    newX = Math.max(0, Math.min(newX, maxX));
    newY = Math.max(0, Math.min(newY, maxY));
    
    panel.style.left = `${newX}px`;
    panel.style.top = `${newY}px`;
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
    panel.style.transform = 'none';
    e.preventDefault();
  }
  
  /**
   * Handle panel drag end
   * @param {HTMLElement} panel - Panel that was being dragged
   * @param {string} dragStateKey - Drag state key
   */
  handlePanelEnd(panel, dragStateKey) {
    if (this.draggingStates[dragStateKey] && panel) {
      this.draggingStates[dragStateKey] = false;
      panel.style.cursor = 'grab';
    }
  }
  
  /**
   * Setup global event listeners for panel dragging
   */
  setupGlobalEventListeners() {
    // Store references to panels and their drag keys for global handlers
    this.panels = [];
    
    const handleGlobalMove = (e) => {
      this.panels.forEach(({ panel, key }) => {
        this.handlePanelMove(e, panel, key);
      });
    };
    
    const handleGlobalEnd = () => {
      this.panels.forEach(({ panel, key }) => {
        this.handlePanelEnd(panel, key);
      });
    };
    
    on(document, 'mousemove', handleGlobalMove);
    on(document, 'touchmove', handleGlobalMove, { passive: false });
    on(document, 'mouseup', handleGlobalEnd);
    on(document, 'touchend', handleGlobalEnd);
    on(document, 'touchcancel', handleGlobalEnd);
  }
  
  /**
   * Register a panel for dragging
   * @param {HTMLElement} panel - Panel element
   * @param {string} dragStateKey - Unique key for drag state
   */
  registerPanel(panel, dragStateKey) {
    if (!panel) return;
    this.makeDraggable(panel, dragStateKey);
    this.panels.push({ panel, key: dragStateKey });
  }
  
  /**
   * Switch between tabs in a tab group
   * @param {Object} config - Tab configuration
   * @param {string} config.activeTabName - Name of the active tab
   * @param {Array} config.tabs - Array of { button, panel, name } objects
   */
  switchTab({ activeTabName, tabs }) {
    tabs.forEach(({ button, panel, name }) => {
      if (button) {
        button.classList.toggle('active', name === activeTabName);
      }
      if (panel) {
        panel.classList.toggle('active', name === activeTabName);
      }
    });
  }
  
  /**
   * Setup tab switching for a group of tabs
   * @param {Object} config - Tab configuration
   * @param {Array} config.tabs - Array of { button, panel, name } objects
   * @param {string} config.defaultTab - Default active tab name
   */
  setupTabs({ tabs, defaultTab }) {
    tabs.forEach(({ button, name }) => {
      if (button) {
        on(button, 'click', () => {
          this.switchTab({ activeTabName: name, tabs });
        });
      }
    });
    
    if (defaultTab) {
      this.switchTab({ activeTabName: defaultTab, tabs });
    }
  }
}


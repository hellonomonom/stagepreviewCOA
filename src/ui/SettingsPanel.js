/**
 * Settings Panel Manager
 * Handles all UI panel interactions, tab switching, and panel state management
 */

import { getElement, on, toggleClass, setText, setVisible } from '../utils/domUtils.js';

export class SettingsPanel {
  constructor() {
    // Style/Shader panel elements
    this.styleTabBtn = getElement('styleTabBtn');
    this.shaderTabBtn = getElement('shaderTabBtn');
    this.styleTabPanel = getElement('styleTabPanel');
    this.shaderTabPanel = getElement('shaderTabPanel');
    this.styleShaderPanel = getElement('styleShaderPanel');
    this.styleShaderPanelToggle = getElement('styleShaderPanelToggle');
    this.showStyleShaderPanelCheckbox = getElement('showStyleShaderPanel');
    
    // Settings panel elements
    this.settingsPanel = getElement('settingsPanel');
    this.settingsPanelToggle = getElement('settingsPanelToggle');
    this.settingsPanelBurger = getElement('settingsPanelBurger');
    
    // Settings tabs
    this.mediaTabBtn = getElement('mediaTabBtn');
    this.mappingTabBtn = getElement('mappingTabBtn');
    this.stageTabBtn = getElement('stageTabBtn');
    this.cameraTabBtn = getElement('cameraTabBtn');
    this.devTabBtn = getElement('devTabBtn');
    this.mediaTabPanel = getElement('mediaTabPanel');
    this.mappingTabPanel = getElement('mappingTabPanel');
    this.stageTabPanel = getElement('stageTabPanel');
    this.cameraTabPanel = getElement('cameraTabPanel');
    this.devTabPanel = getElement('devTabPanel');
    
    // Camera panel
    this.cameraPanel = getElement('cameraPanel');
    this.cameraPanelToggle = getElement('cameraPanelToggle');
    
    // Version info
    this.versionInfoEl = getElement('versionInfo');

    // Dev tools
    this.showFpsCounterCheckbox = getElement('showFpsCounter');
    this.fpsCounterEl = getElement('fpsCounter');
    this.fpsRafId = null;
    this.fpsLastTs = 0;
    this.fpsFrames = 0;
    
    // Dev mode state
    this.devModeEnabled = false;
    this.devModeToggleBtn = getElement('devModeToggle');
    
    // Drag state
    this.isDragging = false;
    this.isDraggingCamera = false;
    this.isDraggingStyleShader = false;
    this.isDraggingPlayback = false;
    this.isDraggingFileInfo = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.panelStartX = 0;
    this.panelStartY = 0;
    
    this.init();
  }
  
  init() {
    this.initDevMode();
    this.initStyleShaderTabs();
    this.initSettingsTabs();
    this.initPanelToggles();
    this.initDevTools();
    this.initVersionInfo();
    this.initDragHandlers();
  }
  
  /**
   * Initialize dev mode - loads state and sets up keyboard shortcut
   */
  initDevMode() {
    // Load dev mode state from localStorage (default: false)
    try {
      const saved = localStorage.getItem('devMode.enabled');
      this.devModeEnabled = saved === '1' || saved === 'true';
    } catch {
      this.devModeEnabled = false;
    }
    
    // Hide dev tab button by default
    if (this.devTabBtn) {
      toggleClass(this.devTabBtn, 'hidden', !this.devModeEnabled);
    }
    
    // Set up toggle button
    if (this.devModeToggleBtn) {
      on(this.devModeToggleBtn, 'click', () => this.toggleDevMode());
      // Update button active state
      toggleClass(this.devModeToggleBtn, 'active', this.devModeEnabled);
    }
    
    // Apply dev mode state
    this.setDevMode(this.devModeEnabled, false); // false = don't save to localStorage (already loaded)
    
    // Set up keyboard shortcut (desktop only)
    this.initDevModeKeyboardShortcut();
  }
  
  /**
   * Check if running on desktop (not mobile/VR)
   * @returns {boolean} True if desktop
   */
  isDesktop() {
    // Check for touch device - if it has touch support, it's likely mobile/VR
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    // Keyboard shortcuts only work on desktop anyway, so if it's not a touch device,
    // consider it desktop. Note: VR headsets may not have touch support but also
    // don't have keyboards, so this is safe - the keyboard event simply won't fire.
    return !isTouchDevice;
  }
  
  /**
   * Initialize keyboard shortcut for dev mode toggle (Ctrl+Shift+D)
   */
  initDevModeKeyboardShortcut() {
    // Only enable on desktop
    if (!this.isDesktop()) {
      return;
    }
    
    on(document, 'keydown', (e) => {
      // Ctrl+Shift+D (or Cmd+Shift+D on Mac)
      const isModifierPressed = (e.ctrlKey || e.metaKey) && e.shiftKey;
      
      // Don't handle if user is typing in an input field
      const activeElement = document.activeElement;
      const isInputFocused = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.tagName === 'SELECT' ||
        activeElement.isContentEditable
      );
      
      if (isModifierPressed && e.key.toLowerCase() === 'd' && !isInputFocused) {
        e.preventDefault();
        this.toggleDevMode();
      }
    });
  }
  
  /**
   * Toggle dev mode on/off
   */
  toggleDevMode() {
    this.setDevMode(!this.devModeEnabled, true);
  }
  
  /**
   * Set dev mode state
   * @param {boolean} enabled - Whether dev mode should be enabled
   * @param {boolean} saveToStorage - Whether to save to localStorage
   */
  setDevMode(enabled, saveToStorage = true) {
    this.devModeEnabled = enabled;
    
    // Update toggle button active state
    if (this.devModeToggleBtn) {
      toggleClass(this.devModeToggleBtn, 'active', enabled);
    }
    
    // Show/hide dev tab button
    if (this.devTabBtn) {
      toggleClass(this.devTabBtn, 'hidden', !enabled);
    }
    
    // If disabling dev mode and we're on the dev tab, switch to media tab
    if (!enabled && this.devTabPanel) {
      const isDevTabActive = this.devTabPanel.classList.contains('active');
      if (isDevTabActive) {
        this.switchSettingsTab('media');
      }
    }
    
    // Show/hide FPS counter controls in dev tab
    if (this.showFpsCounterCheckbox) {
      const fpsControlGroup = this.showFpsCounterCheckbox.closest('.control-group');
      if (fpsControlGroup) {
        setVisible(fpsControlGroup, enabled);
      }
      
      if (enabled) {
        // When enabling dev mode, restore FPS counter state from localStorage
        try {
          const saved = localStorage.getItem('dev.showFpsCounter');
          const shouldShow = saved === '1';
          if (this.showFpsCounterCheckbox) {
            this.showFpsCounterCheckbox.checked = shouldShow;
          }
          this.setFpsCounterVisible(shouldShow);
        } catch {
          // ignore storage errors
        }
      } else {
        // If disabling dev mode, also hide the FPS counter
        this.setFpsCounterVisible(false);
      }
    }
    
    // Save to localStorage if requested
    if (saveToStorage) {
      try {
        localStorage.setItem('devMode.enabled', enabled ? '1' : '0');
      } catch {
        // ignore storage errors
      }
    }
  }
  
  /**
   * Get current dev mode state
   * @returns {boolean} Whether dev mode is enabled
   */
  getDevMode() {
    return this.devModeEnabled;
  }
  
  initStyleShaderTabs() {
    if (this.styleTabBtn) {
      on(this.styleTabBtn, 'click', () => this.switchTab('style'));
    }
    if (this.shaderTabBtn) {
      on(this.shaderTabBtn, 'click', () => this.switchTab('shader'));
    }
    // Initialize with Style tab active
    this.switchTab('style');
  }
  
  switchTab(activeTabName) {
    toggleClass(this.styleTabBtn, 'active', activeTabName === 'style');
    toggleClass(this.shaderTabBtn, 'active', activeTabName === 'shader');
    toggleClass(this.styleTabPanel, 'active', activeTabName === 'style');
    toggleClass(this.shaderTabPanel, 'active', activeTabName === 'shader');
  }
  
  initSettingsTabs() {
    const tabs = [
      { btn: this.mediaTabBtn, panel: this.mediaTabPanel, name: 'media' },
      { btn: this.mappingTabBtn, panel: this.mappingTabPanel, name: 'mapping' },
      { btn: this.stageTabBtn, panel: this.stageTabPanel, name: 'stage' },
      { btn: this.cameraTabBtn, panel: this.cameraTabPanel, name: 'camera' },
      { btn: this.devTabBtn, panel: this.devTabPanel, name: 'dev' }
    ];
    
    tabs.forEach(({ btn, name }) => {
      if (btn) {
        on(btn, 'click', () => this.switchSettingsTab(name));
      }
    });
    
    // Initialize with Media tab active
    this.switchSettingsTab('media');
  }
  
  switchSettingsTab(activeTabName) {
    // Prevent switching to dev tab if dev mode is disabled
    if (activeTabName === 'dev' && !this.devModeEnabled) {
      return;
    }
    
    const tabs = [
      { btn: this.mediaTabBtn, panel: this.mediaTabPanel, name: 'media' },
      { btn: this.mappingTabBtn, panel: this.mappingTabPanel, name: 'mapping' },
      { btn: this.stageTabBtn, panel: this.stageTabPanel, name: 'stage' },
      { btn: this.cameraTabBtn, panel: this.cameraTabPanel, name: 'camera' },
      { btn: this.devTabBtn, panel: this.devTabPanel, name: 'dev' }
    ];
    
    tabs.forEach(({ btn, panel, name }) => {
      toggleClass(btn, 'active', activeTabName === name);
      toggleClass(panel, 'active', activeTabName === name);
    });
  }
  
  initPanelToggles() {
    // Style-Shader panel visibility
    if (this.showStyleShaderPanelCheckbox && this.styleShaderPanel) {
      setVisible(this.styleShaderPanel, false);
      on(this.showStyleShaderPanelCheckbox, 'change', (e) => {
        const visible = e.target.checked;
        setVisible(this.styleShaderPanel, visible);
        if (visible) {
          toggleClass(this.styleShaderPanel, 'minimized', false);
          if (this.styleShaderPanelToggle) {
            setText(this.styleShaderPanelToggle, '−');
          }
        }
      });
    }
    
    // Style-Shader panel minimize
    if (this.styleShaderPanelToggle && this.styleShaderPanel) {
      on(this.styleShaderPanelToggle, 'click', () => {
        const isMinimized = toggleClass(this.styleShaderPanel, 'minimized');
        setText(this.styleShaderPanelToggle, isMinimized ? '+' : '−');
      });
    }
    
    // Settings panel minimize
    if (this.settingsPanelToggle && this.settingsPanel) {
      setText(this.settingsPanelToggle, '+');
      if (this.settingsPanelBurger) {
        setVisible(this.settingsPanelBurger, true);
      }
      
      on(this.settingsPanelToggle, 'click', () => {
        const isMinimized = toggleClass(this.settingsPanel, 'minimized');
        setText(this.settingsPanelToggle, isMinimized ? '+' : '−');
        if (this.settingsPanelBurger) {
          setVisible(this.settingsPanelBurger, isMinimized);
        }
      });
    }
    
    // Settings panel burger menu
    if (this.settingsPanelBurger && this.settingsPanel) {
      setVisible(this.settingsPanelBurger, true);
      on(this.settingsPanelBurger, 'click', () => {
        toggleClass(this.settingsPanel, 'minimized', false);
        if (this.settingsPanelToggle) {
          setText(this.settingsPanelToggle, '−');
        }
        setVisible(this.settingsPanelBurger, false);
      });
    }
    
    // Camera panel minimize
    if (this.cameraPanelToggle && this.cameraPanel) {
      on(this.cameraPanelToggle, 'click', () => {
        const isMinimized = toggleClass(this.cameraPanel, 'minimized');
        setText(this.cameraPanelToggle, isMinimized ? '+' : '−');
      });
    }
  }

  initDevTools() {
    if (!this.showFpsCounterCheckbox || !this.fpsCounterEl) return;

    // Only enable FPS counter if dev mode is enabled
    if (!this.devModeEnabled) {
      // Hide FPS counter checkbox and counter if dev mode is disabled
      setVisible(this.showFpsCounterCheckbox.closest('.control-group'), false);
      this.setFpsCounterVisible(false);
      return;
    }

    // Default off; persist across reloads
    let initial = false;
    let hasSavedPreference = false;
    try {
      const saved = localStorage.getItem('dev.showFpsCounter');
      hasSavedPreference = saved === '1' || saved === '0';
      if (saved === '1') initial = true;
      if (saved === '0') initial = false;
    } catch {
      // ignore (e.g. storage disabled)
    }

    this.showFpsCounterCheckbox.checked = initial;
    this.setFpsCounterVisible(initial);

    on(this.showFpsCounterCheckbox, 'change', (e) => {
      const visible = e.target.checked;
      this.setFpsCounterVisible(visible);
      try {
        localStorage.setItem('dev.showFpsCounter', visible ? '1' : '0');
      } catch {
        // ignore
      }
    });
  }

  setFpsCounterVisible(visible) {
    if (!this.fpsCounterEl) return;
    toggleClass(this.fpsCounterEl, 'hidden', !visible);
    if (visible) {
      this.startFpsCounter();
    } else {
      this.stopFpsCounter();
    }
  }

  startFpsCounter() {
    if (!this.fpsCounterEl) return;
    if (this.fpsRafId) return;

    this.fpsFrames = 0;
    this.fpsLastTs = performance.now();

    const tick = (ts) => {
      this.fpsFrames += 1;
      const dt = ts - this.fpsLastTs;

      // Update ~2x/sec for stable readout
      if (dt >= 500) {
        const fps = (this.fpsFrames * 1000) / dt;
        this.fpsCounterEl.textContent = `FPS: ${fps.toFixed(1)}`;
        this.fpsFrames = 0;
        this.fpsLastTs = ts;
      }

      this.fpsRafId = requestAnimationFrame(tick);
    };

    this.fpsRafId = requestAnimationFrame(tick);
  }

  stopFpsCounter() {
    if (!this.fpsRafId) return;
    cancelAnimationFrame(this.fpsRafId);
    this.fpsRafId = null;
  }
  
  initVersionInfo() {
    if (!this.versionInfoEl) return;
    
    // Version is read from package.json via vite.config.js -> __APP_VERSION__
    // This ensures the displayed version always matches package.json version
    // @ts-ignore - These are injected by Vite define
    const version = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
    // @ts-ignore
    const buildTime = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : null;
    // @ts-ignore
    const gitCommit = typeof __GIT_COMMIT__ !== 'undefined' ? __GIT_COMMIT__ : 'unknown';
    
    const lines = [`v${version}`];
    
    if (buildTime) {
      const date = new Date(buildTime);
      const formattedDate = date.toLocaleString('en-US', { 
        month: 'numeric', 
        day: 'numeric', 
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      lines.push(`Built: ${formattedDate}`);
    } else {
      lines.push('Built: development');
    }
    
    lines.push(`Commit: ${gitCommit}`);
    
    setText(this.versionInfoEl, lines.join('\n'));
  }
  
  initDragHandlers() {
    // Mouse and touch event handlers for dragging
    on(document, 'mousemove', (e) => this.handlePanelMove(e));
    on(document, 'touchmove', (e) => this.handlePanelMove(e));
    on(document, 'mouseup', () => this.handlePanelEnd());
    on(document, 'touchend', () => this.handlePanelEnd());
  }
  
  getClientCoords(e) {
    if (e.touches && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  }
  
  handlePanelMove(e, playbackMenu = null, fileInfoTop = null) {
    const coords = this.getClientCoords(e);
    
    if (this.isDragging && this.settingsPanel) {
      const deltaX = coords.x - this.dragStartX;
      const deltaY = coords.y - this.dragStartY;
      
      let newX = this.panelStartX + deltaX;
      let newY = this.panelStartY + deltaY;
      
      const panelRect = this.settingsPanel.getBoundingClientRect();
      const maxX = window.innerWidth - panelRect.width;
      const maxY = window.innerHeight - panelRect.height;
      
      newX = Math.max(0, Math.min(newX, maxX));
      newY = Math.max(0, Math.min(newY, maxY));
      
      this.settingsPanel.style.left = `${newX}px`;
      this.settingsPanel.style.top = `${newY}px`;
      this.settingsPanel.style.right = 'auto';
      e.preventDefault();
    }
    
    if (this.isDraggingCamera && this.cameraPanel) {
      const deltaX = coords.x - this.dragStartX;
      const deltaY = coords.y - this.dragStartY;
      
      let newX = this.panelStartX + deltaX;
      let newY = this.panelStartY + deltaY;
      
      const panelRect = this.cameraPanel.getBoundingClientRect();
      const maxX = window.innerWidth - panelRect.width;
      const maxY = window.innerHeight - panelRect.height;
      
      newX = Math.max(0, Math.min(newX, maxX));
      newY = Math.max(0, Math.min(newY, maxY));
      
      this.cameraPanel.style.left = `${newX}px`;
      this.cameraPanel.style.top = `${newY}px`;
      this.cameraPanel.style.right = 'auto';
      e.preventDefault();
    }
    
    if (this.isDraggingStyleShader && this.styleShaderPanel) {
      const deltaX = coords.x - this.dragStartX;
      const deltaY = coords.y - this.dragStartY;
      
      let newX = this.panelStartX + deltaX;
      let newY = this.panelStartY + deltaY;
      
      const panelRect = this.styleShaderPanel.getBoundingClientRect();
      const maxX = window.innerWidth - panelRect.width;
      const maxY = window.innerHeight - panelRect.height;
      
      newX = Math.max(0, Math.min(newX, maxX));
      newY = Math.max(0, Math.min(newY, maxY));
      
      this.styleShaderPanel.style.left = `${newX}px`;
      this.styleShaderPanel.style.top = `${newY}px`;
      this.styleShaderPanel.style.transform = 'none';
      e.preventDefault();
    }
    
    if (this.isDraggingPlayback && playbackMenu) {
      this.handlePlaybackDrag(coords, playbackMenu);
      e.preventDefault();
    }
    
    if (this.isDraggingFileInfo && fileInfoTop) {
      this.handleFileInfoDrag(coords, fileInfoTop);
      e.preventDefault();
    }
  }
  
  handlePanelEnd(playbackMenu = null, fileInfoTop = null) {
    if (this.isDragging && this.settingsPanel) {
      this.isDragging = false;
      this.settingsPanel.style.cursor = 'grab';
    }
    if (this.isDraggingCamera && this.cameraPanel) {
      this.isDraggingCamera = false;
      this.cameraPanel.style.cursor = 'grab';
    }
    if (this.isDraggingStyleShader && this.styleShaderPanel) {
      this.isDraggingStyleShader = false;
      this.styleShaderPanel.style.cursor = 'grab';
    }
    if (this.isDraggingPlayback && playbackMenu) {
      this.isDraggingPlayback = false;
      playbackMenu.style.cursor = 'grab';
    }
    if (this.isDraggingFileInfo && fileInfoTop) {
      this.isDraggingFileInfo = false;
      fileInfoTop.style.cursor = 'grab';
    }
  }
  
  makePanelDraggable(panel, dragStateVar) {
    if (!panel) return;
    
    const handleStart = (e) => {
      const target = e.target;
      const isInteractive = target.tagName === 'INPUT' || 
                           target.tagName === 'SELECT' || 
                           target.tagName === 'BUTTON' ||
                           (target.tagName === 'LABEL' && target.getAttribute('for'));
      
      if (!isInteractive && (target === panel || target.closest('.control-group label') || target.closest('.control-section-header') || target.closest('.playback-menu-content') || target.closest('.frame-info') || target.closest('.still-info'))) {
        const coords = this.getClientCoords(e);
        
        if (dragStateVar === 'control') {
          this.isDragging = true;
        } else if (dragStateVar === 'camera') {
          this.isDraggingCamera = true;
        } else if (dragStateVar === 'styleShader') {
          this.isDraggingStyleShader = true;
        } else if (dragStateVar === 'playback') {
          this.isDraggingPlayback = true;
        } else if (dragStateVar === 'fileInfo') {
          this.isDraggingFileInfo = true;
        }
        
        this.dragStartX = coords.x;
        this.dragStartY = coords.y;
        
        const rect = panel.getBoundingClientRect();
        this.panelStartX = rect.left;
        this.panelStartY = rect.top;
        
        panel.style.cursor = 'grabbing';
        e.preventDefault();
      }
    };
    
    on(panel, 'mousedown', handleStart);
    on(panel, 'touchstart', handleStart, { passive: false });
    
    panel.style.cursor = 'grab';
  }
  
  handlePlaybackDrag(coords, playbackMenu) {
    if (this.isDraggingPlayback && playbackMenu) {
      const deltaX = coords.x - this.dragStartX;
      const deltaY = coords.y - this.dragStartY;
      
      let newX = this.panelStartX + deltaX;
      let newY = this.panelStartY + deltaY;
      
      const panelRect = playbackMenu.getBoundingClientRect();
      const maxX = window.innerWidth - panelRect.width;
      const maxY = window.innerHeight - panelRect.height;
      
      newX = Math.max(0, Math.min(newX, maxX));
      newY = Math.max(0, Math.min(newY, maxY));
      
      playbackMenu.style.left = `${newX}px`;
      playbackMenu.style.top = `${newY}px`;
      playbackMenu.style.right = 'auto';
      playbackMenu.style.bottom = 'auto';
      playbackMenu.style.transform = 'none';
    }
  }
  
  handleFileInfoDrag(coords, fileInfoTop) {
    if (this.isDraggingFileInfo && fileInfoTop) {
      const deltaX = coords.x - this.dragStartX;
      const deltaY = coords.y - this.dragStartY;
      
      let newX = this.panelStartX + deltaX;
      let newY = this.panelStartY + deltaY;
      
      const panelRect = fileInfoTop.getBoundingClientRect();
      const maxX = window.innerWidth - panelRect.width;
      const maxY = window.innerHeight - panelRect.height;
      
      newX = Math.max(0, Math.min(newX, maxX));
      newY = Math.max(0, Math.min(newY, maxY));
      
      fileInfoTop.style.left = `${newX}px`;
      fileInfoTop.style.top = `${newY}px`;
      fileInfoTop.style.right = 'auto';
      fileInfoTop.style.bottom = 'auto';
      fileInfoTop.style.transform = 'none';
    }
  }
}


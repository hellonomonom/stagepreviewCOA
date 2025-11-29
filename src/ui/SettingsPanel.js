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
    this.initStyleShaderTabs();
    this.initSettingsTabs();
    this.initPanelToggles();
    this.initVersionInfo();
    this.initDragHandlers();
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
  
  initVersionInfo() {
    if (!this.versionInfoEl) return;
    
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


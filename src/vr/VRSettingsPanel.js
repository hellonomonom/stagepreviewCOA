/**
 * VR Settings Panel
 * 3D settings interface accessible in VR
 */

import { VRPanel } from '../ui/VRPanel.js';
import { VRButton } from '../ui/VRButton.js';
import * as THREE from 'three';

export class VRSettingsPanel {
  constructor(options = {}) {
    this.settingsPanel = options.settingsPanel; // Reference to SettingsPanel instance
    this.onMappingChange = options.onMappingChange;
    this.onSourceTypeChange = options.onSourceTypeChange;
    
    // Create panel
    this.panel = new VRPanel({
      width: 2.0,
      height: 1.8,
      name: 'VRSettingsPanel',
      followUser: true,
      positionOffset: new THREE.Vector3(0, 0.3, -1.5) // Higher position
    });
    
    // Tabs
    this.currentTab = 'media';
    this.tabButtons = {};
    
    // Settings buttons
    this.settingButtons = {};
    
    this.createTabs();
    this.createMediaTab();
  }

  /**
   * Create tab buttons
   * @private
   */
  createTabs() {
    const tabs = [
      { id: 'media', label: 'Media' },
      { id: 'mapping', label: 'Mapping' },
      { id: 'stage', label: 'Stage' }
    ];
    
    const tabWidth = 0.3;
    const tabHeight = 0.08;
    const startX = -0.45;
    const tabY = 0.8;
    
    tabs.forEach((tab, index) => {
      const button = new VRButton({
        label: tab.label,
        width: tabWidth,
        height: tabHeight,
        color: index === 0 ? 0x00aff0 : 0x333333
      });
      
      button.setPosition(startX + index * (tabWidth + 0.05), tabY, 0.01);
      button.onClick(() => {
        this.switchTab(tab.id);
      });
      
      this.tabButtons[tab.id] = button;
      this.panel.add(button.getGroup());
    });
  }

  /**
   * Create media tab content
   * @private
   */
  createMediaTab() {
    // Source type buttons
    const sourceTypes = [
      { id: 'texture', label: 'Image/Video' },
      { id: 'ndi', label: 'NDI Stream' }
    ];
    
    const buttonWidth = 0.4;
    const buttonHeight = 0.1;
    const startX = -0.4;
    let currentY = 0.5;
    
    sourceTypes.forEach((sourceType, index) => {
      const button = new VRButton({
        label: sourceType.label,
        width: buttonWidth,
        height: buttonHeight
      });
      
      button.setPosition(startX + index * (buttonWidth + 0.1), currentY, 0.01);
      button.onClick(() => {
        if (this.onSourceTypeChange) {
          this.onSourceTypeChange(sourceType.id);
        }
        this.highlightButton(button);
      });
      
      this.settingButtons[`sourceType_${sourceType.id}`] = button;
      this.panel.add(button.getGroup());
    });
  }

  /**
   * Create mapping tab content
   * @private
   */
  createMappingTab() {
    // Mapping type options (simplified - show key options)
    const mappingTypes = [
      { id: 'farCamA', label: 'Mapping A' },
      { id: 'farCamB', label: 'Mapping B' },
      { id: 'farCamC', label: 'Mapping C' },
      { id: 'farCamD', label: 'Mapping D' },
      { id: 'farCamE', label: 'Mapping E' }
    ];
    
    const buttonWidth = 0.35;
    const buttonHeight = 0.08;
    const startX = -0.42;
    let currentY = 0.5;
    
    mappingTypes.forEach((mappingType, index) => {
      const row = Math.floor(index / 2);
      const col = index % 2;
      
      const button = new VRButton({
        label: mappingType.label,
        width: buttonWidth,
        height: buttonHeight
      });
      
      button.setPosition(
        startX + col * (buttonWidth + 0.1),
        currentY - row * (buttonHeight + 0.05),
        0.01
      );
      
      button.onClick(() => {
        if (this.onMappingChange) {
          this.onMappingChange(mappingType.id);
        }
        this.highlightButton(button);
      });
      
      this.settingButtons[`mapping_${mappingType.id}`] = button;
      this.panel.add(button.getGroup());
    });
  }

  /**
   * Switch tab
   * @private
   */
  switchTab(tabId) {
    this.currentTab = tabId;
    
    // Update tab button colors
    Object.entries(this.tabButtons).forEach(([id, button]) => {
      if (button.buttonMesh) {
        button.buttonMesh.material.color.setHex(
          id === tabId ? 0x00aff0 : 0x333333
        );
      }
    });
    
    // Show/hide tab content
    // In a full implementation, you'd manage visibility of content groups
    // For now, we'll recreate content when switching tabs
    this.updateTabContent();
  }

  /**
   * Update tab content visibility
   * @private
   */
  updateTabContent() {
    // Hide all setting buttons first
    Object.values(this.settingButtons).forEach(button => {
      if (button && button.group) {
        button.group.visible = false;
      }
    });
    
    // Show buttons for current tab
    Object.keys(this.settingButtons).forEach(key => {
      if (key.startsWith(this.currentTab + '_')) {
        const button = this.settingButtons[key];
        if (button && button.group) {
          button.group.visible = true;
        }
      }
    });
  }

  /**
   * Highlight a button
   * @private
   */
  highlightButton(button) {
    // Reset all buttons in same category
    Object.values(this.settingButtons).forEach(btn => {
      if (btn && btn.buttonMesh && btn !== button) {
        btn.buttonMesh.material.color.setHex(0x333333);
      }
    });
    
    // Highlight selected button
    if (button && button.buttonMesh) {
      button.buttonMesh.material.color.setHex(0x00aff0);
    }
  }

  /**
   * Update panel position based on camera
   * @param {THREE.Camera} camera
   */
  update(camera) {
    if (this.panel && camera) {
      this.panel.updatePosition(camera);
    }
  }

  /**
   * Handle ray-cast interaction
   * @param {THREE.Ray} ray - Ray from controller or hand
   */
  handleRaycast(ray) {
    if (!this.panel || !this.panel.isVisible()) return null;
    
    return this.panel.raycast(ray);
  }

  /**
   * Set visibility
   * @param {boolean} visible
   */
  setVisible(visible) {
    if (this.panel) {
      this.panel.setVisible(visible);
    }
  }

  /**
   * Check if visible
   * @returns {boolean}
   */
  isVisible() {
    return this.panel ? this.panel.isVisible() : false;
  }

  /**
   * Get panel group (for adding to scene)
   * @returns {THREE.Group}
   */
  getGroup() {
    return this.panel ? this.panel.getGroup() : null;
  }

  /**
   * Cleanup
   */
  dispose() {
    Object.values(this.tabButtons).forEach(button => {
      if (button) {
        button.dispose();
      }
    });
    
    Object.values(this.settingButtons).forEach(button => {
      if (button) {
        button.dispose();
      }
    });
    
    if (this.panel) {
      this.panel.dispose();
    }
  }
}


/**
 * Scene Controls
 * Manages scene-level settings like background color
 */

import * as THREE from 'three';

export class SceneControls {
  constructor(scene) {
    this.scene = scene;
    
    // DOM Elements
    this.backgroundColorR = document.getElementById('backgroundColorR');
    this.backgroundColorG = document.getElementById('backgroundColorG');
    this.backgroundColorB = document.getElementById('backgroundColorB');
    this.backgroundColorPicker = document.getElementById('backgroundColorPicker');
    this.copyBackgroundColorBtn = document.getElementById('copyBackgroundColorBtn');
    
    this.init();
  }
  
  /**
   * Initialize event listeners
   */
  init() {
    if (this.backgroundColorR && this.backgroundColorG && this.backgroundColorB) {
      // Red slider
      this.backgroundColorR.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        this.updateBackgroundColor();
        const valueEl = document.getElementById('backgroundColorRValue');
        if (valueEl) valueEl.textContent = value.toFixed(3);
        // Update color picker
        if (this.backgroundColorPicker) {
          const g = parseFloat(this.backgroundColorG.value);
          const b = parseFloat(this.backgroundColorB.value);
          const hex = '#' + [value, g, b].map(x => {
            const hex = Math.round(x * 255).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
          }).join('');
          this.backgroundColorPicker.value = hex;
        }
      });
      
      // Green slider
      this.backgroundColorG.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        this.updateBackgroundColor();
        const valueEl = document.getElementById('backgroundColorGValue');
        if (valueEl) valueEl.textContent = value.toFixed(3);
        // Update color picker
        if (this.backgroundColorPicker) {
          const r = parseFloat(this.backgroundColorR.value);
          const b = parseFloat(this.backgroundColorB.value);
          const hex = '#' + [r, value, b].map(x => {
            const hex = Math.round(x * 255).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
          }).join('');
          this.backgroundColorPicker.value = hex;
        }
      });
      
      // Blue slider
      this.backgroundColorB.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        this.updateBackgroundColor();
        const valueEl = document.getElementById('backgroundColorBValue');
        if (valueEl) valueEl.textContent = value.toFixed(3);
        // Update color picker
        if (this.backgroundColorPicker) {
          const r = parseFloat(this.backgroundColorR.value);
          const g = parseFloat(this.backgroundColorG.value);
          const hex = '#' + [r, g, value].map(x => {
            const hex = Math.round(x * 255).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
          }).join('');
          this.backgroundColorPicker.value = hex;
        }
      });
      
      // Color picker
      if (this.backgroundColorPicker) {
        this.backgroundColorPicker.addEventListener('input', (e) => {
          const hex = e.target.value;
          const r = parseInt(hex.slice(1, 3), 16) / 255;
          const g = parseInt(hex.slice(3, 5), 16) / 255;
          const b = parseInt(hex.slice(5, 7), 16) / 255;
          
          // Update RGB sliders
          this.backgroundColorR.value = r;
          this.backgroundColorG.value = g;
          this.backgroundColorB.value = b;
          
          // Update value displays
          const valueElR = document.getElementById('backgroundColorRValue');
          const valueElG = document.getElementById('backgroundColorGValue');
          const valueElB = document.getElementById('backgroundColorBValue');
          if (valueElR) valueElR.textContent = r.toFixed(3);
          if (valueElG) valueElG.textContent = g.toFixed(3);
          if (valueElB) valueElB.textContent = b.toFixed(3);
          
          // Update scene background
          this.updateBackgroundColor();
        });
      }
    }
    
    // Copy background color button
    if (this.copyBackgroundColorBtn) {
      this.copyBackgroundColorBtn.addEventListener('click', () => {
        this.copyBackgroundColorValues();
      });
    }
  }
  
  /**
   * Update scene background color
   */
  updateBackgroundColor() {
    const r = parseFloat(this.backgroundColorR?.value || 0.004);
    const g = parseFloat(this.backgroundColorG?.value || 0.004);
    const b = parseFloat(this.backgroundColorB?.value || 0.004);
    
    // Update scene background
    this.scene.background = new THREE.Color(r, g, b);
  }
  
  /**
   * Copy background color values to clipboard
   */
  copyBackgroundColorValues() {
    const r = parseFloat(this.backgroundColorR?.value || 0.004);
    const g = parseFloat(this.backgroundColorG?.value || 0.004);
    const b = parseFloat(this.backgroundColorB?.value || 0.004);
    
    const values = {
      backgroundColor: [r.toFixed(3), g.toFixed(3), b.toFixed(3)]
    };
    
    // Format as a JavaScript object
    const valuesString = JSON.stringify(values, null, 2);
    
    // Copy to clipboard
    navigator.clipboard.writeText(valuesString).then(() => {
      console.log('Background color values copied to clipboard');
    }).catch(err => {
      console.error('Failed to copy background color values:', err);
      // Fallback: show in prompt
      prompt('Copy these values:', valuesString);
    });
  }
}




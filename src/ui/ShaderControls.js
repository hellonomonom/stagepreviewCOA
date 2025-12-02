/**
 * Shader Controls Manager
 * Handles initialization and management of shader control UI elements
 */

import { getElement, on, setText } from '../utils/domUtils.js';

export class ShaderControls {
  constructor(shaderMaterials, materialReferences, updateShaderUniformsFn, syncControlsToShaderValuesFn) {
    this.shaderMaterials = shaderMaterials;
    this.materialReferences = materialReferences;
    this.updateShaderUniforms = updateShaderUniformsFn;
    this.syncControlsToShaderValues = syncControlsToShaderValuesFn;
  }
  
  /**
   * Convert RGB values (0-1) to hex color string
   * @param {number} r - Red component (0-1)
   * @param {number} g - Green component (0-1)
   * @param {number} b - Blue component (0-1)
   * @returns {string} Hex color string (e.g., "#ffffff")
   */
  rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => {
      const hex = Math.round(x * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  }
  
  /**
   * Convert hex color string to RGB values (0-1)
   * @param {string} hex - Hex color string (e.g., "#ffffff")
   * @returns {Object} Object with r, g, b values (0-1)
   */
  hexToRgb(hex) {
    return {
      r: parseInt(hex.slice(1, 3), 16) / 255,
      g: parseInt(hex.slice(3, 5), 16) / 255,
      b: parseInt(hex.slice(5, 7), 16) / 255
    };
  }
  
  /**
   * Initialize controls for a single shader type
   * @param {string} shaderType - Shader type name (e.g., 'artists', 'base', 'stage')
   */
  initShaderTypeControls(shaderType) {
    const colorR = getElement(`${shaderType}ColorR`);
    const colorG = getElement(`${shaderType}ColorG`);
    const colorB = getElement(`${shaderType}ColorB`);
    const colorPicker = getElement(`${shaderType}ColorPicker`);
    const roughnessSlider = getElement(`${shaderType}Roughness`);
    const specularSlider = getElement(`${shaderType}Specular`);
    
    if (!colorR || !colorG || !colorB) {
      console.warn(`Missing color controls for shader type: ${shaderType}`);
      return;
    }
    
    // Update color function
    const updateColor = () => {
      const r = parseFloat(colorR.value);
      const g = parseFloat(colorG.value);
      const b = parseFloat(colorB.value);
      
      this.updateShaderUniforms(shaderType, 'uBaseColor', [r, g, b]);
      
      // Update value displays
      const rValue = getElement(`${shaderType}ColorRValue`);
      const gValue = getElement(`${shaderType}ColorGValue`);
      const bValue = getElement(`${shaderType}ColorBValue`);
      if (rValue) setText(rValue, r.toFixed(2));
      if (gValue) setText(gValue, g.toFixed(2));
      if (bValue) setText(bValue, b.toFixed(2));
      
      // Update color picker
      if (colorPicker) {
        colorPicker.value = this.rgbToHex(r, g, b);
      }
    };
    
    // Color slider event listeners
    on(colorR, 'input', updateColor);
    on(colorG, 'input', updateColor);
    on(colorB, 'input', updateColor);
    
    // Color picker event listener
    if (colorPicker) {
      on(colorPicker, 'input', (e) => {
        const rgb = this.hexToRgb(e.target.value);
        colorR.value = rgb.r;
        colorG.value = rgb.g;
        colorB.value = rgb.b;
        updateColor();
      });
    }
    
    // Roughness slider
    if (roughnessSlider) {
      on(roughnessSlider, 'input', (e) => {
        const value = parseFloat(e.target.value);
        this.updateShaderUniforms(shaderType, 'uRoughness', value);
        const valueEl = getElement(`${shaderType}RoughnessValue`);
        if (valueEl) setText(valueEl, value.toFixed(2));
      });
    }
    
    // Specular slider
    if (specularSlider) {
      on(specularSlider, 'input', (e) => {
        const value = parseFloat(e.target.value);
        this.updateShaderUniforms(shaderType, 'uSpecular', value);
        const valueEl = getElement(`${shaderType}SpecularValue`);
        if (valueEl) setText(valueEl, value.toFixed(2));
      });
    }
  }
  
  /**
   * Copy shader values to clipboard
   * @param {string} shaderType - Shader type name
   */
  copyShaderValues(shaderType) {
    const colorR = getElement(`${shaderType}ColorR`);
    const colorG = getElement(`${shaderType}ColorG`);
    const colorB = getElement(`${shaderType}ColorB`);
    const roughnessSlider = getElement(`${shaderType}Roughness`);
    const specularSlider = getElement(`${shaderType}Specular`);
    
    if (!colorR || !colorG || !colorB || !roughnessSlider || !specularSlider) {
      console.error(`Could not find controls for shader type: ${shaderType}`);
      return;
    }
    
    const r = parseFloat(colorR.value);
    const g = parseFloat(colorG.value);
    const b = parseFloat(colorB.value);
    const roughness = parseFloat(roughnessSlider.value);
    const specular = parseFloat(specularSlider.value);
    
    const valuesString = `${shaderType}: {
  baseColor: [${r.toFixed(3)}, ${g.toFixed(3)}, ${b.toFixed(3)}],
  roughness: ${roughness.toFixed(3)},
  specular: ${specular.toFixed(3)}
}`;
    
    navigator.clipboard.writeText(valuesString).then(() => {
      console.log(`Copied ${shaderType} shader values to clipboard:`);
      console.log(valuesString);
      alert(`Copied ${shaderType} shader values to clipboard!`);
    }).catch(err => {
      console.error('Failed to copy:', err);
      console.log(`\n${shaderType} shader values:\n${valuesString}`);
      prompt('Copy these values:', valuesString);
    });
  }
  
  /**
   * Copy all shader values to clipboard
   */
  copyAllShaderValues() {
    const shaderTypes = ['base', 'artists', 'stage', 'pillars', 'floor', 'crowd'];
    const allValues = {};
    
    shaderTypes.forEach(shaderType => {
      const colorR = getElement(`${shaderType}ColorR`);
      const colorG = getElement(`${shaderType}ColorG`);
      const colorB = getElement(`${shaderType}ColorB`);
      const roughnessSlider = getElement(`${shaderType}Roughness`);
      const specularSlider = getElement(`${shaderType}Specular`);
      
      if (colorR && colorG && colorB && roughnessSlider && specularSlider) {
        const r = parseFloat(colorR.value);
        const g = parseFloat(colorG.value);
        const b = parseFloat(colorB.value);
        const roughness = parseFloat(roughnessSlider.value);
        const specular = parseFloat(specularSlider.value);
        
        allValues[shaderType] = {
          baseColor: [r.toFixed(3), g.toFixed(3), b.toFixed(3)],
          roughness: roughness.toFixed(3),
          specular: specular.toFixed(3)
        };
      }
    });
    
    // Format as a JavaScript object
    let valuesString = '';
    const keys = Object.keys(allValues);
    keys.forEach((shaderType, index) => {
      const values = allValues[shaderType];
      valuesString += `${shaderType}: {\n  baseColor: [${values.baseColor.join(', ')}],\n  roughness: ${values.roughness},\n  specular: ${values.specular}\n}`;
      if (index < keys.length - 1) {
        valuesString += ',\n\n';
      }
    });
    
    navigator.clipboard.writeText(valuesString).then(() => {
      console.log('Copied all shader values to clipboard:');
      console.log(valuesString);
      alert('Copied all shader values to clipboard!');
    }).catch(err => {
      console.error('Failed to copy:', err);
      console.log('\nAll shader values:\n' + valuesString);
      prompt('Copy these values:', valuesString);
    });
  }
  
  /**
   * Initialize all shader controls
   */
  init() {
    console.log('Initializing shader controls...');
    console.log('Material references:', this.materialReferences);
    
    // Initialize controls for each shader type
    const shaderTypes = ['artists', 'base', 'stage', 'pillars', 'floor', 'crowd'];
    shaderTypes.forEach(shaderType => {
      this.initShaderTypeControls(shaderType);
    });
    
    // Wire up copy buttons
    const copyButtons = {
      base: getElement('copyBaseShaderBtn'),
      artists: getElement('copyArtistsShaderBtn'),
      stage: getElement('copyStageShaderBtn'),
      pillars: getElement('copyPillarsShaderBtn'),
      floor: getElement('copyFloorShaderBtn'),
      crowd: getElement('copyCrowdShaderBtn')
    };
    
    Object.keys(copyButtons).forEach(shaderType => {
      const btn = copyButtons[shaderType];
      if (btn) {
        on(btn, 'click', () => this.copyShaderValues(shaderType));
      }
    });
    
    // Wire up copy all button
    const copyAllShadersBtn = getElement('copyAllShadersBtn');
    if (copyAllShadersBtn) {
      on(copyAllShadersBtn, 'click', () => this.copyAllShaderValues());
    }
    
    // Sync all controls to match current shader material values
    Object.keys(this.shaderMaterials).forEach(shaderType => {
      const material = this.shaderMaterials[shaderType];
      if (material && material.uniforms) {
        this.syncControlsToShaderValues(shaderType, material);
      }
    });
  }
}



/**
 * Overlay Manager
 * Handles mapping overlay display, aspect ratio adjustment, and size controls
 */

export class OverlayManager {
  constructor(mediaManager, material) {
    this.mediaManager = mediaManager;
    this.material = material;
    
    // DOM Elements
    this.mapping = document.getElementById('mapping');
    this.overlayVideo = document.getElementById('overlayVideo');
    this.overlayImage = document.getElementById('overlayImage');
    this.overlaySizeSlider = document.getElementById('overlaySizeSlider');
    this.overlaySizeValue = document.getElementById('overlaySizeValue');
    this.showMappingCheckbox = document.getElementById('showMapping');
    
    // Constants
    this.maxWidth = 400; // Maximum width in pixels
    this.maxHeight = 300; // Maximum height in pixels
    this.minWidth = 200; // Minimum width in pixels
    this.minHeight = 100; // Minimum height in pixels
    
    this.init();
  }
  
  /**
   * Initialize event listeners
   */
  init() {
    // Overlay size slider
    if (this.overlaySizeSlider && this.overlaySizeValue) {
      this.overlaySizeSlider.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        const scale = value;
        if (this.mapping) {
          this.mapping.style.transform = `translateX(-50%) scale(${scale})`;
        }
        this.overlaySizeValue.textContent = value.toFixed(1);
      });
    }
    
    // Show mapping checkbox
    if (this.showMappingCheckbox) {
      this.showMappingCheckbox.addEventListener('change', (e) => {
        if (e.target.checked) {
          // Show if there's a video or texture loaded (including images)
          const videoElement = this.mediaManager ? this.mediaManager.getCurrentVideoElement() : null;
          const hasTexture = this.material && this.material.uniforms && this.material.uniforms.uHasTexture.value === 1.0;
          const hasImage = this.overlayImage && this.overlayImage.src && this.overlayImage.src !== '';
          
          if (videoElement || hasTexture || hasImage) {
            if (this.mapping) {
              this.mapping.classList.add('active');
            }
          }
        } else {
          if (this.mapping) {
            this.mapping.classList.remove('active');
          }
        }
      });
    }
  }
  
  /**
   * Adjust mapping overlay to match aspect ratio
   * @param {number} width - Source width
   * @param {number} height - Source height
   */
  adjustMappingAspectRatio(width, height) {
    if (!this.mapping) return;
    
    // Calculate exact aspect ratio
    const aspectRatio = width / height;
    
    let overlayWidth, overlayHeight;
    
    // Calculate optimal size maintaining exact aspect ratio
    // Try fitting to max width first
    overlayWidth = this.maxWidth;
    overlayHeight = overlayWidth / aspectRatio;
    
    // If height exceeds max, fit to max height instead
    if (overlayHeight > this.maxHeight) {
      overlayHeight = this.maxHeight;
      overlayWidth = overlayHeight * aspectRatio;
    }
    
    // Ensure minimum size while maintaining aspect ratio
    if (overlayWidth < this.minWidth) {
      overlayWidth = this.minWidth;
      overlayHeight = overlayWidth / aspectRatio;
    }
    if (overlayHeight < this.minHeight) {
      overlayHeight = this.minHeight;
      overlayWidth = overlayHeight * aspectRatio;
    }
    
    // Set dimensions with high precision to maintain exact aspect ratio
    // This prevents black bars on very wide images
    this.mapping.style.width = `${overlayWidth}px`;
    this.mapping.style.height = `${overlayHeight}px`;
    
    // Reset scale to current slider value when adjusting aspect ratio
    const currentScale = this.overlaySizeSlider ? (parseFloat(this.overlaySizeSlider.value) || 1.0) : 1.0;
    this.mapping.style.transform = `translateX(-50%) scale(${currentScale})`;
  }
  
  /**
   * Show the mapping overlay
   */
  showMapping() {
    if (this.mapping) {
      this.mapping.classList.add('active');
    }
  }
  
  /**
   * Hide the mapping overlay
   */
  hideMapping() {
    if (this.mapping) {
      this.mapping.classList.remove('active');
    }
  }
  
  /**
   * Get overlay video element
   * @returns {HTMLVideoElement|null}
   */
  getOverlayVideo() {
    return this.overlayVideo;
  }
  
  /**
   * Get overlay image element
   * @returns {HTMLImageElement|null}
   */
  getOverlayImage() {
    return this.overlayImage;
  }
}



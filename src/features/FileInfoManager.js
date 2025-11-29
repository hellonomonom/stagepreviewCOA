/**
 * File Info Manager
 * Handles file metadata extraction and display updates
 */

export class FileInfoManager {
  constructor(mediaManager) {
    this.mediaManager = mediaManager;
    
    // DOM Elements
    this.fileNameDisplay = document.getElementById('fileNameDisplay');
    this.timeDisplay = document.getElementById('timeDisplay');
    this.totalTimeDisplay = document.getElementById('totalTimeDisplay');
    this.frameInfo = document.getElementById('frameInfo');
    this.stillInfo = document.getElementById('stillInfo');
    this.stillFileNameDisplay = document.getElementById('stillFileNameDisplay');
    this.showFileInfoCheckbox = document.getElementById('showFileInfo');
    this.overlayImage = document.getElementById('overlayImage');
  }

  /**
   * Extract filename from path
   * @param {string} path - File path
   * @returns {string} Filename
   */
  getFileName(path) {
    if (!path) return '';
    // Handle both forward and backslashes
    const parts = path.split(/[/\\]/);
    return parts[parts.length - 1] || path;
  }

  /**
   * Detect video codec from video element or path
   * @param {HTMLVideoElement} video - Video element
   * @param {string} path - Video file path
   * @returns {string} Codec name
   */
  getVideoCodec(video, path) {
    if (!video) return 'unknown';
    
    // Try to detect codec from file extension
    if (path) {
      const ext = path.toLowerCase().split('.').pop();
      // MP4 typically uses H.264 or H.265
      if (ext === 'mp4') {
        // Try to detect from video capabilities
        if (video.canPlayType && video.canPlayType('video/mp4; codecs="avc1.42E01E"')) {
          return 'H.264';
        } else if (video.canPlayType && video.canPlayType('video/mp4; codecs="hev1.1.6.L93.B0"')) {
          return 'H.265';
        }
        return 'H.264'; // Default assumption for MP4
      }
      if (ext === 'webm') return 'VP8/VP9';
      if (ext === 'ogg' || ext === 'ogv') return 'Theora';
    }
    
    // Fallback: try to detect from video src or canPlayType
    if (video.src) {
      if (video.src.includes('.mp4')) {
        return 'H.264'; // Default for MP4
      }
    }
    
    return 'unknown';
  }

  /**
   * Get image metadata (bit depth and colorspace)
   * @param {File} file - Image file
   * @param {HTMLImageElement} imageElement - Image element
   * @returns {Object} Metadata object with bitDepth and colorspace
   */
  getImageMetadata(file, imageElement) {
    // Default values
    let bitDepth = '8bit';
    let colorspace = 'sRGB';
    
    // Try to detect bit depth from file extension or type
    const fileName = file ? file.name.toLowerCase() : '';
    if (fileName.endsWith('.png') || fileName.endsWith('.tiff') || fileName.endsWith('.tif')) {
      // PNG and TIFF can be 16bit, but we'll default to 8bit unless we can detect otherwise
      bitDepth = '8bit';
    }
    
    // Try to detect from image data if available
    if (imageElement && imageElement.naturalWidth) {
      // For now, we'll use defaults. In a real implementation, you might:
      // - Use EXIF data for bit depth
      // - Check image color profile for colorspace
      // - Use canvas to analyze pixel data
    }
    
    return { bitDepth, colorspace };
  }

  /**
   * Format time as mm:ss
   * @param {number} timeInSeconds - Time in seconds
   * @returns {string} Formatted time string
   */
  formatTime(timeInSeconds) {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  /**
   * Update still image info display
   * @param {File} file - Image file
   */
  updateStillInfo(file) {
    if (!this.stillInfo || !this.stillFileNameDisplay) return;
    
    const imagePath = this.mediaManager ? this.mediaManager.getCurrentImagePath() : null;
    const fileName = this.getFileName(file ? file.name : (imagePath || ''));
    const metadata = this.getImageMetadata(file, this.overlayImage);
    
    this.stillFileNameDisplay.textContent = `${fileName} (${metadata.bitDepth}, ${metadata.colorspace})`;
    
    // Show stillInfo at top if checkbox is checked
    if (this.showFileInfoCheckbox && this.showFileInfoCheckbox.checked) {
      this.stillInfo.classList.add('active');
    } else {
      this.stillInfo.classList.remove('active');
    }
  }

  /**
   * Update video frame info display
   * @param {HTMLVideoElement} video - Video element
   * @param {HTMLInputElement} timelineSlider - Timeline slider element
   * @param {boolean} isSeeking - Whether user is currently seeking
   */
  updateFrameInfo(video, timelineSlider, isSeeking) {
    // Extract filename and codec
    const videoPath = this.mediaManager ? this.mediaManager.getCurrentVideoPath() : null;
    const fileName = this.getFileName(videoPath);
    const codec = this.getVideoCodec(video, videoPath);
    
    if (!video || !isFinite(video.duration) || video.duration === 0) {
      if (this.frameInfo) {
        const frameText = this.frameInfo.querySelector('span:nth-child(3)');
        if (frameText) frameText.textContent = 'Frame: 0 / 0';
      }
      if (this.fileNameDisplay) {
        this.fileNameDisplay.textContent = fileName ? `${fileName} (${codec})` : '';
      }
      if (this.timeDisplay) this.timeDisplay.textContent = '00:00';
      if (this.totalTimeDisplay) this.totalTimeDisplay.textContent = '00:00';
      return;
    }
    
    const currentTime = video.currentTime || 0;
    const duration = video.duration;
    const frameRate = this.mediaManager ? this.mediaManager.getVideoFrameRate() : 30;
    const currentFrame = Math.floor(currentTime * frameRate);
    const totalFrames = Math.floor(duration * frameRate);
    
    // Update filename display with codec info
    if (this.fileNameDisplay) {
      this.fileNameDisplay.textContent = `${fileName} (${codec})`;
    }
    
    // Update frame counter
    if (this.frameInfo) {
      // Find the span that contains "Frame:" (third span, after fileNameDisplay and separator)
      const frameText = this.frameInfo.querySelector('span:nth-child(3)');
      if (frameText) frameText.textContent = `Frame: ${currentFrame} / ${totalFrames}`;
      // Show frameInfo at top if checkbox is checked
      if (this.showFileInfoCheckbox && this.showFileInfoCheckbox.checked) {
        this.frameInfo.classList.add('active');
      } else {
        this.frameInfo.classList.remove('active');
      }
    }
    
    // Update current time display (format as mm:ss)
    if (this.timeDisplay) {
      this.timeDisplay.textContent = this.formatTime(currentTime);
    }
    
    // Update total time display (format as mm:ss)
    if (this.totalTimeDisplay) {
      this.totalTimeDisplay.textContent = this.formatTime(duration);
    }
    
    // Update timeline slider (only if not currently seeking)
    if (timelineSlider && !isSeeking && duration > 0) {
      const percentage = (currentTime / duration) * 100;
      timelineSlider.value = percentage;
    }
  }
}


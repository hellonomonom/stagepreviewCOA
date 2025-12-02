/**
 * File Info Manager
 * Handles file metadata extraction and display updates
 */

export class FileInfoManager {
  constructor(mediaManager) {
    this.mediaManager = mediaManager;
    
    // DOM Elements
    this.fileNameDisplay = document.getElementById('fileNameDisplay');
    this.frameCountDisplay = document.getElementById('frameCountDisplay');
    this.timeDisplay = document.getElementById('timeDisplay');
    this.totalTimeDisplay = document.getElementById('totalTimeDisplay');
    this.frameInfo = document.getElementById('frameInfo');
    this.frameInfoSeparator = document.querySelector('.frame-info-separator');
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
    if (path.startsWith('NDI:')) {
      return path.substring(4);
    }
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
    const imagePath = this.mediaManager ? this.mediaManager.getCurrentImagePath() : null;
    const fileName = this.getFileName(file ? file.name : (imagePath || ''));
    const metadata = this.getImageMetadata(file, this.overlayImage);
    
    // Update the main fileNameDisplay with just the filename (no metadata)
    if (this.fileNameDisplay) {
      this.fileNameDisplay.textContent = fileName;
    }
    
    // Hide frame count and separator for still images
    if (this.frameCountDisplay) {
      this.frameCountDisplay.style.display = 'none';
    }
    if (this.frameInfoSeparator) {
      this.frameInfoSeparator.style.display = 'none';
    }
    
    // Keep stillInfo for backwards compatibility but hide it
    if (this.stillFileNameDisplay) {
      this.stillFileNameDisplay.textContent = `${fileName} (${metadata.bitDepth}, ${metadata.colorspace})`;
    }
    if (this.stillInfo) {
      this.stillInfo.classList.remove('active');
    }
    
    // Show frameInfo (which now contains just the filename) if checkbox is checked
    if (this.frameInfo) {
      if (this.showFileInfoCheckbox && this.showFileInfoCheckbox.checked) {
        this.frameInfo.classList.add('active');
      } else {
        this.frameInfo.classList.remove('active');
      }
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
    const isNDI = videoPath && videoPath.startsWith('NDI:');
    const fileName = this.getFileName(videoPath);
    const codec = isNDI ? '' : this.getVideoCodec(video, videoPath);
    
    if (!video || !isFinite(video.duration) || video.duration === 0) {
      if (this.frameCountDisplay) {
        if (isNDI) {
          // Hide frame count for NDI streams
          this.frameCountDisplay.style.display = 'none';
        } else {
          // Show frame count for regular videos/images
          this.frameCountDisplay.style.display = '';
          this.frameCountDisplay.textContent = 'Frame: 0 / 0';
        }
      }
      // Hide/show separator based on NDI
      if (this.frameInfoSeparator) {
        this.frameInfoSeparator.style.display = isNDI ? 'none' : '';
      }
      if (this.frameInfo) {
        if (this.showFileInfoCheckbox && this.showFileInfoCheckbox.checked) {
          this.frameInfo.classList.add('active');
        } else {
          this.frameInfo.classList.remove('active');
        }
      }
      if (this.fileNameDisplay) {
        if (isNDI) {
          this.fileNameDisplay.textContent = 'NDI STREAM';
        } else {
          const suffix = codec ? ` (${codec})` : '';
          this.fileNameDisplay.textContent = fileName ? `${fileName}${suffix}` : '';
        }
      }
      if (this.timeDisplay) {
        if (isNDI) {
          this.timeDisplay.style.display = 'none';
        } else {
          this.timeDisplay.style.display = '';
          this.timeDisplay.textContent = '00:00';
        }
      }
      if (this.totalTimeDisplay) {
        if (isNDI) {
          this.totalTimeDisplay.style.display = 'none';
        } else {
          this.totalTimeDisplay.style.display = '';
          this.totalTimeDisplay.textContent = '00:00';
        }
      }
      return;
    }
    
    const currentTime = video.currentTime || 0;
    const duration = video.duration;
    const frameRate = this.mediaManager ? this.mediaManager.getVideoFrameRate() : 30;
    const currentFrame = Math.floor(currentTime * frameRate);
    const totalFrames = Math.floor(duration * frameRate);
    
    // Update filename display with codec info
    if (this.fileNameDisplay) {
      if (isNDI) {
        this.fileNameDisplay.textContent = 'NDI STREAM';
      } else {
        const suffix = codec ? ` (${codec})` : '';
        this.fileNameDisplay.textContent = `${fileName}${suffix}`;
      }
    }
    
    if (this.frameInfo) {
      if (this.frameCountDisplay) {
        if (isNDI) {
          // Hide frame count for NDI streams
          this.frameCountDisplay.style.display = 'none';
        } else {
          // Show frame count for regular videos
          this.frameCountDisplay.style.display = '';
          this.frameCountDisplay.textContent = `Frame: ${currentFrame} / ${totalFrames}`;
        }
      }
      // Hide/show separator based on NDI
      if (this.frameInfoSeparator) {
        this.frameInfoSeparator.style.display = isNDI ? 'none' : '';
      }
      if (this.showFileInfoCheckbox && this.showFileInfoCheckbox.checked) {
        this.frameInfo.classList.add('active');
      } else {
        this.frameInfo.classList.remove('active');
      }
    }
    
    // Update current time display (format as mm:ss)
    if (this.timeDisplay) {
      if (isNDI) {
        // Hide time display for NDI streams
        this.timeDisplay.style.display = 'none';
      } else {
        // Show time display for regular videos
        this.timeDisplay.style.display = '';
        this.timeDisplay.textContent = this.formatTime(currentTime);
      }
    }
    
    // Update total time display (format as mm:ss)
    if (this.totalTimeDisplay) {
      if (isNDI) {
        // Hide total time display for NDI streams
        this.totalTimeDisplay.style.display = 'none';
      } else {
        // Show total time display for regular videos
        this.totalTimeDisplay.style.display = '';
        this.totalTimeDisplay.textContent = this.formatTime(duration);
      }
    }
    
    // Update timeline slider (only if not currently seeking)
    if (timelineSlider && !isSeeking && duration > 0) {
      const percentage = (currentTime / duration) * 100;
      timelineSlider.value = percentage;
    }
  }

  /**
   * Update filename display for NDI streams or other manual cases
   * @param {string|null} streamName
   */
  setNDIStreamName(streamName) {
    if (this.fileNameDisplay) {
      this.fileNameDisplay.textContent = streamName ? 'NDI STREAM' : '';
    }
    if (this.frameCountDisplay) {
      this.frameCountDisplay.textContent = streamName ? 'Frame: --' : 'Frame: 0 / 0';
    }
    // Hide separator for NDI
    if (this.frameInfoSeparator) {
      this.frameInfoSeparator.style.display = streamName ? 'none' : '';
    }
    if (this.frameInfo) {
      if (streamName && this.showFileInfoCheckbox && this.showFileInfoCheckbox.checked) {
        this.frameInfo.classList.add('active');
      } else {
        this.frameInfo.classList.remove('active');
      }
    }
  }

  /**
   * Update filename display with NDI camera device name
   * @param {string|null} cameraName
   */
  setNDICameraName(cameraName) {
    if (this.fileNameDisplay) {
      this.fileNameDisplay.textContent = cameraName ? 'NDI STREAM' : '';
    }
    // Hide frame count for NDI
    if (this.frameCountDisplay) {
      this.frameCountDisplay.style.display = 'none';
    }
    // Hide separator for NDI
    if (this.frameInfoSeparator) {
      this.frameInfoSeparator.style.display = 'none';
    }
    // Hide time displays for NDI (live stream, no duration)
    if (this.timeDisplay) {
      this.timeDisplay.style.display = 'none';
    }
    if (this.totalTimeDisplay) {
      this.totalTimeDisplay.style.display = 'none';
    }
    if (this.frameInfo && this.showFileInfoCheckbox && this.showFileInfoCheckbox.checked) {
      if (cameraName) {
        this.frameInfo.classList.add('active');
      } else {
        this.frameInfo.classList.remove('active');
      }
    }
  }
}



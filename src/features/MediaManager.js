/**
 * Media Manager
 * Handles loading and management of videos, images, and NDI streams
 */

import * as THREE from 'three';
import { getElement } from '../utils/domUtils.js';

export class MediaManager {
  constructor(options) {
    this.material = options.material;
    this.ledsGroup = options.ledsGroup;
    this.updateLEDShaders = options.updateLEDShaders;
    this.overlayVideo = options.overlayVideo;
    this.overlayImage = options.overlayImage;
    this.mapping = options.mapping;
    this.frameInfo = options.frameInfo;
    this.stillInfo = options.stillInfo;
    this.timelineContainer = options.timelineContainer;
    this.timelineSlider = options.timelineSlider;
    this.textureStatus = options.textureStatus;
    this.showMappingCheckbox = options.showMappingCheckbox;
    this.showFileInfoCheckbox = options.showFileInfoCheckbox;
    this.playbackControls = options.playbackControls;
    this.updateFrameInfo = options.updateFrameInfo;
    this.updatePlaybackButtons = options.updatePlaybackButtons;
    this.updatePlayPauseButton = options.updatePlayPauseButton;
    this.updateMuteButton = options.updateMuteButton;
    this.updateStillInfo = options.updateStillInfo;
    this.videoAssetSelect = options.videoAssetSelect;
    this.adjustMappingAspectRatioCallback = options.adjustMappingAspectRatio;
    
    // OverlayManager reference (set after initialization)
    this.overlayManager = null;
    
    // FileInfoManager reference (set after initialization)
    this.fileInfoManager = null;
    
    // State
    this.currentVideoElement = null;
    this.currentVideoPath = null;
    this.currentImagePath = null;
    this.videoFrameRate = 30;
    this.ndiWebSocket = null;
    this.frameCanvas = null;
    this.frameContext = null;
    this.canvasTexture = null;
    this.ndiStreamWindows = new Map();
    this.currentNDIStream = null; // MediaStream from getUserMedia
    this.currentNDICameraName = null; // Virtual camera device name for NDI
    
    // Default video path
    this.DEFAULT_VIDEO_PATH = '/assets/videos/shG010_Eva_v12_55FP.mp4';
  }
  
  /**
   * Adjust mapping overlay to match aspect ratio
   * Delegates to OverlayManager if available, otherwise uses callback
   */
  adjustMappingAspectRatio(width, height) {
    if (this.overlayManager) {
      this.overlayManager.adjustMappingAspectRatio(width, height);
    } else if (this.adjustMappingAspectRatioCallback && typeof this.adjustMappingAspectRatioCallback === 'function') {
      this.adjustMappingAspectRatioCallback(width, height);
    }
  }
  
  /**
   * Parse MP4 header to extract frame rate
   */
  async parseMP4FrameRate(file) {
    if (!file || !file.name.toLowerCase().endsWith('.mp4')) {
      return null;
    }
    
    try {
      const chunkSize = 64 * 1024;
      const blob = file.slice(0, chunkSize);
      const arrayBuffer = await blob.arrayBuffer();
      const view = new DataView(arrayBuffer);
      
      let offset = 0;
      const maxOffset = Math.min(arrayBuffer.byteLength, chunkSize);
      
      while (offset < maxOffset - 8) {
        const size = view.getUint32(offset);
        const type = String.fromCharCode(
          view.getUint8(offset + 4),
          view.getUint8(offset + 5),
          view.getUint8(offset + 6),
          view.getUint8(offset + 7)
        );
        
        if (type === 'moov') {
          const moovSize = size;
          const moovEnd = offset + moovSize;
          let moovOffset = offset + 8;
          
          while (moovOffset < moovEnd - 8) {
            const atomSize = view.getUint32(moovOffset);
            const atomType = String.fromCharCode(
              view.getUint8(moovOffset + 4),
              view.getUint8(moovOffset + 5),
              view.getUint8(moovOffset + 6),
              view.getUint8(moovOffset + 7)
            );
            
            if (atomType === 'mvhd') {
              const version = view.getUint8(moovOffset + 8);
              let timescaleOffset, durationOffset;
              
              if (version === 1) {
                timescaleOffset = moovOffset + 20;
                durationOffset = moovOffset + 28;
              } else {
                timescaleOffset = moovOffset + 12;
                durationOffset = moovOffset + 16;
              }
              
              const timescale = view.getUint32(timescaleOffset, false);
              let duration;
              
              if (version === 1) {
                const durationHigh = view.getUint32(durationOffset, false);
                const durationLow = view.getUint32(durationOffset + 4, false);
                duration = (durationHigh * 0x100000000) + durationLow;
              } else {
                duration = view.getUint32(durationOffset, false);
              }
              
              if (timescale > 0 && duration > 0) {
                const fps = timescale / duration;
                if (fps > 0 && fps <= 120) {
                  return Math.round(fps);
                }
              }
            }
            
            moovOffset += atomSize;
            if (atomSize === 0) break;
          }
        }
        
        offset += size;
        if (size === 0) break;
      }
    } catch (error) {
      console.error('Error parsing MP4 frame rate:', error);
    }
    
    return null;
  }
  
  /**
   * Detect frame rate from server
   */
  async detectFrameRateFromServer(videoPath) {
    try {
      const response = await fetch(`/api/video/framerate?videoPath=${encodeURIComponent(videoPath)}`);
      
      if (!response.ok) {
        console.warn('Server frame rate detection failed:', response.status, response.statusText);
        return null;
      }
      
      const data = await response.json();
      if (data.fps && data.fps > 0 && data.fps <= 120) {
        return Math.round(data.fps);
      }
      
      return null;
    } catch (error) {
      console.warn('Error fetching frame rate from server:', error);
      return null;
    }
  }
  
  /**
   * Detect video frame rate
   */
  async detectVideoFrameRate(videoElement, file = null, videoPath = null) {
    if (videoPath) {
      const serverFps = await this.detectFrameRateFromServer(videoPath);
      if (serverFps) {
        return serverFps;
      }
    }
    
    if (file) {
      const headerFps = await this.parseMP4FrameRate(file);
      if (headerFps) {
        return headerFps;
      }
    }
    
    if (!videoElement) {
      return null;
    }
    
    try {
      if (videoElement.webkitDecodedFrameCount !== undefined && videoElement.duration) {
        const frameCount = videoElement.webkitDecodedFrameCount;
        const duration = videoElement.duration;
        if (frameCount > 0 && duration > 0) {
          const calculatedFps = Math.round(frameCount / duration);
          if (calculatedFps > 0 && calculatedFps <= 120) {
            return calculatedFps;
          }
        }
      }
    } catch (e) {
      // Ignore errors
    }
    
    return null;
  }
  
  /**
   * Clean up previous video element
   */
  cleanupPreviousVideo() {
    if (this.currentVideoElement) {
      this.currentVideoElement.pause();
      
      // Stop MediaStream tracks if using camera access
      if (this.currentVideoElement.srcObject) {
        const stream = this.currentVideoElement.srcObject;
        stream.getTracks().forEach(track => track.stop());
        this.currentVideoElement.srcObject = null;
      } else {
        this.currentVideoElement.src = '';
        this.currentVideoElement.load();
      }
      
      this.currentVideoElement = null;
      
      // Clean up stored stream reference
      if (this.currentNDIStream) {
        this.currentNDIStream.getTracks().forEach(track => track.stop());
        this.currentNDIStream = null;
      }
      
      if (this.updatePlaybackButtons) {
        this.updatePlaybackButtons();
      }
    }
  }
  
  /**
   * Hide overlays and info displays
   */
  hideOverlays() {
    if (this.mapping) this.mapping.classList.remove('active');
    if (this.frameInfo) this.frameInfo.classList.remove('active');
    if (this.stillInfo) this.stillInfo.classList.remove('active');
    if (this.timelineContainer) this.timelineContainer.classList.remove('active');
    if (this.overlayVideo) this.overlayVideo.src = '';
    if (this.overlayImage) this.overlayImage.src = '';
    
    if (this.playbackControls && this.playbackControls.playbackMenu) {
      this.playbackControls.playbackMenu.style.display = 'none';
    }
  }
  
  /**
   * Create and configure video texture
   */
  createVideoTexture(video) {
    const videoTexture = new THREE.VideoTexture(video);
    videoTexture.wrapS = THREE.RepeatWrapping;
    videoTexture.wrapT = THREE.RepeatWrapping;
    videoTexture.minFilter = THREE.LinearFilter;
    videoTexture.magFilter = THREE.LinearFilter;
    videoTexture.colorSpace = THREE.SRGBColorSpace;
    videoTexture.flipY = true;
    // VideoTexture automatically updates, but ensure it's set up correctly
    videoTexture.needsUpdate = true;
    
    // Add an update loop to force texture updates and log status
    const debugUpdate = () => {
      if (video.readyState >= 2 && !video.paused) { // HAVE_CURRENT_DATA
        // Only log occasionally to avoid spam
        if (Math.random() < 0.01) {
          console.log('Video texture active:', {
            width: video.videoWidth,
            height: video.videoHeight,
            time: video.currentTime,
            readyState: video.readyState
          });
        }
      } else {
        // Warning if video stalls
        if (Math.random() < 0.05) {
          console.warn('Video texture stalled:', {
            paused: video.paused,
            readyState: video.readyState,
            error: video.error
          });
        }
      }
      requestAnimationFrame(debugUpdate);
    };
    debugUpdate();

    console.log('Created video texture from video element:', {
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight,
      playing: !video.paused,
      readyState: video.readyState
    });
    return videoTexture;
  }
  
  /**
   * Setup video element with common configuration
   */
  setupVideoElement(video, videoUrl) {
    video.src = videoUrl;
    video.crossOrigin = 'anonymous';
    video.loop = true;
    video.muted = true;
    video.volume = 1.0;
    video.playsInline = true;
    video.preload = 'auto';
  }
  
  /**
   * Handle video loaded event
   */
  handleVideoLoaded(video, videoUrl, videoPath, fileName) {
    this.videoFrameRate = 30; // Default
    
    // Create video texture
    const videoTexture = this.createVideoTexture(video);
    
    // Apply texture to shader material
    this.material.uniforms.uTexture.value = videoTexture;
    this.material.uniforms.uHasTexture.value = 1.0;
    this.material.uniforms.uIsImageTexture.value = 0.0;
    this.material.needsUpdate = true;
    
    // Update LED shaders
    if (this.updateLEDShaders) {
      this.updateLEDShaders(this.ledsGroup, this.material);
    }
    
    // Setup overlay video
    if (this.overlayVideo) {
      this.overlayVideo.src = videoUrl;
      this.overlayVideo.crossOrigin = 'anonymous';
      this.overlayVideo.loop = true;
      this.overlayVideo.muted = true;
      this.overlayVideo.playsInline = true;
      this.overlayVideo.style.display = 'block';
    }
    if (this.overlayImage) {
      this.overlayImage.style.display = 'none';
    }
    
    // Adjust aspect ratio
    const handleVideoMetadata = () => {
      if (video.videoWidth && video.videoHeight) {
        this.adjustMappingAspectRatio(video.videoWidth, video.videoHeight);
      }
    };
    video.addEventListener('loadedmetadata', handleVideoMetadata);
    if (video.readyState >= 1 && video.videoWidth && video.videoHeight) {
      this.adjustMappingAspectRatio(video.videoWidth, video.videoHeight);
    }
    
    // Sync overlay video
    const syncOverlay = () => {
      if (video.readyState >= 2 && this.overlayVideo) {
        this.overlayVideo.currentTime = video.currentTime;
        if (this.updateFrameInfo) {
          this.updateFrameInfo(video);
        }
      }
    };
    video.addEventListener('timeupdate', syncOverlay);
    
    // Show UI elements
    if (this.showMappingCheckbox && this.showMappingCheckbox.checked && this.mapping) {
      this.mapping.classList.add('active');
    }
    if (this.showFileInfoCheckbox && this.showFileInfoCheckbox.checked && this.frameInfo) {
      this.frameInfo.classList.add('active');
    }
    if (this.stillInfo) this.stillInfo.classList.remove('active');
    if (this.timelineContainer) this.timelineContainer.classList.add('active');
    
    if (this.playbackControls && this.playbackControls.playbackMenu) {
      this.playbackControls.playbackMenu.style.display = 'block';
    }
    
    if (isFinite(video.duration) && video.duration > 0 && this.timelineSlider) {
      this.timelineSlider.max = 100;
    }
    
    if (this.updateFrameInfo) {
      this.updateFrameInfo(video);
    }
    
    // Play videos
    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.then(() => {
        if (this.overlayVideo) {
          this.overlayVideo.play().catch(err => {
            console.error('Error playing overlay video:', err);
          });
        }
        if (this.updatePlayPauseButton) this.updatePlayPauseButton();
        if (this.updateMuteButton) this.updateMuteButton();
      }).catch(err => {
        console.error('Error playing video:', err);
        if (this.updatePlayPauseButton) this.updatePlayPauseButton();
        if (this.updateMuteButton) this.updateMuteButton();
      });
    }
    
    this.currentVideoElement = video;
    
    // Update playback controls
    if (this.playbackControls) {
      this.playbackControls.setVideoElement(video, this.overlayVideo);
      this.playbackControls.setFrameRate(this.videoFrameRate);
    }
    
    // Update status
    if (this.textureStatus) {
      this.textureStatus.textContent = fileName || videoPath;
      this.textureStatus.classList.add('loaded');
    }
    
    // Update video asset dropdown
    if (this.videoAssetSelect && videoPath && videoPath.startsWith('/assets/videos/')) {
      this.videoAssetSelect.value = videoPath;
    }
    
    if (this.updatePlaybackButtons) {
      this.updatePlaybackButtons();
    }
  }
  
  /**
   * Load video from path
   */
  loadVideoFromPath(videoPath) {
    this.currentVideoPath = videoPath;
    this.currentImagePath = null;
    
    if (this.stillInfo) this.stillInfo.classList.remove('active');
    
    this.cleanupPreviousVideo();
    this.hideOverlays();
    
    // Determine video URL
    let videoUrl;
    if (videoPath.startsWith('/assets/videos/')) {
      videoUrl = videoPath;
    } else if (videoPath === this.DEFAULT_VIDEO_PATH) {
      videoUrl = '/assets/videos/shG010_Eva_v12_55FP.mp4';
    } else {
      videoUrl = 'file:///' + videoPath.replace(/\\/g, '/');
    }
    
    // Create video element
    const video = document.createElement('video');
    this.setupVideoElement(video, videoUrl);
    
    console.log('Loading video from URL:', videoUrl);
    
    // Add event listeners
    video.addEventListener('loadedmetadata', () => {
      if (video.videoWidth && video.videoHeight) {
        this.adjustMappingAspectRatio(video.videoWidth, video.videoHeight);
      }
    });
    
    video.addEventListener('loadeddata', () => {
      const fileName = videoPath.split('\\').pop() || videoPath.split('/').pop();
      this.handleVideoLoaded(video, videoUrl, videoPath, fileName);
    });
    
    video.addEventListener('error', (error) => {
      console.error('Video loading error:', error);
      if (this.textureStatus) {
        const errorMsg = video.error ? `${video.error.code}: ${video.error.message || 'Unknown error'}` : 'Unknown error';
        this.textureStatus.textContent = `Error loading video: ${errorMsg} (URL: ${videoUrl})`;
        this.textureStatus.classList.remove('loaded');
      }
      if (this.playbackControls && this.playbackControls.playbackMenu) {
        this.playbackControls.playbackMenu.style.display = 'block';
      }
    });
    
    video.load();
  }
  
  /**
   * Load video from file
   */
  loadVideoFromFile(file) {
    this.currentVideoPath = file.name;
    
    if (this.videoAssetSelect) {
      this.videoAssetSelect.value = '';
    }
    
    this.cleanupPreviousVideo();
    this.hideOverlays();
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const videoUrl = event.target.result;
      const video = document.createElement('video');
      this.setupVideoElement(video, videoUrl);
      
      video.addEventListener('loadeddata', () => {
        this.handleVideoLoaded(video, videoUrl, file.name, file.name);
        
        if (this.videoAssetSelect) {
          this.videoAssetSelect.value = '';
        }
      });
      
      video.addEventListener('error', (error) => {
        if (this.textureStatus) {
          this.textureStatus.textContent = 'Error loading video';
          this.textureStatus.classList.remove('loaded');
        }
        console.error('Error loading video:', error);
      });
      
      video.load();
    };
    
    reader.onerror = () => {
      if (this.textureStatus) {
        this.textureStatus.textContent = 'Error reading file';
        this.textureStatus.classList.remove('loaded');
      }
    };
    
    reader.readAsDataURL(file);
  }
  
  /**
   * Load image from file
   */
  loadImageFromFile(file) {
    this.currentImagePath = file.name;
    this.currentVideoPath = null;
    
    if (this.videoAssetSelect) {
      this.videoAssetSelect.value = '';
    }
    
    this.cleanupPreviousVideo();
    this.hideOverlays();
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const imageUrl = event.target.result;
      const loader = new THREE.TextureLoader();
      
      loader.load(
        imageUrl,
        (texture) => {
          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.RepeatWrapping;
          texture.minFilter = THREE.LinearFilter;
          texture.magFilter = THREE.LinearFilter;
          
          this.material.uniforms.uTexture.value = texture;
          this.material.uniforms.uHasTexture.value = 1.0;
          this.material.uniforms.uIsImageTexture.value = 1.0;
          
          if (this.updateLEDShaders) {
            this.updateLEDShaders(this.ledsGroup, this.material);
          }
          
          if (this.overlayImage) {
            this.overlayImage.src = imageUrl;
            this.overlayImage.style.display = 'block';
            this.overlayImage.onload = () => {
              if (this.overlayImage.naturalWidth && this.overlayImage.naturalHeight) {
                this.adjustMappingAspectRatio(this.overlayImage.naturalWidth, this.overlayImage.naturalHeight);
              }
            };
          }
          if (this.overlayVideo) {
            this.overlayVideo.style.display = 'none';
          }
          
          if (this.frameInfo) this.frameInfo.classList.remove('active');
          if (this.timelineContainer) this.timelineContainer.classList.remove('active');
          
          if (this.updateStillInfo) {
            this.updateStillInfo(file);
          }
          
          if (this.playbackControls && this.playbackControls.playbackMenu) {
            this.playbackControls.playbackMenu.style.display = 'none';
          }
          
          if (this.showMappingCheckbox && this.showMappingCheckbox.checked && this.mapping) {
            this.mapping.classList.add('active');
          }
          
          if (this.updatePlaybackButtons) {
            this.updatePlaybackButtons();
          }
          
          if (this.textureStatus) {
            this.textureStatus.textContent = `Loaded: ${file.name}`;
            this.textureStatus.classList.add('loaded');
          }
        },
        undefined,
        (error) => {
          if (this.textureStatus) {
            this.textureStatus.textContent = 'Error loading texture';
            this.textureStatus.classList.remove('loaded');
          }
          console.error('Error loading texture:', error);
        }
      );
    };
    
    reader.onerror = () => {
      if (this.textureStatus) {
        this.textureStatus.textContent = 'Error reading file';
        this.textureStatus.classList.remove('loaded');
      }
    };
    
    reader.readAsDataURL(file);
  }
  
  /**
   * Load NDI stream
   * Uses NDI Webcam Input (via browser getUserMedia) for lowest latency
   * Falls back to WebSocket method if direct camera access fails
   */
  async loadNDIStream(streamName) {
    if (this.frameInfo) this.frameInfo.classList.remove('active');
    if (this.stillInfo) this.stillInfo.classList.remove('active');
    this.currentImagePath = null;
    this.currentVideoPath = `NDI:${streamName}`;
    
    // Clean up previous video
    this.cleanupPreviousVideo();
    
    // Dispose old texture
    const oldTexture = this.material.uniforms.uTexture.value;
    if (oldTexture) {
      if (oldTexture instanceof THREE.VideoTexture || oldTexture instanceof THREE.CanvasTexture) {
        oldTexture.dispose();
      }
    }
    
    // Close WebSocket if open
    if (this.ndiWebSocket) {
      this.ndiWebSocket.send(JSON.stringify({ type: 'disconnect' }));
      this.ndiWebSocket.close();
      this.ndiWebSocket = null;
    }
    
    // Clear texture
    this.material.uniforms.uTexture.value = null;
    this.material.uniforms.uHasTexture.value = 0.0;
    if (this.updateLEDShaders) {
      this.updateLEDShaders(this.ledsGroup, this.material);
    }
    this.material.needsUpdate = true;
    
    this.hideOverlays();
    
    if (this.textureStatus) {
      this.textureStatus.textContent = `Connecting to NDI stream: ${streamName}...`;
      this.textureStatus.classList.remove('loaded');
    }
    
    // Method 1: Try direct browser camera access (NDI Webcam Input)
    // This provides the lowest latency as it bypasses server encoding
    try {
      await this.loadNDIStreamViaCamera(streamName);
      return; // Success, exit early
    } catch (error) {
      console.log('Direct camera access failed, trying WebSocket fallback:', error.message);
    }
    
    // Method 2: Fallback to WebSocket method (server-side streaming)
    this.loadNDIStreamViaWebSocket(streamName);
  }
  
  /**
   * Load NDI stream via browser camera (NDI Webcam Input)
   * This is the recommended method for lowest latency
   */
  async loadNDIStreamViaCamera(streamName) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('getUserMedia not supported');
    }
    
    // Helper to get devices with permission check
    const getDevicesWithPermissions = async () => {
      let devices = await navigator.mediaDevices.enumerateDevices();
      let videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      // Check if labels are missing (permission needed)
      const needsPermission = videoDevices.some(d => !d.label);
      
      if (needsPermission) {
        console.log('Camera labels hidden, requesting temporary permission...');
        try {
          const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
          // Stop tracks immediately
          tempStream.getTracks().forEach(t => t.stop());
          
          // Enumerate again, now with labels
          devices = await navigator.mediaDevices.enumerateDevices();
          videoDevices = devices.filter(device => device.kind === 'videoinput');
        } catch (err) {
          console.error('Could not get camera permission:', err);
          throw err;
        }
      }
      return videoDevices;
    };

    // Get available video devices (handling permissions)
    const videoDevices = await getDevicesWithPermissions();
    
    console.log('Available video devices:', videoDevices.map(d => `${d.label} (${d.deviceId})`));
    
    // Look for a virtual camera device suitable for NDI/OBS
    // Common names: "NDI Video", "NDI Webcam Input", "OBS Virtual Camera", etc.
    const virtualCamDevice = videoDevices.find(device => {
      const label = (device.label || '').toLowerCase();
      return (
        label.includes('ndi') ||
        label.includes('webcam input') ||
        label.includes('obs') ||
        label.includes('virtual camera')
      );
    });
    
    if (!virtualCamDevice) {
      throw new Error('No NDI/OBS virtual camera found. Make sure OBS Virtual Camera or NDI Webcam Input is running and a source is selected.');
    }
    
    console.log('Using virtual camera device for NDI:', virtualCamDevice.label);
    
    // Store the camera device name for display
    this.currentNDICameraName = virtualCamDevice.label;
    
    // Request camera access with specific device
    const constraints = {
      video: {
        deviceId: { exact: virtualCamDevice.deviceId },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30 }
      }
    };
    
    console.log('Requesting user media with constraints:', constraints);
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    console.log('Stream obtained:', stream.id, 'active:', stream.active);
    stream.getTracks().forEach(t => console.log('Track:', t.kind, t.label, t.readyState));
    
    // Create video element from stream
    const video = document.createElement('video');
    video.srcObject = stream;
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.setAttribute('autoplay', '');
    video.setAttribute('muted', '');
    
    // Force play
    video.onloadedmetadata = () => {
        console.log('Video metadata loaded, attempting play()');
        video.play()
            .then(() => console.log('Video playing successfully'))
            .catch(e => console.error('Video play failed:', e));
    };
    
    // Wait for video to be ready and playing
    await new Promise((resolve, reject) => {
      const onLoadedMetadata = () => {
        if (video.videoWidth && video.videoHeight) {
          // Try to play the video
          const playPromise = video.play();
          if (playPromise !== undefined) {
            playPromise
              .then(() => {
                console.log('Video is playing, dimensions:', video.videoWidth, 'x', video.videoHeight);
                resolve();
              })
              .catch((playError) => {
                console.error('Error playing video:', playError);
                reject(new Error('Failed to play video: ' + playError.message));
              });
          } else {
            // Fallback for older browsers
            resolve();
          }
        } else {
          reject(new Error('Video metadata not available'));
        }
      };
      
      video.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
      video.addEventListener('error', (e) => {
        console.error('Video error event:', e);
        reject(new Error('Video error: ' + (video.error?.message || 'Unknown error')));
      }, { once: true });
      
      // If metadata is already loaded, trigger immediately
      if (video.readyState >= 1) {
        onLoadedMetadata();
      }
      
      // Timeout after 10 seconds
      setTimeout(() => reject(new Error('Video load timeout')), 10000);
    });
    
    if (video.error) {
      throw new Error('Video element has error before texture creation: ' + video.error.message + ' (code ' + video.error.code + ')');
    }

    // Create video texture
    const videoTexture = this.createVideoTexture(video);
    // Ensure texture updates continuously
    videoTexture.needsUpdate = true;
    
    // Apply texture to shader material
    this.material.uniforms.uTexture.value = videoTexture;
    this.material.uniforms.uHasTexture.value = 1.0;
    this.material.uniforms.uIsImageTexture.value = 0.0;
    this.material.needsUpdate = true;
    
    // Update LED shaders
    if (this.updateLEDShaders) {
      this.updateLEDShaders(this.ledsGroup, this.material);
    }
    
    // Setup overlay video (use same stream, don't clone)
    if (this.overlayVideo) {
      this.overlayVideo.srcObject = stream;
      this.overlayVideo.autoplay = true;
      this.overlayVideo.muted = true;
      this.overlayVideo.playsInline = true;
      this.overlayVideo.setAttribute('playsinline', '');
      this.overlayVideo.style.display = 'block';
      // Ensure overlay video plays
      this.overlayVideo.play().catch(err => {
        console.warn('Overlay video play error:', err);
      });
    }
    if (this.overlayImage) {
      this.overlayImage.style.display = 'none';
    }
    
    // Adjust aspect ratio
    if (video.videoWidth && video.videoHeight) {
      this.adjustMappingAspectRatio(video.videoWidth, video.videoHeight);
    }
    
    // Show UI elements
    if (this.showMappingCheckbox && this.showMappingCheckbox.checked && this.mapping) {
      this.mapping.classList.add('active');
    }
    if (this.showFileInfoCheckbox && this.showFileInfoCheckbox.checked && this.frameInfo) {
      this.frameInfo.classList.add('active');
    }
    if (this.stillInfo) this.stillInfo.classList.remove('active');
    if (this.timelineContainer) this.timelineContainer.classList.add('active');
    
    if (this.playbackControls && this.playbackControls.playbackMenu) {
      this.playbackControls.playbackMenu.style.display = 'block';
    }
    
    // Verify video is actually playing
    if (video.paused) {
      console.warn('Video is paused, attempting to play...');
      await video.play().catch(err => {
        console.error('Failed to play video after setup:', err);
        throw new Error('Video failed to play: ' + err.message);
      });
    }
    
    // Store video element and stream
    this.currentVideoElement = video;
    this.currentNDIStream = stream;
    
    // Update status
    if (this.textureStatus) {
      this.textureStatus.textContent = `Loaded NDI Stream (Direct): ${streamName}`;
      this.textureStatus.classList.add('loaded');
    }
    
    // Update file info with camera name instead of stream name
    if (this.fileInfoManager) {
      this.fileInfoManager.setNDICameraName(this.currentNDICameraName);
    }
    
    if (this.updatePlaybackButtons) {
      this.updatePlaybackButtons();
    }
    
    console.log('NDI stream loaded via direct camera access:', streamName, {
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight,
      playing: !video.paused,
      readyState: video.readyState,
      cameraName: this.currentNDICameraName
    });
  }
  
  /**
   * Load NDI stream via WebSocket (fallback method)
   * Uses server-side FFmpeg to stream frames
   */
  loadNDIStreamViaWebSocket(streamName) {
    if (this.textureStatus) {
      this.textureStatus.textContent = `Connecting via server: ${streamName}...`;
      this.textureStatus.classList.remove('loaded');
    }
    
    // Create canvas
    if (!this.frameCanvas) {
      this.frameCanvas = document.createElement('canvas');
      this.frameCanvas.width = 1920;
      this.frameCanvas.height = 1080;
      this.frameContext = this.frameCanvas.getContext('2d');
    }
    
    // Create canvas texture
    this.canvasTexture = new THREE.CanvasTexture(this.frameCanvas);
    this.canvasTexture.wrapS = THREE.RepeatWrapping;
    this.canvasTexture.wrapT = THREE.RepeatWrapping;
    this.canvasTexture.minFilter = THREE.LinearFilter;
    this.canvasTexture.magFilter = THREE.LinearFilter;
    this.canvasTexture.colorSpace = THREE.SRGBColorSpace;
    
    // Connect WebSocket
    const wsUrl = 'ws://localhost:8080/ndi/ws';
    this.ndiWebSocket = new WebSocket(wsUrl);
    
    this.ndiWebSocket.onopen = () => {
      console.log('WebSocket connected, requesting stream:', streamName);
      this.ndiWebSocket.send(JSON.stringify({
        type: 'connect',
        streamName: streamName
      }));
      if (this.textureStatus) {
        this.textureStatus.textContent = `Connected to ${streamName}, receiving frames...`;
      }
    };
    
    this.ndiWebSocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'frame') {
          const img = new Image();
          img.onload = () => {
            this.frameContext.drawImage(img, 0, 0, this.frameCanvas.width, this.frameCanvas.height);
            this.canvasTexture.needsUpdate = true;
            
            if (this.material.uniforms.uTexture.value !== this.canvasTexture) {
              this.material.uniforms.uTexture.value = this.canvasTexture;
              this.material.uniforms.uHasTexture.value = 1.0;
              this.material.uniforms.uIsImageTexture.value = 0.0;
              
              if (this.updateLEDShaders) {
                this.updateLEDShaders(this.ledsGroup, this.material);
              }
              this.material.needsUpdate = true;
            }
            
            if (this.textureStatus && !this.textureStatus.classList.contains('loaded')) {
              this.textureStatus.textContent = `Loaded NDI Stream (Server): ${streamName}`;
              this.textureStatus.classList.add('loaded');
            }
            if (this.updatePlaybackButtons) {
              this.updatePlaybackButtons();
            }
          };
          img.onerror = (err) => {
            console.error('Error loading frame image:', err);
          };
          img.src = 'data:image/jpeg;base64,' + data.data;
        } else if (data.type === 'error') {
          console.error('WebSocket error:', data.message);
          if (this.textureStatus) {
            this.textureStatus.textContent = `Error: ${data.message}`;
            this.textureStatus.classList.remove('loaded');
          }
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    this.ndiWebSocket.onerror = (error) => {
      console.error('WebSocket error:', error);
      if (this.textureStatus) {
        this.textureStatus.textContent = 'Error: WebSocket connection failed';
        this.textureStatus.classList.remove('loaded');
      }
    };
    
    this.ndiWebSocket.onclose = () => {
      console.log('WebSocket closed');
      this.ndiWebSocket = null;
    };
  }
  
  /**
   * Get current video element
   */
  getCurrentVideoElement() {
    return this.currentVideoElement;
  }
  
  /**
   * Get current video path
   */
  getCurrentVideoPath() {
    return this.currentVideoPath;
  }
  
  /**
   * Get current image path
   */
  getCurrentImagePath() {
    return this.currentImagePath;
  }
  
  /**
   * Get video frame rate
   */
  getVideoFrameRate() {
    return this.videoFrameRate;
  }
  
  /**
   * Set video frame rate
   */
  setVideoFrameRate(fps) {
    this.videoFrameRate = fps;
  }
}

/**
 * Playback Controls
 * Manages video playback controls (play, pause, seek, volume, etc.)
 */

export class PlaybackControls {
  constructor(videoElement, overlayVideo, frameRate, updateFrameInfo) {
    this.videoElement = videoElement;
    this.overlayVideo = overlayVideo;
    this.frameRate = frameRate;
    this.updateFrameInfo = updateFrameInfo;
    
    // DOM Elements (will be set in init)
    this.playPauseBtn = null;
    this.jumpToStartBtn = null;
    this.rewindBtn = null;
    this.jumpToEndBtn = null;
    this.prevFrameBtn = null;
    this.nextFrameBtn = null;
    this.muteBtn = null;
    this.volumeSlider = null;
    this.playbackMenu = null;
    
    // Constants
    this.TIME_JUMP_AMOUNT = 10; // Jump amount in seconds
    
    // Icons
    this.icons = {
      play: '<span class="material-icons">play_arrow</span>',
      pause: '<span class="material-icons">pause</span>',
      rewind: '<span class="material-icons">replay_10</span>',
      forward: '<span class="material-icons">forward_10</span>',
      unmuted: '<span class="material-icons">volume_up</span>',
      muted: '<span class="material-icons">volume_off</span>'
    };
  }
  
  // Update video element reference
  setVideoElement(videoElement, overlayVideo) {
    this.videoElement = videoElement;
    this.overlayVideo = overlayVideo;
    this.setEnabled(!!videoElement);
  }
  
  // Update frame rate
  setFrameRate(frameRate) {
    this.frameRate = frameRate;
  }
  
  // Update play/pause button icon
  updatePlayPauseIcon() {
    if (!this.playPauseBtn) return;
    if (!this.videoElement) {
      this.playPauseBtn.innerHTML = this.icons.play;
      return;
    }
    this.playPauseBtn.innerHTML = this.videoElement.paused ? this.icons.play : this.icons.pause;
  }
  
  // Update mute button icon
  updateMuteIcon() {
    if (!this.muteBtn) return;
    if (!this.videoElement) {
      this.muteBtn.innerHTML = this.icons.unmuted;
      return;
    }
    this.muteBtn.innerHTML = this.videoElement.muted ? this.icons.muted : this.icons.unmuted;
  }
  
  // Toggle play/pause
  togglePlayPause() {
    if (!this.videoElement) return;
    
    if (this.videoElement.paused) {
      this.videoElement.play().catch(err => console.error('Error playing video:', err));
      if (this.overlayVideo) {
        this.overlayVideo.play().catch(err => console.error('Error playing overlay video:', err));
      }
    } else {
      this.videoElement.pause();
      if (this.overlayVideo) {
        this.overlayVideo.pause();
      }
    }
    this.updatePlayPauseIcon();
  }
  
  // Jump to beginning
  jumpToStart() {
    if (!this.videoElement) return;
    
    this.videoElement.currentTime = 0;
    if (this.overlayVideo) {
      this.overlayVideo.currentTime = 0;
    }
    if (this.updateFrameInfo) {
      this.updateFrameInfo(this.videoElement);
    }
  }
  
  // Jump by seconds (positive for forward, negative for backward)
  jumpSeconds(seconds) {
    if (!this.videoElement) return;
    
    const newTime = Math.max(0, Math.min(
      this.videoElement.duration || Infinity,
      this.videoElement.currentTime + seconds
    ));
    
    this.videoElement.currentTime = newTime;
    if (this.overlayVideo) {
      this.overlayVideo.currentTime = newTime;
    }
    if (this.updateFrameInfo) {
      this.updateFrameInfo(this.videoElement);
    }
  }
  
  // Jump by frames (converts to seconds)
  jumpFrames(frames) {
    if (!this.videoElement || !this.frameRate || this.frameRate <= 0) return;
    const timeOffset = frames / this.frameRate;
    this.jumpSeconds(timeOffset);
  }
  
  // Jump to previous frame
  jumpPreviousFrame() {
    if (!this.videoElement || !this.frameRate || this.frameRate <= 0) return;
    // Pause video if playing
    if (!this.videoElement.paused) {
      this.videoElement.pause();
      if (this.overlayVideo) {
        this.overlayVideo.pause();
      }
      this.updatePlayPauseIcon();
    }
    this.jumpFrames(-1);
  }
  
  // Jump to next frame
  jumpNextFrame() {
    if (!this.videoElement || !this.frameRate || this.frameRate <= 0) return;
    // Pause video if playing
    if (!this.videoElement.paused) {
      this.videoElement.pause();
      if (this.overlayVideo) {
        this.overlayVideo.pause();
      }
      this.updatePlayPauseIcon();
    }
    this.jumpFrames(1);
  }
  
  // Toggle mute
  toggleMute() {
    if (!this.videoElement) return;
    this.videoElement.muted = !this.videoElement.muted;
    this.updateMuteIcon();
  }
  
  // Update volume
  updateVolume(volume) {
    if (!this.videoElement) return;
    // Volume is 0-1, slider is 0-100
    this.videoElement.volume = volume / 100;
    // If volume is set above 0, unmute
    if (volume > 0 && this.videoElement.muted) {
      this.videoElement.muted = false;
      this.updateMuteIcon();
    }
    // If volume is set to 0, mute
    if (volume === 0 && !this.videoElement.muted) {
      this.videoElement.muted = true;
      this.updateMuteIcon();
    }
  }
  
  // Enable/disable all controls
  setEnabled(enabled) {
    if (!this.playPauseBtn || !this.jumpToStartBtn || !this.rewindBtn || !this.jumpToEndBtn || !this.muteBtn) {
      return;
    }
    
    this.playPauseBtn.disabled = !enabled;
    this.jumpToStartBtn.disabled = !enabled;
    this.rewindBtn.disabled = !enabled;
    this.jumpToEndBtn.disabled = !enabled;
    if (this.prevFrameBtn) {
      this.prevFrameBtn.disabled = !enabled;
    }
    if (this.nextFrameBtn) {
      this.nextFrameBtn.disabled = !enabled;
    }
    this.muteBtn.disabled = !enabled;
    if (this.volumeSlider) {
      this.volumeSlider.disabled = !enabled;
    }
    
    if (enabled && this.videoElement) {
      this.updatePlayPauseIcon();
      this.updateMuteIcon();
      // Set volume to 100% when video is enabled
      this.videoElement.volume = 1.0;
      if (this.volumeSlider) {
        this.volumeSlider.value = 100;
      }
    }
  }
  
  // Initialize event listeners
  init() {
    // Get DOM elements
    this.playPauseBtn = document.getElementById('playPauseBtn');
    this.jumpToStartBtn = document.getElementById('jumpToStartBtn');
    this.rewindBtn = document.getElementById('rewindBtn');
    this.jumpToEndBtn = document.getElementById('jumpToEndBtn');
    this.prevFrameBtn = document.getElementById('prevFrameBtn');
    this.nextFrameBtn = document.getElementById('nextFrameBtn');
    this.muteBtn = document.getElementById('muteBtn');
    this.volumeSlider = document.getElementById('volumeSlider');
    this.playbackMenu = document.getElementById('playbackMenu');
    
    // Check if elements exist
    if (!this.playPauseBtn || !this.jumpToStartBtn || !this.rewindBtn || !this.jumpToEndBtn || !this.muteBtn) {
      console.error('Playback control elements not found', {
        playPauseBtn: !!this.playPauseBtn,
        jumpToStartBtn: !!this.jumpToStartBtn,
        rewindBtn: !!this.rewindBtn,
        jumpToEndBtn: !!this.jumpToEndBtn,
        muteBtn: !!this.muteBtn
      });
      return;
    }
    
    // Bind event listeners with proper context
    this.playPauseBtn.addEventListener('click', (e) => {
      console.log('Play/Pause button clicked');
      this.togglePlayPause();
    }, true); // Use capture phase
    
    this.jumpToStartBtn.addEventListener('click', (e) => {
      console.log('Jump to start button clicked');
      this.jumpToStart();
    }, true);
    
    this.rewindBtn.addEventListener('click', (e) => {
      console.log('Rewind button clicked');
      this.jumpSeconds(-this.TIME_JUMP_AMOUNT);
    }, true);
    
    this.jumpToEndBtn.addEventListener('click', (e) => {
      console.log('Forward button clicked');
      this.jumpSeconds(this.TIME_JUMP_AMOUNT);
    }, true);
    
    // Frame navigation buttons
    if (this.prevFrameBtn) {
      this.prevFrameBtn.addEventListener('click', (e) => {
        console.log('Previous frame button clicked');
        this.jumpPreviousFrame();
      }, true);
    }
    
    if (this.nextFrameBtn) {
      this.nextFrameBtn.addEventListener('click', (e) => {
        console.log('Next frame button clicked');
        this.jumpNextFrame();
      }, true);
    }
    
    this.muteBtn.addEventListener('click', (e) => {
      console.log('Mute button clicked');
      this.toggleMute();
    }, true);
    
    // Volume slider event listener
    if (this.volumeSlider) {
      this.volumeSlider.addEventListener('input', (e) => {
        const volume = parseInt(e.target.value);
        this.updateVolume(volume);
      }, true);
    }
    
    // Ensure buttons are clickable
    this.playPauseBtn.style.pointerEvents = 'auto';
    this.jumpToStartBtn.style.pointerEvents = 'auto';
    this.rewindBtn.style.pointerEvents = 'auto';
    this.jumpToEndBtn.style.pointerEvents = 'auto';
    if (this.prevFrameBtn) {
      this.prevFrameBtn.style.pointerEvents = 'auto';
    }
    if (this.nextFrameBtn) {
      this.nextFrameBtn.style.pointerEvents = 'auto';
    }
    this.muteBtn.style.pointerEvents = 'auto';
    if (this.volumeSlider) {
      this.volumeSlider.style.pointerEvents = 'auto';
    }
    
    // Make sure buttons aren't disabled unless needed
    if (!this.playPauseBtn.disabled) {
      console.log('Playback controls initialized successfully');
    }
    
    // Initialize state
    this.setEnabled(!!this.videoElement);
  }
}

/**
 * Setup keyboard controls for video playback
 * @param {PlaybackControls} playbackControls - Playback controls instance
 */
export function setupKeyboardControls(playbackControls) {
  document.addEventListener('keydown', (e) => {
    // Don't handle keys if user is typing in an input field
    const activeElement = document.activeElement;
    const isInputFocused = activeElement && (
      activeElement.tagName === 'INPUT' ||
      activeElement.tagName === 'TEXTAREA' ||
      activeElement.tagName === 'SELECT' ||
      activeElement.isContentEditable
    );
    
    // Only handle keys if a video is loaded and user is not typing
    if (!playbackControls.videoElement || isInputFocused) {
      return;
    }
    
    // Handle keyboard shortcuts
    switch (e.key.toLowerCase()) {
      case ' ': // Spacebar - play/pause
        e.preventDefault(); // Prevent page scroll
        playbackControls.togglePlayPause();
        break;
      case 'j': // J - go back 10 seconds
        e.preventDefault();
        playbackControls.jumpSeconds(-10);
        break;
      case 'k': // K - play/pause
        e.preventDefault();
        playbackControls.togglePlayPause();
        break;
      case 'l': // L - go forward 10 seconds
        e.preventDefault();
        playbackControls.jumpSeconds(10);
        break;
      case 'h': // H - go to beginning
        e.preventDefault();
        playbackControls.jumpToStart();
        break;
      case 'm': // M - mute/unmute
        e.preventDefault();
        playbackControls.toggleMute();
        break;
    }
  });
}




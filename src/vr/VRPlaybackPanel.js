/**
 * VR Playback Panel
 * 3D playback controls accessible in VR
 */

import { VRPanel } from '../ui/VRPanel.js';
import { VRButton } from '../ui/VRButton.js';
import * as THREE from 'three';

export class VRPlaybackPanel {
  constructor(options = {}) {
    this.playbackControls = options.playbackControls; // Reference to PlaybackControls instance
    this.videoElement = options.videoElement;
    
    // Create panel
    this.panel = new VRPanel({
      width: 1.5,
      height: 0.6,
      name: 'VRPlaybackPanel',
      followUser: true,
      positionOffset: new THREE.Vector3(0, -0.3, -1.2) // Lower and closer
    });
    
    // Buttons
    this.buttons = {
      playPause: null,
      rewind: null,
      forward: null,
      prevFrame: null,
      nextFrame: null,
      mute: null
    };
    
    // Volume slider (simplified as button for now)
    this.volumeButton = null;
    
    this.createButtons();
  }

  /**
   * Create playback buttons
   * @private
   */
  createButtons() {
    const buttonSize = 0.12;
    const buttonSpacing = 0.15;
    const startX = -0.45;
    const row1Y = 0.15;
    const row2Y = -0.15;
    
    // Row 1: Playback controls
    // Rewind
    this.buttons.rewind = new VRButton({
      label: '⏪',
      width: buttonSize,
      height: buttonSize
    });
    this.buttons.rewind.setPosition(startX, row1Y, 0.01);
    this.buttons.rewind.onClick(() => {
      if (this.playbackControls) {
        this.playbackControls.rewind();
      }
    });
    this.panel.add(this.buttons.rewind.getGroup());
    
    // Play/Pause
    this.buttons.playPause = new VRButton({
      label: '▶',
      width: buttonSize,
      height: buttonSize,
      color: 0x00ff00
    });
    this.buttons.playPause.setPosition(startX + buttonSpacing, row1Y, 0.01);
    this.buttons.playPause.onClick(() => {
      if (this.playbackControls) {
        this.playbackControls.togglePlayPause();
        this.updatePlayPauseIcon();
      }
    });
    this.panel.add(this.buttons.playPause.getGroup());
    
    // Forward
    this.buttons.forward = new VRButton({
      label: '⏩',
      width: buttonSize,
      height: buttonSize
    });
    this.buttons.forward.setPosition(startX + buttonSpacing * 2, row1Y, 0.01);
    this.buttons.forward.onClick(() => {
      if (this.playbackControls) {
        this.playbackControls.forward();
      }
    });
    this.panel.add(this.buttons.forward.getGroup());
    
    // Mute
    this.buttons.mute = new VRButton({
      label: '🔊',
      width: buttonSize,
      height: buttonSize
    });
    this.buttons.mute.setPosition(startX + buttonSpacing * 3, row1Y, 0.01);
    this.buttons.mute.onClick(() => {
      if (this.playbackControls) {
        this.playbackControls.toggleMute();
        this.updateMuteIcon();
      }
    });
    this.panel.add(this.buttons.mute.getGroup());
    
    // Row 2: Frame controls
    // Previous Frame
    this.buttons.prevFrame = new VRButton({
      label: '⏮',
      width: buttonSize,
      height: buttonSize
    });
    this.buttons.prevFrame.setPosition(startX + buttonSpacing * 0.5, row2Y, 0.01);
    this.buttons.prevFrame.onClick(() => {
      if (this.playbackControls) {
        this.playbackControls.prevFrame();
      }
    });
    this.panel.add(this.buttons.prevFrame.getGroup());
    
    // Next Frame
    this.buttons.nextFrame = new VRButton({
      label: '⏭',
      width: buttonSize,
      height: buttonSize
    });
    this.buttons.nextFrame.setPosition(startX + buttonSpacing * 1.5, row2Y, 0.01);
    this.buttons.nextFrame.onClick(() => {
      if (this.playbackControls) {
        this.playbackControls.nextFrame();
      }
    });
    this.panel.add(this.buttons.nextFrame.getGroup());
    
    // Jump to Start
    const jumpStart = new VRButton({
      label: '⏪⏪',
      width: buttonSize,
      height: buttonSize
    });
    jumpStart.setPosition(startX + buttonSpacing * 2.5, row2Y, 0.01);
    jumpStart.onClick(() => {
      if (this.playbackControls) {
        this.playbackControls.jumpToStart();
      }
    });
    this.panel.add(jumpStart.getGroup());
  }

  /**
   * Update play/pause icon
   */
  updatePlayPauseIcon() {
    if (!this.buttons.playPause || !this.videoElement) return;
    
    const isPlaying = !this.videoElement.paused;
    // In a full implementation, you'd update the button label/texture
    // For now, we'll just change color as visual feedback
    if (this.buttons.playPause.buttonMesh) {
      this.buttons.playPause.buttonMesh.material.color.setHex(
        isPlaying ? 0xff0000 : 0x00ff00
      );
    }
  }

  /**
   * Update mute icon
   */
  updateMuteIcon() {
    if (!this.buttons.mute || !this.videoElement) return;
    
    const isMuted = this.videoElement.muted;
    if (this.buttons.mute.buttonMesh) {
      this.buttons.mute.buttonMesh.material.color.setHex(
        isMuted ? 0xff0000 : 0x00aff0
      );
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
   * Set playback controls reference
   * @param {PlaybackControls} playbackControls
   */
  setPlaybackControls(playbackControls) {
    this.playbackControls = playbackControls;
  }

  /**
   * Set video element reference
   * @param {HTMLVideoElement} videoElement
   */
  setVideoElement(videoElement) {
    this.videoElement = videoElement;
  }

  /**
   * Cleanup
   */
  dispose() {
    Object.values(this.buttons).forEach(button => {
      if (button) {
        button.dispose();
      }
    });
    
    if (this.panel) {
      this.panel.dispose();
    }
  }
}


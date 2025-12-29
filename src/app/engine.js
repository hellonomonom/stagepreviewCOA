import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export function createCamera() {
  const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );

  // Default camera position (may be overridden later by presets)
  camera.position.set(5, 5, 5);
  camera.lookAt(0, 0, 0);
  return camera;
}

export function createRenderer() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  // WebXR enabled by default (VRManager will manage sessions)
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local-floor');

  return renderer;
}

export function attachRenderer(renderer) {
  document.body.appendChild(renderer.domElement);
}

export function createControls(camera, renderer) {
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.target.set(0, 0, 0);
  return controls;
}

export function setupResizeHandlers({ renderer, camera, isVRActive }) {
  window.addEventListener('resize', () => {
    if (isVRActive && isVRActive()) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  window.addEventListener('orientationchange', () => {
    if (isVRActive && isVRActive()) return;

    setTimeout(() => {
      const viewport = document.querySelector('meta[name="viewport"]');
      if (viewport) {
        viewport.setAttribute(
          'content',
          'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover'
        );
      }
      window.dispatchEvent(new Event('resize'));
    }, 100);
  });
}

export function startAnimationLoop({ renderer, scene, camera, onFrame }) {
  function animate() {
    if (typeof onFrame === 'function') {
      onFrame();
    }
    renderer.render(scene, camera);
  }

  renderer.setAnimationLoop(animate);
}



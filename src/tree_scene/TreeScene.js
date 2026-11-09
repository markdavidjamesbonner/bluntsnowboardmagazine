import {
  DirectionalLight,
  Fog,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  NeutralToneMapping,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Raycaster,
  Scene,
  SRGBColorSpace,
  Timer,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

import { TREE_BASE_RADIUS, TREE_HEIGHT, buildTree } from './buildTree.js';
import { createOrnaments } from './ornaments.js';
import { createStringLights } from './stringLights.js';
import { createContactShadowTexture } from './textures.js';
import { createTreeSkirt } from './treeSkirt.js';
import { createTreeTopper } from './treeTopper.js';

const BACKGROUND = '#f2f1ed';
const FIELD_OF_VIEW = 32;
const CAMERA_POLAR_ANGLE = 1.42;
const TAP_MAX_TRAVEL_PX = 8;
const TAP_MAX_DURATION_MS = 600;
const AUTO_ROTATE_RESUME_DELAY_S = 1.6;

export class TreeScene {
  constructor(container, { entries, onOpen, onLockedTap, onHover }) {
    this.container = container;
    this.onOpen = onOpen;
    this.onLockedTap = onLockedTap;
    this.onHover = onHover;
    this.timer = new Timer();

    const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
    this.isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.baseAutoRotateSpeed = this.isReducedMotion ? 0 : isCoarsePointer ? 0.45 : 0.7;

    this.renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, isCoarsePointer ? 1.75 : 2));
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = NeutralToneMapping;
    this.renderer.setClearColor(BACKGROUND);
    container.appendChild(this.renderer.domElement);

    this.scene = new Scene();
    this.scene.fog = new Fog(BACKGROUND, 30, 70);
    this.camera = new PerspectiveCamera(FIELD_OF_VIEW, 1, 0.5, 200);
    this.scene.add(this.camera);

    // Reflections for the metal star and bulb glass only; foliage and covers stay on scene lights.
    const pmremGenerator = new PMREMGenerator(this.renderer);
    const roomEnvironment = new RoomEnvironment();
    this.environment = pmremGenerator.fromScene(roomEnvironment, 0.04).texture;
    roomEnvironment.dispose();
    pmremGenerator.dispose();

    const maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy();
    this.tree = buildTree(maxAnisotropy);
    this.scene.add(this.tree.group);
    this.lights = createStringLights(this.tree.group, {
      isReducedMotion: this.isReducedMotion,
      environment: this.environment,
      attachmentPoints: this.tree.attachmentPoints,
    });
    this.tree.setLightGlow(this.lights.glow);
    this.topper = createTreeTopper(this.tree.group, { environment: this.environment });
    this.skirt = createTreeSkirt(this.scene, { maxAnisotropy });
    this.ornaments = createOrnaments(this.tree.group, entries, {
      maxAnisotropy,
      environment: this.environment,
      attachmentPoints: this.tree.attachmentPoints,
    });

    this.scene.add(new HemisphereLight('#f6f2ea', '#5e4f3f', 1.6));
    // Key light rides with the camera so the visible face of the tree is always lit.
    const keyTarget = new Object3D();
    keyTarget.position.set(0, TREE_HEIGHT * 0.45, 0);
    this.scene.add(keyTarget);
    const keyLight = new DirectionalLight('#fff3e2', 2.4);
    keyLight.position.set(-6, 8, 4);
    keyLight.target = keyTarget;
    this.camera.add(keyLight);

    this.shadowTexture = createContactShadowTexture();
    this.shadow = new Mesh(
      new PlaneGeometry(TREE_BASE_RADIUS * 3.2, TREE_BASE_RADIUS * 3.2),
      new MeshBasicMaterial({ map: this.shadowTexture, transparent: true, depthWrite: false, fog: false }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.002;
    this.scene.add(this.shadow);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enablePan = false;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.rotateSpeed = 0.6;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = this.baseAutoRotateSpeed;
    this.controls.minPolarAngle = 1.12;
    this.controls.maxPolarAngle = 1.66;
    this.isInteracting = false;
    this.lastInteractionEndedAt = -Infinity;
    this.controls.addEventListener('start', () => {
      this.isInteracting = true;
      this.clearHover();
    });
    this.controls.addEventListener('end', () => {
      this.isInteracting = false;
      this.lastInteractionEndedAt = this.timer.getElapsed();
    });

    this.raycaster = new Raycaster();
    this.pointer = new Vector2();
    this.pointerDown = null;
    this.hoveredOrnament = null;
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerLeave = this.handlePointerLeave.bind(this);
    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointerdown', this.handlePointerDown);
    canvas.addEventListener('pointerup', this.handlePointerUp);
    canvas.addEventListener('pointermove', this.handlePointerMove);
    canvas.addEventListener('pointerleave', this.handlePointerLeave);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();

    this.hasInitialUnlockState = false;
    this.renderer.setAnimationLoop((timestamp) => this.tick(timestamp));
  }

  setPaused(isPaused) {
    this.renderer.setAnimationLoop(isPaused ? null : (timestamp) => this.tick(timestamp));
  }

  setUnlockedThroughDay(unlockedThroughDay) {
    this.ornaments.setUnlockedThroughDay(unlockedThroughDay, { animate: this.hasInitialUnlockState });
    this.hasInitialUnlockState = true;
  }

  // Frames the whole tree: height-limited on landscape, width-limited on portrait, with the
  // tree anchored low so the hero brand sits in the open sky above the narrow top.
  resize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width === 0 || height === 0) {
      return;
    }
    const aspect = width / height;
    const tanHalfFov = Math.tan((FIELD_OF_VIEW * Math.PI) / 360);
    const fitHeightDistance = (TREE_HEIGHT * 1.36) / 2 / tanHalfFov;
    const fitWidthDistance = (TREE_BASE_RADIUS + 0.35) / (tanHalfFov * aspect);
    const distance = Math.max(fitHeightDistance, fitWidthDistance);
    const visibleHalfHeight = distance * tanHalfFov;

    const targetY = Math.max(TREE_HEIGHT * 0.47, visibleHalfHeight * 0.7);
    this.controls.target.set(0, targetY, 0);
    this.controls.minDistance = distance * 0.5;
    this.controls.maxDistance = distance * 1.15;

    const offset = new Vector3().subVectors(this.camera.position, this.controls.target);
    const azimuth = offset.lengthSq() > 0 ? Math.atan2(offset.x, offset.z) : 0;
    this.camera.position.set(
      Math.sin(azimuth) * Math.sin(CAMERA_POLAR_ANGLE) * distance,
      targetY + Math.cos(CAMERA_POLAR_ANGLE) * distance,
      Math.cos(azimuth) * Math.sin(CAMERA_POLAR_ANGLE) * distance,
    );
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.scene.fog.near = distance * 0.85;
    this.scene.fog.far = distance * 2.4;
    this.renderer.setSize(width, height);
    this.controls.update();
  }

  tick(timestamp) {
    this.timer.update(timestamp);
    const deltaSeconds = Math.min(this.timer.getDelta(), 0.1);
    const elapsedSeconds = this.timer.getElapsed();

    const isResting = !this.isInteracting && elapsedSeconds - this.lastInteractionEndedAt > AUTO_ROTATE_RESUME_DELAY_S;
    const targetSpeed = isResting ? this.baseAutoRotateSpeed : 0;
    this.controls.autoRotateSpeed += (targetSpeed - this.controls.autoRotateSpeed) * Math.min(1, deltaSeconds * 0.9);
    this.controls.update(deltaSeconds);

    this.lights.update(elapsedSeconds);
    this.ornaments.update(elapsedSeconds, deltaSeconds, { isReducedMotion: this.isReducedMotion });
    this.renderer.render(this.scene, this.camera);
  }

  // Only ornaments on the camera-facing side count: one hidden behind the foliage must not
  // open just because the ray passes through the tree to it.
  pickOrnament(clientX, clientY) {
    const bounds = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(
      ((clientX - bounds.left) / bounds.width) * 2 - 1,
      -((clientY - bounds.top) / bounds.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const cameraDirection = new Vector3(this.camera.position.x, 0, this.camera.position.z).normalize();
    const ornamentDirection = new Vector3();
    for (const hit of this.raycaster.intersectObjects(this.ornaments.pickTargets, false)) {
      hit.object.getWorldPosition(ornamentDirection);
      ornamentDirection.y = 0;
      if (ornamentDirection.normalize().dot(cameraDirection) > 0.05) {
        return this.ornaments.ornaments.find((ornament) => ornament.coverMesh === hit.object) ?? null;
      }
    }
    return null;
  }

  isUnlocked(ornament) {
    return ornament.targetUnlock === 1;
  }

  handlePointerDown(event) {
    this.pointerDown = { x: event.clientX, y: event.clientY, time: performance.now() };
  }

  handlePointerUp(event) {
    const start = this.pointerDown;
    this.pointerDown = null;
    if (!start) {
      return;
    }
    const travel = Math.hypot(event.clientX - start.x, event.clientY - start.y);
    if (travel > TAP_MAX_TRAVEL_PX || performance.now() - start.time > TAP_MAX_DURATION_MS) {
      return;
    }
    const ornament = this.pickOrnament(event.clientX, event.clientY);
    if (!ornament) {
      return;
    }
    if (this.isUnlocked(ornament)) {
      this.onOpen(ornament.entry);
    } else {
      this.ornaments.shake(ornament, this.timer.getElapsed());
      this.onLockedTap(ornament.entry, { x: event.clientX, y: event.clientY });
    }
  }

  handlePointerMove(event) {
    if (event.pointerType !== 'mouse' || this.isInteracting) {
      return;
    }
    const ornament = this.pickOrnament(event.clientX, event.clientY);
    const hovered = ornament && this.isUnlocked(ornament) ? ornament : null;
    if (hovered !== this.hoveredOrnament) {
      if (this.hoveredOrnament) {
        this.hoveredOrnament.isHovered = false;
      }
      if (hovered) {
        hovered.isHovered = true;
      }
      this.hoveredOrnament = hovered;
      this.renderer.domElement.style.cursor = hovered ? 'pointer' : '';
    }
    if (hovered) {
      this.onHover(hovered.entry, { x: event.clientX, y: event.clientY });
    } else {
      this.onHover(null);
    }
  }

  handlePointerLeave() {
    this.clearHover();
  }

  clearHover() {
    if (this.hoveredOrnament) {
      this.hoveredOrnament.isHovered = false;
      this.hoveredOrnament = null;
    }
    this.renderer.domElement.style.cursor = '';
    this.onHover(null);
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    this.resizeObserver.disconnect();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointerdown', this.handlePointerDown);
    canvas.removeEventListener('pointerup', this.handlePointerUp);
    canvas.removeEventListener('pointermove', this.handlePointerMove);
    canvas.removeEventListener('pointerleave', this.handlePointerLeave);
    this.controls.dispose();
    this.tree.dispose();
    this.lights.dispose();
    this.topper.dispose();
    this.skirt.dispose();
    this.ornaments.dispose();
    this.shadow.geometry.dispose();
    this.shadow.material.dispose();
    this.shadowTexture.dispose();
    this.environment.dispose();
    this.renderer.dispose();
    canvas.remove();
  }
}

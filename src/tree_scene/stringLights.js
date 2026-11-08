import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  Data3DTexture,
  InstancedMesh,
  LatheGeometry,
  LinearFilter,
  Matrix4,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Points,
  PointsMaterial,
  Quaternion,
  TubeGeometry,
  Vector2,
  Vector3,
} from 'three';

import { findNearestFreePoint } from '../utils/nearestFreePoint.js';
import { createSeededRandom } from '../utils/seededRandom.js';
import { TREE_BASE_RADIUS, TREE_HEIGHT, foliageRadiusAt } from './buildTree.js';
import { createGlowTexture } from './textures.js';

const BULB_COUNT = 150;
const WRAP_TURNS = 7.5;
const STRING_BOTTOM_Y = 1.75;
// Height mismatch costs more than sideways drift, so the snapped spiral keeps its pitch.
const SPIRAL_HEIGHT_WEIGHT = 1.6;
const STRING_TOP_Y = TREE_HEIGHT - 1.15;
const BULB_LENGTH = 0.27;
const SOCKET_LENGTH = 0.09;
const WIRE_RADIUS = 0.012;
const HALO_SIZE = 1.15;
const TAU = Math.PI * 2;

// C9 "strawberry" glass, socket neck at y = 0 to rounded point at y = 1 (radius, height).
const BULB_PROFILE = [
  [0.17, 0],
  [0.21, 0.05],
  [0.27, 0.13],
  [0.305, 0.23],
  [0.31, 0.33],
  [0.29, 0.46],
  [0.24, 0.61],
  [0.17, 0.76],
  [0.09, 0.89],
  [0.035, 0.97],
  [0, 1],
];

// Old-school multicolor string: red, green, blue, amber, magenta, warm white. Hex (sRGB) on purpose:
// linear-space channels like 0.1 display as ~0.35 and wash every bulb out to pastel.
const BULB_PALETTE = ['#ff1a10', '#14d23a', '#1f4dff', '#ff9a0a', '#f0189a', '#ffd9a0'].map((hex) => new Color(hex));

const GLOW_RESOLUTION = { x: 32, y: 40, z: 32 };
const GLOW_RADIUS = 0.95;
const GLOW_INTENSITY = 1.0;

// Equal arc-length stops along a spiral hugging the foliage (so bulbs don't bunch up near the top),
// each snapped to the nearest real limb so nothing hangs in mid-air.
function layoutBulbs(random, attachmentPoints) {
  const samples = [];
  const sampleCount = 4000;
  let totalLength = 0;
  let previous = null;
  for (let index = 0; index <= sampleCount; index += 1) {
    const progress = index / sampleCount;
    const y = STRING_BOTTOM_Y + progress * (STRING_TOP_Y - STRING_BOTTOM_Y);
    const azimuth = progress * WRAP_TURNS * TAU;
    const radius = foliageRadiusAt(y, azimuth) * 0.93;
    const point = new Vector3(Math.sin(azimuth) * radius, y, Math.cos(azimuth) * radius);
    if (previous) {
      totalLength += point.distanceTo(previous);
    }
    samples.push({ point, azimuth, distance: totalLength });
    previous = point;
  }

  const bulbs = [];
  const usedIndices = new Set();
  let sampleIndex = 0;
  for (let index = 0; index < BULB_COUNT; index += 1) {
    const targetDistance = ((index + 0.5) / BULB_COUNT) * totalLength;
    while (samples[sampleIndex].distance < targetDistance) {
      sampleIndex += 1;
    }
    const attachmentIndex = findNearestFreePoint(samples[sampleIndex].point, attachmentPoints, usedIndices, SPIRAL_HEIGHT_WEIGHT);
    usedIndices.add(attachmentIndex);
    const socket = attachmentPoints[attachmentIndex].clone();
    const azimuth = Math.atan2(socket.x, socket.z);
    socket.y += 0.03;

    // Clipped onto branch tips: mostly up and out, some straight out, a few hanging.
    const outward = new Vector3(Math.sin(azimuth), 0, Math.cos(azimuth));
    const pose = random();
    const lift = pose < 0.65 ? random.range(0.6, 1.0) : pose < 0.9 ? random.range(0.0, 0.3) : random.range(-0.7, -0.35);
    const direction = outward
      .multiplyScalar(random.range(0.5, 0.9))
      .add(new Vector3(random.range(-0.35, 0.35), lift, random.range(-0.35, 0.35)))
      .normalize();

    bulbs.push({ socket, direction, color: BULB_PALETTE[index % BULB_PALETTE.length] });
  }
  return bulbs;
}

// The wire sags between sockets and tucks back into the branches; the lead runs up the trunk from the floor.
function createWireCurve(bulbs) {
  const points = [new Vector3(0.45, 0.012, 0.32), new Vector3(0.3, 0.03, 0.2), new Vector3(0.24, 1.5, 0.12)];
  bulbs.forEach((bulb, index) => {
    points.push(bulb.socket);
    const next = bulbs[index + 1];
    if (next) {
      const midpoint = bulb.socket.clone().lerp(next.socket, 0.5);
      midpoint.x *= 0.9;
      midpoint.z *= 0.9;
      midpoint.y -= 0.07;
      points.push(midpoint);
    }
  });
  return new CatmullRomCurve3(points, false, 'centripetal');
}

function createGlowVolume(bulbs) {
  const margin = 0.8;
  const min = new Vector3(-TREE_BASE_RADIUS - margin, 0, -TREE_BASE_RADIUS - margin);
  const size = new Vector3((TREE_BASE_RADIUS + margin) * 2, TREE_HEIGHT + margin, (TREE_BASE_RADIUS + margin) * 2);
  const { x: width, y: height, z: depth } = GLOW_RESOLUTION;
  const voxel = new Vector3(size.x / width, size.y / height, size.z / depth);
  const accumulated = new Float32Array(width * height * depth * 3);
  const voxelCenter = new Vector3();

  for (const bulb of bulbs) {
    const center = bulb.socket.clone().addScaledVector(bulb.direction, SOCKET_LENGTH + BULB_LENGTH * 0.4);
    const lowX = Math.max(0, Math.floor((center.x - GLOW_RADIUS - min.x) / voxel.x));
    const highX = Math.min(width - 1, Math.ceil((center.x + GLOW_RADIUS - min.x) / voxel.x));
    const lowY = Math.max(0, Math.floor((center.y - GLOW_RADIUS - min.y) / voxel.y));
    const highY = Math.min(height - 1, Math.ceil((center.y + GLOW_RADIUS - min.y) / voxel.y));
    const lowZ = Math.max(0, Math.floor((center.z - GLOW_RADIUS - min.z) / voxel.z));
    const highZ = Math.min(depth - 1, Math.ceil((center.z + GLOW_RADIUS - min.z) / voxel.z));
    for (let z = lowZ; z <= highZ; z += 1) {
      for (let y = lowY; y <= highY; y += 1) {
        for (let x = lowX; x <= highX; x += 1) {
          voxelCenter.set(min.x + (x + 0.5) * voxel.x, min.y + (y + 0.5) * voxel.y, min.z + (z + 0.5) * voxel.z);
          const falloff = Math.max(0, 1 - voxelCenter.distanceToSquared(center) / GLOW_RADIUS ** 2) ** 2;
          if (falloff > 0) {
            const offset = (x + y * width + z * width * height) * 3;
            accumulated[offset] += bulb.color.r * falloff;
            accumulated[offset + 1] += bulb.color.g * falloff;
            accumulated[offset + 2] += bulb.color.b * falloff;
          }
        }
      }
    }
  }

  let peak = 0;
  for (const value of accumulated) {
    peak = Math.max(peak, value);
  }
  const data = new Uint8Array(width * height * depth * 4);
  for (let index = 0; index < width * height * depth; index += 1) {
    data[index * 4] = Math.round((accumulated[index * 3] / peak) * 255);
    data[index * 4 + 1] = Math.round((accumulated[index * 3 + 1] / peak) * 255);
    data[index * 4 + 2] = Math.round((accumulated[index * 3 + 2] / peak) * 255);
    data[index * 4 + 3] = 255;
  }
  const texture = new Data3DTexture(data, width, height, depth);
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  return { texture, min, size, strength: peak * GLOW_INTENSITY };
}

// Painted glass: color-saturated glow at grazing angles, a white-hot core where it faces you.
function applyBulbGlow(material) {
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      float bulbFacing = abs(dot(normal, normalize(vViewPosition)));
      float bulbLevel = max(vColor.r, max(vColor.g, vColor.b));
      totalEmissiveRadiance *= vColor.rgb * (0.3 + 0.95 * pow(bulbFacing, 1.4));
      totalEmissiveRadiance += vec3(1.0, 0.9, 0.75) * pow(bulbFacing, 10.0) * 0.22 * bulbLevel;`,
    );
  };
}

export function createStringLights(group, { isReducedMotion, environment, attachmentPoints }) {
  const random = createSeededRandom(31);
  const bulbs = layoutBulbs(random, attachmentPoints);

  const glassGeometry = new LatheGeometry(
    BULB_PROFILE.map(([radius, height]) => new Vector2(radius * BULB_LENGTH, height * BULB_LENGTH)),
    18,
  );
  glassGeometry.translate(0, SOCKET_LENGTH, 0);
  const socketGeometry = new CylinderGeometry(0.05, 0.043, SOCKET_LENGTH + 0.01, 12);
  socketGeometry.translate(0, (SOCKET_LENGTH + 0.01) / 2, 0);

  const glassMaterial = new MeshPhysicalMaterial({
    color: '#2a2a2a',
    emissive: '#ffffff',
    roughness: 0.35,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    envMap: environment,
    envMapIntensity: 0.22,
    toneMapped: false,
  });
  applyBulbGlow(glassMaterial);
  const plasticMaterial = new MeshStandardMaterial({ color: '#1c3820', roughness: 0.45 });

  const glass = new InstancedMesh(glassGeometry, glassMaterial, BULB_COUNT);
  const sockets = new InstancedMesh(socketGeometry, plasticMaterial, BULB_COUNT);
  const matrix = new Matrix4();
  const quaternion = new Quaternion();
  const unitScale = new Vector3(1, 1, 1);
  const up = new Vector3(0, 1, 0);
  const haloPositions = new Float32Array(BULB_COUNT * 3);
  const haloColors = new Float32Array(BULB_COUNT * 3);

  bulbs.forEach((bulb, index) => {
    quaternion.setFromUnitVectors(up, bulb.direction);
    matrix.compose(bulb.socket, quaternion, unitScale);
    glass.setMatrixAt(index, matrix);
    sockets.setMatrixAt(index, matrix);
    glass.setColorAt(index, bulb.color);
    bulb.socket
      .clone()
      .addScaledVector(bulb.direction, SOCKET_LENGTH + BULB_LENGTH * 0.4)
      .toArray(haloPositions, index * 3);
    bulb.color.toArray(haloColors, index * 3);
  });
  glass.instanceMatrix.needsUpdate = true;
  sockets.instanceMatrix.needsUpdate = true;
  glass.computeBoundingSphere();
  sockets.computeBoundingSphere();
  group.add(glass, sockets);

  const wireGeometry = new TubeGeometry(createWireCurve(bulbs), BULB_COUNT * 8, WIRE_RADIUS, 5, false);
  const wire = new Mesh(wireGeometry, plasticMaterial);
  group.add(wire);

  const haloGeometry = new BufferGeometry();
  haloGeometry.setAttribute('position', new BufferAttribute(haloPositions, 3));
  const haloColorAttribute = new BufferAttribute(haloColors, 3);
  haloGeometry.setAttribute('color', haloColorAttribute);
  const haloTexture = createGlowTexture();
  const haloMaterial = new PointsMaterial({
    size: HALO_SIZE,
    map: haloTexture,
    vertexColors: true,
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
  });
  const halos = new Points(haloGeometry, haloMaterial);
  group.add(halos);

  const glow = createGlowVolume(bulbs);

  const phases = bulbs.map(() => ({ offset: random() * TAU, speed: random.range(0.5, 1.4) }));
  const color = new Color();

  return {
    glow,
    update(elapsedSeconds) {
      if (isReducedMotion) {
        return;
      }
      bulbs.forEach((bulb, index) => {
        const { offset, speed } = phases[index];
        const flicker = 0.84 + 0.16 * Math.sin(elapsedSeconds * speed + offset);
        color.copy(bulb.color).multiplyScalar(flicker);
        glass.setColorAt(index, color);
        color.toArray(haloColors, index * 3);
      });
      glass.instanceColor.needsUpdate = true;
      haloColorAttribute.needsUpdate = true;
    },
    dispose() {
      glassGeometry.dispose();
      socketGeometry.dispose();
      glassMaterial.dispose();
      plasticMaterial.dispose();
      glass.dispose();
      sockets.dispose();
      wireGeometry.dispose();
      haloGeometry.dispose();
      haloTexture.dispose();
      haloMaterial.dispose();
      glow.texture.dispose();
    },
  };
}

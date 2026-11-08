import {
  Color,
  CylinderGeometry,
  Data3DTexture,
  DoubleSide,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  Vector3,
} from 'three';

import { createSeededRandom } from '../utils/seededRandom.js';
import { createNeedleTexture } from './textures.js';

export const TREE_HEIGHT = 10;
export const TREE_BASE_RADIUS = 4.1;
const FOLIAGE_START_Y = 1.8;
// Lowest a drooping limb may sag, leaving bare trunk and clear floor under the tree.
const LIMB_FLOOR_Y = 1.3;
const LEADER_BASE_Y = TREE_HEIGHT - 1.4;
const MAX_CARDS = 16000;
const TAU = Math.PI * 2;

// The leader never grows dead straight; the topper sits on its tip.
export const LEADER_TIP = { x: 0.08, y: TREE_HEIGHT, z: -0.05 };

// Low-frequency lobes that twist with height, so no two sides of the tree share a silhouette.
const SILHOUETTE_LOBES = [
  { frequency: 1, amplitude: 0.08, phase: 0.6, twist: 0.3 },
  { frequency: 2, amplitude: 0.065, phase: 2.1, twist: -0.45 },
  { frequency: 3, amplitude: 0.05, phase: 4.0, twist: 0.7 },
  { frequency: 5, amplitude: 0.03, phase: 1.3, twist: -1.0 },
];

// Outer reach of the foliage at height y on the side facing `azimuth`.
export function foliageRadiusAt(y, azimuth) {
  const progress = Math.min(Math.max((y - FOLIAGE_START_Y) / (TREE_HEIGHT - FOLIAGE_START_Y), 0), 1);
  let lobes = 1;
  for (const lobe of SILHOUETTE_LOBES) {
    lobes += lobe.amplitude * Math.sin(lobe.frequency * azimuth + lobe.phase + lobe.twist * y);
  }
  return TREE_BASE_RADIUS * Math.pow(1 - progress, 0.9) * lobes;
}

const WORLD_UP = new Vector3(0, 1, 0);
const NEUTRAL_TINT = new Color(1, 1, 1);
const NEW_GROWTH_TINT = new Color(1.05, 1.05, 0.9);

function createCardPlacer(mesh) {
  const matrix = new Matrix4();
  const basis = new Matrix4();
  const quaternion = new Quaternion();
  const roll = new Quaternion();
  const side = new Vector3();
  const normal = new Vector3();
  const scale = new Vector3();
  const color = new Color();
  let count = 0;

  // Card plane: local X = width, local Y = length (base at origin), local Z = face normal.
  // Starts lying flat along `direction`, then rolls around it.
  return {
    place(position, direction, rollAngle, width, length, shade, tint = NEUTRAL_TINT) {
      if (count >= MAX_CARDS) {
        return;
      }
      side.crossVectors(WORLD_UP, direction);
      if (side.lengthSq() < 1e-6) {
        side.set(1, 0, 0);
      }
      side.normalize();
      normal.crossVectors(side, direction).normalize();
      basis.makeBasis(side, direction, normal);
      quaternion.setFromRotationMatrix(basis);
      roll.setFromAxisAngle(direction, rollAngle);
      quaternion.premultiply(roll);
      scale.set(width, length, 1);
      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(count, matrix);
      mesh.setColorAt(count, color.setRGB(shade * 0.96 * tint.r, shade * tint.g, shade * 0.9 * tint.b));
      count += 1;
    },
    get count() {
      return count;
    },
  };
}

function directionFrom(azimuth, elevation) {
  return new Vector3(
    Math.sin(azimuth) * Math.cos(elevation),
    Math.sin(elevation),
    Math.cos(azimuth) * Math.cos(elevation),
  ).normalize();
}

// A limb leaves the trunk at `pitch`, sags under its own weight, then lifts again at the tip.
function growLimb({ origin, azimuth, length, pitch, droop, upturn, yawDrift }) {
  const steps = Math.max(6, Math.ceil(length / 0.12));
  const stepLength = length / steps;
  const position = origin.clone();
  const path = [];
  for (let step = 0; step <= steps; step += 1) {
    const progress = step / steps;
    const elevation = pitch - droop * progress + upturn * progress ** 3;
    const tangent = directionFrom(azimuth + yawDrift * progress, elevation);
    path.push({ position: position.clone(), tangent });
    position.addScaledVector(tangent, stepLength);
    position.y = Math.max(position.y, LIMB_FLOOR_Y);
  }
  return path;
}

function sampleLimb(path, progress) {
  return path[Math.min(path.length - 1, Math.round(progress * (path.length - 1)))];
}

// Needled cards along the limb, plus opposite pairs of forward-swept side twigs: a flat-ish fir frond.
function dressLimb(placer, random, path, length, { shade, hueShift }) {
  const branchTint = new Color(hueShift, 1, 2 - hueShift);
  const twigDirection = new Vector3();
  const side = new Vector3();

  for (let distance = length * 0.12; distance < length; distance += 0.34) {
    const progress = distance / length;
    const { position, tangent } = sampleLimb(path, progress);
    const cardLength = Math.min(0.6, length - distance + 0.2);
    const tint = progress > 0.9 ? NEW_GROWTH_TINT : branchTint;
    const cardShade = shade * (0.45 + 0.6 * progress);
    for (const roll of [0, -1.05, 1.05]) {
      placer.place(
        position,
        tangent,
        roll + random.range(-0.2, 0.2),
        cardLength * random.range(0.5, 0.62),
        cardLength * 1.2,
        cardShade * random.range(0.88, 1.08),
        tint,
      );
    }
  }

  const twigReach = Math.min(1.05, 0.32 + length * 0.2);
  for (let distance = length * 0.18; distance < length * 0.96; distance += random.range(0.15, 0.22)) {
    const progress = distance / length;
    const { position, tangent } = sampleLimb(path, progress);
    side.crossVectors(tangent, WORLD_UP).normalize();
    const twigLength = (twigReach * (1 - 0.62 * progress) + 0.14) * random.range(0.82, 1.15);
    const tint = progress > 0.88 ? NEW_GROWTH_TINT : branchTint;
    const twigShade = shade * (0.5 + 0.55 * progress);

    for (const sideSign of [-1, 1]) {
      const sweep = random.range(0.7, 1.05);
      twigDirection
        .copy(tangent)
        .multiplyScalar(Math.cos(sweep))
        .addScaledVector(side, sideSign * Math.sin(sweep));
      twigDirection.y -= random.range(0.05, 0.2);
      twigDirection.normalize();
      for (const roll of [-0.65, 0.65]) {
        placer.place(
          position,
          twigDirection,
          roll + random.range(-0.25, 0.25),
          twigLength * random.range(0.55, 0.68),
          twigLength,
          twigShade * random.range(0.85, 1.1),
          tint,
        );
      }
    }
  }
}

// Bulbs tint the needles around them: a 3D texture of summed bulb light, sampled per fragment.
function applyLightGlow(material, uniforms) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec3 uGlowMin;
        uniform vec3 uGlowSize;
        varying vec3 vGlowCoord;`,
      )
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vGlowCoord = ((instanceMatrix * vec4(transformed, 1.0)).xyz - uGlowMin) / uGlowSize;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform sampler3D uGlowVolume;
        uniform float uGlowStrength;
        varying vec3 vGlowCoord;`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        totalEmissiveRadiance += texture(uGlowVolume, vGlowCoord).rgb * uGlowStrength * (diffuseColor.rgb * 2.5 + 0.05);`,
      );
  };
}

export function buildTree(maxAnisotropy) {
  const random = createSeededRandom(1225);
  const group = new Group();

  const trunk = new Mesh(
    new CylinderGeometry(0.04, 0.3, LEADER_BASE_Y, 12),
    new MeshStandardMaterial({ color: '#2e2118', roughness: 1 }),
  );
  trunk.position.y = LEADER_BASE_Y / 2;
  group.add(trunk);

  const cardGeometry = new PlaneGeometry(1, 1);
  cardGeometry.translate(0, 0.5, 0);
  const needleTexture = createNeedleTexture(maxAnisotropy);
  const needleMaterial = new MeshStandardMaterial({
    map: needleTexture,
    alphaTest: 0.4,
    alphaToCoverage: true,
    side: DoubleSide,
    roughness: 0.78,
    metalness: 0,
  });
  const emptyGlowVolume = new Data3DTexture(new Uint8Array(4), 1, 1, 1);
  emptyGlowVolume.needsUpdate = true;
  const glowUniforms = {
    uGlowVolume: { value: emptyGlowVolume },
    uGlowMin: { value: new Vector3() },
    uGlowSize: { value: new Vector3(1, 1, 1) },
    uGlowStrength: { value: 0 },
  };
  applyLightGlow(needleMaterial, glowUniforms);

  const foliage = new InstancedMesh(cardGeometry, needleMaterial, MAX_CARDS);
  const placer = createCardPlacer(foliage);
  const origin = new Vector3();
  // Outer stretches of real limbs, where lights can actually be clipped on.
  const attachmentPoints = [];

  function addLimb(y, azimuth, reachScale, heightProgress) {
    const pitch = -0.08 + heightProgress * 0.75 + random.range(-0.12, 0.12);
    const droop = (0.6 - heightProgress * 0.4) * random.range(0.75, 1.25);
    // Limbs sag, so their tips sit lower than where they leave the trunk.
    const reach = foliageRadiusAt(y - 0.35 * (1 - heightProgress), azimuth) * reachScale;
    const length = Math.max(0.35, reach / 0.92);
    origin.set(0, y, 0);
    const path = growLimb({
      origin,
      azimuth,
      length,
      pitch,
      droop,
      upturn: 0.4 * random.range(0.6, 1.3),
      yawDrift: random.range(-0.18, 0.18),
    });
    dressLimb(placer, random, path, length, {
      shade: random.range(0.88, 1.08),
      hueShift: random.range(0.94, 1.06),
    });
    for (let progress = 0.6; progress <= 0.92; progress += 0.08) {
      attachmentPoints.push(sampleLimb(path, progress).position);
    }
  }

  // Whorls: a tier of limbs every ~0.6 units, with a few shorter limbs sprouting between tiers.
  for (let y = FOLIAGE_START_Y + 0.12; y < LEADER_BASE_Y; ) {
    const spacing = random.range(0.46, 0.64);
    const heightProgress = (y - FOLIAGE_START_Y) / (TREE_HEIGHT - FOLIAGE_START_Y);
    const limbCount = Math.round(4 + (1 - heightProgress) * 5 + random.range(0, 1.5));
    const whorlOffset = random() * TAU;

    for (let limb = 0; limb < limbCount; limb += 1) {
      // Now and then a limb is simply missing, like on any real tree.
      if (random() < 0.06) {
        continue;
      }
      const azimuth = whorlOffset + (limb / limbCount) * TAU + random.range(-0.3, 0.3);
      const reachScale = random() < 0.08 ? random.range(1.1, 1.2) : random.range(0.84, 1.04);
      addLimb(y + random.range(-0.05, 0.05), azimuth, reachScale, heightProgress);
    }

    const internodeCount = Math.floor(random.range(1, 3.6));
    for (let index = 0; index < internodeCount; index += 1) {
      const internodeY = y + random.range(0.15, spacing - 0.08);
      const internodeProgress = (internodeY - FOLIAGE_START_Y) / (TREE_HEIGHT - FOLIAGE_START_Y);
      addLimb(internodeY, random() * TAU, random.range(0.5, 0.75), Math.min(1, internodeProgress + 0.12));
    }
    y += spacing;
  }

  // Dark interior fill: a real tree is dense and shadowed inside, not see-through to the wall.
  const fillDirection = new Vector3();
  for (let index = 0; index < 2200; index += 1) {
    const y = random.range(FOLIAGE_START_Y + 0.2, LEADER_BASE_Y - 0.2);
    const azimuth = random() * TAU;
    const reach = foliageRadiusAt(y, azimuth);
    const depth = random.range(0.06, 0.65);
    origin.set(Math.sin(azimuth) * reach * depth, y, Math.cos(azimuth) * reach * depth);
    fillDirection.copy(directionFrom(azimuth + random.range(-0.8, 0.8), random.range(-0.4, 0.3)));
    const length = random.range(0.5, 0.9);
    placer.place(origin, fillDirection, random.range(-1.2, 1.2), length * 0.6, length, random.range(0.22, 0.4));
  }

  // Leader: a slightly leaning spire with short upswept shoots, topped by the star.
  const leaderBase = new Vector3(0, LEADER_BASE_Y - 0.4, 0);
  const leaderTip = new Vector3(LEADER_TIP.x, LEADER_TIP.y, LEADER_TIP.z);
  const leaderDirection = new Vector3().subVectors(leaderTip, leaderBase);
  const leaderLength = leaderDirection.length();
  leaderDirection.normalize();
  const shootDirection = new Vector3();
  for (let distance = 0; distance < leaderLength - 0.15; distance += 0.22) {
    origin.copy(leaderBase).addScaledVector(leaderDirection, distance);
    const cardLength = Math.min(0.45, leaderLength - distance);
    for (const roll of [0, 2.1, 4.2]) {
      placer.place(origin, leaderDirection, roll + random.range(-0.3, 0.3), 0.22, cardLength, 0.95);
    }
    const progress = distance / leaderLength;
    if (progress < 0.75) {
      const shootCount = 3;
      for (let shoot = 0; shoot < shootCount; shoot += 1) {
        shootDirection.copy(directionFrom(random() * TAU, random.range(0.75, 1.05)));
        const shootLength = (0.55 - progress * 0.45) * random.range(0.8, 1.2);
        placer.place(origin, shootDirection, random.range(-0.6, 0.6), shootLength * 0.6, shootLength, 0.95, NEW_GROWTH_TINT);
      }
    }
  }

  foliage.count = placer.count;
  foliage.instanceMatrix.needsUpdate = true;
  foliage.instanceColor.needsUpdate = true;
  foliage.computeBoundingSphere();
  group.add(foliage);

  return {
    group,
    attachmentPoints,
    setLightGlow({ texture, min, size, strength }) {
      glowUniforms.uGlowVolume.value = texture;
      glowUniforms.uGlowMin.value.copy(min);
      glowUniforms.uGlowSize.value.copy(size);
      glowUniforms.uGlowStrength.value = strength;
    },
    dispose() {
      trunk.geometry.dispose();
      trunk.material.dispose();
      cardGeometry.dispose();
      needleTexture.dispose();
      needleMaterial.dispose();
      emptyGlowVolume.dispose();
      foliage.dispose();
    },
  };
}

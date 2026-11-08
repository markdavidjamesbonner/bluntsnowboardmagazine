import {
  BoxGeometry,
  BufferGeometry,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
} from 'three';

import { findNearestFreePoint } from '../utils/nearestFreePoint.js';
import { createSeededRandom } from '../utils/seededRandom.js';
import { TREE_HEIGHT, foliageRadiusAt } from './buildTree.js';
import { createPageEdgeTexture } from './textures.js';

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const ORNAMENT_AREA = 1.3;
const STRING_LENGTH = 0.2;
const MAGAZINE_DEPTH = 0.042;
const COVER_BULGE = 0.012;
const TOP_CENTER_Y = TREE_HEIGHT - 1.75;
const BOTTOM_CENTER_Y = 2.6;
const UNLOCKED_EMISSIVE = 0.3;
const DEFAULT_COVER_ASPECT = 0.76;
// Hooks sit this far out along the limb from its axis point, among the twigs, not in open air.
const HOOK_OUTSET = 0.22;
const HANG_HEIGHT_WEIGHT = 1.4;
const MIN_HOOK_SPACING = 0.9;

// Locked covers are desaturated and washed toward paper gray; uUnlock eases 0 → 1 at unlock.
function applyLockShader(material, uniforms) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uUnlock = uniforms.uUnlock;
    shader.fragmentShader = `uniform float uUnlock;\n${shader.fragmentShader}`.replace(
      '#include <map_fragment>',
      `#include <map_fragment>
      float coverLuma = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
      vec3 lockedColor = mix(vec3(coverLuma), vec3(0.42), 0.45);
      diffuseColor.rgb = mix(lockedColor, diffuseColor.rgb, uUnlock);`,
    );
  };
}

// Unit-sized magazine (scaled per cover aspect). The page block bows out toward the middle of
// both covers, and the top/bottom faces get u/v swapped so page lines run along every open edge.
// Material groups follow BoxGeometry's face order: fore-edge, spine, top, bottom, cover, back.
function createMagazineGeometry() {
  const geometry = new BoxGeometry(1, 1, MAGAZINE_DEPTH, 10, 10, 1);
  const position = geometry.attributes.position;
  const normal = geometry.attributes.normal;
  const uv = geometry.attributes.uv;
  for (let index = 0; index < position.count; index += 1) {
    const z = position.getZ(index);
    if (Math.abs(z) > MAGAZINE_DEPTH / 4) {
      const across = 1 - (2 * position.getX(index)) ** 2;
      const along = 1 - (2 * position.getY(index)) ** 2;
      position.setZ(index, z + Math.sign(z) * COVER_BULGE * across * along);
    }
    if (Math.abs(normal.getY(index)) === 1) {
      uv.setXY(index, uv.getY(index), uv.getX(index));
    }
  }
  geometry.computeVertexNormals();
  return geometry;
}

// Area-uniform spiral on the cone surface (day 1 near the top working down) picks where each
// magazine should go; it then hangs from the real limb nearest that spot.
function ornamentLayout(count, attachmentPoints) {
  const random = createSeededRandom(2026);
  const apexFraction = (TREE_HEIGHT - TOP_CENTER_Y) / (TREE_HEIGHT - BOTTOM_CENTER_Y);
  const usedIndices = new Set();
  const typicalHangDrop = STRING_LENGTH + Math.sqrt(ORNAMENT_AREA / DEFAULT_COVER_ASPECT) / 2;

  return Array.from({ length: count }, (_, index) => {
    const areaProgress = (index + 0.5) / count;
    const slant = Math.sqrt(apexFraction ** 2 + (1 - apexFraction ** 2) * areaProgress);
    const centerY = TREE_HEIGHT - slant * (TREE_HEIGHT - BOTTOM_CENTER_Y) + random.range(-0.12, 0.12);
    const azimuth = index * GOLDEN_ANGLE + random.range(-0.12, 0.12);
    const hookY = centerY + typicalHangDrop;
    const reach = foliageRadiusAt(hookY, azimuth);
    const target = { x: Math.sin(azimuth) * reach, y: hookY, z: Math.cos(azimuth) * reach };

    const pointIndex = findNearestFreePoint(target, attachmentPoints, usedIndices, HANG_HEIGHT_WEIGHT);
    if (pointIndex === -1) {
      throw new Error(`No free branch left to hang ornament ${index + 1}`);
    }
    const branchPoint = attachmentPoints[pointIndex];
    attachmentPoints.forEach((point, candidateIndex) => {
      if (point.distanceTo(branchPoint) < MIN_HOOK_SPACING) {
        usedIndices.add(candidateIndex);
      }
    });

    const hangAzimuth = Math.atan2(branchPoint.x, branchPoint.z);
    return {
      azimuth: hangAzimuth,
      hook: new Vector3(
        branchPoint.x + Math.sin(hangAzimuth) * HOOK_OUTSET,
        branchPoint.y,
        branchPoint.z + Math.cos(hangAzimuth) * HOOK_OUTSET,
      ),
      tilt: random.range(-0.06, 0.06),
      swayPhase: random() * Math.PI * 2,
    };
  });
}

export function createOrnaments(group, entries, { maxAnisotropy, environment, attachmentPoints }) {
  const loader = new TextureLoader();
  const magazineGeometry = createMagazineGeometry();
  const pageEdgeTexture = createPageEdgeTexture();
  const pageEdgeMaterial = new MeshStandardMaterial({ map: pageEdgeTexture, roughness: 0.92 });
  const spineMaterial = new MeshStandardMaterial({ color: '#d6d0c4', roughness: 0.55 });
  const backCoverMaterial = new MeshPhysicalMaterial({
    color: '#e9e5dc',
    roughness: 0.5,
    clearcoat: 0.6,
    clearcoatRoughness: 0.25,
  });
  const stringMaterial = new LineBasicMaterial({ color: '#9c8a5c' });
  const stringGeometry = new BufferGeometry().setFromPoints([new Vector3(0, 0, 0), new Vector3(0, -STRING_LENGTH, 0)]);
  const layout = ornamentLayout(entries.length, attachmentPoints);

  const ornaments = entries.map((entry, index) => {
    const placement = layout[index];
    const uniforms = { uUnlock: { value: 0 } };
    const texture = loader.load(
      entry.ornamentTexture,
      (loaded) => {
        sizePlate(loaded.image.width / loaded.image.height);
      },
      undefined,
      (error) => console.error(`Ornament texture failed for day ${entry.day}`, error),
    );
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = maxAnisotropy;

    // Coated stock: a clearcoat sheen over the print is what separates a magazine from cardboard.
    const coverMaterial = new MeshPhysicalMaterial({
      map: texture,
      emissiveMap: texture,
      emissive: '#ffffff',
      emissiveIntensity: 0,
      roughness: 0.5,
      clearcoat: 0.8,
      clearcoatRoughness: 0.22,
      envMap: environment,
      envMapIntensity: 0.25,
    });
    applyLockShader(coverMaterial, uniforms);

    const mesh = new Mesh(magazineGeometry, [
      pageEdgeMaterial,
      spineMaterial,
      pageEdgeMaterial,
      pageEdgeMaterial,
      coverMaterial,
      backCoverMaterial,
    ]);

    function sizePlate(aspect) {
      mesh.scale.set(Math.sqrt(ORNAMENT_AREA * aspect), Math.sqrt(ORNAMENT_AREA / aspect), 1);
      mesh.position.y = -STRING_LENGTH - mesh.scale.y / 2;
    }
    sizePlate(DEFAULT_COVER_ASPECT);

    const pivot = new Group();
    pivot.position.copy(placement.hook);
    pivot.rotation.y = placement.azimuth;
    pivot.add(new Line(stringGeometry, stringMaterial));
    pivot.add(mesh);
    group.add(pivot);

    return {
      entry,
      pivot,
      mesh,
      coverMesh: mesh,
      coverMaterial,
      texture,
      uniforms,
      placement,
      targetUnlock: 0,
      hoverAmount: 0,
      isHovered: false,
      shakeStartedAt: -Infinity,
      isNewest: false,
    };
  });

  return {
    ornaments,
    pickTargets: ornaments.map((ornament) => ornament.coverMesh),

    setUnlockedThroughDay(unlockedThroughDay, { animate }) {
      for (const ornament of ornaments) {
        ornament.targetUnlock = ornament.entry.day <= unlockedThroughDay ? 1 : 0;
        ornament.isNewest = ornament.entry.day === unlockedThroughDay;
        if (!animate) {
          ornament.uniforms.uUnlock.value = ornament.targetUnlock;
        }
      }
    },

    shake(ornament, elapsedSeconds) {
      ornament.shakeStartedAt = elapsedSeconds;
    },

    update(elapsedSeconds, deltaSeconds, { isReducedMotion }) {
      const ease = Math.min(1, deltaSeconds * 2.5);
      for (const ornament of ornaments) {
        const { placement, uniforms, coverMaterial, pivot, mesh } = ornament;
        uniforms.uUnlock.value += (ornament.targetUnlock - uniforms.uUnlock.value) * ease;
        coverMaterial.emissiveIntensity = UNLOCKED_EMISSIVE * uniforms.uUnlock.value;

        ornament.hoverAmount += ((ornament.isHovered ? 1 : 0) - ornament.hoverAmount) * Math.min(1, deltaSeconds * 10);
        const hoverScale = 1 + 0.06 * ornament.hoverAmount;
        pivot.scale.setScalar(hoverScale);

        const swayStrength = isReducedMotion ? 0 : ornament.isNewest ? 0.09 : 0.035;
        const shakeAge = elapsedSeconds - ornament.shakeStartedAt;
        const shake = shakeAge < 0.6 ? Math.sin(shakeAge * 40) * 0.12 * (1 - shakeAge / 0.6) : 0;
        pivot.rotation.z = placement.tilt + Math.sin(elapsedSeconds * 0.9 + placement.swayPhase) * swayStrength + shake;
        pivot.rotation.x = Math.sin(elapsedSeconds * 0.7 + placement.swayPhase * 1.3) * swayStrength * 0.6;
        mesh.rotation.y = Math.sin(elapsedSeconds * 0.5 + placement.swayPhase) * swayStrength * 1.5;
      }
    },

    dispose() {
      magazineGeometry.dispose();
      pageEdgeTexture.dispose();
      pageEdgeMaterial.dispose();
      spineMaterial.dispose();
      backCoverMaterial.dispose();
      stringMaterial.dispose();
      stringGeometry.dispose();
      for (const ornament of ornaments) {
        ornament.coverMaterial.dispose();
        ornament.texture.dispose();
      }
    },
  };
}

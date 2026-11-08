import {
  BufferAttribute,
  BufferGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshPhysicalMaterial,
} from 'three';

import { LEADER_TIP } from './buildTree.js';
import { createGlitterTexture } from './textures.js';

const STAR_POINTS = 5;
const OUTER_RADIUS = 0.62;
const INNER_RADIUS = 0.26;
const FACET_DEPTH = 0.2;
const MOUNT_LENGTH = 0.3;
// The mount slides this far down over the leader, sinking the star's lower points into the top twigs.
const MOUNT_OVERLAP = 0.62;

// Classic pressed-metal star: every point is two flat facets meeting at a ridge, front and back,
// so each face catches the light differently as it turns.
function createFacetedStarGeometry() {
  const outline = [];
  for (let index = 0; index < STAR_POINTS * 2; index += 1) {
    const radius = index % 2 === 0 ? OUTER_RADIUS : INNER_RADIUS;
    const angle = (index / (STAR_POINTS * 2)) * Math.PI * 2;
    outline.push([Math.sin(angle) * radius, Math.cos(angle) * radius]);
  }
  const positions = [];
  outline.forEach(([ax, ay], index) => {
    const [bx, by] = outline[(index + 1) % outline.length];
    positions.push(0, 0, FACET_DEPTH, bx, by, 0, ax, ay, 0);
    positions.push(0, 0, -FACET_DEPTH, ax, ay, 0, bx, by, 0);
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.computeVertexNormals();
  return geometry;
}

// Fixed to the leader, so it turns with the tree like a real topper.
export function createTreeTopper(group, { environment }) {
  const glitterTexture = createGlitterTexture();
  const goldMaterial = new MeshPhysicalMaterial({
    color: '#d19a2e',
    metalness: 1,
    roughness: 0.6,
    roughnessMap: glitterTexture,
    bumpMap: glitterTexture,
    bumpScale: 0.6,
    clearcoat: 0.4,
    clearcoatRoughness: 0.1,
    envMap: environment,
    envMapIntensity: 1.4,
    emissive: '#6a3c04',
    emissiveIntensity: 0.15,
  });

  const pivot = new Group();
  pivot.position.set(LEADER_TIP.x, LEADER_TIP.y - MOUNT_OVERLAP, LEADER_TIP.z);
  group.add(pivot);

  // Mounting tube that slips over the leader.
  const mountGeometry = new CylinderGeometry(0.045, 0.07, MOUNT_LENGTH, 14);
  const mount = new Mesh(mountGeometry, goldMaterial);
  mount.position.y = MOUNT_LENGTH / 2;
  pivot.add(mount);

  const starGeometry = createFacetedStarGeometry();
  const star = new Mesh(starGeometry, goldMaterial);
  star.position.y = MOUNT_LENGTH + INNER_RADIUS - 0.04;
  star.rotation.z = 0.05;
  pivot.add(star);

  return {
    dispose() {
      glitterTexture.dispose();
      goldMaterial.dispose();
      mountGeometry.dispose();
      starGeometry.dispose();
    },
  };
}

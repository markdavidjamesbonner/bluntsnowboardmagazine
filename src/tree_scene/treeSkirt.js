import { Float32BufferAttribute, Group, Mesh, MeshPhysicalMaterial, RingGeometry, TorusGeometry } from 'three';

import { createGlitterTexture, createTreeSkirtTexture } from './textures.js';

const INNER_RADIUS = 0.32;
const OUTER_RADIUS = 3.3;
const TRIM_THICKNESS = 0.14;
const FLOOR_LIFT = 0.015;

// Fabric bunches into soft radial folds that deepen toward the hem, and rides up a little at the trunk.
function drapeHeight(angle, radialProgress) {
  const ripple = 0.6 * Math.sin(angle * 9 + 0.7) + 0.4 * Math.sin(angle * 17 + 2.3);
  return (
    FLOOR_LIFT +
    0.02 * radialProgress +
    0.07 * radialProgress ** 1.5 * Math.max(0, ripple) +
    0.06 * (1 - radialProgress) ** 4
  );
}

function createDrapedSkirtGeometry() {
  const geometry = new RingGeometry(INNER_RADIUS, OUTER_RADIUS, 192, 24);
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.attributes.position;
  const colors = [];
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const z = position.getZ(index);
    const radialProgress = (Math.hypot(x, z) - INNER_RADIUS) / (OUTER_RADIUS - INNER_RADIUS);
    position.setY(index, drapeHeight(Math.atan2(z, x), radialProgress));
    // Darker toward the trunk, where the branches overhead block the light.
    const shade = 0.5 + 0.5 * Math.min(1, radialProgress * 1.6);
    colors.push(shade, shade, shade);
  }
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function createTrimGeometry() {
  const geometry = new TorusGeometry(OUTER_RADIUS, TRIM_THICKNESS, 10, 192);
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.attributes.position;
  for (let index = 0; index < position.count; index += 1) {
    const angle = Math.atan2(position.getZ(index), position.getX(index));
    position.setY(index, position.getY(index) + drapeHeight(angle, 1) + TRIM_THICKNESS * 0.55);
  }
  return geometry;
}

// Red velvet tree skirt with a plush white hem, sitting on the floor around the trunk.
export function createTreeSkirt(scene, { maxAnisotropy }) {
  const skirtTexture = createTreeSkirtTexture(maxAnisotropy);
  const skirtGeometry = createDrapedSkirtGeometry();
  const velvetMaterial = new MeshPhysicalMaterial({
    map: skirtTexture,
    vertexColors: true,
    roughness: 0.9,
    sheen: 1,
    sheenRoughness: 0.5,
    sheenColor: '#c23a48',
  });
  const trimGeometry = createTrimGeometry();
  // Speckled bump breaks up the hem's highlight into tufts so it reads as faux fur, not a plastic ring.
  const fluffTexture = createGlitterTexture();
  fluffTexture.repeat.set(90, 3);
  const plushMaterial = new MeshPhysicalMaterial({
    color: '#fbf8f2',
    roughness: 1,
    bumpMap: fluffTexture,
    bumpScale: 2.5,
    sheen: 1,
    sheenRoughness: 0.9,
    sheenColor: '#ffffff',
  });

  const group = new Group();
  group.add(new Mesh(skirtGeometry, velvetMaterial), new Mesh(trimGeometry, plushMaterial));
  scene.add(group);

  return {
    dispose() {
      skirtTexture.dispose();
      skirtGeometry.dispose();
      velvetMaterial.dispose();
      trimGeometry.dispose();
      fluffTexture.dispose();
      plushMaterial.dispose();
    },
  };
}

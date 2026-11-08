import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';

import { createSeededRandom } from '../utils/seededRandom.js';

// Fraser-fir palette: dark glossy tops, silvery-blue undersides, yellow-green new growth at the tips.
const NEEDLE_TOP_COLORS = ['#16301d', '#1c3a23', '#21432a', '#28502f', '#2f5834'];
const NEEDLE_UNDERSIDE_COLORS = ['#4d6e5e', '#58796a', '#647f70'];
const NEEDLE_NEW_GROWTH_COLORS = ['#4f7a37', '#5d8a40', '#6b964a'];
const NEW_GROWTH_START = 0.8;

function pick(random, colors) {
  return colors[Math.floor(random() * colors.length)];
}

function drawNeedledStem(context, random, start, angle, length, needleLength) {
  const directionX = Math.sin(angle);
  const directionY = -Math.cos(angle);

  context.strokeStyle = '#4a3c26';
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(start.x, start.y);
  context.lineTo(start.x + directionX * length, start.y + directionY * length);
  context.stroke();

  // Undersides first so the dark upper needles read as the top layer.
  for (const layer of ['underside', 'top']) {
    for (let distance = 0; distance < length; distance += layer === 'top' ? 2.2 : 3.4) {
      const progress = distance / length;
      const baseX = start.x + directionX * distance;
      const baseY = start.y + directionY * distance;
      const taper = 1 - progress * 0.5;

      for (const side of [-1, 1]) {
        const needleAngle = angle + side * random.range(0.55, 1.05);
        const reach = needleLength * taper * random.range(0.75, 1.05) * (layer === 'top' ? 1 : 0.9);
        let color = pick(random, layer === 'top' ? NEEDLE_TOP_COLORS : NEEDLE_UNDERSIDE_COLORS);
        if (progress > NEW_GROWTH_START && random() < 0.75) {
          color = pick(random, NEEDLE_NEW_GROWTH_COLORS);
        }
        context.strokeStyle = color;
        context.lineWidth = random.range(1.8, 2.8);
        context.beginPath();
        context.moveTo(baseX, baseY);
        context.lineTo(baseX + Math.sin(needleAngle) * reach, baseY - Math.cos(needleAngle) * reach);
        context.stroke();
      }
    }
  }
}

// One needled twig (stem + a few short side shoots) on transparent ground, shared by every foliage card.
export function createNeedleTexture(maxAnisotropy) {
  const width = 256;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  const random = createSeededRandom(7);
  context.lineCap = 'round';

  const stemLength = height - 24;
  for (const progress of [0.12, 0.3, 0.48]) {
    const start = { x: width / 2, y: height - 10 - progress * stemLength };
    const shootLength = 150 * (1 - progress * 0.8);
    for (const side of [-1, 1]) {
      drawNeedledStem(context, random, start, side * random.range(0.45, 0.65), shootLength, 26);
    }
  }
  drawNeedledStem(context, random, { x: width / 2, y: height - 10 }, 0, stemLength, 34);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  return texture;
}

// Soft falloff sprite for the halo around each lit bulb (additively blended).
export function createGlowTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.18, 'rgba(255, 255, 255, 0.55)');
  gradient.addColorStop(0.45, 'rgba(255, 255, 255, 0.14)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  return new CanvasTexture(canvas);
}

// Speckled roughness/bump map: scattered mirror-smooth flecks read as glitter on the star's metal.
export function createGlitterTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  const random = createSeededRandom(1224);
  context.fillStyle = 'rgb(96, 96, 96)';
  context.fillRect(0, 0, size, size);
  for (let index = 0; index < 5200; index += 1) {
    const level = random() < 0.55 ? random.range(0, 40) : random.range(150, 230);
    context.fillStyle = `rgb(${level}, ${level}, ${level})`;
    context.fillRect(Math.floor(random() * size), Math.floor(random() * size), 2, 2);
  }
  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(2, 2);
  return texture;
}

// Stacked page edges: fine off-white lines running along the texture's v axis.
export function createPageEdgeTexture() {
  const width = 128;
  const height = 4;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  const random = createSeededRandom(1993);
  for (let x = 0; x < width; x += 1) {
    const level = Math.round(random.range(212, 246));
    context.fillStyle = `rgb(${level}, ${level - 3}, ${level - 10})`;
    context.fillRect(x, 0, 1, height);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function drawSnowflake(context, x, y, size, rotation) {
  context.save();
  context.translate(x, y);
  context.rotate(rotation);
  context.beginPath();
  for (let arm = 0; arm < 6; arm += 1) {
    context.rotate(Math.PI / 3);
    context.moveTo(0, 0);
    context.lineTo(0, -size);
    for (const along of [0.45, 0.72]) {
      const branch = size * (1 - along) * 0.6;
      context.moveTo(0, -size * along);
      context.lineTo(-branch, -size * along - branch);
      context.moveTo(0, -size * along);
      context.lineTo(branch, -size * along - branch);
    }
  }
  context.stroke();
  context.restore();
}

// Top-down print for the tree skirt (mapped by the ring's planar UVs): red velvet pile, two rings
// of cream snowflakes, and a thin gold band just inside the plush trim.
export function createTreeSkirtTexture(maxAnisotropy) {
  const size = 1024;
  const center = size / 2;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  const random = createSeededRandom(1225);

  context.fillStyle = '#8f0f1c';
  context.fillRect(0, 0, size, size);
  for (let index = 0; index < 26000; index += 1) {
    const shade = random() < 0.5 ? 'rgba(40, 0, 6, 0.18)' : 'rgba(255, 90, 100, 0.07)';
    context.fillStyle = shade;
    context.fillRect(random() * size, random() * size, 2, 2);
  }

  context.lineCap = 'round';
  context.strokeStyle = '#f3e9d2';
  context.lineWidth = 3.5;
  for (const { radius, count, flakeSize, offset } of [
    { radius: 0.5, count: 10, flakeSize: 30, offset: 0 },
    { radius: 0.74, count: 16, flakeSize: 38, offset: 0.5 },
  ]) {
    for (let index = 0; index < count; index += 1) {
      const angle = ((index + offset) / count) * Math.PI * 2;
      const distance = radius * center;
      drawSnowflake(
        context,
        center + Math.cos(angle) * distance,
        center + Math.sin(angle) * distance,
        flakeSize,
        angle,
      );
    }
  }

  context.strokeStyle = '#d4a53c';
  context.lineWidth = 6;
  context.beginPath();
  context.arc(center, center, 0.88 * center, 0, Math.PI * 2);
  context.stroke();

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  return texture;
}

export function createContactShadowTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(38, 30, 22, 0.42)');
  gradient.addColorStop(0.45, 'rgba(38, 30, 22, 0.16)');
  gradient.addColorStop(1, 'rgba(38, 30, 22, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  return new CanvasTexture(canvas);
}

import * as THREE from 'three';

// Colours measured from the reference video (see REFERENCE-ANALYSIS.md).
export const PALETTE = {
  grass: 0x6dc611,
  grassLight: 0x6fc72d,
  dirt: 0x955739,
  dirtDark: 0x77360c,
  dirtLight: 0xa65829,
  fence: 0x725231,
  fenceBlue: 0x82aab6,
  skyTop: 0x13edfa,
  skyHorizon: 0x90d4f0,
  cloud: 0xecfbf8,
  nightTop: 0x070f13,
  nightHorizon: 0x062324,
  road: 0xb0d3e4,
  roadLine: 0xf0f9f9,
  stone: 0x909478,
  stoneLight: 0xb1cbab,
  mountain: 0x526c73,
  snow: 0xb0cbec,
  barn: 0xc8202a,
  barnRoof: 0x2f5fa8,
  car: 0xf0f9f9,
  carGlass: 0x1f2f4a,
  chest: 0xe6ef1c,
  chestRed: 0xc0202a,
  cyan: 0x19d3ff,
  navy: 0x0b1a2e,
};

export function shade(hex, f) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(f);
  return `#${c.getHexString()}`;
}

const cache = new Map();

// "Lego plate" pattern: a grid of slightly raised rounded tiles in a lighter and darker shade of the base colour.
export function studTexture(hex, { cells = 4, size = 128, light = 1.07, dark = 0.86 } = {}) {
  const key = `${hex}|${cells}|${light}|${dark}`;
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = `#${new THREE.Color(hex).getHexString()}`;
  ctx.fillRect(0, 0, size, size);
  const cell = size / cells;
  const pad = cell * 0.12;
  for (let i = 0; i < cells; i++) {
    for (let j = 0; j < cells; j++) {
      const x = i * cell + pad;
      const y = j * cell + pad;
      const w = cell - pad * 2;
      ctx.fillStyle = shade(hex, dark);
      ctx.beginPath();
      ctx.roundRect(x + 1.5, y + 1.5, w, w, cell * 0.16);
      ctx.fill();
      ctx.fillStyle = shade(hex, light);
      ctx.beginPath();
      ctx.roundRect(x, y, w, w, cell * 0.16);
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  cache.set(key, tex);
  return tex;
}

// a textured material whose pattern repeats every `tile` world units
export function studMaterial(hex, repeatX, repeatY, opts = {}) {
  const base = studTexture(hex, opts);
  const tex = base.clone();
  tex.needsUpdate = true;
  tex.repeat.set(repeatX, repeatY);
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0 });
}

// brick pattern for the dirt cliffs: warm sunlit orange-brown (never dark / black)
const DIRT = 0xb8642f;
export function dirtTexture() {
  const key = 'dirt';
  if (cache.has(key)) return cache.get(key);
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = `#${new THREE.Color(DIRT).getHexString()}`;
  ctx.fillRect(0, 0, size, size);
  const cell = size / 4;
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      ctx.fillStyle = (i + j) % 2 ? shade(DIRT, 0.93) : shade(DIRT, 1.06);
      ctx.fillRect(i * cell, j * cell, cell, cell);
      ctx.strokeStyle = shade(DIRT, 0.86);
      ctx.lineWidth = 1.5;
      ctx.strokeRect(i * cell + 2, j * cell + 2, cell - 4, cell - 4);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, tex);
  return tex;
}

// ash-grey rock for the walls along the track: slabs with uneven lighter / darker chips and cracks
export function rockTexture() {
  const key = 'rock';
  if (cache.has(key)) return cache.get(key);
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const ROCK = 0x7a8089;
  ctx.fillStyle = shade(ROCK, 1);
  ctx.fillRect(0, 0, size, size);
  let s = 7;
  const r = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  for (let i = 0; i < 26; i++) {
    const w = 14 + r() * 34;
    const h = 10 + r() * 26;
    ctx.fillStyle = shade(ROCK, 0.78 + r() * 0.5);
    ctx.fillRect(r() * size, r() * size, w, h);
  }
  ctx.strokeStyle = shade(ROCK, 0.6);
  ctx.lineWidth = 2;
  for (let i = 0; i < 7; i++) {
    let x = r() * size;
    let y = r() * size;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 4; k++) { x += (r() - 0.5) * 30; y += r() * 22; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, tex);
  return tex;
}

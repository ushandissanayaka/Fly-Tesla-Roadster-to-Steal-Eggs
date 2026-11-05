import * as THREE from 'three';

const cache = new Map();

// shared flat-shaded material per colour
export function mat(color, opts = {}) {
  const key = `${color}|${opts.emissive || 0}|${opts.metal || 0}|${opts.rough ?? ''}`;
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      roughness: opts.rough ?? 0.7,
      metalness: opts.metal ?? 0,
      emissive: opts.emissive ?? 0x000000,
      emissiveIntensity: opts.emissive ? 0.8 : 0,
      flatShading: true,
    });
    cache.set(key, m);
  }
  return m;
}

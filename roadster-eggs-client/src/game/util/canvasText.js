import * as THREE from 'three';

// a floating text label (name tags, signs) drawn on a canvas
export function textSprite(text, { color = '#ffffff', size = 44, bg = 'rgba(0,0,0,0.45)', scale = 0.02 } = {}) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const font = `700 ${size}px Fredoka, 'Segoe UI', sans-serif`;
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + 36;
  const h = size + 22;
  c.width = w;
  c.height = h;
  ctx.font = font;
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText(text, w / 2, h / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set(w * scale, h * scale, 1);
  s.userData.dispose = () => { tex.dispose(); s.material.dispose(); };
  return s;
}

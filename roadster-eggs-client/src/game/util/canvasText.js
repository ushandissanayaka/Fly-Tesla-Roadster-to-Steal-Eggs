import * as THREE from 'three';

function draw(canvas, lines, { size, bg, scale, sprite }) {
  const ctx = canvas.getContext('2d');
  const rows = lines.map((l) => (typeof l === 'string' ? { text: l } : l));
  const fonts = rows.map((r) => `800 ${r.size || size}px Fredoka, 'Segoe UI', sans-serif`);
  let w = 0;
  rows.forEach((r, i) => { ctx.font = fonts[i]; w = Math.max(w, ctx.measureText(r.text).width); });
  w = Math.ceil(w) + 40;
  const h = Math.ceil(rows.reduce((s, r) => s + (r.size || size) * 1.2, 0)) + 16;
  canvas.width = w;
  canvas.height = h;
  if (bg) {
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, Math.min(h / 2, 36));
    ctx.fill();
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  let y = 8;
  rows.forEach((r, i) => {
    const sz = r.size || size;
    ctx.font = fonts[i];
    y += sz * 0.6;
    ctx.lineWidth = Math.max(4, sz * 0.18);
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText(r.text, w / 2, y);
    ctx.fillStyle = r.color || '#ffffff';
    ctx.fillText(r.text, w / 2, y);
    y += sz * 0.6;
  });
  if (sprite) sprite.scale.set(w * scale, h * scale, 1);
}

// A floating label: bold white text with a black outline (like the reference game's world labels).
// `lines` is a string or [{ text, color, size }]. Call sprite.userData.set(lines) to change the text.
export function textSprite(lines, { color = '#ffffff', size = 44, bg = null, scale = 0.02 } = {}) {
  const canvas = document.createElement('canvas');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  const set = (value) => {
    const arr = Array.isArray(value) ? value : [value];
    draw(canvas, arr.map((l) => (typeof l === 'string' ? { text: l, color } : l)), { size, bg, scale, sprite });
    tex.needsUpdate = true;
  };
  set(lines);
  sprite.userData.set = set;
  sprite.userData.dispose = () => { tex.dispose(); sprite.material.dispose(); };
  return sprite;
}

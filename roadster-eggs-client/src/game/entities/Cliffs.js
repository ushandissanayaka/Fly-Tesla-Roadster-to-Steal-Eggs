import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PALETTE, dirtTexture, rockTexture, studTexture } from '../util/textures.js';

// The reference game's walls are not smooth cliffs: they are big Lego-like blocks, each one a brown dirt box
// with a green grass slab on top, every block a different height, stacked in 2-3 rows that step back.
// All blocks are merged into two meshes (dirt + grass) with UVs in world units so the brick / stud
// pattern keeps the same size on every block.

const TILE = 8;   // world units per texture repeat

// BoxGeometry with UVs scaled to its face sizes (face order: +x, -x, +y, -y, +z, -z; 4 verts each)
export function worldBox(w, h, d, x, y, z, tile = TILE) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const faces = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      uv.setXY(i, uv.getX(i) * faces[f][0] / tile, uv.getY(i) * faces[f][1] / tile);
    }
  }
  g.translate(x, y, z);
  return g;
}

function rng(seed) {
  let s = seed;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

// line: { a: [x, z], b: [x, z], n: [nx, nz] } - axis aligned; n points into the playable area,
// the blocks go behind the line. extA / extB carry the blocks past the a / b end so two walls that meet
// close the corner with no gap. Returns the footprint rectangle of a..b (for collision).
function addWall(line, dirt, grass, rnd, rows = 3, tops = null) {
  const stone = !!line.stone;   // grey stone town blocks: narrower, taller pillars
  const rock = !!line.rock;     // ash-grey rock along the track: a bit taller than the brown dirt, grass tops, misty peaks
  const [ax, az] = line.a;
  const [bx, bz] = line.b;
  const [nx, nz] = line.n;
  const extA = line.extA ?? 0;
  const extB = line.extB ?? 0;
  const alongX = Math.abs(bx - ax) > Math.abs(bz - az);
  const len = alongX ? Math.abs(bx - ax) : Math.abs(bz - az);
  const dir = alongX ? Math.sign(bx - ax) : Math.sign(bz - az);
  const GRASS = 3.2;   // thick green slab on top of every block
  let depthTotal = 0;
  for (let k = 0; k < rows; k++) {
    let t = -2 - extA;
    const end = len + extB + 2;
    const back = k * (stone ? 17 : 24);   // each row steps back (and up)
    while (t < end - 0.5) {
      if (rock) {
        const w = Math.min(10 + rnd() * 16, end - t);
        const d = 22 + rnd() * 14;
        const setback = k * 20 + rnd() * 6;
        let h = 30 + k * 20 + rnd() * 18;
        if (rnd() < 0.18) h += 12 + rnd() * 16;   // the odd tall spire (its top fades into the mist)
        const mid = t + w / 2;
        const off = setback + d / 2;
        const cx = alongX ? ax + dir * mid : ax - nx * off;
        const cz = alongX ? az - nz * off : az + dir * mid;
        const sx = alongX ? w + 0.3 : d;
        const sz = alongX ? d : w + 0.3;
        dirt.push(worldBox(sx, h, sz, cx, h / 2, cz, 16));
        grass.push(worldBox(sx + 1.2, 3.2, sz + 1.2, cx, h + 1.1, cz, TILE / 2));   // thick grass top, like the brown blocks
        // crag: a smaller block sitting off-centre on top of some blocks
        if (rnd() < 0.45) {
          const cw = sx * (0.35 + rnd() * 0.3);
          const cd = sz * (0.35 + rnd() * 0.3);
          const ch = 5 + rnd() * 12;
          const ox = (rnd() - 0.5) * (sx - cw) * 0.8;
          const oz = (rnd() - 0.5) * (sz - cd) * 0.8;
          dirt.push(worldBox(cw, ch, cd, cx + ox, h + ch / 2, cz + oz, 16));
          grass.push(worldBox(cw + 1, 2.6, cd + 1, cx + ox, h + ch + 0.8, cz + oz, TILE / 2));
        }
        depthTotal = Math.max(depthTotal, setback + d);
        t += w;
        continue;
      }
      // every block its own width / depth / height: narrow pillars, wide slabs, the odd tall tower
      const wide = rnd() < 0.3;
      const w = Math.min(stone ? 10 + rnd() * 8 : wide ? 30 + rnd() * 16 : 12 + rnd() * 16, end - t);
      const d = stone ? 14 + rnd() * 6 : 28 + rnd() * 16;
      const setback = back + rnd() * (k === 0 ? 3 : 8);
      let h = stone ? 26 + k * 12 + rnd() * 16 : 14 + k * 19 + rnd() * 15;
      if (!stone && rnd() < 0.14) h += 10 + rnd() * 14;
      const mid = t + w / 2;
      const off = setback + d / 2;
      const cx = alongX ? ax + dir * mid : ax - nx * off;
      const cz = alongX ? az - nz * off : az + dir * mid;
      const sx = alongX ? w + 0.3 : d;
      const sz = alongX ? d : w + 0.3;
      dirt.push(worldBox(sx, h, sz, cx, h / 2, cz, 16));
      grass.push(worldBox(sx + 1.2, GRASS, sz + 1.2, cx, h + GRASS / 2 - 0.5, cz, TILE / 2));
      if (tops && !stone) tops.push({ cx, cz, sx, sz, y: h + GRASS - 0.5, row: k });
      // a low ledge in front of some bottom-row blocks (still behind the line, so it never blocks the field)
      if (!stone && k === 0 && w > 14 && rnd() < 0.35) {
        const lw = w * (0.4 + rnd() * 0.4);
        const lh = Math.max(5, h * (0.3 + rnd() * 0.25));
        const lmid = t + (rnd() < 0.5 ? lw / 2 : w - lw / 2);
        const loff = 0.2 + 3;
        const lx = alongX ? ax + dir * lmid : ax - nx * loff;
        const lz = alongX ? az - nz * loff : az + dir * lmid;
        const lsx = alongX ? lw : 6;
        const lsz = alongX ? 6 : lw;
        dirt.push(worldBox(lsx, lh, lsz, lx, lh / 2, lz, 16));
        grass.push(worldBox(lsx + 1.2, GRASS, lsz + 1.2, lx, lh + GRASS / 2 - 0.5, lz, TILE / 2));
        if (tops) tops.push({ cx: lx, cz: lz, sx: lsx, sz: lsz, y: lh + GRASS - 0.5, row: -1 });
      }
      depthTotal = Math.max(depthTotal, setback + d);
      t += w;
    }
  }
  // footprint behind the line
  const x0 = alongX ? Math.min(ax, bx) : nx > 0 ? ax - depthTotal : ax;
  const x1 = alongX ? Math.max(ax, bx) : nx > 0 ? ax : ax + depthTotal;
  const z0 = alongX ? (nz > 0 ? az - depthTotal : az) : Math.min(az, bz);
  const z1 = alongX ? (nz > 0 ? az : az + depthTotal) : Math.max(az, bz);
  return { x0, x1, z0, z1, line };
}

// Each wall line becomes its own two meshes (body + green tops) so the camera can cull the ones it can't see.
// line.stone = grey stone town blocks instead of brown dirt.
let mats = null;
const WALL_LIFT = 0.6;
const ROCK_LIFT = 0.35;   // ash grey on every face, never black

// mist: everything above MIST_LO fades towards the mist colour, fully misty by MIST_HI
const MIST_LO = 48;
const MIST_HI = 105;
const BROWN_MIST_LO = 38;   // the brown lobby walls: a lighter haze over their upper rows
const BROWN_MIST_HI = 95;
const mistUniforms = { uMistColor: { value: new THREE.Color(0xe8f4f8) } };
const DAY_MIST = new THREE.Color(0xe8f4f8);
const NIGHT_MIST = new THREE.Color(0x1a2a36);
function addMist(material, lo = MIST_LO, hi = MIST_HI, amount = 0.88) {
  material.onBeforeCompile = (sh) => {
    sh.uniforms.uMistColor = mistUniforms.uMistColor;
    sh.vertexShader = `varying float vMistY;
${sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
  vMistY = (modelMatrix * vec4(transformed, 1.0)).y;`)}`;
    sh.fragmentShader = `uniform vec3 uMistColor;
varying float vMistY;
${sh.fragmentShader.replace('#include <fog_fragment>', `#include <fog_fragment>
  gl_FragColor.rgb = mix(gl_FragColor.rgb, uMistColor, smoothstep(${lo.toFixed(1)}, ${hi.toFixed(1)}, vMistY) * ${amount.toFixed(2)});`)}`;
  };
  material.customProgramCacheKey = () => `mist${lo}|${hi}|${amount}`;
  return material;
}
// f = 0 day .. 1 night
export function setWallNight(f) {
  if (!mats) return;
  mats.dirt.emissiveIntensity = WALL_LIFT * (1 - 0.85 * f);
  mats.grass.emissiveIntensity = WALL_LIFT * 0.8 * (1 - 0.85 * f);
  mats.rock.emissiveIntensity = ROCK_LIFT * (1 - 0.85 * f);
  mats.rockCap.emissiveIntensity = WALL_LIFT * 0.8 * (1 - 0.85 * f);
  mistUniforms.uMistColor.value.copy(DAY_MIST).lerp(NIGHT_MIST, f);
  if (tuftMat) tuftMat.color.setScalar(1 - 0.75 * f);
  if (puffMat) { puffMat.color.copy(mistUniforms.uMistColor.value); puffMat.opacity = 0.75 - 0.35 * f; }
}
function wallMaterials() {
  if (mats) return mats;
  // the lobby cliffs stay a warm orange-brown on every face: the emissive lift (same texture) keeps the faces
  // that look away from the sun brown instead of going near-black; it fades down at night (setWallNight)
  const dirtMap = dirtTexture();
  const dirt = addMist(new THREE.MeshStandardMaterial({ map: dirtMap, roughness: 0.95, emissiveMap: dirtMap, emissive: 0xffffff, emissiveIntensity: WALL_LIFT }), BROWN_MIST_LO, BROWN_MIST_HI, 0.55);
  dirt.color.setScalar(1.1);
  const grassMap = studTexture(PALETTE.grassLight);
  const grassPlain = new THREE.MeshStandardMaterial({ map: grassMap, roughness: 0.85, emissiveMap: grassMap, emissive: 0xffffff, emissiveIntensity: WALL_LIFT * 0.8 });
  grassPlain.color.setScalar(1.15);
  const grass = addMist(grassPlain.clone(), BROWN_MIST_LO, BROWN_MIST_HI, 0.55);
  const stone = new THREE.MeshStandardMaterial({ map: studTexture(PALETTE.stone, { cells: 2 }), roughness: 0.9 });
  stone.color.setScalar(1.2);
  const moss = new THREE.MeshStandardMaterial({ map: studTexture(0x57d63a), roughness: 0.85 });
  const rockMap = rockTexture();
  const rock = addMist(new THREE.MeshStandardMaterial({ map: rockMap, roughness: 0.95, emissiveMap: rockMap, emissive: 0xffffff, emissiveIntensity: ROCK_LIFT, flatShading: true }));
  const rockCap = addMist(grassPlain.clone());   // grass tops on the rock, fading into the mist on the tall ones
  mats = { dirt, grass, stone, moss, rock, rockCap };
  return mats;
}

export function buildBlockWalls(scene, lines, seed = 5) {
  const rnd = rng(seed);
  const m = wallMaterials();
  const tops = [];
  const rects = lines.map((l) => {
    const body = [];
    const top = [];
    const rect = addWall(l, body, top, rnd, l.rows ?? 3, l.rock || l.stone ? null : tops);
    const bm = new THREE.Mesh(mergeGeometries(body), l.rock ? m.rock : l.stone ? m.stone : m.dirt);
    const tm = new THREE.Mesh(mergeGeometries(top), l.rock ? m.rockCap : l.stone ? m.moss : m.grass);
    bm.receiveShadow = tm.receiveShadow = true;
    bm.castShadow = false;   // huge blocks: their shadows only darkened the field edge and cost a shadow pass
    bm.matrixAutoUpdate = tm.matrixAutoUpdate = false;
    scene.add(bm, tm);
    body.forEach((g) => g.dispose());
    top.forEach((g) => g.dispose());
    return rect;
  });
  buildGrassTufts(scene, tops, rng(seed + 101));
  buildMistPuffs(scene, tops, rng(seed + 202));
  return rects;
}

// blocky grey mountains with green tops (and snow on the tallest) behind the walls
// (built in chunks along x so far-away chunks are culled)
const mmCache = new Map();
const mountainMat = (color) => {
  if (!mmCache.has(color)) mmCache.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.95, flatShading: true }));
  return mmCache.get(color);
};

export function buildMountains(scene, spots, seed = 9) {
  const chunks = new Map();
  for (const sp of spots) {
    const k = Math.floor(sp[0] / 500);
    if (!chunks.has(k)) chunks.set(k, []);
    chunks.get(k).push(sp);
  }
  let n = 0;
  for (const list of chunks.values()) buildMountainChunk(scene, list, seed + n++);
}

function buildMountainChunk(scene, spots, seed) {
  const rnd = rng(seed);
  const rock = [];
  const rock2 = [];
  const green = [];
  const snow = [];
  for (const [x, z, scale] of spots) {
    let w = (70 + rnd() * 50) * scale;
    let d = (70 + rnd() * 50) * scale;
    let y = 0;
    const layers = 3 + Math.floor(rnd() * 3);
    for (let k = 0; k < layers; k++) {
      const h = (40 + rnd() * 35) * scale;
      const ox = (rnd() - 0.5) * w * 0.25;
      const oz = (rnd() - 0.5) * d * 0.25;
      (k % 2 ? rock2 : rock).push(worldBox(w, h, d, x + ox, y + h / 2, z + oz, 24));
      const top = k === layers - 1 && layers >= 4 ? snow : green;
      top.push(worldBox(w * 0.96, 4, d * 0.96, x + ox, y + h + 2, z + oz, 24));
      y += h;
      w *= 0.62 + rnd() * 0.12;
      d *= 0.62 + rnd() * 0.12;
    }
  }
  const mk = (list, color) => {
    if (!list.length) return;
    const m = new THREE.Mesh(mergeGeometries(list), mountainMat(color));
    m.matrixAutoUpdate = false;
    scene.add(m);
    list.forEach((g) => g.dispose());
  };
  mk(rock, 0x8d9aa3);
  mk(rock2, 0x7c8a94);
  mk(green, 0x5fc43c);
  mk(snow, 0xf2f7fb);
}

// ---------------------------------------------------------------- grass tufts + mist on the brown walls

const fx = { time: { value: 0 } };
let tuftMat = null;
let puffMat = null;
const puffs = [];

function tuftTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  let s = 3;
  const r = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const greens = ['#4fae1c', '#63c524', '#79d930', '#3f9a18', '#8fe63c'];
  for (let i = 0; i < 22; i++) {
    const x = 6 + r() * 52;
    const h = 30 + r() * 32;
    const bend = (r() - 0.5) * 18;
    const w = 2.5 + r() * 2.5;
    ctx.fillStyle = greens[Math.floor(r() * greens.length)];
    ctx.beginPath();
    ctx.moveTo(x - w, 64);
    ctx.quadraticCurveTo(x - w * 0.3 + bend * 0.4, 64 - h * 0.55, x + bend, 64 - h);
    ctx.quadraticCurveTo(x + w * 0.3 + bend * 0.4, 64 - h * 0.55, x + w, 64);
    ctx.closePath();
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// crossed grass cards scattered over every brown block top: one instanced draw call, swaying in the wind
function buildGrassTufts(scene, tops, rnd) {
  if (!tops.length) return;
  const W = 2.6;
  const H = 2.2;
  const a = new THREE.PlaneGeometry(W, H);
  a.translate(0, H / 2, 0);
  const b = a.clone();
  b.rotateY(Math.PI / 2);
  const geo = mergeGeometries([a, b]);
  a.dispose();
  b.dispose();
  tuftMat = new THREE.MeshLambertMaterial({ map: tuftTexture(), alphaTest: 0.45, side: THREE.DoubleSide });
  tuftMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = fx.time;
    sh.vertexShader = `uniform float uTime;
${sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
  #ifdef USE_INSTANCING
    float ph = instanceMatrix[3].x * 0.21 + instanceMatrix[3].z * 0.17;
  #else
    float ph = 0.0;
  #endif
  float sway = (sin(uTime * 1.9 + ph) + 0.4 * sin(uTime * 3.3 + ph * 1.7)) * 0.16 * position.y;
  transformed.x += sway;
  transformed.z += sway * 0.6;`)}`;
  };
  tuftMat.customProgramCacheKey = () => 'tuft';

  const spots = [];
  for (const t of tops) {
    const n = Math.min(26, Math.max(3, Math.round((t.sx * t.sz) / 22)));
    for (let i = 0; i < n; i++) spots.push([t.cx + (rnd() - 0.5) * (t.sx - 0.6), t.y, t.cz + (rnd() - 0.5) * (t.sz - 0.6)]);
    // a denser fringe along the block edges, so the grass reads from the field below too
    const edge = Math.round((t.sx + t.sz) / 6);
    for (let i = 0; i < edge; i++) {
      const alongX = rnd() < t.sx / (t.sx + t.sz);
      const side = rnd() < 0.5 ? -0.5 : 0.5;
      const ex = alongX ? t.cx + (rnd() - 0.5) * t.sx : t.cx + side * (t.sx - 0.4);
      const ez = alongX ? t.cz + side * (t.sz - 0.4) : t.cz + (rnd() - 0.5) * t.sz;
      spots.push([ex, t.y, ez]);
    }
  }
  const mesh = new THREE.InstancedMesh(geo, tuftMat, spots.length);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const col = new THREE.Color();
  spots.forEach(([x, y, z], i) => {
    const k = 0.7 + rnd() * 0.8;
    e.set(0, rnd() * Math.PI, 0);
    q.setFromEuler(e);
    p.set(x, y - 0.1, z);
    sc.set(k, k * (0.8 + rnd() * 0.5), k);
    mesh.setMatrixAt(i, m4.compose(p, q, sc));
    mesh.setColorAt(i, col.setHSL(0.26 + rnd() * 0.05, 0.75, 0.42 + rnd() * 0.14));
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  scene.add(mesh);
}

function puffTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  for (const [x, y, r] of [[64, 70, 50], [40, 72, 34], [88, 70, 36], [62, 54, 34]]) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// soft mist banks drifting over the tops of the brown walls
function buildMistPuffs(scene, tops, rnd) {
  const high = tops.filter((t) => t.row >= 1);
  if (!high.length) return;
  puffMat = new THREE.SpriteMaterial({ map: puffTexture(), color: 0xe8f4f8, transparent: true, opacity: 0.75, depthWrite: false });
  const count = Math.min(90, Math.round(high.length * 0.55));
  for (let i = 0; i < count; i++) {
    const t = high[Math.floor(rnd() * high.length)];
    const s = new THREE.Sprite(puffMat);
    const w = 34 + rnd() * 40;
    s.scale.set(w, w * (0.32 + rnd() * 0.15), 1);
    s.position.set(t.cx + (rnd() - 0.5) * t.sx, t.y + 3 + rnd() * 7, t.cz + (rnd() - 0.5) * t.sz);
    s.renderOrder = 2;
    s.userData = { x: s.position.x, z: s.position.z, ph: rnd() * Math.PI * 2, amp: 4 + rnd() * 6 };
    scene.add(s);
    puffs.push(s);
  }
}

// per frame: grass sway + mist drift
export function updateWallFx(time) {
  fx.time.value = time;
  for (const s of puffs) {
    const u = s.userData;
    s.position.x = u.x + Math.sin(time * 0.12 + u.ph) * u.amp;
    s.position.z = u.z + Math.cos(time * 0.09 + u.ph) * u.amp * 0.6;
  }
}

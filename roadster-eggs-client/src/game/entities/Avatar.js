import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { mat } from '../util/materials.js';

// Roblox-style smiley face drawn on the front of the head
let faceTex = null;
function faceTexture() {
  if (faceTex) return faceTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f4f4f2';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#1b1b1b';
  for (const x of [44, 84]) {
    ctx.beginPath();
    ctx.ellipse(x, 58, 6, 10, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = '#1b1b1b';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(64, 72, 22, 0.2 * Math.PI, 0.8 * Math.PI);
  ctx.stroke();
  faceTex = new THREE.CanvasTexture(c);
  faceTex.colorSpace = THREE.SRGBColorSpace;
  return faceTex;
}

// Fallback block character (shown while the Bloxity character downloads, or offline): white skin,
// smiley face, big brown hair, black open jacket over a blue shirt, dark trousers, white shoes).
// ~3.5 units tall, faces +Z. In the lobby you walk; the moment you step onto the track you are put in the roadster.
function makeBlockAvatar(shirt = 0x1b1c20) {
  const g = new THREE.Group();
  const skin = mat(0xf4f4f2);
  const pants = mat(0x1f2a28);
  const jacket = mat(shirt);
  const hairMat = mat(0xb5651d);

  const limb = (w, h, d, material, x, y, tip, tipMat) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.y = -h / 2;
    m.castShadow = true;
    pivot.add(m);
    if (tip) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(w * 1.04, h * tip, d * 1.04), tipMat);
      t.position.y = -h * (1 - tip / 2);
      pivot.add(t);
    }
    g.add(pivot);
    return pivot;
  };

  const legL = limb(0.68, 1.4, 0.7, pants, -0.35, 1.4, 0.2, mat(0xf2f2f2));
  const legR = limb(0.68, 1.4, 0.7, pants, 0.35, 1.4, 0.2, mat(0xf2f2f2));
  const armL = limb(0.62, 1.35, 0.62, jacket, -1.02, 2.78, 0.3, skin);    // jacket sleeve + white hand
  const armR = limb(0.62, 1.35, 0.62, jacket, 1.02, 2.78, 0.3, skin);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 0.72), jacket);
  torso.position.y = 2.1;
  torso.castShadow = true;
  const shirtFront = new THREE.Mesh(new THREE.BoxGeometry(0.62, 1.38, 0.74), mat(0x2f8fd6));
  shirtFront.position.y = 2.1;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.86, 0.86), [
    skin, skin, skin, skin,
    new THREE.MeshStandardMaterial({ map: faceTexture(), roughness: 0.7 }),
    skin,
  ]);
  head.position.y = 3.25;
  head.castShadow = true;
  // big boxy hair (top + sides + back + fringe)
  const hairTop = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.5, 1.06), hairMat);
  hairTop.position.y = 3.86;
  const hairBack = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.8, 0.26), hairMat);
  hairBack.position.set(0, 3.42, -0.42);
  const hairL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.62, 1.0), hairMat);
  hairL.position.set(-0.5, 3.48, -0.02);
  const hairR = hairL.clone();
  hairR.position.x = 0.5;
  const fringe = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.24, 0.22), hairMat);
  fringe.position.set(0, 3.58, 0.44);
  hairTop.castShadow = true;
  g.add(torso, shirtFront, head, hairTop, hairBack, hairL, hairR, fringe);

  g.userData = { legL, legR, armL, armR, phase: 0, amp: 0 };
  return g;
}

// ---------------------------------------------------------------- the Bloxity base character
//
// The same character the Bloxity platform uses everywhere: static.bloxity.io/avatars/player.glb (a 6.4-unit
// skinned blocky body: head, torso, two arms, two legs on a small rig), a 64x64 pixel skin texture, optional
// replacement body parts (GLB), a hat on the Neck1 bone and a back item on Spine2 (OBJ). Built the same way as
// the SDK's own character preview. While it downloads (or if it can't), the block avatar above is shown.

const STATIC = 'https://static.bloxity.io';
const ALLOWED = /^https:\/\/(static|api)\.bloxity\.io\//;
const CHAR_HEIGHT = 6.4;
const SCALE = 3.5 / CHAR_HEIGHT;            // same size as the block avatar (the car is sized around it)
const PARTS = {
  head: ['head', '', 'headId'],
  arm_L: ['arms', '_L', 'armLId'],
  arm_R: ['arms', '_R', 'armRId'],
  leg_L: ['legs', '_L', 'legLId'],
  leg_R: ['legs', '_R', 'legRId'],
  torso: ['torso', '', 'torsoId'],
};
const ID = /^[A-Za-z0-9_-]{1,40}$/;

const gltfLoader = new GLTFLoader();
const objLoader = new OBJLoader();
const texLoader = new THREE.TextureLoader();
texLoader.setCrossOrigin('anonymous');
const fileCache = new Map();
const loadGltf = (url) => {
  if (!fileCache.has(url)) fileCache.set(url, new Promise((res, rej) => gltfLoader.load(url, res, undefined, rej)));
  return fileCache.get(url);
};
const loadObj = (url) => {
  if (!fileCache.has(url)) fileCache.set(url, new Promise((res, rej) => objLoader.load(url, res, undefined, rej)));
  return fileCache.get(url);
};
const texCache = new Map();
function pixelTexture(url, fallback) {
  if (texCache.has(url)) return texCache.get(url);
  const p = new Promise((res) => {
    texLoader.load(url, (t) => {
      t.flipY = false;
      t.magFilter = THREE.NearestFilter;
      t.minFilter = THREE.NearestFilter;
      t.colorSpace = THREE.SRGBColorSpace;
      res(t);
    }, undefined, () => res(fallback ? pixelTexture(fallback) : null));
  });
  texCache.set(url, p);
  return p;
}

// only accept look data that points at Bloxity's own servers (remote players send theirs through our server)
export function cleanLook(look) {
  const out = {};
  if (!look || typeof look !== 'object') return out;
  if (typeof look.skin === 'string' && look.skin.length < 300 && ALLOWED.test(look.skin)) out.skin = look.skin;
  for (const k of ['headId', 'armLId', 'armRId', 'legLId', 'legRId', 'torsoId', 'hatId', 'backId']) {
    if (typeof look[k] === 'string' && ID.test(look[k])) out[k] = look[k];
  }
  return out;
}

async function buildCharacter(look) {
  const base = await loadGltf(`${STATIC}/avatars/player.glb`);
  const root = cloneSkinned(base.scene);
  const skin = await pixelTexture(look.skin || `${STATIC}/avatars/skins/0.png`, `${STATIC}/avatars/skins/0.png`);
  const material = new THREE.MeshStandardMaterial({ map: skin, roughness: 1, metalness: 0 });
  let skeleton = null;
  const partMeshes = {};
  root.traverse((o) => {
    if (o.isSkinnedMesh) {
      o.material = material;
      o.castShadow = true;
      o.frustumCulled = false;   // skinned bounds don't follow the pose; the character is small anyway
      skeleton ??= o.skeleton;
      for (const [part] of Object.entries(PARTS)) if (o.name.toLowerCase() === `default_${part}`.toLowerCase()) partMeshes[part] = o;
    }
  });
  if (!skeleton) throw new Error('player.glb has no skeleton');
  const bone = (n) => skeleton.bones.find((b) => b.name === n);

  // replacement body parts: re-point the part's skin indices at our skeleton's bones (by bone name)
  await Promise.all(Object.entries(PARTS).map(async ([part, [dir, suffix, field]]) => {
    const id = look[field];
    const mesh = partMeshes[part];
    if (!id || !mesh) return;
    try {
      const g = await loadGltf(`${STATIC}/avatars/parts/${dir}/${id}${suffix}.glb`);
      let src = null;
      g.scene.traverse((o) => { if (o.isSkinnedMesh && !src) src = o; });
      if (!src) return;
      const geo = src.geometry.clone();
      const byName = new Map(skeleton.bones.map((b, i) => [b.name, i]));
      const remap = new Map();
      src.skeleton.bones.forEach((b, i) => { const j = byName.get(b.name); if (j !== undefined) remap.set(i, j); });
      const si = geo.getAttribute('skinIndex');
      if (si) {
        for (let i = 0; i < si.array.length; i++) { const j = remap.get(si.array[i]); if (j !== undefined) si.array[i] = j; }
        si.needsUpdate = true;
      }
      mesh.geometry = geo;
    } catch { /* keep the default part */ }
  }));

  // hat on the head bone, back item on the upper spine (OBJ + pixel texture)
  const item = async (dir, id, parentBone, y) => {
    if (!id || !parentBone) return;
    try {
      const obj = (await loadObj(`${STATIC}/avatars/items/${dir}/${id}.obj`)).clone();
      const map = await pixelTexture(`${STATIC}/avatars/textures/${dir}/${id}.png`);
      const m = new THREE.MeshStandardMaterial({ map, roughness: 1 });
      obj.traverse((o) => { if (o.isMesh) { o.material = m; o.castShadow = true; } });
      obj.position.set(0, y, 0);
      parentBone.add(obj);
    } catch { /* no item */ }
  };
  await Promise.all([item('hats', look.hatId, bone('Neck1'), 0.8), item('back', look.backId, bone('Spine2'), 0)]);

  root.scale.setScalar(SCALE);
  const limb = (n) => { const b = bone(n); return b ? { b, rest: b.quaternion.clone() } : null; };
  return { root, rig: { armL: limb('ArmL1'), armR: limb('ArmR1'), legL: limb('LegL1'), legR: limb('LegR1') } };
}

// The on-foot character: shows the block avatar right away and swaps in the Bloxity base character as soon
// as it has loaded. userData.setLook(look) rebuilds it with another player's look.
export function makeAvatar(look = null) {
  const g = new THREE.Group();
  const block = makeBlockAvatar();
  g.add(block);
  let version = 0;
  let current = null;
  g.userData = {
    phase: 0,
    amp: 0,
    rig: null,
    block: block.userData,
    lookKey: null,
    setLook(next) {
      const clean = cleanLook(next);
      const key = JSON.stringify(clean);
      if (key === g.userData.lookKey) return;
      g.userData.lookKey = key;
      const v = ++version;
      buildCharacter(clean).then(({ root, rig }) => {
        if (v !== version) return;
        if (current) g.remove(current);
        block.visible = false;
        current = root;
        g.add(root);
        g.userData.rig = rig;
      }).catch((e) => console.warn('[avatar] Bloxity character unavailable, using the block avatar:', e?.message || e));
    },
  };
  g.userData.setLook(look);
  return g;
}

const SWING = new THREE.Vector3(1, 0, 0);
const qSwing = new THREE.Quaternion();
function swingBone(limb, angle) {
  if (!limb) return;
  qSwing.setFromAxisAngle(SWING, angle);           // about the character's X axis (the Offset parents are unrotated)
  limb.b.quaternion.copy(qSwing).multiply(limb.rest);
}

// dist = how far the avatar moved this frame
export function animateAvatar(av, dist, dt) {
  const u = av.userData;
  const speed = dt > 0 ? dist / dt : 0;
  u.amp += (Math.min(1, speed / 9) - u.amp) * Math.min(1, dt * 12);
  u.phase += dist * 1.5;
  const s = Math.sin(u.phase) * 0.95 * u.amp;
  if (u.rig) {
    swingBone(u.rig.armL, s);
    swingBone(u.rig.armR, -s);
    swingBone(u.rig.legL, -s);
    swingBone(u.rig.legR, s);
    return;
  }
  const b = u.block || u;
  b.legL.rotation.x = s;
  b.legR.rotation.x = -s;
  b.armL.rotation.x = -s;
  b.armR.rotation.x = s;
}

// A short puff of white cubes - used when the avatar jumps into the car (and back out).
export class Poofs {
  constructor(scene) {
    this.scene = scene;
    this.geo = new THREE.BoxGeometry(0.7, 0.7, 0.7);
    this.items = [];
  }

  burst(x, y, z) {
    for (let i = 0; i < 14; i++) {
      const m = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }));
      const a = Math.random() * Math.PI * 2;
      const sp = 3 + Math.random() * 5;
      m.position.set(x, y + 1 + Math.random() * 1.5, z);
      m.rotation.set(Math.random() * 3, Math.random() * 3, 0);
      this.scene.add(m);
      this.items.push({ m, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: 2 + Math.random() * 4, life: 0.7 });
    }
  }

  update(dt) {
    this.items = this.items.filter((p) => {
      p.life -= dt;
      if (p.life <= 0) {
        p.m.removeFromParent();
        p.m.material.dispose();
        return false;
      }
      p.m.position.x += p.vx * dt;
      p.m.position.y += p.vy * dt;
      p.m.position.z += p.vz * dt;
      p.vy -= 6 * dt;
      p.m.scale.setScalar(1 + (0.7 - p.life) * 1.6);
      p.m.material.opacity = Math.min(0.9, p.life * 1.6);
      return true;
    });
  }
}

// The roadster in the lobby is a toy-sized copy that trots along behind you (like the reference game);
// when you reach the track it grows to full size and you are in it. Going back inside shrinks it again.
export const MINI_SCALE = 0.24;
const ease = (t) => t * t * (3 - 2 * t);
const lerpAngle = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;

export class CarFollower {
  constructor(car, walking) {
    this.car = car;
    this.pos = new THREE.Vector3();
    this.ry = 0;
    this.blend = walking ? 0 : 1;
    this.init = false;
    this.last = new THREE.Vector3();
  }

  // body = the player's position / heading. Returns the distance the car travelled (for wheel spin).
  update(dt, body, bodyRy, walking) {
    if (!this.init) {
      this.pos.copy(body);
      this.ry = bodyRy;
      this.last.copy(body);
      this.init = true;
    }
    if (walking) {
      const fx = Math.sin(bodyRy);
      const fz = Math.cos(bodyRy);
      const tx = body.x - fx * 4.6 + fz * 3.2;
      const tz = body.z - fz * 4.6 - fx * 3.2;
      const dx = tx - this.pos.x;
      const dz = tz - this.pos.z;
      if (Math.hypot(dx, dz) > 1.2) {
        const k = 1 - Math.exp(-dt * 5);
        this.pos.x += dx * k;
        this.pos.z += dz * k;
        this.ry = lerpAngle(this.ry, Math.atan2(dx, dz), Math.min(1, dt * 8));
      } else {
        this.ry = lerpAngle(this.ry, bodyRy, Math.min(1, dt * 3));
      }
      this.pos.y = body.y;
    } else {
      this.pos.copy(body);
      this.ry = bodyRy;
    }
    this.blend = Math.min(1, Math.max(0, this.blend + (walking ? -dt : dt) / 0.4));
    const e = ease(this.blend);
    const car = this.car;
    car.position.lerpVectors(this.pos, body, e);
    car.scale.setScalar(MINI_SCALE + (1 - MINI_SCALE) * e);
    car.rotation.y = lerpAngle(this.ry, bodyRy, e);
    car.userData.driver.visible = e > 0.6;
    const moved = car.position.distanceTo(this.last);
    this.last.copy(car.position);
    return moved / car.scale.x;
  }

  get full() {
    return this.blend >= 1;
  }
}

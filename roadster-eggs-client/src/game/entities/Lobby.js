import * as THREE from 'three';
import { WORLD } from '../../shared/gameData.js';
import { mat } from '../util/materials.js';
import { textSprite } from '../util/canvasText.js';
import { buildBlockWalls, buildMountains } from './Cliffs.js';

// ---------------------------------------------------------------- layout (top view), as in the reference
//
//                       dirt-block cliffs (right side)                 boards
//   +-----------------------------------------------------------+
//   |                 [pen]        [pen]          spooky shop hacker chest |
//   |  dirt     cliffs                                     ======= TRACK (straight ahead, +x) ====>
//   |  (back)         [pen]   [YOUR PEN @ 0,0]    invite dragon sell fuse  |   between grey stone blocks:
//   +-----------------------------------------------------------+   barn, tower, lamps, billboard
//                       dirt-block cliffs (left side)
//
const TZ = WORLD.trackZ;
const TH = WORLD.trackHalfWidth;
const END_X = WORLD.trackX0 + WORLD.trackSpacing * 9 + 190;
const FRONT = WORLD.trackStartX;          // the lobby's front edge, where the track starts
const BACK = -175;
const LEFT = TZ - 150;                    // -107
const RIGHT = TZ + 150;                   // 193
const TOWN_END = 250;                     // the stone town ends and the egg-zone valley begins
const TOWN_L = TZ - 60;                   // grey stone blocks on both sides of the track through the town
const TOWN_R = TZ + 60;
const VALLEY_L = TZ - 125;
const VALLEY_R = TZ + 125;

export const LOBBY = {
  field: { x0: BACK, x1: FRONT, z0: LEFT, z1: RIGHT },
  penHalf: 34,
  pens: [
    { x: 0, z: 0, mine: true },
    { x: 0, z: 86 },
    { x: -86, z: 0, blue: true },
    { x: -86, z: 86 },
  ],
  endX: END_X,
  townEnd: TOWN_END,
  townL: TOWN_L,
  townR: TOWN_R,
};

// wall lines: n points into the playable area, blocks stand behind the line. stone = grey town blocks.
const WALLS = [
  { a: [BACK, LEFT], b: [BACK, RIGHT], n: [1, 0], extA: 110, extB: 110 },                          // back of the lobby
  { a: [BACK, LEFT], b: [FRONT, LEFT], n: [0, 1], extA: 110, extB: 110 },                          // left side
  { a: [BACK, RIGHT], b: [FRONT, RIGHT], n: [0, -1], extA: 110, extB: 110 },                       // right side
  { a: [FRONT + 2, LEFT], b: [FRONT + 2, TOWN_L], n: [-1, 0], rows: 3, extA: 110 },   // front, left of the track (brown dirt like the rest of the lobby)
  { a: [FRONT + 2, TOWN_R], b: [FRONT + 2, RIGHT], n: [-1, 0], rows: 3, extB: 110 },  // front, right of the track (brown dirt)
  // from the start of the track on: tall dark rock blocks on both sides (taller than the brown lobby walls)
  { a: [FRONT + 2, TOWN_L], b: [TOWN_END, TOWN_L], n: [0, 1], rock: true },
  { a: [FRONT + 2, TOWN_R], b: [TOWN_END, TOWN_R], n: [0, -1], rock: true },
  { a: [TOWN_END, VALLEY_L], b: [TOWN_END, TOWN_L], n: [1, 0], rows: 2, rock: true },
  { a: [TOWN_END, TOWN_R], b: [TOWN_END, VALLEY_R], n: [1, 0], rows: 2, rock: true },
  { a: [TOWN_END, VALLEY_L], b: [END_X, VALLEY_L], n: [0, 1], rock: true },   // egg-zone valley
  { a: [TOWN_END, VALLEY_R], b: [END_X, VALLEY_R], n: [0, -1], rock: true },
  { a: [END_X, VALLEY_L], b: [END_X, VALLEY_R], n: [-1, 0], rock: true },     // end of the track
];

export const onTrack = (x, z) => Math.abs(z - TZ) < TH && x > FRONT;
export const inField = (x, z) => {
  const f = LOBBY.field;

  return x > f.x0 && x < f.x1 && z > f.z0 && z < f.z1 - 1;
};

// wooden (or blue) pen fence with a gate on the front side (+x, towards the hub and the track)
export function penFence(parent, cx, cz, half, blue = false) {
  const postMat = mat(blue ? 0x5f8796 : 0x6b4b2c);
  const railMat = mat(blue ? 0x82aab6 : 0x8f6a40);
  const STEP = 5.6;
  const posts = [];
  const rails = [];
  const gate = 7;
  const sides = [
    [[-half, -half], [half, -half]],
    [[half, -half], [half, half]],
    [[half, half], [-half, half]],
    [[-half, half], [-half, -half]],
  ];
  sides.forEach(([p0, p1], si) => {
    const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
    const n = Math.round(len / STEP);
    for (let k = 0; k < n; k++) {
      const t0 = k / n;
      const t1 = (k + 1) / n;
      const x0 = p0[0] + (p1[0] - p0[0]) * t0;
      const z0 = p0[1] + (p1[1] - p0[1]) * t0;
      const x1 = p0[0] + (p1[0] - p0[0]) * t1;
      const z1 = p0[1] + (p1[1] - p0[1]) * t1;
      const mz = (z0 + z1) / 2;
      if (si === 1 && Math.abs(mz) < gate) continue;   // the gate faces the front
      posts.push([x0, z0]);
      rails.push({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, len: len / n, alongX: si % 2 === 0 });
    }
  });
  posts.push([half, -gate], [half, gate]);
  const pm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 3.4, 0.9), postMat, posts.length);
  const rm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.42, 0.32), railMat, rails.length * 3);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  posts.forEach(([x, z], i) => {
    m4.compose(new THREE.Vector3(cx + x, 1.7, cz + z), q.identity(), new THREE.Vector3(1, 1, 1));
    pm.setMatrixAt(i, m4);
  });
  const up = new THREE.Vector3(0, 1, 0);
  rails.forEach((r, i) => {
    q.setFromAxisAngle(up, r.alongX ? 0 : Math.PI / 2);
    [0.95, 1.8, 2.65].forEach((y, k) => {
      m4.compose(new THREE.Vector3(cx + r.x, y, cz + r.z), q, new THREE.Vector3(r.len + 0.3, 1, 1));
      rm.setMatrixAt(i * 3 + k, m4);
    });
  });
  pm.castShadow = rm.castShadow = true;
  parent.add(pm, rm);
}

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function voxelTree(parent, x, z, k = 1) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.scale.setScalar(k);
  const trunk = new THREE.Mesh(new THREE.BoxGeometry(1.6, 5, 1.6), mat(0x6b4b2c));
  trunk.position.y = 2.5;
  const a = new THREE.Mesh(new THREE.BoxGeometry(6.4, 4.6, 6.4), mat(0x4fb81f));
  a.position.y = 6.6;
  const b = new THREE.Mesh(new THREE.BoxGeometry(4.4, 3.4, 4.4), mat(0x67d12c));
  b.position.y = 10.2;
  trunk.castShadow = a.castShadow = b.castShadow = true;
  g.add(trunk, a, b);
  parent.add(g);
}

// The lobby: block cliffs on three sides + the egg-zone valley, mountains behind, the other three pens,
// the "Upgrade Plot" sign and the purple drone next to your pen.
export class Lobby {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.rotors = [];
    this.rects = buildBlockWalls(this.group, WALLS);
    this.buildMountains();
    this.buildPens();
    this.buildProps();
  }

  buildMountains() {
    const spots = [];
    // no grey mountains around the starting area: only the brown walls frame the lobby
    for (let x = FRONT + 760; x < END_X + 200; x += 170) {
      spots.push([x + (x % 3) * 20, LEFT - 215 - (x % 7) * 9, 1.2]);
      spots.push([x + 60, RIGHT + 215 + (x % 5) * 12, 1.25]);
    }
    spots.push([END_X + 220, TZ, 1.6]);
    buildMountains(this.group, spots);
  }

  buildPens() {
    for (const p of LOBBY.pens) {
      if (p.mine) continue;   // your own pen is drawn by Base (with pods + pets)
      penFence(this.group, p.x, p.z, LOBBY.penHalf, p.blue);
      const label = textSprite([{ text: 'Empty Plot', size: 46 }, { text: 'waiting for a player', size: 30, color: '#d6f5ff' }], { scale: 0.03 });
      label.position.set(p.x, 9, p.z);
      this.group.add(label);
    }
  }

  buildProps() {
    // navy "Upgrade Plot" sign at the front corner of your pen
    const sign = new THREE.Group();
    sign.position.set(44, 0, -24);
    sign.rotation.y = Math.PI / 2;   // faces the front (the hub row)
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(9, 6, 0.6),
      new THREE.MeshStandardMaterial({
        roughness: 0.8,
        map: canvasTexture(256, 170, (ctx, w, h) => {
          ctx.fillStyle = '#12285a';
          ctx.fillRect(0, 0, w, h);
          ctx.fillStyle = '#ffffff';
          ctx.font = '800 34px Fredoka, "Segoe UI", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('Upgrade Plot', w / 2, 46);
          ctx.font = '700 24px Fredoka, "Segoe UI", sans-serif';
          ctx.fillStyle = '#7dff9a';
          ctx.fillText('more slots + Gym', w / 2, 84);
          ctx.fillStyle = '#2fbf3a';
          ctx.fillRect(40, 108, 176, 44);
          ctx.fillStyle = '#ffffff';
          ctx.font = '800 28px Fredoka, "Segoe UI", sans-serif';
          ctx.fillText('UPGRADE', w / 2, 140);
        }),
      }),
    );
    board.position.y = 5.2;
    board.castShadow = true;
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.9, 3, 0.9), mat(0x12285a));
    post.position.y = 1.5;
    sign.add(board, post);
    this.group.add(sign);

    // purple drone with yellow rotor rings
    const drone = new THREE.Group();
    drone.position.set(48, 0, -38);
    const hull = new THREE.Mesh(new THREE.BoxGeometry(3, 1.1, 2.2), mat(0x7b3ff0));
    hull.position.y = 2.6;
    hull.castShadow = true;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.3, 2.3), mat(0xffe14d));
    stripe.position.y = 2.6;
    drone.add(hull, stripe);
    for (const [x, z] of [[-2.4, -1.9], [2.4, -1.9], [-2.4, 1.9], [2.4, 1.9]]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.18, 6, 16), mat(0xffe14d));
      ring.rotation.x = Math.PI / 2;
      ring.position.set(x, 3, z);
      const rotor = new THREE.Group();
      rotor.position.set(x, 3.05, z);
      const blade = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.1, 0.35), mat(0x2b2b38));
      const blade2 = blade.clone();
      blade2.rotation.y = Math.PI / 2;
      rotor.add(blade, blade2);
      drone.add(ring, rotor);
      this.rotors.push(rotor);
    }
    this.drone = drone;
    this.group.add(drone);

    // a few voxel trees in the lobby corners
    for (const [x, z, k] of [[-158, LEFT + 16, 1.2], [-150, TZ + 70, 0.9], [-160, RIGHT - 16, 1.1], [-100, LEFT + 14, 1]]) voxelTree(this.group, x, z, k);
  }

  // keep the player out of the cliff blocks
  collide(body) {
    let hit = false;
    for (const r of this.rects) {
      const m = 1.3;
      if (body.x < r.x0 - m || body.x > r.x1 + m || body.z < r.z0 - m || body.z > r.z1 + m) continue;
      const [nx, nz] = r.line.n;
      if (nx > 0) body.x = r.x1 + m;
      else if (nx < 0) body.x = r.x0 - m;
      else if (nz > 0) body.z = r.z1 + m;
      else body.z = r.z0 - m;
      hit = true;
    }
    if (hit) {
      if (Math.abs(body.speed) > 15) body.crashed = true;
      body.speed *= -0.2;
      body.vx = body.vz = 0;
    }
    return hit;
  }

  update(time) {
    for (const r of this.rotors) r.rotation.y = time * 22;
    if (this.drone) this.drone.position.y = 0.4 + Math.sin(time * 2) * 0.3;
  }
}

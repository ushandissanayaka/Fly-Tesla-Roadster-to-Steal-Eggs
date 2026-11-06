import * as THREE from 'three';
import { BIOMES, WORLD, biomeLayout } from '../../shared/gameData.js';
import { mat } from '../util/materials.js';
import { PALETTE, studMaterial, studTexture } from '../util/textures.js';
import { textSprite } from '../util/canvasText.js';
import { worldBox } from './Cliffs.js';
import { LOBBY, voxelTree } from './Lobby.js';

const TZ = WORLD.trackZ;
const TH = WORLD.trackHalfWidth;
const X0 = WORLD.trackStartX;

function billboardTexture(title, sub) {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#1b4fae');
  g.addColorStop(1, '#0b2a66');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1024, 256);
  ctx.fillStyle = '#6fe2ff';
  ctx.beginPath();
  ctx.moveTo(0, 210); ctx.quadraticCurveTo(300, 150, 1024, 90); ctx.lineTo(1024, 130); ctx.quadraticCurveTo(300, 200, 0, 256);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '800 92px Fredoka, "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, 512, 96);
  ctx.font = '700 54px Fredoka, "Segoe UI", sans-serif';
  ctx.fillStyle = '#bfe9ff';
  ctx.fillText(sub, 512, 186);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// red barn with white X doors, blue roof and a silo (doors face +z = the track)
export function barn(parent, x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const body = new THREE.Mesh(new THREE.BoxGeometry(20, 12, 15), studMaterial(PALETTE.barn, 5, 3));
  body.position.y = 6;
  body.castShadow = true;
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 13, 7, 4, 1), mat(PALETTE.barnRoof));
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1.12, 1, 0.82);
  roof.position.y = 15.5;
  const trim = new THREE.Mesh(new THREE.BoxGeometry(20.4, 0.6, 15.4), mat(0xffffff));
  trim.position.y = 12;
  const door = new THREE.Mesh(new THREE.BoxGeometry(7, 8.5, 0.4), mat(0xffffff));
  door.position.set(0, 4.25, 7.6);
  const x1 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 10, 0.5), mat(PALETTE.barn));
  x1.position.set(0, 4.25, 7.9);
  x1.rotation.z = 0.68;
  const x2 = x1.clone();
  x2.rotation.z = -0.68;
  const loft = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 0.4), mat(0xffd23f));
  loft.position.set(0, 12.6, 7.4);
  const silo = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 20, 14), studMaterial(0xb9c4b0, 4, 4));
  silo.position.set(14, 10, -1);
  silo.castShadow = true;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(3.6, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x7fb6e8));
  dome.position.set(14, 20, -1);
  const ladder = new THREE.Mesh(new THREE.BoxGeometry(0.9, 18, 0.2), mat(0x3b3b3b));
  ladder.position.set(14, 10, 2.7);
  g.add(body, roof, trim, door, x1, x2, loft, silo, dome, ladder);
  for (const [hx, hz] of [[-7, 10], [-5, 10.6], [-6, 12.4]]) {
    const hay = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.5, 1.6), mat(0xe6c94a));
    hay.position.set(hx, 0.75, hz);
    g.add(hay);
  }
  parent.add(g);
}

// The ONE track (like the reference): it leaves the middle of the lobby's front edge and runs straight
// ahead. A studded pale-blue road with white edge lines and a dashed centre line, black lamp posts on both
// sides; through the town it runs between grey stone blocks (built in Lobby), with the red barn on the left
// and a stone tower on the right; every egg zone has a blue billboard gate with its recommended speed.
export function buildTracks(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const endX = LOBBY.endX;
  const len = endX - X0;
  const lineMat = mat(PALETTE.roadLine);

  const road = new THREE.Mesh(new THREE.BoxGeometry(len, 0.2, TH * 2), studMaterial(PALETTE.road, len / 4, (TH * 2) / 4));
  road.position.set(X0 + len / 2, 0.06, TZ);
  road.receiveShadow = true;
  group.add(road);
  for (const sd of [-1, 1]) {
    const edge = new THREE.Mesh(new THREE.BoxGeometry(len, 0.1, 0.6), lineMat);
    edge.position.set(X0 + len / 2, 0.2, TZ + sd * (TH - 1.2));
    const curb = new THREE.Mesh(new THREE.BoxGeometry(len, 0.35, 0.8), mat(0xd8e6ee));
    curb.position.set(X0 + len / 2, 0.17, TZ + sd * (TH + 0.4));
    group.add(edge, curb);
  }
  const dashCount = Math.floor(len / 12);
  const dashes = new THREE.InstancedMesh(new THREE.BoxGeometry(5, 0.1, 0.55), lineMat, dashCount);
  const m4 = new THREE.Matrix4();
  for (let k = 0; k < dashCount; k++) {
    m4.makeTranslation(X0 + 6 + k * 12, 0.2, TZ);
    dashes.setMatrixAt(k, m4);
  }
  group.add(dashes);

  // brighter town grass between the stone blocks
  const townGrass = new THREE.Mesh(
    new THREE.PlaneGeometry(LOBBY.townEnd - X0, LOBBY.townR - LOBBY.townL),
    studMaterial(0x4fdc2a, (LOBBY.townEnd - X0) / 4, (LOBBY.townR - LOBBY.townL) / 4),
  );
  townGrass.rotation.x = -Math.PI / 2;
  townGrass.position.set((X0 + LOBBY.townEnd) / 2, 0.01, TZ);
  townGrass.receiveShadow = true;
  group.add(townGrass);

  // lamp posts: dark post, lantern with a warm light, small roof (closer together through the town)
  const lamps = [];
  for (let x = X0 + 8; x < endX - 10; x += x < LOBBY.townEnd ? 26 : 60) {
    lamps.push([x, TZ - TH - 3.5], [x, TZ + TH + 3.5]);
  }
  const post = new THREE.InstancedMesh(new THREE.BoxGeometry(0.8, 9, 0.8), mat(0x2b2b2b), lamps.length);
  const foot = new THREE.InstancedMesh(new THREE.BoxGeometry(1.6, 1, 1.6), mat(0x2b2b2b), lamps.length);
  const lantern = new THREE.InstancedMesh(new THREE.BoxGeometry(1.6, 2, 1.6), mat(0xfff2b0, { emissive: 0xffe08a }), lamps.length);
  const cap = new THREE.InstancedMesh(new THREE.BoxGeometry(2.2, 0.5, 2.2), mat(0x2b2b2b), lamps.length);
  lamps.forEach(([x, z], i) => {
    m4.makeTranslation(x, 4.5, z); post.setMatrixAt(i, m4);
    m4.makeTranslation(x, 0.5, z); foot.setMatrixAt(i, m4);
    m4.makeTranslation(x, 10, z); lantern.setMatrixAt(i, m4);
    m4.makeTranslation(x, 11.2, z); cap.setMatrixAt(i, m4);
  });
  group.add(post, foot, lantern, cap);

  // the town: barn on the left, stone tower with a wooden hut on the right, a few trees
  barn(group, X0 + 44, TZ - 36);
  tower(group, X0 + 58, TZ + 36);
  for (const [tx, tz, k] of [[X0 + 20, TZ - 48, 0.9], [X0 + 100, TZ - 44, 1.1], [X0 + 96, TZ + 46, 1], [X0 + 130, TZ + 30, 0.8]]) voxelTree(group, tx, tz, k);

  // egg-zone billboard gates across the track
  for (let i = 0; i < BIOMES.length; i++) {
    const L = biomeLayout(i);
    const b = BIOMES[i];
    const need = Math.round(Math.sqrt(50 * (b.gap + 6)) * 2.2);
    const gx = L.cx + L.rampU0 - 26;
    for (const sd of [-1, 1]) {
      const pil = new THREE.Mesh(new THREE.BoxGeometry(3, 24, 3), mat(0x1c2f57));
      pil.position.set(gx, 12, TZ + sd * (TH + 6));
      group.add(pil);
    }
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(1, 8, (TH + 7) * 2),
      new THREE.MeshBasicMaterial({ map: billboardTexture(b.name, `${need} km/h recommended`) }),
    );
    board.position.set(gx, 20, TZ);
    group.add(board);
    const tag = textSprite([{ text: b.name, size: 80, color: '#8dff3a' }], { scale: 0.04 });
    tag.position.set(gx, 30, TZ);
    group.add(tag);
  }

  // everything here is static
  group.traverse((o) => { o.updateMatrix(); o.matrixAutoUpdate = false; });
  return group;
}

// grey stone tower with a small wooden hut on top (right of the track in the reference)
function tower(parent, x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const base = new THREE.Mesh(worldBox(10, 22, 10, 0, 11, 0, 8), new THREE.MeshStandardMaterial({ map: studTexture(PALETTE.stone, { cells: 2 }), roughness: 0.9 }));
  base.castShadow = true;
  const moss = new THREE.Mesh(new THREE.BoxGeometry(10.6, 1, 10.6), mat(0x57d63a));
  moss.position.y = 22.5;
  const hut = new THREE.Mesh(new THREE.BoxGeometry(7, 5, 7), mat(0x8a5a32));
  hut.position.y = 25.5;
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 6.2, 3.4, 4, 1), mat(0x5a3a22));
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 29.7;
  const window = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2, 0.3), mat(0x2a2a2a));
  window.position.set(0, 26, -3.6);
  g.add(base, moss, hut, roof, window);
  parent.add(g);
}

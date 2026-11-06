import * as THREE from 'three';
import { HUB_STATIONS, WORLD, fmt } from '../../shared/gameData.js';
import { makeEgg } from './Egg.js';
import { mat } from '../util/materials.js';
import { PALETTE, studMaterial } from '../util/textures.js';
import { textSprite } from '../util/canvasText.js';
import { makeCar } from './Car.js';

const STATION = {
  roadster_shop: { label: 'ROADSTER SHOP', prompt: 'Open the Garage', color: '#ffd23f' },
  sell_shop: { label: 'SELL SHOP', prompt: 'Sell animals', color: '#ff5a5a' },
  training: { label: 'TRAINING GYM', prompt: 'Train your car', color: '#6ab7ff' },
  reward: { label: 'FREE REWARD', prompt: 'Claim reward', color: '#ffe14d' },
  invite: { label: 'INVITE FRIEND', prompt: 'Copy invite link', color: '#ffe14d' },
};
// Where each station stands, as in the reference: a row along the lobby's front edge facing the pens -
// left of the track: Fuse Machine (training), Sell Shop, the dragon showcase, Invite Friend; right of it:
// Spooky Egg, Roadster Shop, Hacker Roadster, the Free Reward chest; the four leaderboards stand along the
// right-hand cliff near the front. ry: local +z = the front of the station.
const ROW_X = WORLD.trackStartX - 20;
const TZ = WORLD.trackZ;
const SPOTS = {
  training: { x: ROW_X, z: TZ - 104, ry: -Math.PI / 2 },
  sell_shop: { x: ROW_X, z: TZ - 74, ry: -Math.PI / 2 },
  invite: { x: ROW_X + 4, z: TZ - 24, ry: -Math.PI / 2 },
  roadster_shop: { x: ROW_X, z: TZ + 48, ry: -Math.PI / 2 },
  reward: { x: ROW_X, z: TZ + 98, ry: -Math.PI / 2 },
  board_money: { x: ROW_X, z: TZ + 138, ry: Math.PI },
  board_speed: { x: ROW_X - 16, z: TZ + 138, ry: Math.PI },
  board_eggs: { x: ROW_X - 32, z: TZ + 138, ry: Math.PI },
  board_hatched: { x: ROW_X - 48, z: TZ + 138, ry: Math.PI },
};
const DISPLAY = { dragon: [ROW_X, TZ - 48], spooky: [ROW_X, TZ + 24], hacker: [ROW_X, TZ + 74] };

const BOARDS = {
  board_money: { title: 'MOST MONEY', color: '#2fbf3a', key: 'money', fmt: (v) => `$${fmt(v)}` },
  board_speed: { title: 'MOST SPEED', color: '#e0302a', key: 'speed', fmt: (v) => `${Math.round(v * 2.2)} km/h` },
  board_eggs: { title: 'MOST EGGS STOLEN', color: '#8a3fd0', key: 'eggs', fmt: (v) => fmt(v) },
  board_hatched: { title: 'MOST HATCHED', color: '#e6a817', key: 'hatched', fmt: (v) => fmt(v) },
};

function awning(group, a, b) {
  for (const sx of [-4, 4]) {
    for (const sz of [-2.5, 2.5]) {
      const pole = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5, 0.5), mat(0x725231));
      pole.position.set(sx, 2.5, sz);
      group.add(pole);
    }
  }
  for (let i = 0; i < 8; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.35, 7.2), mat(i % 2 ? b : a));
    s.position.set(-3.85 + i * 1.1, 5.2, 0);
    s.rotation.x = 0.12;
    s.castShadow = true;
    group.add(s);
  }
  const counter = new THREE.Mesh(new THREE.BoxGeometry(7, 1.6, 1.6), mat(0x8a6a3e));
  counter.position.set(0, 0.8, -1.2);
  group.add(counter);
}

function boardCanvas(cfg, rows) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 640;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0b1a2e';
  ctx.fillRect(0, 0, 512, 640);
  ctx.fillStyle = cfg.color;
  ctx.fillRect(0, 0, 512, 78);
  ctx.fillStyle = '#fff';
  ctx.font = '800 40px Fredoka, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.strokeText(cfg.title, 256, 40);
  ctx.fillText(cfg.title, 256, 40);
  ctx.font = '700 30px Fredoka, sans-serif';
  for (let i = 0; i < 10; i++) {
    const y = 120 + i * 52;
    ctx.fillStyle = i < 3 ? ['#d8a21c', '#c0c7d1', '#c27a3a'][i] : '#1d3350';
    ctx.fillRect(16, y - 20, 480, 42);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.fillText(`#${i + 1}`, 28, y + 1);
    const r = rows[i];
    ctx.fillText(r ? String(r.name).slice(0, 14) : '-', 100, y + 1);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#9bf0a0';
    ctx.fillText(r ? cfg.fmt(r.value) : '', 490, y + 1);
  }
  return c;
}

// The ring of stations around the plot: shops, training gym, reward chest, leaderboards, barn, invite sign.
export class Hub {
  constructor(scene) {
    this.stations = [];
    this.boards = {};
    HUB_STATIONS.forEach((id) => {
      const pos = SPOTS[id];
      if (!pos) return;   // the barn now stands in the town across the track
      const g = new THREE.Group();
      g.position.set(pos.x, 0, pos.z);
      g.rotation.y = pos.ry;
      scene.add(g);
      const info = STATION[id];
      let label = null;

      if (id === 'roadster_shop') {
        awning(g, 0xffd23f, 0xffffff);
        const car = makeCar(PALETTE.car);
        car.userData.driver.visible = false;
        car.scale.setScalar(0.9);
        car.position.set(0, 0, 7);
        car.rotation.y = 0.6;
        g.add(car);
      } else if (id === 'sell_shop') {
        awning(g, 0xe53935, 0xffffff);
        const sign = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 2.4), mat(0xffd23f));
        sign.position.set(3.2, 1.2, 4.5);
        g.add(sign);
      } else if (id === 'training') {
        const body = new THREE.Mesh(new THREE.BoxGeometry(7, 7.5, 5), mat(0x2f7fd6));
        body.position.y = 3.75;
        const win = new THREE.Mesh(new THREE.BoxGeometry(4.4, 3, 0.4), mat(0x0b1a2e));
        win.position.set(0, 4, 2.6);
        const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 1.4), mat(0xffe14d, { emissive: 0xffe14d }));
        lamp.position.set(0, 8, 0);
        body.castShadow = true;
        g.add(body, win, lamp);
        for (let k = 0; k < 4; k++) {
          const knob = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.5), mat([0xff5a5a, 0x7dff9a, 0xffd23f, 0xff8fd6][k]));
          knob.position.set(-2.4 + k * 1.6, 1.6, 2.7);
          g.add(knob);
        }
      } else if (id === 'reward') {
        const chest = new THREE.Mesh(new THREE.BoxGeometry(6, 3.6, 4), mat(PALETTE.chest));
        chest.position.y = 1.8;
        const lid = new THREE.Mesh(new THREE.BoxGeometry(6.2, 1.6, 4.2), mat(PALETTE.chest));
        lid.position.y = 4.3;
        // red band round the middle with a yellow lock, like the reference chest
        const band = new THREE.Mesh(new THREE.BoxGeometry(6.3, 1.7, 4.3), mat(PALETTE.chestRed));
        band.position.set(0, 3.2, 0);
        const lock = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.2, 0.3), mat(0xffe14d));
        lock.position.set(0, 3.1, 2.25);
        g.add(band, lock);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(6, 0.3, 6, 40), mat(PALETTE.chest, { emissive: PALETTE.chest }));
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.2;
        chest.castShadow = true;
        g.add(chest, lid, ring);
        this.chest = g;
      } else if (id === 'invite') {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.6, 6, 0.6), mat(0x725231));
        post.position.y = 3;
        const board = new THREE.Mesh(new THREE.BoxGeometry(8, 3.6, 0.5), mat(0x2f7fd6));
        board.position.y = 6.5;
        g.add(post, board);
      } else if (id === 'barn') {
        const body = new THREE.Mesh(new THREE.BoxGeometry(14, 9, 12), studMaterial(PALETTE.barn, 3, 2));
        body.position.y = 4.5;
        body.castShadow = true;
        const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 9.4, 5, 4, 1), mat(PALETTE.barnRoof));
        roof.rotation.y = Math.PI / 4;
        roof.scale.set(1.08, 1, 0.95);
        roof.position.y = 11.5;
        const door = new THREE.Mesh(new THREE.BoxGeometry(5, 6.2, 0.4), mat(0xffffff));
        door.position.set(0, 3.1, 6.1);
        const x1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 7.4, 0.5), mat(PALETTE.barn));
        x1.position.set(0, 3.1, 6.35);
        x1.rotation.z = 0.7;
        const x2 = x1.clone();
        x2.rotation.z = -0.7;
        g.add(body, roof, door, x1, x2);
      } else if (BOARDS[id]) {
        const cfg = BOARDS[id];
        const frame = new THREE.Mesh(new THREE.BoxGeometry(10.6, 13.2, 0.8), mat(PALETTE.cyan, { emissive: PALETTE.cyan }));
        frame.position.y = 8;
        const canvas = boardCanvas(cfg, []);
        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        const screen = new THREE.Mesh(new THREE.PlaneGeometry(9.6, 12), new THREE.MeshBasicMaterial({ map: tex }));
        screen.position.set(0, 8, 0.45);
        const base = new THREE.Mesh(new THREE.BoxGeometry(11, 0.8, 3.4), mat(0x3aa8ff));
        base.position.y = 0.4;
        g.add(frame, screen, base);
        this.boards[id] = { cfg, tex, canvas };
      }

      // glowing floor pad in front of the shops / invite sign (red for Sell, yellow for the others)
      const PAD = { sell_shop: 0xff4a1a, roadster_shop: 0xffe14d, invite: 0xe8ff3a };
      if (PAD[id]) {
        const pad = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.6, 0.2, 32), mat(PAD[id], { emissive: PAD[id] }));
        pad.position.set(0, 0.1, id === 'invite' ? 0 : 3.4);
        g.add(pad);
      }

      if (info) {
        label = textSprite(info.label, { size: 50, scale: 0.034, color: info.color });
        label.position.set(0, id === 'training' ? 11.5 : id === 'invite' ? 10.2 : 8.4, 0);
        g.add(label);
      }
      this.stations.push({ id, group: g, x: pos.x, z: pos.z, radius: id === 'reward' ? 10 : 9, info, label });
    });
    this.buildDisplays(scene);
  }

  // display pieces between the shops (no interaction, like the reference's showcase discs)
  buildDisplays(scene) {
    const disc = (x, z, color, ring) => {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      const d = new THREE.Mesh(new THREE.CylinderGeometry(6, 6.4, 0.8, 32), mat(color));
      d.position.y = 0.4;
      const r = new THREE.Mesh(new THREE.TorusGeometry(6.2, 0.35, 6, 40), mat(ring, { emissive: ring }));
      r.rotation.x = Math.PI / 2;
      r.position.y = 0.85;
      g.add(d, r);
      scene.add(g);
      return g;
    };

    // SPOOKY EGG (limited time)
    const spooky = disc(...DISPLAY.spooky, 0x3a1f6e, 0xff8a1f);
    const egg = makeEgg([0xff9a2e, 0x5a2a8a], 1.7);
    egg.position.y = 1.4;
    spooky.add(egg);
    this.spookyEgg = egg;
    for (const [px, pz] of [[-4, 3], [4, 3.4], [0, -4.2]]) {
      const pumpkin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.3, 1.6), mat(0xff7a1a));
      pumpkin.position.set(px, 1.5, pz);
      spooky.add(pumpkin);
    }
    const sl = textSprite([
      { text: 'SPOOKY EGG', size: 56, color: '#ffb02e' },
      { text: 'LIMITED TIME!', size: 34, color: '#ff4d6d' },
      { text: 'WIN DIVINE PETS!', size: 38, color: '#b86bff' },
    ], { scale: 0.034 });
    sl.position.set(0, 12.5, 0);
    spooky.add(sl);

    // HACKER ROADSTER showcase (green glowing pad with a dark car on it)
    const pad = disc(...DISPLAY.hacker, 0x10331f, 0x2bff8a);
    const car = makeCar(0x1d2a22);
    car.userData.driver.visible = false;
    car.position.y = 0.8;
    car.rotation.y = 0.7;
    pad.add(car);
    this.showCar = car;
    for (const [px, pz] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(1, 4, 1), mat(0x1a1a1a));
      p.position.set(px, 2, pz);
      const tip = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.6, 1.1), mat(0x2bff8a, { emissive: 0x2bff8a }));
      tip.position.set(px, 4.2, pz);
      pad.add(p, tip);
    }
    const hl = textSprite([
      { text: 'HACKER ROADSTER', size: 48 },
      { text: 'STOCK: 426/700', size: 36, color: '#ff4d6d' },
      { text: 'Always 700% Better', size: 34, color: '#ffe14d' },
    ], { scale: 0.03 });
    hl.position.set(0, 10, 0);
    pad.add(hl);

    // MECHA SHADOW DRAGON showcase (purple disc, blocky dragon)
    const dd = disc(...DISPLAY.dragon, 0x2a2466, 0x7b5cff);
    const dragon = new THREE.Group();
    const dm = mat(0x3b2a8a);
    const body = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 6), dm);
    body.position.y = 4.5;
    const neck = new THREE.Mesh(new THREE.BoxGeometry(1.6, 4, 1.6), dm);
    neck.position.set(0, 7, 2.6);
    const head = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.8, 3), dm);
    head.position.set(0, 9, 3.6);
    const eye = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.4, 0.4), mat(0xff3df0, { emissive: 0xff3df0 }));
    eye.position.set(0, 9.3, 4.6);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 5), dm);
    tail.position.set(0, 3.6, -5);
    tail.rotation.x = 0.3;
    dragon.add(body, neck, head, eye, tail);
    for (const sx of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(7, 0.3, 4), mat(0x6a4cff));
      wing.position.set(sx * 5, 6.5, 0);
      wing.rotation.z = sx * 0.35;
      dragon.add(wing);
      for (const fz of [-1.8, 1.8]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.9, 3, 0.9), dm);
        leg.position.set(sx * 1.1, 1.9, fz);
        dragon.add(leg);
      }
    }
    dragon.rotation.y = -Math.PI / 2;
    dd.add(dragon);
    this.dragon = dragon;
    const dl = textSprite([
      { text: 'MECHA SHADOW DRAGON', size: 40, color: '#c9a8ff' },
      { text: '700% YOUR BEST', size: 34, color: '#ffe14d' },
    ], { scale: 0.03 });
    dl.position.set(0, 13.5, 0);
    dd.add(dl);
  }

  setBoards(data) {
    for (const [id, b] of Object.entries(this.boards)) {
      const rows = (data?.[b.cfg.key] || []).map((r) => ({ name: r.name, value: r.value }));
      const c = boardCanvas(b.cfg, rows);
      b.canvas.getContext('2d').drawImage(c, 0, 0);
      b.tex.needsUpdate = true;
    }
  }

  setRewardLabel(text) {
    const s = this.stations.find((x) => x.id === 'reward');
    if (s?.label && s._text !== text) {
      s._text = text;
      s.label.userData.set([{ text: 'FREE REWARD', size: 50, color: '#ffe14d' }, { text, size: 40 }]);
    }
  }

  // the interactive station the car is next to, or null
  nearest(x, z) {
    for (const s of this.stations) {
      if (!s.info) continue;
      if (Math.hypot(x - s.x, z - s.z) < s.radius) return s;
    }
    return null;
  }

  update(time) {
    if (this.chest) this.chest.position.y = Math.sin(time * 2) * 0.2;
    if (this.spookyEgg) { this.spookyEgg.rotation.y = time; this.spookyEgg.position.y = 1.4 + Math.sin(time * 2) * 0.4; }
    if (this.showCar) this.showCar.rotation.y = time * 0.5;
    if (this.dragon) this.dragon.position.y = Math.sin(time * 1.6) * 0.4;
  }
}

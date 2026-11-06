import * as THREE from 'three';
import { BIOMES, WORLD, ANIMAL_BY_ID, fmt } from '../../shared/gameData.js';
import { mat } from '../util/materials.js';
import { PALETTE, studMaterial } from '../util/textures.js';
import { textSprite } from '../util/canvasText.js';
import { makeEgg } from './Egg.js';
import { Pet } from './Pet.js';
import { LOBBY, penFence } from './Lobby.js';

const MAX_PODS = 8;
const MAX_PETS = 24;

// "Your farm": your square pen at the origin (one of the lobby's four) with incubator pods, your pets,
// and the reference game's "Your farm" billboard (your avatar picture + income) floating above it.
export class Base {
  constructor(scene) {
    const g = new THREE.Group();
    scene.add(g);
    this.group = g;

    const H = LOBBY.penHalf;
    const plot = new THREE.Mesh(new THREE.PlaneGeometry(H * 2, H * 2), studMaterial(PALETTE.grassLight, (H * 2) / 4, (H * 2) / 4));
    plot.rotation.x = -Math.PI / 2;
    plot.position.y = 0.05;
    plot.receiveShadow = true;
    g.add(plot);

    penFence(g, 0, 0, H);

    this.title = textSprite([{ text: '$0/s', size: 44, color: '#7dff9a' }, { text: 'Your farm', size: 56 }], { scale: 0.045 });
    this.title.position.set(0, 26, 0);
    g.add(this.title);
    // round avatar picture under the title (filled in by setOwner)
    this.head = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffffff, transparent: true, depthWrite: false }));
    this.head.scale.set(9, 9, 1);
    this.head.position.set(0, 18.5, 0);
    this.head.visible = false;
    g.add(this.head);

    this.pods = [];
    for (let i = 0; i < MAX_PODS; i++) {
      const a = (i / MAX_PODS) * Math.PI * 2 + 0.2;
      const pod = new THREE.Group();
      pod.position.set(Math.cos(a) * 20, 0.05, Math.sin(a) * 20);
      const stand = new THREE.Mesh(new THREE.BoxGeometry(5, 0.8, 5), mat(0x725231));
      stand.position.y = 0.4;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(2.9, 0.18, 6, 24), mat(0xffd23f, { emissive: 0xffd23f }));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.9;
      pod.add(stand, ring);
      pod.visible = false;
      g.add(pod);
      const label = textSprite('', { size: 34, scale: 0.016 });
      label.position.y = 6.5;
      label.visible = false;
      pod.add(label);
      this.pods.push({ pod, egg: null, biome: -1, label, ready: false });
    }
    this.pets = [];
    this.petKey = '';
    this.time = 0;
    this.list = [];
  }

  // show the player's Bloxity picture in a white circle above the pen
  setOwner(url) {
    if (!url) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(128, 128, 124, 0, Math.PI * 2); ctx.fill();
      ctx.save();
      ctx.beginPath(); ctx.arc(128, 128, 112, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = '#20232b';
      ctx.fillRect(0, 0, 256, 256);
      try { ctx.drawImage(img, 16, 16, 224, 224); } catch {}
      ctx.restore();
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      this.head.material.map = tex;
      this.head.material.needsUpdate = true;
      this.head.visible = true;
    };
    img.onerror = () => {};
    img.src = url;
  }

  setIncome(income, rebirths) {
    this.title.userData.set([{ text: `${fmt(income)}/s${rebirths ? `  ·  Rebirth ${rebirths}` : ''}`, size: 44, color: '#7dff9a' }, { text: 'Your farm', size: 56 }]);
  }

  // incubators: [{ biome, readyAt }], slots: how many pods exist, serverNow: server clock in ms
  setIncubators(list, slots, serverNow) {
    this.serverNow = serverNow;
    this.list = list;
    this.pods.forEach((p, i) => {
      p.pod.visible = i < slots;
      const egg = list[i];
      if (!egg) {
        if (p.egg) { p.pod.remove(p.egg); p.egg = null; p.biome = -1; }
        p.label.visible = false;
        return;
      }
      if (p.biome !== egg.biome) {
        if (p.egg) p.pod.remove(p.egg);
        p.egg = makeEgg(BIOMES[egg.biome].egg, 1.5);
        p.egg.position.y = 3.2;
        p.pod.add(p.egg);
        p.biome = egg.biome;
      }
      p.label.visible = true;
    });
  }

  // show the best animals as roaming pets
  setPets(animals) {
    const best = animals
      .map((a) => ({ a, def: ANIMAL_BY_ID[a.id] }))
      .filter((x) => x.def)
      .sort((x, y) => y.def.income - x.def.income)
      .slice(0, MAX_PETS);
    const key = best.map((x) => `${x.a.id}:${x.a.mut}`).join(',');
    if (key === this.petKey) return;
    this.petKey = key;
    this.pets.forEach((p) => p.dispose());
    this.pets = best.map((x, i) => {
      const pet = new Pet(x.def, x.a.mut, i, WORLD.baseRadius - 4);
      this.group.add(pet.mesh);
      return pet;
    });
  }

  // index of the first incubator whose egg is ready, or -1
  readySlot(serverNow) {
    return this.list.findIndex((e) => e.readyAt <= serverNow);
  }

  update(dt, serverNow) {
    this.time += dt;
    this.pods.forEach((p, i) => {
      if (!p.egg) return;
      const e = this.list?.[i];
      const ready = e && e.readyAt <= serverNow;
      p.egg.rotation.y += dt * (ready ? 2.5 : 0.6);
      p.egg.position.y = 3.2 + (ready ? Math.abs(Math.sin(this.time * 5)) * 0.8 : 0);
      p.egg.rotation.z = ready ? Math.sin(this.time * 18) * 0.12 : 0;
      if (ready !== p.ready || this.time - (p.t || 0) > 1) {
        p.t = this.time;
        p.ready = ready;
        const left = Math.max(0, Math.ceil((e.readyAt - serverNow) / 1000));
        p.label.userData.set(ready ? [{ text: 'Ready!', size: 36, color: '#ff4d6d' }, { text: 'Open it', size: 30, color: '#ff4d6d' }] : [{ text: `${Math.floor(left / 60)}m ${left % 60}s`, size: 36 }]);
      }
    });
    this.pets.forEach((p) => p.update(dt));
  }
}

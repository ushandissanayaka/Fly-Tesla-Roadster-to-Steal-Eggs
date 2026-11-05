import * as THREE from 'three';
import { BIOMES, WORLD } from '../../shared/gameData.js';
import { mat } from '../util/materials.js';
import { textSprite } from '../util/canvasText.js';
import { makeEgg } from './Egg.js';

const MAX_PODS = 8;

// The home base: a pad with incubator pods (one per slot) where stolen eggs are delivered.
export class Base {
  constructor(scene) {
    const g = new THREE.Group();
    scene.add(g);
    this.group = g;

    const pad = new THREE.Mesh(new THREE.CylinderGeometry(WORLD.baseRadius, WORLD.baseRadius + 1.5, 0.5, 48), mat(0x3a4666, { rough: 0.9 }));
    pad.position.y = 0.2;
    pad.receiveShadow = true;
    g.add(pad);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(WORLD.baseRadius - 1.5, 0.4, 8, 64), mat(0xffd23f, { emissive: 0xffd23f }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.55;
    g.add(ring);

    const sign = textSprite('🥚 EGG BASE 🥚', { size: 64, scale: 0.05, bg: 'rgba(20,20,60,0.7)' });
    sign.position.set(0, 20, 0);
    g.add(sign);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(WORLD.baseRadius - 2, WORLD.baseRadius - 2, 40, 32, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false }),
    );
    beam.position.y = 20;
    g.add(beam);

    this.pods = [];
    for (let i = 0; i < MAX_PODS; i++) {
      const a = (i / MAX_PODS) * Math.PI * 2;
      const pod = new THREE.Group();
      pod.position.set(Math.cos(a) * 17, 0.45, Math.sin(a) * 17);
      const stand = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.8, 1.2, 14), mat(0x20263a, { metal: 0.5 }));
      stand.position.y = 0.6;
      const glass = new THREE.Mesh(
        new THREE.SphereGeometry(2.6, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.3, roughness: 0.1 }),
      );
      glass.position.y = 1.2;
      pod.add(stand, glass);
      pod.visible = false;
      g.add(pod);
      this.pods.push({ pod, egg: null, biome: -1, stand });
    }
    this.time = 0;
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
        return;
      }
      if (p.biome !== egg.biome) {
        if (p.egg) p.pod.remove(p.egg);
        p.egg = makeEgg(BIOMES[egg.biome].egg, 1.3);
        p.egg.position.y = 3;
        p.pod.add(p.egg);
        p.biome = egg.biome;
      }
    });
  }

  update(dt, serverNow) {
    this.time += dt;
    this.pods.forEach((p, i) => {
      if (!p.egg) return;
      const e = this.list?.[i];
      const ready = e && e.readyAt <= serverNow;
      p.egg.rotation.y += dt * (ready ? 2.5 : 0.6);
      p.egg.position.y = 3 + (ready ? Math.abs(Math.sin(this.time * 5)) * 0.8 : 0);
      p.egg.rotation.z = ready ? Math.sin(this.time * 18) * 0.12 : 0;
    });
  }
}

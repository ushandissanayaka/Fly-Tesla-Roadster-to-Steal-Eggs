import * as THREE from 'three';
import { RARITIES, MUTATIONS, BIOMES, fmt } from '../../shared/gameData.js';
import { mat } from '../util/materials.js';
import { textSprite } from '../util/canvasText.js';

// A blocky voxel pet that wanders around the plot and shows `name / rarity / $x/s` above it.
export class Pet {
  constructor(animal, mut, index, plotRadius) {
    const m = MUTATIONS[mut];
    const hue = ((animal.biome * 37 + animal.rarity * 53) % 360) / 360;
    const color = mut > 0 ? new THREE.Color(m.color) : new THREE.Color().setHSL(hue, 0.6, 0.62);
    const bodyMat = mat(color.getHex());
    const darkMat = mat(color.clone().multiplyScalar(0.6).getHex());
    const scale = 0.85 + animal.rarity * 0.09;

    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.3, 2.4), bodyMat);
    body.position.y = 1.4;
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.1, 1.1), bodyMat);
    head.position.set(0, 2.2, 1.45);
    const eyeMat = mat(0x111111);
    for (const sx of [-0.3, 0.3]) {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.1), eyeMat);
      eye.position.set(sx, 2.35, 2.03);
      g.add(eye);
      const ear = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.5, 0.3), darkMat);
      ear.position.set(sx * 1.4, 2.95, 1.4);
      g.add(ear);
    }
    this.legs = [];
    for (const [x, z] of [[-0.5, 0.8], [0.5, 0.8], [-0.5, -0.8], [0.5, -0.8]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.8, 0.4), darkMat);
      leg.position.set(x, 0.4, z);
      g.add(leg);
      this.legs.push(leg);
    }
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.7), darkMat);
    tail.position.set(0, 1.8, -1.5);
    g.add(tail);
    g.add(body, head);
    g.scale.setScalar(scale);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.mesh = new THREE.Group();
    this.mesh.add(g);
    this.inner = g;

    const rar = RARITIES[animal.rarity];
    this.label = textSprite([
      { text: (mut > 0 ? `${m.name} ` : '') + animal.name, size: 36 },
      { text: rar.name, size: 26, color: rar.color },
      { text: `$${fmt(animal.income * m.mult)}/s`, size: 28, color: '#7dff9a' },
    ], { scale: 0.014 });
    this.label.position.y = 5.6 * scale;
    this.mesh.add(this.label);

    this.plotRadius = plotRadius;
    const a = (index / 24) * Math.PI * 2;
    this.x = Math.cos(a) * 12;
    this.z = Math.sin(a) * 12;
    this.tx = this.x;
    this.tz = this.z;
    this.wait = Math.random() * 2;
    this.t = Math.random() * 10;
    this.mesh.position.set(this.x, 0, this.z);
  }

  update(dt) {
    this.t += dt;
    if (this.wait > 0) {
      this.wait -= dt;
      this.inner.position.y = 0;
      this.legs.forEach((l) => { l.rotation.x = 0; });
    } else {
      const dx = this.tx - this.x;
      const dz = this.tz - this.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.6) {
        this.wait = 1 + Math.random() * 3;
        const a = Math.random() * Math.PI * 2;
        const r = 5 + Math.random() * (this.plotRadius - 12);
        this.tx = Math.cos(a) * r;
        this.tz = Math.sin(a) * r;
      } else {
        const step = Math.min(d, 4.5 * dt);
        this.x += (dx / d) * step;
        this.z += (dz / d) * step;
        this.inner.rotation.y = Math.atan2(dx, dz);
        this.inner.position.y = Math.abs(Math.sin(this.t * 9)) * 0.35;
        const w = Math.sin(this.t * 12) * 0.5;
        this.legs.forEach((l, i) => { l.rotation.x = i % 2 ? -w : w; });
      }
      this.mesh.position.set(this.x, 0, this.z);
    }
  }

  dispose() {
    this.label.userData.dispose?.();
    this.mesh.removeFromParent();
  }
}

export const biomeName = (animal) => BIOMES[animal.biome].name;

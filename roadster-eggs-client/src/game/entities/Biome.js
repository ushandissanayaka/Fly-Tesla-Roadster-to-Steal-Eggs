import * as THREE from 'three';
import { BIOMES, WORLD, biomeLayout } from '../../shared/gameData.js';
import { mat } from '../util/materials.js';
import { textSprite } from '../util/canvasText.js';
import { makeEgg } from './Egg.js';
import { Guard } from './Guard.js';

// props per theme: parts are instanced together (geometry, colour, height offset)
const BROWN = 0x6b4a2b;
function propParts(type, color) {
  switch (type) {
    case 'cone': return [
      { geo: new THREE.CylinderGeometry(0.6, 0.8, 3, 6), color: BROWN, y: 1.5 },
      { geo: new THREE.ConeGeometry(3.2, 9, 7), color, y: 7 }];
    case 'cactus': return [
      { geo: new THREE.CylinderGeometry(1, 1.2, 7, 7), color, y: 3.5 },
      { geo: new THREE.CylinderGeometry(0.5, 0.5, 3, 6), color, y: 5, x: 1.4 }];
    case 'ice': return [{ geo: new THREE.ConeGeometry(2.4, 10, 4), color, y: 5 }];
    case 'palm': return [
      { geo: new THREE.CylinderGeometry(0.5, 0.7, 9, 6), color: BROWN, y: 4.5 },
      { geo: new THREE.SphereGeometry(3.2, 7, 5), color, y: 9.6, sy: 0.45 }];
    case 'rock': return [{ geo: new THREE.DodecahedronGeometry(3, 0), color, y: 1.8, sy: 0.7 }];
    case 'lolli': return [
      { geo: new THREE.CylinderGeometry(0.3, 0.3, 6, 6), color: 0xffffff, y: 3 },
      { geo: new THREE.SphereGeometry(2.5, 10, 8), color, y: 7 }];
    case 'crystal': return [{ geo: new THREE.OctahedronGeometry(2.6, 0), color, y: 4, sy: 1.7, emissive: color }];
    case 'tower': return [
      { geo: new THREE.BoxGeometry(4, 18, 4), color, y: 9 },
      { geo: new THREE.BoxGeometry(4.3, 0.8, 4.3), color: 0x00f0ff, y: 18, emissive: 0x00f0ff }];
    default: return [];
  }
}

function rngFor(seed) {
  let s = seed * 9301 + 49297;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

// One biome: ground disc, themed props, the ramp -> gap -> plateau, the egg nest and its robot guard.
export class Biome {
  constructor(scene, index) {
    this.index = index;
    this.def = BIOMES[index];
    this.layout = biomeLayout(index);
    const { cx, cz, ang, rampU0, rampU1, plateauU0, plateauU1 } = this.layout;
    const def = this.def;

    const root = new THREE.Group();
    root.position.set(cx, 0, cz);
    root.rotation.y = -ang;        // local +x = outward axis (u), local +z = sideways (v)
    scene.add(root);
    this.root = root;

    const disc = new THREE.Mesh(new THREE.CircleGeometry(WORLD.biomeRadius + 6, 48), mat(def.ground));
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.03;
    disc.receiveShadow = true;
    root.add(disc);

    this.buildProps(root);

    // ramp (wedge) with warning stripes
    const sh = new THREE.Shape();
    sh.moveTo(rampU0, 0);
    sh.lineTo(rampU1, 0);
    sh.lineTo(rampU1, WORLD.rampHeight);
    sh.closePath();
    const rampGeo = new THREE.ExtrudeGeometry(sh, { depth: WORLD.rampHalfWidth * 2, bevelEnabled: false });
    rampGeo.translate(0, 0, -WORLD.rampHalfWidth);
    const ramp = new THREE.Mesh(rampGeo, mat(0x4a4f5c, { rough: 0.9 }));
    ramp.castShadow = true;
    ramp.receiveShadow = true;
    root.add(ramp);
    for (let i = 0; i < 5; i++) {
      const u = rampU0 + 3 + i * 3.6;
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.1, WORLD.rampHalfWidth * 2 + 0.2), mat(def.accent, { emissive: def.accent }));
      const t = (u - rampU0) / (rampU1 - rampU0);
      stripe.position.set(u, WORLD.rampHeight * t + 0.1, 0);
      stripe.rotation.z = Math.atan2(WORLD.rampHeight, rampU1 - rampU0);
      root.add(stripe);
    }

    // plateau
    const pw = WORLD.plateauHalfWidth * 2;
    const plat = new THREE.Mesh(new THREE.BoxGeometry(plateauU1 - plateauU0, WORLD.rampHeight, pw), mat(0x5b6172, { rough: 0.9 }));
    plat.position.set((plateauU0 + plateauU1) / 2, WORLD.rampHeight / 2, 0);
    plat.castShadow = true;
    plat.receiveShadow = true;
    root.add(plat);
    const top = new THREE.Mesh(new THREE.BoxGeometry(plateauU1 - plateauU0 - 2, 0.2, pw - 2), mat(def.accent, { emissive: def.accent }));
    top.position.set((plateauU0 + plateauU1) / 2, WORLD.rampHeight + 0.12, 0);
    top.material = top.material.clone();
    top.material.emissiveIntensity = 0.25;
    root.add(top);

    // egg nest
    const eggU = (plateauU0 + plateauU1) / 2;
    this.egg = makeEgg(def.egg, 1.7);
    this.egg.position.set(eggU, WORLD.rampHeight + 2.4, 0);
    root.add(this.egg);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.35, 8, 24), mat(def.accent, { emissive: def.accent }));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(eggU, WORLD.rampHeight + 0.5, 0);
    root.add(ring);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 1.2, 70, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: def.accent, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
    );
    beam.position.set(eggU, WORLD.rampHeight + 35, 0);
    root.add(beam);

    // name sign above the ramp entrance
    const sign = textSprite(`${def.name}  ·  Lv ${def.tier}`, { size: 54, scale: 0.034 });
    sign.position.set(rampU0 - 6, 14, 0);
    root.add(sign);

    this.guard = new Guard(this.layout);
    scene.add(this.guard.mesh);
    this.eggHiddenUntil = 0;
  }

  buildProps(root) {
    const { propColor, prop } = this.def;
    const rnd = rngFor(this.index + 3);
    const { rampU0, plateauU1 } = this.layout;
    const spots = [];
    let guardTries = 0;
    while (spots.length < 46 && guardTries++ < 400) {
      const a = rnd() * Math.PI * 2;
      const r = 12 + rnd() * (WORLD.biomeRadius - 16);
      const u = Math.cos(a) * r;
      const v = Math.sin(a) * r;
      if (u > rampU0 - 12 && u < plateauU1 + 14 && Math.abs(v) < 28) continue;   // keep the drive clear
      spots.push({ u, v, s: 0.7 + rnd() * 0.9, r: rnd() * 6.28 });
    }
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    for (const part of propParts(prop, propColor)) {
      const inst = new THREE.InstancedMesh(part.geo, mat(part.color, part.emissive ? { emissive: part.emissive } : {}), spots.length);
      inst.castShadow = true;
      spots.forEach((p, i) => {
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.r);
        m4.compose(
          new THREE.Vector3(p.u + (part.x || 0) * p.s, part.y * p.s, p.v),
          q,
          new THREE.Vector3(p.s, p.s * (part.sy || 1), p.s),
        );
        inst.setMatrixAt(i, m4);
      });
      root.add(inst);
    }
  }

  setEggVisible(v) {
    this.egg.visible = v;
  }

  update(time) {
    if (this.egg.visible) {
      this.egg.rotation.y = time * 1.4;
      this.egg.position.y = WORLD.rampHeight + 2.4 + Math.sin(time * 2.2 + this.index) * 0.4;
    }
  }
}

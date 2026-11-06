import * as THREE from 'three';
import { mat } from '../util/materials.js';
import { groundHeight, distXZ } from '../../shared/gameData.js';

// The robot guard of one biome. It stands next to the egg, and chases the car once the egg is stolen.
export class Guard {
  constructor(layout) {
    this.home = { x: layout.guard.x, z: layout.guard.z };
    this.x = this.home.x;
    this.z = this.home.z;
    this.chasing = false;
    this.t = 0;
    this.stunUntil = 0;

    const g = new THREE.Group();
    const torso = new THREE.Mesh(new THREE.BoxGeometry(2, 2.4, 1.4), mat(0x9aa4b5, { metal: 0.6, rough: 0.35 }));
    torso.position.y = 2.6;
    this.head = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.2, 1.3), mat(0xc9d1de, { metal: 0.6, rough: 0.3 }));
    this.head.position.y = 4.4;
    this.eye = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.3, 0.1), new THREE.MeshBasicMaterial({ color: 0x33ff66 }));
    this.eye.position.set(0, 0.1, 0.68);
    this.head.add(this.eye);
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.9), mat(0x555555));
    antenna.position.y = 5.4;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3333 }));
    bulb.position.y = 5.9;
    g.add(torso, this.head, antenna, bulb);
    this.legs = [];
    for (const sx of [-0.6, 0.6]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.8, 0.8), mat(0x6c7686, { metal: 0.5 }));
      leg.position.set(sx, 0.9, 0);
      g.add(leg);
      this.legs.push(leg);
    }
    for (const sx of [-1.4, 1.4]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.8, 0.6), mat(0x6c7686, { metal: 0.5 }));
      arm.position.set(sx, 2.6, 0);
      g.add(arm);
    }
    g.scale.setScalar(1.15);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.mesh = g;
    this.updateMesh();
  }

  updateMesh() {
    this.mesh.position.set(this.x, groundHeight(this.x, this.z), this.z);
  }

  start() {
    this.chasing = true;
    this.eye.material.color.set(0xff2222);
  }

  stun(seconds) {
    this.stunUntil = this.t + seconds;
    this.eye.material.color.set(0xffd23f);
  }

  // push the guard away from a point (the bat)
  knockback(fromX, fromZ, dist) {
    const dx = this.x - fromX;
    const dz = this.z - fromZ;
    const d = Math.hypot(dx, dz) || 1;
    this.x += (dx / d) * dist;
    this.z += (dz / d) * dist;
    this.updateMesh();
  }

  reset() {
    this.stunUntil = 0;
    this.chasing = false;
    this.x = this.home.x;
    this.z = this.home.z;
    this.legs.forEach((l) => { l.rotation.x = 0; });
    this.eye.material.color.set(0x33ff66);
    this.updateMesh();
  }

  // returns true when the guard has caught the car
  update(dt, target, speed) {
    this.t += dt;
    if (!this.chasing) {
      this.mesh.rotation.y += Math.sin(this.t * 1.3) * dt * 0.8;   // scanning
      this.head.rotation.y = Math.sin(this.t * 2) * 0.4;
      return false;
    }
    if (this.t < this.stunUntil) {
      this.legs.forEach((l) => { l.rotation.x = 0; });
      return false;
    }
    this.eye.material.color.set(0xff2222);
    const dx = target.x - this.x;
    const dz = target.z - this.z;
    const d = Math.hypot(dx, dz) || 1;
    const step = Math.min(speed * dt, d);
    this.x += (dx / d) * step;
    this.z += (dz / d) * step;
    this.mesh.rotation.y = Math.atan2(dx, dz);
    this.head.rotation.y = 0;
    const w = Math.sin(this.t * 14) * 0.6;
    this.legs[0].rotation.x = w;
    this.legs[1].rotation.x = -w;
    this.updateMesh();
    return distXZ(this.x, this.z, target.x, target.z) < 3.6 && Math.abs(target.y - this.mesh.position.y) < 4;
  }

  distanceTo(target) {
    return distXZ(this.x, this.z, target.x, target.z);
  }
}

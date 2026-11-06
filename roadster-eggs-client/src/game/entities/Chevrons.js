import * as THREE from 'three';
import { groundHeight } from '../../shared/gameData.js';

const COUNT = 12;
const SPACING = 7;

// The white chevron trail that points the way to the current objective (like the reference game).
export class Chevrons {
  constructor(scene) {
    const shape = new THREE.Shape();
    const pts = [[0, 1.7], [1.8, -0.2], [1.8, -1.4], [0, 0.3], [-1.8, -1.4], [-1.8, -0.2]];
    pts.forEach(([x, y], i) => (i ? shape.lineTo(x, y) : shape.moveTo(x, y)));
    shape.closePath();
    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(Math.PI / 2);   // lie flat, tip toward +z
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92, side: THREE.DoubleSide, depthWrite: false }), COUNT);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    scene.add(this.mesh);
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.up = new THREE.Vector3(0, 1, 0);
  }

  hide() {
    this.mesh.count = 0;
  }

  // target: { x, z } or null
  update(target, body, time) {
    if (!target) return this.hide();
    const dx = target.x - body.x;
    const dz = target.z - body.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 24) return this.hide();
    const ux = dx / dist;
    const uz = dz / dist;
    this.q.setFromAxisAngle(this.up, Math.atan2(ux, uz));
    const offset = (time * 9) % SPACING;
    let n = 0;
    for (let i = 0; i < COUNT; i++) {
      const d = 9 + i * SPACING + offset;
      if (d > dist - 10) break;
      const x = body.x + ux * d;
      const z = body.z + uz * d;
      const fade = 1 - i / COUNT * 0.4;
      this.m.compose(new THREE.Vector3(x, groundHeight(x, z) + 0.35, z), this.q, new THREE.Vector3(fade, 1, fade));
      this.mesh.setMatrixAt(n++, this.m);
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

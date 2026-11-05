import * as THREE from 'three';
import { mat } from '../util/materials.js';

// A Tesla-Roadster-style low two-seater built from primitives. The car faces +Z in local space.
export function makeCar(color) {
  const g = new THREE.Group();
  const paint = mat(color, { metal: 0.45, rough: 0.35 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.55, 4.4), paint);
  body.position.y = 0.65;
  body.castShadow = true;
  g.add(body);

  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.35, 1.4), paint);
  nose.position.set(0, 0.55, 2.55);
  nose.rotation.x = 0.12;
  g.add(nose);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.45, 1.5), mat(0x1a2433, { metal: 0.6, rough: 0.2 }));
  cabin.position.set(0, 1.1, -0.2);
  g.add(cabin);

  const wing = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.1, 0.5), mat(0x111111));
  wing.position.set(0, 1.15, -2.1);
  g.add(wing);

  const lightMat = mat(0xfff6c8, { emissive: 0xfff6c8 });
  const tailMat = mat(0xff2020, { emissive: 0xff2020 });
  for (const sx of [-0.7, 0.7]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.1), lightMat);
    l.position.set(sx, 0.7, 3.25);
    g.add(l);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.1), tailMat);
    t.position.set(sx, 0.75, -2.22);
    g.add(t);
  }

  const wheelGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.4, 14);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = mat(0x1b1b1f);
  const wheels = [];
  for (const [x, z] of [[-1.15, 1.45], [1.15, 1.45], [-1.15, -1.45], [1.15, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.position.set(x, 0.5, z);
    w.castShadow = true;
    g.add(w);
    wheels.push(w);
  }

  // nitro flame
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.35, 2.2, 8), new THREE.MeshBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0.85 }));
  flame.rotation.x = -Math.PI / 2;
  flame.position.set(0, 0.7, -3.4);
  flame.visible = false;
  g.add(flame);

  g.userData = {
    wheels,
    flame,
    setColor(c) {
      const m = mat(c, { metal: 0.45, rough: 0.35 });
      body.material = m;
      nose.material = m;
    },
  };
  return g;
}

export function spinWheels(car, distance) {
  for (const w of car.userData.wheels) w.rotation.x += distance / 0.5;
}

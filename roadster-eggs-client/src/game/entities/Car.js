import * as THREE from 'three';
import { mat } from '../util/materials.js';

// The reference roadster: a long, low Lamborghini-style wedge (white), an open cockpit with the driver's head
// and shoulders sticking out, tinted glass, dark sills and intakes, a big rear wing on two struts, black
// 5-spoke wheels and a red tail strip. Built from an extruded side profile so the silhouette is right.
// Faces +Z, ~7.4 units long.

const W = 2.5;   // body width

// side profile (z = along the car, y = up), extruded across the width
function profileGeometry(points, width, bevel = 0.1) {
  const sh = new THREE.Shape();
  points.forEach(([z, y], i) => (i ? sh.lineTo(z, y) : sh.moveTo(z, y)));
  sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: width - bevel * 2, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1 });
  g.rotateY(-Math.PI / 2);          // shape x -> +z (forward), extrusion -> -x
  g.translate(width / 2 - bevel, 0, 0);
  g.computeVertexNormals();
  return g;
}

export function makeCar(color) {
  const g = new THREE.Group();
  const paint = mat(color, { metal: 0.05, rough: 0.35 });
  const glass = mat(0x24354f, { metal: 0.5, rough: 0.15 });
  const dark = mat(0x1d2633, { rough: 0.6 });

  // main body
  const body = new THREE.Mesh(profileGeometry([
    [-3.7, 0.42], [-3.75, 1.15], [-2.9, 1.3], [-1.9, 1.36], [-0.5, 1.4], [0.9, 1.22], [2.4, 0.98], [3.55, 0.7], [3.8, 0.5], [3.6, 0.3], [-3.4, 0.3],
  ], W), paint);
  body.castShadow = true;
  g.add(body);

  // tinted canopy (low, open at the top where the driver sits)
  const canopy = new THREE.Mesh(profileGeometry([
    [-2.3, 1.3], [-1.6, 1.62], [-0.7, 1.7], [0.15, 1.62], [1.25, 1.22],
  ], W * 0.74, 0.04), glass);
  g.add(canopy);
  // engine cover slats behind the cockpit
  for (let i = 0; i < 3; i++) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(W * 0.6, 0.06, 0.18), dark);
    slat.position.set(0, 1.38, -2.2 - i * 0.35);
    g.add(slat);
  }

  // dark sills + side intakes
  for (const sx of [-1, 1]) {
    const sill = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.28, 3.6), dark);
    sill.position.set(sx * (W / 2 + 0.02), 0.42, 0.05);
    g.add(sill);
    const intake = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.42, 0.9), dark);
    intake.position.set(sx * (W / 2 + 0.03), 0.95, -1.15);
    intake.rotation.x = -0.45;
    g.add(intake);
    const vent = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.5), mat(0xff8a2a, { emissive: 0xff6a00 }));
    vent.position.set(sx * (W / 2 + 0.04), 0.9, 1.75);
    g.add(vent);
  }
  // front splitter + rear diffuser
  const splitter = new THREE.Mesh(new THREE.BoxGeometry(W + 0.1, 0.1, 0.5), dark);
  splitter.position.set(0, 0.32, 3.55);
  const diffuser = new THREE.Mesh(new THREE.BoxGeometry(W - 0.2, 0.3, 0.3), dark);
  diffuser.position.set(0, 0.45, -3.72);
  g.add(splitter, diffuser);

  // thin angry headlights + red tail strip
  const lightMat = mat(0xeaf6ff, { emissive: 0xcfeaff });
  for (const sx of [-0.78, 0.78]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.07, 0.14), lightMat);
    l.position.set(sx, 0.78, 3.5);
    l.rotation.z = sx > 0 ? -0.12 : 0.12;
    g.add(l);
  }
  const strip = new THREE.Mesh(new THREE.BoxGeometry(W - 0.3, 0.1, 0.08), mat(0xe02020, { emissive: 0xe02020 }));
  strip.position.set(0, 1.0, -3.79);
  g.add(strip);

  // big rear wing on two struts, with end plates
  const wing = new THREE.Mesh(new THREE.BoxGeometry(W + 0.5, 0.1, 0.85), paint);
  wing.position.set(0, 2.05, -3.15);
  wing.rotation.x = 0.08;
  g.add(wing);
  for (const sx of [-1, 1]) {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.85, 0.22), dark);
    strut.position.set(sx * 0.75, 1.6, -3.05);
    strut.rotation.x = -0.35;
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 0.95), paint);
    plate.position.set(sx * (W / 2 + 0.25), 1.95, -3.15);
    g.add(strut, plate);
  }

  // wheels: black tyre, light rim with 5 dark spokes
  const tyreGeo = new THREE.CylinderGeometry(0.6, 0.6, 0.48, 18);
  tyreGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.44, 0.44, 0.5, 18);
  rimGeo.rotateZ(Math.PI / 2);
  const tyreMat = mat(0x16181c);
  const rimMat = mat(0xd9e4ee, { metal: 0.4, rough: 0.3 });
  const spokeMat = mat(0x22303e);
  const wheels = [];
  for (const [x, z] of [[-1.22, 2.35], [1.22, 2.35], [-1.22, -2.3], [1.22, -2.3]]) {
    const w = new THREE.Mesh(tyreGeo, tyreMat);
    w.position.set(x, 0.6, z);
    w.castShadow = true;
    w.add(new THREE.Mesh(rimGeo, rimMat));
    for (let k = 0; k < 5; k++) {
      const pivot = new THREE.Group();
      pivot.rotation.x = (k / 5) * Math.PI * 2;
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.12, 0.36), spokeMat);
      spoke.position.z = 0.2;
      pivot.add(spoke);
      w.add(pivot);
    }
    const hub = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.18, 0.18), spokeMat);
    w.add(hub);
    g.add(w);
    wheels.push(w);
  }
  // dark wheel arches
  for (const [x, z] of [[-1.22, 2.35], [1.22, 2.35], [-1.22, -2.3], [1.22, -2.3]]) {
    const arch = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 1.5), dark);
    arch.position.set(x + Math.sign(x) * 0.07, 1.22, z);
    g.add(arch);
  }

  // the base character sitting in the open cockpit (head + shoulders show)
  const driver = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.9, 0.5), mat(0x1b1c20));
  torso.position.set(0, 1.5, -0.7);
  const shirt = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.88, 0.52), mat(0x2f8fd6));
  shirt.position.set(0, 1.5, -0.7);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 0.62), mat(0xf4f4f2));
  head.position.set(0, 2.2, -0.7);
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.36, 0.76), mat(0xb5651d));
  hair.position.set(0, 2.5, -0.74);
  const hairBack = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.5, 0.2), mat(0xb5651d));
  hairBack.position.set(0, 2.24, -1.04);
  const eyes = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.05), mat(0x222222));
  eyes.position.set(0, 2.26, -0.38);
  driver.add(torso, shirt, head, hair, hairBack, eyes);
  g.add(driver);

  // nitro flame
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.4, 2.4, 8), new THREE.MeshBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0.85 }));
  flame.rotation.x = -Math.PI / 2;
  flame.position.set(0, 0.7, -4.9);
  flame.visible = false;
  g.add(flame);

  let seated = null;
  g.userData = {
    wheels,
    flame,
    driver,
    // seat a character (e.g. the player's Bloxity character) instead of the built-in block driver
    setDriver(character) {
      if (seated) driver.remove(seated);
      seated = character;
      for (const c of driver.children) c.visible = !character;
      if (!character) return;
      const k = 0.78;
      character.scale.setScalar(k);
      character.position.set(0, 2.78 - 3.5 * k, -0.7);   // head and shoulders above the cockpit, legs hidden in the body
      character.visible = true;
      driver.add(character);
    },
    setColor(c) {
      const m = mat(c, { metal: 0.05, rough: 0.35 });
      body.material = m;
      wing.material = m;
      g.children.forEach((ch) => { if (ch.material === paint) ch.material = m; });
    },
  };
  return g;
}

export function spinWheels(car, distance) {
  for (const w of car.userData.wheels) w.rotation.x += distance / 0.6;
}

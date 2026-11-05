import * as THREE from 'three';

// An egg: an ellipsoid with a few spots, base colour + spot colour per biome.
export function makeEgg([base, spot], size = 1) {
  const g = new THREE.Group();
  const geo = new THREE.SphereGeometry(1, 20, 16);
  geo.scale(0.75, 1, 0.75);
  const shell = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: base, roughness: 0.35, metalness: 0.1 }));
  shell.castShadow = true;
  g.add(shell);
  const spotMat = new THREE.MeshStandardMaterial({ color: spot, roughness: 0.5 });
  const rnd = (n) => { const x = Math.sin(n * 91.7) * 10000; return x - Math.floor(x); };
  for (let i = 0; i < 7; i++) {
    const phi = rnd(i + 1) * Math.PI * 2;
    const th = 0.5 + rnd(i + 9) * 2.1;
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.17 + rnd(i + 3) * 0.1, 8, 6), spotMat);
    s.position.set(Math.sin(th) * Math.cos(phi) * 0.74, Math.cos(th), Math.sin(th) * Math.sin(phi) * 0.74);
    g.add(s);
  }
  g.scale.setScalar(size);
  return g;
}

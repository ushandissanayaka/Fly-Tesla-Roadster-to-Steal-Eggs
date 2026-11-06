import * as THREE from 'three';
import { mat } from '../util/materials.js';

const WIDTHS = [1.0, 1.6, 2.0, 2.2, 2.2, 2.0, 1.6, 1.0];   // voxel egg: stacked cubes, widest in the middle
const LAYER = 0.55;

// A voxel egg (stacked cubes) like the reference: base colour with a coloured band at the bottom and a tuft on top.
export function makeEgg([base, spot], size = 1) {
  const g = new THREE.Group();
  const baseMat = mat(base, { rough: 0.5 });
  const spotMat = mat(spot, { rough: 0.5 });
  WIDTHS.forEach((w, i) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, LAYER, w), i < 2 || i === 4 ? spotMat : baseMat);
    m.position.y = i * LAYER + LAYER / 2 - (WIDTHS.length * LAYER) / 2;
    m.castShadow = true;
    g.add(m);
  });
  const tuft = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.5), spotMat);
  tuft.position.y = (WIDTHS.length * LAYER) / 2 + 0.2;
  g.add(tuft);
  g.scale.setScalar(size * 0.5);
  return g;
}

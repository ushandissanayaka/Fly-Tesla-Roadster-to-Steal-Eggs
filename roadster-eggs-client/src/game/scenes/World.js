import * as THREE from 'three';
import { BIOMES, WORLD, biomeLayout } from '../../shared/gameData.js';
import { mat } from '../util/materials.js';
import { Base } from '../entities/Base.js';
import { Biome } from '../entities/Biome.js';

const DEFAULT_SKY = new THREE.Color(0x9fd8ff);

// The whole map: base in the middle, 10 biomes on a ring around it, roads from the base to each ramp.
export class World {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = DEFAULT_SKY.clone();
    this.scene.fog = new THREE.Fog(DEFAULT_SKY.getHex(), 120, 520);

    this.sun = new THREE.DirectionalLight(0xffffff, 2.2);
    this.sun.position.set(80, 140, 60);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const c = this.sun.shadow.camera;
    c.left = -90; c.right = 90; c.top = 90; c.bottom = -90; c.near = 10; c.far = 400;
    this.scene.add(this.sun, this.sun.target);
    this.scene.add(new THREE.HemisphereLight(0xdff2ff, 0x7a6a55, 1.1));

    const ground = new THREE.Mesh(new THREE.CircleGeometry(WORLD.worldRadius + 300, 64), mat(0x7ccf5a));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    ground.receiveShadow = true;
    this.scene.add(ground);

    this.base = new Base(this.scene);

    // roads from the base to each biome's ramp
    const roadLen = WORLD.ringRadius + WORLD.rampStartU - WORLD.baseRadius;
    for (let i = 0; i < BIOMES.length; i++) {
      const { ang } = biomeLayout(i);
      const road = new THREE.Mesh(new THREE.BoxGeometry(roadLen, 0.1, WORLD.rampHalfWidth * 2 + 2), mat(0x4b5060, { rough: 0.95 }));
      const mid = WORLD.baseRadius + roadLen / 2;
      road.position.set(Math.cos(ang) * mid, 0.06, Math.sin(ang) * mid);
      road.rotation.y = -ang;
      road.receiveShadow = true;
      this.scene.add(road);
      const dash = new THREE.InstancedMesh(new THREE.BoxGeometry(5, 0.12, 0.5), mat(0xf2f2f2), Math.floor(roadLen / 14));
      const m4 = new THREE.Matrix4();
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -ang);
      for (let k = 0; k < dash.count; k++) {
        const r = WORLD.baseRadius + 8 + k * 14;
        m4.compose(new THREE.Vector3(Math.cos(ang) * r, 0.14, Math.sin(ang) * r), q, new THREE.Vector3(1, 1, 1));
        dash.setMatrixAt(k, m4);
      }
      this.scene.add(dash);
    }

    this.biomes = BIOMES.map((_, i) => new Biome(this.scene, i));
    this.skyTarget = DEFAULT_SKY.clone();
  }

  // biome index whose area contains (x, z), or -1
  biomeAt(x, z) {
    for (let i = 0; i < BIOMES.length; i++) {
      const L = biomeLayout(i);
      if (Math.hypot(x - L.cx, z - L.cz) < WORLD.biomeRadius + 10) return i;
    }
    return -1;
  }

  update(dt, focus, time) {
    const i = this.biomeAt(focus.x, focus.z);
    this.skyTarget.setHex(i >= 0 ? BIOMES[i].sky : DEFAULT_SKY.getHex());
    this.scene.background.lerp(this.skyTarget, Math.min(1, dt * 2));
    this.scene.fog.color.copy(this.scene.background);
    this.sun.position.set(focus.x + 80, 140, focus.z + 60);
    this.sun.target.position.set(focus.x, 0, focus.z);
    for (const b of this.biomes) b.update(time);
  }
}

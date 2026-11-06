import * as THREE from 'three';
import { BIOMES, WORLD, biomeLayout, nightAt } from '../../shared/gameData.js';
import { PALETTE, studMaterial } from '../util/textures.js';
import { Base } from '../entities/Base.js';
import { Biome } from '../entities/Biome.js';
import { Hub } from '../entities/Hub.js';
import { Lobby, LOBBY } from '../entities/Lobby.js';
import { setWallNight, updateWallFx } from '../entities/Cliffs.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { buildTracks } from '../entities/Town.js';

// sun direction (from the ground towards the sun) and the light-space basis used for texel snapping
const SUN_OFFSET = new THREE.Vector3(80, 160, 60);
const SUN_DIST = SUN_OFFSET.length();
const SUN_DIR = SUN_OFFSET.clone().normalize();
const SUN_RIGHT = new THREE.Vector3(0, 1, 0).cross(SUN_DIR).normalize();
const SUN_UP = SUN_DIR.clone().cross(SUN_RIGHT);
const _sunP = new THREE.Vector3();

const dayTop = new THREE.Color(PALETTE.skyTop);
const dayHorizon = new THREE.Color(PALETTE.skyHorizon);
const nightTop = new THREE.Color(PALETTE.nightTop);
const nightHorizon = new THREE.Color(PALETTE.nightHorizon);

// The whole map, built like the reference: a rectangular lime "lego plate" lobby boxed in by stepped
// dirt-block cliffs (green slab on every block), four fenced pens, the hub stations along the track,
// leaderboards at the far end, and ONE paved track that leaves the lobby and runs through every egg zone.
export class World {
  constructor() {
    this.scene = new THREE.Scene();
    this.skyCanvas = document.createElement('canvas');
    this.skyCanvas.width = 4;
    this.skyCanvas.height = 256;
    this.skyTex = new THREE.CanvasTexture(this.skyCanvas);
    this.skyTex.colorSpace = THREE.SRGBColorSpace;
    this.scene.background = this.skyTex;
    this.scene.fog = new THREE.Fog(PALETTE.skyHorizon, 300, 1300);
    this.nightF = 0;
    this.drawSky(0);

    this.sun = new THREE.DirectionalLight(0xffffff, 2.4);
    this.sun.position.set(80, 140, 60);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.shadowsOn = true;
    const c = this.sun.shadow.camera;
    c.left = -90; c.right = 90; c.top = 90; c.bottom = -90; c.near = 10; c.far = 400;
    this.scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xdff2ff, 0x7a6a55, 1.15);
    this.scene.add(this.hemi);

    // one big studded grass plate under everything
    const x0 = -520;
    const x1 = LOBBY.endX + 300;
    const z0 = -480;
    const z1 = 560;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(x1 - x0, z1 - z0),
      studMaterial(PALETTE.grass, (x1 - x0) / 4, (z1 - z0) / 4),   // ~1 unit studs, like the reference
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set((x0 + x1) / 2, -0.02, (z0 + z1) / 2);
    ground.receiveShadow = true;
    this.scene.add(ground);

    this.lobby = new Lobby(this.scene);
    buildTracks(this.scene);
    this.base = new Base(this.scene);
    this.hub = new Hub(this.scene);
    this.buildClouds();

    this.biomes = BIOMES.map((_, i) => new Biome(this.scene, i));

    // static scenery never moves: skip its per-frame matrix updates
    const frozen = new Set([this.lobby.drone]);
    const freeze = (o) => { if (frozen.has(o)) return; o.updateMatrix(); o.matrixAutoUpdate = false; o.children.forEach(freeze); };
    freeze(this.lobby.group);
    ground.updateMatrix();
    ground.matrixAutoUpdate = false;
  }

  setShadowQuality(size, on) {
    this.shadowsOn = on;
    this.sun.castShadow = on;
    if (this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
  }

  drawSky(f) {
    const ctx = this.skyCanvas.getContext('2d');
    const top = dayTop.clone().lerp(nightTop, f);
    const hor = dayHorizon.clone().lerp(nightHorizon, f);
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, `#${top.getHexString()}`);
    g.addColorStop(0.62, `#${hor.getHexString()}`);
    g.addColorStop(1, `#${hor.getHexString()}`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 4, 256);
    this.skyTex.needsUpdate = true;
  }

  // soft blocky clouds over the lobby and the track
  buildClouds() {
    // puffy low-poly clouds: each one a cluster of flattened round puffs, all merged into one mesh
    const parts = [];
    let s = 21;
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    const puff = new THREE.IcosahedronGeometry(1, 1);
    const spots = [];
    for (let i = 0; i < 46; i++) spots.push([-450 + rnd() * (LOBBY.endX + 850), 170 + rnd() * 120, -650 + rnd() * 1400, 0.8 + rnd() * 0.9]);
    for (let i = 0; i < 10; i++) spots.push([-220 + rnd() * 420, 150 + rnd() * 60, -160 + rnd() * 380, 0.9 + rnd() * 0.6]);   // a few right over the lobby
    for (const [x, y, z, k] of spots) {
      const n = 4 + Math.floor(rnd() * 4);
      const len = (40 + rnd() * 40) * k;
      for (let j = 0; j < n; j++) {
        const t = j / (n - 1);
        const mid = 1 - Math.abs(t - 0.5) * 2;   // bigger puffs in the middle
        const r = (12 + mid * 14 + rnd() * 6) * k;
        const g = puff.clone();
        g.scale(r * 1.15, r * (0.62 + rnd() * 0.15), r);
        g.translate(x + (t - 0.5) * len, y + mid * r * 0.35, z + (rnd() - 0.5) * 14 * k);
        parts.push(g);
      }
      // a flat-ish base so the bottom reads as a cloud bank
      const base = puff.clone();
      base.scale(len * 0.62, 6 * k, 16 * k);
      base.translate(x, y - 4 * k, z);
      parts.push(base);
    }
    puff.dispose();
    this.cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xc9dcec, emissiveIntensity: 0.55, flatShading: true, fog: false });
    this.clouds = new THREE.Mesh(mergeGeometries(parts), this.cloudMat);
    parts.forEach((g) => g.dispose());
    this.clouds.frustumCulled = false;
    this.scene.add(this.clouds);
  }


  // biome index whose area contains (x, z), or -1
  biomeAt(x, z) {
    for (let i = 0; i < BIOMES.length; i++) {
      const L = biomeLayout(i);
      if (Math.hypot(x - L.cx, z - L.cz) < WORLD.biomeRadius + 10) return i;
    }
    return -1;
  }

  update(dt, focus, time, serverNow) {
    // day / night (with a short fade) on the shared server clock
    const n = nightAt(serverNow);
    const target = n.night ? 1 : n.untilNight < 4000 ? 1 - n.untilNight / 4000 : 0;
    this.nightF += (target - this.nightF) * Math.min(1, dt * 1.5);
    if (Math.abs(this.nightF - (this._drawnF ?? -1)) > 0.01) {
      this._drawnF = this.nightF;
      this.drawSky(this.nightF);
      const f = this.nightF;
      this.sun.intensity = 2.4 - 2.1 * f;
      this.sun.color.setHex(f > 0.5 ? 0x8fa8ff : 0xffffff);
      this.hemi.intensity = 1.15 - 0.8 * f;
      this.scene.fog.color.copy(dayHorizon).lerp(nightHorizon, f);
      setWallNight(f);
      this.cloudMat.emissiveIntensity = 0.55 * (1 - 0.85 * f);
      this.cloudMat.color.setScalar(1 - 0.6 * f);
    }
    // the sun follows the player, snapped to whole shadow-map texels in the light's own space, so the
    // shadow edges don't crawl / shimmer as you move
    const sc = this.sun.shadow.camera;
    const texel = (sc.right - sc.left) / this.sun.shadow.mapSize.x;
    const r = focus.x * SUN_RIGHT.x + focus.z * SUN_RIGHT.z;
    const u = focus.x * SUN_UP.x + focus.z * SUN_UP.z;
    const d = focus.x * SUN_DIR.x + focus.z * SUN_DIR.z;
    const rs = Math.round(r / texel) * texel;
    const us = Math.round(u / texel) * texel;
    _sunP.copy(SUN_RIGHT).multiplyScalar(rs).addScaledVector(SUN_UP, us).addScaledVector(SUN_DIR, d);
    this.sun.target.position.copy(_sunP);
    this.sun.position.copy(_sunP).addScaledVector(SUN_DIR, SUN_DIST);
    this.clouds.position.x = Math.sin(time * 0.01) * 60;
    updateWallFx(time);
    this.hub.update(time);
    this.lobby.update(time);
    for (const b of this.biomes) b.update(time);
  }
}

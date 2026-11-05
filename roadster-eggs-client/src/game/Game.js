import * as THREE from 'three';
import { World } from './scenes/World.js';
import { CarBody } from './systems/PhysicsWorld.js';
import { CameraController } from './systems/CameraController.js';
import { InputSystem } from './systems/InputSystem.js';
import { makeCar, spinWheels } from './entities/Car.js';
import { makeEgg } from './entities/Egg.js';
import { textSprite } from './util/canvasText.js';
import { bloxity } from '../bloxity/bloxity.js';
import { connect } from '../net/connection.js';
import { store, toast } from '../ui/store.js';
import { bootProgress, hideBoot } from '../ui/boot.js';
import {
  BIOMES, CAR_BY_ID, WORLD, biomeLayout, carStats, eventAt, distXZ, ANIMAL_BY_ID, MUTATIONS, fmt,
} from '../shared/gameData.js';

const SEND_EVERY = 1 / 15;
const DEFAULT_STATS = carStats('red', {});

export class Game {
  constructor(mount) {
    this.mount = mount;
    this.disposed = false;
    this.paused = false;
    this.time = 0;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.applyQuality(bloxity.settings.graphics_quality);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.className = 'game-canvas';
    mount.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(62, 1, 0.5, 1400);
    this.world = new World();
    this.camCtl = new CameraController(this.camera);
    this.input = new InputSystem();
    this.body = new CarBody();
    this.remotes = new Map();
    this.carId = 'red';

    this.car = makeCar(CAR_BY_ID.red.color);
    this.world.scene.add(this.car);
    this.nameTag = null;
    this.carriedEgg = null;
    this.carriedBiome = -1;
    this.grabPending = false;
    this.deliverAt = 0;
    this.sendTimer = 0;
    this.lastSent = '';
    this.room = null;

    store.setState({ isTouch: matchMedia('(pointer: coarse)').matches });

    this.onResize = () => this.resize();
    window.addEventListener('resize', this.onResize);
    this.resize();

    this.offSettings = bloxity.onSettings((s) => this.applyQuality(s.graphics_quality));
    this.offAd = bloxity.onAdBreak((e) => { this.paused = e === 'start'; if (this.paused) this.input.keys.clear(); });
    this.unsubStore = store.subscribe(() => this.onStore());
    this.lastModal = null;
  }

  applyQuality(q) {
    const ratio = { Low: 0.7, Medium: 1, High: Math.min(devicePixelRatio, 2), Ultra: Math.min(devicePixelRatio, 3) }[q] ?? 1;
    this.renderer.setPixelRatio(ratio);
    if (this.mount) this.resize();
  }

  resize() {
    const w = this.mount.clientWidth || innerWidth;
    const h = this.mount.clientHeight || innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // Ad screens: banners sit on the edges, menus stay centred.
  onStore() {
    const m = store.getState().modal;
    if (m === this.lastModal) return;
    this.lastModal = m;
    if (m) bloxity.screen('menu'); else bloxity.screen('gameplay');
  }

  send(type, msg) {
    this.room?.send(type, msg);
  }

  // ---------------------------------------------------------------- start / connect

  async start() {
    bootProgress(0.1, 'Building the world');
    bloxity.loadingStep('Connecting...');
    const me = { name: bloxity.displayName(), pfp: bloxity.pfp(), guest: !bloxity.user };
    store.setState({ me });

    this.nameTag = textSprite(me.name, { size: 40, scale: 0.016 });
    this.nameTag.position.y = 3.6;
    this.car.add(this.nameTag);

    bootProgress(0.4, 'Connecting');
    try {
      this.room = await connect({ token: bloxity.token(), guestKey: bloxity.guestKey(), guestName: me.name });
    } catch (err) {
      console.warn('[game] offline mode:', err?.message || err);
      toast('Server offline - you can still drive around', 'warn');
    }
    if (this.disposed) return;
    if (this.room) this.bindRoom(this.room);

    this.body.teleport((Math.random() - 0.5) * 12, 8 + Math.random() * 6, 0);
    this.camCtl.snap(this.body);

    bootProgress(1, 'ready');
    store.setState({ loading: false, connected: !!this.room });
    hideBoot();
    bloxity.loadingEnd();
    bloxity.gameplayStart();
    bloxity.screen('gameplay');

    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  bindRoom(room) {
    bloxity.updateRoom(room.roomId);
    room.onMessage('welcome', (m) => {
      if (m?.spawn) this.body.teleport(m.spawn.x, m.spawn.z, 0);
    });
    room.onMessage('profile', (p) => this.onProfile(p));
    room.onMessage('cash', (m) => store.setState({ money: m.money, income: m.income }));
    room.onMessage('snap', (m) => { this.body.x = m.x; this.body.z = m.z; this.body.y = m.y; });
    room.onMessage('grab', (m) => {
      this.grabPending = false;
      if (!m?.ok) return;
      this.carry(m.biome);
    });
    room.onMessage('dropped', () => this.uncarry());
    room.onMessage('deliver', (m) => {
      if (m?.ok) {
        this.uncarry();
        toast(`Egg delivered! Hatching in ${BIOMES[m.biome].hatchSec}s`, 'good');
      } else if (m?.error === 'incubators_full') {
        toast('Incubators are full - collect or upgrade!', 'warn');
      }
    });
    room.onMessage('collect', (m) => {
      if (m?.ok) store.setState({ hatchResult: { animal: m.animal, mut: m.mut } });
    });
    room.onMessage('sell', (m) => { if (m?.ok) toast(`Sold ${m.sold} for $${fmt(m.gained)}`, 'good'); });
    room.onMessage('buyCar', (m) => {
      if (!m?.ok) toast('Not enough money', 'warn');
      else toast(m.bought ? 'New car bought!' : 'Car equipped', 'good');
    });
    room.onMessage('upgrade', (m) => { if (!m?.ok) toast('Not enough money', 'warn'); });
    room.onMessage('grant', () => toast('Purchase received - thank you!', 'good'));
    room.onMessage('adReward', (m) => toast(m?.ok ? 'x2 income for 5 minutes!' : 'Ad reward could not be verified', m?.ok ? 'good' : 'warn'));

    const players = room.state.players;
    players.onAdd((p, key) => { if (key !== room.sessionId) this.addRemote(key, p); });
    players.onRemove((_p, key) => this.removeRemote(key));
    const count = () => store.setState({ online: players.size });
    players.onAdd(count);
    players.onRemove(count);
    count();
    room.onLeave(() => {
      store.setState({ connected: false });
      toast('Disconnected from the server', 'warn');
    });
  }

  onProfile(p) {
    store.setState({
      profile: p,
      money: p.money,
      income: p.income,
      clockOffset: p.serverNow - Date.now(),
    });
    this.carId = p.car;
    this.car.userData.setColor(CAR_BY_ID[p.car]?.color ?? 0xd81f26);
    this.world.base.setIncubators(p.incubators, p.slots, p.serverNow);
  }

  get stats() {
    return store.getState().profile?.stats || DEFAULT_STATS;
  }

  get serverNow() {
    return Date.now() + store.getState().clockOffset;
  }

  // ---------------------------------------------------------------- the heist

  carry(biome) {
    this.carriedBiome = biome;
    this.carriedEgg?.removeFromParent();
    this.carriedEgg = makeEgg(BIOMES[biome].egg, 0.9);
    this.carriedEgg.position.set(0, 2.1, -0.6);
    this.car.add(this.carriedEgg);
    const b = this.world.biomes[biome];
    b.setEggVisible(false);
    b.eggHiddenUntil = this.time + 6;
    b.guard.start();
    store.setState({ carrying: biome });
    toast(`You stole an egg! Get to the base!`, 'good');
    this.camCtl.shake = 0.5;
  }

  uncarry() {
    if (this.carriedBiome >= 0) this.world.biomes[this.carriedBiome].guard.reset();
    this.carriedEgg?.removeFromParent();
    this.carriedEgg = null;
    this.carriedBiome = -1;
    store.setState({ carrying: -1, chase: 0 });
  }

  teleportHome() {
    if (this.carriedBiome >= 0) this.send('caught');
    this.body.teleport(0, 0, this.body.ry);
    this.camCtl.snap(this.body);
  }

  // ---------------------------------------------------------------- remote players

  addRemote(id, state) {
    const mesh = makeCar(CAR_BY_ID[state.car]?.color ?? 0xd81f26);
    const tag = textSprite(state.name || 'Player', { size: 40, scale: 0.016 });
    tag.position.y = 3.6;
    mesh.add(tag);
    mesh.position.set(state.x, state.y, state.z);
    this.world.scene.add(mesh);
    const r = { mesh, state, tag, car: state.car, egg: null, carrying: -1, tx: state.x, ty: state.y, tz: state.z, ry: state.ry, last: new THREE.Vector3(state.x, state.y, state.z) };
    this.remotes.set(id, r);
  }

  removeRemote(id) {
    const r = this.remotes.get(id);
    if (!r) return;
    r.mesh.removeFromParent();
    r.tag.userData.dispose?.();
    this.remotes.delete(id);
  }

  updateRemotes(dt) {
    const k = 1 - Math.exp(-dt * 12);
    for (const r of this.remotes.values()) {
      const s = r.state;
      r.mesh.position.x += (s.x - r.mesh.position.x) * k;
      r.mesh.position.y += (s.y - r.mesh.position.y) * k;
      r.mesh.position.z += (s.z - r.mesh.position.z) * k;
      let d = s.ry - r.mesh.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      r.mesh.rotation.y += d * k;
      spinWheels(r.mesh, r.mesh.position.distanceTo(r.last));
      r.last.copy(r.mesh.position);
      if (s.car !== r.car) { r.car = s.car; r.mesh.userData.setColor(CAR_BY_ID[s.car]?.color ?? 0xd81f26); }
      r.mesh.userData.flame.visible = !!s.nitro;
      if (s.carrying !== r.carrying) {
        r.carrying = s.carrying;
        r.egg?.removeFromParent();
        r.egg = null;
        if (s.carrying >= 0) {
          r.egg = makeEgg(BIOMES[s.carrying].egg, 0.9);
          r.egg.position.set(0, 2.1, -0.6);
          r.mesh.add(r.egg);
        }
      }
    }
  }

  // ---------------------------------------------------------------- frame

  frame() {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    if (this.paused) { this.renderer.render(this.world.scene, this.camera); return; }
    this.time += dt;
    const body = this.body;
    const input = this.input.update();
    if (store.getState().modal) { input.throttle = 0; input.steer = 0; input.nitro = false; }

    const hasInfinite = !!store.getState().profile?.passes?.auto_nitro;
    const before = { x: body.x, z: body.z };
    body.update(dt, input, this.stats, hasInfinite);
    spinWheels(this.car, Math.hypot(body.x - before.x, body.z - before.z) * (body.speed >= 0 ? 1 : -1));

    this.car.position.set(body.x, body.y, body.z);
    this.car.rotation.y = body.ry;
    // tilt with the slope / in the air
    const pitchTarget = body.grounded ? 0 : THREE.MathUtils.clamp(-body.vy * 0.018, -0.45, 0.45);
    this.car.rotation.x += (pitchTarget - this.car.rotation.x) * Math.min(1, dt * 6);
    this.car.userData.flame.visible = body.nitroOn;

    if (body.crashed) this.camCtl.shake = 0.6;
    if (body.landed) {
      const dist = Math.round(body.landed.distance);
      this.send('jump', { distance: dist });
      if (dist >= 12) toast(`Jump! ${dist}m`, 'info');
    }

    this.camCtl.update(dt, body, parseFloat(bloxity.settings.camera_sensitivity) || 1);
    this.world.update(dt, body, this.time);
    this.world.base.update(dt, this.serverNow);

    this.updateHeist(dt);
    this.updateRemotes(dt);
    this.syncStore();
    this.sendMove(dt);

    this.renderer.render(this.world.scene, this.camera);
  }

  updateHeist(dt) {
    const body = this.body;
    const ev = eventAt(this.serverNow).event;
    const carrying = this.carriedBiome;

    for (const b of this.world.biomes) {
      if (!b.egg.visible && this.time > b.eggHiddenUntil && b.index !== carrying) b.setEggVisible(true);
      const guardSpeed = b.def.guardSpeed * (ev?.guard ?? 1);
      if (b.index === carrying) {
        const caught = b.guard.update(dt, body, guardSpeed);
        const d = b.guard.distanceTo(body);
        if (caught) {
          this.send('caught');
          toast('The robot caught you! Egg lost!', 'warn');
          body.speed *= 0.2;
          this.camCtl.shake = 0.9;
          this.uncarry();
        } else if (d > 220) {
          b.guard.reset();   // too far behind: the guard gives up (the egg stays on board)
        }
        store.setState({ chase: d });
      } else {
        b.guard.update(dt, body, guardSpeed);
      }
    }

    // grab: airborne or on the plateau, right at an egg
    if (carrying < 0 && !this.grabPending && this.room) {
      for (const b of this.world.biomes) {
        if (!b.egg.visible) continue;
        const e = b.layout.egg;
        if (distXZ(body.x, body.z, e.x, e.z) < 4.5 && body.y > WORLD.rampHeight - 1.5) {
          this.grabPending = true;
          this.send('grab', { biome: b.index });
          setTimeout(() => { this.grabPending = false; }, 1500);
          break;
        }
      }
    }

    // deliver: carrying the egg inside the base circle
    if (carrying >= 0 && Math.hypot(body.x, body.z) < WORLD.baseRadius - 2 && Date.now() > this.deliverAt) {
      this.deliverAt = Date.now() + 1500;
      this.send('deliver');
    }
    if (this.carriedEgg) this.carriedEgg.rotation.y += dt * 2;
  }

  syncStore() {
    const body = this.body;
    const s = store.getState();
    const speed = Math.round(body.speedNow * 2.2);
    const nitro = Math.round(body.nitro * 100) / 100;
    const nearBase = Math.hypot(body.x, body.z) < WORLD.baseRadius;
    if (s.speed !== speed || s.nitro !== nitro || s.airborne === body.grounded || s.nearBase !== nearBase) {
      store.setState({ speed, nitro, airborne: !body.grounded, nearBase });
    }
  }

  sendMove(dt) {
    this.sendTimer += dt;
    if (!this.room || this.sendTimer < SEND_EVERY) return;
    this.sendTimer = 0;
    const b = this.body;
    const msg = {
      x: +b.x.toFixed(2), y: +b.y.toFixed(2), z: +b.z.toFixed(2), ry: +b.ry.toFixed(3),
      speed: +b.speedNow.toFixed(1), nitro: b.nitroOn,
    };
    const key = `${msg.x}|${msg.y}|${msg.z}|${msg.ry}|${msg.nitro}`;
    if (key === this.lastSent) return;
    this.lastSent = key;
    this.room.send('move', msg);
  }

  describeHatch(r) {
    const a = ANIMAL_BY_ID[r.animal];
    return { animal: a, mutation: MUTATIONS[r.mut] };
  }

  dispose() {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    window.removeEventListener('resize', this.onResize);
    this.input.dispose();
    this.offSettings?.();
    this.offAd?.();
    this.unsubStore?.();
    bloxity.gameplayEnd();
    try { this.room?.leave(); } catch {}
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

import * as THREE from 'three';
import { World } from './scenes/World.js';
import { CarBody } from './systems/PhysicsWorld.js';
import { CameraController } from './systems/CameraController.js';
import { InputSystem } from './systems/InputSystem.js';
import { makeCar, spinWheels } from './entities/Car.js';
import { makeEgg } from './entities/Egg.js';
import { Chevrons } from './entities/Chevrons.js';
import { makeAvatar, animateAvatar, Poofs, CarFollower } from './entities/Avatar.js';

const parseLook = (str) => { try { return str ? JSON.parse(str) : null; } catch { return null; } };
import { onTrack, inField } from './entities/Lobby.js';
import { mat } from './util/materials.js';
import { textSprite } from './util/canvasText.js';
import { bloxity } from '../bloxity/bloxity.js';
import { connect } from '../net/connection.js';
import { store, toast } from '../ui/store.js';
import { bootProgress, hideBoot } from '../ui/boot.js';
import {
  BIOMES, CAR_BY_ID, WORLD, biomeLayout, carStats, eventAt, nightAt, distXZ, fmt, groundHeight,
} from '../shared/gameData.js';

const SEND_EVERY = 1 / 15;
const DEFAULT_STATS = carStats('white', {});
const TRAP_MAX = 3;
const TRAP_RECHARGE = 15;
const BAT_COOLDOWN = 2.5;
const WALK_SPEED = 17;

const MIN_SCALE = 0.85;   // lowest adaptive resolution scale (was 0.5, which made everything blurry)

export class Game {
  constructor(mount) {
    this.mount = mount;
    this.disposed = false;
    this.paused = false;
    this.time = 0;

    // performance: no MSAA on Low, cheap PCF shadows that refresh every other frame, and an adaptive
    // resolution scale (see adaptQuality) so slow machines stay smooth instead of lagging
    const low = bloxity.settings.graphics_quality === 'Low';
    this.renderer = new THREE.WebGLRenderer({ antialias: !low, powerPreference: 'high-performance', stencil: false });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.dynScale = 1;            // multiplies the quality's pixel ratio, MIN_SCALE .. 1
    this.frameAvg = 1 / 60;
    this.slowFor = 0;
    this.fastFor = 0;
    this.frameNo = 0;
    this.applyQuality(bloxity.settings.graphics_quality);
    this.renderer.domElement.className = 'game-canvas';
    mount.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(62, 1, 0.5, 1400);
    this.world = new World();
    this.applyQuality(bloxity.settings.graphics_quality);
    this.chevrons = new Chevrons(this.world.scene);
    this.camCtl = new CameraController(this.camera);
    this.bindLook();
    this.input = new InputSystem();
    this.body = new CarBody();
    this.remotes = new Map();
    this.carId = 'white';

    this.car = makeCar(CAR_BY_ID.white.color);
    this.world.scene.add(this.car);
    // you start the game on foot in the lobby; the roadster appears when you step onto a track
    // the player's own Bloxity base character (on foot) + the same character seated in the roadster
    this.avatar = makeAvatar(bloxity.avatarLook());
    this.driverAvatar = makeAvatar(bloxity.avatarLook());
    this.car.userData.setDriver(this.driverAvatar);
    this.world.scene.add(this.avatar);
    this.walking = true;
    this.bodyPos = new THREE.Vector3();
    this.follower = new CarFollower(this.car, true);   // the toy roadster that trots behind you in the lobby
    this.fx = new Poofs(this.world.scene);
    this.nameTag = null;
    this.carriedEgg = null;
    this.carriedBiome = -1;
    this.grabPending = false;
    this.deliverAt = 0;
    this.sendTimer = 0;
    this.lastSent = '';
    this.room = null;

    // hotbar items
    this.traps = [];
    this.trapCharges = TRAP_MAX;
    this.trapTimer = 0;
    this.batCd = 0;
    this.interactTarget = null;
    this.rewardAt = 0;
    this.lastGems = 0;

    store.setState({ isTouch: matchMedia('(pointer: coarse)').matches });

    this.onResize = () => this.resize();
    window.addEventListener('resize', this.onResize);
    this.onKey = (e) => {
      if (e.repeat || e.target?.tagName === 'INPUT') return;
      if (e.code === 'KeyE') this.interact();
      else if (e.code === 'Digit1') this.useBat();
      else if (e.code === 'Digit2') this.placeTrap();
    };
    window.addEventListener('keydown', this.onKey);
    this.resize();

    this.offSettings = bloxity.onSettings((s) => this.applyQuality(s.graphics_quality));
    this.offAd = bloxity.onAdBreak((e) => { this.paused = e === 'start'; if (this.paused) this.input.keys.clear(); });
    this.offUser = bloxity.onUser(() => this.updateLook());
    this.offAvatar = bloxity.onAvatarChanged(() => this.updateLook());
    this.unsubStore = store.subscribe(() => this.onStore());
    this.lastModal = null;
    if (new URLSearchParams(location.search).has('debug')) window.__game = this;   // console access while tuning
  }

  // mouse (either button) / touch drag orbits the camera, the wheel zooms
  bindLook() {
    const cv = this.renderer.domElement;
    cv.style.touchAction = 'none';
    let last = null;
    this.look = {
      down: (e) => {
        if (e.target !== cv) return;
        last = { x: e.clientX, y: e.clientY, id: e.pointerId };
        cv.setPointerCapture?.(e.pointerId);
      },
      move: (e) => {
        if (!last || e.pointerId !== last.id) return;
        const sens = parseFloat(bloxity.settings.camera_sensitivity) || 1;
        this.camCtl.drag(e.clientX - last.x, e.clientY - last.y, sens);
        last.x = e.clientX; last.y = e.clientY;
      },
      up: (e) => { if (last && e.pointerId === last.id) last = null; },
      wheel: (e) => { e.preventDefault(); this.camCtl.wheel(e.deltaY); },
      menu: (e) => e.preventDefault(),
    };
    cv.addEventListener('pointerdown', this.look.down);
    window.addEventListener('pointermove', this.look.move);
    window.addEventListener('pointerup', this.look.up);
    window.addEventListener('pointercancel', this.look.up);
    cv.addEventListener('wheel', this.look.wheel, { passive: false });
    cv.addEventListener('contextmenu', this.look.menu);
  }

  applyQuality(q) {
    this.quality = q;
    // never below the screen's own resolution on Medium+ so the character and the car stay sharp
    const dpr = Math.max(1, devicePixelRatio || 1);
    this.baseRatio = { Low: 0.85, Medium: 1, High: Math.min(dpr, 1.75), Ultra: Math.min(dpr, 2) }[q] ?? 1;
    this.shadowsWanted = q !== 'Low';
    this.renderer.setPixelRatio(this.baseRatio * (this.dynScale ?? 1));
    if (this.world) this.world.setShadowQuality(q === 'High' || q === 'Ultra' ? 2048 : 1024, this.shadowsWanted);
    if (this.mount && this.camera) this.resize();
  }

  // Keeps the game smooth on slow machines: if frames take too long, cut cost
  // (shadows go first, resolution only down to MIN_SCALE); when there is headroom again, step back up.
  adaptQuality(rawDt) {
    this.frameAvg += (rawDt - this.frameAvg) * 0.05;
    if (this.frameAvg > 1 / 45) { this.slowFor += rawDt; this.fastFor = 0; } else if (this.frameAvg < 1 / 57) { this.fastFor += rawDt; this.slowFor = 0; } else { this.slowFor = 0; this.fastFor = 0; }
    let changed = false;
    if (this.slowFor > 1.5) {
      this.slowFor = 0;
      // drop shadows first (cheap to lose, invisible blur-wise); only then lower the resolution a little.
      // MIN_SCALE keeps it from ever going soft enough to blur the character and the car.
      if (this.world.shadowsOn) this.world.setShadowQuality(1024, false);
      else if (this.dynScale > MIN_SCALE + 0.01) { this.dynScale = Math.max(MIN_SCALE, this.dynScale * 0.93); changed = true; }
    } else if (this.fastFor > 5) {
      // headroom again: resolution back up first, then the shadows
      this.fastFor = 0;
      if (this.dynScale < 1) { this.dynScale = Math.min(1, this.dynScale * 1.07); changed = true; } else if (this.shadowsWanted && !this.world.shadowsOn) this.world.setShadowQuality(1024, true);
    }
    if (changed) {
      this.renderer.setPixelRatio(this.baseRatio * this.dynScale);
      this.resize();
    }
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
    this.attachHolders();
    this.world.base.setOwner(me.pfp);

    bootProgress(0.4, 'Connecting');
    try {
      this.room = await connect({ token: bloxity.token(), guestKey: bloxity.guestKey(), guestName: me.name });
    } catch (err) {
      console.warn('[game] offline mode:', err?.message || err);
      toast('Server offline - you can still drive around', 'warn');
    }
    if (this.disposed) return;
    if (this.room) { this.bindRoom(this.room); this.sentLook = null; this.updateLook(); }

    this.body.teleport((Math.random() - 0.5) * 12, 8 + Math.random() * 6, 0);
    this.camCtl.snap(this.body);

    bootProgress(1, 'ready');
    store.setState({ loading: false, connected: !!this.room });
    hideBoot();
    bloxity.loadingEnd();
    bloxity.gameplayStart();
    bloxity.screen('gameplay');
    if (!store.getState().isTouch) toast('WASD move · drag to look · wheel zoom · Space jump · Shift run · E use', 'info');

    this.refreshGems();
    this.gemsTimer = setInterval(() => this.refreshGems(), 20_000);
    this.boardsTimer = setInterval(() => this.send('boards'), 30_000);
    this.send('boards');

    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  async refreshGems() {
    const g = await bloxity.gemsBalance();
    if (typeof g === 'number') store.setState({ gems: g });
  }

  bindRoom(room) {
    bloxity.updateRoom(room.roomId);
    room.onMessage('welcome', (m) => {
      if (m?.spawn) this.body.teleport(m.spawn.x, m.spawn.z, 0);
    });
    room.onMessage('profile', (p) => this.onProfile(p));
    room.onMessage('boards', (b) => this.world.hub.setBoards(b));
    room.onMessage('cash', (m) => store.setState({ money: m.money, income: m.income }));
    room.onMessage('snap', (m) => { this.body.x = m.x; this.body.z = m.z; this.body.y = m.y; });
    room.onMessage('grab', (m) => {
      this.grabPending = false;
      if (m?.ok) this.carry(m.biome);
      else if (m?.error === 'night') toast('Night time! Wait for day...', 'warn');
    });
    room.onMessage('dropped', () => this.uncarry());
    room.onMessage('deliver', (m) => {
      if (m?.ok) {
        this.uncarry();
        toast(`Egg placed on your plot! Hatching in ${BIOMES[m.biome].hatchSec}s`, 'good');
      } else if (m?.error === 'incubators_full') {
        toast('Incubators are full - open an egg or upgrade!', 'warn');
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
    room.onMessage('claimReward', (m) => toast(m?.ok ? `Free reward: +$${fmt(m.amount)}` : 'Reward is not ready yet', m?.ok ? 'good' : 'warn'));
    room.onMessage('rebirth', (m) => {
      if (m?.ok) { toast(`Rebirth ${m.rebirths}! Income bonus unlocked`, 'good'); store.setState({ modal: null }); }
      else toast('Not enough money to rebirth', 'warn');
    });
    room.onMessage('grant', () => { toast('Purchase received - thank you!', 'good'); this.refreshGems(); });
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
    this.rewardAt = Date.now() + p.rewardIn;
    this.carId = p.car;
    this.car.userData.setColor(CAR_BY_ID[p.car]?.color ?? 0xf0f9f9);
    this.world.base.setIncubators(p.incubators, p.slots, p.serverNow);
    this.world.base.setPets(p.animals);
    this.world.base.setIncome(p.income, p.rebirths);
  }

  // (re)build our character from the Bloxity avatar and tell the room so other players see the same look
  updateLook() {
    const look = bloxity.avatarLook();
    this.avatar?.userData.setLook(look);
    this.driverAvatar?.userData.setLook(look);
    const str = JSON.stringify(look || {});
    if (this.room && str !== this.sentLook) {
      this.sentLook = str;
      this.room.send('look', look || {});
    }
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
    this.attachHolders();
    const b = this.world.biomes[biome];
    b.setEggVisible(false);
    b.eggHiddenUntil = this.time + 6;
    b.guard.start();
    store.setState({ carrying: biome });
    toast('You stole an egg! Run back to your base!', 'good');
    this.camCtl.shake = 0.5;
  }

  uncarry() {
    if (this.carriedBiome >= 0) this.world.biomes[this.carriedBiome].guard.reset();
    this.carriedEgg?.removeFromParent();
    this.carriedEgg = null;
    this.carriedBiome = -1;
    store.setState({ carrying: -1, chase: 0 });
  }

  // ---------------------------------------------------------------- on foot in the lobby <-> in the car on the track

  // the name tag and the carried egg ride on whichever body is showing
  attachHolders() {
    const holder = this.walking ? this.avatar : this.car;
    if (this.nameTag) {
      holder.add(this.nameTag);
      this.nameTag.position.set(0, this.walking ? 5.2 : 4.2, 0);
    }
    if (this.carriedEgg) {
      holder.add(this.carriedEgg);
      this.carriedEgg.position.set(0, this.walking ? 5.6 : 3.1, this.walking ? 0 : -0.6);
    }
  }

  setWalking(w) {
    if (this.walking === w) return;
    this.walking = w;
    this.avatar.visible = w;
    this.fx.burst(this.body.x, this.body.y, this.body.z);
    this.camCtl.shake = 0.25;
    if (w) {
      this.body.speed = Math.min(this.body.speed, WALK_SPEED);
      this.body.nitroOn = false;
      this.car.rotation.x = 0;
    } else {
      toast('Your roadster is ready - hit the track!', 'info');
    }
    this.attachHolders();
  }

  // step onto the track -> into the car; drive back onto the lobby field -> on foot
  updateMode() {
    const b = this.body;
    if (this.walking && onTrack(b.x, b.z)) this.setWalking(false);
    else if (!this.walking && inField(b.x, b.z) && b.grounded) this.setWalking(true);
  }

  // simple on-foot movement (same controls as the car: W/S move, A/D turn, Shift sprints)
  walk(dt, input) {
    const b = this.body;
    b.landed = null;
    b.crashed = false;
    b.nitroOn = false;
    // Roblox-style: W/A/S/D are relative to the camera, the avatar turns to face where it goes, Space jumps
    const sprint = input.nitro ? 1.6 : 1;
    const f = this.camCtl.forward;
    let dx = f.x * input.throttle + f.z * input.steer;      // "left" of a view heading (sin, cos) is (cos, -sin)
    let dz = f.z * input.throttle - f.x * input.steer;
    const len = Math.hypot(dx, dz);
    const want = len > 0.01 ? WALK_SPEED * sprint : 0;
    if (len > 0.01) {
      dx /= len; dz /= len;
      const goal = Math.atan2(dx, dz);
      b.ry += Math.atan2(Math.sin(goal - b.ry), Math.cos(goal - b.ry)) * Math.min(1, dt * 13);
    }
    b.speed += (want - b.speed) * Math.min(1, dt * 10);
    b.vx = Math.sin(b.ry) * b.speed;
    b.vz = Math.cos(b.ry) * b.speed;
    b.x += b.vx * dt;
    b.z += b.vz * dt;
    const gh = groundHeight(b.x, b.z);
    if (b.grounded && input.brake) { b.vy = 15; b.grounded = false; }
    if (!b.grounded) {
      b.vy -= WORLD.gravity * dt;
      b.y += b.vy * dt;
      if (b.y <= gh) { b.y = gh; b.vy = 0; b.grounded = true; }
    } else {
      b.y = gh;
    }
    b.speedNow = Math.abs(b.speed);
  }

  teleportHome() {
    if (this.carriedBiome >= 0) this.send('caught');
    this.body.teleport(0, 0, this.body.ry);
    this.camCtl.snap(this.body);
  }

  // ---------------------------------------------------------------- hotbar: bat + bear traps

  useBat() {
    if (this.batCd > 0 || store.getState().modal) return;
    this.batCd = BAT_COOLDOWN;
    this.camCtl.shake = 0.25;
    const g = this.carriedBiome >= 0 ? this.world.biomes[this.carriedBiome].guard : null;
    if (g && g.chasing && g.distanceTo(this.body) < 11) {
      g.knockback(this.body.x, this.body.z, 16);
      g.stun(1.5);
      toast('Bonk! The robot got knocked back', 'good');
    }
  }

  placeTrap() {
    if (this.trapCharges <= 0 || store.getState().modal) return;
    this.trapCharges -= 1;
    const x = this.body.x - Math.sin(this.body.ry) * 4;
    const z = this.body.z - Math.cos(this.body.ry) * 4;
    const m = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.8, 0.3, 10), mat(0x555a66, { metal: 0.6 }));
    m.add(base);
    for (let i = 0; i < 8; i++) {
      const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.7, 4), mat(0xcfd6e0, { metal: 0.7 }));
      const a = (i / 8) * Math.PI * 2;
      tooth.position.set(Math.cos(a) * 1.2, 0.5, Math.sin(a) * 1.2);
      m.add(tooth);
    }
    m.position.set(x, this.body.y + 0.2, z);
    this.world.scene.add(m);
    this.traps.push({ mesh: m, x, z, until: this.time + 40 });
    toast('Bear trap placed', 'info');
  }

  updateTraps(dt) {
    if (this.trapCharges < TRAP_MAX) {
      this.trapTimer += dt;
      if (this.trapTimer >= TRAP_RECHARGE) { this.trapTimer = 0; this.trapCharges += 1; }
    }
    if (this.batCd > 0) this.batCd = Math.max(0, this.batCd - dt);
    const g = this.carriedBiome >= 0 ? this.world.biomes[this.carriedBiome].guard : null;
    this.traps = this.traps.filter((t) => {
      let alive = this.time < t.until;
      if (alive && g && g.chasing && distXZ(g.x, g.z, t.x, t.z) < 3.4) {
        g.stun(3.5);
        toast('The robot stepped in your trap!', 'good');
        alive = false;
      }
      if (!alive) t.mesh.removeFromParent();
      return alive;
    });
  }

  // ---------------------------------------------------------------- objective, prompt, chevrons

  // the farthest biome the current car can still clear (jump distance ~ speed^2 / 50)
  recommendedBiome() {
    const top = this.stats.topSpeed * 1.1;
    let best = 0;
    BIOMES.forEach((b, i) => { if (Math.sqrt(50 * (b.gap + 6)) <= top) best = i; });
    return best;
  }

  updateObjective() {
    const body = this.body;
    const now = this.serverNow;
    const night = nightAt(now);
    const prof = store.getState().profile;
    const readySlot = prof ? this.world.base.readySlot(now) : -1;
    const nearBase = Math.hypot(body.x, body.z) < WORLD.baseRadius + 30;

    let objective = 'Steal an Egg!';
    let target = null;
    if (night.night) {
      objective = `Night time! Wait for day... ${Math.ceil(night.left / 1000)}s`;
    } else if (this.carriedBiome >= 0) {
      objective = nearBase ? 'Place your Egg on your plot!' : 'Run back to your base!';
      target = { x: 0, z: 0 };
    } else if (readySlot >= 0) {
      objective = 'Open your Egg!';
      target = nearBase ? null : { x: 0, z: 0 };
    } else if (prof && prof.incubators.length >= prof.slots) {
      objective = 'Wait for your Eggs to hatch!';
    } else {
      const L = biomeLayout(this.recommendedBiome());
      target = L.toWorld(WORLD.rampStartU - 14, 0);
    }
    if (store.getState().modal) target = null;
    this.chevrons.update(target, body, this.time);

    // interaction prompt: ready egg at the plot, or a hub station
    let interact = null;
    if (readySlot >= 0 && Math.hypot(body.x, body.z) < WORLD.baseRadius) {
      interact = { id: 'egg', label: 'Open', sub: 'Ready!' };
    } else {
      const st = this.world.hub.nearest(body.x, body.z);
      if (st) {
        const reward = st.id === 'reward' && this.rewardAt > Date.now();
        interact = { id: st.id, label: reward ? 'Not ready' : st.info.prompt, sub: st.info.label };
      }
    }
    this.interactTarget = interact;

    const s = store.getState();
    const prompt = interact && !s.modal ? interact : null;
    if (s.objective !== objective || s.night !== night.night || s.prompt?.id !== prompt?.id || s.prompt?.label !== prompt?.label || s.trapCharges !== this.trapCharges || Math.ceil(s.batCd * 2) !== Math.ceil(this.batCd * 2)) {
      store.setState({ objective, night: night.night, prompt, trapCharges: this.trapCharges, batCd: this.batCd });
    }
  }

  // E key / tap on the prompt
  interact() {
    const t = this.interactTarget;
    if (!t || store.getState().modal) return;
    switch (t.id) {
      case 'egg': {
        const slot = this.world.base.readySlot(this.serverNow);
        if (slot >= 0) this.send('collect', slot);
        break;
      }
      case 'roadster_shop': store.setState({ modal: 'garage' }); break;
      case 'sell_shop': store.setState({ modal: 'zoo', zooTab: 'mine' }); break;
      case 'training': store.setState({ modal: 'training' }); break;
      case 'reward': this.send('claimReward'); break;
      case 'invite': {
        const link = bloxity.inviteLink(this.room?.roomId);
        navigator.clipboard?.writeText(link).then(() => toast('Invite link copied! Friends boost your income (+5% each)', 'good'), () => toast(link, 'info'));
        break;
      }
      default: break;
    }
  }

  // ---------------------------------------------------------------- remote players

  addRemote(id, state) {
    const mesh = makeCar(CAR_BY_ID[state.car]?.color ?? 0xf0f9f9);
    const tag = textSprite(state.name || 'Player', { size: 40, scale: 0.016 });
    tag.position.y = 4.2;
    mesh.add(tag);
    mesh.position.set(state.x, state.y, state.z);
    this.world.scene.add(mesh);
    const look = parseLook(state.look);
    const avatar = makeAvatar(look);
    const driver = makeAvatar(look);
    mesh.userData.setDriver(driver);
    avatar.position.copy(mesh.position);
    this.world.scene.add(avatar);
    const walking = !onTrack(state.x, state.z) && inField(state.x, state.z);
    if (walking) { avatar.add(tag); tag.position.set(0, 5.2, 0); }
    avatar.visible = walking;
    const follow = new CarFollower(mesh, walking);
    this.remotes.set(id, { mesh, avatar, driver, look: state.look, walking, follow, pos: new THREE.Vector3(state.x, state.y, state.z), ry: state.ry || 0, state, tag, car: state.car, egg: null, carrying: -1, last: new THREE.Vector3(state.x, state.y, state.z) });
  }

  removeRemote(id) {
    const r = this.remotes.get(id);
    if (!r) return;
    r.mesh.removeFromParent();
    r.avatar.removeFromParent();
    r.tag.userData.dispose?.();
    this.remotes.delete(id);
  }

  updateRemotes(dt) {
    const k = 1 - Math.exp(-dt * 12);
    for (const r of this.remotes.values()) {
      const s = r.state;
      r.pos.x += (s.x - r.pos.x) * k;
      r.pos.y += (s.y - r.pos.y) * k;
      r.pos.z += (s.z - r.pos.z) * k;
      r.ry += Math.atan2(Math.sin(s.ry - r.ry), Math.cos(s.ry - r.ry)) * k;
      animateAvatar(r.avatar, r.pos.distanceTo(r.last), dt);
      r.last.copy(r.pos);
      // same rule as for the local player: on foot inside the lobby, in the car on the track
      let walking = r.walking;
      if (walking && onTrack(s.x, s.z)) walking = false;
      else if (!walking && inField(s.x, s.z) && s.y < 1) walking = true;
      if (walking !== r.walking) {
        r.walking = walking;
        this.fx.burst(r.pos.x, r.pos.y, r.pos.z);
        const holder = walking ? r.avatar : r.mesh;
        holder.add(r.tag);
        r.tag.position.set(0, walking ? 5.2 : 4.2, 0);
        if (r.egg) { holder.add(r.egg); r.egg.position.set(0, walking ? 5.6 : 3.1, walking ? 0 : -0.6); }
      }
      spinWheels(r.mesh, r.follow.update(dt, r.pos, r.ry, r.walking));
      r.avatar.visible = r.walking;
      r.avatar.position.copy(r.pos);
      r.avatar.rotation.y = r.ry;
      if (s.look !== r.look) {
        r.look = s.look;
        const look = parseLook(s.look);
        r.avatar.userData.setLook(look);
        r.driver.userData.setLook(look);
      }
      if (s.car !== r.car) { r.car = s.car; r.mesh.userData.setColor(CAR_BY_ID[s.car]?.color ?? 0xf0f9f9); }
      r.mesh.userData.flame.visible = !!s.nitro;
      if (s.carrying !== r.carrying) {
        r.carrying = s.carrying;
        r.egg?.removeFromParent();
        r.egg = null;
        if (s.carrying >= 0) {
          r.egg = makeEgg(BIOMES[s.carrying].egg, 0.9);
          (r.walking ? r.avatar : r.mesh).add(r.egg);
          r.egg.position.set(0, r.walking ? 5.6 : 3.1, r.walking ? 0 : -0.6);
        }
      }
    }
  }

  // ---------------------------------------------------------------- frame

  frame() {
    const rawDt = this.clock.getDelta();
    const dt = Math.min(rawDt, 0.1);
    if (!this.paused && rawDt < 0.5) this.adaptQuality(rawDt);
    // shadows refresh every frame: refreshing every other frame made the car's / character's shadow
    // lag a frame behind them while moving, which read as shaking
    this.frameNo++;
    this.renderer.shadowMap.needsUpdate = this.world.shadowsOn;
    if (this.paused) { this.renderer.render(this.world.scene, this.camera); return; }
    this.time += dt;
    const body = this.body;
    const input = this.input.update();
    if (store.getState().modal) { input.throttle = 0; input.steer = 0; input.nitro = false; }

    const hasInfinite = !!store.getState().profile?.passes?.auto_nitro;
    const before = { x: body.x, z: body.z };
    if (this.walking) this.walk(dt, input); else body.update(dt, input, this.stats, hasInfinite);
    this.world.lobby.collide(body);
    this.updateMode();
    const moved = Math.hypot(body.x - before.x, body.z - before.z);
    if (this.walking) animateAvatar(this.avatar, moved, dt);
    this.fx.update(dt);

    this.avatar.position.set(body.x, body.y, body.z);
    this.avatar.rotation.y = body.ry;
    this.bodyPos.set(body.x, body.y, body.z);
    spinWheels(this.car, this.follower.update(dt, this.bodyPos, body.ry, this.walking) * (this.walking || body.speed >= 0 ? 1 : -1));
    const pitchTarget = this.walking ? 0 : body.grounded ? 0 : THREE.MathUtils.clamp(-body.vy * 0.018, -0.45, 0.45);
    this.car.rotation.x += (pitchTarget - this.car.rotation.x) * Math.min(1, dt * 6);
    this.car.userData.flame.visible = body.nitroOn;

    if (body.crashed) this.camCtl.shake = 0.6;
    if (body.landed) {
      const dist = Math.round(body.landed.distance);
      this.send('jump', { distance: dist });
      if (dist >= 12) toast(`Jump! ${dist}m`, 'info');
    }

    const now = this.serverNow;
    this.camCtl.update(dt, body, parseFloat(bloxity.settings.camera_sensitivity) || 1, this.walking);
    this.world.update(dt, body, this.time, now);
    this.world.base.update(dt, now);

    this.updateHeist(dt, now);
    this.updateTraps(dt);
    this.updateObjective();
    this.updateRemotes(dt);
    this.syncStore();
    this.sendMove(dt);
    this.updateRewardLabel();

    this.renderer.render(this.world.scene, this.camera);
  }

  updateRewardLabel() {
    const left = this.rewardAt - Date.now();
    const text = left <= 0 ? 'Claim now!' : `${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, '0')}`;
    this.world.hub.setRewardLabel(text);
  }

  updateHeist(dt, now) {
    const body = this.body;
    const ev = eventAt(now).event;
    const night = nightAt(now).night;
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

    // grab: airborne or on the plateau, right at an egg (not at night)
    if (carrying < 0 && !this.grabPending && this.room && !night) {
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

    // deliver: carrying the egg inside the plot
    if (carrying >= 0 && Math.hypot(body.x, body.z) < WORLD.baseRadius - 2 && Date.now() > this.deliverAt) {
      this.deliverAt = Date.now() + 1500;
      this.send('deliver');
    }
    if (this.carriedEgg) this.carriedEgg.rotation.y += dt * 2;
  }

  syncStore() {
    const body = this.body;
    const s = store.getState();
    const speed = this.walking ? 0 : Math.round(body.speedNow * 2.2);
    const nitro = Math.round(body.nitro * 100) / 100;
    const nearBase = Math.hypot(body.x, body.z) < WORLD.baseRadius;
    const driving = !this.walking;
    if (s.speed !== speed || s.nitro !== nitro || s.airborne === body.grounded || s.nearBase !== nearBase || s.driving !== driving) {
      store.setState({ speed, nitro, airborne: !body.grounded && driving, nearBase, driving });
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

  dispose() {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    clearInterval(this.gemsTimer);
    clearInterval(this.boardsTimer);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('pointermove', this.look.move);
    window.removeEventListener('pointerup', this.look.up);
    window.removeEventListener('pointercancel', this.look.up);
    this.input.dispose();
    this.offSettings?.();
    this.offAd?.();
    this.offUser?.();
    this.offAvatar?.();
    this.unsubStore?.();
    bloxity.gameplayEnd();
    try { this.room?.leave(); } catch {}
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

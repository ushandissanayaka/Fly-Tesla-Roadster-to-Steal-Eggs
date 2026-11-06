// Single place where the game talks to the Bloxity SDK (window.Legion.SDK).
// Everything degrades gracefully when the SDK script is blocked or missing (offline dev).

const GAME_SLUG = import.meta.env.VITE_GAME_SLUG || 'roadster-eggs';

export const SETTING_DEFAULTS = {
  master_volume: '80',
  graphics_quality: 'High',
  show_fps: 'false',
  camera_sensitivity: '1',
};

const sdk = () => window.Legion?.SDK || null;

export const DEFAULT_PFP = 'https://static.bloxity.io/img/pfps/s0.png?width=128&quality=85&v=2';
const GUEST_KEY = 're_guest_key';
const GUEST_NAMES = ['Turbo', 'Comet', 'Falcon', 'Blaze', 'Rapid', 'Cosmic', 'Viper', 'Neon', 'Rogue', 'Tiger', 'Hawk', 'Bandit'];

const memory = {};
function stored(key, make) {
  try {
    let v = localStorage.getItem(key);
    if (!v) { v = make(); localStorage.setItem(key, v); }
    return v;
  } catch {
    return (memory[key] ??= make());
  }
}
const localGuestName = () => stored('re_guest_name', () => `${GUEST_NAMES[Math.floor(Math.random() * GUEST_NAMES.length)]}${Math.floor(100000 + Math.random() * 900000)}`);

const state = { user: null, settings: { ...SETTING_DEFAULTS }, embedded: false };
const listeners = { user: new Set(), settings: new Set(), adBreak: new Set() };
const emit = (k, v) => listeners[k].forEach((fn) => { try { fn(v); } catch (e) { console.error(e); } });

export const bloxity = {
  get available() { return !!sdk(); },
  get user() { return state.user; },
  get settings() { return state.settings; },
  get embedded() { return state.embedded; },

  init() {
    const S = sdk();
    if (!S) {
      console.warn('[bloxity] SDK not loaded - running in offline mode');
      return;
    }
    S.init({ gameSlug: GAME_SLUG });
    state.embedded = !!S.portal?.isEmbeddedInLegion?.();

    // Subscribe right after init so the portal handshake is not missed.
    S.auth.onUserChanged((user) => {
      state.user = user || null;
      emit('user', state.user);
    });

    for (const key of Object.keys(SETTING_DEFAULTS)) {
      S.settings.listen(key, (value) => {
        state.settings = { ...state.settings, [key]: value || SETTING_DEFAULTS[key] };
        emit('settings', state.settings);
      });
    }
    try { S.settings.triggerAll?.(); } catch {}

    // Ads: the portal pauses the game during an ad break.
    try {
      S.ads?.onBreakStart?.(() => emit('adBreak', 'start'));
      S.ads?.onBreakEnd?.(() => emit('adBreak', 'end'));
      S.ads?.declareScreens?.({ menu: { slots: [{ position: 'middle-left', sizes: ['300x600', '160x600'] }] }, gameplay: {} });
    } catch {}

    // Leaderboards: the server submits scores, defining them here shows the trophy button.
    try {
      S.leaderboard?.define?.([
        { id: 'eggs', label: 'Eggs Stolen', order: 'desc', mode: 'best', format: 'compact' },
        { id: 'money', label: 'Total Money', order: 'desc', mode: 'best', format: 'compact' },
      ]);
    } catch {}
  },

  onUser(fn) { listeners.user.add(fn); fn(state.user); return () => listeners.user.delete(fn); },
  onSettings(fn) { listeners.settings.add(fn); fn(state.settings); return () => listeners.settings.delete(fn); },
  onAdBreak(fn) { listeners.adBreak.add(fn); return () => listeners.adBreak.delete(fn); },

  guest() {
    if (state.user) return null;
    try {
      const g = sdk()?.auth.getGuest?.();
      if (g?.username) return { name: g.displayName || g.username, pfp: g.pfp || DEFAULT_PFP };
    } catch {}
    return { name: localGuestName(), pfp: DEFAULT_PFP };
  },
  displayName() {
    const u = state.user;
    return u ? u.displayName || u.username : this.guest().name;
  },
  pfp() {
    const u = state.user;
    return u ? u.pfp || DEFAULT_PFP : this.guest().pfp;
  },
  // The player's Bloxity character look (skin texture + equipped body parts / hat / back item), used to
  // build their 3D Bloxity base character in game. null when the SDK is not there (the default look is used).
  avatarLook() {
    const A = sdk()?.avatar;
    if (!A) return null;
    try {
      const eq = A.getEquipped?.() || {};
      const look = { skin: A.getSkinTextureUrl?.() || '' };
      for (const k of ['headId', 'armLId', 'armRId', 'legLId', 'legRId', 'torsoId', 'hatId', 'backId']) {
        if (eq[k] && eq[k] !== '-1') look[k] = String(eq[k]);
      }
      return look;
    } catch {
      return null;
    }
  },
  onAvatarChanged(fn) {
    try { return sdk()?.avatar?.onAvatarChanged?.(fn) || (() => {}); } catch { return () => {}; }
  },
  // secret id kept in this browser so a signed-out player's progress is saved on the server
  guestKey() {
    return stored(GUEST_KEY, () => (crypto.randomUUID?.() || `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`));
  },
  token() {
    try { return sdk()?.auth.getToken() || null; } catch { return null; }
  },
  login() { return sdk()?.auth.showAuthPopup(); },

  loadingStep(text) { try { sdk()?.game.loadingStep(text); } catch {} },
  loadingEnd() { try { sdk()?.game.loadingEnd(); } catch {} },
  gameplayStart() { try { sdk()?.game.gameplayStart(); } catch {} },
  gameplayEnd() { try { sdk()?.game.gameplayEnd(); } catch {} },
  updateRoom(roomId) { try { sdk()?.game.updateRoom(roomId || ''); } catch {} },

  // ad screens: banners sit on the edges, so menus stay centred
  screen(type) { try { sdk()?.ads?.screen?.(type); } catch {} },
  hideScreen() { try { sdk()?.ads?.hideScreen?.(); } catch {} },
  // resolves { status, rewardToken } ("completed" = watched), or null when ads are not available
  async showRewarded(placement) {
    try {
      const ads = sdk()?.ads;
      if (!ads || (ads.isAvailable && !ads.isAvailable())) return null;
      return await ads.showRewarded(placement);
    } catch {
      return null;
    }
  },

  async resolveEndpoint(hostingId) {
    const S = sdk();
    if (!S?.net) throw new Error('Bloxity SDK net unavailable');
    const { endpoint } = await S.net.resolveEndpoint(hostingId);
    return endpoint;
  },

  async purchase(sku) {
    const S = sdk();
    if (!S) throw new Error('Gems are only available on Bloxity');
    return (S.gems || S.bux).requestPurchase(sku);
  },
  async gemsBalance() {
    try { return await (sdk()?.gems || sdk()?.bux)?.getBalance(); } catch { return null; }
  },
  // price + name of a product from the game's IAP catalog, or null
  async iap(sku) {
    try {
      const res = await fetch(`https://api.bloxity.io/v1/games/${encodeURIComponent(GAME_SLUG)}/iaps/${encodeURIComponent(sku)}`);
      if (!res.ok) return null;
      const p = await res.json();
      return typeof p?.price === 'number' ? p : null;
    } catch {
      return null;
    }
  },

  inviteLink(roomId) {
    try { return sdk()?.social.getInviteFriendsLink(roomId ? { roomId } : undefined) || location.href; } catch { return location.href; }
  },
};

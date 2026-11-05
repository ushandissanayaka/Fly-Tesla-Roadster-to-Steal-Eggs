// Tiny external store shared by the 3D game (writer) and the React HUD (reader).
import { useSyncExternalStore } from 'react';

export function createStore(initial) {
  let state = initial;
  const subs = new Set();
  return {
    getState: () => state,
    setState(patch) {
      const next = typeof patch === 'function' ? patch(state) : patch;
      state = { ...state, ...next };
      subs.forEach((fn) => fn());
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}

export const store = createStore({
  loading: true,
  connected: false,
  online: 0,
  me: null,             // { name, pfp, guest }
  profile: null,        // last profile message from the server
  clockOffset: 0,       // server time - local time
  money: 0,
  income: 0,
  speed: 0,
  airborne: false,
  nitro: 1,             // 0..1 nitro charge
  carrying: -1,         // biome index of the stolen egg
  chase: 0,             // distance to the guard while carrying
  toast: null,          // { text, kind, id }
  modal: null,          // 'garage' | 'training' | 'incubator' | 'zoo' | 'shop' | null
  hatchResult: null,    // { animal, mut }
  nearBase: false,
  isTouch: false,
  settings: { showFps: false },
});

export function useStore(selector = (s) => s) {
  return useSyncExternalStore(store.subscribe, () => selector(store.getState()));
}

let toastId = 0;
export function toast(text, kind = 'info') {
  const id = ++toastId;
  store.setState({ toast: { text, kind, id } });
  setTimeout(() => {
    if (store.getState().toast?.id === id) store.setState({ toast: null });
  }, 2600);
}

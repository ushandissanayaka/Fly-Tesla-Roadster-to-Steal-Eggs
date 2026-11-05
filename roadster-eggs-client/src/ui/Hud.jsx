import { useEffect, useState } from 'react';
import { store, useStore } from './store.js';
import { Modals } from './Modals.jsx';
import { MobileControls } from './MobileControls.jsx';
import { BIOMES, EVENTS, eventAt, fmt } from '../shared/gameData.js';

export function useNow(ms = 500) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export const mmss = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

function EventBanner() {
  const offset = useStore((s) => s.clockOffset);
  const now = useNow() + offset;
  const { event, nextAt, endsAt } = eventAt(now);
  if (event) {
    return (
      <div className="event live" style={{ borderColor: event.color }}>
        <b style={{ color: event.color }}>{event.name}</b> {event.desc} <span>{mmss(endsAt - now)}</span>
      </div>
    );
  }
  return <div className="event">Next event in <span>{mmss(nextAt - now)}</span></div>;
}

function Carry() {
  const carrying = useStore((s) => s.carrying);
  const chase = useStore((s) => s.chase);
  if (carrying < 0) return null;
  const danger = chase < 40;
  return (
    <div className={`carry ${danger ? 'danger' : ''}`}>
      <div>🥚 Stolen {BIOMES[carrying].name} egg - drive to the base!</div>
      <div className="carry-bar"><i style={{ width: `${Math.min(100, (chase / 120) * 100)}%` }} /></div>
      <small>{danger ? 'THE ROBOT IS RIGHT BEHIND YOU!' : 'Robot guard chasing...'}</small>
    </div>
  );
}

export function Hud({ game }) {
  const s = useStore();
  if (s.loading) return null;
  const open = (modal) => store.setState({ modal });
  const prof = s.profile;
  const ready = prof ? prof.incubators.filter((e) => e.readyAt <= Date.now() + s.clockOffset).length : 0;

  return (
    <div className="hud">
      {/* top-left is reserved for the Bloxity toolbar: nothing is drawn there */}
      <div className="money">
        <div className="money-main">${fmt(s.money)}</div>
        <div className="money-sub">+${fmt(s.income)}/s{prof?.boostUntil > Date.now() + s.clockOffset ? ' · x2 BOOST' : ''}</div>
      </div>
      <EventBanner />

      <div className="side">
        <button onClick={() => open('garage')}>🚗<span>Garage</span></button>
        <button onClick={() => open('training')}>🏋️<span>Training</span></button>
        <button onClick={() => open('incubator')}>🥚<span>Eggs</span>{ready > 0 && <em>{ready}</em>}</button>
        <button onClick={() => open('zoo')}>🐾<span>Animals</span></button>
        <button onClick={() => open('shop')}>🛒<span>Shop</span></button>
        <button onClick={() => game?.teleportHome()}>🏠<span>Home</span></button>
      </div>

      <div className="topright">
        <span>👥 {s.online}</span>
        {!s.connected && <span className="offline">offline</span>}
      </div>

      <Carry />
      {s.toast && <div className={`toast ${s.toast.kind}`} key={s.toast.id}>{s.toast.text}</div>}

      <div className="speedo">
        <div className="speed-num">{s.speed}<small>km/h</small></div>
        <div className="nitro"><i style={{ width: `${s.nitro * 100}%` }} /></div>
        <small>{s.isTouch ? '' : 'W/A/S/D drive · SHIFT nitro · SPACE brake'}</small>
      </div>
      {s.airborne && <div className="air">✈ AIRBORNE</div>}

      {s.isTouch && <MobileControls game={game} />}
      <Modals game={game} />
    </div>
  );
}

import { useEffect, useState } from 'react';
import { store, useStore } from './store.js';
import { Modals } from './Modals.jsx';
import { MobileControls } from './MobileControls.jsx';
import { BIOMES, eventAt, nightAt, fmt } from '../shared/gameData.js';

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

// "Steal an Egg!" style title: first word blue, key nouns yellow, the rest white (like the reference game)
function Title({ text, night }) {
  if (night) return <div className="title night-title">{text}</div>;
  const words = text.split(' ');
  return (
    <div className="title">
      {words.map((w, i) => {
        const key = /^(egg|eggs|plot|base|gym|egg!)/i.test(w.replace(/[^a-z!]/gi, ''));
        const cls = key ? 'y' : i === 0 ? 'b' : 'w';
        return <span key={i} className={cls}>{w} </span>;
      })}
    </div>
  );
}

function Carry() {
  const carrying = useStore((s) => s.carrying);
  const chase = useStore((s) => s.chase);
  if (carrying < 0) return null;
  const danger = chase < 40;
  return (
    <div className={`carry ${danger ? 'danger' : ''}`}>
      <div className="carry-bar"><i style={{ width: `${Math.min(100, (chase / 120) * 100)}%` }} /></div>
      <small>{danger ? 'THE ROBOT IS RIGHT BEHIND YOU!' : 'Robot guard chasing...'}</small>
    </div>
  );
}

function Hotbar({ game }) {
  const carrying = useStore((s) => s.carrying);
  const traps = useStore((s) => s.trapCharges);
  const batCd = useStore((s) => s.batCd);
  return (
    <div className="hotbar">
      <button className={`slot ${batCd > 0 ? 'cd' : ''}`} onClick={() => game?.useBat()}>
        <i>1</i><span className="slot-ico">🏏</span><em>Bat</em>
      </button>
      <button className={`slot ${traps <= 0 ? 'cd' : ''}`} onClick={() => game?.placeTrap()}>
        <i>2</i><b>x{traps}</b><span className="slot-ico">🪤</span><em>Bear Trap</em>
      </button>
      {carrying >= 0 && (
        <div className="slot egg">
          <i>3</i><span className="slot-ico">🥚</span><em>{BIOMES[carrying].name.split(' ').pop()} Egg</em>
        </div>
      )}
      <button className="slot pack" onClick={() => store.setState({ modal: 'zoo', zooTab: 'mine' })} title="Backpack">
        <span className="slot-ico">🎒</span>
      </button>
    </div>
  );
}

// bottom-right, like the reference: weather/event row ("STORM 2:29") and the round-timer pill ("2m 30s")
function Timers() {
  const offset = useStore((s) => s.clockOffset);
  const now = useNow() + offset;
  const { event, nextAt, endsAt } = eventAt(now);
  const n = nightAt(now);
  const left = n.night ? n.left : n.untilNight;
  const s = Math.max(0, Math.ceil(left / 1000));
  return (
    <div className="timers">
      <div className="weather">
        <span className="w-ico">{event ? '⚡' : '⛈️'}</span>
        <div>
          <b style={{ color: event ? event.color : '#bfe6ff' }}>{event ? event.name.toUpperCase() : 'STORM'}</b>
          <small>{mmss(event ? endsAt - now : nextAt - now)}</small>
        </div>
      </div>
      <div className="round">
        <span className="orb">{n.night ? '🌙' : ''}</span>
        <b>{n.night ? `Day in ${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`}</b>
      </div>
    </div>
  );
}

function Boost() {
  const driving = useStore((s) => s.driving);
  const nitro = useStore((s) => s.nitro);
  if (!driving) return null;
  return (
    <div className="boost">
      <div className="boost-head"><b>BOOST</b><b>{Math.round(nitro * 100)}%</b></div>
      <div className="boost-bar"><i style={{ width: `${nitro * 100}%` }} /><span style={{ left: '25%' }} /><span style={{ left: '75%' }} /></div>
    </div>
  );
}

export function Hud({ game }) {
  const s = useStore();
  if (s.loading) return null;
  const open = (modal, extra = {}) => store.setState({ modal, ...extra });
  const prof = s.profile;
  const now = Date.now() + s.clockOffset;
  const ready = prof ? prof.incubators.filter((e) => e.readyAt <= now).length : 0;
  const rewardReady = prof ? Date.now() >= (game?.rewardAt || 0) : false;
  const rebirthCost = prof?.rebirthCost || 0;
  const rebirthPct = rebirthCost ? Math.min(100, (s.money / rebirthCost) * 100) : Math.min(100, (s.money / 1e6) * 100);

  return (
    <div className="hud">
      {/* top-left is reserved for the Bloxity toolbar: nothing is drawn there */}
      <Title text={s.objective} night={s.night} />

      {/* left: cash + the three big buttons (Shop / Index / Rebirth) */}
      <div className="left-col">
        <div className="cash">
          <span className="cash-ico">💵</span>
          <b>${fmt(s.money)}</b>
          <button className="sq" onClick={() => open('shop')}>+</button>
        </div>
        <small className="income">+${fmt(s.income)}/s{prof?.boostUntil > now ? ' · x2 BOOST' : ''}</small>
        <button className="mb shop" onClick={() => open('shop')}><span className="ico">🧺</span><b>Shop</b></button>
        <button className="mb index" onClick={() => open('zoo', { zooTab: 'book' })}><span className="ico">📖</span><b>Index</b><em>!</em></button>
        <button className="mb rebirth" onClick={() => open('rebirth')}>
          <span className="ico">🔄</span><b>Rebirth</b><i className="rb-bar"><i style={{ width: `${rebirthPct}%` }} /></i>
        </button>
      </div>

      {/* bottom-left: gems, roadster tokens (eggs stolen), friend boost */}
      <div className="currencies">
        <div className="cur gems"><span>💎</span><b>{s.gems ?? 0}</b><button className="sq blue" onClick={() => open('shop')}>+</button></div>
        <div className="cur cars"><span>🏎️</span><b>{prof?.eggsStolen ?? 0}</b><button className="sq red" onClick={() => open('garage')}>+</button></div>
        <div className="cur friends"><span>👥</span><b>+{Math.round((prof?.friendBoost ?? 0) * 100)}%</b><button className="sq green" onClick={() => game && navigator.clipboard?.writeText(location.href)}>+</button></div>
      </div>

      {/* right: Animals / Eggs tiles */}
      <div className="menu-right">
        <button className="tile" onClick={() => open('zoo', { zooTab: 'mine' })}><span className="ico">🐶</span><b>Animals</b></button>
        <button className="tile" onClick={() => open('incubator')}><span className="ico">🥚</span><b>Eggs</b>{ready > 0 && <em>{ready}</em>}</button>
      </div>

      {/* top-right: round icon buttons, then the VIP offer */}
      <div className="topright">
        <div className="icons">
          <button className="round-btn" onClick={() => game?.send('claimReward')} title="Free reward">🎁{rewardReady && <em>1</em>}</button>
          <button className="round-btn" onClick={() => open('garage')} title="Roadsters">🏎️</button>
          <button className="round-btn" onClick={() => open('training')} title="Train">⭐</button>
          <span className="online">👥 {s.online}{!s.connected && ' · offline'}</span>
        </div>
        <button className="vip" onClick={() => open('shop')}>
          <small>x1.5 MONEY</small>
          <span>👑</span>
          <b>VIP</b>
          <i>ONLY <u>⬢</u>299</i>
        </button>
      </div>

      <Carry />
      {s.prompt && (
        <button className="prompt" onClick={() => game?.interact()}>
          <i>E</i>
          <div><small>{s.prompt.sub}</small><b>{s.prompt.label}</b></div>
        </button>
      )}
      {s.toast && <div className={`toast ${s.toast.kind}`} key={s.toast.id}>{s.toast.text}</div>}

      <Boost />
      <Hotbar game={game} />
      <Timers />
      {s.airborne && <div className="air">✈ AIRBORNE</div>}

      {s.isTouch && <MobileControls game={game} />}
      <Modals game={game} />
    </div>
  );
}

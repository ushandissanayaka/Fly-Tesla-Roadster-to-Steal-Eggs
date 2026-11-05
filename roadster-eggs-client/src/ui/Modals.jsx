import { useEffect, useState } from 'react';
import { store, useStore, toast } from './store.js';
import { useNow, mmss } from './Hud.jsx';
import { bloxity } from '../bloxity/bloxity.js';
import {
  BIOMES, ANIMALS, ANIMAL_BY_ID, RARITIES, MUTATIONS, CARS, UPGRADES, upgradeCost, SKUS, fmt, carStats,
} from '../shared/gameData.js';

const close = () => store.setState({ modal: null });

function Frame({ title, children, wide }) {
  return (
    <div className="modal-back" onPointerDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className={`modal ${wide ? 'wide' : ''}`}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="x" onClick={close}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

function Garage({ game, p }) {
  return (
    <Frame title="🚗 Garage" wide>
      <div className="grid cars">
        {CARS.map((c) => {
          const owned = p.ownedCars.includes(c.id);
          const equipped = p.car === c.id;
          const st = carStats(c.id, p.upgrades);
          return (
            <div key={c.id} className={`card ${equipped ? 'on' : ''}`}>
              <div className="swatch" style={{ background: `#${c.color.toString(16).padStart(6, '0')}` }}>🚘</div>
              <b>{c.name}</b>
              <small>Speed {Math.round(st.topSpeed)} · Accel {Math.round(st.accel)}</small>
              {equipped ? <button disabled>Equipped</button>
                : owned ? <button onClick={() => game.send('buyCar', c.id)}>Equip</button>
                : <button className={p.money >= c.price ? 'buy' : 'no'} onClick={() => game.send('buyCar', c.id)}>${fmt(c.price)}</button>}
            </div>
          );
        })}
      </div>
    </Frame>
  );
}

function Training({ game, p }) {
  return (
    <Frame title="🏋️ Car Training">
      <p className="hint">Train your Roadster to clear bigger gaps and outrun faster robots.</p>
      {Object.entries(UPGRADES).map(([stat, u]) => {
        const lvl = p.upgrades[stat] || 0;
        const maxed = lvl >= u.max;
        const cost = upgradeCost(stat, lvl);
        return (
          <div key={stat} className="row">
            <div>
              <b>{u.name}</b> <span className="lvl">Lv {lvl}/{u.max}</span>
              <small>{u.desc}</small>
            </div>
            <button disabled={maxed} className={p.money >= cost && !maxed ? 'buy' : 'no'} onClick={() => game.send('upgrade', stat)}>
              {maxed ? 'MAX' : `$${fmt(cost)}`}
            </button>
          </div>
        );
      })}
      <p className="hint">Top speed now: <b>{Math.round(p.stats.topSpeed)}</b> · Jump gaps need speed ≈ √(50 × gap).</p>
    </Frame>
  );
}

function Incubator({ game, p }) {
  const offset = useStore((s) => s.clockOffset);
  const now = useNow(250) + offset;
  const slots = [];
  for (let i = 0; i < p.slots; i++) slots.push(p.incubators[i] || null);
  return (
    <Frame title="🥚 Incubators">
      <p className="hint">Steal an egg, drive it home, and it hatches here.</p>
      <div className="grid slots">
        {slots.map((e, i) => {
          if (!e) return <div key={i} className="card empty"><b>Empty</b><small>Deliver an egg to the base</small></div>;
          const b = BIOMES[e.biome];
          const left = e.readyAt - now;
          const total = b.hatchSec * 1000;
          return (
            <div key={i} className="card">
              <div className="swatch" style={{ background: `#${b.egg[1].toString(16).padStart(6, '0')}` }}>🥚</div>
              <b>{b.name} egg</b>
              {left > 0
                ? <><div className="bar"><i style={{ width: `${Math.min(100, (1 - left / total) * 100)}%` }} /></div><small>{mmss(left)}</small></>
                : <button className="buy" onClick={() => game.send('collect', i)}>Hatch!</button>}
            </div>
          );
        })}
      </div>
    </Frame>
  );
}

function Zoo({ game, p }) {
  const [tab, setTab] = useState('book');
  const found = Object.keys(p.discovered).length;
  const sellIds = (maxRarity) => p.animals
    .map((a, i) => [a, i])
    .filter(([a]) => ANIMAL_BY_ID[a.id].rarity <= maxRarity && a.mut === 0)
    .map(([, i]) => i);
  return (
    <Frame title={`🐾 Animals (${found}/${ANIMALS.length})`} wide>
      <div className="tabs">
        <button className={tab === 'book' ? 'on' : ''} onClick={() => setTab('book')}>Collection</button>
        <button className={tab === 'mine' ? 'on' : ''} onClick={() => setTab('mine')}>My animals ({p.animals.length})</button>
      </div>
      {tab === 'book' && BIOMES.map((b, bi) => (
        <div key={b.id} className="biome-block">
          <h3>{b.name}</h3>
          <div className="grid animals">
            {ANIMALS.filter((a) => a.biome === bi).map((a) => {
              const m = p.discovered[a.id];
              const r = RARITIES[a.rarity];
              return (
                <div key={a.id} className={`animal ${m ? '' : 'locked'}`} style={{ borderColor: m ? r.color : '#444' }}>
                  <span className="emoji">{m ? a.emoji : '❓'}</span>
                  <small>{m ? a.name : '???'}</small>
                  <small style={{ color: r.color }}>{r.name}</small>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {tab === 'mine' && (
        <>
          <div className="row">
            <small>Animals earn money every second. Sell the ones you do not need.</small>
            <button onClick={() => { const ids = sellIds(1); if (ids.length) game.send('sell', ids); }}>Sell all Common/Uncommon</button>
          </div>
          <div className="grid animals">
            {p.animals.map((a, i) => {
              const d = ANIMAL_BY_ID[a.id];
              const m = MUTATIONS[a.mut];
              return (
                <div key={i} className="animal" style={{ borderColor: RARITIES[d.rarity].color }}>
                  <span className="emoji">{d.emoji}</span>
                  <small>{a.mut ? <b style={{ color: m.color }}>{m.name} </b> : null}{d.name}</small>
                  <small>+${fmt(d.income * m.mult)}/s</small>
                  <button onClick={() => game.send('sell', [i])}>Sell ${fmt(d.sell * m.mult)}</button>
                </div>
              );
            })}
            {!p.animals.length && <p className="hint">No animals yet - steal your first egg!</p>}
          </div>
        </>
      )}
    </Frame>
  );
}

function Shop({ game, p }) {
  const [prices, setPrices] = useState({});
  useEffect(() => {
    let alive = true;
    Object.keys(SKUS).forEach((sku) => bloxity.iap(sku).then((r) => { if (alive && r) setPrices((x) => ({ ...x, [sku]: r.price })); }));
    return () => { alive = false; };
  }, []);

  const buy = async (sku) => {
    try {
      await bloxity.purchase(sku);   // the server grants it from the Bloxity webhook
    } catch (err) {
      toast(err?.message || 'Purchase failed', 'warn');
    }
  };
  const watch = async () => {
    const r = await bloxity.showRewarded('income-boost');
    if (!r) return toast('No ad available right now', 'warn');
    if (r.status === 'completed' && r.rewardToken) game.send('adReward', r.rewardToken);
  };

  return (
    <Frame title="🛒 Shop">
      <div className="row">
        <div><b>📺 Watch an ad: x2 income</b><small>5 minutes of double money</small></div>
        <button className="buy" onClick={watch}>Watch</button>
      </div>
      {Object.entries(SKUS).map(([sku, s]) => {
        const owned = s.pass && p.passes[s.pass];
        return (
          <div key={sku} className="row">
            <div>
              <b>{s.name}</b>
              <small>{s.cash ? `+$${fmt(s.cash)}` : s.pass === 'vip' ? 'x1.5 income + 1 incubator' : 'Nitro never runs out'}</small>
            </div>
            <button disabled={owned} className="buy" onClick={() => buy(sku)}>
              {owned ? 'Owned' : prices[sku] != null ? `💎 ${prices[sku]}` : 'Buy'}
            </button>
          </div>
        );
      })}
    </Frame>
  );
}

function HatchResult() {
  const r = useStore((s) => s.hatchResult);
  if (!r) return null;
  const a = ANIMAL_BY_ID[r.animal];
  const m = MUTATIONS[r.mut];
  const rar = RARITIES[a.rarity];
  return (
    <div className="modal-back" onPointerDown={() => store.setState({ hatchResult: null })}>
      <div className="hatch" style={{ borderColor: rar.color }}>
        <div className="hatch-emoji">{a.emoji}</div>
        {r.mut > 0 && <div className="mut" style={{ color: m.color }}>✨ {m.name} mutation! x{m.mult} ✨</div>}
        <h2>{a.name}</h2>
        <div style={{ color: rar.color, fontWeight: 700 }}>{rar.name}</div>
        <div>Earns <b>${fmt(a.income * m.mult)}</b> per second</div>
        <small>tap to continue</small>
      </div>
    </div>
  );
}

export function Modals({ game }) {
  const modal = useStore((s) => s.modal);
  const p = useStore((s) => s.profile);
  if (!game) return null;
  let body = null;
  if (p && modal === 'garage') body = <Garage game={game} p={p} />;
  if (p && modal === 'training') body = <Training game={game} p={p} />;
  if (p && modal === 'incubator') body = <Incubator game={game} p={p} />;
  if (p && modal === 'zoo') body = <Zoo game={game} p={p} />;
  if (p && modal === 'shop') body = <Shop game={game} p={p} />;
  return <>{body}<HatchResult /></>;
}

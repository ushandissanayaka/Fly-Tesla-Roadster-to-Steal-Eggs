// On-screen driving buttons for touch devices.
export function MobileControls({ game }) {
  const hold = (key) => ({
    onPointerDown: (e) => { e.preventDefault(); game?.input.setTouch({ [key]: true }); },
    onPointerUp: () => game?.input.setTouch({ [key]: false }),
    onPointerCancel: () => game?.input.setTouch({ [key]: false }),
    onPointerLeave: () => game?.input.setTouch({ [key]: false }),
    onContextMenu: (e) => e.preventDefault(),
  });
  return (
    <div className="touch">
      <div className="touch-left">
        <button {...hold('left')}>◀</button>
        <button {...hold('right')}>▶</button>
      </div>
      <div className="touch-right">
        <button className="nitro-btn" {...hold('nitro')}>NITRO</button>
        <button {...hold('brake')}>▼</button>
        <button className="gas" {...hold('gas')}>GAS</button>
      </div>
    </div>
  );
}

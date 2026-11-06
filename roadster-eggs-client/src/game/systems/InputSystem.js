// Keyboard + touch input. `state` is read every frame by the car physics.
export class InputSystem {
  constructor() {
    this.state = { throttle: 0, steer: 0, brake: false, nitro: false };
    this.keys = new Set();
    this.touch = { left: false, right: false, gas: false, brake: false, nitro: false };
    const handle = (e, down) => {
      if (e.target?.tagName === 'INPUT') return;
      const k = e.code;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(k)) e.preventDefault();
      if (down) this.keys.add(k); else this.keys.delete(k);
    };
    this.kd = (e) => handle(e, true);
    this.ku = (e) => handle(e, false);
    this.blur = () => this.keys.clear();
    window.addEventListener('keydown', this.kd);
    window.addEventListener('keyup', this.ku);
    window.addEventListener('blur', this.blur);
  }

  setTouch(patch) {
    Object.assign(this.touch, patch);
  }

  update() {
    const k = this.keys;
    const t = this.touch;
    const up = k.has('KeyW') || k.has('ArrowUp') || t.gas;
    const down = k.has('KeyS') || k.has('ArrowDown');
    const left = k.has('KeyA') || k.has('ArrowLeft') || t.left;
    const right = k.has('KeyD') || k.has('ArrowRight') || t.right;
    this.state.throttle = (up ? 1 : 0) - (down ? 1 : 0);
    this.state.steer = (left ? 1 : 0) - (right ? 1 : 0);   // + = turn left / move left
    this.state.brake = k.has('Space') || t.brake;   // brake in the car, jump on foot
    this.state.nitro = k.has('ShiftLeft') || k.has('ShiftRight') || t.nitro;
    return this.state;
  }

  dispose() {
    window.removeEventListener('keydown', this.kd);
    window.removeEventListener('keyup', this.ku);
    window.removeEventListener('blur', this.blur);
  }
}

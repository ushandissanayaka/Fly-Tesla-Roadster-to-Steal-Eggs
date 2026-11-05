// Arcade car physics for the local player. The surface is groundHeight(x, z) from the shared
// world data (flat ground + ramps + plateaus), so driving up a ramp and flying off its end happens
// naturally: leaving the surface keeps the vertical speed the ramp gave.

import { WORLD, groundHeight, NITRO_MULT, NITRO_SECONDS, NITRO_RECHARGE } from '../../shared/gameData.js';

const STEP = 1 / 60;

export class CarBody {
  constructor() {
    this.x = 0; this.y = 0; this.z = 0;
    this.ry = 0;            // heading, 0 = +Z
    this.speed = 0;         // forward speed on the ground
    this.vx = 0; this.vz = 0; this.vy = 0;
    this.grounded = true;
    this.prevY = 0;
    this.nitro = 1;        // charge 0..1
    this.nitroOn = false;
    this.airTime = 0;
    this.takeoff = null;
    this.landed = null;     // set for one frame after a jump: { distance, airTime }
    this.crashed = false;   // hit a wall this frame
    this.speedNow = 0;      // horizontal speed (ground or air)
  }

  teleport(x, z, ry = this.ry) {
    this.x = x; this.z = z; this.y = groundHeight(x, z);
    this.ry = ry;
    this.speed = 0; this.vx = this.vz = this.vy = 0;
    this.grounded = true;
  }

  update(dt, input, stats, infiniteNitro = false) {
    this.landed = null;
    this.crashed = false;
    let left = Math.min(dt, 0.1);
    while (left > 1e-4) {
      const h = Math.min(STEP, left);
      this.step(h, input, stats, infiniteNitro);
      left -= h;
    }
    this.speedNow = this.grounded ? Math.abs(this.speed) : Math.hypot(this.vx, this.vz);
  }

  step(dt, input, stats, infiniteNitro) {
    // nitro
    const want = input.nitro && input.throttle >= 0;
    if (want && (this.nitro > 0.02 || infiniteNitro)) {
      this.nitroOn = true;
      if (!infiniteNitro) this.nitro = Math.max(0, this.nitro - dt / NITRO_SECONDS);
    } else {
      this.nitroOn = false;
      this.nitro = Math.min(1, this.nitro + dt / NITRO_RECHARGE);
    }
    const nitroMult = this.nitroOn ? 1 + (NITRO_MULT - 1) * stats.boost : 1;
    const maxSpeed = stats.topSpeed * nitroMult;

    if (this.grounded) {
      const accel = stats.accel * (this.nitroOn ? 1.8 : 1);
      if (input.throttle > 0 || this.nitroOn) {
        const k = 1 - Math.max(0, this.speed) / (maxSpeed * 1.05);
        this.speed += accel * Math.max(0.15, k) * dt;
        if (this.speed > maxSpeed) this.speed = Math.max(maxSpeed, this.speed - 30 * dt);
      } else if (input.throttle < 0) {
        this.speed -= (this.speed > 0 ? accel * 1.8 : accel * 0.8) * dt;
        this.speed = Math.max(this.speed, -stats.topSpeed * 0.35);
      } else {
        this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 9 * dt);
      }
      if (input.brake) this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 55 * dt);
      if (this.speed > maxSpeed + 0.01 && !this.nitroOn) this.speed -= 25 * dt;

      const grip = Math.min(1, Math.abs(this.speed) / 10) * Math.sign(this.speed || 1);
      const rate = 2.3 * stats.handling / (1 + Math.abs(this.speed) / 70);
      this.ry += input.steer * rate * grip * dt;
      this.vx = Math.sin(this.ry) * this.speed;
      this.vz = Math.cos(this.ry) * this.speed;
    } else {
      this.ry += input.steer * 0.9 * dt;       // a little air control for the look of it
      this.airTime += dt;
    }

    // horizontal move with wall check
    const nx = this.x + this.vx * dt;
    const nz = this.z + this.vz * dt;
    const hNew = groundHeight(nx, nz);
    if (hNew > this.y + 1.1) {
      this.crashed = Math.hypot(this.vx, this.vz) > 15;
      this.speed *= -0.2;
      this.vx = this.vz = 0;
    } else {
      this.x = nx;
      this.z = nz;
    }
    const r = Math.hypot(this.x, this.z);
    if (r > WORLD.worldRadius) {
      this.x *= WORLD.worldRadius / r;
      this.z *= WORLD.worldRadius / r;
    }

    const h = groundHeight(this.x, this.z);
    if (this.grounded) {
      if (h < this.y - 0.3) {
        // drove off an edge: keep the vertical speed the slope was giving
        this.grounded = false;
        this.vy = Math.max(0, Math.min(40, (this.y - this.prevY) / dt));
        this.vx = Math.sin(this.ry) * this.speed;
        this.vz = Math.cos(this.ry) * this.speed;
        this.takeoff = { x: this.x, z: this.z };
        this.airTime = 0;
      } else {
        this.prevY = this.y;
        this.y = h;
      }
    } else {
      this.vy -= WORLD.gravity * dt;
      this.y += this.vy * dt;
      if (this.y <= h) {
        this.y = h;
        const fwd = this.vx * Math.sin(this.ry) + this.vz * Math.cos(this.ry);
        this.speed = Math.max(0, Math.min(fwd, Math.hypot(this.vx, this.vz)));
        this.vy = 0;
        this.grounded = true;
        this.prevY = h;
        if (this.takeoff && this.airTime > 0.4) {
          this.landed = { distance: Math.hypot(this.x - this.takeoff.x, this.z - this.takeoff.z), airTime: this.airTime };
        }
        this.takeoff = null;
      }
    }
  }
}

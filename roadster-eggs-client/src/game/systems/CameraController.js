import * as THREE from 'three';

const PITCH_MIN = -0.1;
const PITCH_MAX = 1.25;

// Roblox-style third-person camera:
//  - drag the mouse (right or left button) / drag a finger to orbit around the player, scroll to zoom
//  - on foot the camera stays where you put it and W/A/S/D move relative to it
//  - in the car the camera swings back behind the car on its own once you stop dragging
export class CameraController {
  constructor(camera) {
    this.camera = camera;
    this.yaw = 0;
    this.pitch = 0.38;
    this.zoom = 1;                 // user multiplier (mouse wheel), 0.45 .. 2.6
    this.manualUntil = 0;          // while > time the car-follow is paused (the player is steering the view)
    this.time = 0;
    this.pos = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.fov = 62;
    this.shake = 0;
    this.first = true;
    this.close = 1;                // 0 = driving, 1 = on foot
  }

  snap(body) {
    this.yaw = body.ry;
    this.first = true;
  }

  // dx, dy in pixels
  drag(dx, dy, sensitivity = 1) {
    const k = 0.0058 * sensitivity;
    this.yaw -= dx * k;
    this.pitch = THREE.MathUtils.clamp(this.pitch + dy * k, PITCH_MIN, PITCH_MAX);
    this.manualUntil = this.time + 1.6;
  }

  wheel(deltaY) {
    this.zoom = THREE.MathUtils.clamp(this.zoom * Math.exp(deltaY * 0.0012), 0.45, 2.6);
  }

  // forward direction of the view on the ground (what W means on foot)
  get forward() {
    return { x: Math.sin(this.yaw), z: Math.cos(this.yaw) };
  }

  update(dt, body, sensitivity = 1, walking = false) {
    this.time += dt;
    this.close += ((walking ? 1 : 0) - this.close) * Math.min(1, dt * 4);
    const speed = body.speedNow;

    // driving: ease the view back behind the car unless the player is looking around
    if (!walking && this.time > this.manualUntil && speed > 3) {
      let d = body.ry - this.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw += d * Math.min(1, dt * 2.6);
      this.pitch += (0.3 - this.pitch) * Math.min(1, dt * 1.5);
    }

    const driveDist = 15 + Math.min(speed, 120) * 0.07;
    const wantDist = THREE.MathUtils.lerp(driveDist, 12.5, this.close) * this.zoom;
    this.dist = this.dist === undefined || this.first ? wantDist : this.dist + (wantDist - this.dist) * Math.min(1, dt * 3);
    const dist = this.dist;
    const focusH = THREE.MathUtils.lerp(2.2 + (body.grounded ? 0 : 1), 2.8, this.close);
    const cp = Math.cos(this.pitch);
    const tx = body.x - Math.sin(this.yaw) * cp * dist;
    const tz = body.z - Math.cos(this.yaw) * cp * dist;
    const ty = body.y + focusH + Math.sin(this.pitch) * dist;
    // x / z are locked to the player (the smoothing lives in yaw / pitch / distance), so the car and the
    // character sit still on screen instead of wobbling with every small change in frame time.
    // Only the height is eased (jumps, landings).
    if (this.first) {
      this.pos.set(tx, ty, tz);
      this.first = false;
    } else {
      this.pos.x = tx;
      this.pos.z = tz;
      this.pos.y += (ty - this.pos.y) * (1 - Math.exp(-dt * 10));
    }
    this.pos.y = Math.max(this.pos.y, 0.9);
    this.camera.position.copy(this.pos);
    if (this.shake > 0) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake;
      this.camera.position.y += (Math.random() - 0.5) * this.shake;
      this.shake = Math.max(0, this.shake - dt * 2);
    }
    this.look.set(body.x, body.y + focusH, body.z);
    this.camera.lookAt(this.look);

    const targetFov = (walking ? 62 : 66) + Math.min(speed, 130) * (walking ? 0.05 : 0.14) + (body.nitroOn ? 8 : 0);
    this.fov += (targetFov - this.fov) * Math.min(1, dt * 4);
    if (Math.abs(this.camera.fov - this.fov) > 0.05) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }
  }
}

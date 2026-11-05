import * as THREE from 'three';

// Chase camera behind the car; pulls back and widens the view with speed.
export class CameraController {
  constructor(camera) {
    this.camera = camera;
    this.yaw = 0;
    this.pos = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.fov = 62;
    this.shake = 0;
    this.first = true;
  }

  snap(body) {
    this.yaw = body.ry;
    this.first = true;
  }

  update(dt, body, sensitivity = 1) {
    // follow the heading smoothly (shortest way round)
    let d = body.ry - this.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.yaw += d * Math.min(1, dt * 3.2 * Math.max(0.3, sensitivity));

    const speed = body.speedNow;
    const dist = 11 + Math.min(speed, 120) * 0.07;
    const height = 4.6 + Math.min(speed, 120) * 0.02 + (body.grounded ? 0 : 1.5);
    const baseY = body.y;
    const tx = body.x - Math.sin(this.yaw) * dist;
    const tz = body.z - Math.cos(this.yaw) * dist;
    const ty = baseY + height;
    if (this.first) {
      this.pos.set(tx, ty, tz);
      this.first = false;
    } else {
      const k = 1 - Math.exp(-dt * 7);
      this.pos.x += (tx - this.pos.x) * k;
      this.pos.z += (tz - this.pos.z) * k;
      this.pos.y += (ty - this.pos.y) * (1 - Math.exp(-dt * 5));
    }
    this.camera.position.copy(this.pos);
    if (this.shake > 0) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake;
      this.camera.position.y += (Math.random() - 0.5) * this.shake;
      this.shake = Math.max(0, this.shake - dt * 2);
    }
    this.look.set(body.x + Math.sin(this.yaw) * 6, baseY + 1.6, body.z + Math.cos(this.yaw) * 6);
    this.camera.lookAt(this.look);

    const targetFov = 62 + Math.min(speed, 130) * 0.16 + (body.nitroOn ? 8 : 0);
    this.fov += (targetFov - this.fov) * Math.min(1, dt * 4);
    if (Math.abs(this.camera.fov - this.fov) > 0.05) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }
  }
}

import * as THREE from 'three';
import { clamp, type Collider } from './world';

export interface DriveInput {
  throttle: number;
  steer: number;
  jump: boolean;
}

/** Arcade bike physics: heading + speed on a flat plane, with a hop. */
export class Rider {
  readonly maxSpeed = 13;
  speed = 0;
  steerSmooth = 0;
  y = 0;
  vy = 0;
  grounded = true;
  /** 1 right after landing, decays to 0 — drives the suspension squash. */
  landing = 0;
  bumped = false;

  constructor(
    readonly pos: THREE.Vector3,
    public heading: number,
  ) {}

  update(dt: number, input: DriveInput, colliders: Collider[], radius: number) {
    const { throttle, steer } = input;
    const control = this.grounded ? 1 : 0.35;

    if (throttle > 0) this.speed += (this.speed < 0 ? 26 : 15) * throttle * control * dt;
    else if (throttle < 0) this.speed -= (this.speed > 0 ? 26 : 9) * -throttle * control * dt;
    else this.speed -= this.speed * Math.min(1, 1.5 * dt);
    this.speed = clamp(this.speed, -5, this.maxSpeed);
    if (throttle === 0 && Math.abs(this.speed) < 0.05) this.speed = 0;

    this.steerSmooth += (steer - this.steerSmooth) * Math.min(1, dt * 8);
    const grip = clamp(Math.abs(this.speed) / 3, 0, 1) * (1 - 0.3 * (Math.abs(this.speed) / this.maxSpeed));
    this.heading -= this.steerSmooth * 2.4 * grip * Math.sign(this.speed) * dt;

    this.pos.x += Math.sin(this.heading) * this.speed * dt;
    this.pos.z += Math.cos(this.heading) * this.speed * dt;

    this.bumped = false;
    for (const c of colliders) {
      const dx = this.pos.x - c.x;
      const dz = this.pos.z - c.z;
      const d = Math.hypot(dx, dz);
      const min = c.r + 0.55;
      if (d < min && d > 1e-4) {
        const nx = dx / d;
        const nz = dz / d;
        this.pos.x = c.x + nx * min;
        this.pos.z = c.z + nz * min;
        const into = Math.sin(this.heading) * nx + Math.cos(this.heading) * nz;
        if (into * this.speed < 0) {
          this.speed *= 0.55;
          this.bumped = true;
        }
      }
    }

    const r = Math.hypot(this.pos.x, this.pos.z);
    if (r > radius) {
      this.pos.x *= radius / r;
      this.pos.z *= radius / r;
      const outward = (Math.sin(this.heading) * this.pos.x + Math.cos(this.heading) * this.pos.z) / radius;
      if (outward * this.speed > 0) this.speed *= 0.6;
    }

    if (input.jump && this.grounded) {
      this.vy = 7.2;
      this.grounded = false;
    }
    if (!this.grounded) {
      this.vy -= 24 * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) {
        this.y = 0;
        this.vy = 0;
        this.grounded = true;
        this.landing = 1;
      }
    }
    this.landing = Math.max(0, this.landing - dt * 4);
  }
}

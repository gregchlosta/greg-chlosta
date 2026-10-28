import * as THREE from 'three';

interface Particle {
  alive: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  max: number;
  size: number;
  gravity: number;
  drag: number;
}

export interface EmitOptions {
  speed: number;
  up: number;
  gravity: number;
  life: number;
  size: number;
  drag?: number;
}

const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

/** One instanced mesh shared by every effect: dust, bursts, sparkles. */
export class Particles {
  private readonly mesh: THREE.InstancedMesh;
  private readonly items: Particle[] = [];
  private cursor = 0;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly s = new THREE.Vector3();
  private readonly c = new THREE.Color();

  constructor(scene: THREE.Scene, count = 260) {
    this.mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ toneMapped: false }), count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    for (let i = 0; i < count; i++) {
      this.items.push({ alive: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), life: 0, max: 1, size: 0, gravity: 0, drag: 0 });
      this.mesh.setMatrixAt(i, HIDDEN);
      this.mesh.setColorAt(i, this.c.set('#ffffff'));
    }
    scene.add(this.mesh);
  }

  emit(at: THREE.Vector3, color: THREE.ColorRepresentation, n: number, o: EmitOptions) {
    this.c.set(color);
    for (let k = 0; k < n; k++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.items.length;
      const p = this.items[i];
      const a = Math.random() * Math.PI * 2;
      const r = o.speed * Math.sqrt(Math.random());
      p.alive = true;
      p.pos.copy(at);
      p.vel.set(Math.cos(a) * r, o.up * (0.5 + Math.random() * 0.5), Math.sin(a) * r);
      p.life = 0;
      p.max = o.life * (0.7 + Math.random() * 0.6);
      p.size = o.size * (0.6 + Math.random() * 0.8);
      p.gravity = o.gravity;
      p.drag = o.drag ?? 0;
      this.mesh.setColorAt(i, this.c);
    }
    this.mesh.instanceColor!.needsUpdate = true;
  }

  update(dt: number) {
    for (let i = 0; i < this.items.length; i++) {
      const p = this.items[i];
      if (!p.alive) continue;
      p.life += dt;
      if (p.life >= p.max) {
        p.alive = false;
        this.mesh.setMatrixAt(i, HIDDEN);
        continue;
      }
      p.vel.y -= p.gravity * dt;
      p.vel.multiplyScalar(Math.max(0, 1 - p.drag * dt));
      p.pos.addScaledVector(p.vel, dt);
      if (p.pos.y < 0.05) {
        p.pos.y = 0.05;
        p.vel.y *= -0.4;
      }
      this.s.setScalar(p.size * (1 - p.life / p.max));
      this.mesh.setMatrixAt(i, this.m.compose(p.pos, this.q, this.s));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

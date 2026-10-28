import * as THREE from 'three';
import type { StationKind } from './content';
import type { Collider } from './world';

// Everything here is built from primitives — no model files to download.

const materials = new Map<string, THREE.MeshStandardMaterial>();
function mat(color: string, extra: THREE.MeshStandardMaterialParameters = {}) {
  const key = color + JSON.stringify(extra);
  let m = materials.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.75, metalness: 0.05, ...extra });
    materials.set(key, m);
  }
  return m;
}
const glow = (color: string, intensity = 1.6) => mat(color, { emissive: color, emissiveIntensity: intensity });

function add(parent: THREE.Object3D, geo: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const UP = new THREE.Vector3(0, 1, 0);

/** A cylinder stretched between two points — frames, ladders, limbs. */
function tube(parent: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, r: number, material: THREE.Material) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const m = add(parent, new THREE.CylinderGeometry(r, r, dir.length(), 7), material);
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(UP, dir.normalize());
  return m;
}

function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext('2d')!);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function signTexture(text: string, bg: string, fg: string) {
  return canvasTexture(512, 128, (ctx) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 512, 128);
    ctx.fillStyle = fg;
    ctx.font = 'bold 64px "Arial Black", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 68);
  });
}

function codeTexture(seed: number) {
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  return canvasTexture(512, 320, (ctx) => {
    ctx.fillStyle = '#0d1424';
    ctx.fillRect(0, 0, 512, 320);
    const palette = ['#7dd3fc', '#c4b5fd', '#f9a8d4', '#86efac', '#fde68a', '#94a3b8'];
    let indent = 0;
    for (let line = 0; line < 13; line++) {
      const y = 22 + line * 22;
      indent = Math.max(0, Math.min(4, indent + (r() < 0.3 ? 1 : r() < 0.3 ? -1 : 0)));
      let x = 24 + indent * 26;
      const tokens = 1 + Math.floor(r() * 4);
      for (let t = 0; t < tokens; t++) {
        const w = 24 + r() * 80;
        ctx.fillStyle = palette[Math.floor(r() * palette.length)];
        ctx.fillRect(x, y, w, 9);
        x += w + 12;
      }
    }
  });
}

// --- Vehicles -------------------------------------------------------------------

export interface Motorbike {
  root: THREE.Group;
  /** Child group that leans and pitches; pivot sits on the ground. */
  lean: THREE.Group;
  wheels: THREE.Group[];
}

export function buildMotorbike({ body, accent, rider }: { body: string; accent: string; rider: boolean }): Motorbike {
  const root = new THREE.Group();
  const lean = new THREE.Group();
  root.add(lean);

  const dark = mat('#22242b');
  const tireMat = mat('#18181c', { roughness: 0.95 });
  const chrome = mat('#cfd4dc', { metalness: 0.7, roughness: 0.3 });
  const bodyMat = mat(body);
  const accentMat = mat(accent);

  const wheels: THREE.Group[] = [];
  for (const z of [0.78, -0.78]) {
    const w = new THREE.Group();
    w.position.set(0, 0.54, z);
    add(w, new THREE.TorusGeometry(0.4, 0.14, 8, 20), tireMat).rotation.y = Math.PI / 2;
    add(w, new THREE.CylinderGeometry(0.26, 0.26, 0.12, 12), chrome).rotation.z = Math.PI / 2;
    add(w, box(0.14, 0.5, 0.06), dark);
    lean.add(w);
    wheels.push(w);
  }

  add(lean, box(0.34, 0.34, 0.46), mat('#3a3d45', { metalness: 0.4 }), 0, 0.74, 0);
  tube(lean, v(0, 0.75, -0.25), v(0, 1.2, 0.5), 0.06, dark);
  add(lean, box(0.42, 0.26, 0.55), bodyMat, 0, 1.12, 0.18);
  add(lean, box(0.34, 0.1, 0.75), mat('#141418'), 0, 1.12, -0.38);
  add(lean, box(0.44, 0.22, 0.35), accentMat, 0, 0.98, -0.45);
  add(lean, box(0.2, 0.06, 0.55), bodyMat, 0, 1.08, -0.86).rotation.x = 0.3;
  add(lean, box(0.22, 0.05, 0.5), bodyMat, 0, 1.03, 0.84);
  tube(lean, v(0, 0.64, -0.1), v(0, 0.54, -0.78), 0.05, dark);
  for (const x of [-0.11, 0.11]) tube(lean, v(x, 0.54, 0.78), v(x, 1.38, 0.52), 0.045, chrome);
  tube(lean, v(-0.42, 1.46, 0.48), v(0.42, 1.46, 0.48), 0.035, dark);
  add(lean, box(0.34, 0.3, 0.06), accentMat, 0, 1.25, 0.62);
  add(lean, box(0.18, 0.12, 0.05), glow('#fff4c8', 2.5), 0, 1.25, 0.66);
  add(lean, box(0.16, 0.08, 0.04), glow('#ff3b3b', 2), 0, 1.15, -1.14);
  tube(lean, v(0.2, 0.7, 0.05), v(0.23, 0.95, -0.72), 0.06, chrome);

  if (rider) {
    const jacket = mat(accent);
    const pants = mat('#2b3445');
    for (const sx of [-1, 1]) {
      tube(lean, v(sx * 0.17, 1.25, -0.3), v(sx * 0.23, 1.02, 0.12), 0.09, pants);
      tube(lean, v(sx * 0.23, 1.02, 0.12), v(sx * 0.21, 0.62, -0.08), 0.08, mat('#111114'));
      tube(lean, v(sx * 0.24, 1.82, -0.02), v(sx * 0.36, 1.48, 0.46), 0.07, jacket);
    }
    add(lean, box(0.46, 0.62, 0.28), jacket, 0, 1.6, -0.12).rotation.x = 0.35;
    add(lean, new THREE.SphereGeometry(0.23, 12, 10), bodyMat, 0, 2.02, 0.05);
    add(lean, box(0.3, 0.12, 0.14), mat('#0b0b0f', { metalness: 0.6, roughness: 0.2 }), 0, 2.02, 0.22);
    add(lean, box(0.06, 0.05, 0.3), mat('#ffffff'), 0, 2.24, 0.02);
  }

  return { root, lean, wheels };
}

function buildCar(color: string) {
  const g = new THREE.Group();
  const paint = mat(color, { metalness: 0.3, roughness: 0.45 });
  const chrome = mat('#d6dbe2', { metalness: 0.8, roughness: 0.25 });
  add(g, box(1.8, 0.55, 3.8), paint, 0, 0.62, 0);
  add(g, box(1.55, 0.55, 1.9), paint, 0, 1.15, -0.25);
  add(g, box(1.6, 0.36, 1.95), mat('#9cc3e6', { metalness: 0.5, roughness: 0.15 }), 0, 1.13, -0.25);
  add(g, box(1.85, 0.15, 0.12), chrome, 0, 0.42, 1.92);
  add(g, box(1.85, 0.15, 0.12), chrome, 0, 0.42, -1.92);
  add(g, box(1.84, 0.08, 3.84), mat('#f8f5ee'), 0, 0.68, 0);
  for (const x of [-0.6, 0.6]) {
    add(g, box(0.32, 0.15, 0.05), glow('#fff6d5', 2), x, 0.7, 1.91);
    add(g, box(0.3, 0.13, 0.05), glow('#ff3030', 1.6), x, 0.7, -1.91);
  }
  for (const x of [-0.86, 0.86])
    for (const z of [-1.2, 1.2]) {
      add(g, new THREE.CylinderGeometry(0.38, 0.38, 0.3, 14), mat('#18181c'), x, 0.38, z).rotation.z = Math.PI / 2;
      add(g, new THREE.CylinderGeometry(0.2, 0.2, 0.32, 10), chrome, x, 0.38, z).rotation.z = Math.PI / 2;
    }
  return g;
}

function buildMountainBike(color: string) {
  const g = new THREE.Group();
  const frame = mat(color, { metalness: 0.3, roughness: 0.4 });
  const dark = mat('#1c1c20');
  for (const z of [0.55, -0.55]) {
    add(g, new THREE.TorusGeometry(0.36, 0.06, 6, 22), dark, 0, 0.42, z).rotation.y = Math.PI / 2;
    add(g, new THREE.CylinderGeometry(0.06, 0.06, 0.1, 8), mat('#9aa0a8', { metalness: 0.7 }), 0, 0.42, z).rotation.z = Math.PI / 2;
  }
  const rear = v(0, 0.42, -0.55);
  const front = v(0, 0.42, 0.55);
  const bb = v(0, 0.4, 0);
  const seat = v(0, 1.0, -0.18);
  const headTop = v(0, 1.0, 0.38);
  const headBot = v(0, 0.84, 0.42);
  tube(g, bb, seat, 0.035, frame);
  tube(g, seat, headTop, 0.035, frame);
  tube(g, bb, headBot, 0.04, frame);
  tube(g, bb, rear, 0.025, frame);
  tube(g, seat, rear, 0.025, frame);
  tube(g, headBot, front, 0.03, mat('#2b2b30'));
  tube(g, headTop, v(0, 1.12, 0.34), 0.03, dark);
  tube(g, v(-0.33, 1.12, 0.34), v(0.33, 1.12, 0.34), 0.022, dark);
  add(g, box(0.14, 0.05, 0.28), dark, 0, 1.06, -0.2);
  return g;
}

// --- Station props --------------------------------------------------------------

export interface Prop {
  group: THREE.Group;
  /** Colliders in the prop's local space. */
  colliders: Collider[];
  update?: (t: number) => void;
}

// Each prop is built facing +Z, which is turned towards the centre of the valley.
const builders: Record<StationKind, () => Prop> = {
  ai() {
    const g = new THREE.Group();
    add(g, new THREE.CylinderGeometry(0.85, 1.1, 0.9, 8), mat('#2a2f45'), 0, 0.45, 0);
    add(g, new THREE.CylinderGeometry(0.9, 0.9, 0.08, 8), glow('#a78bfa', 1.2), 0, 0.92, 0);
    const brain = new THREE.Group();
    brain.position.y = 2.25;
    add(brain, new THREE.IcosahedronGeometry(0.75, 1), mat('#8b5cf6', { emissive: '#7c3aed', emissiveIntensity: 0.9 }));
    const wire = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.05, 1),
      new THREE.MeshBasicMaterial({ color: '#ddd6fe', wireframe: true, transparent: true, opacity: 0.45 }),
    );
    brain.add(wire);
    const orbits: THREE.Group[] = [];
    for (let i = 0; i < 3; i++) {
      const o = new THREE.Group();
      o.rotation.set(i * 1.1, i * 0.7, i * 0.4);
      for (let k = 0; k < 2; k++) add(o, new THREE.SphereGeometry(0.09, 8, 6), glow('#f5f3ff', 2), k ? 1.45 : -1.45, 0, 0);
      brain.add(o);
      orbits.push(o);
    }
    g.add(brain);

    // Server rack with blinking lights.
    const rack = new THREE.Group();
    rack.position.set(1.9, 0, -0.3);
    add(rack, box(0.9, 2.2, 0.75), mat('#1e2233'), 0, 1.1, 0);
    const leds: THREE.MeshStandardMaterial[] = [];
    for (let i = 0; i < 6; i++) {
      const led = glow(i % 2 ? '#4ade80' : '#a78bfa', 2).clone();
      leds.push(led);
      add(rack, box(0.6, 0.06, 0.02), mat('#3b4058'), 0, 0.4 + i * 0.3, 0.38);
      add(rack, box(0.08, 0.06, 0.03), led, 0.22, 0.4 + i * 0.3, 0.39);
    }
    g.add(rack);
    return {
      group: g,
      colliders: [
        { x: 0, z: 0, r: 1.1 },
        { x: 1.9, z: -0.3, r: 0.7 },
      ],
      update(t) {
        brain.rotation.y = t * 0.5;
        brain.position.y = 2.25 + Math.sin(t * 1.6) * 0.12;
        wire.rotation.x = t * 0.3;
        orbits.forEach((o, i) => (o.rotation.z = t * (1.2 + i * 0.5)));
        leds.forEach((l, i) => (l.emissiveIntensity = Math.sin(t * (3 + i * 1.7) + i) > 0.2 ? 2.4 : 0.2));
      },
    };
  },

  code() {
    const g = new THREE.Group();
    const wood = mat('#8b5a3c');
    add(g, box(2.8, 0.12, 1.3), wood, 0, 0.95, 0);
    for (const x of [-1.25, 1.25]) for (const z of [-0.5, 0.5]) add(g, box(0.1, 0.95, 0.1), mat('#3b3b42'), x, 0.47, z);
    // Monitor
    add(g, box(0.12, 0.45, 0.12), mat('#2a2a30'), -0.3, 1.22, -0.3);
    add(g, box(1.55, 0.95, 0.07), mat('#17171c'), -0.3, 1.85, -0.32);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 0.86), new THREE.MeshBasicMaterial({ map: codeTexture(42), toneMapped: false }));
    screen.position.set(-0.3, 1.85, -0.28);
    g.add(screen);
    // Laptop
    const laptop = new THREE.Group();
    laptop.position.set(0.85, 1.02, 0.15);
    laptop.rotation.y = -0.35;
    add(laptop, box(0.72, 0.035, 0.5), mat('#b8bec8', { metalness: 0.6, roughness: 0.3 }));
    const lid = new THREE.Group();
    lid.position.set(0, 0, -0.25);
    lid.rotation.x = -0.25;
    add(lid, box(0.72, 0.48, 0.025), mat('#b8bec8', { metalness: 0.6, roughness: 0.3 }), 0, 0.24, 0);
    const lscreen = new THREE.Mesh(new THREE.PlaneGeometry(0.64, 0.4), new THREE.MeshBasicMaterial({ map: codeTexture(7), toneMapped: false }));
    lscreen.position.set(0, 0.24, 0.015);
    lid.add(lscreen);
    laptop.add(lid);
    g.add(laptop);
    // Mug of coffee
    add(g, new THREE.CylinderGeometry(0.09, 0.08, 0.2, 10), mat('#f8fafc'), -1.1, 1.11, 0.25);
    add(g, new THREE.CylinderGeometry(0.075, 0.075, 0.02, 10), mat('#3f2a1d'), -1.1, 1.2, 0.25);
    // Chair
    add(g, box(0.6, 0.08, 0.6), mat('#38bdf8'), 0, 0.55, 1.0);
    add(g, box(0.6, 0.7, 0.08), mat('#38bdf8'), 0, 0.95, 1.3);
    add(g, new THREE.CylinderGeometry(0.05, 0.05, 0.5, 6), mat('#3b3b42'), 0, 0.27, 1.0);
    return { group: g, colliders: [{ x: -0.6, z: 0, r: 1.1 }, { x: 0.7, z: 0, r: 1.1 }, { x: 0, z: 1.1, r: 0.5 }] };
  },

  garage() {
    const g = new THREE.Group();
    // Two-post lift with the car raised on it.
    const lift = mat('#facc15', { metalness: 0.3 });
    for (const z of [-1.3, 1.3]) {
      add(g, box(0.28, 2.6, 0.28), lift, 0, 1.3, z);
      add(g, box(0.5, 0.08, 0.5), mat('#3b3b42'), 0, 0.04, z);
    }
    add(g, box(0.2, 0.2, 2.9), lift, 0, 2.55, 0);
    const car = buildCar('#c0392b');
    car.rotation.y = Math.PI / 2;
    car.position.y = 0.55;
    g.add(car);
    for (const x of [-1, 1]) add(g, box(0.18, 0.06, 1.9), mat('#3b3b42'), x * 1.0, 0.58, 0);
    // Toolbox
    const tb = new THREE.Group();
    tb.position.set(2.9, 0, 0.8);
    tb.rotation.y = -0.4;
    add(tb, box(0.95, 0.85, 0.55), mat('#dc2626', { metalness: 0.3 }), 0, 0.42, 0);
    for (let i = 0; i < 4; i++) add(tb, box(0.85, 0.02, 0.02), mat('#1f1f23'), 0, 0.2 + i * 0.18, 0.28);
    add(tb, box(0.5, 0.05, 0.05), mat('#d6dbe2', { metalness: 0.8 }), 0, 0.9, 0);
    g.add(tb);
    // Stack of spare tyres
    for (let i = 0; i < 3; i++) add(g, new THREE.TorusGeometry(0.4, 0.17, 8, 18), mat('#18181c'), -2.9, 0.17 + i * 0.34, 0.6).rotation.x = Math.PI / 2;
    // Giant floating wrench
    const wrench = new THREE.Group();
    wrench.position.set(0, 3.5, 0);
    const steel = mat('#e5e7eb', { metalness: 0.85, roughness: 0.25 });
    add(wrench, box(0.18, 1.3, 0.08), steel);
    for (const sx of [-1, 1]) add(wrench, box(0.13, 0.3, 0.08), steel, sx * 0.17, 0.75, 0);
    add(wrench, new THREE.TorusGeometry(0.17, 0.06, 6, 14), steel, 0, -0.78, 0);
    g.add(wrench);
    return {
      group: g,
      colliders: [
        { x: 0, z: -1.3, r: 1.0 },
        { x: 0, z: 1.3, r: 1.0 },
        { x: 2.9, z: 0.8, r: 0.6 },
        { x: -2.9, z: 0.6, r: 0.6 },
      ],
      update(t) {
        wrench.rotation.y = t * 1.2;
        wrench.rotation.z = Math.sin(t * 0.8) * 0.3;
        wrench.position.y = 3.6 + Math.sin(t * 1.5) * 0.15;
      },
    };
  },

  moto() {
    const g = new THREE.Group();
    const table = new THREE.Group();
    add(table, new THREE.CylinderGeometry(1.9, 2.0, 0.25, 36), mat('#2f3038', { metalness: 0.4 }), 0, 0.125, 0);
    add(table, new THREE.TorusGeometry(1.9, 0.05, 6, 48), glow('#f43f5e', 1.8), 0, 0.26, 0).rotation.x = Math.PI / 2;
    const bike = buildMotorbike({ body: '#e11d48', accent: '#111827', rider: false });
    bike.root.scale.setScalar(1.3);
    bike.root.position.y = 0.25;
    table.add(bike.root);
    // Helmet resting beside the bike
    add(table, new THREE.SphereGeometry(0.24, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), mat('#111827', { metalness: 0.4, roughness: 0.3 }), 1.1, 0.27, 0.4);
    g.add(table);
    return { group: g, colliders: [{ x: 0, z: 0, r: 2.0 }], update: (t) => (table.rotation.y = t * 0.45) };
  },

  trail() {
    const g = new THREE.Group();
    const mound = add(g, new THREE.SphereGeometry(2.4, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat('#8a6a45'), 0, 0, 0);
    mound.scale.y = 0.42;
    const bike = buildMountainBike('#22c55e');
    bike.position.set(0, 0.95, 0);
    bike.rotation.set(0.12, 0.9, 0);
    g.add(bike);
    const stoneMat = mat('#8d8a83');
    for (const [x, z, s] of [
      [2.2, 1.0, 0.45],
      [-2.4, 0.5, 0.35],
      [-1.6, -1.8, 0.55],
      [1.4, -2.0, 0.3],
    ]) {
      add(g, new THREE.DodecahedronGeometry(s, 0), stoneMat, x, s * 0.5, z);
    }
    // A couple of trail-side pines
    for (const [x, z, s] of [
      [-2.3, -1.0, 1.0],
      [2.6, -1.1, 0.8],
    ]) {
      const tree = new THREE.Group();
      tree.position.set(x, 0, z);
      tree.scale.setScalar(s);
      add(tree, new THREE.CylinderGeometry(0.15, 0.2, 1.0, 6), mat('#6b4a2f'), 0, 0.5, 0);
      add(tree, new THREE.ConeGeometry(1.0, 1.8, 7), mat('#2f5d3a'), 0, 1.6, 0);
      add(tree, new THREE.ConeGeometry(0.7, 1.4, 7), mat('#3a6b40'), 0, 2.4, 0);
      g.add(tree);
    }
    // Trail marker post
    add(g, box(0.15, 1.2, 0.15), mat('#7a5636'), 1.9, 0.6, 1.8);
    add(g, box(0.3, 0.3, 0.04), glow('#4ade80', 0.8), 1.9, 1.05, 1.88).rotation.z = Math.PI / 4;
    return { group: g, colliders: [{ x: 0, z: 0, r: 2.2 }] };
  },

  calgary() {
    const g = new THREE.Group();
    // Calgary Tower
    const concrete = mat('#d5d9df');
    add(g, new THREE.CylinderGeometry(0.6, 0.75, 0.3, 10), concrete, 0, 0.15, 0);
    add(g, new THREE.CylinderGeometry(0.2, 0.36, 4.6, 10), concrete, 0, 2.6, 0);
    add(g, new THREE.CylinderGeometry(0.62, 0.5, 0.4, 14), mat('#e7e9ee'), 0, 4.95, 0);
    add(g, new THREE.CylinderGeometry(0.66, 0.66, 0.16, 14), glow('#fde68a', 1.1), 0, 5.05, 0);
    add(g, new THREE.CylinderGeometry(0.45, 0.62, 0.25, 14), mat('#dc2626'), 0, 5.28, 0);
    add(g, new THREE.CylinderGeometry(0.04, 0.04, 0.7, 6), mat('#9ca3af'), 0, 5.75, 0);
    // Mini downtown
    const glass = mat('#5a6a8e', { metalness: 0.5, roughness: 0.3 });
    for (const [x, z, w, h] of [
      [-1.6, -0.6, 0.7, 2.6],
      [-2.4, 0.2, 0.6, 1.6],
      [1.6, -0.8, 0.8, 3.1],
      [2.3, 0.1, 0.5, 1.9],
      [-1.0, -1.4, 0.6, 1.4],
      [1.0, -1.6, 0.6, 2.0],
    ]) {
      add(g, box(w, h, w), glass, x, h / 2, z);
    }
    // Sign post
    const post = new THREE.Group();
    post.position.set(1.4, 0, 1.4);
    post.rotation.y = -0.3;
    add(post, box(0.14, 2.3, 0.14), mat('#7a5636'), 0, 1.15, 0);
    const signs: [string, number, number][] = [
      ['CALGARY, AB', 2.0, 0],
      ['ROCKIES  →', 1.5, 0.5],
    ];
    for (const [text, y, rot] of signs) {
      const board = new THREE.Group();
      board.position.y = y;
      board.rotation.y = rot;
      add(board, box(1.7, 0.4, 0.06), mat('#f5e6c8'), 0.75, 0, 0);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(1.62, 0.36), new THREE.MeshBasicMaterial({ map: signTexture(text, '#f5e6c8', '#3b2a1a') }));
      face.position.set(0.75, 0, 0.035);
      board.add(face);
      post.add(board);
    }
    g.add(post);
    return {
      group: g,
      colliders: [
        { x: 0, z: 0, r: 0.8 },
        { x: -1.8, z: -0.5, r: 0.8 },
        { x: 1.8, z: -0.5, r: 0.8 },
        { x: 1.4, z: 1.4, r: 0.3 },
      ],
    };
  },

  home() {
    const g = new THREE.Group();
    add(g, box(3.0, 2.0, 2.4), mat('#f1e4cf'), 0, 1.0, 0);
    const roof = add(g, new THREE.ConeGeometry(2.35, 1.4, 4), mat('#b4533c'), 0, 2.7, 0);
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(1.05, 1, 0.85);
    add(g, box(0.36, 0.9, 0.36), mat('#9a4a36'), 0.85, 3.0, -0.4);
    add(g, box(0.62, 1.15, 0.06), mat('#6b4226'), 0, 0.58, 1.21);
    add(g, box(0.05, 0.05, 0.04), mat('#facc15', { metalness: 0.8 }), 0.2, 0.6, 1.25);
    for (const x of [-0.95, 0.95]) {
      add(g, box(0.6, 0.55, 0.05), glow('#ffd27a', 0.9), x, 1.25, 1.21);
      add(g, box(0.7, 0.07, 0.12), mat('#ffffff'), x, 0.94, 1.24);
    }
    // Ladder leaning on the wall
    const ladderMat = mat('#c08a4a');
    for (const z of [0.4, 0.95]) tube(g, v(2.25, 0, z), v(1.55, 2.05, z), 0.04, ladderMat);
    for (let i = 1; i <= 6; i++) {
      const k = i / 7;
      const x = 2.25 - 0.7 * k;
      tube(g, v(x, 2.05 * k, 0.4), v(x, 2.05 * k, 0.95), 0.03, ladderMat);
    }
    // Paint bucket, sawhorse and some lumber
    add(g, new THREE.CylinderGeometry(0.2, 0.17, 0.35, 12), mat('#2dd4bf'), 2.5, 0.18, 1.3);
    const horse = new THREE.Group();
    horse.position.set(-2.4, 0, 1.0);
    horse.rotation.y = 0.5;
    add(horse, box(1.2, 0.1, 0.12), ladderMat, 0, 0.75, 0);
    for (const x of [-0.45, 0.45]) for (const z of [-0.18, 0.18]) tube(horse, v(x, 0.72, 0), v(x, 0, z * 1.6), 0.035, ladderMat);
    add(horse, box(1.8, 0.06, 0.2), mat('#e8c99a'), 0.1, 0.84, 0);
    g.add(horse);
    return {
      group: g,
      colliders: [
        { x: -0.8, z: 0, r: 1.5 },
        { x: 0.8, z: 0, r: 1.5 },
        { x: 2.1, z: 0.7, r: 0.5 },
        { x: -2.4, z: 1.0, r: 0.7 },
      ],
    };
  },

  contact() {
    const g = new THREE.Group();
    add(g, box(0.16, 1.1, 0.16), mat('#7a5636'), 0, 0.55, 0);
    const pink = mat('#ec4899', { metalness: 0.3, roughness: 0.4 });
    add(g, box(0.55, 0.45, 0.9), pink, 0, 1.32, 0);
    add(g, new THREE.CylinderGeometry(0.275, 0.275, 0.9, 14), pink, 0, 1.545, 0).rotation.x = Math.PI / 2;
    add(g, box(0.5, 0.6, 0.04), mat('#be185d'), 0, 1.4, 0.46);
    const flag = new THREE.Group();
    flag.position.set(0.3, 1.25, -0.15);
    add(flag, box(0.04, 0.55, 0.05), mat('#facc15'), 0, 0.27, 0);
    add(flag, box(0.04, 0.2, 0.28), mat('#facc15'), 0, 0.46, 0.13);
    g.add(flag);
    // Floating envelope
    const env = new THREE.Group();
    env.position.y = 2.7;
    add(env, box(0.9, 0.58, 0.05), mat('#fffaf0'));
    const flapGeo = new THREE.BufferGeometry().setFromPoints([v(-0.45, 0.29, 0.03), v(0.45, 0.29, 0.03), v(0, -0.05, 0.03)]);
    flapGeo.computeVertexNormals();
    env.add(new THREE.Mesh(flapGeo, mat('#f9d6e6', { side: THREE.DoubleSide })));
    add(env, new THREE.SphereGeometry(0.07, 8, 6), mat('#e11d48'), 0, -0.04, 0.05);
    g.add(env);
    // Bench for a chat
    const bench = new THREE.Group();
    bench.position.set(-1.6, 0, 0.3);
    bench.rotation.y = 0.6;
    add(bench, box(1.5, 0.08, 0.45), mat('#a0703f'), 0, 0.5, 0);
    add(bench, box(1.5, 0.35, 0.06), mat('#a0703f'), 0, 0.82, -0.22);
    for (const x of [-0.6, 0.6]) add(bench, box(0.08, 0.5, 0.4), mat('#3b3b42'), x, 0.25, 0);
    g.add(bench);
    return {
      group: g,
      colliders: [
        { x: 0, z: 0, r: 0.6 },
        { x: -1.6, z: 0.3, r: 0.8 },
      ],
      update(t) {
        flag.rotation.x = -0.3 + Math.sin(t * 2) * 0.35;
        env.rotation.y = Math.sin(t * 0.9) * 0.6;
        env.position.y = 2.7 + Math.sin(t * 1.7) * 0.15;
      },
    };
  },
};

export function buildStationProp(kind: StationKind): Prop {
  return builders[kind]();
}

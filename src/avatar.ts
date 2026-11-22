import * as THREE from 'three';

// A stylized cartoon 3D head & bust of Greg for the landing screen.
// Keeps his recognizable traits — dark-blond textured crew cut, thick straight brows,
// blue-grey eyes, straight nose, strong jaw, ears that stick out a touch, and a lopsided
// smirk — sculpted in a clean, smooth Pixar-inspired cartoon style lit by the sunset.

type V3 = THREE.Vector3;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

const COLORS = {
  skin: '#f0b18e',
  skinWarm: '#e6977a',
  skinShade: '#cf876c',
  stubble: '#c79580',
  hairBase: '#6d4b30',
  hairSide: '#543924',
  hairMid: '#7d5838',
  hairLight: '#9c734b',
  hairDark: '#4a311e',
  brow: '#533722',
  sclera: '#f6f3ee',
  iris: '#5789a8',
  irisLight: '#98c5dc',
  irisRing: '#284a63',
  pupil: '#13141a',
  lash: '#34221b',
  mouth: '#6e3230',
  lipUpper: '#dc8f7c',
  lipLower: '#e49a88',
  ear: '#eda987',
  earIn: '#cf8268',
  nostril: '#8a483a',
  shirt: '#1c2233',
  collar: '#2a334a',
  shirtAccent: '#fb923c',
};

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const gauss = (u: number, v: number) => Math.exp(-(u * u + v * v));

// --- Head silhouette ------------------------------------------------------------------------
// Units: crown to chin ≈ 1.0, face toward +z, eyes at y ≈ 0.01.

/** Cross-sections from crown (φ = 0) to under the chin (φ = π): [φ, y, half-width, front z, back z]. */
const PROFILE: [number, number, number, number, number][] = [
  [0.0, 0.5, 0.0, -0.02, -0.02],
  [0.25, 0.486, 0.115, 0.08, -0.145],
  [0.5, 0.446, 0.22, 0.18, -0.265],
  [0.75, 0.384, 0.295, 0.262, -0.36],
  [1.0, 0.308, 0.334, 0.32, -0.42],
  [1.25, 0.218, 0.348, 0.354, -0.455],
  [1.5, 0.118, 0.352, 0.372, -0.468],
  [1.75, 0.018, 0.348, 0.372, -0.452],
  [2.0, -0.082, 0.336, 0.368, -0.415],
  [2.25, -0.182, 0.318, 0.364, -0.345],
  [2.5, -0.282, 0.294, 0.354, -0.245],
  [2.7, -0.362, 0.264, 0.342, -0.125],
  [2.85, -0.432, 0.175, 0.328, -0.015],
  [3.0, -0.478, 0.095, 0.305, 0.095],
  [Math.PI, -0.498, 0.0, 0.21, 0.21],
];

function profileAt(phi: number) {
  let i = 0;
  while (i < PROFILE.length - 2 && PROFILE[i + 1][0] < phi) i++;
  const a = PROFILE[i];
  const b = PROFILE[i + 1];
  const p0 = PROFILE[Math.max(0, i - 1)];
  const p3 = PROFILE[Math.min(PROFILE.length - 1, i + 2)];
  const t = (phi - a[0]) / (b[0] - a[0]);
  const cr = (k: number) => {
    const v0 = p0[k], v1 = a[k], v2 = b[k], v3 = p3[k];
    return 0.5 * (2 * v1 + (-v0 + v2) * t + (2 * v0 - 5 * v1 + 4 * v2 - v3) * t * t + (-v0 + 3 * v1 - 3 * v2 + v3) * t * t * t);
  };
  return { y: cr(1), w: Math.max(0, cr(2)), zf: cr(3), zb: cr(4) };
}

/** Where the base hair fade ends around the head (0 = front, π = back). */
function hairline(az: number) {
  const a = Math.abs(az);
  // Clean forehead hairline that curves gently down into sideburns in front of the ears.
  let h = 0.285;
  h += (0.215 - h) * smoothstep(0.42, 0.78, a);
  h += (0.04 - h) * smoothstep(0.78, 1.18, a); // sideburn taper right in front of the ear
  h += (0.02 - h) * smoothstep(1.18, 1.55, a); // wraps smoothly behind top of ear
  h += (-0.27 - h) * smoothstep(1.65, 2.45, a); // nape of neck
  return h;
}

/** Smooth cartoon facial contours pushed out along +Z. */
function features(x: number, y: number) {
  const ax = Math.abs(x);
  let dz = 0;
  dz += 0.024 * Math.exp(-((x / 0.23) ** 4)) * Math.exp(-(((y - 0.085) / 0.038) ** 2)); // brow ridge
  dz -= 0.024 * gauss((ax - 0.128) / 0.078, (y - 0.002) / 0.052); // soft eye sockets
  dz += 0.01 * gauss(x / 0.06, (y + 0.08) / 0.09); // nose root transition
  dz += 0.02 * gauss((ax - 0.188) / 0.085, (y + 0.095) / 0.065); // warm rounded cheeks
  dz -= 0.014 * gauss((ax - 0.22) / 0.065, (y + 0.245) / 0.075); // subtle cheek taper
  dz += 0.015 * gauss(x / 0.125, (y + 0.295) / 0.05); // mouth muzzle volume
  dz += 0.036 * gauss(x / 0.115, (y + 0.442) / 0.052); // strong cartoon chin
  return dz;
}

function skull(az: number, phi: number, out: V3) {
  const { y, w, zf, zb } = profileAt(phi);
  const s = Math.sin(az);
  const c = Math.cos(az);
  // Stylized squarer jaw, softly rounded forehead.
  const pf = 2 + 0.48 * smoothstep(0.3, 0.04, y) + 0.34 * smoothstep(-0.24, -0.42, y);
  const zm = (zf + zb) / 2;
  const x = w * Math.sign(s) * Math.abs(s) ** (2 / (c > 0 ? pf : 2));
  let z = c >= 0 ? zm + (zf - zm) * Math.abs(c) ** (2 / pf) : zm - (zm - zb) * Math.abs(c) ** 0.96;
  z += smoothstep(0.15, 0.6, c) * features(x, y);
  return out.set(x, y, z);
}

/** Builds a smooth closed grid surface over (azimuth, v) with per-vertex colour. */
function smoothGridGeometry(
  cols: number,
  rows: number,
  at: (az: number, v: number, out: V3) => V3,
  paint: (p: V3, az: number, v: number) => THREE.Color,
  closedBottom: boolean,
) {
  const pos: number[] = [];
  const col: number[] = [];
  const index: number[] = [];
  const p = V();
  const push = (az: number, v: number) => {
    at(az, v, p);
    pos.push(p.x, p.y, p.z);
    const c = paint(p, az, v);
    col.push(c.r, c.g, c.b);
  };
  const azAt = (i: number) => {
    const s = -1 + (2 * i) / cols;
    return Math.PI * (0.58 * s + 0.42 * s * s * s);
  };
  push(0, 0);
  for (let j = 1; j < rows; j++) {
    const v = j / rows;
    for (let i = 0; i < cols; i++) push(azAt(i), v);
  }
  const last = rows - 1;
  if (closedBottom) push(0, 1);
  else for (let i = 0; i < cols; i++) push(azAt(i), 1);

  const vid = (i: number, j: number) =>
    j === 0 ? 0 : closedBottom && j === rows ? 1 + last * cols : 1 + (j - 1) * cols + (i % cols);

  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const a = vid(i, j), b = vid(i + 1, j), c = vid(i + 1, j + 1), d = vid(i, j + 1);
      if (j === 0) index.push(a, d, c);
      else if (closedBottom && j === rows - 1) index.push(a, d, b);
      else index.push(a, d, c, a, c, b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

function headGeometry() {
  const skin = new THREE.Color(COLORS.skin);
  const warm = new THREE.Color(COLORS.skinWarm);
  const shade = new THREE.Color(COLORS.skinShade);
  const stubble = new THREE.Color(COLORS.stubble);
  const c = new THREE.Color();
  return smoothGridGeometry(
    72,
    56,
    (az, v, out) => skull(az, v * Math.PI, out),
    (p, az) => {
      c.copy(skin);
      const front = Math.max(0, Math.cos(az));
      // Warm cartoon blush across cheeks and nose bridge.
      const cheeks = gauss((p.x - 0.165) / 0.085, (p.y + 0.115) / 0.06) + gauss((p.x + 0.165) / 0.085, (p.y + 0.115) / 0.06);
      c.lerp(warm, 0.42 * front * cheeks);
      // Soft warmth around the eye sockets for gentle cartoon depth.
      const sockets = gauss((Math.abs(p.x) - 0.128) / 0.075, (p.y - 0.008) / 0.048);
      c.lerp(shade, 0.22 * front * sockets);
      // Subtle five-o'clock shadow on jaw, chin and upper lip.
      const jaw = smoothstep(-0.21, -0.31, p.y) * smoothstep(0.32, 0.06, Math.abs(p.x) - 0.05 * (1 - front));
      const upperLip = gauss(p.x / 0.085, (p.y + 0.245) / 0.026) * front;
      c.lerp(stubble, 0.34 * Math.min(1, jaw + upperLip) * (1 - gauss(p.x / 0.085, (p.y + 0.3) / 0.025)));
      // Warm ambient shadow under the chin.
      c.lerp(shade, 0.55 * smoothstep(-0.39, -0.49, p.y) * (1 - front * 0.6));
      return c.clone();
    },
    true,
  );
}

/** φ where the skull reaches height y. */
function phiAtHeight(y: number) {
  let lo = 0;
  let hi = Math.PI;
  for (let k = 0; k < 28; k++) {
    const mid = (lo + hi) / 2;
    if (profileAt(mid).y > y) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// --- Materials & helpers --------------------------------------------------------------------

function cartoonMat(color: string | null, extra: THREE.MeshStandardMaterialParameters = {}) {
  return new THREE.MeshStandardMaterial({
    color: color ?? '#ffffff',
    vertexColors: color === null,
    roughness: 0.64,
    metalness: 0,
    ...extra,
  });
}

function part(parent: THREE.Object3D, geo: THREE.BufferGeometry, material: THREE.Material) {
  const m = new THREE.Mesh(geo, material);
  parent.add(m);
  return m;
}

/** Where the face surface is at (x, y), looking from +Z. */
function surfaceProbe(...geos: THREE.BufferGeometry[]) {
  const probes = geos.map((g) => new THREE.Mesh(g, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })));
  const ray = new THREE.Raycaster();
  const dir = V(0, 0, -1);
  return (x: number, y: number) => {
    ray.set(V(x, y, 2), dir);
    return ray.intersectObjects(probes, false)[0]?.point.z ?? 0.36;
  };
}

/** Smooth tube whose radius tapers cleanly at both ends (lips, smile, lashes). */
function taperedTubeGeometry(
  pts: V3[],
  maxRadius: number,
  segments = 32,
  radial = 10,
  profile: (t: number) => number = (t) => Math.sin(t * Math.PI) ** 0.55,
) {
  const curve = new THREE.CatmullRomCurve3(pts);
  const frames = curve.computeFrenetFrames(segments, false);
  const pos: number[] = [];
  const index: number[] = [];
  const p = V();
  const v = V();

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    curve.getPointAt(t, p);
    const r = Math.max(0.0004, maxRadius * profile(t));
    const N = frames.normals[i];
    const B = frames.binormals[i];
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      v.set(
        p.x + r * (ca * N.x + sa * B.x),
        p.y + r * (ca * N.y + sa * B.y),
        p.z + r * (ca * N.z + sa * B.z),
      );
      pos.push(v.x, v.y, v.z);
    }
  }
  const stride = radial + 1;
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * stride + j;
      const b = a + stride;
      const c = b + 1;
      const d = a + 1;
      index.push(a, d, b, b, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

// --- Sculpted stylized hair -----------------------------------------------------------------

function hairBaseGeometry() {
  const top = new THREE.Color(COLORS.hairBase);
  const side = new THREE.Color(COLORS.hairSide);
  const light = new THREE.Color(COLORS.hairLight);
  const c = new THREE.Color();
  const rows = 28;
  const centre = V(0, 0.04, -0.04);
  const n = V();
  return smoothGridGeometry(
    72,
    rows,
    (az, v, out) => {
      const edge = v >= 1;
      const phi = Math.min(v / ((rows - 1) / rows), 1) * phiAtHeight(hairline(az));
      skull(az, phi, out);
      const y = out.y;
      const front = Math.max(0, Math.cos(az));
      // Snug fade on the sides, fuller sculpted volume on top & crown.
      let thick = 0.012 + 0.036 * smoothstep(0.14, 0.42, y) * (0.65 + 0.35 * front);
      thick += 0.014 * front ** 2 * gauss(out.x / 0.19, (y - 0.34) / 0.08);
      // Soft directional flow ridges instead of noisy spikes.
      thick += 0.004 * smoothstep(0.18, 0.4, y) * Math.sin(az * 10 - y * 14);
      if (edge) thick = -0.003;
      n.copy(out).sub(centre).normalize();
      return out.addScaledVector(n, thick);
    },
    (p, az) => {
      c.copy(top).lerp(side, smoothstep(0.3, 0.06, p.y));
      // Soft glossy highlight band across the upper crown.
      const sheen = Math.exp(-(((p.y - 0.42) / 0.055) ** 2)) * smoothstep(-0.2, 0.7, Math.cos(az));
      c.lerp(light, sheen * 0.45);
      return c.clone();
    },
    false,
  );
}

/** Layered, plump cartoon hair tufts across the top and front hairline. */
function buildHairTufts(parent: THREE.Object3D) {
  const g = new THREE.Group();
  parent.add(g);

  // Sculpted teardrop lock geometry shared across tufts.
  const lockGeo = new THREE.SphereGeometry(1, 16, 12);
  const lp = lockGeo.attributes.position;
  for (let i = 0; i < lp.count; i++) {
    const x = lp.getX(i);
    const y = lp.getY(i);
    const z = lp.getZ(i);
    // Taper gently toward the front tip (+z) and flatten slightly underneath.
    const taper = 1 - 0.35 * smoothstep(0.0, 1.0, z);
    const arch = 0.14 * (1 - z * z);
    lp.setXYZ(i, x * taper, y * (y < 0 ? 0.65 : 1) + arch, z);
  }
  lockGeo.computeVertexNormals();

  const mats = [
    cartoonMat(COLORS.hairMid, { roughness: 0.56 }),
    cartoonMat(COLORS.hairLight, { roughness: 0.52 }),
    cartoonMat(COLORS.hairBase, { roughness: 0.6 }),
    cartoonMat(COLORS.hairDark, { roughness: 0.64 }),
  ];

  // [x, y, z, sx, sy, sz, rx, ry, rz, matIndex]
  // Front-to-back textured crew cut with a subtle lift and sweep to the right.
  const tufts: [number, number, number, number, number, number, number, number, number, number][] = [
    // Front hairline swoops (signature short lifted crew cut)
    [-0.17, 0.34, 0.255, 0.068, 0.044, 0.115, -0.35, -0.38, 0.28, 2],
    [-0.095, 0.375, 0.285, 0.075, 0.05, 0.125, -0.45, -0.18, 0.16, 0],
    [-0.015, 0.395, 0.295, 0.082, 0.056, 0.135, -0.5, 0.06, 0.04, 1],
    [0.075, 0.39, 0.285, 0.08, 0.054, 0.13, -0.46, 0.24, -0.1, 0],
    [0.155, 0.36, 0.26, 0.072, 0.046, 0.118, -0.36, 0.42, -0.22, 2],
    [0.225, 0.31, 0.205, 0.056, 0.038, 0.095, -0.22, 0.68, -0.35, 3],
    [-0.23, 0.3, 0.2, 0.054, 0.036, 0.092, -0.2, -0.68, 0.35, 3],

    // Mid-top textured volume
    [-0.155, 0.435, 0.12, 0.085, 0.052, 0.145, -0.18, -0.25, 0.26, 0],
    [-0.055, 0.475, 0.14, 0.095, 0.058, 0.155, -0.24, -0.05, 0.1, 1],
    [0.055, 0.475, 0.135, 0.095, 0.058, 0.155, -0.22, 0.14, -0.08, 0],
    [0.16, 0.435, 0.115, 0.085, 0.052, 0.14, -0.16, 0.32, -0.24, 2],

    // Crown & upper back fullness
    [-0.14, 0.465, -0.06, 0.095, 0.056, 0.16, 0.12, -0.22, 0.28, 2],
    [0.0, 0.495, -0.04, 0.11, 0.06, 0.17, 0.08, 0.05, 0.0, 1],
    [0.14, 0.465, -0.06, 0.095, 0.056, 0.16, 0.12, 0.24, -0.26, 0],
    [-0.11, 0.415, -0.22, 0.095, 0.054, 0.15, 0.42, -0.2, 0.24, 3],
    [0.0, 0.44, -0.23, 0.105, 0.058, 0.16, 0.45, 0.0, 0.0, 2],
    [0.11, 0.415, -0.22, 0.095, 0.054, 0.15, 0.42, 0.2, -0.24, 3],

    // Upper temple blend tufts
    [-0.255, 0.335, 0.04, 0.062, 0.042, 0.12, 0.05, -0.65, 0.55, 2],
    [0.255, 0.335, 0.04, 0.062, 0.042, 0.12, 0.05, 0.65, -0.55, 2],
  ];

  for (const [x, y, z, sx, sy, sz, rx, ry, rz, mi] of tufts) {
    const m = part(g, lockGeo, mats[mi]);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    m.rotation.set(rx, ry, rz);
  }
}

// --- Nose -----------------------------------------------------------------------------------

function noseHeight(x: number, y: number) {
  const ax = Math.abs(x);
  const rise = smoothstep(0.08, -0.135, y) ** 1.18;
  const under = smoothstep(-0.21, -0.145, y);
  const width = 0.032 + 0.025 * smoothstep(0.06, -0.13, y);
  const across = Math.max(0, 1 - (x / width) ** 2) ** 1.5;
  let h = 0.114 * rise * under * across;
  h += 0.026 * gauss(x / 0.038, (y + 0.145) / 0.032) * under; // friendly rounded cartoon tip
  h += 0.032 * gauss((ax - 0.05) / 0.024, (y + 0.168) / 0.022); // soft nostril wings
  return h;
}

function noseGeometry(faceZ: (x: number, y: number) => number) {
  const skin = new THREE.Color(COLORS.skin);
  const warm = new THREE.Color(COLORS.skinWarm);
  const shade = new THREE.Color(COLORS.skinShade);
  const nx = 44;
  const ny = 56;
  const x0 = -0.1, x1 = 0.1, y0 = -0.22, y1 = 0.09;
  const pos: number[] = [];
  const col: number[] = [];
  const index: number[] = [];
  const c = new THREE.Color();
  for (let j = 0; j <= ny; j++) {
    for (let i = 0; i <= nx; i++) {
      const x = x0 + ((x1 - x0) * i) / nx;
      const y = y1 + ((y0 - y1) * j) / ny;
      const h = noseHeight(x, y);
      pos.push(x, y, faceZ(x, y) - 0.004 + h);
      c.copy(skin);
      c.lerp(warm, 0.45 * gauss(x / 0.044, (y + 0.145) / 0.04));
      c.lerp(shade, 0.35 * smoothstep(-0.165, -0.205, y) * gauss(x / 0.065, 0));
      col.push(c.r, c.g, c.b);
    }
  }
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i, b = a + 1, d = a + nx + 1, e = d + 1;
      index.push(a, d, b, b, d, e);
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

function buildNostrils(parent: THREE.Object3D, surfaceZ: (x: number, y: number) => number) {
  const nostrilMat = cartoonMat(COLORS.nostril, { roughness: 0.9 });
  const nostrilGeo = new THREE.SphereGeometry(1, 12, 8);
  for (const s of [-1, 1]) {
    const nx = s * 0.036;
    const ny = -0.184;
    const m = part(parent, nostrilGeo, nostrilMat);
    m.scale.set(0.017, 0.0075, 0.011);
    m.position.set(nx, ny, surfaceZ(nx, ny) - 0.005);
    m.rotation.set(0.35, s * 0.25, -s * 0.22);
  }
}

// --- Expressive 3D Cartoon Eyes -------------------------------------------------------------

let irisTex: THREE.CanvasTexture | null = null;
function irisTexture() {
  if (irisTex) return irisTex;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const g = canvas.getContext('2d')!;
  g.translate(128, 128);

  // Rich radial blue-grey iris gradient
  const grad = g.createRadialGradient(0, 12, 14, 0, 0, 124);
  grad.addColorStop(0, '#c2e2f2');
  grad.addColorStop(0.32, COLORS.irisLight);
  grad.addColorStop(0.72, COLORS.iris);
  grad.addColorStop(0.92, COLORS.irisRing);
  grad.addColorStop(1, '#1a3144');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(0, 0, 126, 0, Math.PI * 2);
  g.fill();

  // Subtle stylized iris fibres
  g.lineWidth = 3;
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2 + (i % 3) * 0.02;
    g.strokeStyle = i % 2 ? 'rgba(20, 48, 72, 0.28)' : 'rgba(225, 246, 255, 0.26)';
    g.beginPath();
    g.moveTo(Math.cos(a) * 46, Math.sin(a) * 46);
    g.lineTo(Math.cos(a) * (102 + (i % 4) * 5), Math.sin(a) * (102 + (i % 4) * 5));
    g.stroke();
  }

  // Soft upper eyelid shadow across top of iris (classic Pixar eye depth)
  const topShade = g.createLinearGradient(0, -126, 0, -20);
  topShade.addColorStop(0, 'rgba(18, 28, 44, 0.55)');
  topShade.addColorStop(1, 'rgba(18, 28, 44, 0)');
  g.fillStyle = topShade;
  g.beginPath();
  g.arc(0, 0, 126, 0, Math.PI * 2);
  g.fill();

  // Crisp dark limbal ring
  g.lineWidth = 10;
  g.strokeStyle = '#1b354b';
  g.beginPath();
  g.arc(0, 0, 121, 0, Math.PI * 2);
  g.stroke();

  // Pupil
  g.fillStyle = COLORS.pupil;
  g.beginPath();
  g.arc(0, 0, 50, 0, Math.PI * 2);
  g.fill();

  // Soft lower-right bounce glow inside the iris
  const glow = g.createRadialGradient(-28, 46, 4, -20, 44, 52);
  glow.addColorStop(0, 'rgba(195, 236, 255, 0.42)');
  glow.addColorStop(1, 'rgba(195, 236, 255, 0)');
  g.fillStyle = glow;
  g.beginPath();
  g.arc(0, 0, 118, 0, Math.PI * 2);
  g.fill();

  irisTex = new THREE.CanvasTexture(canvas);
  irisTex.colorSpace = THREE.SRGBColorSpace;
  irisTex.anisotropy = 4;
  return irisTex;
}

/** Curved spherical cap with distortion-free front-projected UVs for the iris. */
function irisCapGeometry(radius: number, thetaMax: number) {
  const geo = new THREE.SphereGeometry(radius, 32, 16, 0, Math.PI * 2, 0, thetaMax);
  geo.rotateX(Math.PI / 2);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const maxR = radius * Math.sin(thetaMax);
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, pos.getX(i) / (2 * maxR) + 0.5, pos.getY(i) / (2 * maxR) + 0.5);
  }
  return geo;
}

interface Eye {
  lid: THREE.Object3D;
  ball: THREE.Object3D;
}

function buildEye(parent: THREE.Object3D, s: number, surfaceZ: (x: number, y: number) => number): Eye {
  const x = s * 0.128;
  const y = 0.004;
  const g = new THREE.Group();
  g.position.set(x, y, surfaceZ(x, y) - 0.02);
  g.rotation.y = s * 0.18;
  parent.add(g);

  // Rotating 3D glossy eyeball
  const ball = new THREE.Group();
  g.add(ball);

  const eyeR = 0.056;
  const scleraMat = new THREE.MeshStandardMaterial({
    color: COLORS.sclera,
    roughness: 0.18,
    metalness: 0.02,
  });
  const sclera = new THREE.Mesh(new THREE.SphereGeometry(eyeR, 28, 20), scleraMat);
  ball.add(sclera);

  // Curved 3D iris hugging the front of the eyeball
  const irisMesh = new THREE.Mesh(
    irisCapGeometry(eyeR + 0.0012, 0.52),
    new THREE.MeshStandardMaterial({ map: irisTexture(), roughness: 0.15, metalness: 0.02 }),
  );
  ball.add(irisMesh);

  // Crisp cartoon catchlights on the cornea (stay slightly below bloom threshold)
  const glintMat = new THREE.MeshBasicMaterial({ color: '#f4f8ff' });
  const addGlint = (r: number, gx: number, gy: number) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), glintMat);
    const gz = Math.sqrt(Math.max(0.0001, (eyeR + 0.0022) ** 2 - gx * gx - gy * gy));
    m.position.set(gx, gy, gz);
    m.scale.z = 0.35;
    ball.add(m);
  };
  addGlint(0.0072, 0.011, 0.011);
  addGlint(0.0034, -0.009, -0.008);

  // Smooth cartoon upper eyelid + graceful tapered lash line
  const lidR = eyeR + 0.0045;
  const lidGeo = new THREE.SphereGeometry(lidR, 28, 12, 0, Math.PI * 2, 0, Math.PI * 0.52);
  const lidMat = cartoonMat(COLORS.skin, { side: THREE.DoubleSide });

  const lid = new THREE.Group();
  g.add(lid);
  part(lid, lidGeo, lidMat);

  // Tapered lash line along the front rim of the upper eyelid
  const lashPts: V3[] = [];
  for (let i = 0; i <= 10; i++) {
    const a = -0.1 + (i / 10) * (Math.PI + 0.2);
    const lx = Math.cos(a) * (lidR + 0.0015);
    const lz = Math.sin(a) * (lidR + 0.0015);
    lashPts.push(V(lx, -0.001, lz));
  }
  const lash = new THREE.Mesh(
    taperedTubeGeometry(lashPts, 0.0052, 24, 8, (t) => 0.35 + 0.65 * Math.sin(t * Math.PI) ** 0.6),
    cartoonMat(COLORS.lash, { roughness: 0.7 }),
  );
  lid.add(lash);

  // Soft lower eyelid cupping the bottom of the eyeball
  const lower = new THREE.Group();
  lower.rotation.x = Math.PI + 0.72;
  g.add(lower);
  part(lower, new THREE.SphereGeometry(eyeR + 0.0032, 24, 10, 0, Math.PI * 2, 0, Math.PI * 0.45), lidMat);

  return { lid, ball };
}

// --- Eyebrows -------------------------------------------------------------------------------

function buildBrow(parent: THREE.Object3D, s: number, surfaceZ: (x: number, y: number) => number) {
  // Thick, friendly straight brows with softly beveled cartoon edges.
  const shape = new THREE.Shape();
  shape.moveTo(-0.056, -0.013);
  shape.quadraticCurveTo(-0.062, 0.015, -0.04, 0.016);
  shape.lineTo(0.048, 0.012);
  shape.quadraticCurveTo(0.065, 0.004, 0.058, -0.01);
  shape.lineTo(-0.042, -0.015);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.014,
    bevelEnabled: true,
    bevelSize: 0.005,
    bevelThickness: 0.006,
    bevelSegments: 4,
    curveSegments: 12,
  });
  if (s < 0) {
    geo.scale(-1, 1, 1);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i += 3)
      for (const k of [0, 1, 2]) {
        const t = p.getComponent(i, k);
        p.setComponent(i, k, p.getComponent(i + 2, k));
        p.setComponent(i + 2, k, t);
      }
  }
  geo.computeVertexNormals();
  const m = part(parent, geo, cartoonMat(COLORS.brow, { roughness: 0.68 }));
  const x = s * 0.128;
  const y = 0.092;
  m.position.set(x, y, surfaceZ(x, y) - 0.006);
  m.rotation.set(0, s * 0.26, -s * 0.05);
  return m;
}

// --- Mouth (charismatic lopsided smirk) -----------------------------------------------------

function buildMouth(parent: THREE.Object3D, surfaceZ: (x: number, y: number) => number) {
  const g = new THREE.Group();
  parent.add(g);

  const curvePts = (pts: [number, number][], lift: number) =>
    pts.map(([x, y]) => V(x, y, surfaceZ(x, y) + lift));

  // Subtle sculpted upper lip
  const upperPts = curvePts(
    [
      [-0.088, -0.295],
      [-0.042, -0.297],
      [0.0, -0.296],
      [0.048, -0.292],
      [0.095, -0.278],
    ],
    0.001,
  );
  part(g, taperedTubeGeometry(upperPts, 0.0095, 28, 10), cartoonMat(COLORS.lipUpper, { roughness: 0.58 }));

  // Fuller, warm cartoon lower lip
  const lowerPts = curvePts(
    [
      [-0.078, -0.312],
      [-0.035, -0.32],
      [0.006, -0.321],
      [0.052, -0.314],
      [0.092, -0.295],
    ],
    0.001,
  );
  part(g, taperedTubeGeometry(lowerPts, 0.0155, 28, 10), cartoonMat(COLORS.lipLower, { roughness: 0.52 }));

  // Clean tapered smirk line parting the lips
  const smirkPts = curvePts(
    [
      [-0.106, -0.298],
      [-0.054, -0.307],
      [0.0, -0.308],
      [0.056, -0.301],
      [0.102, -0.283],
      [0.124, -0.265],
    ],
    0.004,
  );
  part(
    g,
    taperedTubeGeometry(smirkPts, 0.0064, 34, 8, (t) => 0.25 + 0.75 * Math.sin(t * Math.PI) ** 0.55),
    cartoonMat(COLORS.mouth, { roughness: 0.75 }),
  );

  // Soft dimple accent at the smirking corner
  const dimplePts = curvePts(
    [
      [0.132, -0.259],
      [0.138, -0.272],
      [0.134, -0.285],
    ],
    0.0012,
  );
  part(g, taperedTubeGeometry(dimplePts, 0.0028, 14, 6), cartoonMat(COLORS.skinShade, { roughness: 0.8 }));

  return g;
}

// --- Clean sculpted cartoon ears ------------------------------------------------------------

function buildEar(parent: THREE.Object3D, s: number) {
  const g = new THREE.Group();
  g.position.set(s * 0.34, -0.075, -0.035);
  g.rotation.set(0.04, -s * 0.52, s * 0.1);
  parent.add(g);

  // Outer ear cup (smooth rounded bean shape)
  const outerGeo = new THREE.SphereGeometry(1, 22, 16);
  const op = outerGeo.attributes.position;
  for (let i = 0; i < op.count; i++) {
    const x = op.getX(i);
    const y = op.getY(i);
    const z = op.getZ(i);
    // Slightly wider at the top, gently tapered lobe at the bottom.
    const w = 1 + 0.18 * y;
    op.setXYZ(i, x * 0.044, y * 0.145, z * 0.088 * w);
  }
  outerGeo.computeVertexNormals();
  part(g, outerGeo, cartoonMat(COLORS.ear));

  // Warm recessed inner ear bowl
  const innerGeo = new THREE.SphereGeometry(1, 18, 12);
  innerGeo.scale(0.022, 0.095, 0.052);
  innerGeo.translate(s * 0.024, 0.004, 0.004);
  part(g, innerGeo, cartoonMat(COLORS.earIn, { roughness: 0.78 }));

  // Smooth inner cartilage ridge (fits cleanly inside the ear with zero protruding ends)
  const ridgeGeo = new THREE.SphereGeometry(1, 14, 10);
  ridgeGeo.scale(0.016, 0.056, 0.024);
  ridgeGeo.translate(s * 0.028, -0.004, 0.012);
  part(g, ridgeGeo, cartoonMat(COLORS.ear));
}

// --- Grounded stylized neck & crew-neck tee collar ------------------------------------------

function buildBust(parent: THREE.Object3D) {
  const g = new THREE.Group();
  parent.add(g);

  // Smooth sculpted neck with subtle warm shadow under the jaw
  const neckGeo = new THREE.CylinderGeometry(0.145, 0.175, 0.3, 32, 8);
  const np = neckGeo.attributes.position;
  const nc = new Float32Array(np.count * 3);
  const topCol = new THREE.Color(COLORS.skinShade);
  const botCol = new THREE.Color(COLORS.skin);
  const c = new THREE.Color();
  for (let i = 0; i < np.count; i++) {
    const t = clamp01((np.getY(i) + 0.15) / 0.3);
    c.copy(botCol).lerp(topCol, smoothstep(0.35, 1.0, t) * 0.72);
    c.toArray(nc, i * 3);
  }
  neckGeo.setAttribute('color', new THREE.BufferAttribute(nc, 3));
  const neck = part(g, neckGeo, cartoonMat(null));
  neck.position.set(0, -0.51, -0.035);

  // Stylized rounded shoulders & crew-neck tee bust (closed smooth silhouette from every angle)
  const torsoGeo = new THREE.SphereGeometry(1, 32, 20);
  const tp = torsoGeo.attributes.position;
  for (let i = 0; i < tp.count; i++) {
    const x = tp.getX(i);
    const y = tp.getY(i);
    const z = tp.getZ(i);
    tp.setXYZ(i, x * 0.42, y * (y < 0 ? 0.08 : 0.24), z * 0.27);
  }
  torsoGeo.computeVertexNormals();
  const torso = part(g, torsoGeo, cartoonMat(COLORS.shirt, { roughness: 0.85 }));
  torso.position.set(0, -0.8, -0.035);

  // Ribbed crew-neck collar ring
  const collar = part(
    g,
    new THREE.TorusGeometry(0.188, 0.032, 12, 36),
    cartoonMat(COLORS.collar, { roughness: 0.8 }),
  );
  collar.rotation.x = Math.PI / 2 + 0.14;
  collar.position.set(0, -0.615, -0.025);

  // Subtle orange accent piping inside the collar to echo the portfolio's accent colour
  const trim = part(
    g,
    new THREE.TorusGeometry(0.172, 0.008, 8, 36),
    cartoonMat(COLORS.shirtAccent, { roughness: 0.6 }),
  );
  trim.rotation.x = Math.PI / 2 + 0.14;
  trim.position.set(0, -0.602, -0.022);
}

// --- The stage ------------------------------------------------------------------------------

export interface AvatarStage {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** False once the head has left the screen (or there's no room for it). */
  readonly visible: boolean;
  layout(width: number, height: number, card: DOMRect): void;
  update(dt: number, t: number): void;
  exit(): void;
}

const HEAD_UNITS = 1.24; // crown to bust base, in model units
const FOV = 25;

export function createAvatarStage(reducedMotion: boolean): AvatarStage {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 1, 30);

  // Warm sunset studio 3-point lighting: soft peachy sky bounce, golden key, cool-warm fill, crisp rim.
  scene.add(new THREE.HemisphereLight('#ffe7d1', '#9c7868', 1.25));

  const key = new THREE.DirectionalLight('#ffd7ad', 2.2);
  key.position.set(2.2, 2.3, 2.8);
  scene.add(key);

  const fill = new THREE.DirectionalLight('#c9d8f5', 0.65);
  fill.position.set(-2.4, 0.4, 2.0);
  scene.add(fill);

  const bounce = new THREE.DirectionalLight('#ffcaa8', 0.45);
  bounce.position.set(0.2, -1.8, 2.2);
  scene.add(bounce);

  const rim = new THREE.DirectionalLight('#ffa866', 1.9);
  rim.position.set(2.5, 1.3, -2.5);
  scene.add(rim);

  // root: entry/exit → float: gentle breathing bob + bust → neckPivot: turns naturally toward cursor.
  const root = new THREE.Group();
  const float = new THREE.Group();
  const neckPivot = new THREE.Group();
  const head = new THREE.Group();

  float.position.y = 0.13; // centers the head + bust nicely in the viewport
  neckPivot.position.set(0, -0.44, -0.03);
  head.position.set(0, 0.44, 0.03);

  scene.add(root);
  root.add(float);
  buildBust(float);
  float.add(neckPivot);
  neckPivot.add(head);

  const headGeo = headGeometry();
  part(head, headGeo, cartoonMat(null));
  part(head, hairBaseGeometry(), cartoonMat(null, { roughness: 0.6 }));
  buildHairTufts(head);

  const noseGeo = noseGeometry(surfaceProbe(headGeo));
  part(head, noseGeo, cartoonMat(null));

  const surfaceZ = surfaceProbe(headGeo, noseGeo);
  buildNostrils(head, surfaceZ);
  const eyes = [buildEye(head, -1, surfaceZ), buildEye(head, 1, surfaceZ)];

  const leftBrow = buildBrow(head, -1, surfaceZ);
  const rightBrow = buildBrow(head, 1, surfaceZ);
  const leftBrowY = leftBrow.position.y;
  const rightBrowY = rightBrow.position.y;

  const mouth = buildMouth(head, surfaceZ);
  buildEar(head, -1);
  buildEar(head, 1);

  let w = 1;
  let h = 1;
  let cx = 0;
  let cy = 0;
  let roomy = false;
  let rest = { x: -0.55, y: 0.08 }; // idle glance toward the intro card
  let entry = reducedMotion ? 1 : 0;
  let exiting = -1;
  let gone = false;
  const headGaze = { x: rest.x, y: rest.y };
  const eyeGaze = { x: rest.x, y: rest.y };
  let pointer: { x: number; y: number; time: number } | null = null;
  let excited = 0;
  let excitedTarget = 0;
  let nextBlink = 1.6;
  let blinkStart = -1;

  addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse' || e.pointerType === 'pen') pointer = { x: e.clientX, y: e.clientY, time: performance.now() };
  });
  document.addEventListener('pointerover', (e) => {
    excitedTarget = (e.target as HTMLElement).closest?.('[data-action="start"]') ? 1 : 0;
  });

  function layout(width: number, height: number, card: DOMRect) {
    w = width;
    h = height;
    const right = w - card.right;
    let headPx: number;
    if (right >= Math.max(260, w * 0.28)) {
      headPx = Math.min(Math.max(Math.min(h * 0.56, right * 0.68), 190), 540);
      cx = card.right + right * 0.5;
      cy = h * 0.49;
      rest = { x: -0.55, y: 0.08 };
    } else if (card.top >= 170) {
      headPx = Math.min(card.top * 0.78, w * 0.54, 340);
      cx = (card.left + card.right) / 2;
      cy = card.top * 0.53;
      rest = { x: 0, y: 0.65 };
    } else {
      roomy = false;
      return;
    }
    roomy = true;
    const dist = (h * HEAD_UNITS) / (headPx * 2 * Math.tan(THREE.MathUtils.degToRad(FOV / 2)));
    camera.position.set(0, 0, dist);
    camera.near = Math.max(0.5, dist - 2.5);
    camera.far = dist + 3.5;
    camera.aspect = w / h;
    camera.setViewOffset(w, h, w / 2 - cx, h / 2 - cy, w, h);
    camera.updateProjectionMatrix();
  }

  function update(dt: number, t: number) {
    if (gone || !roomy) return;
    const k = (rate: number) => 1 - Math.exp(-rate * dt);

    // Rise in with the intro card; drop away when the ride starts.
    let y = 0;
    let spin = 0;
    if (exiting >= 0) {
      exiting += dt / 0.7;
      const e = Math.min(1, exiting) ** 3;
      y = -2.6 * e;
      spin = 0.55 * e;
      if (exiting >= 1) gone = true;
    } else if (entry < 1) {
      entry = Math.min(1, entry + dt / 1.05);
      y = -1.9 * (1 - entry) ** 3;
    }
    root.position.y = y;
    root.rotation.x = spin;
    float.position.y = 0.13 + (reducedMotion ? 0 : Math.sin(t * 1.4) * 0.015);

    // Eyes lead slightly faster than the head turns for lively cartoon personality.
    let tx = rest.x;
    let ty = rest.y;
    if (pointer && performance.now() - pointer.time < 3500) {
      tx = Math.max(-1, Math.min(1, (pointer.x - cx) / (w * 0.4)));
      ty = Math.max(-1, Math.min(1, (pointer.y - cy) / (h * 0.5)));
    } else if (!reducedMotion) {
      tx += Math.sin(t * 0.37) * 0.16;
      ty += Math.sin(t * 0.53) * 0.06;
    }

    headGaze.x += (tx - headGaze.x) * k(4.2);
    headGaze.y += (ty - headGaze.y) * k(4.2);
    eyeGaze.x += (tx - eyeGaze.x) * k(11);
    eyeGaze.y += (ty - eyeGaze.y) * k(11);

    excited += (excitedTarget - excited) * k(8);

    const idleTilt = reducedMotion ? 0 : Math.sin(t * 0.85) * 0.022;
    neckPivot.rotation.set(
      headGaze.y * 0.28 - excited * 0.05,
      headGaze.x * 0.54,
      -headGaze.x * 0.06 + idleTilt + excited * 0.04,
    );

    // Eyeballs rotate smoothly in their sockets, leading the head turn.
    const eyeYaw = (eyeGaze.x - headGaze.x * 0.45) * 0.38;
    const eyePitch = (eyeGaze.y - headGaze.y * 0.45) * 0.24;
    for (const eye of eyes) eye.ball.rotation.set(eyePitch, eyeYaw, 0);

    // Friendly asymmetric brow lift & perked-up smirk on hover over [ play ].
    leftBrow.position.y = leftBrowY + excited * 0.014;
    rightBrow.position.y = rightBrowY + excited * 0.022;
    rightBrow.rotation.z = -0.05 + excited * 0.08;
    mouth.scale.set(1 + excited * 0.05, 1 + excited * 0.08, 1);

    // Natural blinks with occasional double-blinks.
    if (t >= nextBlink && blinkStart < 0) blinkStart = t;
    let close = 0;
    if (blinkStart >= 0) {
      const p = (t - blinkStart) / 0.15;
      if (p >= 1) {
        blinkStart = -1;
        nextBlink = t + (Math.random() < 0.22 ? 0.24 : 2.1 + Math.random() * 3.4);
      } else close = Math.sin(Math.PI * p);
    }
    const open = -0.52 - excited * 0.22;
    for (const eye of eyes) eye.lid.rotation.x = open + (0.62 - open) * close;
  }

  return {
    scene,
    camera,
    get visible() {
      return roomy && !gone;
    },
    layout,
    update,
    exit() {
      if (exiting < 0) exiting = reducedMotion ? 1 : 0;
    },
  };
}

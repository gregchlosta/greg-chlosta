import * as THREE from 'three';

// A cartoon head of Greg for the landing screen, in the same warm, faceted style as the
// valley. It's meant to remind you of him rather than copy a photo: dark-blond crew cut,
// thick straight brows, blue-grey eyes, a big straight nose, a sharp jaw, ears that stick
// out a bit and a lopsided smirk. It floats to the right of the intro card, follows the
// pointer and blinks.

type V3 = THREE.Vector3;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);


const COLORS = {
  skin: '#eaa786',
  blush: '#e4917a',
  skinShade: '#cf8a72',
  stubble: '#c99682',
  hair: '#7a5535',
  hairSide: '#5c3f28',
  hairLight: '#987049',
  hairDark: '#4b321f',
  brow: '#5b3e27',
  sclera: '#ebe5de',
  iris: '#5b8aa8',
  irisRing: '#2f526b',
  pupil: '#141418',
  lash: '#3a2620',
  mouth: '#7a3b38',
  lip: '#d98a7b',
  ear: '#e8a07f',
  earIn: '#cf856a',
  crease: '#bf7560',
  lowerLash: '#b86f5b',
  nostril: '#9c5546',
};

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const gauss = (u: number, v: number) => Math.exp(-(u * u + v * v));

// --- Head shape ---------------------------------------------------------------------------
// Units: crown to chin ≈ 1, face toward +z, eyes at y ≈ 0.

/** Cross-sections from the crown (φ = 0) to under the chin (φ = π): height, half-width, front z, back z. */
const PROFILE: [number, number, number, number, number][] = [
  [0.0, 0.5, 0.0, -0.03, -0.03],
  [0.25, 0.487, 0.11, 0.07, -0.15],
  [0.5, 0.447, 0.215, 0.17, -0.265],
  [0.75, 0.385, 0.29, 0.255, -0.36],
  [1.0, 0.31, 0.33, 0.315, -0.42],
  [1.25, 0.22, 0.345, 0.352, -0.455],
  [1.5, 0.12, 0.35, 0.372, -0.47],
  [1.75, 0.02, 0.345, 0.372, -0.455],
  [2.0, -0.08, 0.33, 0.368, -0.42],
  [2.25, -0.18, 0.31, 0.362, -0.35],
  [2.5, -0.28, 0.288, 0.352, -0.25],
  [2.7, -0.36, 0.266, 0.338, -0.13],
  [2.85, -0.43, 0.172, 0.324, -0.02],
  [3.0, -0.478, 0.094, 0.302, 0.09],
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
  // Catmull-Rom through the neighbouring rows keeps the silhouette smooth.
  const cr = (k: number) => {
    const v0 = p0[k], v1 = a[k], v2 = b[k], v3 = p3[k];
    return 0.5 * (2 * v1 + (-v0 + v2) * t + (2 * v0 - 5 * v1 + 4 * v2 - v3) * t * t + (-v0 + 3 * v1 - 3 * v2 + v3) * t * t * t);
  };
  return { y: cr(1), w: Math.max(0, cr(2)), zf: cr(3), zb: cr(4) };
}

/** Where the hair starts, by angle around the head (0 = front, π = back). */
function hairline(az: number) {
  const a = Math.abs(az);
  // A slightly ragged front edge, like a short crew cut.
  const fuzz = 0.01 * Math.abs(Math.sin(az * 34)) * smoothstep(1.3, 0.3, a);
  let h = 0.29 + fuzz;
  h += (0.22 - h) * smoothstep(0.45, 0.8, a);
  h += (0.09 - h) * smoothstep(0.8, 1.15, a);
  h += (0.07 - h) * smoothstep(1.15, 1.6, a);
  h += (-0.25 - h) * smoothstep(1.75, 2.6, a);
  return h;
}

/** Facial features, as a push toward the viewer at (x, y). */
function features(x: number, y: number) {
  const ax = Math.abs(x);
  let dz = 0;
  dz += 0.028 * Math.exp(-((x / 0.22) ** 4)) * Math.exp(-(((y - 0.07) / 0.035) ** 2)); // brow ridge
  dz -= 0.02 * gauss((ax - 0.13) / 0.075, (y + 0.005) / 0.045); // eye sockets
  dz += 0.008 * gauss(x / 0.06, (y + 0.1) / 0.09); // a soft base for the nose
  dz += 0.016 * gauss((ax - 0.19) / 0.08, (y + 0.09) / 0.06); // cheekbones
  dz -= 0.02 * gauss((ax - 0.22) / 0.06, (y + 0.24) / 0.07); // hollow under the cheekbones
  dz += 0.01 * gauss(x / 0.13, (y + 0.3) / 0.045); // mouth
  dz += 0.038 * gauss(x / 0.12, (y + 0.445) / 0.05); // strong chin
  return dz;
}

function skull(az: number, phi: number, out: V3) {
  const { y, w, zf, zb } = profileAt(phi);
  const s = Math.sin(az);
  const c = Math.cos(az);
  // Flatter across the face than round, and squarer still at the jaw.
  const pf = 2 + 0.6 * smoothstep(0.3, 0.05, y) + 0.35 * smoothstep(-0.25, -0.42, y);
  const zm = (zf + zb) / 2;
  const x = w * Math.sign(s) * Math.abs(s) ** (2 / (c > 0 ? pf : 2));
  let z = c >= 0 ? zm + (zf - zm) * Math.abs(c) ** (2 / pf) : zm - (zm - zb) * Math.abs(c) ** 0.95;
  z += smoothstep(0.15, 0.6, c) * features(x, y);
  return out.set(x, y, z);
}

/** Builds a closed surface over (azimuth, row) and lets `paint` colour each vertex. */
function gridGeometry(
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
  // Columns are denser across the face; the seam sits at the back, under the hair.
  const azAt = (i: number) => {
    const s = -1 + (2 * i) / cols;
    return Math.PI * (0.55 * s + 0.45 * s * s * s);
  };
  push(0, 0); // top pole
  // A little jitter breaks the grid into irregular, hand-placed-looking facets.
  const jit = (i: number, j: number, k: number) => {
    const s = Math.sin((i % cols) * 127.1 + j * 311.7 + k * 74.7) * 43758.5453;
    return (s - Math.floor(s) - 0.5) * 0.3;
  };
  for (let j = 1; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const da = (azAt(i + 1) - azAt(i)) * jit(i, j, 0);
      push(azAt(i) + da, (j + (closedBottom || j < rows - 1 ? jit(i, j, 1) : 0)) / rows);
    }
  const last = rows - 1;
  if (closedBottom) push(0, 1);
  else for (let i = 0; i < cols; i++) push(azAt(i), 1);
  const vid = (i: number, j: number) => (j === 0 ? 0 : closedBottom && j === rows ? 1 + last * cols : 1 + (j - 1) * cols + (i % cols));
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
  const blush = new THREE.Color(COLORS.blush);
  const shade = new THREE.Color(COLORS.skinShade);
  const stubble = new THREE.Color(COLORS.stubble);
  const c = new THREE.Color();
  return gridGeometry(
    64,
    54,
    (az, v, out) => skull(az, v * Math.PI, out),
    (p, az) => {
      c.copy(skin);
      const front = Math.max(0, Math.cos(az));
      c.lerp(blush, 0.5 * front * (gauss((p.x - 0.17) / 0.07, (p.y + 0.13) / 0.05) + gauss((p.x + 0.17) / 0.07, (p.y + 0.13) / 0.05)));
      c.lerp(blush, 0.4 * front * gauss(p.x / 0.035, (p.y + 0.15) / 0.035)); // nose tip
      // A light five-o'clock shadow along the jaw, chin and upper lip.
      const jaw = smoothstep(-0.2, -0.3, p.y) * smoothstep(0.32, 0.05, Math.abs(p.x) - 0.05 * (1 - front));
      const upperLip = gauss(p.x / 0.09, (p.y + 0.255) / 0.025) * front;
      c.lerp(stubble, 0.4 * Math.min(1, jaw + upperLip) * (1 - gauss(p.x / 0.07, (p.y + 0.31) / 0.02)));
      c.lerp(shade, 0.6 * smoothstep(-0.38, -0.49, p.y) * (1 - front * 0.7));
      return c.clone();
    },
    true,
  );
}

/** φ where the skull reaches height y (the profile runs downward with φ). */
function phiAtHeight(y: number) {
  let lo = 0;
  let hi = Math.PI;
  for (let k = 0; k < 30; k++) {
    const mid = (lo + hi) / 2;
    if (profileAt(mid).y > y) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function hairGeometry() {
  const top = new THREE.Color(COLORS.hair);
  const side = new THREE.Color(COLORS.hairSide);
  const light = new THREE.Color(COLORS.hairLight);
  const dark = new THREE.Color(COLORS.hairDark);
  const c = new THREE.Color();
  const rows = 26;
  const centre = V(0, 0.05, -0.04);
  const n = V();
  return gridGeometry(
    64,
    rows,
    (az, v, out) => {
      // The last row tucks back onto the skin, giving the hair a crisp edge.
      const edge = v >= 1;
      const phi = Math.min(v / ((rows - 1) / rows), 1) * phiAtHeight(hairline(az));
      skull(az, phi, out);
      const y = out.y;
      const front = Math.max(0, Math.cos(az));
      // A crew cut: fuller on top with a little lift at the front, very short on the sides.
      let thick = 0.016 + 0.034 * smoothstep(0.12, 0.42, y) * (0.55 + 0.45 * front);
      thick += 0.018 * front ** 3 * gauss(out.x / 0.16, (y - 0.33) / 0.06);
      // Chunky clumps, so it reads as hair rather than a helmet.
      thick += 0.008 * smoothstep(0.15, 0.4, y) * (Math.sin(az * 23 + phi * 9) * Math.sin(phi * 31 - az * 7));
      if (edge) thick = -0.002;
      n.copy(out).sub(centre).normalize();
      return out.addScaledVector(n, thick);
    },
    (p, az) => {
      c.copy(top).lerp(side, smoothstep(0.32, 0.12, p.y));
      const groove = smoothstep(0.55, 0.95, Math.sin(az * 27 + p.y * 24)) * smoothstep(0.14, 0.32, p.y);
      c.lerp(dark, groove * 0.45);
      const band = Math.exp(-(((p.y - 0.425 - 0.01 * Math.sin(az * 31)) / 0.02) ** 2)) * smoothstep(-0.3, 0.6, Math.cos(az));
      c.lerp(light, band * 0.6);
      return c.clone();
    },
    false,
  );
}

// --- Materials ------------------------------------------------------------------------------

/** Faceted, like the valley's props. */
function skinMat(color: string | null, extra: THREE.MeshStandardMaterialParameters = {}) {
  return new THREE.MeshStandardMaterial({ color: color ?? '#ffffff', vertexColors: color === null, flatShading: true, roughness: 0.82, metalness: 0, ...extra });
}

function part(parent: THREE.Object3D, geo: THREE.BufferGeometry, material: THREE.Material) {
  const m = new THREE.Mesh(geo, material);
  parent.add(m);
  return m;
}

/** Where the face surface is at (x, y), looking from the front. */
function surfaceProbe(...geos: THREE.BufferGeometry[]) {
  const probes = geos.map((g) => new THREE.Mesh(g, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })));
  const ray = new THREE.Raycaster();
  const dir = V(0, 0, -1);
  return (x: number, y: number) => {
    ray.set(V(x, y, 2), dir);
    return ray.intersectObjects(probes, false)[0]?.point.z ?? 0.36;
  };
}

/** Height of the nose above the face at (x, y): a straight ridge, a rounded tip, soft wings. */
function noseHeight(x: number, y: number) {
  const ax = Math.abs(x);
  // Ridge: rises steadily from between the brows to the tip, then tucks under.
  const rise = smoothstep(0.075, -0.14, y) ** 1.25;
  const under = smoothstep(-0.215, -0.15, y);
  const width = 0.03 + 0.024 * smoothstep(0.06, -0.13, y);
  const across = Math.max(0, 1 - (x / width) ** 2) ** 1.6;
  let h = 0.118 * rise * under * across;
  h += 0.02 * gauss(x / 0.034, (y + 0.146) / 0.03) * under; // rounded tip
  h += 0.03 * gauss((ax - 0.054) / 0.022, (y + 0.171) / 0.021); // nostril wings
  return h;
}

/** The nose as its own smooth patch, seated just under the face so its edges melt in. */
function noseGeometry(faceZ: (x: number, y: number) => number) {
  const skin = new THREE.Color(COLORS.skin);
  const blush = new THREE.Color(COLORS.blush);
  const nx = 40;
  const ny = 56;
  const x0 = -0.1, x1 = 0.1, y0 = -0.225, y1 = 0.085;
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
      c.copy(skin).lerp(blush, 0.55 * gauss(x / 0.04, (y + 0.15) / 0.04));
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

// --- Features -------------------------------------------------------------------------------

let irisTex: THREE.CanvasTexture | null = null;
/** Blue-grey iris with fibres, a dark outer ring and the pupil, drawn once. */
function irisTexture() {
  if (irisTex) return irisTex;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const g = canvas.getContext('2d')!;
  g.translate(64, 64);
  const grad = g.createRadialGradient(0, 0, 10, 0, 0, 63);
  grad.addColorStop(0, '#a6cde0');
  grad.addColorStop(0.38, '#73a5c2');
  grad.addColorStop(0.75, COLORS.iris);
  grad.addColorStop(1, COLORS.irisRing);
  g.fillStyle = grad;
  g.beginPath();
  g.arc(0, 0, 64, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 2;
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2 + (i % 3) * 0.03;
    g.strokeStyle = i % 2 ? 'rgba(25, 55, 78, 0.35)' : 'rgba(225, 245, 255, 0.28)';
    g.beginPath();
    g.moveTo(Math.cos(a) * 25, Math.sin(a) * 25);
    g.lineTo(Math.cos(a) * (50 + (i % 4) * 3), Math.sin(a) * (50 + (i % 4) * 3));
    g.stroke();
  }
  g.lineWidth = 6;
  g.strokeStyle = '#1c3448';
  g.beginPath();
  g.arc(0, 0, 60, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = COLORS.pupil;
  g.beginPath();
  g.arc(0, 0, 24, 0, Math.PI * 2);
  g.fill();
  irisTex = new THREE.CanvasTexture(canvas);
  irisTex.colorSpace = THREE.SRGBColorSpace;
  irisTex.anisotropy = 4;
  return irisTex;
}

interface Eye {
  lid: THREE.Object3D;
  iris: THREE.Object3D;
  irisBase: V3;
}

function buildEye(parent: THREE.Object3D, s: number, surfaceZ: (x: number, y: number) => number): Eye {
  const x = s * 0.13;
  const y = -0.004;
  const g = new THREE.Group();
  g.position.set(x, y, surfaceZ(x, y) - 0.012);
  g.rotation.y = s * 0.2;
  g.scale.setScalar(1.1);
  parent.add(g);

  const sclera = new THREE.SphereGeometry(1, 20, 14);
  sclera.scale(0.058, 0.034, 0.03);
  g.add(new THREE.Mesh(sclera, new THREE.MeshBasicMaterial({ color: COLORS.sclera })));

  const iris = new THREE.Group();
  const irisBase = V(0, -0.002, 0.0285);
  iris.position.copy(irisBase);
  g.add(iris);
  iris.add(new THREE.Mesh(new THREE.CircleGeometry(0.025, 32), new THREE.MeshBasicMaterial({ map: irisTexture() })));
  const glint = (r: number, x: number, y: number) => {
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 16), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
    m.position.set(x, y, 0.0012);
    iris.add(m);
  };
  glint(0.0048, 0.007, 0.008);
  glint(0.0024, -0.006, -0.006);

  // Eyelids are skin caps; the upper one swings down to blink and carries a bold lash line.
  const cap = new THREE.SphereGeometry(1, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const lid = new THREE.Group();
  lid.scale.set(0.061, 0.037, 0.033);
  g.add(lid);
  part(lid, cap, skinMat(COLORS.skin, { side: THREE.DoubleSide }));
  const lash = new THREE.Mesh(new THREE.TorusGeometry(1, 0.1, 4, 24, Math.PI), new THREE.MeshBasicMaterial({ color: COLORS.lash }));
  lash.rotation.x = Math.PI / 2;
  lid.add(lash);

  const lower = new THREE.Group();
  lower.scale.set(0.06, 0.036, 0.032);
  lower.rotation.x = Math.PI + 0.85;
  g.add(lower);
  part(lower, cap, skinMat(COLORS.skin, { side: THREE.DoubleSide }));

  return { lid, iris, irisBase };
}

function buildBrow(parent: THREE.Object3D, s: number, surfaceZ: (x: number, y: number) => number) {
  // Thick and straight, the outer end tipping down a touch.
  const shape = new THREE.Shape();
  shape.moveTo(-0.054, -0.014);
  shape.quadraticCurveTo(-0.058, 0.014, -0.04, 0.015);
  shape.lineTo(0.046, 0.011);
  shape.quadraticCurveTo(0.062, 0.004, 0.056, -0.009);
  shape.lineTo(-0.04, -0.015);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.012, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.004, bevelSegments: 2, curveSegments: 8 });
  if (s < 0) {
    // Mirror, then flip the winding so the faces still point outward.
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
  const m = part(parent, geo, skinMat(COLORS.brow));
  const x = s * 0.128;
  const y = 0.078;
  m.position.set(x, y, surfaceZ(x, y) - 0.008);
  m.rotation.set(0, s * 0.3, -s * 0.06);
  return m;
}

/** A short ink stroke following the face. */
function stroke(parent: THREE.Object3D, surfaceZ: (x: number, y: number) => number, pts: [number, number][], radius: number, color: string, lift = 0.002) {
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, y]) => V(x, y, surfaceZ(x, y) + lift)));
  const m = new THREE.MeshBasicMaterial({ color });
  parent.add(new THREE.Mesh(new THREE.TubeGeometry(curve, pts.length * 10, radius, 6, false), m));
  for (const p of [curve.getPoint(0), curve.getPoint(1)]) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(radius, 6, 4), m);
    cap.position.copy(p);
    parent.add(cap);
  }
}

function buildMouth(parent: THREE.Object3D, surfaceZ: (x: number, y: number) => number) {
  // A full lower lip under a lopsided smirk.
  const lipGeo = new THREE.SphereGeometry(1, 18, 10);
  lipGeo.scale(0.074, 0.018, 0.016);
  const lip = part(parent, lipGeo, skinMat(COLORS.lip));
  lip.position.set(0.006, -0.322, surfaceZ(0.006, -0.322) - 0.007);
  stroke(parent, surfaceZ, [[-0.11, -0.297], [-0.056, -0.306], [0.0, -0.307], [0.056, -0.3], [0.102, -0.284], [0.123, -0.268]], 0.0063, COLORS.mouth, 0.003);
  // Smile lines from the nose to the mouth, deeper on the smirking side, and a dimple.
  stroke(parent, surfaceZ, [[0.082, -0.19], [0.114, -0.226], [0.14, -0.258]], 0.0027, COLORS.crease);
  stroke(parent, surfaceZ, [[-0.08, -0.194], [-0.106, -0.232], [-0.124, -0.264]], 0.0021, COLORS.crease);
  stroke(parent, surfaceZ, [[0.137, -0.267], [0.143, -0.281], [0.139, -0.294]], 0.0022, COLORS.crease);
}

/** Eyelid creases, lower lashes and nostrils. */
function buildDetails(parent: THREE.Object3D, surfaceZ: (x: number, y: number) => number) {
  for (const s of [-1, 1]) {
    stroke(parent, surfaceZ, [[s * 0.075, 0.041], [s * 0.12, 0.055], [s * 0.168, 0.053], [s * 0.198, 0.037]], 0.0026, COLORS.crease);
    stroke(parent, surfaceZ, [[s * 0.118, -0.044], [s * 0.158, -0.041], [s * 0.19, -0.029]], 0.0017, COLORS.lowerLash);
    stroke(parent, surfaceZ, [[s * 0.047, -0.152], [s * 0.066, -0.164], [s * 0.064, -0.181], [s * 0.04, -0.19]], 0.0028, COLORS.nostril, 0.001);
  }
}

function buildEar(parent: THREE.Object3D, s: number) {
  const g = new THREE.Group();
  g.position.set(s * 0.342, -0.09, -0.045);
  g.rotation.set(0.05, -s * 0.55, s * 0.08);
  g.scale.setScalar(1.3);
  parent.add(g);
  const outer = new THREE.SphereGeometry(1, 16, 12);
  outer.scale(0.034, 0.118, 0.07);
  part(g, outer, skinMat(COLORS.ear));
  const inner = new THREE.SphereGeometry(1, 12, 8);
  inner.scale(0.016, 0.078, 0.042);
  inner.translate(s * 0.021, 0.004, -0.004);
  part(g, inner, skinMat(COLORS.earIn));
  // The rolled rim of the ear.
  const helix = new THREE.TorusGeometry(1, 0.13, 6, 20, Math.PI * 1.25);
  helix.rotateZ(-Math.PI * 0.1);
  helix.rotateY(Math.PI / 2);
  helix.scale(0.05, 0.09, 0.052);
  helix.translate(s * 0.026, 0.008, -0.002);
  part(g, helix, skinMat(COLORS.ear));
}

// --- The stage ---------------------------------------------------------------------------

export interface AvatarStage {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** False once the head has left the screen (or there's no room for it). */
  readonly visible: boolean;
  layout(width: number, height: number, card: DOMRect): void;
  update(dt: number, t: number): void;
  exit(): void;
}

const HEAD_UNITS = 1.0; // crown to chin, in model units
const FOV = 26;

export function createAvatarStage(reducedMotion: boolean): AvatarStage {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 1, 30);

  // The valley's sunset light: warm sky, grassy bounce from below, the sun off to the right.
  // The ground bounce is warmer than the valley's grass, so the underside of the nose and
  // the edge of the hair don't go murky green.
  scene.add(new THREE.HemisphereLight('#ffe2c4', '#b48a6c', 1.3));
  const fill = new THREE.DirectionalLight('#ffd2b8', 0.6);
  fill.position.set(-0.5, -1.2, 2.5);
  scene.add(fill);
  const key = new THREE.DirectionalLight('#ffd3a1', 2.6);
  key.position.set(2.2, 2.0, 2.6);
  const rim = new THREE.DirectionalLight('#ffb27a', 1.8);
  rim.position.set(2.6, 1.0, -2.4);
  scene.add(key, rim);

  // root: entry/exit → float: gentle bob → head: turns toward the pointer.
  const root = new THREE.Group();
  const float = new THREE.Group();
  const head = new THREE.Group();
  scene.add(root);
  root.add(float);
  float.add(head);

  const headGeo = headGeometry();
  part(head, headGeo, skinMat(null));
  part(head, hairGeometry(), skinMat(null));
  const noseGeo = noseGeometry(surfaceProbe(headGeo));
  part(head, noseGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0 }));
  const surfaceZ = surfaceProbe(headGeo, noseGeo);
  const eyes = [buildEye(head, -1, surfaceZ), buildEye(head, 1, surfaceZ)];
  const brows = new THREE.Group();
  head.add(brows);
  buildBrow(brows, -1, surfaceZ);
  buildBrow(brows, 1, surfaceZ);
  buildMouth(head, surfaceZ);
  buildDetails(head, surfaceZ);
  buildEar(head, -1);
  buildEar(head, 1);

  let w = 1;
  let h = 1;
  let cx = 0;
  let cy = 0;
  let roomy = false;
  let rest = { x: -0.6, y: 0.1 }; // where he looks when idle: at the intro card
  let entry = reducedMotion ? 1 : 0;
  let exiting = -1;
  let gone = false;
  const gaze = { x: rest.x, y: rest.y };
  let pointer: { x: number; y: number; time: number } | null = null;
  let excited = 0;
  let excitedTarget = 0;
  let nextBlink = 1.5;
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
      // Beside the card.
      headPx = Math.min(Math.max(Math.min(h * 0.5, right * 0.64), 170), 520);
      cx = card.right + right * 0.5;
      cy = h * 0.46;
      rest = { x: -0.6, y: 0.1 };
    } else if (card.top >= 170) {
      // Above the card.
      headPx = Math.min(card.top * 0.72, w * 0.5, 320);
      cx = (card.left + card.right) / 2;
      cy = card.top * 0.5;
      rest = { x: 0, y: 0.7 };
    } else {
      roomy = false;
      return;
    }
    roomy = true;
    const dist = (h * HEAD_UNITS) / (headPx * 2 * Math.tan(THREE.MathUtils.degToRad(FOV / 2)));
    camera.position.set(0, 0, dist);
    camera.near = Math.max(0.5, dist - 2);
    camera.far = dist + 3;
    camera.aspect = w / h;
    // Shift the frustum rather than the head, so he faces the viewer wherever he sits.
    camera.setViewOffset(w, h, w / 2 - cx, h / 2 - cy, w, h);
    camera.updateProjectionMatrix();
  }

  function update(dt: number, t: number) {
    if (gone || !roomy) return;
    const k = (rate: number) => 1 - Math.exp(-rate * dt);

    // Rise in with the intro card; drop out when the ride starts.
    let y = 0;
    let spin = 0;
    if (exiting >= 0) {
      exiting += dt / 0.7;
      const e = Math.min(1, exiting) ** 3;
      y = -2.4 * e;
      spin = 0.6 * e;
      if (exiting >= 1) gone = true;
    } else if (entry < 1) {
      entry = Math.min(1, entry + dt / 1.1);
      y = -1.8 * (1 - entry) ** 3;
    }
    root.position.y = y;
    root.rotation.x = spin;
    float.position.y = reducedMotion ? 0 : Math.sin(t * 1.3) * 0.014;

    // Follow the mouse; when it rests, glance back at the card and look around a little.
    let tx = rest.x;
    let ty = rest.y;
    if (pointer && performance.now() - pointer.time < 3500) {
      tx = Math.max(-1, Math.min(1, (pointer.x - cx) / (w * 0.4)));
      ty = Math.max(-1, Math.min(1, (pointer.y - cy) / (h * 0.5)));
    } else if (!reducedMotion) {
      tx += Math.sin(t * 0.37) * 0.15;
      ty += Math.sin(t * 0.53) * 0.06;
    }
    gaze.x += (tx - gaze.x) * k(4);
    gaze.y += (ty - gaze.y) * k(4);
    head.rotation.set(gaze.y * 0.3, gaze.x * 0.6, -gaze.x * 0.05 + (reducedMotion ? 0 : Math.sin(t * 0.8) * 0.02));
    for (const eye of eyes) eye.iris.position.set(eye.irisBase.x + gaze.x * 0.01, eye.irisBase.y - gaze.y * 0.006, eye.irisBase.z);

    // Brows up and eyes wider when you're about to press play.
    excited += (excitedTarget - excited) * k(8);
    brows.position.y = excited * 0.016;

    // Blink every few seconds, sometimes twice.
    if (t >= nextBlink && blinkStart < 0) blinkStart = t;
    let close = 0;
    if (blinkStart >= 0) {
      const p = (t - blinkStart) / 0.15;
      if (p >= 1) {
        blinkStart = -1;
        nextBlink = t + (Math.random() < 0.2 ? 0.25 : 2 + Math.random() * 3.5);
      } else close = Math.sin(Math.PI * p);
    }
    const open = -0.55 - excited * 0.3;
    for (const eye of eyes) eye.lid.rotation.x = open + (0.6 - open) * close;
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

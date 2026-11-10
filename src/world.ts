import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export interface Collider {
  x: number;
  z: number;
  r: number;
}

/** Radius of the trail ring the stations sit on. */
export const RING_RADIUS = 15;
/** How far from the centre the bike may ride (the fence sits just outside). */
export const PLAY_RADIUS = 25;
export const STATION_COUNT = 8;
export const FOG_COLOR = '#eaa37c';
/** Campfire sits off to one side of the plaza so it doesn't block the starting view. */
const FIRE = { x: -2.4, z: -1.6 };

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Small deterministic PRNG so the valley looks the same on every visit. */
export function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function heightAt(x: number, z: number) {
  const r = Math.hypot(x, z);
  const n =
    Math.sin(x * 0.045) * Math.cos(z * 0.05) + Math.sin((x + z) * 0.021 + 1.7) * 0.8 + Math.sin(z * 0.11 + x * 0.03) * 0.3;
  return smooth(30, 75, r) * (5 + n * 2.4) + smooth(80, 190, r) * 10;
}

const std = (color: THREE.ColorRepresentation, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9, ...extra });

export function createWorld(scene: THREE.Scene) {
  const rand = rng(7);
  const updaters: ((t: number) => void)[] = [];

  // --- Sky: dusk gradient, a sun low in the west, first stars overhead ----------
  // The sun sets through a pass in the Rockies; everything that glows takes its cue from here.
  const sunDir = new THREE.Vector3(-1, 0.13, 0.15).normalize();
  const sunColor = new THREE.Color('#ffb066');
  const time = { value: 0 };
  updaters.push((t) => (time.value = t));
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(600, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color('#1d2757') },
        mid: { value: new THREE.Color('#e7896b') },
        bottom: { value: new THREE.Color('#f9c98f') },
        sunDir: { value: sunDir },
        sunColor: { value: sunColor },
        time,
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 top; uniform vec3 mid; uniform vec3 bottom;
        uniform vec3 sunDir; uniform vec3 sunColor; uniform float time;
        varying vec3 vDir;
        float hash(vec3 p) {
          p = fract(p * 0.3183099 + 0.1);
          p *= 17.0;
          return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
        }
        void main() {
          vec3 d = normalize(vDir);
          float h = d.y;
          vec3 c = mix(bottom, mid, smoothstep(-0.02, 0.14, h));
          c = mix(c, top, smoothstep(0.14, 0.62, h));

          // Warm scatter around the sun, a tight corona, then the disc itself (HDR so it blooms).
          float s = max(dot(d, sunDir), 0.0);
          c += sunColor * (0.3 * pow(s, 5.0) + 0.55 * pow(s, 48.0));
          c = mix(c, vec3(4.6, 3.5, 2.0), smoothstep(0.99885, 0.9992, s));

          // Stars fade in where the sky has gone dark.
          vec3 cell = d * 190.0;
          float n = hash(floor(cell));
          float star = step(0.9965, n) * (1.0 - smoothstep(0.0, 0.42, length(fract(cell) - 0.5)));
          star *= smoothstep(0.16, 0.5, h) * (0.55 + 0.45 * sin(time * 1.7 + n * 400.0));
          c += vec3(1.0, 0.95, 0.85) * star * 1.6;

          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }),
  );
  scene.add(sky);

  // --- Terrain ---------------------------------------------------------------
  let ground: THREE.BufferGeometry = new THREE.PlaneGeometry(460, 460, 115, 115);
  ground.rotateX(-Math.PI / 2);
  const gp = ground.attributes.position;
  for (let i = 0; i < gp.count; i++) {
    const x = gp.getX(i) + (rand() - 0.5) * 1.2;
    const z = gp.getZ(i) + (rand() - 0.5) * 1.2;
    gp.setXYZ(i, x, heightAt(x, z), z);
  }
  ground = ground.toNonIndexed();
  const pos = ground.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const grassNear = new THREE.Color('#93b05c');
  const grassFar = new THREE.Color('#58773f');
  const dry = new THREE.Color('#c2ae68');
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i += 3) {
    const cx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
    const cz = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
    const r = Math.hypot(cx, cz);
    c.copy(grassNear).lerp(grassFar, smooth(24, 130, r)).lerp(dry, rand() * 0.28);
    c.multiplyScalar(0.92 + rand() * 0.14);
    for (let k = 0; k < 3; k++) c.toArray(colors, (i + k) * 3);
  }
  ground.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  ground.computeVertexNormals();
  const groundMesh = new THREE.Mesh(ground, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }));
  groundMesh.receiveShadow = true;
  scene.add(groundMesh);

  // --- Trail: ring, central plaza and spokes to every station -------------------
  const dirt = std('#c9a074', { roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 });
  const ring = new THREE.Mesh(new THREE.RingGeometry(RING_RADIUS - 1.3, RING_RADIUS + 1.3, 120), dirt);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(4.6, 48), dirt);
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.y = 0.02;
  ring.receiveShadow = plaza.receiveShadow = true;
  scene.add(ring, plaza);
  const spokeGeo = new THREE.PlaneGeometry(1.5, RING_RADIUS - 5).rotateX(-Math.PI / 2);
  for (let i = 0; i < STATION_COUNT; i++) {
    const a = (i / STATION_COUNT) * Math.PI * 2;
    const spoke = new THREE.Mesh(spokeGeo, dirt);
    const mid = (RING_RADIUS + 4) / 2;
    spoke.position.set(Math.sin(a) * mid, 0.015, Math.cos(a) * mid);
    spoke.rotation.y = a;
    spoke.receiveShadow = true;
    scene.add(spoke);
  }

  // --- Fence marking the edge of the ride area --------------------------------
  const fenceR = PLAY_RADIUS + 1.3;
  const wood = std('#7a5636');
  const postCount = 100;
  const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 1.15, 0.16), wood, postCount);
  const m = new THREE.Matrix4();
  for (let i = 0; i < postCount; i++) {
    const a = (i / postCount) * Math.PI * 2;
    m.makeRotationY(a).setPosition(Math.sin(a) * fenceR, 0.575, Math.cos(a) * fenceR);
    posts.setMatrixAt(i, m);
  }
  posts.castShadow = true;
  scene.add(posts);
  for (const y of [0.5, 0.95]) {
    const rail = new THREE.Mesh(new THREE.TorusGeometry(fenceR, 0.05, 4, 200), wood);
    rail.rotation.x = Math.PI / 2;
    rail.position.y = y;
    scene.add(rail);
  }

  // --- Pine forest -----------------------------------------------------------
  const foliageGeo = mergeGeometries([
    new THREE.ConeGeometry(1.45, 2.2, 7).translate(0, 2.0, 0),
    new THREE.ConeGeometry(1.1, 1.9, 7).translate(0, 3.0, 0),
    new THREE.ConeGeometry(0.72, 1.6, 7).translate(0, 3.95, 0),
  ]);
  const trunkGeo = new THREE.CylinderGeometry(0.17, 0.26, 1.4, 6).translate(0, 0.7, 0);
  const treeCount = 300;
  const foliage = new THREE.InstancedMesh(foliageGeo, std('#ffffff'), treeCount);
  const trunks = new THREE.InstancedMesh(trunkGeo, std('#6b4a2f'), treeCount);
  const pines = ['#2f5d3a', '#3a6b40', '#25503a', '#4a7a44', '#355f34'].map((h) => new THREE.Color(h));
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  for (let i = 0; i < treeCount; i++) {
    const r = 29.5 + Math.pow(rand(), 1.7) * 85;
    const a = rand() * Math.PI * 2;
    p.set(Math.sin(a) * r, 0, Math.cos(a) * r);
    p.y = heightAt(p.x, p.z) - 0.1;
    const sc = 0.8 + rand() * 1.15;
    q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, rand() * Math.PI);
    s.set(sc, sc * (0.85 + rand() * 0.45), sc);
    m.compose(p, q, s);
    foliage.setMatrixAt(i, m);
    trunks.setMatrixAt(i, m);
    foliage.setColorAt(i, pines[Math.floor(rand() * pines.length)]);
  }
  foliage.castShadow = trunks.castShadow = true;
  scene.add(foliage, trunks);

  // Boulders scattered among the trees.
  const rockCount = 50;
  const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), std('#8a8478'), rockCount);
  for (let i = 0; i < rockCount; i++) {
    const r = 28 + rand() * 50;
    const a = rand() * Math.PI * 2;
    p.set(Math.sin(a) * r, 0, Math.cos(a) * r);
    p.y = heightAt(p.x, p.z);
    const sc = 0.4 + rand() * 1.2;
    q.setFromEuler(new THREE.Euler(rand() * 3, rand() * 3, rand() * 3));
    s.set(sc * 1.3, sc * 0.8, sc);
    rocks.setMatrixAt(i, m.compose(p, q, s));
  }
  rocks.castShadow = true;
  scene.add(rocks);

  // Grass tufts and wildflowers inside the ride area, kept clear of stations.
  const nearStation = (x: number, z: number) => {
    for (let k = 0; k < STATION_COUNT; k++) {
      const a = (k / STATION_COUNT) * Math.PI * 2;
      const sx = Math.sin(a);
      const sz = Math.cos(a);
      if (Math.hypot(x - sx * RING_RADIUS, z - sz * RING_RADIUS) < 3.2) return true;
      if (Math.hypot(x - sx * (RING_RADIUS + 3.8), z - sz * (RING_RADIUS + 3.8)) < 4.2) return true;
    }
    return false;
  };
  const tuftCount = 420;
  const tufts = new THREE.InstancedMesh(new THREE.ConeGeometry(0.1, 0.42, 4).translate(0, 0.2, 0), std('#ffffff'), tuftCount);
  const tuftColors = ['#6f9a46', '#86a94f', '#a4b85a', '#e7d36a', '#f3f0e6', '#c58bd6'].map((h) => new THREE.Color(h));
  for (let i = 0; i < tuftCount; i++) {
    let x = 0;
    let z = 0;
    for (let tries = 0; tries < 10; tries++) {
      const r = 5 + rand() * 20;
      const a = rand() * Math.PI * 2;
      x = Math.sin(a) * r;
      z = Math.cos(a) * r;
      const onRing = Math.abs(r - RING_RADIUS) < 1.6;
      if (!onRing && !nearStation(x, z)) break;
    }
    p.set(x, 0, z);
    const sc = 0.7 + rand() * 0.9;
    q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, rand() * 3);
    s.set(sc, sc, sc);
    tufts.setMatrixAt(i, m.compose(p, q, s));
    tufts.setColorAt(i, tuftColors[rand() < 0.75 ? Math.floor(rand() * 3) : 3 + Math.floor(rand() * 3)]);
  }
  scene.add(tufts);

  // --- The Rockies to the west, foothills all around ---------------------------
  // One merged mesh with its own shader: scene fog would flatten peaks this far away into
  // a single brown wall, so they get aerial perspective instead (haze at the foot, alpenglow
  // on the faces that catch the light, snow up high).
  const sunAz = Math.atan2(sunDir.z, sunDir.x);
  const peaks: THREE.BufferGeometry[] = [];
  const addMountain = (a: number, d: number, h: number, r: number, kind: number) => {
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    const base = heightAt(x, z) - 3;
    const g = new THREE.ConeGeometry(r, h, 11, 5, true);
    const mp = g.attributes.position;
    const p1 = rand() * 6.28;
    const p2 = rand() * 6.28;
    const p3 = rand() * 6.28;
    const leanX = (rand() - 0.5) * r * 0.4;
    const leanZ = (rand() - 0.5) * r * 0.4;
    const aT = new Float32Array(mp.count);
    const aKind = new Float32Array(mp.count).fill(kind);
    for (let i = 0; i < mp.count; i++) {
      const px = mp.getX(i);
      const pz = mp.getZ(i);
      const t = mp.getY(i) / h + 0.5;
      // Periodic in the angle so the seam stays closed; gives each peak ridges and gullies.
      const th = Math.atan2(pz, px);
      const k = 1 + Math.sin(th * 3 + p1) * 0.2 + Math.sin(th * 5 + p2) * 0.11 + Math.sin(th * 2 + t * 5 + p3) * 0.1;
      mp.setXYZ(i, x + px * k + leanX * t * t, base + t * h, z + pz * k + leanZ * t * t);
      aT[i] = t;
    }
    g.deleteAttribute('normal');
    g.deleteAttribute('uv');
    g.setAttribute('aT', new THREE.BufferAttribute(aT, 1));
    g.setAttribute('aKind', new THREE.BufferAttribute(aKind, 1));
    // Un-indexed so every facet gets its own normal: hard low-poly faces.
    const flat = g.toNonIndexed();
    flat.computeVertexNormals();
    peaks.push(flat);
  };
  for (let i = 0; i < 30; i++) {
    const off = (rand() - 0.5) * 2.4;
    // Leave a pass where the sun goes down: peaks near it sit further back and lower.
    const open = smooth(0.12, 0.6, Math.abs(off));
    const d = Math.abs(off) < 0.5 ? 215 + rand() * 40 : 150 + rand() * 80;
    addMountain(sunAz + off, d, (18 + rand() * 24) * (0.3 + 0.7 * open), 22 + rand() * 22, 1);
  }
  for (let i = 0; i < 18; i++) {
    addMountain(rand() * Math.PI * 2, 150 + rand() * 60, 14 + rand() * 16, 24 + rand() * 18, 0);
  }
  const mountains = new THREE.Mesh(
    mergeGeometries(peaks),
    new THREE.ShaderMaterial({
      uniforms: {
        sunDir: { value: sunDir },
        sunColor: { value: sunColor },
        haze: { value: new THREE.Color(FOG_COLOR) },
        rockLit: { value: new THREE.Color('#d98576') },
        rockShade: { value: new THREE.Color('#444677') },
        hillLit: { value: new THREE.Color('#9a9a5c') },
        hillShade: { value: new THREE.Color('#3c5458') },
        snowLit: { value: new THREE.Color('#ffe3d2') },
        snowShade: { value: new THREE.Color('#9499d6') },
      },
      vertexShader: /* glsl */ `
        attribute float aT; attribute float aKind;
        varying vec3 vW; varying vec3 vN; varying float vT; varying float vKind;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vW = w.xyz; vN = normal; vT = aT; vKind = aKind;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 sunDir; uniform vec3 sunColor; uniform vec3 haze;
        uniform vec3 rockLit; uniform vec3 rockShade; uniform vec3 hillLit; uniform vec3 hillShade;
        uniform vec3 snowLit; uniform vec3 snowShade;
        varying vec3 vW; varying vec3 vN; varying float vT; varying float vKind;
        void main() {
          vec3 n = normalize(vN + vec3(0.0, 1e-4, 0.0));
          float lit = smoothstep(-0.2, 0.7, dot(n, normalize(vec3(-0.3, 0.55, 0.78))));
          vec3 c = mix(mix(hillShade, hillLit, lit), mix(rockShade, rockLit, lit), vKind);
          float line = vT + sin(vW.x * 0.21 + vW.y * 0.3) * 0.05 + sin(vW.z * 0.17) * 0.04;
          c = mix(c, mix(snowShade, snowLit, lit), vKind * smoothstep(0.5, 0.56, line));

          float dist = length(vW.xz - cameraPosition.xz);
          float hz = smoothstep(90.0, 340.0, dist) * 0.45 + (1.0 - smoothstep(2.0, 50.0, vW.y)) * 0.6;
          c = mix(c, haze, clamp(hz, 0.0, 0.92));
          vec3 v = normalize(vW - cameraPosition);
          c += sunColor * pow(max(dot(v, sunDir), 0.0), 9.0) * 0.45;

          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }),
  );
  scene.add(mountains);

  // --- A tiny Calgary skyline on the eastern horizon, lights coming on ------------
  const windows = document.createElement('canvas');
  windows.width = 16;
  windows.height = 64;
  const wctx = windows.getContext('2d')!;
  wctx.fillStyle = '#000';
  wctx.fillRect(0, 0, 16, 64);
  for (let y = 2; y < 62; y += 3)
    for (let x = 1; x < 15; x += 3) {
      if (rand() < 0.45) continue;
      wctx.fillStyle = rand() < 0.8 ? '#ffd9a0' : '#bfe3ff';
      wctx.fillRect(x, y, 2, 1);
    }
  const windowTex = new THREE.CanvasTexture(windows);
  windowTex.colorSpace = THREE.SRGBColorSpace;
  windowTex.magFilter = THREE.NearestFilter;
  const cityMat = std('#3f4670', { emissive: '#ffffff', emissiveMap: windowTex, emissiveIntensity: 2.2 });
  for (let i = 0; i < 18; i++) {
    const a = (rand() - 0.5) * 0.32;
    const d = 140 + rand() * 12;
    const h = 6 + Math.pow(rand(), 1.5) * 24;
    const w = 3 + rand() * 4;
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), cityMat);
    b.position.set(Math.cos(a) * d, heightAt(Math.cos(a) * d, Math.sin(a) * d) + h / 2 - 1, Math.sin(a) * d);
    scene.add(b);
  }
  const tower = new THREE.Group();
  const tx = 138;
  const towerMat = std('#3f4670');
  tower.add(new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.3, 34, 8).translate(0, 17, 0), towerMat));
  tower.add(new THREE.Mesh(new THREE.CylinderGeometry(3, 2.3, 2.6, 12).translate(0, 34.5, 0), std('#b5333f', { emissive: '#ff5a4a', emissiveIntensity: 0.6 })));
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff3b30', fog: false }));
  beacon.position.y = 37.5;
  tower.add(beacon);
  tower.position.set(tx, heightAt(tx, 6) - 1, 6);
  scene.add(tower);
  updaters.push((t) => (beacon.material.color.setRGB(1, 0.23, 0.19).multiplyScalar(Math.sin(t * 2.2) > 0.2 ? 5 : 0.4)));

  // --- Fireflies over the meadow ----------------------------------------------
  const flyCount = 150;
  const flyPos = new Float32Array(flyCount * 3);
  const flySeed = new Float32Array(flyCount);
  for (let i = 0; i < flyCount; i++) {
    const r = 4 + Math.pow(rand(), 0.7) * 44;
    const a = rand() * Math.PI * 2;
    const fx = Math.sin(a) * r;
    const fz = Math.cos(a) * r;
    flyPos.set([fx, heightAt(fx, fz) + 0.5 + rand() * 2.6, fz], i * 3);
    flySeed[i] = rand() * 100;
  }
  const flyGeo = new THREE.BufferGeometry();
  flyGeo.setAttribute('position', new THREE.BufferAttribute(flyPos, 3));
  flyGeo.setAttribute('seed', new THREE.BufferAttribute(flySeed, 1));
  const pointScale = { value: 400 };
  const fireflies = new THREE.Points(
    flyGeo,
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { time, pointScale },
      vertexShader: /* glsl */ `
        attribute float seed;
        uniform float time; uniform float pointScale;
        varying float vGlow;
        void main() {
          vec3 p = position;
          p.x += sin(time * 0.45 + seed) * 1.1 + sin(time * 1.3 + seed * 3.0) * 0.25;
          p.y += sin(time * 0.8 + seed * 2.0) * 0.4;
          p.z += cos(time * 0.38 + seed * 1.7) * 1.1;
          vGlow = smoothstep(0.1, 0.9, sin(time * 1.4 + seed * 5.0) * 0.5 + 0.5);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = pointScale * (0.1 + 0.08 * vGlow) / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying float vGlow;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float core = 1.0 - smoothstep(0.0, 0.5, d);
          gl_FragColor = vec4(vec3(1.0, 0.8, 0.3) * (0.5 + 1.5 * vGlow), core * core * (0.25 + 0.75 * vGlow));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }),
  );
  fireflies.frustumCulled = false;
  scene.add(fireflies);

  // --- A few birds wheeling in front of the sunset -----------------------------
  const flock = new THREE.Group();
  const wingGeo = new THREE.BufferGeometry();
  wingGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0.35, 0, 0, -0.35, 1.5, 0, -0.1]), 3));
  const birdMat = new THREE.MeshBasicMaterial({ color: '#2a2440', side: THREE.DoubleSide, fog: false });
  const birds = Array.from({ length: 7 }, (_, i) => {
    const bird = new THREE.Group();
    const wings = [1, -1].map((side) => {
      const w = new THREE.Mesh(wingGeo, birdMat);
      w.scale.x = side;
      bird.add(w);
      return w;
    });
    // Loose V formation, flying along the tangent of the flock's circle.
    const row = Math.ceil(i / 2);
    bird.position.set(78 + row * 2.4 * (i % 2 ? 1 : -1), 19 + rand() * 3, -row * 3.2);
    flock.add(bird);
    return { wings, phase: rand() * 6 };
  });
  scene.add(flock);
  updaters.push((t) => {
    flock.rotation.y = -sunAz + Math.sin(t * 0.05) * 1.1;
    for (const b of birds) {
      const flap = Math.sin(t * 5.5 + b.phase) * 0.55;
      b.wings[0].rotation.z = flap;
      b.wings[1].rotation.z = -flap;
    }
  });

  // --- Drifting low-poly clouds ---------------------------------------------
  const clouds = new THREE.Group();
  const cloudMat = new THREE.MeshStandardMaterial({ color: '#ffe9dc', emissive: '#f08f78', emissiveIntensity: 0.6, flatShading: true, fog: false });
  for (let i = 0; i < 11; i++) {
    const cloud = new THREE.Group();
    const puffs = 3 + Math.floor(rand() * 3);
    for (let k = 0; k < puffs; k++) {
      const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(5 + rand() * 5, 0), cloudMat);
      puff.position.set(k * 7 - puffs * 3.5, rand() * 3, (rand() - 0.5) * 6);
      puff.scale.y = 0.6;
      cloud.add(puff);
    }
    const a = rand() * Math.PI * 2;
    const d = 220 + rand() * 120;
    cloud.position.set(Math.cos(a) * d, 70 + rand() * 45, Math.sin(a) * d);
    cloud.lookAt(0, cloud.position.y, 0);
    clouds.add(cloud);
  }
  scene.add(clouds);
  updaters.push((t) => (clouds.rotation.y = t * 0.004));

  // --- Campfire in the plaza ---------------------------------------------------
  const fire = new THREE.Group();
  const stone = std('#8d8a83');
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 0), stone);
    st.position.set(Math.sin(a) * 0.75, 0.12, Math.cos(a) * 0.75);
    st.castShadow = true;
    fire.add(st);
  }
  const logMat = std('#5b3a22');
  for (let i = 0; i < 3; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.1, 6), logMat);
    log.rotation.set(Math.PI / 2 - 0.35, (i / 3) * Math.PI, 0);
    log.position.y = 0.25;
    log.castShadow = true;
    fire.add(log);
  }
  const flames = ['#ff6a1a', '#ffa41b', '#ffe08a'].map((col, i) => {
    const f = new THREE.Mesh(
      new THREE.ConeGeometry(0.42 - i * 0.11, 1.1 - i * 0.22, 6).translate(0, (1.1 - i * 0.22) / 2, 0),
      new THREE.MeshBasicMaterial({ color: col, toneMapped: false }),
    );
    f.position.y = 0.15;
    fire.add(f);
    return f;
  });
  const fireLight = new THREE.PointLight('#ff8a33', 30, 14, 2);
  fireLight.position.y = 1.3;
  fire.add(fireLight);
  fire.position.set(FIRE.x, 0, FIRE.z);
  scene.add(fire);
  updaters.push((t) => {
    flames.forEach((f, i) => {
      const k = 1 + Math.sin(t * (9 + i * 3) + i) * 0.12 + Math.sin(t * 23 + i * 2) * 0.05;
      f.scale.set(1, k, 1);
      f.rotation.y = t * (0.6 + i * 0.4);
    });
    fireLight.intensity = 26 + Math.sin(t * 13) * 4 + Math.sin(t * 31) * 2;
  });

  return {
    colliders: [{ ...FIRE, r: 1.0 }] as Collider[],
    /** Keeps point sprites the same apparent size at any canvas resolution. */
    setViewportHeight(px: number) {
      pointScale.value = px;
    },
    update(t: number) {
      for (const u of updaters) u(t);
    },
  };
}

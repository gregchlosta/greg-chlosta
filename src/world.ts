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

  // --- Sky -------------------------------------------------------------------
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(600, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color('#25305f') },
        mid: { value: new THREE.Color('#e7896b') },
        bottom: { value: new THREE.Color('#f9c98f') },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 top; uniform vec3 mid; uniform vec3 bottom;
        varying vec3 vDir;
        void main() {
          float h = vDir.y;
          vec3 c = mix(bottom, mid, smoothstep(-0.02, 0.14, h));
          c = mix(c, top, smoothstep(0.14, 0.65, h));
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }),
  );
  scene.add(sky);

  // Setting sun in the west, behind the Rockies.
  const sunDir = new THREE.Vector3(-1, 0.13, 0.15).normalize();
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(22, 40),
    new THREE.MeshBasicMaterial({ color: '#fff3d1', fog: false, toneMapped: false }),
  );
  sun.position.copy(sunDir).multiplyScalar(480);
  sun.lookAt(0, 0, 0);
  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(60, 40),
    new THREE.MeshBasicMaterial({ color: '#ffd59a', fog: false, transparent: true, opacity: 0.28, depthWrite: false }),
  );
  halo.position.copy(sunDir).multiplyScalar(485);
  halo.lookAt(0, 0, 0);
  scene.add(sun, halo);

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
  const rockMat = std('#66708c');
  const rockMatDark = std('#545d78');
  const snowMat = std('#f4f1ec', { roughness: 0.7 });
  const addMountain = (a: number, d: number, h: number, r: number, snow: boolean) => {
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    const seg = 5 + Math.floor(rand() * 3);
    const base = heightAt(x, z) - 3;
    const mtn = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), rand() < 0.5 ? rockMat : rockMatDark);
    mtn.position.set(x, base + h / 2, z);
    mtn.rotation.y = rand() * Math.PI;
    scene.add(mtn);
    if (snow) {
      const k = 0.3 + rand() * 0.08;
      const cap = new THREE.Mesh(new THREE.ConeGeometry(r * k * 1.03, h * k, seg), snowMat);
      cap.position.set(x, base + h - (h * k) / 2 + 0.05, z);
      cap.rotation.y = mtn.rotation.y;
      scene.add(cap);
    }
  };
  for (let i = 0; i < 30; i++) {
    addMountain(Math.PI + (rand() - 0.5) * 2.4, 125 + rand() * 80, 45 + rand() * 50, 22 + rand() * 22, true);
  }
  for (let i = 0; i < 18; i++) {
    addMountain(rand() * Math.PI * 2, 150 + rand() * 60, 14 + rand() * 16, 24 + rand() * 18, false);
  }

  // --- A tiny Calgary skyline on the eastern horizon ---------------------------
  const cityMat = std('#4b5372');
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
  tower.add(new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.3, 34, 8).translate(0, 17, 0), cityMat));
  tower.add(new THREE.Mesh(new THREE.CylinderGeometry(3, 2.3, 2.6, 12).translate(0, 34.5, 0), cityMat));
  tower.position.set(tx, heightAt(tx, 6) - 1, 6);
  scene.add(tower);

  // --- Drifting low-poly clouds ---------------------------------------------
  const clouds = new THREE.Group();
  const cloudMat = new THREE.MeshStandardMaterial({ color: '#ffe3cf', emissive: '#d98a76', emissiveIntensity: 0.35, flatShading: true, fog: false });
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
    update(t: number) {
      for (const u of updaters) u(t);
    },
  };
}

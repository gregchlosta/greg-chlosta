import './style.css';
import * as THREE from 'three';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { stations, type Station } from './content';
import { Particles } from './effects';
import { Input } from './input';
import { buildMotorbike, buildStationProp, type Prop } from './models';
import { Rider, type DriveInput } from './rider';
import { UI } from './ui';
import { clamp, createWorld, FOG_COLOR, PLAY_RADIUS, RING_RADIUS, type Collider } from './world';

const ui = new UI(document.getElementById('ui')!);

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

if (hasWebGL()) startValley();
else {
  document.body.classList.add('no-webgl');
  ui.showClassic(false);
}

interface StationRT {
  data: Station;
  pad: THREE.Vector3;
  prop: Prop;
  ringMat: THREE.MeshBasicMaterial;
  beam: THREE.ShaderMaterial;
  marker: THREE.Mesh;
  label: HTMLElement;
  hit: THREE.Mesh;
  discovered: boolean;
}

const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

function beamMaterial(color: THREE.Color) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { color: { value: color }, opacity: { value: 0.55 }, time: { value: 0 } },
    vertexShader: /* glsl */ `
      varying float vY;
      void main() {
        vY = uv.y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 color; uniform float opacity; uniform float time;
      varying float vY;
      void main() {
        float fade = pow(1.0 - vY, 2.2);
        float shimmer = 0.75 + 0.25 * sin(time * 2.4 - vY * 9.0);
        gl_FragColor = vec4(color, fade * opacity * shimmer);
        #include <colorspace_fragment>
      }`,
  });
}

function startValley() {
  const app = document.getElementById('app')!;
  const canvas = document.getElementById('scene') as HTMLCanvasElement;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const labels = new CSS2DRenderer();
  labels.domElement.className = 'labels';
  app.insertBefore(labels.domElement, document.getElementById('ui'));

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(FOG_COLOR, 55, 250);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 1400);
  const world = createWorld(scene);
  const colliders: Collider[] = [...world.colliders];

  scene.add(new THREE.HemisphereLight('#ffe2c4', '#4a5a34', 1.15));
  const sun = new THREE.DirectionalLight('#ffd3a1', 2.8);
  sun.position.set(-38, 30, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, near: 1, far: 120 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);

  // --- Stations ----------------------------------------------------------------
  const contactIndex = stations.findIndex((s) => s.id === 'contact');
  const rts: StationRT[] = stations.map((data, i) => {
    const angle = (i / stations.length) * Math.PI * 2;
    const dir = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
    const pad = dir.clone().multiplyScalar(RING_RADIUS);
    const color = new THREE.Color(data.color);

    const padMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(2.1, 2.25, 0.14, 40),
      new THREE.MeshStandardMaterial({ color: '#3a3530', roughness: 0.95, flatShading: true }),
    );
    padMesh.position.copy(pad).setY(0.07);
    padMesh.receiveShadow = true;
    const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, toneMapped: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.65, 1.95, 48), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(pad).setY(0.15);
    const beam = beamMaterial(color);
    const beamMesh = new THREE.Mesh(new THREE.CylinderGeometry(1.85, 1.85, 7, 40, 1, true), beam);
    beamMesh.position.copy(pad).setY(3.5);
    scene.add(padMesh, ring, beamMesh);

    const prop = buildStationProp(data.id);
    prop.group.position.copy(dir).multiplyScalar(RING_RADIUS + 3.8);
    prop.group.rotation.y = angle + Math.PI;
    scene.add(prop.group);
    for (const c of prop.colliders) {
      const p = new THREE.Vector3(c.x, 0, c.z).applyEuler(prop.group.rotation).add(prop.group.position);
      colliders.push({ x: p.x, z: p.z, r: c.r });
    }

    const marker = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.3),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.5, flatShading: true }),
    );
    marker.position.copy(pad).setY(3.1);
    scene.add(marker);

    const label = document.createElement('button');
    label.className = 'world-label';
    label.style.setProperty('--c', data.color);
    label.innerHTML = `<span class="wl-dot"></span>${data.label}`;
    label.addEventListener('click', () => {
      if (state === 'play') travel(i);
      label.blur();
    });
    const labelObj = new CSS2DObject(label);
    labelObj.position.copy(pad).setY(3.9);
    scene.add(labelObj);

    const hit = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 5, 12), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.copy(dir).multiplyScalar(RING_RADIUS + 2).setY(2.5);
    hit.userData.index = i;
    scene.add(hit);

    return { data, pad, prop, ringMat, beam, marker, label, hit, discovered: false };
  });
  const hitMeshes = rts.map((r) => r.hit);

  // --- Player --------------------------------------------------------------------
  const bike = buildMotorbike({ body: '#f97316', accent: '#1e293b', rider: true });
  scene.add(bike.root);
  const rider = new Rider(new THREE.Vector3(0, 0, 3.2), 0);
  const input = new Input();
  const particles = new Particles(scene);

  const targetRing = new THREE.Mesh(
    new THREE.RingGeometry(0.45, 0.65, 32),
    new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, toneMapped: false, depthWrite: false }),
  );
  targetRing.rotation.x = -Math.PI / 2;
  targetRing.visible = false;
  scene.add(targetRing);

  // --- Game state ----------------------------------------------------------------
  let state: 'intro' | 'play' = 'intro';
  let autopilot: { target: THREE.Vector3; station: number | null; time: number } | null = null;
  let openIndex: number | null = null;
  let openManual = false;
  let nearIndex: number | null = null;
  let suppressIndex: number | null = null;
  let rideTime = 0;
  let dustTimer = 0;

  function travel(i: number) {
    if (openIndex !== null) {
      ui.closeCard();
      openIndex = null;
    }
    suppressIndex = nearIndex;
    autopilot = { target: rts[i].pad.clone(), station: i, time: 0 };
    targetRing.visible = false;
  }

  function driveTo(p: THREE.Vector3) {
    const r = Math.hypot(p.x, p.z);
    if (r > PLAY_RADIUS - 1) p.multiplyScalar((PLAY_RADIUS - 1) / r);
    autopilot = { target: p.setY(0), station: null, time: 0 };
    targetRing.position.copy(p).setY(0.06);
    targetRing.visible = true;
  }

  function nextStop(from: number) {
    for (let k = 1; k <= rts.length; k++) {
      const j = (from + k) % rts.length;
      if (!rts[j].discovered) return j;
    }
    return from === contactIndex ? null : contactIndex;
  }

  function openStation(i: number, manual: boolean) {
    const st = rts[i];
    openIndex = i;
    openManual = manual;
    if (!st.discovered) {
      st.discovered = true;
      st.label.classList.add('done');
      particles.emit(st.pad.clone().setY(1), st.data.color, 50, { speed: 6, up: 9, gravity: 14, life: 1.3, size: 0.13 });
      ui.setProgress(rts.map((r) => r.discovered));
      if (rts.every((r) => r.discovered)) {
        setTimeout(() => {
          ui.confetti();
          ui.toast(`<strong>You've seen it all!</strong> Thanks for riding. <button class="toast-btn" data-action="contact">Get in touch</button>`, 8000);
        }, 700);
      }
    }
    const n = nextStop(i);
    ui.openCard(st.data, i, {
      discovered: rts.filter((r) => r.discovered).length,
      next: n === null ? null : { index: n, label: rts[n].data.label },
    });
  }

  function closeCard() {
    if (openIndex !== null && openIndex === nearIndex) suppressIndex = openIndex;
    openIndex = null;
    ui.closeCard();
  }

  ui.handlers = {
    start() {
      state = 'play';
      ui.hideIntro();
    },
    travel,
    closeCard,
    openContact: () => openStation(contactIndex, true),
    hop: () => input.queueJump(),
    classicChanged(open) {
      input.enabled = !open;
      last = performance.now();
    },
  };

  // --- Click / tap to ride --------------------------------------------------------
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  let down = { x: 0, y: 0, t: 0 };
  canvas.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY, t: performance.now() }));
  canvas.addEventListener('pointerup', (e) => {
    if (state !== 'play') return;
    if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 10 || performance.now() - down.t > 600) return;
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(hitMeshes, false)[0];
    if (hit) return travel(hit.object.userData.index as number);
    const p = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(groundPlane, p)) driveTo(p);
  });

  // --- Per-frame logic ----------------------------------------------------------
  function readDrive(dt: number): DriveInput {
    const jump = input.consumeJump();
    if (input.throttle || input.steer) {
      autopilot = null;
      targetRing.visible = false;
      return { throttle: input.throttle, steer: input.steer, jump };
    }
    if (!autopilot) return { throttle: 0, steer: 0, jump };

    autopilot.time += dt;
    const dx = autopilot.target.x - rider.pos.x;
    const dz = autopilot.target.z - rider.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.7 || autopilot.time > 15) {
      autopilot = null;
      targetRing.visible = false;
      rider.speed *= 0.4;
      return { throttle: 0, steer: 0, jump };
    }
    const diff = wrapAngle(Math.atan2(dx, dz) - rider.heading);
    const targetSpeed = Math.min(rider.maxSpeed, dist * 2.2 + 1) * (Math.abs(diff) > 1.2 ? 0.35 : 1);
    return { throttle: rider.speed < targetSpeed ? 1 : -0.6, steer: clamp(-diff * 2.5, -1, 1), jump };
  }

  function poseBike(dt: number) {
    bike.root.position.set(rider.pos.x, rider.y, rider.pos.z);
    bike.root.rotation.y = rider.heading;
    const sp = clamp(Math.abs(rider.speed) / rider.maxSpeed, 0, 1);
    const leanTarget = rider.steerSmooth * (0.1 + sp) * 0.45 * (rider.speed < 0 ? -1 : 1);
    const pitchTarget = rider.grounded ? 0 : clamp(-rider.vy * 0.03, -0.25, 0.2);
    const k = Math.min(1, dt * 7);
    bike.lean.rotation.z += (leanTarget - bike.lean.rotation.z) * k;
    bike.lean.rotation.x += (pitchTarget - bike.lean.rotation.x) * k;
    bike.lean.scale.y = 1 - rider.landing * 0.08;
    for (const w of bike.wheels) w.rotation.x += (rider.speed / 0.54) * dt;
  }

  function checkStations() {
    nearIndex = null;
    for (let i = 0; i < rts.length; i++) {
      const d = Math.hypot(rider.pos.x - rts[i].pad.x, rider.pos.z - rts[i].pad.z);
      if (d < 2.0 && rider.grounded) nearIndex = i;
      if (i === openIndex && !openManual && d > 4.5) closeCard();
    }
    if (suppressIndex !== null && nearIndex !== suppressIndex) suppressIndex = null;
    if (nearIndex !== null && nearIndex !== openIndex && nearIndex !== suppressIndex) {
      // Only stop the autopilot here if this is where it was headed.
      if (!autopilot || autopilot.station === nearIndex) {
        if (autopilot) rider.speed *= 0.4;
        autopilot = null;
        openStation(nearIndex, false);
      }
    }
  }

  const camPos = new THREE.Vector3(30, 16, 30);
  const camLook = new THREE.Vector3();
  const wantPos = new THREE.Vector3();
  const wantLook = new THREE.Vector3();
  function updateCamera(dt: number, t: number) {
    let k = 1.5;
    if (state === 'intro') {
      const a = t * 0.06 + 0.5;
      wantPos.set(Math.sin(a) * 33, 15, Math.cos(a) * 33);
      wantLook.set(0, 1, 0);
    } else {
      const portrait = camera.aspect < 0.8;
      const back = portrait ? 12.5 : 8.8;
      const up = portrait ? 7.2 : 4.8;
      const fx = Math.sin(rider.heading);
      const fz = Math.cos(rider.heading);
      wantPos.set(rider.pos.x - fx * back, up + rider.y * 0.4, rider.pos.z - fz * back);
      const r = Math.hypot(wantPos.x, wantPos.z);
      if (r > 29) wantPos.multiplyScalar(29 / r).setY(up);
      wantLook.set(rider.pos.x + fx * 2.5, 1 + rider.y * 0.5, rider.pos.z + fz * 2.5);
      k = 3;
    }
    const f = 1 - Math.exp(-k * dt);
    camPos.lerp(wantPos, f);
    camLook.lerp(wantLook, Math.min(1, f * 1.6));
    camera.position.copy(camPos);
    camera.lookAt(camLook);
  }

  const rearWheel = new THREE.Vector3();
  function step(dt: number, t: number) {
    const drive = state === 'play' && !ui.classicOpen ? readDrive(dt) : { throttle: 0, steer: 0, jump: false };
    rider.update(dt, drive, colliders, PLAY_RADIUS);
    poseBike(dt);

    if (state === 'play') {
      checkStations();
      if (Math.abs(rider.speed) > 2) rideTime += dt;
      if (rideTime > 2.5) ui.hideHint();
    }

    // Dust from the rear wheel, plus a puff on landing.
    if (rider.grounded && Math.abs(rider.speed) > 4) {
      dustTimer += dt;
      if (dustTimer > 0.035) {
        dustTimer = 0;
        rearWheel.set(0, 0.15, -0.95);
        bike.root.localToWorld(rearWheel);
        particles.emit(rearWheel, '#d9bf98', 1, { speed: 0.8, up: 1.2, gravity: -0.6, life: 0.8, size: 0.13, drag: 1.5 });
      }
    }
    if (rider.landing > 0.95) particles.emit(rider.pos.clone().setY(0.1), '#d9bf98', 14, { speed: 3, up: 1.5, gravity: 2, life: 0.6, size: 0.14, drag: 2 });

    targetRing.scale.setScalar(1 + Math.sin(t * 6) * 0.12);
    for (const st of rts) {
      st.prop.update?.(t);
      st.marker.rotation.y = t * 1.6;
      st.marker.position.y = 3.1 + Math.sin(t * 2 + st.pad.x) * 0.15;
      st.beam.uniforms.time.value = t;
      const targetOpacity = st.discovered ? 0 : 0.55;
      st.beam.uniforms.opacity.value += (targetOpacity - st.beam.uniforms.opacity.value) * Math.min(1, dt * 2);
      st.ringMat.opacity = st.discovered ? 0.45 : 0.65 + Math.sin(t * 3) * 0.3;
      const d = camera.position.distanceTo(st.pad);
      st.label.style.opacity = String(clamp(1.4 - (d - 14) / 26, 0.4, 1).toFixed(2));
    }
    world.update(t);
    particles.update(dt);
    updateCamera(dt, t);
  }

  function resize() {
    const w = innerWidth;
    const h = innerHeight;
    renderer.setSize(w, h, false);
    labels.setSize(w, h);
    camera.aspect = w / h;
    camera.fov = camera.aspect < 0.8 ? 62 : 55;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);
  resize();

  let last = performance.now();
  let elapsed = 0;
  renderer.setAnimationLoop(() => {
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (ui.classicOpen) return;
    elapsed += dt;
    step(dt, elapsed);
    renderer.render(scene, camera);
    labels.render(scene, camera);
  });
  document.body.classList.add('ready');
  ui.focusStart();
}

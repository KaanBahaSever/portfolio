/**
 * The gravity simulator's 3D view (browser only): a three.js scene with lit spheres for the
 * bodies, fading trails, a faint ecliptic grid and a starfield, and OrbitControls for the camera.
 * It draws what the simulation says and answers questions about the screen (which body is under
 * the pointer, where the pointer meets the plane); it never changes the simulation.
 *
 * Units: one scene unit is 1,000 km (UNIT metres), so the Earth–Moon distance is 384 units and
 * float32 keeps every position exact enough. The physics plane z = 0 is the scene's x–y plane,
 * with z up.
 *
 * Sizes are not to scale. A body is drawn with its real radius or with a minimum on-screen size
 * that grows with its mass (pixelRadius), whichever is larger, so the Moon stays visible at the
 * Earth–Moon distance and every body shrinks to its true size when you zoom in close enough.
 *
 * Every body has its own material, trail geometry and label; they are disposed of when the body
 * goes. The sphere geometry is shared by all bodies (each mesh is scaled) and lives as long as
 * the page.
 */
import {
  AmbientLight,
  ArrowHelper,
  BufferAttribute,
  BufferGeometry,
  Color,
  DirectionalLight,
  GridHelper,
  Line,
  LineBasicMaterial,
  LineDashedMaterial,
  LineLoop,
  MOUSE,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Plane,
  Points,
  PointsMaterial,
  Raycaster,
  Scene,
  SphereGeometry,
  TOUCH,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EARTH_MASS, bodyRadius, type Body, type BodyKind } from '../../../lib/physics/gravity.ts';

/** Metres per scene unit. */
export const UNIT = 1e6;
const TRAIL_POINTS = 720;
const BACKGROUND = 0x05070d;
const FOV = 45;
/** Polar angle of the starting view, from straight above. */
const TILT = (28 * Math.PI) / 180;

const KIND_COLORS: Record<Exclude<BodyKind, 'custom'>, string> = {
  earth: '#3f9fbf',
  moon: '#b9b6ad',
  mars: '#c8714f',
  jupiter: '#d6a874',
  asteroid: '#9a8f80',
  satellite: '#d8dde3',
};
/** Bodies of custom mass take these in turn. */
const PALETTE = ['#e2a855', '#9b8fd9', '#6fbf8a', '#e07f7f', '#7fb3e0'];
const ACCENT = '#4fd1b5';

export function bodyColor(body: Pick<Body, 'kind' | 'id'>): string {
  return body.kind === 'custom' ? PALETTE[(body.id - 1) % PALETTE.length]! : KIND_COLORS[body.kind];
}

/** Smallest on-screen radius in CSS pixels: 7.5 px for the Earth, 3.7 for the Moon, 18 for Jupiter. */
export function pixelRadius(mass: number): number {
  return Math.min(18, Math.max(2.5, 7.5 * (mass / EARTH_MASS) ** 0.16));
}

interface Visual {
  id: number;
  mesh: Mesh<SphereGeometry, MeshStandardMaterial>;
  trail: Line<BufferGeometry, LineBasicMaterial>;
  positions: Float32Array;
  colors: Float32Array;
  count: number;
  label: HTMLSpanElement;
  mass: number;
  physical: number;
  /** Drawn radius in scene units, from the last render. */
  radius: number;
}

export interface DragState {
  /** Where the body goes, m. */
  x: number;
  y: number;
  /** The pointer, m: the arrow runs from (x, y) to here. */
  tipX: number;
  tipY: number;
  mass: number;
  color: string;
  /** Predicted path as x, y pairs, m; null while it is being computed. */
  path: Float64Array | null;
}

export type DragMode = 'add' | 'camera';

export interface SceneView {
  readonly canvas: HTMLCanvasElement;
  /** Adds, removes and moves visuals to match the bodies; `advanced` adds a trail point. */
  sync(bodies: readonly Body[], advanced: boolean): void;
  /** Forgets every visual (a new scene starts). */
  reset(): void;
  clearTrails(): void;
  setTrails(visible: boolean): void;
  setLabels(visible: boolean): void;
  setNames(bodies: readonly Body[]): void;
  setSelected(id: number | null): void;
  setFollow(id: number | null): void;
  setMode(mode: DragMode): void;
  setDrag(drag: DragState | null): void;
  /** Frames every body, keeping the current viewing direction. */
  fit(bodies: readonly Body[]): void;
  /** The body under a point of the canvas (client coordinates), with a touch-sized margin. */
  pick(clientX: number, clientY: number, touch: boolean): number | null;
  /** Where a point of the canvas meets the plane, m; null when it looks past the plane. */
  planePoint(clientX: number, clientY: number): { x: number; y: number } | null;
  /** Half the height the view shows at a point of the plane, m. */
  halfHeightAt(x: number, y: number): number;
  /** A point of the plane (m) in client coordinates, or null when it is behind the camera. */
  toClient(x: number, y: number): { x: number; y: number } | null;
  /** Renders if anything changed (or the camera is still gliding); call once per frame. */
  frame(): void;
  invalidate(): void;
}

/** Whether this browser can give us a WebGL 2 context (three.js needs it). */
function webglAvailable(): boolean {
  try {
    const probe = document.createElement('canvas');
    return Boolean(window.WebGL2RenderingContext && probe.getContext('webgl2'));
  } catch {
    return false;
  }
}

export function createSceneView(
  canvas: HTMLCanvasElement,
  labelsLayer: HTMLElement,
  options: { reducedMotion: boolean },
): SceneView | null {
  if (!webglAvailable()) return null;
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true, powerPreference: 'low-power' });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(BACKGROUND, 1);

  const scene = new Scene();
  const camera = new PerspectiveCamera(FOV, 1, 0.001, 1e6);
  camera.up.set(0, 0, 1);
  const startDistance = 1200;
  camera.position.set(0, -startDistance * Math.sin(TILT), startDistance * Math.cos(TILT));

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = !options.reducedMotion;
  controls.dampingFactor = 0.12;
  controls.zoomToCursor = true;
  controls.minDistance = 0.05;
  controls.maxDistance = 2e5;
  controls.zoomSpeed = 1.2;
  controls.keyPanSpeed = 14;
  controls.listenToKeyEvents(canvas);
  controls.target.set(0, 0, 0);
  controls.update();

  // Light: a soft "sun" from one side and above, and enough ambient light to see the night sides.
  scene.add(new AmbientLight(0xffffff, 0.45));
  const sun = new DirectionalLight(0xffffff, 2.4);
  sun.position.set(-1, -0.45, 0.75);
  scene.add(sun);

  // The ecliptic grid: 50,000 km squares out to a million kilometres, and 5,000 km squares out to
  // 200,000 km that fade in only when you zoom in close enough for them to fill the view.
  const coarse = new GridHelper(2000, 40, 0x5b6b85, 0x2a3446);
  const fine = new GridHelper(400, 80, 0x5b6b85, 0x2a3446);
  for (const grid of [coarse, fine]) {
    grid.rotation.x = Math.PI / 2;
    const materials = Array.isArray(grid.material) ? grid.material : [grid.material];
    for (const material of materials) {
      material.transparent = true;
      material.depthWrite = false;
      material.opacity = 0.35;
    }
    grid.renderOrder = -1;
    scene.add(grid);
  }
  const gridMaterials = (grid: GridHelper) => (Array.isArray(grid.material) ? grid.material : [grid.material]);

  // Stars: points on a big sphere that moves with the camera, so they look infinitely far.
  const stars = (() => {
    const count = 1800;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    // A fixed pseudo-random sequence, so the sky is the same on every visit.
    let seed = 7;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < count; i++) {
      const z = random() * 2 - 1;
      const phi = random() * Math.PI * 2;
      const r = Math.sqrt(1 - z * z);
      positions.set([r * Math.cos(phi) * 5e4, r * Math.sin(phi) * 5e4, z * 5e4], i * 3);
      const brightness = 0.25 + random() ** 3 * 0.75;
      colors.set([brightness, brightness, brightness * (0.92 + random() * 0.08)], i * 3);
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('color', new BufferAttribute(colors, 3));
    const material = new PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, depthWrite: false });
    const points = new Points(geometry, material);
    points.renderOrder = -2;
    points.frustumCulled = false;
    return points;
  })();
  scene.add(stars);

  const sphere = new SphereGeometry(1, 48, 24);
  const visuals = new Map<number, Visual>();
  let trailsVisible = true;
  let labelsVisible = true;
  let selected: number | null = null;
  let follow: number | null = null;
  let dirty = true;
  let width = 1;
  let height = 1;

  // Selection: a thin ring in the plane around the body.
  const ring = (() => {
    const points: number[] = [];
    for (let i = 0; i < 96; i++) {
      const angle = (i / 96) * Math.PI * 2;
      points.push(Math.cos(angle), Math.sin(angle), 0);
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(points), 3));
    const loop = new LineLoop(geometry, new LineBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.9 }));
    loop.visible = false;
    return loop;
  })();
  scene.add(ring);

  // Throwing a body: a translucent ghost, the velocity arrow and the dashed predicted path.
  const ghost = new Mesh(sphere, new MeshStandardMaterial({ transparent: true, opacity: 0.55, roughness: 0.85 }));
  ghost.visible = false;
  scene.add(ghost);
  const arrow = new ArrowHelper(new Vector3(1, 0, 0), new Vector3(), 1, 0xffffff, 0.2, 0.1);
  arrow.visible = false;
  scene.add(arrow);
  const prediction = new Line(
    new BufferGeometry(),
    new LineDashedMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, dashSize: 1, gapSize: 1 }),
  );
  prediction.visible = false;
  prediction.frustumCulled = false;
  scene.add(prediction);
  let drag: DragState | null = null;

  const raycaster = new Raycaster();
  const plane = new Plane(new Vector3(0, 0, 1), 0);
  const ndc = new Vector2();
  const scratch = new Vector3();
  const scratch2 = new Vector3();

  controls.addEventListener('change', () => {
    dirty = true;
  });

  function resize(): void {
    const w = Math.max(1, canvas.clientWidth);
    const h = Math.max(1, canvas.clientHeight);
    if (w === width && h === height) return;
    width = w;
    height = h;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    dirty = true;
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  /** Scene units per CSS pixel at a point. */
  function unitsPerPixel(point: Vector3): number {
    const distance = camera.position.distanceTo(point);
    return (2 * distance * Math.tan((FOV * Math.PI) / 360)) / height;
  }

  function createVisual(body: Body): Visual {
    const color = new Color(bodyColor(body));
    const material = new MeshStandardMaterial({
      color,
      roughness: 0.85,
      metalness: 0,
      emissive: color.clone().multiplyScalar(0.12),
    });
    const mesh = new Mesh(sphere, material);
    scene.add(mesh);

    const positions = new Float32Array(TRAIL_POINTS * 3);
    const colors = new Float32Array(TRAIL_POINTS * 4);
    for (let i = 0; i < TRAIL_POINTS; i++) colors.set([color.r, color.g, color.b, 0], i * 4);
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('color', new BufferAttribute(colors, 4));
    geometry.setDrawRange(0, 0);
    const trail = new Line(geometry, new LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false }));
    trail.frustumCulled = false;
    trail.visible = trailsVisible;
    scene.add(trail);

    const label = document.createElement('span');
    label.className =
      'absolute top-0 left-0 font-mono text-[0.6875rem] leading-none whitespace-nowrap text-zinc-200 [text-shadow:0_1px_2px_#000]';
    label.textContent = body.name;
    labelsLayer.append(label);

    return { id: body.id, mesh, trail, positions, colors, count: 0, label, mass: body.mass, physical: 0, radius: 1 };
  }

  function disposeVisual(visual: Visual): void {
    scene.remove(visual.mesh, visual.trail);
    visual.mesh.material.dispose();
    visual.trail.geometry.dispose();
    visual.trail.material.dispose();
    visual.label.remove();
  }

  /** Appends a trail point; the alpha fades from the newest point (bright) to the oldest (clear). */
  function pushTrail(visual: Visual, x: number, y: number): void {
    const { positions, colors } = visual;
    if (visual.count === TRAIL_POINTS) {
      positions.copyWithin(0, 3);
      visual.count--;
    }
    positions.set([x, y, 0], visual.count * 3);
    visual.count++;
    const n = visual.count;
    for (let i = 0; i < n; i++) colors[i * 4 + 3] = 0.9 * (i / Math.max(1, n - 1)) ** 1.3;
    const geometry = visual.trail.geometry;
    geometry.attributes.position!.needsUpdate = true;
    geometry.attributes.color!.needsUpdate = true;
    geometry.setDrawRange(0, n);
  }

  function sync(bodies: readonly Body[], advanced: boolean): void {
    const alive = new Set<number>();
    for (const body of bodies) {
      alive.add(body.id);
      let visual = visuals.get(body.id);
      if (!visual) {
        visual = createVisual(body);
        visuals.set(body.id, visual);
      }
      if (visual.mass !== body.mass || visual.physical === 0) {
        visual.mass = body.mass;
        visual.physical = bodyRadius(body) / UNIT;
      }
      const x = body.x / UNIT;
      const y = body.y / UNIT;
      visual.mesh.position.set(x, y, 0);
      const last = visual.count - 1;
      const moved = last < 0 || visual.positions[last * 3] !== x || visual.positions[last * 3 + 1] !== y;
      if ((advanced || visual.count === 0) && moved) pushTrail(visual, x, y);
    }
    for (const [id, visual] of visuals) {
      if (alive.has(id)) continue;
      disposeVisual(visual);
      visuals.delete(id);
    }
    if (selected !== null && !visuals.has(selected)) selected = null;
    if (follow !== null && !visuals.has(follow)) follow = null;
    dirty = true;
  }

  function followTarget(): void {
    if (follow === null) return;
    const visual = visuals.get(follow);
    if (!visual) return;
    scratch.copy(visual.mesh.position).sub(controls.target);
    if (scratch.lengthSq() === 0) return;
    controls.target.add(scratch);
    camera.position.add(scratch);
    dirty = true;
  }

  function draw(): void {
    // Sizes depend on the camera: each body is at least pixelRadius() on screen.
    for (const visual of visuals.values()) {
      const perPixel = unitsPerPixel(visual.mesh.position);
      visual.radius = Math.max(visual.physical, pixelRadius(visual.mass) * perPixel);
      visual.mesh.scale.setScalar(visual.radius);
    }
    if (selected !== null) {
      const visual = visuals.get(selected);
      if (visual) {
        ring.visible = true;
        ring.position.copy(visual.mesh.position);
        ring.scale.setScalar(visual.radius * 1.5 + 4 * unitsPerPixel(visual.mesh.position));
      } else ring.visible = false;
    } else ring.visible = false;

    if (drag) {
      const origin = scratch.set(drag.x / UNIT, drag.y / UNIT, 0);
      const perPixel = unitsPerPixel(origin);
      ghost.visible = true;
      ghost.position.copy(origin);
      ghost.scale.setScalar(pixelRadius(drag.mass) * perPixel);
      ghost.material.color.set(drag.color);
      const tip = scratch2.set(drag.tipX / UNIT, drag.tipY / UNIT, 0);
      const length = tip.distanceTo(origin);
      if (length > 6 * perPixel) {
        arrow.visible = true;
        arrow.position.copy(origin);
        arrow.setDirection(tip.sub(origin).normalize());
        arrow.setLength(length, Math.min(length * 0.4, 12 * perPixel), Math.min(length * 0.25, 7 * perPixel));
      } else arrow.visible = false;
      const dash = 7 * unitsPerPixel(controls.target);
      prediction.material.dashSize = dash;
      prediction.material.gapSize = dash * 0.8;
    }

    // The fine grid fades in between 250,000 and 120,000 km of camera distance.
    const distance = camera.position.distanceTo(controls.target);
    const fineOpacity = Math.min(1, Math.max(0, (250 - distance) / 130)) * 0.3;
    for (const material of gridMaterials(fine)) material.opacity = fineOpacity;
    fine.visible = fineOpacity > 0.01;
    stars.position.copy(camera.position);

    renderer.render(scene, camera);

    // Labels after the render, from the same camera.
    for (const visual of visuals.values()) {
      const label = visual.label;
      if (!labelsVisible) {
        label.hidden = true;
        continue;
      }
      scratch.copy(visual.mesh.position).project(camera);
      if (scratch.z > 1 || scratch.z < -1) {
        label.hidden = true;
        continue;
      }
      const px = ((scratch.x + 1) / 2) * width;
      const py = ((1 - scratch.y) / 2) * height;
      const offset = visual.radius / unitsPerPixel(visual.mesh.position) + 4;
      label.hidden = false;
      label.style.transform = `translate(${Math.round(px + offset)}px, ${Math.round(py - offset - 6)}px)`;
    }
  }

  return {
    canvas,
    sync,
    reset() {
      for (const visual of visuals.values()) disposeVisual(visual);
      visuals.clear();
      selected = null;
      follow = null;
      dirty = true;
    },
    clearTrails() {
      for (const visual of visuals.values()) {
        visual.count = 0;
        visual.trail.geometry.setDrawRange(0, 0);
      }
      dirty = true;
    },
    setTrails(visible) {
      trailsVisible = visible;
      for (const visual of visuals.values()) visual.trail.visible = visible;
      dirty = true;
    },
    setLabels(visible) {
      labelsVisible = visible;
      dirty = true;
    },
    setNames(bodies) {
      for (const body of bodies) {
        const visual = visuals.get(body.id);
        if (visual && visual.label.textContent !== body.name) visual.label.textContent = body.name;
      }
    },
    setSelected(id) {
      selected = id;
      dirty = true;
    },
    setFollow(id) {
      follow = id;
      followTarget();
      dirty = true;
    },
    setMode(mode) {
      // Adding: the left button and one finger throw bodies; the wheel, the right button and two
      // fingers still zoom and pan. Camera: the usual orbit controls.
      controls.mouseButtons = {
        LEFT: mode === 'camera' ? MOUSE.ROTATE : null,
        MIDDLE: MOUSE.DOLLY,
        RIGHT: MOUSE.PAN,
      };
      controls.touches = { ONE: mode === 'camera' ? TOUCH.ROTATE : null, TWO: TOUCH.DOLLY_PAN };
    },
    setDrag(next) {
      drag = next;
      if (!next) {
        ghost.visible = false;
        arrow.visible = false;
        prediction.visible = false;
      } else if (next.path) {
        const points = new Float32Array((next.path.length / 2) * 3);
        for (let i = 0; i < next.path.length / 2; i++) {
          points[i * 3] = next.path[i * 2]! / UNIT;
          points[i * 3 + 1] = next.path[i * 2 + 1]! / UNIT;
        }
        prediction.geometry.dispose();
        prediction.geometry = new BufferGeometry();
        prediction.geometry.setAttribute('position', new BufferAttribute(points, 3));
        prediction.computeLineDistances();
        prediction.visible = points.length >= 6;
      }
      dirty = true;
    },
    fit(bodies) {
      if (bodies.length === 0) return;
      // Centred on the centre of mass, which orbits pass around, out to the farthest body.
      let mass = 0;
      const center = new Vector3();
      for (const body of bodies) {
        mass += body.mass;
        center.x += (body.mass * body.x) / UNIT;
        center.y += (body.mass * body.y) / UNIT;
      }
      center.divideScalar(mass);
      let radius = 30;
      for (const body of bodies) radius = Math.max(radius, Math.hypot(body.x / UNIT - center.x, body.y / UNIT - center.y));
      const halfFov = (FOV * Math.PI) / 360;
      const fitHeight = radius / Math.tan(halfFov);
      const fitWidth = radius / (Math.tan(halfFov) * camera.aspect);
      const distance = Math.max(fitHeight, fitWidth) * 1.25;
      const direction = camera.position.clone().sub(controls.target).normalize();
      controls.target.copy(center);
      camera.position.copy(center).addScaledVector(direction, distance);
      controls.update();
      dirty = true;
    },
    pick(clientX, clientY, touch) {
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      let best: number | null = null;
      let bestDistance = Infinity;
      for (const visual of visuals.values()) {
        scratch.copy(visual.mesh.position).project(camera);
        if (scratch.z > 1 || scratch.z < -1) continue;
        const px = ((scratch.x + 1) / 2) * width;
        const py = ((1 - scratch.y) / 2) * height;
        const reach = visual.radius / unitsPerPixel(visual.mesh.position) + (touch ? 16 : 8);
        const distance = Math.hypot(px - x, py - y);
        if (distance <= Math.max(reach, touch ? 22 : 12) && distance < bestDistance) {
          bestDistance = distance;
          best = visual.id;
        }
      }
      return best;
    },
    planePoint(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.ray.intersectPlane(plane, scratch);
      if (!hit) return null;
      // Points near the horizon are too far to place anything usefully.
      if (hit.distanceTo(camera.position) > 1e5) return null;
      return { x: hit.x * UNIT, y: hit.y * UNIT };
    },
    halfHeightAt(x, y) {
      return (unitsPerPixel(scratch.set(x / UNIT, y / UNIT, 0)) * height * UNIT) / 2;
    },
    toClient(x, y) {
      scratch.set(x / UNIT, y / UNIT, 0).project(camera);
      if (scratch.z > 1 || scratch.z < -1) return null;
      const rect = canvas.getBoundingClientRect();
      return { x: rect.left + ((scratch.x + 1) / 2) * rect.width, y: rect.top + ((1 - scratch.y) / 2) * rect.height };
    },
    frame() {
      resize();
      followTarget();
      if (controls.update()) dirty = true;
      if (!dirty) return;
      dirty = false;
      draw();
    },
    invalidate() {
      dirty = true;
    },
  };
}

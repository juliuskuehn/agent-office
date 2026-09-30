import * as THREE from 'three';
import { KITCHEN } from '../../shared/layout';
import type { Collider, Interactable } from './office';
import { mergeByMaterial, mesh, roundedBox, toon } from './toon';

// The kitchen along the north wall's west end (see KITCHEN): one long run of base units in brushed
// chrome, handleless, their doors and drawers flush with the carcass so all you see of them are fine
// dark slits, under a steel worktop with a sink and an arched tap let into it. On the worktop, an
// E61 espresso machine in the manner of an ECM: a steel box with a cup rail round its top, two
// gauges, the chrome group with its mushroom and lever, a portafilter, wands and a drip tray. E at
// it pours you a cup (see main.ts).

export interface Kitchen {
  group: THREE.Group;
  colliders: Collider[];
  /** The coffee machine: E at it for a minute of quicker feet and higher jumps. */
  interactable: Interactable;
  /** The bottles at the end of the run: E at them to pour yourself a drink, as at the roof's bar. */
  bar: Interactable;
}

/**
 * A metal that looks like metal whatever the light: a matcap, the ball of it drawn as the sky over a
 * dark horizon over the floor, with a glint up on the left. `stops` run from the top of the ball to
 * the bottom; `shine` is how bright the glint is.
 */
function metal(stops: [number, string][], shine: number): THREE.MeshMatcapMaterial {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, 256);
  for (const [at, color] of stops) grad.addColorStop(at, color);
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const glint = g.createRadialGradient(88, 70, 0, 88, 70, 70);
  glint.addColorStop(0, `rgba(255,255,255,${shine})`);
  glint.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = glint;
  g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshMatcapMaterial({ matcap: tex });
}

/** Polished chrome (the machine, the tap), brushed steel (the fronts, the worktop, the machine's box), and the sink's darker steel. */
const CHROME = metal([[0, '#ffffff'], [0.42, '#d9e2ea'], [0.52, '#5b6168'], [0.6, '#8a9199'], [1, '#e8ecef']], 0.95);
const STEEL = metal([[0, '#f1f3f5'], [0.45, '#d3d8dd'], [0.55, '#a7aeb6'], [1, '#c9ced4']], 0.45);
const BASIN = metal([[0, '#c3c9cf'], [0.5, '#7d858e'], [1, '#9aa1a9']], 0.25);
/** The slits between fronts, and the recessed plinth. */
const FINISH = { slit: '#2b2d33', plinth: '#3a3d44' } as const;
/** How wide one unit is, near enough (the run is split into as many as fit evenly). */
const UNIT = 0.6;
/** The plinth's height, the worktop's thickness, how far it overhangs the fronts, and a slit's width. */
const PLINTH = 0.1;
const TOP = 0.04;
const OVERHANG = 0.02;
const SLIT = 0.007;

export function buildKitchen(): Kitchen {
  const group = new THREE.Group();
  const interactable: Interactable = { kind: 'coffee', x: KITCHEN.pour.x, z: KITCHEN.pour.z, radius: 1.4 };
  const c = KITCHEN.counter;
  const L = c.maxX - c.minX;
  const D = c.maxZ - c.minZ;
  const H = c.top;
  // Built round the run's middle, its back toward -z (the wall) and its fronts toward +z.
  const cx = (c.minX + c.maxX) / 2 - KITCHEN.x;
  const cz = (c.minZ + c.maxZ) / 2 - KITCHEN.z;
  const front = cz + D / 2 - OVERHANG;
  const units = new THREE.Group();
  const add = (w: number, h: number, d: number, mat: THREE.Material | string, x: number, y: number, z: number) => units.add(mesh(new THREE.BoxGeometry(w, h, d), typeof mat === 'string' ? toon(mat) : mat, x, y, z));

  // The carcass and its fronts, one flush face; the plinth set back under it; the worktop over it.
  const bodyH = H - TOP - PLINTH;
  add(L, bodyH, D - OVERHANG, STEEL, cx, PLINTH + bodyH / 2, cz - OVERHANG / 2);
  add(L - 0.02, PLINTH, D - 0.12, FINISH.plinth, cx, PLINTH / 2, cz - 0.06);
  add(L, TOP, D, STEEL, cx, H - TOP / 2, cz);
  // A shadow gap under the worktop, where you'd hook a finger to open a front.
  add(L, 0.014, 0.004, FINISH.slit, cx, H - TOP - 0.02, front + 0.001);

  // The slits between the fronts: one between every two units, and across the fronts where a unit
  // has drawers (three of them), a drawer over a door, or just the one door.
  const n = Math.max(1, Math.round(L / UNIT));
  const u = L / n;
  const x0 = cx - L / 2;
  const frontH = bodyH - 0.035;
  const sinkUnit = Math.floor((KITCHEN.sink.x - c.minX) / u);
  for (let i = 1; i < n; i++) add(SLIT, frontH, 0.004, FINISH.slit, x0 + i * u, PLINTH + frontH / 2, front + 0.001);
  for (let i = 0; i < n; i++) {
    const mid = x0 + (i + 0.5) * u;
    const cuts = i === sinkUnit ? [] : i % 3 === 0 ? [1 / 3, 2 / 3] : i % 3 === 2 ? [0.72] : [];
    for (const k of cuts) add(u - 0.02, SLIT, 0.004, FINISH.slit, mid, PLINTH + frontH * k, front + 0.001);
  }

  // The sink, let into the worktop, and an arched tap behind it.
  const sx = KITCHEN.sink.x - KITCHEN.x;
  add(0.62, 0.004, 0.44, STEEL, sx, H + 0.002, cz + 0.02);
  add(0.56, 0.005, 0.38, BASIN, sx, H + 0.003, cz + 0.02);
  const tapZ = cz - D / 2 + 0.12;
  units.add(mesh(new THREE.CylinderGeometry(0.02, 0.024, 0.34, 16), CHROME, sx, H + 0.17, tapZ));
  const arch = mesh(new THREE.TorusGeometry(0.11, 0.017, 10, 24, Math.PI), CHROME, sx, H + 0.34, tapZ + 0.11);
  arch.rotation.y = Math.PI / 2;
  units.add(arch);
  units.add(mesh(new THREE.CylinderGeometry(0.019, 0.017, 0.06, 12), CHROME, sx, H + 0.31, tapZ + 0.22));
  add(0.02, 0.02, 0.1, CHROME, sx + 0.04, H + 0.22, tapZ);
  group.add(mergeByMaterial(units));

  // The espresso machine, on the worktop.
  const machine = espressoMachine();
  machine.name = 'coffee_machine';
  machine.position.set(KITCHEN.machine.x - KITCHEN.x, H, KITCHEN.machine.z - KITCHEN.z);
  machine.userData.interact = interactable;
  group.add(machine);

  // The bar: bottles and glasses at the east end of the worktop.
  const bar: Interactable = { kind: 'bar', x: KITCHEN.bar.x, z: KITCHEN.pour.z, radius: 1.4, label: '🥃 Kitchen bar' };
  const bottles = barBottles();
  bottles.position.set(KITCHEN.bar.x - KITCHEN.x, H, KITCHEN.bar.z - KITCHEN.z);
  bottles.userData.interact = bar;
  group.add(bottles);

  group.position.set(KITCHEN.x, 0, KITCHEN.z);
  group.rotation.y = KITCHEN.rotY;
  const colliders: Collider[] = [{ ...KITCHEN.counter }];
  return { group, colliders, interactable, bar };
}

/**
 * An E61 espresso machine like an ECM's, a little over life size, standing on the origin and facing
 * +z: a polished steel box on short feet, a cup rail round its top with cups on it, two gauges up
 * front over a small badge, the chrome E61 group with its mushroom and lever, a portafilter with a
 * black handle, steam and hot-water wands under black knobs, and a slotted drip tray.
 */
export function espressoMachine(): THREE.Group {
  const S = 1.3;
  const W = 0.33 * S;
  const D = 0.44 * S;
  const H = 0.39 * S;
  const F = 0.03;
  const steel = STEEL;
  const chrome = CHROME;
  const dark = toon('#1f2126');
  const parts = new THREE.Group();
  const at = (m: THREE.Mesh, x: number, y: number, z: number) => {
    m.position.set(x, y, z);
    parts.add(m);
    return m;
  };
  const fz = D / 2;

  // Feet, the body, and the cup tray on top with its rail round three sides.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) at(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, F, 12), dark), sx * (W / 2 - 0.04), F / 2, sz * (D / 2 - 0.05));
  at(new THREE.Mesh(roundedBox(W, H, D, 0.012), steel), 0, F + H / 2, 0);
  at(new THREE.Mesh(new THREE.BoxGeometry(W - 0.03, 0.006, D - 0.05), BASIN), 0, F + H + 0.003, -0.01);
  const railY = F + H + 0.04;
  for (const sx of [-1, 1]) {
    const side = at(new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, D - 0.06, 8), chrome), sx * (W / 2 - 0.012), railY, -0.01);
    side.rotation.x = Math.PI / 2;
    for (const sz of [-1, 1]) at(new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.04, 8), chrome), sx * (W / 2 - 0.012), railY - 0.02, -0.01 + sz * (D / 2 - 0.04));
  }
  const back = at(new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, W - 0.024, 8), chrome), 0, railY, -D / 2 + 0.02);
  back.rotation.z = Math.PI / 2;
  // Two cups warming up there.
  for (const x of [-0.07, 0.06]) at(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.024, 0.055, 16), toon('#ffffff')), x, F + H + 0.034, 0.02);

  // Up front: two gauges (boiler and pump), and the badge under them.
  for (const sx of [-1, 1]) {
    const rim = at(new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.02, 24), chrome), sx * 0.085, F + H * 0.78, fz + 0.01);
    rim.rotation.x = Math.PI / 2;
    const face = at(new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.004, 24), toon('#f6f5ef')), sx * 0.085, F + H * 0.78, fz + 0.021);
    face.rotation.x = Math.PI / 2;
    const needle = at(new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.028, 0.002), toon('#d62828')), sx * 0.085 + 0.006, F + H * 0.78 + 0.008, fz + 0.024);
    needle.rotation.z = -0.7 * sx;
  }
  at(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.022, 0.004), dark), 0, F + H * 0.62, fz + 0.002);

  // The E61 group: a chrome drum out of the front, the mushroom on top of it, and its lever.
  const gy = F + H * 0.42;
  const drum = at(new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.058, 0.11, 24), chrome), 0, gy, fz + 0.055);
  drum.rotation.x = Math.PI / 2;
  at(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.05, 20), chrome), 0, gy + 0.075, fz + 0.06);
  at(new THREE.Mesh(new THREE.SphereGeometry(0.045, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), chrome), 0, gy + 0.1, fz + 0.06);
  const lever = at(new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.13, 10), chrome), 0.07, gy + 0.06, fz + 0.085);
  lever.rotation.z = -0.75;
  at(new THREE.Mesh(new THREE.SphereGeometry(0.02, 14, 10), dark), 0.118, gy + 0.105, fz + 0.085);

  // The portafilter locked in under the group: its basket, spouts, and black handle out the front.
  at(new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.04, 0.035, 24), chrome), 0, gy - 0.065, fz + 0.06);
  for (const sx of [-1, 1]) at(new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.005, 0.025, 8), chrome), sx * 0.014, gy - 0.095, fz + 0.06);
  const handle = at(new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.013, 0.15, 14), dark), 0, gy - 0.075, fz + 0.16);
  handle.rotation.x = Math.PI / 2 - 0.12;

  // The steam wand on the left and the hot-water wand on the right, each under a black knob.
  for (const sx of [-1, 1]) {
    const knob = at(new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.045, 16), dark), sx * (W / 2 - 0.045), F + H * 0.78, fz + 0.022);
    knob.rotation.x = Math.PI / 2;
    const wand = at(new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.2, 8), chrome), sx * (W / 2 - 0.02), F + H * 0.42, fz + 0.03);
    wand.rotation.z = sx * 0.12;
  }

  // The drip tray, out in front at the bottom, with its slotted grille.
  at(new THREE.Mesh(new THREE.BoxGeometry(W - 0.02, 0.035, 0.13), chrome), 0, F + 0.018, fz + 0.06);
  for (let i = 0; i < 7; i++) at(new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.002, 0.1), dark), -0.12 + i * 0.04, F + 0.036, fz + 0.06);

  const machine = new THREE.Group();
  machine.add(mergeByMaterial(parts));
  return machine;
}

/**
 * A home bar on the worktop, facing +z: a row of bottles along the back (gin in green glass, a square
 * of whisky, rum, clear vodka, a red aperitivo, champagne in its foil, a bottle of red), and in front
 * of them a few glasses, a cocktail shaker and a bowl of lemons.
 */
export function barBottles(): THREE.Group {
  const parts = new THREE.Group();
  const glass = (color: string) => toon(color);
  /** A round bottle: body, shoulder, neck and cap. */
  const bottle = (x: number, z: number, h: number, r: number, color: string, cap: string, neck = 0.1) => {
    parts.add(mesh(new THREE.CylinderGeometry(r, r, h * 0.7, 18), glass(color), x, (h * 0.7) / 2, z));
    parts.add(mesh(new THREE.CylinderGeometry(r * 0.35, r, h * 0.12, 18), glass(color), x, h * 0.76, z));
    parts.add(mesh(new THREE.CylinderGeometry(r * 0.32, r * 0.35, neck, 12), glass(color), x, h * 0.82 + neck / 2, z, false));
    parts.add(mesh(new THREE.CylinderGeometry(r * 0.38, r * 0.38, 0.03, 12), toon(cap), x, h * 0.82 + neck + 0.015, z, false));
    // A label round the middle.
    parts.add(mesh(new THREE.CylinderGeometry(r + 0.002, r + 0.002, h * 0.22, 18, 1, true), toon('#f4efe4'), x, h * 0.36, z, false));
  };
  bottle(-0.5, -0.12, 0.34, 0.045, '#3f7f5f', '#c9ccd1');
  // The whisky: square, amber, with a cork.
  parts.add(mesh(roundedBox(0.09, 0.22, 0.09, 0.012), glass('#b5651d'), -0.36, 0.11, -0.14));
  parts.add(mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.06, 10), glass('#b5651d'), -0.36, 0.25, -0.14, false));
  parts.add(mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.035, 10), toon('#8a5a3b'), -0.36, 0.295, -0.14, false));
  parts.add(mesh(new THREE.BoxGeometry(0.092, 0.07, 0.004), toon('#1f2126'), -0.36, 0.11, -0.094, false));
  bottle(-0.22, -0.12, 0.32, 0.042, '#6b3a1e', '#1f2126');
  bottle(-0.1, -0.15, 0.36, 0.04, '#dfeff5', '#2a6f97');
  bottle(0.02, -0.12, 0.3, 0.043, '#c0392b', '#1f2126');
  // The champagne, its neck in gold foil.
  bottle(0.15, -0.15, 0.38, 0.045, '#27402e', '#d9ab2e', 0.13);
  parts.add(mesh(new THREE.CylinderGeometry(0.017, 0.03, 0.12, 12), toon('#d9ab2e'), 0.15, 0.38 * 0.82 + 0.06, -0.15, false));
  bottle(0.29, -0.12, 0.36, 0.04, '#3b0f1c', '#6b1a2a');
  // Glasses: two tumblers, a coupe and a wine glass, see-through-ish.
  const clear = new THREE.MeshBasicMaterial({ color: '#e6f4fb', transparent: true, opacity: 0.45, depthWrite: false });
  for (const x of [-0.42, -0.3]) parts.add(mesh(new THREE.CylinderGeometry(0.038, 0.034, 0.09, 16), clear, x, 0.045, 0.1, false));
  for (const [x, top] of [
    [-0.14, 'coupe'],
    [0.0, 'wine'],
  ] as const) {
    parts.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.004, 16), clear, x, 0.002, 0.1, false));
    parts.add(mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.1, 8), clear, x, 0.054, 0.1, false));
    const bowl = top === 'coupe' ? new THREE.SphereGeometry(0.05, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2) : new THREE.SphereGeometry(0.042, 16, 10, 0, Math.PI * 2, Math.PI / 3, (Math.PI * 2) / 3);
    const b = mesh(bowl, clear, x, top === 'coupe' ? 0.16 : 0.15, 0.1, false);
    if (top === 'coupe') b.scale.y = 0.6;
    parts.add(b);
  }
  // The shaker, and a bowl of lemons.
  parts.add(mesh(new THREE.CylinderGeometry(0.045, 0.038, 0.17, 18), STEEL, 0.16, 0.085, 0.1));
  parts.add(mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.06, 18), CHROME, 0.16, 0.2, 0.1));
  parts.add(mesh(new THREE.SphereGeometry(0.1, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), STEEL, 0.33, 0.1, 0.1));
  for (const [dx, dz] of [
    [-0.03, -0.02],
    [0.03, 0.02],
    [0.0, 0.035],
  ]) {
    const lemon = mesh(new THREE.SphereGeometry(0.035, 12, 8), toon('#f2d024'), 0.33 + dx, 0.06, 0.1 + dz);
    lemon.scale.set(1, 0.85, 1.25);
    parts.add(lemon);
  }
  const g = new THREE.Group();
  g.add(mergeByMaterial(parts));
  return g;
}

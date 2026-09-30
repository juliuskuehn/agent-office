import * as THREE from 'three';
import { BOOKSHELF, BOOKSHELF_BOX } from '../../shared/layout';
import { mergeByMaterial, mesh, textPlane, toon } from './toon';
import type { Collider, Interactable } from './office';

// The bookshelf by the west wall: a donut, a low ring of shelf lying on the floor, in a metallic grey
// frame (a flat ring of steel under the books and another over them, on little feet) with a grid of
// wire round its inside at the books' backs. Books of every size and color stand all the way round,
// spines out, to be pulled out sideways; now and then a stack lies flat, and a globe stands among
// them. A "Docs" sign floats over the hole in the middle. E at it opens the project's Markdown to
// read (ui/bookshelf.ts).

export interface BookshelfModel {
  group: THREE.Group;
  collider: Collider;
  interactable: Interactable;
}

const SPINES = ['#b5413b', '#2a6f97', '#2d6a4f', '#e9c46a', '#6a4c93', '#f4a261', '#264653', '#ef476f', '#8ecae6', '#fffaf3'];
/** The steel rings' thickness, how far the lower one is off the floor, the grid's spacing and wire, and how deep the ring is from its outside to the grid. */
const PLATE = 0.025;
const BASE = 0.12;
const MESH = 0.1;
const WIRE = 0.008;
const CHANNEL = 0.36;

export function buildBookshelf(): BookshelfModel {
  const { width: W, height: H } = BOOKSHELF;
  // Seeded, so the shelf looks the same in every browser.
  let seed = 20250928;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];

  const R = W / 2;
  const r = R - CHANNEL;
  const parts = new THREE.Group();
  const steel = toon('#8f969f');

  /** A flat ring of steel, `y` up, from `r` out to `R`. */
  const plate = (y: number) => {
    const shape = new THREE.Shape().absarc(0, 0, R, 0, Math.PI * 2, false);
    shape.holes.push(new THREE.Path().absarc(0, 0, r, 0, Math.PI * 2, true));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: PLATE, bevelEnabled: false, curveSegments: 72 }).rotateX(-Math.PI / 2);
    parts.add(mesh(geo, steel, 0, y, 0));
  };
  plate(BASE);
  plate(H - PLATE);
  // Little feet under the lower ring, and posts up the grid from it to the upper one.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const at = (R + r) / 2;
    parts.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, BASE, 8), steel, Math.cos(a) * at, BASE / 2, Math.sin(a) * at));
    parts.add(mesh(new THREE.CylinderGeometry(0.015, 0.015, H - BASE, 6), steel, Math.cos(a) * r, (BASE + H) / 2, Math.sin(a) * r, false));
  }
  // The grid round the inside, at the books' backs: rings every so high, and wires up every so far round.
  const g0 = BASE + PLATE;
  const g1 = H - PLATE;
  for (let y = g0 + MESH; y < g1 - 0.01; y += MESH) {
    const ring = mesh(new THREE.TorusGeometry(r, WIRE, 4, 72), steel, 0, y, 0, false);
    ring.rotation.x = Math.PI / 2;
    parts.add(ring);
  }
  const wires = Math.round((2 * Math.PI * r) / MESH);
  for (let i = 0; i < wires; i++) {
    const a = (i / wires) * Math.PI * 2;
    parts.add(mesh(new THREE.CylinderGeometry(WIRE, WIRE, g1 - g0, 4), steel, Math.cos(a) * r, (g0 + g1) / 2, Math.sin(a) * r, false));
  }

  // The books, all the way round, standing up with their spines to the outside: each turned so its
  // depth runs in toward the middle. Now and then a stack lies flat, and once a globe on its stand.
  const floor = g0;
  const room = Math.min(0.42, g1 - floor - 0.04);
  const out = R - 0.02;
  /** Puts `m` at angle `a` round the ring, `inward` in from its outside, turned to face out. */
  const place = (m: THREE.Mesh, a: number, inward: number, y: number) => {
    m.position.set(Math.cos(a) * (out - inward), y, Math.sin(a) * (out - inward));
    m.rotation.y = Math.PI / 2 - a;
    parts.add(m);
  };
  let a = 0;
  let globe = true;
  const globeAt = Math.PI * (0.6 + rand() * 0.2);
  while (a < Math.PI * 2 - 0.02) {
    if (globe && a >= globeAt) {
      const g = (at: number) => [Math.cos(at) * (out - 0.16), Math.sin(at) * (out - 0.16)] as const;
      const [gx, gz] = g(a + 0.12);
      parts.add(mesh(new THREE.BoxGeometry(0.16, 0.03, 0.16), steel, gx, floor + 0.015, gz));
      parts.add(mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.07, 6), steel, gx, floor + 0.06, gz));
      parts.add(mesh(new THREE.SphereGeometry(0.11, 14, 10), toon('#4cc9f0'), gx, floor + 0.18, gz));
      parts.add(mesh(new THREE.SphereGeometry(0.075, 10, 8), toon('#80b918'), gx + 0.03, floor + 0.21, gz + 0.05));
      globe = false;
      a += 0.28 / out;
      continue;
    }
    // A stack lying flat, once in a while.
    if (rand() < 0.06) {
      let y = floor;
      const n = 2 + Math.floor(rand() * 3);
      for (let i = 0; i < n; i++) {
        const t = 0.04 + rand() * 0.03;
        const w = 0.22 + rand() * 0.06;
        const d = 0.18 + rand() * 0.06;
        place(mesh(new THREE.BoxGeometry(w, t, d), toon(pick(SPINES))), a + 0.15 / out, d / 2 + 0.01, y + t / 2);
        y += t;
      }
      a += 0.3 / out;
      continue;
    }
    const t = 0.035 + rand() * 0.04;
    const h = room * (0.62 + rand() * 0.38);
    const d = 0.19 + rand() * 0.08;
    const da = t / out;
    if (a + da > Math.PI * 2 - 0.02) break;
    const mat = toon(pick(SPINES));
    place(mesh(new THREE.BoxGeometry(t, h, d), mat), a + da / 2, d / 2, floor + h / 2);
    // A band across some spines, near the top.
    if (rand() < 0.35) place(mesh(new THREE.BoxGeometry(t + 0.004, 0.018, d + 0.004), toon('#e9c46a')), a + da / 2, d / 2, floor + h * 0.82);
    a += da + (rand() < 0.1 ? 0.012 / out : 0.002 / out);
  }

  const group = new THREE.Group();
  group.add(mergeByMaterial(parts));

  // A sign over the hole in the middle, facing the room.
  const sign = textPlane('📚 Docs', { size: 40 });
  sign.position.set(0, H + 0.45, 0);
  group.add(sign);

  // Turned so the sign faces into the room.
  group.position.set(BOOKSHELF.x, 0, BOOKSHELF.z);
  group.rotation.y = BOOKSHELF.rotY;
  const collider: Collider = { ...BOOKSHELF_BOX, top: H };
  // Walk up to it from the room's side.
  const interactable: Interactable = { kind: 'bookshelf', x: BOOKSHELF.x + R + 0.6, z: BOOKSHELF.z, radius: 1.8 };
  group.userData.interact = interactable;
  return { group, collider, interactable };
}

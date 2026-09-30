import * as THREE from 'three';
import { BOOKSHELF, BOOKSHELF_BOX } from '../../shared/layout';
import { mergeByMaterial, mesh, textPlane, toon } from './toon';
import type { Collider, Interactable } from './office';

// The bookshelf against the west wall: one long, low shelf in a metallic grey frame, a grid of wire
// at its back and ends, packed along its length with books of every size and color (a few leaning
// over, a stack lying flat, a globe among them), and a "Docs" sign over it. E at it opens the
// project's Markdown to read (ui/bookshelf.ts).

export interface BookshelfModel {
  group: THREE.Group;
  collider: Collider;
  interactable: Interactable;
}

const SPINES = ['#b5413b', '#2a6f97', '#2d6a4f', '#e9c46a', '#6a4c93', '#f4a261', '#264653', '#ef476f', '#8ecae6', '#fffaf3'];
/** The frame's bars, how far the shelf sits off the floor, how thick its plates are, and the grid's spacing and wire. */
const BAR = 0.03;
const BASE = 0.12;
const PLATE = 0.025;
const MESH = 0.1;
const WIRE = 0.008;

export function buildBookshelf(): BookshelfModel {
  const { width: W, depth: D, height: H } = BOOKSHELF;
  // Seeded, so the shelf looks the same in every browser.
  let seed = 20250928;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];

  // Built facing +z, back against z = -D/2.
  const parts = new THREE.Group();
  const steel = toon('#8f969f');
  const box = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number) => parts.add(mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z));
  // The frame: a post at each corner, and the shelf's plate and the top's.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(BAR, H, BAR, steel, sx * (W / 2 - BAR / 2), H / 2, sz * (D / 2 - BAR / 2));
  box(W, PLATE, D, steel, 0, BASE, 0);
  box(W, PLATE, D, steel, 0, H - PLATE / 2, 0);
  // The wire grid across the back and both ends, between the plates.
  const g0 = BASE + PLATE / 2;
  const g1 = H - PLATE;
  for (let x = -W / 2 + MESH; x < W / 2 - 0.01; x += MESH) box(WIRE, g1 - g0, WIRE, steel, x, (g0 + g1) / 2, -D / 2 + WIRE);
  for (let y = g0 + MESH; y < g1 - 0.01; y += MESH) box(W, WIRE, WIRE, steel, 0, y, -D / 2 + WIRE);
  for (const sx of [-1, 1]) {
    for (let z = -D / 2 + MESH; z < D / 2 - 0.01; z += MESH) box(WIRE, g1 - g0, WIRE, steel, sx * (W / 2 - WIRE), (g0 + g1) / 2, z);
    for (let y = g0 + MESH; y < g1 - 0.01; y += MESH) box(WIRE, WIRE, D, steel, sx * (W / 2 - WIRE), y, 0);
  }

  // The one long shelf of books, end to end.
  const floor = BASE + PLATE / 2;
  const room = Math.min(0.42, g1 - floor - 0.04);
  const front = D / 2 - 0.02;
  let x = -W / 2 + BAR + 0.02;
  const end = W / 2 - BAR - 0.02;
  // Now and then something that isn't a book: a globe, about a third of the way along.
  let globe = true;
  const globeAt = -W / 2 + W * (0.3 + rand() * 0.1);
  while (x < end - 0.03) {
    if (globe && x >= globeAt) {
      box(0.16, 0.03, 0.16, steel, x + 0.13, floor + 0.015, 0);
      parts.add(mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.07, 6), steel, x + 0.13, floor + 0.06, 0));
      parts.add(mesh(new THREE.SphereGeometry(0.11, 14, 10), toon('#4cc9f0'), x + 0.13, floor + 0.18, 0));
      parts.add(mesh(new THREE.SphereGeometry(0.075, 10, 8), toon('#80b918'), x + 0.16, floor + 0.21, 0.05));
      globe = false;
      x += 0.28;
      continue;
    }
    // A stack lying flat, once in a while.
    if (rand() < 0.07 && end - x > 0.32) {
      let y = floor;
      const n = 2 + Math.floor(rand() * 3);
      for (let i = 0; i < n; i++) {
        const t = 0.04 + rand() * 0.03;
        const w = 0.22 + rand() * 0.08;
        box(w, t, 0.18 + rand() * 0.06, toon(pick(SPINES)), x + 0.15 + (rand() - 0.5) * 0.03, y + t / 2, front - 0.13);
        y += t;
      }
      x += 0.32;
      continue;
    }
    const t = 0.035 + rand() * 0.04;
    const h = room * (0.62 + rand() * 0.38);
    const d = 0.19 + rand() * 0.08;
    if (x + t > end) break;
    // The last one or two lean over on their neighbour when there's room.
    const lean = end - x < 0.24 && end - x > 0.14 && rand() < 0.6;
    const mat = toon(pick(SPINES));
    if (lean) {
      const g = new THREE.Group();
      g.add(mesh(new THREE.BoxGeometry(t, h, d), mat, t / 2, h / 2, 0));
      g.rotation.z = -0.32;
      g.position.set(x + 0.01, floor, front - d / 2);
      parts.add(g);
      break;
    }
    box(t, h, d, mat, x + t / 2, floor + h / 2, front - d / 2);
    // A band across some spines, near the top.
    if (rand() < 0.35) box(t + 0.004, 0.018, d + 0.004, toon('#e9c46a'), x + t / 2, floor + h * 0.82, front - d / 2);
    x += t + (rand() < 0.1 ? 0.012 : 0.002);
  }
  const group = new THREE.Group();
  group.add(mergeByMaterial(parts));

  // A sign over it.
  const sign = textPlane('📚 Docs', { size: 40 });
  sign.position.set(0, H + 0.25, 0.02);
  group.add(sign);

  // Built facing +z; it stands against its wall facing into the room.
  group.position.set(BOOKSHELF.x, 0, BOOKSHELF.z);
  group.rotation.y = BOOKSHELF.rotY;
  const collider: Collider = { ...BOOKSHELF_BOX, top: H };
  const interactable: Interactable = { kind: 'bookshelf', x: BOOKSHELF.x + Math.sin(BOOKSHELF.rotY) * 1.2, z: BOOKSHELF.z + Math.cos(BOOKSHELF.rotY) * 1.2, radius: 1.6 };
  group.userData.interact = interactable;
  return { group, collider, interactable };
}

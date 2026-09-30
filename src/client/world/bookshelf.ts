import * as THREE from 'three';
import { BOOKSHELF, BOOKSHELF_BOX } from '../../shared/layout';
import { mergeByMaterial, mesh, textPlane, toon } from './toon';
import type { Collider, Interactable } from './office';

// The bookshelf against the west wall: a donut, a ring standing up on its edge on a little foot, in a
// metallic grey frame of wire grid (round its outside, its inside and across its back), packed all
// the way round with books of every size and color standing out from the middle like spokes, a globe
// at the bottom, and a "Docs" sign over it. E at it opens the project's Markdown to read
// (ui/bookshelf.ts).

export interface BookshelfModel {
  group: THREE.Group;
  collider: Collider;
  interactable: Interactable;
}

const SPINES = ['#b5413b', '#2a6f97', '#2d6a4f', '#e9c46a', '#6a4c93', '#f4a261', '#264653', '#ef476f', '#8ecae6', '#fffaf3'];
/** The frame's edges, the foot it stands on, the grid's spacing and wire, and how deep the channel the books stand in is. */
const BAR = 0.022;
const FOOT = 0.06;
const MESH = 0.1;
const WIRE = 0.007;
const CHANNEL = 0.46;

export function buildBookshelf(): BookshelfModel {
  const { width: W, depth: D, height: H } = BOOKSHELF;
  // Seeded, so the shelf looks the same in every browser.
  let seed = 20250928;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];

  // Built facing +z, back against z = -D/2, the ring's middle (cy) up off the floor on its foot.
  const R = W / 2;
  const r = R - CHANNEL;
  const cy = FOOT + R;
  const parts = new THREE.Group();
  const steel = toon('#8f969f');
  const ring = (radius: number, tube: number, z: number) => parts.add(mesh(new THREE.TorusGeometry(radius, tube, 6, 72), steel, 0, cy, z, false));
  const rod = (len: number, x: number, y: number, z: number, along: 'x' | 'z', turn = 0) => {
    const m = mesh(new THREE.CylinderGeometry(WIRE, WIRE, len, 4), steel, x, y, z, false);
    if (along === 'z') m.rotation.x = Math.PI / 2;
    else m.rotation.z = turn;
    parts.add(m);
  };

  // The frame's edges: round the front and the back of the outside and of the inside.
  for (const z of [-D / 2 + BAR, D / 2 - BAR]) {
    ring(R, BAR, z);
    ring(r, BAR, z);
  }
  // The grid round the outside and the inside: rings every so deep, and wires front to back every so far round.
  for (let z = -D / 2 + MESH; z < D / 2 - 0.02; z += MESH) {
    ring(R, WIRE, z);
    ring(r, WIRE, z);
  }
  for (const radius of [R, r]) {
    const n = Math.round((2 * Math.PI * radius) / MESH);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      rod(D - 2 * BAR, Math.cos(a) * radius, cy + Math.sin(a) * radius, 0, 'z');
    }
  }
  // Across the back: rings between the inside and the outside, and spokes out from the one to the other.
  const back = -D / 2 + WIRE;
  for (let radius = r + MESH; radius < R - 0.02; radius += MESH) ring(radius, WIRE, back);
  const spokes = Math.round((2 * Math.PI * R) / (MESH * 1.6));
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2;
    const mid = (R + r) / 2;
    rod(R - r, Math.cos(a) * mid, cy + Math.sin(a) * mid, back, 'x', a - Math.PI / 2);
  }
  // The foot it stands on, under the bottom of the ring.
  parts.add(mesh(new THREE.BoxGeometry(0.7, FOOT, D + 0.06), steel, 0, FOOT / 2, 0));

  // The books, all the way round: each standing on the outside of the ring (its bottom out, its top in
  // toward the middle), spine to the front, but for the globe at the very bottom.
  const front = D / 2 - 0.03;
  const room = CHANNEL - 0.05;
  const mid = (R + r) / 2;
  const globeAt = -Math.PI / 2;
  const globeGap = 0.34 / mid;
  let a = globeAt + globeGap / 2;
  const end = globeAt + Math.PI * 2 - globeGap / 2;
  while (a < end) {
    const t = 0.035 + rand() * 0.04;
    const h = room * (0.62 + rand() * 0.38);
    const d = 0.2 + rand() * 0.08;
    // How far round the book takes, measured where it's thickest: at its bottom, on the outside.
    const da = t / (R - 0.02);
    if (a + da > end) break;
    const at = a + da / 2;
    const book = mesh(new THREE.BoxGeometry(t, h, d), toon(pick(SPINES)), Math.cos(at) * (R - h / 2), cy + Math.sin(at) * (R - h / 2), front - d / 2);
    // Its height along the spoke, bottom outward.
    book.rotation.z = at + Math.PI / 2;
    parts.add(book);
    // A band across some spines, near the top.
    if (rand() < 0.3) {
      const band = mesh(new THREE.BoxGeometry(t + 0.004, 0.016, d + 0.004), toon('#e9c46a'), Math.cos(at) * (R - h * 0.82), cy + Math.sin(at) * (R - h * 0.82), front - d / 2);
      band.rotation.z = book.rotation.z;
      parts.add(band);
    }
    a += da + (rand() < 0.08 ? 0.012 : 0.002);
  }
  // The globe on its stand, at the bottom of the ring.
  const bottom = cy - R + BAR;
  parts.add(mesh(new THREE.BoxGeometry(0.16, 0.03, 0.16), steel, 0, bottom + 0.015, 0));
  parts.add(mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.07, 6), steel, 0, bottom + 0.06, 0));
  parts.add(mesh(new THREE.SphereGeometry(0.11, 14, 10), toon('#4cc9f0'), 0, bottom + 0.18, 0));
  parts.add(mesh(new THREE.SphereGeometry(0.075, 10, 8), toon('#80b918'), 0.03, bottom + 0.21, 0.05));

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

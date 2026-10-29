import * as THREE from 'three';
import { FLOOR, ORGAN } from '../../shared/layout';
import { mergeByMaterial, mesh, textPlane, toon, toonUnique } from './toon';
import type { Collider, Interactable } from './office';

// The pipe organ: a swallow's nest of tin pipes in a walnut case, hung high on the north wall over the
// boards, and its console out on the floor in front of the task queue. E at the console plays the
// opening of Bach's Toccata in D minor for everyone on the floor, and the pipes light up as they sound.

const WALNUT = '#6b3f2a';
const DARK = '#3d2417';
const GOLD = '#e9b949';
const TIN = '#dfe4ea';
const INK = '#2b2d42';
const IVORY = '#fffaf0';
const MAPLE = '#e8c99b';

/** One note of a piece: when it starts and how long it sounds, in seconds, and its pitch (MIDI). */
export interface OrganNote {
  t: number;
  d: number;
  n: number;
}

/**
 * The opening of Bach's Toccata in D minor (BWV 565): the mordent and the run down, three times, an
 * octave lower each time, then the low D in the pedals with a diminished seventh piled up over it,
 * that resolves to D minor on the whole organ. The hands play every line in octaves.
 */
export const TOCCATA: OrganNote[] = toccata();
export const TOCCATA_LENGTH = Math.max(...TOCCATA.map((n) => n.t + n.d));

function toccata(): OrganNote[] {
  const notes: OrganNote[] = [];
  let t = 0;
  const play = (d: number, n: number) => {
    notes.push({ t, d, n }, { t, d, n: n - 12 });
    t += d;
  };
  for (const o of [0, -12, -24]) {
    play(0.11, 81 + o);
    play(0.11, 79 + o);
    play(1.25, 81 + o);
    t += 0.3;
    // The middle one turns the other way on its way down.
    const run: [number, number][] = o === -12 ? [[76, 0.16], [77, 0.16]] : [[79, 0.13], [77, 0.13], [76, 0.13], [74, 0.13]];
    for (const [n, d] of run) play(d, n + o);
    play(0.5, 73 + o);
    play(1.3, 74 + o);
    t += o === -24 ? 0.2 : 0.5;
  }
  const pedal = t;
  const stack = [49, 52, 55, 58, 61, 64, 67];
  const resolve = pedal + 0.6 + stack.length * 0.14 + 1.6;
  stack.forEach((n, i) => {
    const at = pedal + 0.6 + i * 0.14;
    notes.push({ t: at, d: resolve - at, n });
  });
  const end = resolve + 2.8;
  for (const n of [50, 53, 57, 62, 65, 69, 74]) notes.push({ t: resolve, d: end - resolve, n });
  for (const n of [26, 38]) notes.push({ t: pedal, d: end - pedal, n });
  return notes;
}

/** Which pipes light up for a note: the deepest in the big middle tower, the highest in the flats between the towers. */
function register(n: number): number {
  return n < 45 ? 0 : n < 57 ? 1 : n < 69 ? 2 : 3;
}

export interface Organ {
  group: THREE.Group;
  colliders: Collider[];
  /** At the console: press E to play. */
  interactable: Interactable;
  /** Where it sounds from: the middle of the pipes. */
  readonly pipes: { x: number; y: number; z: number };
  /** Something's playing on it now. */
  readonly playing: boolean;
  /** Plays the Toccata, lighting each pipe as it sounds (the sound is sound.ts's). */
  play(): void;
  update(dt: number): void;
}

/** A tower of pipes standing out from the case, `u` along the wall from its middle. */
interface Tower {
  u: number;
  r: number;
  /** Where the pipes stand, and where the tallest one's top is. */
  base: number;
  top: number;
  /** Hung lower than the case, it has a carved bracket under it down to here. */
  drop?: number;
  pipeR: number;
  lit: number;
}

/** A flat of pipes in the case between two towers, their tops in a V or an arch. */
interface Flat {
  u0: number;
  u1: number;
  ends: number;
  middle: number;
}

/** The organ, as the office has it: the pipes on the north wall, the console out on the floor in front of them. */
export function buildOrgan(): Organ {
  const group = new THREE.Group();
  const tins = [0, 1, 2, 3].map(() => {
    const m = toonUnique(TIN);
    m.emissive = new THREE.Color('#ffcf6e');
    m.emissiveIntensity = 0;
    return m;
  });
  const nest = buildNest(tins);
  nest.position.set(ORGAN.x, 0, FLOOR.minZ);
  group.add(nest);

  const { group: stand, lamp } = buildConsole();
  const c = ORGAN.console;
  stand.position.set(c.x, 0, c.z);
  group.add(stand);
  const interactable: Interactable = { kind: 'organ', x: c.x, z: c.z + 1.9, radius: 1.6 };
  stand.userData.interact = interactable;
  // The console, and the pedals and bench in front of it.
  const colliders: Collider[] = [{ minX: c.x - c.width / 2, maxX: c.x + c.width / 2, minZ: c.z - c.depth / 2, maxZ: c.z + 1.2, top: 1.3 }];

  /** How far into the piece it is, or -1 when nothing's playing. */
  let at = -1;
  const lit = [0, 0, 0, 0];
  return {
    group,
    colliders,
    interactable,
    pipes: { x: ORGAN.x, y: 5.6, z: FLOOR.minZ + 0.8 },
    get playing() {
      return at >= 0;
    },
    play() {
      at = 0;
    },
    update(dt) {
      if (at >= 0) {
        at += dt;
        if (at > TOCCATA_LENGTH + 0.5) at = -1;
      }
      for (let g = 0; g < 4; g++) {
        const on = at >= 0 && TOCCATA.some((n) => register(n.n) === g && at >= n.t && at < n.t + n.d);
        // Quick to light as a pipe speaks, slower to fade as it dies away in the room.
        lit[g] += ((on ? 1 : 0) - lit[g]) * (1 - Math.exp(-dt * (on ? 18 : 4)));
        tins[g].emissiveIntensity = lit[g] * 0.75;
      }
      lamp.emissiveIntensity = at >= 0 ? 1 : 0.3;
    },
  };
}

/** The case on the wall with its towers and flats of pipes, in the frame of the wall: x along it from the middle, +z out into the room. */
function buildNest(tins: THREE.MeshToonMaterial[]): THREE.Group {
  const raw = new THREE.Group();
  const walnut = toon(WALNUT);
  const dark = toon(DARK);
  const gold = toon(GOLD);
  const ink = toon(INK);
  const D = ORGAN.depth;
  const W = ORGAN.width;
  const bottom = ORGAN.bottom;
  const deck = bottom + 0.5;
  const cornice = 6.42;
  const box = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number) => raw.add(mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z));

  // The case: a panelled front with gold mouldings, the pipes standing on its top, a dark back behind them.
  box(W, deck - bottom, D, walnut, 0, (bottom + deck) / 2, D / 2);
  box(W + 0.04, 0.04, D + 0.04, gold, 0, bottom + 0.02, D / 2);
  box(W + 0.04, 0.05, D + 0.04, gold, 0, deck - 0.025, D / 2);
  box(W, cornice - deck, 0.06, dark, 0, (deck + cornice) / 2, 0.03);

  // Towers, mirrored either side of the big one in the middle: the inner pair over the gaps between the
  // boards hang lower, on carved brackets, and the outer pair stand at the ends.
  const towers: Tower[] = [
    { u: 0, r: 1.2, base: bottom + 0.17, top: 6.45, pipeR: 0.1, lit: 0 },
    ...[-1, 1].flatMap((s): Tower[] => [
      { u: s * 3.9, r: 0.8, base: 4.3, top: 6.3, drop: ORGAN.low, pipeR: 0.085, lit: 1 },
      { u: s * 10, r: 0.75, base: bottom + 0.17, top: 6.15, pipeR: 0.075, lit: 2 },
    ]),
  ];
  for (const t of towers) tower(raw, t, tins[t.lit], { walnut, dark, gold, ink }, D);

  // Flats of smaller pipes between the towers, with gilded fretwork over them up to the cornice.
  const flats: Flat[] = [-1, 1].flatMap((s): Flat[] =>
    (
      [
        [1.25, 3.05, 6.15, 5.85],
        [4.75, 6.9, 5.8, 6.1],
        [7.05, 9.2, 6.1, 5.8],
      ] as const
    ).map(([a, b, ends, middle]) => ({ u0: s > 0 ? a : -b, u1: s > 0 ? b : -a, ends, middle })),
  );
  for (const f of flats) {
    const r = 0.055;
    const n = Math.floor((f.u1 - f.u0) / (2 * r + 0.025));
    const step = (f.u1 - f.u0) / n;
    const tops: [number, number][] = [];
    for (let i = 0; i < n; i++) {
      const x = f.u0 + step * (i + 0.5);
      const k = (2 * (i + 0.5)) / n - 1;
      const top = f.middle + (f.ends - f.middle) * k * k;
      pipe(raw, tins[3], ink, x, deck, D - 0.16, top, r, 0);
      tops.push([x, top]);
    }
    // The fretwork follows the pipe tops a little above them.
    const veil = new THREE.Shape();
    veil.moveTo(f.u0, cornice);
    veil.lineTo(f.u0, tops[0][1] + 0.12);
    for (const [x, top] of tops) veil.lineTo(x, top + 0.08);
    veil.lineTo(f.u1, tops[tops.length - 1][1] + 0.12);
    veil.lineTo(f.u1, cornice);
    raw.add(mesh(new THREE.ExtrudeGeometry(veil, { depth: 0.03, bevelEnabled: false }), gold, 0, 0, D - 0.06, false));
    // The cornice over the flat, and a recessed panel on the case below it.
    box(f.u1 - f.u0, 0.14, D, walnut, (f.u0 + f.u1) / 2, cornice + 0.07, D / 2);
    box(f.u1 - f.u0 + 0.02, 0.035, D + 0.02, gold, (f.u0 + f.u1) / 2, cornice + 0.14, D / 2);
    box(f.u1 - f.u0 - 0.24, 0.26, 0.02, dark, (f.u0 + f.u1) / 2, (bottom + deck) / 2, D + 0.01);
  }
  // A carved post between the two outer flats either side.
  for (const s of [-1, 1]) box(0.13, cornice + 0.14 - deck, 0.14, walnut, s * 6.975, (deck + cornice + 0.14) / 2, D - 0.07);

  return mergeByMaterial(raw);
}

/** One of the towers: its pipes round a half circle, a crown on top and a bracket or a plinth below. */
function tower(into: THREE.Group, t: Tower, tin: THREE.Material, m: { walnut: THREE.Material; dark: THREE.Material; gold: THREE.Material; ink: THREE.Material }, depth: number) {
  // The half circle's middle is just inside the case's front, so the tower stands well out of it.
  const cz = depth - t.r * 0.35;
  const half = (rTop: number, rBottom: number, h: number, mat: THREE.Material, y: number) => {
    into.add(mesh(new THREE.CylinderGeometry(rTop, rBottom, h, 28, 1, false, -Math.PI / 2, Math.PI), mat, t.u, y, cz));
    // And the straight part from the wall out to it.
    into.add(mesh(new THREE.BoxGeometry(2 * Math.max(rTop, rBottom), h, cz), mat, t.u, y, cz / 2));
  };
  // The plinth the pipes stand on, with a gold edge.
  half(t.r + 0.08, t.r + 0.08, 0.15, m.walnut, t.base - 0.075);
  half(t.r + 0.1, t.r + 0.1, 0.035, m.gold, t.base - 0.01);
  // Hung lower than the case: a bracket tapering down to a gilded knob.
  if (t.drop !== undefined) {
    const h = t.base - 0.15 - (t.drop + 0.08);
    const y = t.drop + 0.08 + h / 2;
    into.add(mesh(new THREE.CylinderGeometry(t.r + 0.05, 0.1, h, 28, 1, false, -Math.PI / 2, Math.PI), m.walnut, t.u, y, cz));
    const back = new THREE.CylinderGeometry(Math.SQRT1_2, Math.SQRT1_2 * 0.12, h, 4, 1).rotateY(Math.PI / 4);
    back.scale(2 * (t.r + 0.05), 1, cz);
    into.add(mesh(back, m.walnut, t.u, y, cz / 2));
    into.add(mesh(new THREE.SphereGeometry(0.1, 12, 8), m.gold, t.u, t.drop + 0.08, cz, false));
  }
  // Behind the pipes, the tower's own dark back.
  into.add(mesh(new THREE.BoxGeometry(2 * t.r, t.top - t.base, 0.04), m.dark, t.u, (t.base + t.top) / 2, cz - 0.02));
  // The pipes round the front, the tallest in the middle.
  const R = t.r - t.pipeR - 0.04;
  const spread = 1.3;
  const n = Math.floor((2 * spread * R) / (2 * t.pipeR + 0.025));
  for (let i = 0; i < n; i++) {
    const a = -spread + (2 * spread * (i + 0.5)) / n;
    const k = a / spread;
    const top = t.top - (t.top - t.base) * 0.15 * k * k;
    pipe(into, tin, m.ink, t.u + Math.sin(a) * R, t.base, cz + Math.cos(a) * R, top, t.pipeR, a);
  }
  // The crown: a moulded cornice with a gold rim, and a gilded finial on top.
  half(t.r + 0.06, t.r + 0.14, 0.16, m.walnut, t.top + 0.08);
  half(t.r + 0.15, t.r + 0.15, 0.04, m.gold, t.top + 0.17);
  into.add(mesh(new THREE.SphereGeometry(0.09, 12, 8), m.gold, t.u, Math.min(t.top + 0.3, 6.7), cz, false));
}

/** A front pipe standing at (x, y, z) up to `top`: a cone foot, the mouth facing `face` (0 is +z), and the body. */
function pipe(into: THREE.Group, tin: THREE.Material, ink: THREE.Material, x: number, y: number, z: number, top: number, r: number, face: number) {
  const len = top - y;
  const foot = Math.min(len * 0.3, 0.45);
  into.add(mesh(new THREE.CylinderGeometry(r, r * 0.22, foot, 10), tin, x, y + foot / 2, z, false));
  into.add(mesh(new THREE.CylinderGeometry(r, r, len - foot, 12), tin, x, y + foot + (len - foot) / 2, z, false));
  const mouth = mesh(new THREE.BoxGeometry(r * 1.1, r * 1.4, 0.012), ink, x + Math.sin(face) * r, y + foot + r * 0.8, z + Math.cos(face) * r, false);
  mouth.rotation.y = face;
  into.add(mouth);
}

/** The console: three manuals and the stops in a walnut case, the pedals under the bench. The keys face +z. */
function buildConsole(): { group: THREE.Group; lamp: THREE.MeshToonMaterial } {
  const raw = new THREE.Group();
  const walnut = toon(WALNUT);
  const dark = toon(DARK);
  const gold = toon(GOLD);
  const ink = toon(INK);
  const ivory = toon(IVORY);
  const { width: W, depth: D } = ORGAN.console;
  const box = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, shadow = true) => {
    const b = mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z, shadow);
    raw.add(b);
    return b;
  };

  // The case: its back, up to a lid, and a cheek either side of the keys.
  box(W, 1.25, 0.4, walnut, 0, 0.625, -D / 2 + 0.2);
  box(W + 0.08, 0.06, 0.5, walnut, 0, 1.28, -D / 2 + 0.22);
  box(W + 0.1, 0.03, 0.52, gold, 0, 1.24, -D / 2 + 0.22, false);
  for (const s of [-1, 1]) box(0.12, 1.05, D, walnut, s * (W / 2 - 0.06), 0.525, 0);
  box(W - 0.24, 0.07, 0.55, dark, 0, 0.72, 0.12);

  // Three manuals stepped up and back, each a row of white keys with the black ones over them.
  const keysW = 1.45;
  const whites = 33;
  const ww = keysW / whites;
  for (let m = 0; m < 3; m++) {
    const y = 0.78 + m * 0.075;
    const front = D / 2 - 0.03 - m * 0.11;
    box(keysW + 0.02, 0.025, 0.17, ink, 0, y - 0.015, front - 0.085, false);
    for (let w = 0; w < whites; w++) box(ww - 0.004, 0.022, 0.16, ivory, -keysW / 2 + ww * (w + 0.5), y, front - 0.08, false);
    for (let w = 0; w < whites - 1; w++) if ([0, 1, 3, 4, 5].includes(w % 7)) box(ww * 0.55, 0.02, 0.095, ink, -keysW / 2 + ww * (w + 1), y + 0.02, front - 0.115, false);
  }

  // The stops either side of the music desk, in two rows: white faces in coloured rims.
  for (const s of [-1, 1]) {
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < 5; i++) {
        const x = s * (0.4 + i * 0.09);
        const y = 1.03 + row * 0.1;
        const knob = mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.05, 12).rotateX(Math.PI / 2), (i + row) % 3 ? ink : toon('#b23a48'), x, y, -D / 2 + 0.425, false);
        raw.add(knob);
        raw.add(mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.012, 12).rotateX(Math.PI / 2), ivory, x, y, -D / 2 + 0.455, false));
      }
    }
  }
  // The music desk, with the Toccata open on it.
  const desk = box(0.62, 0.3, 0.025, walnut, 0, 1.1, -D / 2 + 0.43);
  desk.rotation.x = -0.18;
  const music = textPlane('🎼 BWV 565', { bg: IVORY, size: 40 });
  music.scale.multiplyScalar(0.3);
  music.position.set(0, 1.11, -D / 2 + 0.448);
  music.rotation.x = -0.18;

  // The pedals on the floor under the bench: light naturals, with the sharps raised dark between them.
  const pedalW = 1.36;
  box(pedalW + 0.08, 0.05, 0.66, dark, 0, 0.025, D / 2 + 0.33);
  const naturals = 17;
  const pw = pedalW / naturals;
  for (let i = 0; i < naturals; i++) box(pw - 0.012, 0.035, 0.6, toon(MAPLE), -pedalW / 2 + pw * (i + 0.5), 0.065, D / 2 + 0.33);
  for (let i = 0; i < naturals - 1; i++) if ([0, 1, 3, 4, 5].includes(i % 7)) box(pw * 0.6, 0.07, 0.28, ink, -pedalW / 2 + pw * (i + 1), 0.09, D / 2 + 0.17);

  // The bench over them.
  box(1.5, 0.06, 0.36, walnut, 0, 0.62, D / 2 + 0.55);
  for (const s of [-1, 1]) box(0.05, 0.6, 0.32, walnut, s * 0.74, 0.3, D / 2 + 0.55);

  const group = mergeByMaterial(raw);
  group.add(music);
  // A brass reading lamp over the music, lit while it plays.
  const lampMat = toonUnique('#fff2c4');
  lampMat.emissive = new THREE.Color('#ffd27a');
  lampMat.emissiveIntensity = 0.3;
  group.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 6), gold, 0, 1.4, -D / 2 + 0.28, false));
  const shade = mesh(new THREE.CylinderGeometry(0.05, 0.11, 0.07, 16, 1, true), gold, 0, 1.5, -D / 2 + 0.3, false);
  group.add(shade);
  group.add(mesh(new THREE.SphereGeometry(0.04, 10, 8), lampMat, 0, 1.475, -D / 2 + 0.3, false));
  return { group, lamp: lampMat };
}

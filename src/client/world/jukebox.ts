import * as THREE from 'three';
import { JUKEBOX } from '../../shared/layout';
import { mesh, textSprite, toon, toonUnique } from './toon';
import type { Collider, Interactable } from './office';
import { TYPEFACE, WEIGHT } from '../typeface';

// The lounge jukebox: a giant AirPod standing on its stem on a round plinth, glossy white, with a
// light ring round the plinth that glows to the beat while it plays, a label on the plinth's front
// saying what's on, and notes floating up out of it.

export interface JukeboxView {
  group: THREE.Group;
  collider: Collider;
  interactable: Interactable;
  /** What the label says, and whether the lights are on. */
  show(on: boolean, title: string): void;
  /** `beat` runs 1 → 0 after each beat while music plays (see OfficeSound.beat). */
  update(t: number, dt: number, beat: number): void;
}

const NOTES = ['♪', '♫', '♪', '♬', '♫'];
/** How much bigger than it's modelled the AirPod stands: as tall as JUKEBOX.height, on its plinth. */
const POD_SCALE = 1.45;

export function buildJukebox(): JukeboxView {
  const { width: W, depth: D, height: H } = JUKEBOX;
  const r = W / 2;
  const group = new THREE.Group();

  // The plinth: a low dark drum, and the light ring round its top.
  const P = 0.26;
  group.add(mesh(new THREE.CylinderGeometry(r, r + 0.02, P, 48), toon('#2b2d42'), 0, P / 2, 0));
  const neon = toonUnique('#ffd166');
  neon.emissive = new THREE.Color('#ffd166');
  const ring = mesh(new THREE.TorusGeometry(r - 0.03, 0.022, 8, 64), neon, 0, P, 0, false);
  ring.rotation.x = Math.PI / 2;
  group.add(ring);

  // The AirPod, its stem standing on the plinth: glossy white, a silver cap at the stem's foot,
  // and the bud on top leaning back, its dark speaker mesh and a vent turned to the room.
  const white = toon('#f7f7f5');
  const silver = toon('#c9ccd1');
  const dark = toon('#23252b');
  const pod = new THREE.Group();
  const stemR = 0.12;
  const stemLen = 1.0;
  pod.add(mesh(new THREE.CylinderGeometry(stemR * 0.96, stemR * 0.96, 0.05, 32), silver, 0, 0.025, 0));
  const stem = mesh(new THREE.CapsuleGeometry(stemR, stemLen, 8, 32), white, 0, stemR + stemLen / 2, 0);
  stem.scale.z = 0.85;
  pod.add(stem);
  // The bud: an egg the stem runs up into at its front, set off to the side the ear's on.
  const top = stemLen + 2 * stemR;
  const budAt = new THREE.Vector3(-0.1, top + 0.02, -0.07);
  const bud = mesh(new THREE.SphereGeometry(0.31, 40, 28), white, budAt.x, budAt.y, budAt.z);
  bud.scale.set(1.08, 0.94, 1);
  pod.add(bud);
  // The nozzle into the ear, out of the bud's side and a little down, with a dark mesh over its end.
  const nozzle = new THREE.Group();
  nozzle.add(mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.16, 32), white, 0, 0.08, 0));
  nozzle.add(mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.02, 32), dark, 0, 0.165, 0));
  nozzle.position.set(budAt.x + 0.24, budAt.y - 0.04, budAt.z + 0.03);
  nozzle.rotation.z = -Math.PI / 2 + 0.35;
  pod.add(nozzle);
  // The dark grille across the top of the bud's front, and the sensor.
  const vent = mesh(new THREE.CapsuleGeometry(0.022, 0.1, 4, 12), dark, budAt.x - 0.02, budAt.y + 0.13, budAt.z + 0.27, false);
  vent.rotation.z = Math.PI / 2;
  pod.add(vent);
  pod.add(mesh(new THREE.SphereGeometry(0.028, 12, 8), dark, budAt.x - 0.2, budAt.y + 0.02, budAt.z + 0.23, false));
  pod.position.y = P;
  pod.scale.setScalar(POD_SCALE);
  // Its nozzle side to the south, so from the room you see it in profile.
  pod.rotation.y = 0.25;
  group.add(pod);

  // The label on the plinth's front: what's playing.
  const front = r + 0.012;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  // Round the plinth's curve, a strip 0.64 m long.
  const arc = 0.64 / front;
  const screen = new THREE.Mesh(new THREE.CylinderGeometry(front, front, 0.16, 24, 1, true, -arc / 2, arc), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  screen.position.set(0, P / 2, 0);
  group.add(screen);

  // Notes drift up out of the top while it plays.
  const notes = NOTES.map((n, i) => {
    const s = textSprite(n, { color: ['#ef476f', '#4f86f7', '#06d6a0', '#9d4edd', '#ff8a5b'][i], size: 96 });
    s.scale.multiplyScalar(0.55);
    s.visible = false;
    group.add(s);
    return s;
  });

  // Built facing +z; it stands against the east wall facing into the room (-x).
  group.position.set(JUKEBOX.x, 0, JUKEBOX.z);
  group.rotation.y = -Math.PI / 2;
  const collider: Collider = { minX: JUKEBOX.x - D / 2 - 0.05, maxX: JUKEBOX.x + D / 2 + 0.05, minZ: JUKEBOX.z - r - 0.05, maxZ: JUKEBOX.z + r + 0.05, top: H };
  const interactable: Interactable = { kind: 'jukebox', x: JUKEBOX.x - 1.2, z: JUKEBOX.z, radius: 1.6 };
  group.userData.interact = interactable;

  let on = false;
  let shown = '';
  const paint = (title: string) => {
    const g = canvas.getContext('2d')!;
    g.fillStyle = '#1b1d2e';
    g.fillRect(0, 0, 512, 128);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = on ? '#ffffff' : '#8d99ae';
    let size = 58;
    const text = on ? `♪ ${title}` : 'press E to play';
    do g.font = `${WEIGHT} ${size--}px ${TYPEFACE}`;
    while (g.measureText(text).width > 480 && size > 24);
    g.fillText(text, 256, 66);
    tex.needsUpdate = true;
  };

  const show = (playing: boolean, title: string) => {
    const k = `${playing}|${title}`;
    if (k === shown) return;
    shown = k;
    on = playing;
    paint(title);
    // Lit, the glow is the color; dark, it's a dull grey ring.
    neon.color.set(on ? '#1b1d2e' : '#8d99ae');
    if (!on) {
      neon.emissive.set('#000000');
      for (const n of notes) n.visible = false;
    }
  };
  show(false, '');

  const update = (t: number, _dt: number, beat: number) => {
    if (!on) return;
    // The ring slowly runs through the colors and flares on every beat.
    neon.emissive.setHSL((t * 0.05) % 1, 0.85, 0.55);
    neon.emissiveIntensity = 0.55 + 0.9 * beat;
    notes.forEach((n, i) => {
      const k = (t * 0.35 + i / notes.length) % 1;
      n.visible = true;
      n.position.set(Math.sin(t * 1.3 + i * 2.1) * 0.35, H + 0.15 + k * 1.3, 0);
      n.material.opacity = Math.min(1, k * 5) * (1 - k);
    });
  };

  return { group, collider, interactable, show, update };
}

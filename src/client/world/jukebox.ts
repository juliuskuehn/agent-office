import * as THREE from 'three';
import { JUKEBOX } from '../../shared/layout';
import { mesh, textSprite, toon, toonUnique } from './toon';
import type { Collider, Interactable } from './office';

// The lounge jukebox: a giant AirPod lying on its side on the floor by the east wall, glossy white,
// its stem along the wall and its ear nozzle turned up to the room. The mesh over the nozzle glows
// and runs through the colors to the beat while it plays, and notes float up out of it.

export interface JukeboxView {
  group: THREE.Group;
  collider: Collider;
  interactable: Interactable;
  /** Whether it's playing (the HUD says what). */
  show(on: boolean, title: string): void;
  /** `beat` runs 1 → 0 after each beat while music plays (see OfficeSound.beat). */
  update(t: number, dt: number, beat: number): void;
}

const NOTES = ['♪', '♫', '♪', '♬', '♫'];
/** How much bigger than it's modelled the AirPod lies: JUKEBOX.width long. */
const POD_SCALE = 1.9;

export function buildJukebox(): JukeboxView {
  const { width: W, depth: D, height: H } = JUKEBOX;
  const r = W / 2;
  const group = new THREE.Group();

  // The glow in the nozzle's mesh: dull grey, lit up and colored while it plays.
  const neon = toonUnique('#8d99ae');
  neon.emissive = new THREE.Color('#000000');

  // The AirPod as it's modelled, standing on its stem: a silver cap at the stem's foot, and the bud
  // on top with its nozzle out of the side (+x).
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
  // The nozzle into the ear, out of the bud's side and a little down, with the glowing mesh over its end.
  const nozzle = new THREE.Group();
  nozzle.add(mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.16, 32), white, 0, 0.08, 0));
  nozzle.add(mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.02, 32), neon, 0, 0.165, 0, false));
  nozzle.position.set(budAt.x + 0.24, budAt.y - 0.04, budAt.z + 0.03);
  nozzle.rotation.z = -Math.PI / 2 + 0.35;
  pod.add(nozzle);
  // The dark grille across the top of the bud's front, and the sensor.
  const vent = mesh(new THREE.CapsuleGeometry(0.022, 0.1, 4, 12), dark, budAt.x - 0.02, budAt.y + 0.13, budAt.z + 0.27, false);
  vent.rotation.z = Math.PI / 2;
  pod.add(vent);
  pod.add(mesh(new THREE.SphereGeometry(0.028, 12, 8), dark, budAt.x - 0.2, budAt.y + 0.02, budAt.z + 0.23, false));

  // Laid down on its side: turned on its stem so the nozzle ends up pointing up and out to the room,
  // then tipped over along the wall (+x here), the bud end a little up, as the bud's the wider.
  pod.rotation.y = (-3 * Math.PI) / 4;
  const lying = new THREE.Group();
  lying.add(pod);
  lying.rotation.z = -Math.PI / 2 + Math.atan((0.33 - stemR) / top) + 0.07;
  lying.scale.setScalar(POD_SCALE);
  group.add(lying);
  // Centred on its spot, and down on the floor.
  lying.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(lying, true);
  lying.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);

  // Notes drift up out of the top while it plays.
  const notes = NOTES.map((n, i) => {
    const s = textSprite(n, { color: ['#ef476f', '#4f86f7', '#06d6a0', '#9d4edd', '#ff8a5b'][i], size: 96 });
    s.scale.multiplyScalar(0.55);
    s.visible = false;
    group.add(s);
    return s;
  });

  // Built facing +z; it lies along the east wall facing into the room (-x).
  group.position.set(JUKEBOX.x, 0, JUKEBOX.z);
  group.rotation.y = -Math.PI / 2;
  const collider: Collider = { minX: JUKEBOX.x - D / 2 - 0.05, maxX: JUKEBOX.x + D / 2 + 0.05, minZ: JUKEBOX.z - r - 0.05, maxZ: JUKEBOX.z + r + 0.05, top: H };
  const interactable: Interactable = { kind: 'jukebox', x: JUKEBOX.x - 1.2, z: JUKEBOX.z, radius: 1.6 };
  group.userData.interact = interactable;

  let on = true;
  const show = (playing: boolean) => {
    if (playing === on) return;
    on = playing;
    // Lit, the glow is the color; dark, it's a dull grey mesh.
    neon.color.set(on ? '#1b1d2e' : '#8d99ae');
    if (!on) {
      neon.emissive.set('#000000');
      for (const n of notes) n.visible = false;
    }
  };
  show(false);

  const update = (t: number, _dt: number, beat: number) => {
    if (!on) return;
    // The mesh slowly runs through the colors and flares on every beat.
    neon.emissive.setHSL((t * 0.05) % 1, 0.85, 0.55);
    neon.emissiveIntensity = 0.55 + 0.9 * beat;
    notes.forEach((n, i) => {
      const k = (t * 0.35 + i / notes.length) % 1;
      n.visible = true;
      n.position.set(W * 0.3 + Math.sin(t * 1.3 + i * 2.1) * 0.35, H + 0.15 + k * 1.3, 0);
      n.material.opacity = Math.min(1, k * 5) * (1 - k);
    });
  };

  return { group, collider, interactable, show, update };
}

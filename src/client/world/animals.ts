import * as THREE from 'three';
import { mesh, toon } from './toon';

// The office's workers are animals: each one a dog, a cat, a fox, a bear, a bunny or a panda, the same
// one every time for the same name. They keep the worker's round body, its big eyes and its moves
// (see Worker in character.ts); this is what makes one an animal: its fur, its ears, its muzzle and
// nose, a tail (which wags), a paler belly, and a collar in the worker's own color.

export type Species = 'dog' | 'cat' | 'fox' | 'bear' | 'bunny' | 'panda';

interface Look {
  /** Its coats, one picked by name: the fur all over, and the paler muzzle and belly. */
  coats: readonly { fur: string; light: string }[];
  /** Its paws, when they're not its fur's color (a panda's black ones). */
  limbs?: string;
  ears: 'floppy' | 'pointy' | 'round' | 'long';
  /** The ears' color, when it isn't the fur's. */
  earColor?: string;
  muzzle: 'snout' | 'whiskers' | 'pointed' | 'round';
  tail: 'wag' | 'curl' | 'bushy' | 'stub' | 'puff';
}

const LOOKS: Record<Species, Look> = {
  dog: {
    coats: [
      { fur: '#c68642', light: '#f3dcb8' },
      { fur: '#e8d3b0', light: '#fff6e8' },
      { fur: '#4a3a2e', light: '#c9a27c' },
    ],
    ears: 'floppy',
    muzzle: 'snout',
    tail: 'wag',
  },
  cat: {
    coats: [
      { fur: '#f29b4b', light: '#fbe3c8' },
      { fur: '#8d949e', light: '#e6e8eb' },
      { fur: '#2d2e33', light: '#e9e6e1' },
    ],
    ears: 'pointy',
    muzzle: 'whiskers',
    tail: 'curl',
  },
  fox: { coats: [{ fur: '#e8702a', light: '#fff4e6' }], ears: 'pointy', earColor: '#3b2a20', muzzle: 'pointed', tail: 'bushy' },
  bear: {
    coats: [
      { fur: '#8b5a3c', light: '#d8b48a' },
      { fur: '#3e3a36', light: '#b59b7c' },
    ],
    ears: 'round',
    muzzle: 'round',
    tail: 'stub',
  },
  bunny: {
    coats: [
      { fur: '#ece6de', light: '#ffffff' },
      { fur: '#b98f6b', light: '#f1e2d0' },
    ],
    ears: 'long',
    muzzle: 'whiskers',
    tail: 'puff',
  },
  panda: { coats: [{ fur: '#f4f3ef', light: '#ffffff' }], limbs: '#26272b', ears: 'round', earColor: '#26272b', muzzle: 'round', tail: 'stub' },
};

const SPECIES = Object.keys(LOOKS) as Species[];
const PINK = '#f4a3b4';
const NOSE = '#1d1d1f';

/** A number from `name`, the same every time. */
function hash(name: string): number {
  let h = 2166136261;
  for (const ch of name) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** Which animal `name` is, and its coat: the same every time for the same name. */
export function animalOf(name: string): { species: Species; fur: string; light: string; limbs?: string } {
  const h = hash(name);
  const species = SPECIES[h % SPECIES.length];
  const look = LOOKS[species];
  const coat = look.coats[Math.floor(h / SPECIES.length) % look.coats.length];
  return { species, ...coat, limbs: look.limbs };
}

export interface AnimalParts {
  /** Its ears, muzzle, belly and collar, in the body's space (forward is +z, the bean's middle at 0.55 up). */
  group: THREE.Group;
  /** Its tail's pivot, turned by `wag` (radians either way) to wag it; null for none worth wagging. */
  tail: THREE.Object3D | null;
  wag: number;
  /** How quick the wag is. */
  wagSpeed: number;
}

/**
 * What makes a worker's bean `species`: built round the bean's face (its eyes at 0.7 up, 0.11 either
 * side), in its `fur`, with a collar in `collar` (the worker's own color).
 */
export function animalParts(species: Species, fur: THREE.Material, light: string, collar: string): AnimalParts {
  const look = LOOKS[species];
  const g = new THREE.Group();
  const pale = toon(light);
  const ears = look.earColor ? toon(look.earColor) : fur;
  const nose = toon(NOSE);
  const pink = toon(PINK);

  // Ears, up on top of the head (round the headset).
  for (const sx of [-1, 1]) {
    if (look.ears === 'pointy') {
      const ear = mesh(new THREE.ConeGeometry(0.085, 0.2, 12), ears, sx * 0.16, 0.99, 0);
      ear.rotation.z = -sx * 0.32;
      g.add(ear);
      const inner = mesh(new THREE.ConeGeometry(0.045, 0.12, 10), pink, sx * 0.155, 0.975, 0.035, false);
      inner.rotation.z = -sx * 0.32;
      g.add(inner);
    } else if (look.ears === 'floppy') {
      const ear = mesh(new THREE.SphereGeometry(0.13, 14, 10), toon(new THREE.Color(light).lerp(new THREE.Color('#3a2a1e'), 0.55).getStyle()), sx * 0.25, 0.82, 0.03);
      ear.scale.set(0.42, 1, 0.7);
      ear.rotation.z = sx * 0.28;
      g.add(ear);
    } else if (look.ears === 'round') {
      const ear = mesh(new THREE.SphereGeometry(0.085, 14, 10), ears, sx * 0.19, 0.96, 0);
      ear.scale.z = 0.55;
      g.add(ear);
    } else {
      const ear = mesh(new THREE.CapsuleGeometry(0.05, 0.26, 6, 12), fur, sx * 0.09, 1.13, 0);
      ear.rotation.z = -sx * 0.16;
      ear.scale.z = 0.6;
      g.add(ear);
      const inner = mesh(new THREE.CapsuleGeometry(0.028, 0.2, 4, 10), pink, sx * 0.092, 1.13, 0.024, false);
      inner.rotation.z = -sx * 0.16;
      inner.scale.z = 0.5;
      g.add(inner);
    }
  }
  // A panda's black patches round its eyes.
  if (species === 'panda') {
    for (const sx of [-1, 1]) {
      const patch = mesh(new THREE.SphereGeometry(0.11, 12, 10), nose, sx * 0.115, 0.69, 0.2, false);
      patch.scale.set(1, 1.25, 0.5);
      patch.rotation.z = sx * 0.4;
      g.add(patch);
    }
  }

  // The muzzle and nose, under the eyes.
  if (look.muzzle === 'snout') {
    const snout = mesh(new THREE.SphereGeometry(0.1, 16, 12), pale, 0, 0.575, 0.27);
    snout.scale.set(1.15, 0.85, 1.2);
    g.add(snout);
    g.add(mesh(new THREE.SphereGeometry(0.038, 12, 10), nose, 0, 0.605, 0.39, false));
    const tongue = mesh(new THREE.SphereGeometry(0.035, 10, 8), pink, 0.02, 0.51, 0.34, false);
    tongue.scale.set(1, 0.5, 0.8);
    g.add(tongue);
  } else if (look.muzzle === 'pointed') {
    const snout = mesh(new THREE.ConeGeometry(0.1, 0.2, 16), pale, 0, 0.575, 0.34);
    snout.rotation.x = Math.PI / 2;
    g.add(snout);
    g.add(mesh(new THREE.SphereGeometry(0.03, 10, 8), nose, 0, 0.58, 0.44, false));
    for (const sx of [-1, 1]) {
      const cheek = mesh(new THREE.SphereGeometry(0.08, 12, 10), pale, sx * 0.1, 0.56, 0.22);
      cheek.scale.set(1, 0.8, 0.6);
      g.add(cheek);
    }
  } else if (look.muzzle === 'round') {
    const snout = mesh(new THREE.SphereGeometry(0.1, 16, 12), pale, 0, 0.57, 0.26);
    snout.scale.set(1.15, 0.8, 0.9);
    g.add(snout);
    const n = mesh(new THREE.SphereGeometry(0.04, 12, 10), nose, 0, 0.6, 0.34, false);
    n.scale.set(1.2, 0.8, 0.8);
    g.add(n);
  } else {
    // Whisker pads, a little pink nose, and whiskers out either side (and a bunny's two teeth).
    for (const sx of [-1, 1]) g.add(mesh(new THREE.SphereGeometry(0.05, 12, 10), pale, sx * 0.038, 0.57, 0.28));
    g.add(mesh(new THREE.SphereGeometry(0.024, 10, 8), pink, 0, 0.605, 0.315, false));
    const whisker = toon('#f7f7f7');
    for (const sx of [-1, 1]) {
      for (const [dy, tilt] of [
        [0.012, 0.18],
        [-0.004, 0],
        [-0.02, -0.18],
      ]) {
        const w = mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.2, 4), whisker, sx * 0.15, 0.575 + dy, 0.3, false);
        w.rotation.z = Math.PI / 2 + sx * tilt;
        w.rotation.y = -sx * 0.25;
        g.add(w);
      }
    }
    if (species === 'bunny') for (const sx of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(0.022, 0.035, 0.01), toon('#ffffff'), sx * 0.012, 0.53, 0.31, false));
  }

  // A paler belly, and the collar with its tag.
  const belly = mesh(new THREE.SphereGeometry(0.2, 16, 12), pale, 0, 0.33, 0.17);
  belly.scale.set(1, 1.15, 0.72);
  g.add(belly);
  const band = mesh(new THREE.TorusGeometry(0.278, 0.022, 8, 32), toon(collar), 0, 0.46, 0);
  band.rotation.x = Math.PI / 2;
  g.add(band);
  g.add(mesh(new THREE.SphereGeometry(0.03, 10, 8), toon('#e9c46a', { emissive: '#5a4510' }), 0, 0.42, 0.29, false));

  // The tail, out the back.
  const pivot = new THREE.Group();
  pivot.position.set(0, 0.32, -0.25);
  g.add(pivot);
  let wag = 0;
  let wagSpeed = 0;
  if (look.tail === 'wag') {
    const tail = mesh(new THREE.CapsuleGeometry(0.035, 0.18, 4, 8), fur, 0, 0.09, -0.06);
    tail.rotation.x = -0.6;
    pivot.add(tail);
    wag = 0.45;
    wagSpeed = 11;
  } else if (look.tail === 'curl') {
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.05, -0.14), new THREE.Vector3(0, 0.25, -0.2), new THREE.Vector3(0.06, 0.4, -0.12)]);
    pivot.add(mesh(new THREE.TubeGeometry(curve, 20, 0.028, 8), fur));
    wag = 0.25;
    wagSpeed = 2.2;
  } else if (look.tail === 'bushy') {
    const tail = mesh(new THREE.SphereGeometry(0.1, 14, 10), fur, 0, 0.05, -0.16);
    tail.scale.set(0.85, 0.85, 1.9);
    tail.rotation.x = -0.5;
    pivot.add(tail);
    pivot.add(mesh(new THREE.SphereGeometry(0.06, 12, 8), pale, 0, 0.16, -0.33));
    wag = 0.3;
    wagSpeed = 3;
  } else {
    pivot.add(mesh(new THREE.SphereGeometry(look.tail === 'puff' ? 0.075 : 0.055, 12, 10), look.tail === 'puff' ? pale : fur, 0, 0, -0.02));
  }
  return { group: g, tail: wag ? pivot : null, wag, wagSpeed };
}

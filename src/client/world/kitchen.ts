import * as THREE from 'three';
import { model, paintModel, palette } from './models';
import { toon } from './toon';
import { KITCHEN } from '../../shared/layout';
import type { Collider, Interactable } from './office';

// The kitchen along the north wall's west end (see KITCHEN), modelled in Blender (blender/scripts/build_kitchen.py): a
// counter with a wooden top and a sink under the window, a chunky espresso machine (E at it pours you
// a cup, see main.ts) and a round-shouldered retro fridge with notes stuck on it.

export interface Kitchen {
  group: THREE.Group;
  colliders: Collider[];
  /** The coffee machine: E at it for a minute of quicker feet and higher jumps. */
  interactable: Interactable;
}

/** Every material in kitchen.glb by name: the old code-built kitchen's colors, and the office's wood for the top. */
const COLORS: Record<string, string> = {
  Cabinet: '#8ecae6',
  Wood: '#c98b5a',
  Chrome: '#adb5bd',
  Dark: '#343a40',
  White: '#ffffff',
  Fridge: '#f8f9fa',
  Note: '#ffd166',
  Memo: '#bde0fe',
  Red: '#ef476f',
};

export function buildKitchen(): Kitchen {
  const group = new THREE.Group();
  const interactable: Interactable = { kind: 'coffee', x: KITCHEN.pour.x, z: KITCHEN.pour.z, radius: 1.4 };
  const kitchen = model('kitchen');
  if (kitchen) {
    const paint = palette(COLORS);
    // The machine's little light glows, as the old one did.
    paintModel(kitchen.scene, (name) => (name === 'Glow' ? toon('#ef476f', { emissive: '#ef476f' }) : paint(name)));
    group.add(kitchen.scene);
    // Only the machine pours a coffee: a look at the counter or the fridge doesn't.
    const machine = kitchen.scene.getObjectByName('coffee_machine');
    if (machine) machine.userData.interact = interactable;
  }
  // Modelled facing +z like everything else, the fridge 3.2 m to its left and the machine 1.2 m to its
  // right; against the east wall it turns to face into the room (-x), the fridge to the north.
  group.position.set(KITCHEN.x, 0, KITCHEN.z);
  group.rotation.y = KITCHEN.rotY;
  const colliders: Collider[] = [{ ...KITCHEN.counter }, { ...KITCHEN.fridge }];
  return { group, colliders, interactable };
}

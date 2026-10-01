import * as THREE from 'three';
import { KITCHEN } from '../../shared/layout';
import { loadModel, type ModelName } from './models';
import { noGrime } from './sanandreas';

// People in the San Andreas test look (see sanandreas.ts): realistic grown-ups made in Blender with
// MPFB (blender/scripts/build_people.py), dressed for a techno club. A crowd of them hangs round the
// kitchen's bar: leaning on it, drinking, talking and dancing. Everyone else in the office gets such
// a body in the look too (a stand-in, see SaStandIn), moving as their own figure does.
//
// Every person's model has the same bones (a Mixamo rig) and no clips. What moves them is a set of
// plain joints (SaRig: hips, chest, head, shoulders and elbows, hips and knees), each turned about the
// model's own axes as if it stood straight with its arms hanging; RealBody turns those into the
// bones' rotations each frame.

export type PersonModel = 'blond' | 'bob' | 'afro' | 'tee' | 'pony' | 'buzz';

/** Who has darker skin and who's a woman, for picking someone's stand-in. */
const MODELS: Record<PersonModel, { dark: boolean; female: boolean }> = {
  blond: { dark: false, female: false },
  buzz: { dark: false, female: false },
  tee: { dark: true, female: false },
  bob: { dark: false, female: true },
  pony: { dark: false, female: true },
  afro: { dark: true, female: true },
};

/** A body's joints, which a pose (or a stand-in's figure) turns. */
export interface SaRig {
  hips: THREE.Object3D;
  chest: THREE.Object3D;
  head: THREE.Object3D;
  /** On -x (the character's right) first, as a figure's are. */
  arms: { shoulder: THREE.Object3D; elbow: THREE.Object3D }[];
  legs: { hip: THREE.Object3D; knee: THREE.Object3D }[];
  /** How high the hips are, standing, and how far out the arms hang. */
  stand: number;
  spread: number;
}

function bone(root: THREE.Object3D, name: string): THREE.Object3D {
  const b = root.getObjectByName(`mixamorig${name}`);
  if (!b) throw new Error(`no bone ${name}`);
  return b;
}

const worldTurn = (o: THREE.Object3D) => o.getWorldQuaternion(new THREE.Quaternion());
const _q = new THREE.Quaternion();
const _d = new THREE.Quaternion();

/** One bone a joint turns, and how it rests: its own rotation, and its parent's in the model. */
interface Drive {
  bone: THREE.Object3D;
  from: THREE.Object3D;
  /** How much of the joint's turn this bone takes (the spine and neck share theirs). */
  share: number;
  rest: THREE.Quaternion;
  parentRest: THREE.Quaternion;
  parentRestInv: THREE.Quaternion;
}

/** A person's model, and the joints (see SaRig) that pose it. */
export class RealBody {
  readonly root = new THREE.Group();
  readonly rig: SaRig;
  /** In the right hand, for something to hold: its axes the model's, as the hand hangs at rest. */
  readonly grip = new THREE.Group();
  private drives: Drive[] = [];
  private hipsBone: THREE.Object3D;
  private hipsRest: THREE.Vector3;
  /** A metre up, and to the model's left, in the hips' parent's space. */
  private up: THREE.Vector3;
  private side: THREE.Vector3;

  constructor(scene: THREE.Object3D, top?: string) {
    this.root.add(scene);
    this.root.updateMatrixWorld(true);
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.receiveShadow = true;
      // Posed, they reach outside the rest pose's bounds.
      m.frustumCulled = false;
      const mat = m.material as THREE.MeshStandardMaterial;
      if (!mat.userData.sa) {
        // Once per material (they're shared between copies): clean, and brighter, the office's
        // light being made for its flat colors.
        mat.userData.sa = true;
        noGrime(mat);
        mat.color.multiplyScalar(mat.name === 'Skin' ? 1.55 : 1.3);
      }
      if (mat.name === 'Hair' || mat.name === 'Brows') {
        // Cut out rather than blended, so hair sorts like anything else.
        mat.transparent = false;
        mat.alphaTest = 0.5;
        mat.depthWrite = true;
        mat.side = THREE.DoubleSide;
      } else if (mat.name === 'Top' && top) {
        const own = mat.clone();
        own.color.set(top);
        noGrime(own);
        m.material = own;
      }
    });
    const hips = bone(scene, 'Hips');
    this.hipsBone = hips;
    this.hipsRest = hips.position.clone();
    const into = worldTurn(hips.parent!).invert();
    const scale = 1 / hips.parent!.getWorldScale(new THREE.Vector3()).y;
    this.up = new THREE.Vector3(0, scale, 0).applyQuaternion(into);
    this.side = new THREE.Vector3(scale, 0, 0).applyQuaternion(into);
    const joint = () => new THREE.Object3D();
    this.rig = {
      hips: joint(),
      chest: joint(),
      head: joint(),
      arms: [0, 1].map(() => ({ shoulder: joint(), elbow: joint() })),
      legs: [0, 1].map(() => ({ hip: joint(), knee: joint() })),
      stand: hips.getWorldPosition(new THREE.Vector3()).y,
      spread: 0.1,
    };
    /** Turns the limb from `upper` to `lower` (an A-pose's arm, say) to hang straight down: the rest the joints turn from. */
    const straighten = (upper: string, lower: string) => {
      const b = bone(scene, upper);
      const a = b.getWorldPosition(new THREE.Vector3());
      const to = bone(scene, lower).getWorldPosition(new THREE.Vector3());
      const turn = new THREE.Quaternion().setFromUnitVectors(to.sub(a).normalize(), new THREE.Vector3(0, -1, 0));
      const parent = worldTurn(b.parent!);
      // Turned in the model, so in its parent's space: parent⁻¹ · turn · parent.
      b.quaternion.premultiply(parent.clone().invert().multiply(turn).multiply(parent)).normalize();
      b.updateMatrixWorld(true);
    };
    for (const side of ['Right', 'Left']) {
      straighten(`${side}Arm`, `${side}ForeArm`);
      straighten(`${side}ForeArm`, `${side}Hand`);
      straighten(`${side}UpLeg`, `${side}Leg`);
      straighten(`${side}Leg`, `${side}Foot`);
    }
    const drive = (name: string, from: THREE.Object3D, share = 1) => {
      const b = bone(scene, name);
      const parentRest = worldTurn(b.parent!);
      this.drives.push({ bone: b, from, share, rest: b.quaternion.clone(), parentRest, parentRestInv: parentRest.clone().invert() });
    };
    const r = this.rig;
    drive('Hips', r.hips);
    drive('Spine1', r.chest, 0.5);
    drive('Spine2', r.chest, 0.5);
    drive('Neck', r.head, 0.4);
    drive('Head', r.head, 0.6);
    for (const [k, side] of (['Right', 'Left'] as const).entries()) {
      drive(`${side}Arm`, r.arms[k].shoulder);
      drive(`${side}ForeArm`, r.arms[k].elbow);
      drive(`${side}UpLeg`, r.legs[k].hip);
      drive(`${side}Leg`, r.legs[k].knee);
    }
    const hand = bone(scene, 'RightHand');
    hand.add(this.grip);
    this.grip.quaternion.copy(worldTurn(hand).invert());
    this.grip.position.set(0, 0.08 / hand.getWorldScale(new THREE.Vector3()).y, 0);
  }

  /** Turns the bones to the joints' pose. */
  apply() {
    for (const d of this.drives) {
      // The joint's turn, in the model's space at rest, put on the bone's rest in its parent's space.
      _d.setFromEuler(d.from.rotation);
      if (d.share !== 1) _d.slerp(_q.identity(), 1 - d.share);
      d.bone.quaternion.copy(d.parentRestInv).multiply(_d).multiply(d.parentRest).multiply(d.rest);
    }
    const hips = this.rig.hips.position;
    this.hipsBone.position.copy(this.hipsRest).addScaledVector(this.up, hips.y - this.rig.stand).addScaledVector(this.side, hips.x);
  }
}

/** Loads `model` as a person's body, its top in `top` if given. */
export async function body(model: PersonModel, top?: string): Promise<RealBody> {
  const { scene } = await loadModel(`person-${model}` as ModelName);
  return new RealBody(scene, top);
}

// ---- The crowd at the bar -----------------------------------------------------------------------

export type Pose = 'lean' | 'drink' | 'talk' | 'dance' | 'sway' | 'stand';

const CROWD: readonly { model: PersonModel; x: number; z: number; rotY: number; pose: Pose }[] = (() => {
  const bar = { x: KITCHEN.bar.x, z: KITCHEN.counter.maxZ };
  const P = (model: PersonModel, dx: number, dz: number, rotY: number, pose: Pose) => ({ model, x: bar.x + dx, z: bar.z + dz, rotY, pose });
  return [
    P('pony', -0.5, 0.45, Math.PI + 0.15, 'lean'),
    P('blond', 0.55, 0.48, Math.PI - 0.1, 'lean'),
    P('bob', -1.6, 1.35, 2.5, 'drink'),
    P('blond', -0.3, 1.75, Math.PI - 0.35, 'stand'),
    P('afro', 1.0, 1.7, -2.5, 'talk'),
    P('tee', 1.9, 1.0, -1.9, 'drink'),
    P('bob', -2.6, 2.4, 2.2, 'dance'),
    P('buzz', -0.9, 3.0, 3.0, 'dance'),
    P('pony', 0.7, 3.2, -2.9, 'dance'),
    P('tee', 2.4, 2.4, -2.3, 'sway'),
    P('afro', -3.5, 1.2, 1.9, 'stand'),
  ];
})();

/** A beer bottle, for a hand to hold: brown glass, a long neck and a label. */
function bottle(): THREE.Group {
  const g = new THREE.Group();
  const glass = new THREE.MeshStandardMaterial({ color: '#4a2508', roughness: 0.25, transparent: true, opacity: 0.9 });
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, y: number) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.y = y;
    m.castShadow = true;
    g.add(m);
  };
  add(new THREE.CylinderGeometry(0.03, 0.03, 0.14, 12), glass, -0.02);
  add(new THREE.CylinderGeometry(0.012, 0.03, 0.06, 12), glass, 0.08);
  add(new THREE.CylinderGeometry(0.031, 0.031, 0.06, 12), new THREE.MeshStandardMaterial({ color: '#d8c89a' }), -0.025);
  return g;
}

export interface Homies {
  group: THREE.Group;
  /** Where the crowd stands (for the radar). */
  spots: readonly { x: number; z: number }[];
  /** Loads the crowd's models, the first time the look's on. */
  load(): void;
  update(t: number): void;
}

/** The crowd at the kitchen's bar, for the office's floor. */
export function buildHomies(): Homies {
  const group = new THREE.Group();
  const people: { body: RealBody; pose: Pose; phase: number }[] = [];
  let loading = false;
  return {
    group,
    spots: CROWD.map(({ x, z }) => ({ x, z })),
    load() {
      if (loading) return;
      loading = true;
      CROWD.forEach((c, i) => {
        body(c.model).then(
          (b) => {
            b.root.position.set(c.x, 0, c.z);
            b.root.rotation.y = c.rotY;
            if (c.pose === 'drink') b.grip.add(bottle());
            group.add(b.root);
            people.push({ body: b, pose: c.pose, phase: i * 1.37 });
          },
          (err: unknown) => console.error(`person-${c.model} didn't load`, err),
        );
      });
    },
    update(t) {
      for (const p of people) {
        pose(p.body.rig, p.pose, t + p.phase, t);
        p.body.apply();
      }
    },
  };
}

/** Turns `r`'s joints for `pose`, `p` seconds into its own time and `t` on the shared beat. */
export function pose(r: SaRig, kind: Pose, p: number, t: number) {
  const [R, L] = r.arms;
  // Standing easy: weight from foot to foot, a breath, arms hanging.
  r.hips.position.set(Math.sin(p * 0.8) * 0.015, r.stand, 0);
  r.hips.rotation.set(0, 0, Math.sin(p * 0.8) * 0.03);
  r.chest.rotation.set(0, 0, -Math.sin(p * 0.8) * 0.035);
  r.head.rotation.set(-0.03, Math.sin(p * 0.31) * 0.35, 0);
  for (const [k, arm] of r.arms.entries()) {
    const sx = k === 0 ? -1 : 1;
    arm.shoulder.rotation.set(Math.sin(p * 0.8 + k) * 0.04, 0, sx * r.spread);
    arm.elbow.rotation.set(-0.18, 0, 0);
  }
  for (const leg of r.legs) {
    leg.hip.rotation.set(0, 0, 0);
    leg.knee.rotation.set(0, 0, 0);
  }
  // The beat everyone dances to (126 bpm), and how far down each bounce is.
  const beat = t * 2.1 * Math.PI * 2;
  const bounce = Math.abs(Math.sin(beat / 2));
  switch (kind) {
    case 'lean': {
      // Forearms on the counter, leaning in over it.
      r.chest.rotation.x = 0.45;
      r.head.rotation.x = -0.3;
      r.head.rotation.y = Math.sin(p * 0.4) * 0.5;
      for (const [k, arm] of r.arms.entries()) {
        arm.shoulder.rotation.set(-0.95, 0, (k === 0 ? 1 : -1) * 0.22);
        arm.elbow.rotation.set(-1.25, 0, 0);
      }
      r.legs[0].hip.rotation.x = 0.12;
      r.legs[1].knee.rotation.x = 0.15;
      break;
    }
    case 'drink': {
      // The bottle up to the lips every few seconds, head back for the swig.
      const cycle = (p % 7) / 7;
      const up = cycle < 0.22 ? Math.sin((cycle / 0.22) * Math.PI) : 0;
      R.shoulder.rotation.set(-0.35 - up * 1.1, 0, -0.1 - up * 0.1);
      R.elbow.rotation.set(-1.3 - up * 0.95, 0, 0);
      r.head.rotation.x = -0.03 - up * 0.35;
      r.head.rotation.y *= 1 - up;
      break;
    }
    case 'talk': {
      L.shoulder.rotation.set(-0.45 + Math.sin(p * 2.3) * 0.2, 0, 0.2 + Math.sin(p * 1.7) * 0.1);
      L.elbow.rotation.set(-1.2 + Math.sin(p * 4.6) * 0.3, 0, 0);
      R.shoulder.rotation.set(-0.1, 0, -0.35);
      R.elbow.rotation.set(-1.9, 0, 0);
      r.head.rotation.x = Math.sin(p * 3.1) * 0.06;
      break;
    }
    case 'dance': {
      // Down on every beat, knees giving, shoulders rolling, fists up and pumping on the offbeat.
      r.hips.position.y = r.stand - bounce * 0.06;
      for (const leg of r.legs) {
        leg.hip.rotation.x = -bounce * 0.22;
        leg.knee.rotation.x = bounce * 0.45;
      }
      r.hips.rotation.y = Math.sin(beat / 4 + p) * 0.25;
      r.chest.rotation.x = 0.12 + bounce * 0.08;
      r.chest.rotation.y = Math.sin(beat / 4 + p) * -0.2;
      r.head.rotation.set(0.1 + bounce * 0.2, 0, 0);
      const pump = Math.max(0, Math.sin(beat / 2 + p));
      R.shoulder.rotation.set(-0.7 - pump * 0.3, 0, -0.35);
      R.elbow.rotation.set(-1.6, 0, 0);
      if (Math.sin(p * 0.2) > 0) {
        // Now and then a fist in the air.
        L.shoulder.rotation.set(-0.3, 0, 2.6 + pump * 0.25);
        L.elbow.rotation.set(-0.5 - pump * 0.3, 0, 0);
      } else {
        L.shoulder.rotation.set(-0.7 - (1 - pump) * 0.3, 0, 0.35);
        L.elbow.rotation.set(-1.6, 0, 0);
      }
      break;
    }
    case 'sway': {
      r.hips.position.x = Math.sin(beat / 4) * 0.035;
      r.hips.rotation.z = Math.sin(beat / 4) * 0.05;
      r.head.rotation.x = bounce * 0.12;
      for (const arm of r.arms) arm.elbow.rotation.x = -0.9;
      break;
    }
    case 'stand':
      r.head.rotation.x = Math.max(0, Math.sin(beat / 2)) * 0.08;
      break;
  }
}

// ---- Stand-ins for everyone else --------------------------------------------------------------

/** A figure's joints, for a stand-in to move with (see Person.rig). */
export interface FigureRig {
  body: THREE.Object3D;
  head: THREE.Object3D;
  legL: THREE.Object3D;
  legR: THREE.Object3D;
  armL: THREE.Object3D;
  armR: THREE.Object3D;
  /** 0 standing … 1 sitting, the seat's hips, and the figure's own hips standing. */
  sitK: number;
  seatHips: number;
  hips: number;
}

function rand01(s: string): number {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
}

/** Whose body someone gets: one with skin like theirs (`dark`), a man or a woman as their name falls. */
export function standInModel(name: string, dark: boolean): PersonModel {
  const h = rand01(name);
  const fits = (Object.keys(MODELS) as PersonModel[]).filter((m) => MODELS[m].dark === dark && MODELS[m].female === h > 0.5);
  return fits[Math.floor(h * 1000) % fits.length];
}

/** Someone's body in the look, in place of their figure, moving as it does. */
export class SaStandIn {
  readonly root = new THREE.Group();
  private body: RealBody | null = null;

  /** `top`: the color of their top (their own color). The body comes once its model has loaded. */
  constructor(model: PersonModel, top: string) {
    body(model, top).then(
      (b) => {
        this.body = b;
        this.root.add(b.root);
      },
      (err: unknown) => console.error(`person-${model} didn't load`, err),
    );
  }

  get ready(): boolean {
    return this.body !== null;
  }

  /** Takes on `f`'s pose: its legs' and arms' swing (a little less of it, on longer limbs), its lean, and how far down onto a seat. */
  follow(f: FigureRig) {
    if (!this.body) return;
    const r = this.body.rig;
    const bob = f.body.position.y - f.sitK * (f.seatHips - f.hips);
    r.hips.position.set(0, THREE.MathUtils.lerp(r.stand, f.seatHips + 0.04, f.sitK) + bob * 0.5, 0);
    r.hips.rotation.copy(f.body.rotation);
    r.chest.rotation.set(0, 0, 0);
    r.head.rotation.copy(f.head.rotation);
    const swing = THREE.MathUtils.lerp(0.6, 1, f.sitK);
    for (const [leg, from] of [
      [r.legs[0], f.legL],
      [r.legs[1], f.legR],
    ] as const) {
      leg.hip.rotation.set(from.rotation.x * swing, from.rotation.y, from.rotation.z);
      leg.knee.rotation.set(f.sitK * 1.45 + Math.max(0, from.rotation.x) * 0.7, 0, 0);
    }
    for (const [k, [arm, from]] of (
      [
        [r.arms[0], f.armL],
        [r.arms[1], f.armR],
      ] as const
    ).entries()) {
      const sx = k === 0 ? -1 : 1;
      const x = from.rotation.x;
      arm.shoulder.rotation.set(x > -0.8 ? x * 0.6 : x, from.rotation.y, from.rotation.z + sx * (r.spread - 0.1));
      arm.elbow.rotation.set(-0.2 - Math.max(0, -x) * 0.25, 0, 0);
    }
    this.body.apply();
  }
}

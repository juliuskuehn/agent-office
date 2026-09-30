import * as THREE from 'three';

// A few people hanging about the office in the San Andreas test look (see sanandreas.ts): grown-up
// sized and built like an old PS2 game's, out of a handful of faceted pieces each, flat shaded, in
// tank tops, baggy jeans, caps and bandanas. They stand in little groups, shift their weight, nod
// along, look round at each other, and one in each group talks with their hands. Nothing more: they
// don't walk, and you walk through them.

interface Outfit {
  skin: string;
  top: string;
  /** Sleeves to the elbow (a tee) or none (a tank top), and the top's second color, for a jersey's trim. */
  sleeves: boolean;
  trim?: string;
  pants: string;
  shoes: string;
  hat: 'cap' | 'bandana' | 'beanie' | 'none';
  hatColor: string;
  hair?: string;
  shades?: boolean;
  goatee?: boolean;
  chain?: boolean;
}

const OUTFITS: readonly Outfit[] = [
  { skin: '#5b3a27', top: '#2f8a3a', sleeves: false, pants: '#3b5b8c', shoes: '#f2f2f2', hat: 'bandana', hatColor: '#2f8a3a', goatee: true, chain: true },
  { skin: '#8d5b3e', top: '#f1f1ec', sleeves: true, pants: '#b89c6b', shoes: '#1c1c1c', hat: 'cap', hatColor: '#1d1d1d', shades: true },
  { skin: '#3e2a1e', top: '#6b3fa0', sleeves: false, trim: '#e8e8e8', pants: '#2c3e5c', shoes: '#f2f2f2', hat: 'beanie', hatColor: '#6b3fa0', chain: true },
  { skin: '#c69070', top: '#a63a2e', sleeves: true, pants: '#1f2a3a', shoes: '#8a5a32', hat: 'none', hatColor: '#000', hair: '#1a120c', goatee: true },
  { skin: '#e2b894', top: '#1f1f1f', sleeves: true, pants: '#6c6f73', shoes: '#f2f2f2', hat: 'cap', hatColor: '#c9a227', shades: true, chain: true },
];

/** Where they stand: little groups round a middle, each looking in at it. */
const GROUPS: readonly { x: number; z: number; who: readonly number[] }[] = [
  { x: -0.9, z: -9.6, who: [0, 1, 2] },
  { x: 6.2, z: 6.2, who: [3, 4] },
];

const flat = new Map<string, THREE.MeshLambertMaterial>();
/** A flat-shaded material, facets and all, like an old console's. */
function faceted(color: string): THREE.MeshLambertMaterial {
  let m = flat.get(color);
  if (!m) flat.set(color, (m = new THREE.MeshLambertMaterial({ color, flatShading: true })));
  return m;
}

function part(geo: THREE.BufferGeometry, color: string, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo, faceted(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** A joint: a pivot at (x, y, z) that what hangs off it turns round. */
function joint(parent: THREE.Object3D, x: number, y: number, z = 0): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

interface Homie {
  root: THREE.Group;
  hips: THREE.Group;
  chest: THREE.Group;
  head: THREE.Group;
  arms: { shoulder: THREE.Group; elbow: THREE.Group }[];
  /** Offsets so no two move in step, and whether this one talks with their hands. */
  phase: number;
  talker: boolean;
  /** Where the others in the group are, round from where they face, for the head to turn to. */
  looks: number[];
}

function build(o: Outfit): Omit<Homie, 'phase' | 'talker' | 'looks'> {
  const root = new THREE.Group();
  const hips = joint(root, 0, 0.93);
  // Baggy jeans: wide at the thigh and wider at the ankle, hanging over the shoes.
  hips.add(part(new THREE.CylinderGeometry(0.17, 0.16, 0.16, 6).scale(1, 1, 0.7), o.pants, 0, 0.02));
  for (const sx of [-1, 1]) {
    const hip = joint(hips, sx * 0.095, -0.02);
    hip.add(part(new THREE.CylinderGeometry(0.095, 0.1, 0.46, 6), o.pants, 0, -0.23));
    hip.add(part(new THREE.CylinderGeometry(0.1, 0.115, 0.42, 6), o.pants, 0, -0.64));
    hip.add(part(new THREE.BoxGeometry(0.13, 0.1, 0.29), o.shoes, 0, -0.86, 0.05));
  }
  // The chest, broad at the shoulders, and the top over it.
  const chest = joint(hips, 0, 0.08);
  chest.add(part(new THREE.CylinderGeometry(0.22, 0.16, 0.5, 6).scale(1, 1, 0.62), o.top, 0, 0.25));
  if (o.trim) chest.add(part(new THREE.CylinderGeometry(0.165, 0.165, 0.035, 6).scale(1, 1, 0.64), o.trim, 0, 0.02));
  if (o.chain) {
    const chain = part(new THREE.TorusGeometry(0.1, 0.012, 4, 10), '#e0b43c', 0, 0.44, 0.07);
    chain.rotation.x = Math.PI / 2 - 0.35;
    chest.add(chain);
  }
  chest.add(part(new THREE.CylinderGeometry(0.05, 0.055, 0.08, 5), o.skin, 0, 0.53));

  // The head: a squashed ball of few faces, eyes, brows, nose and mouth pressed on.
  const head = joint(chest, 0, 0.66);
  head.add(part(new THREE.SphereGeometry(0.105, 7, 5).scale(0.92, 1.18, 1), o.skin));
  head.add(part(new THREE.ConeGeometry(0.022, 0.05, 4).rotateX(Math.PI / 2), o.skin, 0, -0.01, 0.105));
  head.add(part(new THREE.BoxGeometry(0.05, 0.01, 0.01), '#3a1f1a', 0, -0.055, 0.095));
  if (o.shades) head.add(part(new THREE.BoxGeometry(0.17, 0.035, 0.02), '#101010', 0, 0.03, 0.094));
  else {
    for (const sx of [-1, 1]) {
      head.add(part(new THREE.BoxGeometry(0.03, 0.018, 0.01), '#f4f1ea', sx * 0.038, 0.028, 0.093));
      head.add(part(new THREE.BoxGeometry(0.013, 0.016, 0.01), '#1a1210', sx * 0.038, 0.028, 0.098));
      head.add(part(new THREE.BoxGeometry(0.04, 0.01, 0.01), '#1a1210', sx * 0.04, 0.055, 0.094));
    }
  }
  if (o.goatee) head.add(part(new THREE.BoxGeometry(0.045, 0.045, 0.02), '#1a1210', 0, -0.09, 0.08));
  if (o.hat === 'cap') {
    // Turned round, the peak at the back.
    head.add(part(new THREE.SphereGeometry(0.11, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.85, 1.05), o.hatColor, 0, 0.045));
    head.add(part(new THREE.BoxGeometry(0.15, 0.012, 0.11), o.hatColor, 0, 0.05, -0.14));
  } else if (o.hat === 'bandana') {
    head.add(part(new THREE.SphereGeometry(0.108, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2.1).scale(0.97, 1.05, 1.03), o.hatColor, 0, 0.04));
    head.add(part(new THREE.BoxGeometry(0.05, 0.06, 0.02), o.hatColor, 0.03, 0.02, -0.11));
  } else if (o.hat === 'beanie') {
    head.add(part(new THREE.SphereGeometry(0.113, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 1.25, 1.05), o.hatColor, 0, 0.02));
  } else if (o.hair) {
    head.add(part(new THREE.SphereGeometry(0.108, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2.4).scale(0.96, 1.1, 1.02), o.hair, 0, 0.035, -0.005));
  }

  // Arms: bare, or in sleeves to the elbow, with a block of a hand.
  const arms = [-1, 1].map((sx) => {
    const shoulder = joint(chest, sx * 0.25, 0.46);
    shoulder.rotation.z = sx * 0.12;
    shoulder.add(part(new THREE.CylinderGeometry(0.055, 0.047, 0.3, 5), o.sleeves ? o.top : o.skin, 0, -0.15));
    const elbow = joint(shoulder, 0, -0.3);
    elbow.add(part(new THREE.CylinderGeometry(0.045, 0.038, 0.27, 5), o.skin, 0, -0.135));
    elbow.add(part(new THREE.BoxGeometry(0.06, 0.09, 0.08), o.skin, 0, -0.31));
    return { shoulder, elbow };
  });
  return { root, hips, chest, head, arms };
}

export interface Homies {
  group: THREE.Group;
  update(t: number): void;
}

/** The people in the look, for the office's floor. */
export function buildHomies(): Homies {
  const group = new THREE.Group();
  const homies: Homie[] = [];
  for (const g of GROUPS) {
    g.who.forEach((who, i) => {
      const a = (i / g.who.length) * Math.PI * 2 + 0.4;
      const r = g.who.length > 2 ? 0.62 : 0.5;
      const body = build(OUTFITS[who]);
      body.root.position.set(g.x + Math.sin(a) * r, 0, g.z + Math.cos(a) * r);
      // Facing in, at the middle.
      body.root.rotation.y = a + Math.PI;
      group.add(body.root);
      const looks = g.who.map((_, j) => {
        const b = (j / g.who.length) * Math.PI * 2 + 0.4;
        const dx = g.x + Math.sin(b) * r - body.root.position.x;
        const dz = g.z + Math.cos(b) * r - body.root.position.z;
        return j === i ? 0 : THREE.MathUtils.clamp(Math.atan2(dx, dz) - body.root.rotation.y, -0.9, 0.9);
      });
      // Angles wrap: keep each within a half turn of straight ahead.
      for (let k = 0; k < looks.length; k++) looks[k] = Math.atan2(Math.sin(looks[k]), Math.cos(looks[k]));
      homies.push({ ...body, phase: who * 1.7, talker: i === 0, looks });
    });
  }

  return {
    group,
    update(t) {
      for (const h of homies) {
        const p = t + h.phase;
        // Weight from foot to foot, a breath, and a nod to a beat only they can hear.
        h.hips.rotation.z = Math.sin(p * 0.9) * 0.04;
        h.hips.position.x = Math.sin(p * 0.9) * 0.02;
        h.chest.rotation.z = -Math.sin(p * 0.9) * 0.05;
        h.chest.scale.setScalar(1 + Math.sin(p * 1.6) * 0.006);
        h.head.rotation.x = Math.max(0, Math.sin(p * 4.2)) * 0.12 - 0.03;
        // Looking round at the others now and then.
        const at = h.looks[Math.floor(p / 3.5) % h.looks.length];
        h.head.rotation.y += (at - h.head.rotation.y) * 0.05;
        // Arms hang, or talk: the forearm up and out, waving the point home.
        for (const [k, arm] of h.arms.entries()) {
          const sx = k === 0 ? -1 : 1;
          if (h.talker && k === 1) {
            arm.shoulder.rotation.x = -0.55 + Math.sin(p * 2.3) * 0.25;
            arm.elbow.rotation.x = -1.1 + Math.sin(p * 4.6) * 0.35;
            arm.shoulder.rotation.z = sx * (0.2 + Math.sin(p * 1.7) * 0.1);
          } else {
            arm.shoulder.rotation.x = Math.sin(p * 0.9 + k) * 0.05;
            arm.elbow.rotation.x = -0.15;
          }
        }
      }
    },
  };
}

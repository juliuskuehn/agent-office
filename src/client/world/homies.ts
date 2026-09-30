import * as THREE from 'three';
import { KITCHEN } from '../../shared/layout';

// People in the San Andreas test look (see sanandreas.ts): grown-up sized and shaped, in the dark
// clothes of a techno club (black tank tops, crop tops, mesh, leather, baggy denim, fishnets, platform
// boots, chokers and chains), with bleached spikes, bobs and ponytails. A crowd of them hangs round
// the kitchen's bar: leaning on it, drinking, talking and dancing. Everyone else in the office gets
// such a body in the look too (a stand-in, see SaStandIn), moving as their own figure does.

type Fabric = 'cotton' | 'denim' | 'leather' | 'mesh' | 'camo';

export interface SaLook {
  body: 'm' | 'f';
  skin: string;
  hair: string;
  hairStyle: 'spikes' | 'buzz' | 'bob' | 'pony' | 'undercut' | 'bald';
  top: { kind: 'tank' | 'tee' | 'crop' | 'bra' | 'jacket'; color: string; fabric: Fabric };
  bottom: { kind: 'baggy' | 'skinny' | 'skirt'; color: string; fabric: Fabric };
  fishnets?: boolean;
  shoes: 'boots' | 'sneakers';
  choker?: boolean;
  chain?: boolean;
}

// ---- Fabrics ------------------------------------------------------------------------------------

const textures = new Map<string, THREE.CanvasTexture>();
function fabricTexture(fabric: Fabric | 'fishnet', color: string): THREE.CanvasTexture {
  const key = `${fabric}|${color}`;
  const hit = textures.get(key);
  if (hit) return hit;
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  const base = new THREE.Color(color);
  g.fillStyle = `#${base.getHexString()}`;
  g.fillRect(0, 0, S, S);
  // Seeded speckle, so every piece of the same cloth looks the same.
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const shade = (k: number, a: number) => `rgba(${k > 0 ? '255,255,255' : '0,0,0'},${a})`;
  for (let i = 0; i < 1400; i++) {
    g.fillStyle = shade(rand() - 0.5, 0.05 + rand() * 0.06);
    g.fillRect(rand() * S, rand() * S, 1 + rand() * 2, 1 + rand() * 2);
  }
  if (fabric === 'denim') {
    // The twill: fine diagonal lines, and paler worn streaks up and down.
    g.strokeStyle = 'rgba(255,255,255,0.07)';
    for (let i = -S; i < S; i += 3) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i + S, S);
      g.stroke();
    }
    for (let i = 0; i < 10; i++) {
      g.fillStyle = `rgba(255,255,255,${0.03 + rand() * 0.05})`;
      g.fillRect(rand() * S, 0, 4 + rand() * 12, S);
    }
  } else if (fabric === 'leather') {
    // Soft shine and creases.
    for (let i = 0; i < 12; i++) {
      const x = rand() * S;
      const y = rand() * S;
      const grad = g.createRadialGradient(x, y, 0, x, y, 10 + rand() * 25);
      grad.addColorStop(0, 'rgba(255,255,255,0.12)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, S, S);
    }
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    for (let i = 0; i < 14; i++) {
      g.beginPath();
      const y = rand() * S;
      g.moveTo(0, y);
      g.bezierCurveTo(S / 3, y + (rand() - 0.5) * 16, (2 * S) / 3, y + (rand() - 0.5) * 16, S, y);
      g.stroke();
    }
  } else if (fabric === 'mesh' || fabric === 'fishnet') {
    // A net of diamonds over what's under it (skin, for fishnets).
    g.strokeStyle = fabric === 'mesh' ? 'rgba(0,0,0,0.75)' : 'rgba(12,12,12,0.9)';
    g.lineWidth = fabric === 'mesh' ? 2 : 1.5;
    const step = fabric === 'mesh' ? 8 : 12;
    for (let i = -S; i < 2 * S; i += step) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i + S, S);
      g.moveTo(i, S);
      g.lineTo(i + S, 0);
      g.stroke();
    }
  } else if (fabric === 'camo') {
    for (let i = 0; i < 26; i++) {
      g.fillStyle = ['#3d4a2c', '#5a5238', '#23261c', '#6b6a4a'][i % 4];
      g.beginPath();
      g.ellipse(rand() * S, rand() * S, 8 + rand() * 16, 5 + rand() * 10, rand() * 3, 0, Math.PI * 2);
      g.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  textures.set(key, tex);
  return tex;
}

const mats = new Map<string, THREE.MeshLambertMaterial>();
function cloth(fabric: Fabric | 'fishnet' | 'plain', color: string): THREE.MeshLambertMaterial {
  const key = `${fabric}|${color}`;
  let m = mats.get(key);
  if (!m) {
    m = fabric === 'plain' ? new THREE.MeshLambertMaterial({ color }) : new THREE.MeshLambertMaterial({ map: fabricTexture(fabric, color) });
    mats.set(key, m);
  }
  return m;
}
const plain = (color: string) => cloth('plain', color);

function part(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function joint(parent: THREE.Object3D, x: number, y: number, z = 0): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

/** A torso's outline, bottom (the crotch) to top (the neck): [radius, height]. */
const TORSO = {
  m: [
    [0.15, 0],
    [0.165, 0.08],
    [0.15, 0.2],
    [0.155, 0.3],
    [0.19, 0.4],
    [0.205, 0.47],
    [0.17, 0.53],
    [0.06, 0.58],
  ],
  f: [
    [0.15, 0],
    [0.172, 0.07],
    [0.122, 0.22],
    [0.13, 0.3],
    [0.15, 0.38],
    [0.15, 0.45],
    [0.14, 0.5],
    [0.05, 0.55],
  ],
} as const;

/** The torso's radius `y` up, from its outline. */
function radiusAt(outline: readonly (readonly [number, number])[], y: number): number {
  for (let i = 1; i < outline.length; i++) {
    const [r0, y0] = outline[i - 1];
    const [r1, y1] = outline[i];
    if (y <= y1) return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0);
  }
  return outline[outline.length - 1][0];
}

/** A band round the torso from `y0` up to `y1`, `grow` out from the skin, flattened front to back as the torso is. */
function band(outline: readonly (readonly [number, number])[], y0: number, y1: number, grow: number, cap = false): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [];
  const n = 8;
  if (cap) pts.push(new THREE.Vector2(0.001, y0));
  for (let i = 0; i <= n; i++) {
    const y = y0 + ((y1 - y0) * i) / n;
    pts.push(new THREE.Vector2(radiusAt(outline, y) + grow, y));
  }
  if (cap) pts.push(new THREE.Vector2(0.001, y1));
  return new THREE.LatheGeometry(pts, 18).scale(1, 1, 0.64);
}

/** A body's joints, which a pose (or a stand-in's figure) moves. */
export interface SaRig {
  root: THREE.Group;
  hips: THREE.Group;
  chest: THREE.Group;
  head: THREE.Group;
  /** On -x (the character's right) first, as a figure's are. */
  arms: { shoulder: THREE.Group; elbow: THREE.Group; hand: THREE.Group }[];
  legs: { hip: THREE.Group; knee: THREE.Group }[];
  /** How high the hips are, standing. */
  stand: number;
  /** How far out the arms hang, standing. */
  spread: number;
}

export function saBody(o: SaLook): SaRig {
  const f = o.body === 'f';
  const outline = TORSO[o.body];
  const skin = plain(o.skin);
  const top = cloth(o.top.fabric, o.top.color);
  const bottom = cloth(o.bottom.fabric, o.bottom.color);
  const legSkin = o.fishnets ? cloth('fishnet', o.skin) : skin;
  const root = new THREE.Group();
  const stand = f ? 0.9 : 0.95;
  const hips = joint(root, 0, stand);

  // The torso: skin, with the top over it (all of it, or the chest of it) and the pants' waist. The
  // chest bends at the belt: what's above it turns with the chest (measured, like the outline, from
  // the crotch up), what's below stays with the hips.
  const WAIST = 0.14;
  const chest = joint(hips, 0, WAIST);
  const torso = joint(chest, 0, -WAIST);
  const pelvis = hips;
  pelvis.add(part(band(outline, 0, WAIST + 0.02, 0, true), skin));
  torso.add(part(band(outline, WAIST - 0.02, 0.56, 0, true), skin));
  const topTo = f ? 0.52 : 0.55;
  if (o.top.kind === 'crop' || o.top.kind === 'bra') torso.add(part(band(outline, o.top.kind === 'bra' ? 0.34 : 0.28, o.top.kind === 'bra' ? 0.44 : 0.5, 0.008), top));
  else torso.add(part(band(outline, WAIST - 0.03, topTo, 0.01), top));
  if (f) {
    const cover = o.top.kind === 'tank' || o.top.kind === 'tee' || o.top.kind === 'jacket' || o.top.kind === 'crop' || o.top.kind === 'bra';
    for (const sx of [-1, 1]) {
      const bust = part(new THREE.SphereGeometry(0.068, 14, 10), cover ? top : skin, sx * 0.065, 0.39, 0.055);
      bust.scale.set(1, 0.9, 0.85);
      torso.add(bust);
    }
  }
  if (o.top.kind === 'jacket') torso.add(part(band(outline, 0.12, topTo, 0.03), top));
  pelvis.add(part(band(outline, -0.02, o.bottom.kind === 'skirt' ? 0.1 : 0.14, 0.012), bottom));
  // A belt.
  pelvis.add(part(band(outline, 0.12, 0.155, 0.02), plain('#141414')));
  if (o.bottom.kind === 'skirt') {
    pelvis.add(part(new THREE.CylinderGeometry(0.19, 0.25, 0.26, 18, 1, true).scale(1, 1, 0.72), bottom, 0, -0.1));
  }
  if (o.chain) {
    const chain = part(new THREE.TorusGeometry(0.085, 0.008, 6, 20), plain('#d9b24a'), 0, 0.5, 0.075);
    chain.rotation.x = Math.PI / 2 - 0.5;
    torso.add(chain);
  }

  // Neck and head.
  torso.add(part(new THREE.CylinderGeometry(0.045, 0.052, 0.1, 10), skin, 0, 0.6));
  if (o.choker) {
    const ring = part(new THREE.TorusGeometry(0.05, 0.012, 6, 16), plain('#111111'), 0, 0.6);
    ring.rotation.x = Math.PI / 2;
    torso.add(ring);
    torso.add(part(new THREE.SphereGeometry(0.012, 8, 6), plain('#cfcfcf'), 0, 0.59, 0.058));
  }
  const head = joint(torso, 0, 0.73);
  buildHead(head, o, f);

  // Arms: shoulders, elbows and hands, in sleeves or bare.
  const shoulderX = f ? 0.165 : 0.205;
  const arms = [-1, 1].map((sx) => {
    const shoulder = joint(torso, sx * shoulderX, 0.49);
    const upper = f ? 0.042 : 0.052;
    shoulder.add(part(new THREE.SphereGeometry(upper * 1.25, 10, 8), o.top.kind === 'tee' || o.top.kind === 'jacket' ? top : skin));
    shoulder.add(part(new THREE.CylinderGeometry(upper, upper * 0.85, 0.28, 10), skin, 0, -0.14));
    if (o.top.kind === 'tee') shoulder.add(part(new THREE.CylinderGeometry(upper * 1.35, upper * 1.3, 0.14, 10), top, 0, -0.06));
    if (o.top.kind === 'jacket') shoulder.add(part(new THREE.CylinderGeometry(upper * 1.35, upper * 1.2, 0.29, 10), top, 0, -0.14));
    const elbow = joint(shoulder, 0, -0.28);
    elbow.add(part(new THREE.CylinderGeometry(upper * 0.82, upper * 0.65, 0.25, 10), o.top.kind === 'jacket' ? top : skin, 0, -0.125));
    if (!f || rand01(o.skin + o.hair) > 0.5) {
      const cuff = part(new THREE.CylinderGeometry(upper * 0.75, upper * 0.75, 0.04, 10), plain('#151515'), 0, -0.22);
      elbow.add(cuff);
    }
    const hand = joint(elbow, 0, -0.27);
    const palm = part(new THREE.SphereGeometry(0.04, 10, 8), skin, 0, -0.03);
    palm.scale.set(0.75, 1.25, 0.55);
    hand.add(palm);
    return { shoulder, elbow, hand };
  });

  // Legs: thighs, knees and shins, in the pants (or bare, or in fishnets, under a skirt), and the shoes.
  const legs = [-1, 1].map((sx) => {
    const hip = joint(hips, sx * (f ? 0.088 : 0.1), 0.02);
    const baggy = o.bottom.kind === 'baggy';
    const skirt = o.bottom.kind === 'skirt';
    const thighR = f ? 0.078 : 0.085;
    hip.add(part(new THREE.CylinderGeometry(baggy ? 0.088 : thighR, baggy ? 0.08 : thighR * 0.78, 0.46, 12), skirt ? legSkin : bottom, 0, -0.23));
    const knee = joint(hip, 0, -0.46);
    knee.add(part(new THREE.SphereGeometry(baggy ? 0.08 : thighR * 0.78, 10, 8), skirt ? legSkin : bottom));
    knee.add(part(new THREE.CylinderGeometry(baggy ? 0.08 : thighR * 0.72, baggy ? 0.095 : thighR * 0.55, 0.42, 12), skirt ? legSkin : bottom, 0, -0.21));
    if (o.shoes === 'boots') {
      knee.add(part(new THREE.CylinderGeometry(0.065, 0.068, skirt ? 0.3 : 0.14, 12), cloth('leather', '#161616'), 0, skirt ? -0.3 : -0.37));
      knee.add(part(new THREE.BoxGeometry(0.11, 0.07, 0.27), plain('#0e0e0e'), 0, -0.445, 0.04));
    } else {
      knee.add(part(new THREE.BoxGeometry(0.11, 0.08, 0.27), plain('#ededed'), 0, -0.44, 0.04));
      knee.add(part(new THREE.BoxGeometry(0.115, 0.025, 0.28), plain('#f8f8f8'), 0, -0.47, 0.04));
    }
    return { hip, knee };
  });
  return { root, hips, chest, head, arms, legs, stand, spread: f ? 0.08 : 0.12 };
}

function rand01(s: string): number {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
}

function buildHead(head: THREE.Group, o: SaLook, f: boolean) {
  const skin = plain(o.skin);
  const ink = plain('#171210');
  const skull = part(new THREE.SphereGeometry(0.1, 20, 16), skin, 0, 0.02);
  skull.scale.set(0.86, 1.08, 0.98);
  head.add(skull);
  const jaw = part(new THREE.SphereGeometry(0.08, 16, 12), skin, 0, -0.035, 0.018);
  jaw.scale.set(f ? 0.95 : 1.05, 0.95, 1);
  head.add(jaw);
  // Ears, nose, eyes and brows, and the lips.
  for (const sx of [-1, 1]) {
    const ear = part(new THREE.SphereGeometry(0.024, 8, 6), skin, sx * 0.087, 0.01, -0.005);
    ear.scale.set(0.5, 1, 0.8);
    head.add(ear);
    const white = part(new THREE.SphereGeometry(0.014, 10, 8), plain('#efe9e0'), sx * 0.035, 0.03, 0.083);
    white.scale.set(1.3, 0.8, 0.5);
    head.add(white);
    head.add(part(new THREE.SphereGeometry(0.0075, 8, 6), ink, sx * 0.035, 0.03, 0.089));
    const brow = part(new THREE.BoxGeometry(0.036, 0.007, 0.01), plain(f ? '#2a1d17' : o.hairStyle === 'spikes' ? '#8a7350' : '#2a1d17'), sx * 0.036, 0.052, 0.087);
    brow.rotation.z = -sx * 0.12;
    head.add(brow);
  }
  const nose = part(new THREE.ConeGeometry(0.014, 0.04, 6), skin, 0, 0.004, 0.097);
  nose.rotation.x = 0.35;
  head.add(nose);
  const lips = part(new THREE.SphereGeometry(0.02, 10, 6), plain(f ? '#7a2a34' : new THREE.Color(o.skin).multiplyScalar(0.75).getStyle()), 0, -0.035, 0.088);
  lips.scale.set(1.25, 0.4, 0.5);
  head.add(lips);

  const hair = plain(o.hair);
  const cap = (grow: number, to: number) => {
    const m = part(new THREE.SphereGeometry(0.104 + grow, 20, 12, 0, Math.PI * 2, 0, to), hair, 0, 0.025, -0.006);
    m.scale.set(0.9, 1.08, 1.0);
    m.rotation.x = -0.35;
    head.add(m);
    return m;
  };
  switch (o.hairStyle) {
    case 'spikes': {
      // Short bleached spikes, all over the top.
      cap(0.004, Math.PI * 0.42);
      let seed = 3;
      const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 34; i++) {
        const a = rand() * Math.PI * 2;
        const up = rand() * 0.9;
        const dir = new THREE.Vector3(Math.sin(a) * Math.sin(up), Math.cos(up), Math.cos(a) * Math.sin(up) * 0.9 + 0.12).normalize();
        const spike = part(new THREE.ConeGeometry(0.018, 0.05, 5), hair);
        spike.position.copy(dir).multiplyScalar(0.1).add(new THREE.Vector3(0, 0.035, -0.005));
        spike.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        head.add(spike);
      }
      break;
    }
    case 'buzz':
      cap(0.002, Math.PI * 0.5);
      break;
    case 'undercut': {
      cap(0.002, Math.PI * 0.3);
      const top = part(new THREE.SphereGeometry(0.1, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.35), hair, 0.012, 0.06, 0.005);
      top.scale.set(1, 1.15, 1.1);
      top.rotation.z = -0.25;
      head.add(top);
      break;
    }
    case 'bob': {
      cap(0.01, Math.PI * 0.45);
      // Down the back and sides to the jaw, open over the face, with a fringe.
      const fall = part(new THREE.CylinderGeometry(0.108, 0.118, 0.14, 20, 1, true, Math.PI * 0.18, Math.PI * 1.64), hair, 0, -0.02, -0.01);
      fall.scale.set(0.95, 1, 1);
      head.add(fall);
      const fringe = part(new THREE.BoxGeometry(0.13, 0.03, 0.03), hair, 0, 0.075, 0.075);
      fringe.rotation.x = -0.4;
      head.add(fringe);
      break;
    }
    case 'pony': {
      cap(0.006, Math.PI * 0.5);
      const tail = part(new THREE.CapsuleGeometry(0.03, 0.16, 4, 10), hair, 0, -0.02, -0.12);
      tail.rotation.x = 0.35;
      head.add(tail);
      break;
    }
    case 'bald':
      break;
  }
}

// ---- The crowd at the bar -----------------------------------------------------------------------

type Pose = 'lean' | 'drink' | 'talk' | 'dance' | 'sway' | 'stand';

const CROWD: readonly { look: SaLook; x: number; z: number; rotY: number; pose: Pose }[] = (() => {
  const bar = { x: KITCHEN.bar.x, z: KITCHEN.counter.maxZ };
  const P = (look: SaLook, dx: number, dz: number, rotY: number, pose: Pose) => ({ look, x: bar.x + dx, z: bar.z + dz, rotY, pose });
  const black = '#141414';
  return [
    P({ body: 'f', skin: '#8d5b3e', hair: '#1b1411', hairStyle: 'undercut', top: { kind: 'jacket', color: '#1a1a1a', fabric: 'leather' }, bottom: { kind: 'skinny', color: '#101010', fabric: 'leather' }, shoes: 'boots' }, -0.5, 0.42, Math.PI + 0.15, 'lean'),
    P({ body: 'm', skin: '#e6c3a5', hair: '#ecdcaa', hairStyle: 'spikes', top: { kind: 'tank', color: black, fabric: 'cotton' }, bottom: { kind: 'baggy', color: '#34425c', fabric: 'denim' }, shoes: 'boots', chain: true }, 0.55, 0.45, Math.PI - 0.1, 'lean'),
    P({ body: 'f', skin: '#c99272', hair: '#20140f', hairStyle: 'bob', top: { kind: 'bra', color: '#5b1f2c', fabric: 'cotton' }, bottom: { kind: 'skirt', color: black, fabric: 'leather' }, fishnets: true, shoes: 'boots', choker: true }, -1.6, 1.35, 2.5, 'drink'),
    P({ body: 'm', skin: '#f0d0b4', hair: '#e8d7a0', hairStyle: 'spikes', top: { kind: 'tank', color: black, fabric: 'cotton' }, bottom: { kind: 'baggy', color: '#2e3b54', fabric: 'denim' }, shoes: 'sneakers', chain: true }, -0.3, 1.75, Math.PI - 0.35, 'stand'),
    P({ body: 'f', skin: '#5e3b28', hair: '#0f0b09', hairStyle: 'pony', top: { kind: 'crop', color: '#222222', fabric: 'mesh' }, bottom: { kind: 'baggy', color: '#121212', fabric: 'cotton' }, shoes: 'sneakers', choker: true }, 1.0, 1.7, -2.5, 'talk'),
    P({ body: 'm', skin: '#b07a55', hair: '#16100c', hairStyle: 'buzz', top: { kind: 'tee', color: '#1c1c1c', fabric: 'cotton' }, bottom: { kind: 'baggy', color: '#3b3f47', fabric: 'denim' }, shoes: 'boots' }, 1.9, 1.0, -1.9, 'drink'),
    P({ body: 'f', skin: '#e8c6aa', hair: '#2b1d16', hairStyle: 'bob', top: { kind: 'crop', color: '#1a1a1a', fabric: 'leather' }, bottom: { kind: 'skirt', color: '#3f4531', fabric: 'camo' }, shoes: 'boots', choker: true }, -2.6, 2.4, 2.2, 'dance'),
    P({ body: 'm', skin: '#7b4f35', hair: '#0f0c0a', hairStyle: 'bald', top: { kind: 'jacket', color: '#121212', fabric: 'leather' }, bottom: { kind: 'baggy', color: '#191919', fabric: 'cotton' }, shoes: 'boots', chain: true }, -0.9, 3.0, 3.0, 'dance'),
    P({ body: 'f', skin: '#f2d5bd', hair: '#b43a4a', hairStyle: 'pony', top: { kind: 'tank', color: '#0f0f0f', fabric: 'mesh' }, bottom: { kind: 'skinny', color: '#141414', fabric: 'leather' }, fishnets: false, shoes: 'boots' }, 0.7, 3.2, -2.9, 'dance'),
    P({ body: 'm', skin: '#d7a887', hair: '#3a2a1e', hairStyle: 'undercut', top: { kind: 'tank', color: '#262626', fabric: 'cotton' }, bottom: { kind: 'baggy', color: '#46556e', fabric: 'denim' }, shoes: 'sneakers' }, 2.4, 2.4, -2.3, 'sway'),
    P({ body: 'm', skin: '#9c6a48', hair: '#e9dfc0', hairStyle: 'spikes', top: { kind: 'tee', color: '#2d2d2d', fabric: 'cotton' }, bottom: { kind: 'baggy', color: '#394760', fabric: 'denim' }, shoes: 'sneakers' }, -3.5, 1.2, 1.9, 'stand'),
  ];
})();

/** A beer bottle, for a hand to hold: brown glass, a long neck and a label. */
function bottle(): THREE.Group {
  const g = new THREE.Group();
  const glass = new THREE.MeshLambertMaterial({ color: '#4a2508', transparent: true, opacity: 0.9 });
  g.add(part(new THREE.CylinderGeometry(0.03, 0.03, 0.14, 12), glass, 0, 0.0));
  g.add(part(new THREE.CylinderGeometry(0.012, 0.03, 0.06, 12), glass, 0, 0.1));
  g.add(part(new THREE.CylinderGeometry(0.031, 0.031, 0.06, 12), plain('#d8c89a'), 0, -0.005));
  return g;
}

export interface Homies {
  group: THREE.Group;
  /** Where the crowd stands (for the radar). */
  spots: readonly { x: number; z: number }[];
  update(t: number): void;
}

/** The crowd at the kitchen's bar, for the office's floor. */
export function buildHomies(): Homies {
  const group = new THREE.Group();
  const people = CROWD.map((c, i) => {
    const rig = saBody(c.look);
    rig.root.position.set(c.x, 0, c.z);
    rig.root.rotation.y = c.rotY;
    group.add(rig.root);
    if (c.pose === 'drink') {
      const b = bottle();
      b.position.set(0, -0.08, 0.03);
      rig.arms[0].hand.add(b);
    }
    return { rig, pose: c.pose, phase: i * 1.37 };
  });
  return {
    group,
    spots: CROWD.map(({ x, z }) => ({ x, z })),
    update(t) {
      for (const p of people) pose(p.rig, p.pose, t + p.phase, t);
    },
  };
}

/** Moves `r` for `pose`, `p` seconds into its own time and `t` on the shared beat. */
function pose(r: SaRig, kind: Pose, p: number, t: number) {
  const [R, L] = r.arms;
  // Standing easy: weight from foot to foot, a breath, arms hanging.
  r.hips.position.y = r.stand;
  r.hips.rotation.set(0, 0, Math.sin(p * 0.8) * 0.03);
  r.hips.position.x = Math.sin(p * 0.8) * 0.015;
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
      r.chest.rotation.x = 0.5;
      r.head.rotation.x = -0.35;
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

const HAIRSTYLES_M = ['spikes', 'buzz', 'undercut', 'bald'] as const;
const HAIRSTYLES_F = ['bob', 'pony', 'undercut'] as const;

/** A body like the crowd's for someone in the office: their skin, their hair's color and their color on top, dressed for the club. */
export function standInLook(name: string, skin: string, hair: string, color: string): SaLook {
  const h = rand01(name);
  const f = h > 0.5;
  const k = Math.floor(h * 1000);
  return {
    body: f ? 'f' : 'm',
    skin,
    hair,
    hairStyle: f ? HAIRSTYLES_F[k % HAIRSTYLES_F.length] : HAIRSTYLES_M[k % HAIRSTYLES_M.length],
    top: { kind: f ? (['crop', 'tank', 'jacket'] as const)[k % 3] : (['tank', 'tee', 'jacket'] as const)[k % 3], color, fabric: k % 3 === 2 ? 'leather' : 'cotton' },
    bottom: { kind: f && k % 2 ? 'skinny' : 'baggy', color: '#2e3b54', fabric: 'denim' },
    shoes: k % 2 ? 'boots' : 'sneakers',
    chain: !f && k % 2 === 0,
    choker: f,
  };
}

/** Someone's body in the look, in place of their figure, moving as it does. */
export class SaStandIn {
  readonly rig: SaRig;

  constructor(look: SaLook) {
    this.rig = saBody(look);
  }

  get root(): THREE.Group {
    return this.rig.root;
  }

  /** Takes on `f`'s pose: its legs' and arms' swing (a little less of it, on longer limbs), its lean, and how far down onto a seat. */
  follow(f: FigureRig) {
    const r = this.rig;
    const bob = f.body.position.y - f.sitK * (f.seatHips - f.hips);
    r.hips.position.y = THREE.MathUtils.lerp(r.stand, f.seatHips + 0.04, f.sitK) + bob * 0.5;
    r.hips.position.x = 0;
    r.hips.rotation.copy(f.body.rotation as THREE.Euler);
    r.chest.rotation.set(0, 0, 0);
    r.head.rotation.copy(f.head.rotation as THREE.Euler);
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
  }
}

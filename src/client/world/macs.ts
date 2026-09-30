import * as THREE from 'three';
import { mesh, roundedBox, toon } from './toon';

// Apple kit for the round table (see buildRoundTable and buildDesk): 24-inch iMacs in their colors,
// Mac minis, and iPhones lying about. Each is built facing +z, standing (or lying) on the origin.

/** The iMac's colors: its back and stand, and the paler chin under the screen. */
export const IMAC_COLORS = [
  { back: '#3f6ea3', chin: '#a9c6e6' },
  { back: '#d2687f', chin: '#f4c3cb' },
  { back: '#4b8b67', chin: '#b6dac2' },
  { back: '#e2b93b', chin: '#f6e3a3' },
  { back: '#e7793e', chin: '#f8c9a8' },
  { back: '#8b6bb5', chin: '#d0c1e9' },
] as const;

/** A wallpaper for an iMac of `color`'s: soft bands of it, darker toward the bottom. */
function wallpaper(color: string): THREE.MeshBasicMaterial {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 144;
  const g = c.getContext('2d')!;
  const base = new THREE.Color(color);
  const grad = g.createLinearGradient(0, 0, 256, 144);
  grad.addColorStop(0, `#${base.clone().lerp(new THREE.Color('#ffffff'), 0.55).getHexString()}`);
  grad.addColorStop(0.55, `#${base.getHexString()}`);
  grad.addColorStop(1, `#${base.clone().lerp(new THREE.Color('#10121a'), 0.55).getHexString()}`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 144);
  // A couple of wide soft waves across it.
  for (const [y, a] of [
    [60, 0.25],
    [96, 0.18],
  ] as const) {
    g.fillStyle = `rgba(255,255,255,${a})`;
    g.beginPath();
    g.moveTo(0, y);
    g.bezierCurveTo(80, y - 40, 170, y + 40, 256, y - 10);
    g.lineTo(256, y + 14);
    g.bezierCurveTo(170, y + 60, 80, y - 18, 0, y + 22);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
}

/**
 * A 24-inch iMac, `scale` times life size: a thin slab in its color at the back, white bezel round
 * the screen and the paler chin under it in front, on a stand like a studio display's.
 */
/** The iMac's slab (width, height, thickness, and its chin's height), and where on its stand the slab stands, tipped back. */
export const IMAC = { W: 0.547, H: 0.418, T: 0.0115, chin: 0.09, y: 0.075, z: -0.07, tilt: -0.06 } as const;

export function imac(colors: (typeof IMAC_COLORS)[number], scale = 1): THREE.Group {
  const g = new THREE.Group();
  const back = toon(colors.back);
  const { W, H, T } = IMAC;
  // The stand: a flat foot and a sloping plate up to the slab's back.
  g.add(mesh(roundedBox(0.15, 0.008, 0.14, 0.03), back, 0, 0.004, -0.05));
  const arm = mesh(roundedBox(0.14, 0.012, 0.26, 0.03), back, 0, 0.12, -0.1);
  arm.rotation.x = Math.PI / 2 - 0.25;
  g.add(arm);
  // The slab, stood up, a touch back from upright.
  const slab = new THREE.Group();
  slab.position.set(0, IMAC.y, IMAC.z);
  slab.rotation.x = IMAC.tilt;
  const body = mesh(roundedBox(W, T, H, 0.015), back, 0, H / 2, 0);
  body.rotation.x = Math.PI / 2;
  slab.add(body);
  const front = T / 2 + 0.0005;
  const chinH = IMAC.chin;
  slab.add(mesh(new THREE.PlaneGeometry(W - 0.004, chinH), toon(colors.chin), 0, chinH / 2 + 0.002, front, false));
  slab.add(mesh(new THREE.PlaneGeometry(W - 0.004, H - chinH - 0.004), toon('#f4f4f2'), 0, chinH + (H - chinH) / 2, front, false));
  slab.add(mesh(new THREE.PlaneGeometry(W - 0.03, H - chinH - 0.03), wallpaper(colors.back), 0, chinH + (H - chinH) / 2, front + 0.0005, false));
  g.add(slab);
  g.scale.setScalar(scale);
  return g;
}

/** A Mac mini, `scale` times life size: a low square of aluminium with rounded corners, its light on the front. */
export function macMini(scale = 1): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(roundedBox(0.197, 0.036, 0.197, 0.025), toon('#d3d7dc'), 0, 0.018, 0));
  g.add(mesh(new THREE.BoxGeometry(0.18, 0.002, 0.18), toon('#aeb4bb'), 0, 0.001, 0, false));
  g.add(mesh(new THREE.CircleGeometry(0.003, 8), toon('#ffffff', { emissive: '#ffffff' }), -0.07, 0.018, 0.0986, false));
  g.scale.setScalar(scale);
  return g;
}

/**
 * An iPhone lying on its back or (`faceDown`) on its face, `scale` times life size: its screen black
 * glass, or its back in `color` with the square camera bump and its three lenses.
 */
export function iphone(color = '#4a4d52', faceDown = false, scale = 1): THREE.Group {
  const g = new THREE.Group();
  const W = 0.0715;
  const L = 0.147;
  const T = 0.0078;
  g.add(mesh(roundedBox(W, T, L, 0.0035), toon(color), 0, T / 2, 0));
  if (faceDown) {
    const bumpAt = new THREE.Vector3(-W / 2 + 0.021, T, -L / 2 + 0.021);
    g.add(mesh(roundedBox(0.036, 0.003, 0.036, 0.008), toon(color), bumpAt.x, T + 0.0015, bumpAt.z));
    const lens = toon('#15161a');
    for (const [dx, dz] of [
      [-0.008, -0.008],
      [-0.008, 0.008],
      [0.008, 0],
    ]) {
      g.add(mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.004, 14), lens, bumpAt.x + dx, T + 0.004, bumpAt.z + dz, false));
    }
  } else {
    g.add(mesh(new THREE.PlaneGeometry(W - 0.004, L - 0.004).rotateX(-Math.PI / 2), toon('#101114'), 0, T + 0.0005, 0, false));
    // The island at the top of the screen.
    g.add(mesh(new THREE.PlaneGeometry(0.018, 0.005).rotateX(-Math.PI / 2), toon('#000000'), 0, T + 0.0008, -L / 2 + 0.012, false));
  }
  g.scale.setScalar(scale);
  return g;
}

import * as THREE from 'three';
import { FLAG_BOLD, FLAG_DIM, FLAG_INVERSE, RGB_FLAG, type Run } from '../../shared/protocol';
import { mesh, roundedBox, toon } from './toon';
import { TERM_THEME } from '../ui/termtheme';
import { IMAC, IMAC_COLORS, imac } from './macs';


const BASE16 = [
  TERM_THEME.black, TERM_THEME.red, TERM_THEME.green, TERM_THEME.yellow, TERM_THEME.blue, TERM_THEME.magenta, TERM_THEME.cyan, TERM_THEME.white,
  TERM_THEME.brightBlack, TERM_THEME.brightRed, TERM_THEME.brightGreen, TERM_THEME.brightYellow, TERM_THEME.brightBlue, TERM_THEME.brightMagenta, TERM_THEME.brightCyan, TERM_THEME.brightWhite,
];

const PALETTE: string[] = (() => {
  const p = [...BASE16];
  const steps = [0, 95, 135, 175, 215, 255];
  for (let r = 0; r < 6; r++) for (let g = 0; g < 6; g++) for (let b = 0; b < 6; b++) p.push(`rgb(${steps[r]},${steps[g]},${steps[b]})`);
  for (let i = 0; i < 24; i++) {
    const v = 8 + i * 10;
    p.push(`rgb(${v},${v},${v})`);
  }
  return p;
})();

function color(c: number, fallback: string): string {
  if (c < 0) return fallback;
  if (c >= RGB_FLAG) {
    const rgb = c & 0xffffff;
    return `rgb(${(rgb >> 16) & 255},${(rgb >> 8) & 255},${rgb & 255})`;
  }
  return PALETTE[c] ?? fallback;
}

export interface ScreenState {
  cols: number;
  rows: number;
  lines: Run[][];
  cursor: [number, number];
  version: number;
}

const runLen = (runs: Run[] | undefined) => (runs ? runs.reduce((n, r) => n + [...r[0]].length, 0) : 0);
const CHAR_WIDTH = 0.6;
const LINE_HEIGHT = 1.25;
const MIN_ZOOM_ROWS = 12;
const MIN_ZOOM_COLS = 56;

/**
 * The part of a terminal worth showing on a small laptop. Keep the usual recent rows, then add
 * surrounding rows for its natural character aspect ratio to use the available canvas.
 */
function activeWindow(s: ScreenState, width: number, height: number, preferredRows: number): { top: number; rows: number; cols: number; first: number; last: number } {
  let first = -1;
  let last = -1;
  let cols = MIN_ZOOM_COLS;
  for (let y = 0; y < s.rows; y++) {
    const runs = s.lines[y];
    if (!runs?.some((r) => r[0].trim() || r[2] !== -1)) continue;
    if (first < 0) first = y;
    last = y;
    cols = Math.max(cols, runLen(runs));
  }
  cols = Math.min(s.cols, cols);
  // A natural terminal cell is about .6 characters wide by 1.25 characters high. Add enough
  // surrounding rows for a wide PTY to use the laptop's height without vertically stretching glyphs.
  const aspectRows = Math.ceil((height * CHAR_WIDTH * cols) / (width * LINE_HEIGHT));
  const rows = Math.min(s.rows, Math.max(MIN_ZOOM_ROWS, preferredRows, aspectRows));
  const top = last < 0 ? 0 : Math.max(0, Math.min(last + 1 - rows, s.rows - rows));
  const contentFirst = first < 0 ? top : Math.max(top, first);
  const contentLast = last < 0 ? top : Math.min(top + rows - 1, last);
  return { top, rows, cols, first: contentFirst, last: contentLast };
}

/** Paints a terminal screen onto a canvas. Shared by the 3D laptops and the HUD previews. */
export function paintScreen(ctx: CanvasRenderingContext2D, w: number, h: number, s: ScreenState | undefined, placeholder?: string, zoomRows = 0) {
  ctx.fillStyle = TERM_THEME.background;
  ctx.fillRect(0, 0, w, h);
  if (!s) {
    ctx.fillStyle = '#6c7086';
    ctx.font = `700 ${Math.round(h / 12)}px ui-monospace, Menlo, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(placeholder ?? 'booting…', w / 2, h / 2);
    ctx.textAlign = 'left';
    return;
  }
  const pad = w * 0.02;
  const win = zoomRows
    ? activeWindow(s, w - pad * 2, h - pad * 2, zoomRows)
    : { top: 0, rows: s.rows, cols: s.cols, first: 0, last: s.rows - 1 };
  const cellW = (w - pad * 2) / win.cols;
  const cellH = (h - pad * 2) / win.rows;
  const fontSize = Math.max(4, Math.min(cellW / CHAR_WIDTH, cellH / LINE_HEIGHT));
  const charW = fontSize * CHAR_WIDTH;
  const lineH = fontSize * LINE_HEIGHT;
  const gridW = win.cols * charW;
  const contentRows = Math.max(1, win.last - win.first + 1);
  const gridH = contentRows * lineH;
  const left = pad + (w - pad * 2 - gridW) / 2;
  const top = pad + (h - pad * 2 - gridH) / 2;
  ctx.textBaseline = 'top';
  for (let y = 0; y < win.rows; y++) {
    const runs = s.lines[win.top + y];
    if (!runs) continue;
    let x = 0;
    const py = top + (win.top + y - win.first) * lineH;
    for (const [text, fgc, bgc, flags] of runs) {
      const len = [...text].length;
      let fg = color(fgc, TERM_THEME.foreground);
      let bg = bgc < 0 ? null : color(bgc, TERM_THEME.background);
      if (flags & FLAG_INVERSE) {
        const tmp = fg;
        fg = bg ?? TERM_THEME.background;
        bg = tmp;
      }
      const px = left + x * charW;
      if (bg) {
        ctx.fillStyle = bg;
        ctx.fillRect(px, py, len * charW + 0.5, lineH + 0.5);
      }
      if (text.trim()) {
        ctx.font = `${flags & FLAG_BOLD ? 700 : 400} ${fontSize}px ui-monospace, Menlo, Consolas, monospace`;
        ctx.globalAlpha = flags & FLAG_DIM ? 0.55 : 1;
        ctx.fillStyle = fg;
        ctx.fillText(text, px, py + (lineH - fontSize) / 2);
        ctx.globalAlpha = 1;
      }
      x += len;
    }
  }
}

/**
 * A studio display's stand, body and keyboard: the stand and keyboard into `root`, the slab of the
 * display with its black glass into `lid` (where the screen goes), which it stands up on the stand.
 */
function displayParts(root: THREE.Group, lid: THREE.Group) {
  const alu = toon('#d8dce2');
  const black = toon('#16171b');
  // The stand: a flat foot, and a sloping plate up from its back to the display's.
  root.add(mesh(roundedBox(0.3, 0.012, 0.26, 0.05), alu, 0, 0.006, -0.1));
  const arm = mesh(roundedBox(0.28, 0.02, 0.44, 0.04), alu, 0, 0.21, -0.19);
  arm.rotation.x = Math.PI / 2 - 0.3;
  root.add(arm);
  // The display: a thin slab of aluminium, black glass edge to edge in front, the screen in it.
  // In front of the plate where it overlaps it, so the plate's behind it, as a real stand is.
  lid.position.set(0, 0.22, -0.15);
  const back = mesh(roundedBox(0.8, 0.03, 0.5, 0.025), alu, 0, 0.25, -0.004);
  back.rotation.x = Math.PI / 2;
  lid.add(back);
  lid.add(mesh(new THREE.PlaneGeometry(0.78, 0.48), black, 0, 0.25, 0.0125, false));
  // A slim keyboard in front of it.
  root.add(mesh(roundedBox(0.44, 0.012, 0.14, 0.02), alu, 0, 0.006, 0.2));
  root.add(mesh(new THREE.BoxGeometry(0.4, 0.002, 0.11), toon('#f4f5f7'), 0, 0.013, 0.2, false));
}

/** How much bigger than life an iMac at the round table is, to stand as big as a studio display. */
export const IMAC_SCALE = 1.45;

/** A studio display with nobody at it: switched off, its glass dark, stood where a worker's would be (see Laptop). */
export function idleDisplay(): THREE.Group {
  const root = new THREE.Group();
  const lid = new THREE.Group();
  root.add(lid);
  displayParts(root, lid);
  lid.rotation.x = -0.08;
  return root;
}

/** What a worker works at: a laptop, the castle's tome, or a studio display (see Laptop). */
export type DeviceStyle = 'laptop' | 'tome' | 'display' | 'imac';

export class Laptop {
  readonly root = new THREE.Group();
  private canvas = document.createElement('canvas');
  private ctx: CanvasRenderingContext2D;
  private texture: THREE.CanvasTexture;
  private lid = new THREE.Group();
  private drawnVersion = -1;
  private paintedAt = 0;
  private openT = 0;
  private placeholder = 'booting…';
  /** Anything else of its own to free (the tome's page). */
  private owned: THREE.Material[] = [];
  private screenMat: THREE.MeshBasicMaterial;

  /**
   * `tome`: a leather-bound book whose inside page shows the terminal, for the castle; it opens and
   * shuts like the laptop. `display`: a studio display on its stand, with a keyboard in front, for
   * the office's round table; rather than open and shut, it wakes up and goes dark.
   */
  /** `imacColor`: which of IMAC_COLORS an `imac` is. */
  constructor(private readonly style: DeviceStyle = 'laptop', imacColor = 0) {
    this.canvas.width = 1024;
    this.canvas.height = 680;
    this.ctx = this.canvas.getContext('2d')!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 8;
    this.texture.minFilter = THREE.LinearMipmapLinearFilter;

    // Lid, hinged along the back edge
    this.lid.position.set(0, 0.035, -0.24);
    this.root.add(this.lid);
    this.screenMat = new THREE.MeshBasicMaterial({ map: this.texture, toneMapped: false });
    this.owned.push(this.screenMat);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.46), this.screenMat);
    screen.position.set(0, 0.25, 0.014);
    this.lid.add(screen);
    if (style === 'tome') {
      const leather = toon('#5a2a17');
      const gold = toon('#d9ab2e');
      const pages = toon('#efe3c2');
      // The back cover and the block of pages on it, gold on the corners.
      this.root.add(mesh(roundedBox(0.8, 0.03, 0.54, 0.03), leather, 0, 0.015, 0.02));
      this.root.add(mesh(roundedBox(0.74, 0.03, 0.48, 0.02), pages, 0, 0.044, 0.02, false));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.root.add(mesh(new THREE.BoxGeometry(0.07, 0.034, 0.07), gold, sx * 0.37, 0.016, 0.02 + sz * 0.24, false));
      // The front cover, open, with the page inside it (the screen) and a gold seal on the outside.
      const cover = mesh(roundedBox(0.8, 0.025, 0.52, 0.03), leather, 0, 0.25, 0);
      cover.rotation.x = Math.PI / 2;
      this.lid.add(cover);
      const pageMat = new THREE.MeshBasicMaterial({ color: '#efe3c2' });
      this.owned.push(pageMat);
      const page = mesh(new THREE.PlaneGeometry(0.76, 0.49), pageMat, 0, 0.25, 0.0135, false);
      this.lid.add(page);
      // Hinged over the block of pages, so the cover shuts down on top of them.
      this.lid.position.y = 0.072;
      screen.position.z = 0.0145;
      screen.scale.setScalar(0.94);
      const seal = mesh(new THREE.CircleGeometry(0.08, 20), gold, 0, 0.27, -0.014, false);
      seal.rotation.y = Math.PI;
      this.lid.add(seal);
      // A ribbon bookmark hanging out of the pages.
      this.root.add(mesh(new THREE.BoxGeometry(0.03, 0.004, 0.16), toon('#9b1c1c'), 0.2, 0.06, 0.28, false));
    } else if (style === 'display') {
      displayParts(this.root, this.lid);
    } else if (style === 'imac') {
      // The iMac, the terminal on its screen, where its wallpaper is.
      this.root.add(imac(IMAC_COLORS[imacColor % IMAC_COLORS.length], IMAC_SCALE));
      this.lid.position.set(0, IMAC.y * IMAC_SCALE, IMAC.z * IMAC_SCALE);
      this.lid.scale.setScalar(IMAC_SCALE);
      screen.position.set(0, IMAC.chin + (IMAC.H - IMAC.chin) / 2, IMAC.T / 2 + 0.0015);
      screen.scale.set((IMAC.W - 0.03) / 0.72, (IMAC.H - IMAC.chin - 0.03) / 0.46, 1);
    } else {
      // A MacBook Pro-ish laptop: space grey all over, black keys, and black glass round the screen.
      const shell = toon('#7d8189');
      const dark = toon('#141518');
      // Base with keyboard and trackpad
      this.root.add(mesh(roundedBox(0.78, 0.03, 0.52, 0.04), shell, 0, 0.015, 0.02));
      this.root.add(mesh(new THREE.BoxGeometry(0.66, 0.004, 0.24), dark, 0, 0.031, 0.0, false));
      this.root.add(mesh(new THREE.BoxGeometry(0.3, 0.003, 0.15), toon('#8a8e96'), 0, 0.031, 0.18, false));
      const lidShell = mesh(roundedBox(0.78, 0.02, 0.5, 0.04), shell, 0, 0.25, -0.002);
      lidShell.rotation.x = Math.PI / 2;
      this.lid.add(lidShell);
      this.lid.add(mesh(new THREE.PlaneGeometry(0.76, 0.48), dark, 0, 0.25, 0.0105, false));
    }
    this.setLid(0); // closed (or dark); opens on update
    paintScreen(this.ctx, this.canvas.width, this.canvas.height, undefined, this.placeholder);
    this.texture.needsUpdate = true;
  }

  setPlaceholder(text: string) {
    if (text === this.placeholder) return;
    this.placeholder = text;
    this.drawnVersion = -2;
  }

  /** `distance` to the camera throttles repaints: far-away laptops refresh rarely. */
  update(dt: number, screen: ScreenState | undefined, distance = 0) {
    if (this.openT < 1) this.setLid(Math.min(1, this.openT + dt * 1.6));
    const version = screen ? screen.version : -1;
    const now = performance.now();
    const every = distance < 6 ? 150 : distance < 14 ? 600 : 2000;
    if (version !== this.drawnVersion && (now - this.paintedAt > every || this.drawnVersion < 0)) {
      this.paintedAt = now;
      this.drawnVersion = version;
      paintScreen(this.ctx, this.canvas.width, this.canvas.height, screen, this.placeholder, 22);
      this.texture.needsUpdate = true;
    }
  }

  /** Folds the lid down a little further (it snaps shut at the end); true once it's closed. */
  shut(dt: number): boolean {
    this.setLid(Math.max(0, this.openT - dt * 2));
    return this.openT === 0;
  }

  private setLid(open: number) {
    this.openT = open;
    const e = 1 - Math.pow(1 - open, 3);
    // A display (or an iMac) stands where it is, tipped back a touch, and lights up.
    if (this.style === 'display' || this.style === 'imac') {
      this.lid.rotation.x = this.style === 'imac' ? IMAC.tilt : -0.08;
      this.screenMat.color.setScalar(e);
      return;
    }
    this.lid.rotation.x = Math.PI / 2 - e * (Math.PI / 2 + 0.22);
  }

  dispose() {
    this.texture.dispose();
    for (const m of this.owned) m.dispose();
  }
}

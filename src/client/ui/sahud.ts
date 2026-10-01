import { FLOOR, KITCHEN, LOUNGE, ROUND_TABLE, ROUND_TABLES } from '../../shared/layout';

// The San Andreas test look's HUD (see world/sanandreas.ts): top right, a fist in a box for the
// weapon, the time, two bars and the money, in a fat condensed type with a black outline; bottom
// left, a round radar of the office's floor turned so up is where you're looking, with you in the
// middle and everyone else as dots.

export interface SaHudState {
  /** 0–1: the pink bar (your coffee buzz) and the red one (health: less of it the drunker you are). */
  buzz: number;
  health: number;
  money: number;
  /** Where you are, which way you're looking (the camera's yaw, see Player.camYaw), and the dots. */
  x: number;
  z: number;
  yaw: number;
  dots: readonly { x: number; z: number; color: string }[];
}

const RADAR = 176;
/** Pixels to a meter on the radar. */
const PX = 4.2;

export class SaHud {
  private el: HTMLElement;
  private clock: HTMLElement;
  private buzz: HTMLElement;
  private health: HTMLElement;
  private money: HTMLElement;
  private radar: HTMLCanvasElement;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'sa-hud';
    this.el.innerHTML = `
      <div class="sa-top">
        <div class="sa-weapon" aria-hidden="true">✊</div>
        <div class="sa-stats">
          <div class="sa-clock"></div>
          <div class="sa-bar sa-buzz"><i></i></div>
          <div class="sa-bar sa-health"><i></i></div>
        </div>
      </div>
      <div class="sa-money"></div>
      <canvas class="sa-radar" width="${RADAR * 2}" height="${RADAR * 2}"></canvas>`;
    this.clock = this.el.querySelector('.sa-clock')!;
    this.buzz = this.el.querySelector('.sa-buzz i')!;
    this.health = this.el.querySelector('.sa-health i')!;
    this.money = this.el.querySelector('.sa-money')!;
    this.radar = this.el.querySelector('.sa-radar')!;
    this.el.hidden = true;
    document.body.append(this.el);
  }

  show(on: boolean) {
    this.el.hidden = !on;
  }

  update(s: SaHudState) {
    const now = new Date();
    this.clock.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    this.buzz.style.width = `${Math.round(Math.max(0.04, s.buzz) * 100)}%`;
    this.health.style.width = `${Math.round(Math.max(0.04, s.health) * 100)}%`;
    this.money.textContent = `€${String(Math.max(0, Math.round(s.money))).padStart(8, '0')}`;
    this.drawRadar(s);
  }

  private drawRadar(s: SaHudState) {
    const g = this.radar.getContext('2d')!;
    const R = RADAR;
    g.setTransform(2, 0, 0, 2, 0, 0);
    g.clearRect(0, 0, R, R);
    g.save();
    g.beginPath();
    g.arc(R / 2, R / 2, R / 2 - 4, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = '#3b3b3b';
    g.fillRect(0, 0, R, R);
    // The world turned so where you look is up, round you in the middle.
    const sin = Math.sin(s.yaw);
    const cos = Math.cos(s.yaw);
    // Looking along (-sin, -cos); right of that is (cos, -sin).
    const at = (x: number, z: number): [number, number] => {
      const dx = x - s.x;
      const dz = z - s.z;
      return [R / 2 + (dx * cos - dz * sin) * PX, R / 2 + (dx * sin + dz * cos) * PX];
    };
    const poly = (pts: [number, number][], fill: string, stroke?: string) => {
      g.beginPath();
      pts.forEach(([x, z], i) => {
        const [px, py] = at(x, z);
        if (i) g.lineTo(px, py);
        else g.moveTo(px, py);
      });
      g.closePath();
      g.fillStyle = fill;
      g.fill();
      if (stroke) {
        g.strokeStyle = stroke;
        g.lineWidth = 2;
        g.stroke();
      }
    };
    const rect = (minX: number, minZ: number, maxX: number, maxZ: number, fill: string, stroke?: string) =>
      poly(
        [
          [minX, minZ],
          [maxX, minZ],
          [maxX, maxZ],
          [minX, maxZ],
        ],
        fill,
        stroke,
      );
    rect(FLOOR.minX, FLOOR.minZ, FLOOR.maxX, FLOOR.maxZ, '#8a8a8a', '#d8d8d8');
    const k = KITCHEN.counter;
    rect(k.minX, k.minZ, k.maxX, k.maxZ, '#5e5e5e');
    rect(LOUNGE.x - LOUNGE.rug / 2, LOUNGE.z - LOUNGE.rug / 2, LOUNGE.x + LOUNGE.rug / 2, LOUNGE.z + LOUNGE.rug / 2, '#6f6f6f');
    for (const t of ROUND_TABLES) {
      const [px, py] = at(t.x, t.z);
      g.beginPath();
      g.arc(px, py, ROUND_TABLE.radius * PX, 0, Math.PI * 2);
      g.fillStyle = '#626262';
      g.fill();
    }
    for (const d of s.dots) {
      const [px, py] = at(d.x, d.z);
      g.beginPath();
      g.arc(px, py, 3.2, 0, Math.PI * 2);
      g.fillStyle = d.color;
      g.fill();
      g.lineWidth = 1;
      g.strokeStyle = '#000';
      g.stroke();
    }
    g.restore();
    // You: a white arrow pointing up, and the rim.
    g.beginPath();
    g.moveTo(R / 2, R / 2 - 8);
    g.lineTo(R / 2 + 6, R / 2 + 6);
    g.lineTo(R / 2, R / 2 + 2);
    g.lineTo(R / 2 - 6, R / 2 + 6);
    g.closePath();
    g.fillStyle = '#ffffff';
    g.fill();
    g.strokeStyle = '#000';
    g.lineWidth = 1.5;
    g.stroke();
    g.beginPath();
    g.arc(R / 2, R / 2, R / 2 - 4, 0, Math.PI * 2);
    g.strokeStyle = '#0c0c0c';
    g.lineWidth = 6;
    g.stroke();
    // North.
    const [nx, ny] = at(s.x, s.z - 1000);
    const a = Math.atan2(ny - R / 2, nx - R / 2);
    const nr = R / 2 - 6;
    g.font = '900 15px Impact, "Arial Black", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 3;
    g.strokeStyle = '#000';
    g.strokeText('N', R / 2 + Math.cos(a) * nr, R / 2 + Math.sin(a) * nr);
    g.fillStyle = '#fff';
    g.fillText('N', R / 2 + Math.cos(a) * nr, R / 2 + Math.sin(a) * nr);
  }
}

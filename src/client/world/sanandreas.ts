import * as THREE from 'three';

/**
 * A test of a look like an old PS2 game in the smog of a sunny city (think San Andreas): turned on with
 * `?sa` on the address, off with `?sa=0`, and F9 flips it (remembered on this browser). The frame is
 * drawn small, a little over half size and without smoothing its edges, then blended into what was
 * on the screen a moment ago, so things moving leave trails. On its way to the screen it gets a
 * warm, washed-out orange-brown haze, faded blacks, soft glowing lights, grain and dark corners.
 */

const BLEND = /* glsl */ `
uniform sampler2D frame;
uniform sampler2D before;
uniform float trail;
varying vec2 vUv;
void main() {
  vec3 now = texture2D( frame, vUv ).rgb;
  vec3 was = texture2D( before, vUv ).rgb;
  gl_FragColor = vec4( mix( now, was, trail ), 1.0 );
}
`;

const GRADE = /* glsl */ `
uniform sampler2D map;
uniform vec2 texel;
uniform float time;
varying vec2 vUv;

float hash( vec2 p ) {
  return fract( sin( dot( p, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
}

vec3 toDisplay( vec3 c ) { return pow( max( c, 0.0 ), vec3( 1.0 / 2.2 ) ); }
vec3 toLinear( vec3 c ) { return pow( max( c, 0.0 ), vec3( 2.2 ) ); }

void main() {
  gl_FragColor = vec4( texture2D( map, vUv ).rgb, 1.0 );
  // A soft glow round what's bright: a wide cheap blur of it, added back on.
  vec3 glow = vec3( 0.0 );
  for ( int i = 0; i < 8; i++ ) {
    float a = float( i ) * 0.785398;
    glow += texture2D( map, vUv + vec2( cos( a ), sin( a ) ) * texel * 5.0 ).rgb;
  }
  glow /= 8.0;
  gl_FragColor.rgb += max( glow - 0.55, 0.0 ) * 0.5;
  #include <tonemapping_fragment>
  vec3 col = toDisplay( gl_FragColor.rgb );

  // Washed out and warm: less color, toward an orange-brown, the blacks faded up to a brown.
  float lum = dot( col, vec3( 0.299, 0.587, 0.114 ) );
  col = mix( vec3( lum ), col, 0.78 );
  col *= vec3( 1.1, 0.97, 0.76 );
  col = mix( col, vec3( 0.93, 0.74, 0.5 ), 0.1 * smoothstep( 0.3, 1.0, lum ) );
  col = vec3( 0.075, 0.05, 0.03 ) + col * 0.93;
  col = ( col - 0.5 ) * 1.07 + 0.5;

  // Grain, and darker toward the corners.
  col += ( hash( vUv * 731.0 + fract( time * 7.3 ) * 91.0 ) - 0.5 ) * 0.045;
  vec2 c = vUv - 0.5;
  col *= 1.0 - smoothstep( 0.18, 0.75, dot( c, c ) ) * 0.45;

  gl_FragColor = vec4( toLinear( clamp( col, 0.0, 1.0 ) ), 1.0 );
  #include <colorspace_fragment>
}
`;

const VERTEX = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }';

/** How big the frame is drawn, to the screen's CSS pixels, and how much of the last frame stays in each new one. */
const SCALE = 0.6;
const TRAIL = 0.42;

export class SanAndreasLook {
  private frame: THREE.WebGLRenderTarget | null = null;
  /** The trails: the last frame blended (read from one) and this one (written to the other), swapped each frame. */
  private history: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget] | null = null;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly quad: THREE.Mesh;
  private readonly blend: THREE.ShaderMaterial;
  private readonly grade: THREE.ShaderMaterial;
  private readonly size = new THREE.Vector2();
  /** Fresh history: the first frame has nothing to trail from. */
  private fresh = true;

  constructor(private renderer: THREE.WebGLRenderer) {
    const quiet = { depthTest: false, depthWrite: false, vertexShader: VERTEX };
    this.blend = new THREE.ShaderMaterial({ ...quiet, uniforms: { frame: { value: null }, before: { value: null }, trail: { value: TRAIL } }, fragmentShader: BLEND, toneMapped: false });
    this.grade = new THREE.ShaderMaterial({ ...quiet, uniforms: { map: { value: null }, texel: { value: new THREE.Vector2() }, time: { value: 0 } }, fragmentShader: GRADE });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.grade);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
  }

  /** Sends what's drawn next into the small frame instead of onto the screen. */
  begin() {
    const css = this.renderer.getSize(this.size);
    const w = Math.max(1, Math.round(css.x * SCALE));
    const h = Math.max(1, Math.round(css.y * SCALE));
    if (!this.frame || this.frame.width !== w || this.frame.height !== h) {
      this.release();
      // Kept in half floats, bright lights and all, for the tone mapping to roll off on the way out.
      const made = () => new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType });
      this.frame = made();
      this.history = [made(), made()];
      this.fresh = true;
    }
    this.renderer.setRenderTarget(this.frame);
  }

  /** Blends the frame into the trails and puts it on the screen, `time` seconds in (for the grain). */
  end(time: number, motion: boolean) {
    const [before, after] = this.history!;
    this.quad.material = this.blend;
    this.blend.uniforms.frame.value = this.frame!.texture;
    this.blend.uniforms.before.value = before.texture;
    this.blend.uniforms.trail.value = this.fresh || !motion ? 0 : TRAIL;
    this.renderer.setRenderTarget(after);
    this.renderer.render(this.scene, this.camera);
    this.fresh = false;

    this.quad.material = this.grade;
    this.grade.uniforms.map.value = after.texture;
    this.grade.uniforms.texel.value.set(1 / after.width, 1 / after.height);
    this.grade.uniforms.time.value = motion ? time : 0;
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.scene, this.camera);
    this.history = [after, before];
  }

  /** Lets go of its textures, when it's switched off. */
  release() {
    this.frame?.dispose();
    for (const t of this.history ?? []) t.dispose();
    this.frame = null;
    this.history = null;
  }
}

const KEY = 'agent-office:sa-look';

/** Whether the look is on: `?sa` or `?sa=0` on the address says (and is remembered), else what was last chosen here. */
export function saLookWanted(): boolean {
  const q = new URLSearchParams(location.search).get('sa');
  if (q !== null) {
    const on = q !== '0';
    rememberSaLook(on);
    return on;
  }
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function rememberSaLook(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    // Not remembered, then.
  }
}

import * as THREE from 'three';
// The sky's patch of every lit material goes first: the grime below builds on it (its vSkyWorld).
import './sky';

/**
 * A test of a look like an old PS2 game in the smog of a sunny city (think San Andreas): turned on with
 * `?sa` on the address, off with `?sa=0`, and F9 flips it (remembered on this browser). The frame is
 * drawn small, a little over half size and without smoothing its edges, then blended into what was
 * on the screen a moment ago, so things moving leave trails. On its way to the screen it gets a
 * warm, dim, reddish-brown haze, soft glowing lights, grain and dark corners. And everything lit gets
 * grimy: stains and grit over every surface, from its place in the world (see GRIME), like the
 * dirty textures of those games.
 */

/** 0 or 1: the grime's on (see saGrime). One uniform, shared by every lit material. */
const grime = { value: 0 };

export function saGrime(on: boolean) {
  grime.value = on ? 1 : 0;
}

/** Keeps `mat` clean of the grime (a person's skin and clothes): its own program, then, without the patch. */
export function noGrime(mat: THREE.Material) {
  mat.userData.noGrime = true;
  mat.customProgramCacheKey = () => 'sa-no-grime';
}

const GRIME_PARS = /* glsl */ `
uniform float saGrime;
float saHash( vec3 p ) {
  p = fract( p * 0.3183099 + 0.1 );
  p *= 17.0;
  return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) );
}
float saNoise( vec3 x ) {
  vec3 i = floor( x );
  vec3 f = fract( x );
  f = f * f * ( 3.0 - 2.0 * f );
  return mix(
    mix( mix( saHash( i ), saHash( i + vec3( 1, 0, 0 ) ), f.x ), mix( saHash( i + vec3( 0, 1, 0 ) ), saHash( i + vec3( 1, 1, 0 ) ), f.x ), f.y ),
    mix( mix( saHash( i + vec3( 0, 0, 1 ) ), saHash( i + vec3( 1, 0, 1 ) ), f.x ), mix( saHash( i + vec3( 0, 1, 1 ) ), saHash( i + vec3( 1, 1, 1 ) ), f.x ), f.y ),
    f.z );
}
`;

/** Big soft stains, smaller blotches and fine grit, darkening the surface and browning it. */
const GRIME = /* glsl */ `
if ( saGrime > 0.0 ) {
  vec3 gp = vSkyWorld;
  float stain = saNoise( gp * 0.55 ) * 0.5 + saNoise( gp * 1.9 ) * 0.3 + saNoise( gp * 6.5 ) * 0.2;
  float dirt = smoothstep( 0.4, 0.85, stain );
  float grit = saNoise( gp * 42.0 ) * 0.6 + saNoise( gp * 110.0 ) * 0.4;
  material.diffuseColor *= 1.0 - saGrime * ( 0.42 * dirt + 0.22 * grit );
  material.diffuseColor = mix( material.diffuseColor, material.diffuseColor * vec3( 1.05, 0.86, 0.7 ), saGrime * ( 0.35 + 0.5 * dirt ) );
}
`;

// On top of the sky's patch (sky.ts), for every lit material: the grime, just before the lights.
const skyPatch = THREE.Material.prototype.onBeforeCompile;
THREE.Material.prototype.onBeforeCompile = function (shader, renderer) {
  skyPatch.call(this, shader, renderer);
  // People aren't grimy (see noGrime).
  if (this.userData.noGrime) return;
  if (!shader.fragmentShader.includes('vSkyWorld') || !shader.fragmentShader.includes('#include <lights_fragment_begin>')) return;
  shader.uniforms.saGrime = grime;
  shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\n${GRIME_PARS}`).replace('#include <lights_fragment_begin>', `${GRIME}\n#include <lights_fragment_begin>`);
};

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

  // Dim and warm: less color, toward a reddish brown, darker, with more contrast and the blacks a brown.
  float lum = dot( col, vec3( 0.299, 0.587, 0.114 ) );
  col = mix( vec3( lum ), col, 0.8 );
  col *= vec3( 1.04, 0.87, 0.8 ) * 0.86;
  col = ( col - 0.45 ) * 1.2 + 0.45;
  col = vec3( 0.05, 0.025, 0.02 ) + col * 0.95;

  // Grain, and darker toward the corners.
  col += ( hash( vUv * 731.0 + fract( time * 7.3 ) * 91.0 ) - 0.5 ) * 0.045;
  vec2 c = vUv - 0.5;
  col *= 1.0 - smoothstep( 0.12, 0.7, dot( c, c ) ) * 0.55;

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

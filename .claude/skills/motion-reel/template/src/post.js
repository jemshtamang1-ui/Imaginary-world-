// Post: bloom, then one pass for whip (directional) blur, zoom-blur rush and chromatic aberration,
// then tone mapping + sRGB output. Vignette, grain, flash, shake and CRT live in the DOM (fx.js)
// so they also hit type and glass UI.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const MotionShader = {
  uniforms: { tDiffuse: { value: null }, whip: { value: new THREE.Vector2() }, zoom: { value: 0 }, ca: { value: .0006 }, sat: { value: 1 }, contrast: { value: 1 }, res: { value: new THREE.Vector2(1920, 1080) } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: /* glsl */`
  uniform sampler2D tDiffuse; uniform vec2 whip, res; uniform float zoom, ca, sat, contrast; varying vec2 vUv;
  vec3 grade(vec3 c){ float l = dot(c, vec3(.2126,.7152,.0722)); c = max(mix(vec3(l), c, sat), 0.); return .18 * pow(c / .18, vec3(contrast)); }
  vec3 tap(vec2 uv){ vec2 d = (uv - .5) * ca; return vec3(texture2D(tDiffuse, uv + d).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - d).b); }
  void main(){
    vec2 uv = vUv;
    if(length(whip) + zoom < .0001){ gl_FragColor = vec4(grade(tap(uv)), 1.); return; }
    vec3 c = vec3(0.); float ws = 0.;
    for(int i = 0; i < 24; i++){
      float k = float(i) / 23.;
      vec2 o = whip * (k - .5) / res - (uv - .5) * zoom * k;
      float w = 1. - abs(k - .5) * .8;
      c += tap(clamp(uv + o, .001, .999)) * w; ws += w;
    }
    gl_FragColor = vec4(grade(c / ws), 1.);
  }`,
};

export class Post {
  constructor(renderer, scene, camera, W, H) {
    const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType });
    this.composer = new EffectComposer(renderer, rt);
    this.composer.setPixelRatio(1); this.composer.setSize(W, H);
    this.render = new RenderPass(scene, camera);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), .32, .55, .92);
    this.motion = new ShaderPass(MotionShader);
    this.motion.uniforms.res.value.set(W, H);
    this.composer.addPass(this.render);
    this.composer.addPass(this.bloom);
    this.composer.addPass(this.motion);
    this.composer.addPass(new OutputPass());
  }
  set({ whipX = 0, whipY = 0, zoom = 0, bloom = .32, ca = .0006, sat = 1, contrast = 1 } = {}) {
    this.motion.uniforms.sat.value = sat; this.motion.uniforms.contrast.value = contrast;
    this.motion.uniforms.whip.value.set(whipX, whipY);
    this.motion.uniforms.zoom.value = zoom;
    this.motion.uniforms.ca.value = ca;
    this.bloom.strength = bloom;
  }
  draw() { this.composer.render(); }
}

// Makes the painted ribbon in the approved hero image flow, without replacing the image.
// The hero picture is drawn on a canvas and, only inside the ribbon's area, its pixels
// are carried along the ribbon (up and to the right). Sky, mountains and the kid stay still.
// The five painted bubbles are painted out here; src/bubbles.js floats real ones on top.

export const IMG_W = 1672;
export const IMG_H = 941;

// The bubbles as painted in the approved image (centre and radius, in image pixels).
export const PAINTED_BUBBLES = [
  { x: 56, y: 193, r: 27 },
  { x: 737, y: 192, r: 40 },
  { x: 1487, y: 247, r: 21 },
  { x: 1430, y: 403, r: 92 },
  { x: 525, y: 720, r: 44 },
];

const VERT = `
attribute vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
uniform sampler2D uTex;
uniform vec2 uRes;     // canvas px
uniform vec2 uScale;   // cover-fit: image px per canvas px
uniform vec2 uOffset;  // cover-fit: image px at canvas origin
uniform float uTime;   // seconds, for the gentle wobble
uniform float uFlow;   // how far the metal has travelled (speeds up with scrolling)
uniform vec3 uBubbles[5];

const vec2 IMG = vec2(${IMG_W}.0, ${IMG_H}.0);

float seg(vec2 p, vec2 a, vec2 b, float r, float soft) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return 1.0 - smoothstep(r - soft, r, length(pa - ba * h));
}

// How much of the ribbon a point (in image pixels) belongs to, 0..1.
float ribbonMask(vec2 p) {
  float m = 0.0;
  m = max(m, seg(p, vec2(1285.0, -60.0), vec2(1195.0, 200.0), 285.0, 90.0));
  m = max(m, seg(p, vec2(1195.0, 200.0), vec2(945.0, 400.0), 270.0, 90.0));
  m = max(m, seg(p, vec2(945.0, 400.0), vec2(865.0, 575.0), 240.0, 90.0));
  m = max(m, seg(p, vec2(860.0, 610.0), vec2(1110.0, 680.0), 140.0, 70.0));
  m = max(m, seg(p, vec2(1110.0, 680.0), vec2(1540.0, 735.0), 70.0, 45.0));
  // Keep the kid perfectly still.
  vec2 k = (p - vec2(930.0, 718.0)) / vec2(70.0, 128.0);
  m *= smoothstep(0.75, 1.25, length(k));
  // Never touch the foreground rocks.
  m *= 1.0 - smoothstep(742.0, 790.0, p.y);
  return m;
}

// Which way the metal travels at a point: along the low sweep toward the left, then up the tower.
vec2 flowDir(vec2 p) {
  vec2 up = normalize(vec2(0.42, -1.0));
  vec2 sweep = normalize(vec2(-1.0, -0.22));
  vec2 d = mix(up, sweep, smoothstep(560.0, 680.0, p.y));
  float wob = 0.22 * sin(p.y * 0.011 + p.x * 0.006 + uTime * 0.35);
  return normalize(d + vec2(-d.y, d.x) * wob);
}

// The picture at a point, with the ribbon flowing.
vec3 scene(vec2 p) {
  float m = ribbonMask(p);
  vec2 d = flowDir(p);
  float p1 = fract(uFlow), p2 = fract(uFlow + 0.5);
  // A short carry keeps the two blended copies close together, so the metal stays sharp.
  float reach = 44.0 * m;
  vec2 ripple = m * 2.0 * vec2(sin(p.y * 0.03 + uTime * 0.9), cos(p.x * 0.025 - uTime * 0.7));
  vec3 a = texture2D(uTex, (p - d * reach * (p1 - 0.5) + ripple) / IMG).rgb;
  vec3 b = texture2D(uTex, (p - d * reach * (p2 - 0.5) + ripple) / IMG).rgb;
  vec3 col = mix(a, b, abs(1.0 - 2.0 * p1));
  // A soft band of light travelling up the metal.
  float glint = pow(0.5 + 0.5 * sin(dot(p, d) * 0.012 - uFlow * 10.0), 10.0);
  return col + m * glint * 0.07;
}

void main() {
  vec2 c = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 p = c * uScale + uOffset;               // position in image pixels
  vec3 col = scene(p);

  // Paint out each painted bubble by stretching the sky around it across the gap.
  for (int i = 0; i < 5; i++) {
    vec3 bb = uBubbles[i];
    float R = bb.z * 1.2;
    vec2 q = p - bb.xy;
    float len = length(q);
    if (len < R) {
      // Blend the sky from eight points around the rim, nearest points counting most.
      vec3 sum = vec3(0.0);
      float wsum = 0.0;
      for (int k = 0; k < 8; k++) {
        float ang = float(k) * 0.7853982;
        vec2 rim = bb.xy + vec2(cos(ang), sin(ang)) * (R + 3.0);
        vec2 dv = p - rim;
        float w = 1.0 / (dot(dv, dv) + 4.0);
        w *= w;
        sum += scene(rim) * w;
        wsum += w;
      }
      col = mix(col, sum / wsum, 1.0 - smoothstep(R * 0.8, R, len));
    }
  }
  gl_FragColor = vec4(col, 1.0);
}
`;

export function initHeroFlow(canvas, src, { posX = () => 0.5, boost = () => 0, onReady = () => {} } = {}) {
  // Respect "reduce motion" unless the address ends in ?motion=on (for testing).
  const forced = new URLSearchParams(location.search).get('motion') === 'on';
  if (!forced && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false });
  if (!gl) return null;

  const compile = (type, s) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, s);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
    return sh;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = Object.fromEntries(['uRes', 'uScale', 'uOffset', 'uTime', 'uFlow', 'uBubbles'].map((n) => [n, gl.getUniformLocation(prog, n)]));
  gl.uniform3fv(U.uBubbles, PAINTED_BUBBLES.flatMap((b) => [b.x, b.y, b.r]));

  const api = { ready: false, image: null, tick: () => {}, fit: () => ({ s: 1, ox: 0, oy: 0 }) };
  const img = new Image();
  img.onload = () => {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr));
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    new ResizeObserver(resize).observe(canvas);
    resize();

    // Same fit as CSS "background-size: cover", in CSS pixels: screen = (image - o) * s.
    api.fit = () => {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      const s = Math.max(w / IMG_W, h / IMG_H);
      return { s, ox: (IMG_W - w / s) * posX(), oy: (IMG_H - h / s) * 0.5 };
    };

    let flow = 0;
    let clock = 0;
    const draw = () => {
      const s = Math.max(canvas.width / IMG_W, canvas.height / IMG_H);
      gl.uniform2f(U.uRes, canvas.width, canvas.height);
      gl.uniform2f(U.uScale, 1 / s, 1 / s);
      gl.uniform2f(U.uOffset, (IMG_W - canvas.width / s) * posX(), (IMG_H - canvas.height / s) * 0.5);
      gl.uniform1f(U.uTime, clock);
      gl.uniform1f(U.uFlow, flow);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    // Advance by dt seconds and draw. Scrolling (boost) makes the metal rise faster.
    api.tick = (dt) => {
      clock += dt;
      flow += dt * 0.22 * (1 + boost());
      draw();
    };

    let raf = 0;
    let visible = true;
    let last = performance.now();
    const loop = (now) => {
      api.tick(Math.min((now - last) / 1000, 0.05));
      last = now;
      raf = visible && !document.hidden ? requestAnimationFrame(loop) : 0;
    };
    const start = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); } };
    // Only animate while the hero is on screen.
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start(); }).observe(canvas);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) start(); });

    api.image = img;
    api.ready = true;
    draw();
    canvas.classList.add('is-ready');
    onReady(api);
    start();
  };
  img.src = src;
  return api;
}

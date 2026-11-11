// Makes the painted ribbon in the approved hero image flow, without replacing the image.
// The hero picture is drawn on a canvas and, only inside the ribbon's area, its pixels
// are carried along the ribbon (up and to the right). Sky, mountains and the kid stay still.

const IMG_W = 1672;
const IMG_H = 941;

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
uniform float uTime;

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

void main() {
  vec2 c = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 p = c * uScale + uOffset;               // position in image pixels
  float m = ribbonMask(p);

  vec2 d = flowDir(p);
  float t = uTime * 0.11;
  float p1 = fract(t), p2 = fract(t + 0.5);
  float reach = 120.0 * m;                      // how far a pixel is carried, in image px
  vec2 ripple = m * 3.0 * vec2(sin(p.y * 0.03 + uTime * 0.9), cos(p.x * 0.025 - uTime * 0.7));

  vec3 a = texture2D(uTex, (p - d * reach * (p1 - 0.5) + ripple) / IMG).rgb;
  vec3 b = texture2D(uTex, (p - d * reach * (p2 - 0.5) + ripple) / IMG).rgb;
  vec3 col = mix(a, b, abs(1.0 - 2.0 * p1));

  // A soft band of light travelling up the metal.
  float along = dot(p, d);
  float glint = pow(0.5 + 0.5 * sin(along * 0.012 - uTime * 1.1), 10.0);
  col += m * glint * 0.07;

  gl_FragColor = vec4(col, 1.0);
}
`;

export function initHeroFlow(canvas, src, { posX = () => 0.5 } = {}) {
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
  const U = Object.fromEntries(['uRes', 'uScale', 'uOffset', 'uTime'].map((n) => [n, gl.getUniformLocation(prog, n)]));

  const api = { ready: false, render: () => {} };
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

    let raf = 0;
    let visible = true;
    const draw = (now) => {
      // Same fit as CSS "background-size: cover".
      const s = Math.max(canvas.width / IMG_W, canvas.height / IMG_H);
      const ox = (IMG_W - canvas.width / s) * posX();
      const oy = (IMG_H - canvas.height / s) * 0.5;
      gl.uniform2f(U.uRes, canvas.width, canvas.height);
      gl.uniform2f(U.uScale, 1 / s, 1 / s);
      gl.uniform2f(U.uOffset, ox, oy);
      gl.uniform1f(U.uTime, now / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    const loop = (now) => { draw(now); raf = visible && !document.hidden ? requestAnimationFrame(loop) : 0; };
    const start = () => { if (!raf) raf = requestAnimationFrame(loop); };

    // Only animate while the hero is on screen.
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start(); }).observe(canvas);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) start(); });

    api.render = (seconds) => draw((seconds ?? performance.now() / 1000) * 1000);
    api.ready = true;
    draw(performance.now());
    canvas.classList.add('is-ready');
    start();
  };
  img.src = src;
  return api;
}

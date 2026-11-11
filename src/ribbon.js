// The live ribbon: one liquid-metal band drawn on a fixed, see-through canvas.
// It runs the full height of the page, drifts side to side as you scroll,
// and its surface always flows UP. Plain WebGL, no library.

const VERT = `
attribute vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
uniform vec2 uRes;      // canvas size in px
uniform float uTime;    // seconds
uniform float uScroll;  // page scroll in px
uniform float uPhase;   // how far the surface has flowed (grows with time + scrolling)

const vec3 NAVY   = vec3(0.045, 0.050, 0.170);
const vec3 DEEP   = vec3(0.463, 0.314, 0.737); // #7650BC
const vec3 PURPLE = vec3(0.616, 0.459, 0.886); // #9D75E2
const vec3 LILAC  = vec3(0.784, 0.718, 1.000); // #C8B7FF
const vec3 SKY    = vec3(0.714, 0.851, 0.980); // #B6D9FA
const vec3 ELEC   = vec3(0.431, 0.482, 1.000); // #6E7BFF
const vec3 PINK   = vec3(0.941, 0.725, 0.847); // #F0B9D8
const vec3 HOT    = vec3(0.880, 0.360, 1.000); // magenta seen in the approved art

// Where the ribbon's centre sits (0..1 across the screen) at a given height of the page.
// It enters top-right and sweeps down to the left, like the approved hero, then keeps weaving.
float centre(float wy, float aspect) {
  float sway = mix(0.035, 0.13, smoothstep(0.6, 1.5, aspect));
  // On a phone there is no empty side, so it hugs the right edge, half off-screen.
  return mix(1.03, 0.77, smoothstep(0.6, 1.5, aspect))
    + sway * sin(wy * 1.6 + 2.2)
    + 0.05 * sin(wy * 3.1 + 1.7 + uTime * 0.16)
    + 0.015 * sin(wy * 7.0 - uTime * 0.3);
}

// One sheet of the ribbon. It twists as it rises: where it turns edge-on it
// pinches thin, and it shows a bright face on one side and a dark face on the other.
vec4 sheet(float x, float wy, float c, float hw, float seed, float px) {
  float tw = wy * 1.9 + seed * 1.7 + uPhase * 0.12;
  float face = cos(tw);
  float w = hw * (0.16 + 0.84 * abs(face));
  float u = (x - c) / w;               // -1..1 across the sheet
  float au = abs(u);
  if (au > 1.0) return vec4(0.0);

  float v = wy * 1.15 + uPhase;        // adding phase makes the surface travel upward
  float bulge = sqrt(1.0 - u * u);

  // Liquid flow lines, warped twice so they swirl instead of running straight.
  float q = sin(v * 2.3 + u * 1.7 + seed) + 0.5 * sin(v * 5.1 - u * 3.0 + seed * 1.9);
  float s = u * 2.1
    + 1.05 * sin(v * 1.6 + u * 1.2 + seed + 0.6 * q)
    + 0.40 * sin(v * 4.2 - u * 2.4 + seed * 2.3 - 0.8 * q)
    + 0.14 * sin(v * 9.5 + u * 6.0 + seed * 4.1);
  float a = s + 0.6 * bulge;
  float shade = 0.5 + 0.5 * sin(a * 2.0 + seed);

  // Bright face: purple into hot magenta and pink.
  vec3 lit = mix(DEEP, PURPLE, shade);
  lit = mix(lit, HOT, 0.85 * smoothstep(0.35, 1.0, sin(a * 2.3 + 3.2 + seed)));
  lit = mix(lit, PINK, 0.6 * smoothstep(0.7, 1.0, sin(a * 3.7 + 0.4)));
  // Dark face: deep navy with electric blue running through it.
  vec3 shadow = mix(NAVY * 0.9 + DEEP * 0.12, NAVY + ELEC * 0.45, shade);
  shadow = mix(shadow, ELEC, 0.85 * smoothstep(0.3, 1.0, sin(a * 3.1 + 1.0)));
  shadow = mix(shadow, HOT, 0.45 * smoothstep(0.6, 1.0, sin(a * 2.6 - 2.0 + seed)));

  vec3 col = mix(shadow, lit, smoothstep(-0.3, 0.3, face));
  // Deep pockets where the metal folds away from the light.
  col = mix(col, NAVY * 0.75 + DEEP * 0.1, 0.7 * smoothstep(0.6, 1.0, sin(a * 1.3 - 1.1 + seed)));

  // Chrome highlights: thin, bright, sliding along the flow.
  float hl = pow(0.5 + 0.5 * sin(a * 5.2 + 2.0), 22.0);
  float hl2 = pow(0.5 + 0.5 * sin(a * 8.7 - 0.6 + seed), 34.0);
  col += mix(SKY, vec3(1.0), 0.75) * hl * 1.1;
  col += mix(PINK, vec3(1.0), 0.5) * hl2 * 0.9;
  // A flash of light where the sheet turns edge-on.
  col += vec3(1.0, 0.96, 1.0) * (1.0 - smoothstep(0.0, 0.3, abs(face))) * bulge * 0.55;

  // Glassy rim light on both edges.
  float rim = pow(au, 6.0);
  col = mix(col, mix(LILAC, vec3(1.0), 0.55), rim * 0.9);

  float alpha = 1.0 - smoothstep(1.0 - px / w * 1.5, 1.0, au);
  return vec4(col * alpha, alpha);
}

vec4 over(vec4 top, vec4 under) { return top + under * (1.0 - top.a); }

void main() {
  vec2 f = gl_FragCoord.xy;
  float x = f.x / uRes.x;
  float y = (uRes.y - f.y);                       // px from the top of the screen
  float wy = (y + uScroll) / uRes.y;              // height on the page, in screens
  float aspect = uRes.x / uRes.y;
  float px = 1.0 / uRes.x;

  float c = centre(wy, aspect);
  float hw = (0.105 + 0.035 * sin(wy * 1.3 + 1.0)) * mix(0.8, 1.0, smoothstep(0.55, 1.4, aspect));

  // Four sheets weaving around the centre line, back to front.
  float w1 = sin(wy * 2.1 + uPhase * 0.22);
  float w2 = sin(wy * 1.6 + 2.2 - uPhase * 0.16);
  float w3 = sin(wy * 2.7 + 4.0 + uPhase * 0.1);
  vec4 s0 = sheet(x, wy, c + hw * 0.70 * w2, hw * 0.95, 4.2, px);
  vec4 s1 = sheet(x, wy, c - hw * 0.45 * w1, hw * 1.15, 1.3, px);
  vec4 s2 = sheet(x, wy, c + hw * 0.55 * w3, hw * 0.80, 5.6, px);
  vec4 s3 = sheet(x, wy, c + hw * 0.75 * w1, hw * 0.50, 2.9, px);
  s0.rgb *= 0.85;
  s1.rgb *= 0.9;

  vec4 col = over(s3, over(s2, over(s1, s0)));

  // Soft glow around the whole ribbon.
  float d = max(abs(x - c) - hw * 1.3, 0.0);
  float glow = exp(-d * 24.0) * 0.18 * (1.0 - col.a);
  col += vec4(mix(PURPLE, HOT, 0.35) * glow, glow);
  gl_FragColor = col;
}
`;

export function initRibbon(canvas, { speed = 0.16, scrollBoost = 0.0016 } = {}) {
  const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
  if (!gl) return null;

  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
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

  const U = Object.fromEntries(['uRes', 'uTime', 'uScroll', 'uPhase'].map((n) => [n, gl.getUniformLocation(prog, n)]));
  // Respect "reduce motion" unless the address ends in ?motion=on (for testing).
  const forced = new URLSearchParams(location.search).get('motion') === 'on';
  const reduce = forced ? { matches: false } : window.matchMedia('(prefers-reduced-motion: reduce)');

  let dpr = 1;
  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
  };
  new ResizeObserver(resize).observe(canvas);
  resize();

  let phase = 0;
  let last = performance.now();
  let lastScroll = window.scrollY;
  let raf = 0;
  const state = { speed, scrollBoost };

  const draw = (now) => {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const sy = window.scrollY;
    // Scrolling down pushes the flow faster; it never runs backwards.
    const moved = Math.max(0, sy - lastScroll);
    lastScroll = sy;
    if (!reduce.matches) phase += dt * state.speed + moved * state.scrollBoost;

    gl.uniform2f(U.uRes, canvas.width, canvas.height);
    gl.uniform1f(U.uTime, reduce.matches ? 0 : now / 1000);
    gl.uniform1f(U.uScroll, sy * dpr);
    gl.uniform1f(U.uPhase, phase);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    raf = reduce.matches ? 0 : requestAnimationFrame(draw);
  };

  const start = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(draw); } };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  // With reduced motion the ribbon stays still but still follows the page.
  window.addEventListener('scroll', () => { if (reduce.matches) requestAnimationFrame(draw); }, { passive: true });
  start();

  return { state, stop, start, render: () => draw(performance.now()) };
}

// The filmed ribbon: a looping clip of the painted chrome ribbon, drawn on a fixed,
// see-through canvas behind the page. The clip file holds the ribbon picture in its
// top half and its cut-out mask in the bottom half; a tiny WebGL program puts the
// two together so the ribbon sits cleanly on dark and light sections alike.
// It always flows; scrolling down pushes it faster for a moment.

const VERT = `
attribute vec2 p;
uniform vec4 uRect;            // ribbon frame on screen: centre x, centre y, half width, half height (clip space)
varying vec2 uv;
void main() {
  uv = p * 0.5 + 0.5;
  gl_Position = vec4(uRect.xy + p * uRect.zw, 0.0, 1.0);
}
`;

const FRAG = `
precision mediump float;
uniform sampler2D uTex;
varying vec2 uv;
void main() {
  vec2 t = vec2(uv.x, 1.0 - uv.y);                       // top-left origin, like the video
  vec3 col = texture2D(uTex, vec2(t.x, t.y * 0.5)).rgb;  // top half: the picture
  float a = texture2D(uTex, vec2(t.x, 0.5 + t.y * 0.5)).r; // bottom half: the mask
  // Fade the very top and bottom of the frame so the ribbon never ends on a hard cut.
  a *= smoothstep(0.0, 0.04, t.y) * smoothstep(1.0, 0.96, t.y);
  gl_FragColor = vec4(col * a, a);
}
`;

export function initRibbonVideo(canvas, {
  src = '/art/ribbon-loop-1080.mp4',
  srcSmall = '/art/ribbon-loop-540.mp4',
  x = 0.77,          // where the ribbon's centre sits across the screen (0 left, 1 right)
  xNarrow = 0.92,    // same, on a phone
  size = 1.25,       // ribbon frame height, in screen heights
  sway = 0.05,       // how far it drifts sideways as the page scrolls
  speed = 1,         // playback speed at rest
  scrollBoost = 0.004, // extra speed per pixel scrolled
} = {}) {
  const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
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
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uRect = gl.getUniformLocation(prog, 'uRect');

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  // Respect "reduce motion" unless the address ends in ?motion=on (for testing).
  const forced = new URLSearchParams(location.search).get('motion') === 'on';
  const reduce = forced ? { matches: false } : window.matchMedia('(prefers-reduced-motion: reduce)');
  const narrow = window.matchMedia('(max-width: 1000px)');

  const video = document.createElement('video');
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.crossOrigin = 'anonymous';
  video.src = narrow.matches ? srcSmall : src;

  const state = { x, xNarrow, size, sway, speed, scrollBoost, hidden: false, ready: false };
  const FRAME_ASPECT = 9 / 16;   // one half of the clip: width / height

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
  };
  new ResizeObserver(() => { resize(); paint(); }).observe(canvas);
  resize();

  let fresh = false;             // a new video frame is waiting to be uploaded
  const paint = () => {
    if (!state.ready) return;
    if (fresh) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video);
      fresh = false;
    }
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const fh = h * state.size, fw = fh * FRAME_ASPECT;
    // It weaves gently from side to side as the page moves past.
    const cx = (narrow.matches ? state.xNarrow : state.x) + state.sway * Math.sin(window.scrollY / h * 1.3 + 0.6);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (state.hidden) return;
    gl.uniform4f(uRect, cx * 2 - 1, 0, fw / w, fh / h);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  // Scrolling down feeds extra speed in gradually, then it settles back.
  let push = 0;
  let lastScroll = window.scrollY;
  let last = performance.now();
  let raf = 0;
  const hasFrameCallback = 'requestVideoFrameCallback' in video;
  const onVideoFrame = () => { fresh = true; if (hasFrameCallback) video.requestVideoFrameCallback(onVideoFrame); };

  const loop = (now) => {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const sy = window.scrollY;
    push += Math.max(0, sy - lastScroll) * state.scrollBoost;
    lastScroll = sy;
    push *= Math.exp(-dt * 2.2);
    const rate = Math.min(4, state.speed + push);
    if (Math.abs(video.playbackRate - rate) > 0.02) video.playbackRate = rate;
    if (!hasFrameCallback) fresh = true;
    paint();
    raf = requestAnimationFrame(loop);
  };

  const start = () => {
    if (reduce.matches || raf) return;
    video.play().catch(() => {});
    last = performance.now();
    raf = requestAnimationFrame(loop);
  };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; video.pause(); };

  video.addEventListener('loadeddata', () => {
    state.ready = true;
    fresh = true;
    if (hasFrameCallback) video.requestVideoFrameCallback(onVideoFrame);
    paint();
    canvas.classList.add('is-ready');
    start();
  }, { once: true });

  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  // With reduced motion the ribbon stays still but still follows the page.
  window.addEventListener('scroll', () => { if (reduce.matches) requestAnimationFrame(paint); }, { passive: true });

  return { state, video, start, stop, render: paint };
}

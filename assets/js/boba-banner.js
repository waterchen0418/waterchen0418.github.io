/* =========================================================================
   Boba machine dither banner (contact section).
   Adapted from boba-banner-handoff.md — canvas reads image pixels, so this
   must be served over http(s), not opened via file://.
   Idle: machine pours a cup every 7s, then the cup hops. Hover (mouse):
   keeps pouring + ice-blue glow. Pointer sweep: wiped area turns into a
   dithered, more-saturated grid that fades back after ~0.5s.
   ========================================================================= */
(function () {
  const box = document.getElementById('bobaBanner');
  if (!box) return; // only runs where the contact banner exists

  // ---------- Bayer matrices & helpers ----------
  function bayer(n) {
    let m = [[0]];
    while (m.length < n) {
      const s = m.length, r = Array.from({ length: 2 * s }, () => Array(2 * s).fill(0));
      for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
        const v = 4 * m[y][x]; r[y][x] = v; r[y][x + s] = v + 2; r[y + s][x] = v + 3; r[y + s][x + s] = v + 1;
      }
      m = r;
    }
    return m.flat().map(v => (v + .5) / (n * n));
  }
  const B4 = bayer(4), B8 = bayer(8);
  const smooth = t => t * t * (3 - 2 * t), easeOut = t => 1 - (1 - t) ** 3;
  function spring(s, target, dt, k = 110, d = 16) { const h = Math.min(dt, .032); s.v += (-k * (s.x - target) - d * s.v) * h; s.x += s.v * h; }
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

  // ---------- Config ----------
  const cv = document.getElementById('bobaCanvas'), img = document.getElementById('bobaSrc'), hot = document.getElementById('bobaHotspot');
  const ctx = cv.getContext('2d');
  const SPOUT = { x: .8359, y: .3646 }; // spout lower edge in the bg image (ratio)
  const LAYOUT = {
    cupBottom: .93,
    cupH: .44,
  };
  const LIQUID = .157;
  const CELL = 2.5, LEVELS = 4, VIVID = .5;

  // ---------- Load green-screen cup & key it out ----------
  let sprite = null;
  async function loadSprite(url) {
    const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const c = mk(im.naturalWidth, im.naturalHeight), x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(im, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height), p = d.data;
    let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
    for (let i = 0; i < p.length; i += 4) {
      const g = p[i + 1] - Math.max(p[i], p[i + 2]);
      if (g > 70) p[i + 3] = 0;
      else if (g > 12) { p[i + 3] = 255 * (1 - (g - 12) / 58); p[i + 1] = Math.max(p[i], p[i + 2]); }
      if (p[i + 3] > 40) { const px = (i / 4) % c.width, py = (i / 4 / c.width) | 0; if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py; }
    }
    x.putImageData(d, 0, 0);
    const out = mk(x1 - x0 + 1, y1 - y0 + 1);
    out.getContext('2d').drawImage(c, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
    return out;
  }

  // ---------- Buffers ----------
  let W, H, cellPx, LW, LH, bgCv, colorCv, lowCv, lowCtx, lowData, outCv, outCtx, outImg, mask, cupCv;
  const CUP = {}, SPOUT_PX = {};
  const pose = { lift: 0, rot: 0, sx: 1, sy: 1, glow: 0 };
  const stream = { a: 0, b: 0 };

  function drawScene(c) {
    const sw = CUP.w, sh = CUP.h, bx = CUP.x, by = CUP.bottom, liftPx = pose.lift * sh;
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    c.drawImage(bgCv, 0, 0);

    const u = Math.min(1, pose.lift / .2);
    c.save(); c.translate(bx, by); c.scale(.6 * sw * (1 - .3 * u), .14 * sw * (1 - .35 * u));
    const sg = c.createRadialGradient(0, 0, 0, 0, 0, 1); sg.addColorStop(0, `rgba(30,45,75,${.4 * (1 - .5 * u)})`); sg.addColorStop(1, 'rgba(30,45,75,0)');
    c.fillStyle = sg; c.beginPath(); c.arc(0, 0, 1, 0, 7); c.fill(); c.restore();

    if (pose.glow > .001) {
      const gx = bx, gy = by - sh * .45 - liftPx, gr = 1.5 * sw, g = c.createRadialGradient(gx, gy, 0, gx, gy, gr), a = .55 * pose.glow;
      g.addColorStop(0, `rgba(150,200,255,${a})`); g.addColorStop(.5, `rgba(120,180,255,${.35 * a})`); g.addColorStop(1, 'rgba(120,180,255,0)');
      c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = g; c.fillRect(gx - gr, gy - gr, 2 * gr, 2 * gr); c.restore();
    }

    c.save(); c.translate(bx, by - liftPx); c.rotate(pose.rot); c.scale(pose.sx, pose.sy);
    c.drawImage(cupCv, -sw / 2, -sh, sw, sh); c.restore();

    if (stream.b > stream.a) {
      const x0 = SPOUT_PX.x, y0 = SPOUT_PX.y - 1, surf = by - liftPx - sh * pose.sy * (1 - LIQUID), L = surf - y0;
      if (L > 1) {
        const ya = y0 + stream.a * L, yb = y0 + stream.b * L, ww = Math.max(1.5, sw * .06), t = performance.now();
        const halo = c.createLinearGradient(x0 - ww * 2, 0, x0 + ww * 2, 0);
        halo.addColorStop(0, 'rgba(150,200,255,0)'); halo.addColorStop(.5, 'rgba(150,200,255,.35)'); halo.addColorStop(1, 'rgba(150,200,255,0)');
        c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = halo; c.fillRect(x0 - ww * 2, ya, ww * 4, yb - ya); c.restore();
        const g = c.createLinearGradient(x0 - ww / 2, 0, x0 + ww / 2, 0);
        g.addColorStop(0, '#c9dcf5'); g.addColorStop(.45, '#f4f8ff'); g.addColorStop(1, '#b8cdeb');
        c.fillStyle = g; c.beginPath(); c.roundRect(x0 - ww / 2, ya, ww, yb - ya, ww / 2); c.fill();
        if (stream.b >= 1) {
          const r = ww * (1.3 + .25 * Math.sin(t / 90));
          c.save(); c.globalCompositeOperation = 'lighter'; c.translate(x0, surf); c.scale(r * 1.8, r * .6);
          const sp = c.createRadialGradient(0, 0, 0, 0, 0, 1); sp.addColorStop(0, 'rgba(220,240,255,.9)'); sp.addColorStop(1, 'rgba(220,240,255,0)');
          c.fillStyle = sp; c.beginPath(); c.arc(0, 0, 1, 0, 7); c.fill(); c.restore();
        }
      }
    }
  }

  function compose() {
    drawScene(colorCv.getContext('2d'));
    lowCtx.globalCompositeOperation = 'source-over'; lowCtx.globalAlpha = 1; lowCtx.imageSmoothingQuality = 'high';
    lowCtx.drawImage(colorCv, 0, 0, LW * cellPx, LH * cellPx, 0, 0, LW, LH);
    lowCtx.globalCompositeOperation = 'saturation'; lowCtx.globalAlpha = VIVID; lowCtx.fillStyle = '#2f7dff'; lowCtx.fillRect(0, 0, LW, LH);
    lowCtx.globalCompositeOperation = 'source-over'; lowCtx.globalAlpha = 1;
    lowData = lowCtx.getImageData(0, 0, LW, LH).data;
  }

  function render() {
    const o = outImg.data, s = lowData, q = LEVELS - 1;
    for (let y = 0; y < LH; y++) for (let x = 0; x < LW; x++) {
      const p = y * LW + x, i = p * 4;
      if (mask[p] <= B8[(y & 7) * 8 + (x & 7)]) { o[i + 3] = 0; continue; }
      const n = B4[(y & 3) * 4 + (x & 3)] - .5;
      for (let k = 0; k < 3; k++) { const v = Math.round(s[i + k] / 255 * q + n); o[i + k] = 255 * Math.min(q, Math.max(0, v)) / q; }
      o[i + 3] = 255;
    }
    outCtx.putImageData(outImg, 0, 0);
    ctx.drawImage(colorCv, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(outCv, 0, 0, LW * cellPx, LH * cellPx);
    ctx.imageSmoothingEnabled = true;
  }

  function setup() {
    if (!sprite || !img.naturalWidth) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    W = Math.max(1, Math.round(box.clientWidth * dpr)); H = Math.max(1, Math.round(box.clientHeight * dpr));
    cv.width = W; cv.height = H;
    colorCv = mk(W, H); bgCv = mk(W, H);

    const b = bgCv.getContext('2d'), iw = img.naturalWidth, ih = img.naturalHeight, sc = Math.max(W / iw, H / ih), dw = W / sc, dh = H / sc;
    b.imageSmoothingQuality = 'high'; b.drawImage(img, (iw - dw) / 2, (ih - dh) / 2, dw, dh, 0, 0, W, H);

    CUP.h = H * LAYOUT.cupH; CUP.w = CUP.h * sprite.width / sprite.height; CUP.x = W * SPOUT.x; CUP.bottom = H * LAYOUT.cupBottom;
    SPOUT_PX.x = CUP.x; SPOUT_PX.y = H * SPOUT.y;
    cupCv = mk(Math.ceil(CUP.w), Math.ceil(CUP.h));
    const cc = cupCv.getContext('2d'); cc.imageSmoothingQuality = 'high'; cc.drawImage(sprite, 0, 0, cupCv.width, cupCv.height);

    cellPx = Math.max(1, Math.round(CELL * dpr));
    LW = Math.ceil(W / cellPx); LH = Math.ceil(H / cellPx);
    lowCv = mk(LW, LH); lowCtx = lowCv.getContext('2d', { willReadFrequently: true });
    outCv = mk(LW, LH); outCtx = outCv.getContext('2d'); outImg = outCtx.createImageData(LW, LH);
    mask = new Float32Array(LW * LH);

    Object.assign(hot.style, { left: '56%', top: '6%', width: `${Math.max(87, (CUP.x + CUP.w / 2) / W * 100 + 1) - 56}%`, height: '93%' });
    compose(); render();
  }

  // ---------- Animation ----------
  const JUMP_MS = 980, HOVER_LIFT = .03, POUR_MS = 1400;
  function jumpPose(e) {
    if (e < 100) { const t = easeOut(e / 100); return { lift: 0, rot: 0, sy: 1 - .1 * t, sx: 1 + .06 * t }; }
    if ((e -= 100) < 340) { const t = e / 340, r = .08 * Math.abs(1 - 2 * t); return { lift: .5 * t * (1 - t), rot: 0, sy: 1 + r, sx: 1 - .6 * r }; }
    if ((e -= 340) < 120) { const t = 1 - easeOut(e / 120); return { lift: 0, rot: 0, sy: 1 - .12 * t, sx: 1 + .08 * t }; }
    const t = Math.exp(-(e -= 120) / 170) * Math.max(0, 1 - e / 420);
    return { lift: 0, rot: .08 * Math.sin(2 * Math.PI * e / 140) * t, sx: 1, sy: 1 };
  }
  let hovered = false, pressed = false, pourUntil = 0, jumpStart = -1, spriteRaf = 0, spriteLast = 0, glowAmt = 0, visible = true;
  const liftS = { x: 0, v: 0 }, squashS = { x: 1, v: 0 };
  function spriteFrame(t) {
    const dt = Math.max(0, Math.min(64, t - spriteLast)); spriteLast = t;
    spring(liftS, hovered ? HOVER_LIFT : 0, dt / 1000); spring(squashS, pressed ? .9 : 1, dt / 1000, 420, 30);
    const pouring = hovered || t < pourUntil;
    if (pouring) { if (stream.a > 0) stream.a = stream.b = 0; stream.b = Math.min(1, stream.b + dt / 160); }
    else if (stream.b > 0) { stream.b = Math.min(1, stream.b + dt / 160); stream.a = Math.min(stream.b, stream.a + dt / 140); if (stream.a >= 1) stream.a = stream.b = 0; }
    const glowTarget = hovered ? 1 : pouring ? .5 : 0;
    glowAmt += (glowTarget - glowAmt) * (1 - Math.exp(-dt / (glowTarget > glowAmt ? 180 : 280)));
    if (jumpStart >= 0 && t - jumpStart >= JUMP_MS) jumpStart = -1;
    const j = jumpStart >= 0 ? jumpPose(t - jumpStart) : { lift: 0, rot: 0, sx: 1, sy: 1 };
    pose.lift = Math.max(0, liftS.x + j.lift + .02 * Math.sin(2 * Math.PI * t / 2200) * (hovered ? 1 : 0));
    pose.rot = j.rot; pose.sy = j.sy * squashS.x; pose.sx = j.sx * (1 + (1 - squashS.x) * .6); pose.glow = glowAmt;
    const busy = pouring || stream.b > 0 || jumpStart >= 0 || Math.abs(liftS.x) + Math.abs(liftS.v) > 1e-4 || Math.abs(squashS.x - 1) + Math.abs(squashS.v) > 1e-4 || glowAmt > .002;
    if (!busy) Object.assign(pose, { lift: 0, rot: 0, sx: 1, sy: 1, glow: 0 });
    compose(); render();
    spriteRaf = busy ? requestAnimationFrame(spriteFrame) : 0;
  }
  const kickSprite = () => { if (!spriteRaf && bgCv) { spriteLast = performance.now(); spriteRaf = requestAnimationFrame(spriteFrame); } };
  function pourThenJump() {
    pourUntil = performance.now() + POUR_MS; kickSprite();
    setTimeout(() => { if (!hovered && performance.now() >= pourUntil && stream.b === 0) { jumpStart = performance.now(); kickSprite(); } }, POUR_MS + 350);
  }
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: .4 }).observe(box);
  (function idle() { const ok = visible && !hovered && !document.hidden && !!bgCv; if (ok) pourThenJump(); setTimeout(idle, ok ? 7000 : 1000); })();
  hot.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') { hovered = true; kickSprite(); } });
  hot.addEventListener('pointerleave', () => { hovered = false; pressed = false; kickSprite(); });
  hot.addEventListener('pointerdown', () => { pressed = true; kickSprite(); });
  hot.addEventListener('pointerup', () => { pressed = false; kickSprite(); });

  // ---------- Pointer sweep (organic blob + trailing decay, in grid units) ----------
  const pt = { x: 0, y: 0, tx: 0, ty: 0, inside: false, open: 0 };
  let raf = 0, last = 0, vel = { x: 0, y: 0 };
  function stamp(cx, cy, radius, strength, t, dirx, diry, stretch) {
    const r = 1.3 * radius * (1 + stretch);
    for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(LH - 1, Math.ceil(cy + r)); y++)
      for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(LW - 1, Math.ceil(cx + r)); x++) {
        const dx = x - cx, dy = y - cy, a = Math.atan2(dy, dx);
        const dist = Math.hypot((dx * dirx + dy * diry) / (1 + stretch), (-dx * diry + dy * dirx) / (1 - .3 * stretch))
          / (radius * (1 + .16 * Math.sin(3 * a + .0021 * t) + .09 * Math.sin(5 * a - .0033 * t) + .05 * Math.sin(7 * a + .0047 * t)));
        if (dist >= 1) continue;
        const v = smooth(1 - dist) * strength, p = y * LW + x; if (v > mask[p]) mask[p] = v;
      }
  }
  function frame(t) {
    const dt = Math.max(0, Math.min(64, t - last)); last = t; const k = ms => 1 - Math.exp(-dt / ms), px = pt.x, py = pt.y;
    pt.x += (pt.tx - pt.x) * k(110); pt.y += (pt.ty - pt.y) * k(110);
    pt.open += ((pt.inside ? 1 : 0) - pt.open) * k(160); if (pt.open < .01) pt.open = 0;
    if (dt > 0) { vel.x += ((pt.x - px) / dt - vel.x) * k(80); vel.y += ((pt.y - py) / dt - vel.y) * k(80); }
    const decay = Math.exp(-dt / 500); let alive = false;
    for (let i = 0; i < mask.length; i++) if (mask[i]) { const v = mask[i] * decay; mask[i] = v < .02 ? 0 : v; alive ||= !!mask[i]; }
    if (pt.open > 0) {
      const base = 100 * (W / box.clientWidth) / cellPx, sp = Math.hypot(vel.x, vel.y), dx = sp ? vel.x / sp : 1, dy = sp ? vel.y / sp : 0;
      const f = 80 * sp / base, stretch = Math.min(.6, .5 * f), shrink = Math.max(0, 1 - f / 1.5), radius = base * (.45 + .55 * shrink) * smooth(pt.open);
      const steps = Math.max(1, Math.ceil(Math.hypot(pt.x - px, pt.y - py) / (radius / 4)));
      for (let i = 1; i <= steps; i++) { const u = i / steps; stamp(px + (pt.x - px) * u, py + (pt.y - py) * u, radius, pt.open, t, dx, dy, stretch); }
      alive = true;
    }
    if (!spriteRaf) render();
    raf = alive || pt.inside ? requestAnimationFrame(frame) : 0;
  }
  const kick = () => { if (!raf && bgCv) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  window.addEventListener('pointermove', e => {
    if (!LW) return; const r = box.getBoundingClientRect(), s = (W / r.width) / cellPx;
    pt.tx = (e.clientX - r.left) * s; pt.ty = (e.clientY - r.top) * s;
    const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (inside && !pt.inside && pt.open === 0) { pt.x = pt.tx; pt.y = pt.ty; }
    pt.inside = inside; if (inside || pt.open > 0) kick();
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { pt.inside = false; kick(); });

  // ---------- Boot ----------
  const bgReady = img.complete && img.naturalWidth ? Promise.resolve() : new Promise(res => { img.onload = res; img.onerror = res; });
  Promise.all([bgReady, loadSprite('assets/img/boba/boba-machine-cup.jpg').then(c => { sprite = c; })]).then(setup);
  new ResizeObserver(setup).observe(box);
})();

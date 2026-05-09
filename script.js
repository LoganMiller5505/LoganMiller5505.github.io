(function () {

  // ── Nav: highlight active section link on scroll ──────────────────────
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav__links a[href^="#"]');
  const navObserver = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting)
        navLinks.forEach(a => a.classList.toggle('nav__link--active', a.getAttribute('href') === '#' + e.target.id));
    });
  }, { rootMargin: '-40% 0px -55% 0px' });
  sections.forEach(s => navObserver.observe(s));

  // ── Scroll reveal: fade content up as it enters the viewport ─────────
  const revealTargets = document.querySelectorAll(
    '.section__header, .card, .edu-card, .tl-item, .role, .contact-link'
  );
  revealTargets.forEach(el => el.classList.add('reveal'));

  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      // Stagger siblings that reveal at the same time
      const peers = [...e.target.parentElement.querySelectorAll('.reveal:not(.is-visible)')];
      const idx = peers.indexOf(e.target);
      e.target.style.transitionDelay = (idx * 0.08) + 's';
      e.target.classList.add('is-visible');
      revealObserver.unobserve(e.target);
    });
  }, { threshold: 0.1 });
  revealTargets.forEach(el => revealObserver.observe(el));

  // ── Card: 3D tilt + cursor spotlight ─────────────────────────────────
  document.querySelectorAll('.card').forEach(card => {
    let raf;
    card.addEventListener('mousemove', e => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = card.getBoundingClientRect();
        const x = e.clientX - r.left;
        const y = e.clientY - r.top;
        const tX = ((y / r.height) - 0.5) * -9;
        const tY = ((x / r.width)  - 0.5) *  9;
        card.style.transform = `translateY(-6px) rotateX(${tX.toFixed(1)}deg) rotateY(${tY.toFixed(1)}deg)`;
        card.style.setProperty('--mouse-x', x + 'px');
        card.style.setProperty('--mouse-y', y + 'px');
      });
    });
    card.addEventListener('mouseleave', () => {
      cancelAnimationFrame(raf);
      card.style.transform = '';
    });
  });

  // ── GPA count-up when the education card scrolls into view ───────────
  const gpaEl = document.querySelector('.edu-card__gpa');
  if (gpaEl) {
    const target = 3.82;
    let done = false;
    new IntersectionObserver(([e]) => {
      if (!e.isIntersecting || done) return;
      done = true;
      const start = performance.now();
      const duration = 1100;
      const tick = now => {
        const t = Math.min((now - start) / duration, 1);
        // Ease out cubic
        const ease = 1 - Math.pow(1 - t, 3);
        const textNode = [...gpaEl.childNodes].find(n => n.nodeType === 3);
        if (textNode) textNode.textContent = (target * ease).toFixed(2);
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.6 }).observe(gpaEl);
  }

  // ── Custom cursor with lerp spring physics ────────────────────────────
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const dot = document.createElement('div');
    dot.className = 'cursor-dot';
    document.body.appendChild(dot);

    let mx = 0, my = 0, dx = 0, dy = 0;
    const LERP = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 0.18;
    const TARGETS = 'a, button, .card, .contact-link, .tag, .btn';

    document.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; dot.style.opacity = '1'; });
    document.addEventListener('mouseleave', () => { dot.style.opacity = '0'; });
    document.addEventListener('mouseenter', () => { dot.style.opacity = '1'; });
    document.addEventListener('mouseover',  e => { if (e.target.closest(TARGETS)) dot.classList.add('cursor-dot--hover'); });
    document.addEventListener('mouseout',   e => { if (e.target.closest(TARGETS)) dot.classList.remove('cursor-dot--hover'); });

    (function cursorLoop() {
      dx += (mx - dx) * LERP;
      dy += (my - dy) * LERP;
      const half = dot.classList.contains('cursor-dot--hover') ? 14 : 4;
      dot.style.transform = `translate(${dx - half}px, ${dy - half}px)`;
      requestAnimationFrame(cursorLoop);
    }());
  }

  // ── Typing cycling tagline ────────────────────────────────────────────
  const typedEl = document.getElementById('hero-typed');
  if (typedEl && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    // TODO: Update phrases to reflect current GPA, class year, activities, and projects
    const phrases = [
      "Auburn Honors College · 3.82 GPA · Class of '27.",
      'building intelligent systems, one model at a time.',
      'exploring the intersection of ML and real-world data.',
      'Fantasy Football analytics · RFID research · ACM.',
    ];
    let pi = 0, ci = 0, deleting = false;
    const TYPE_MS = 48, DELETE_MS = 26, PAUSE_MS = 2200, START_PAUSE = 800;
    function tick() {
      const phrase = phrases[pi];
      if (!deleting) {
        typedEl.textContent = phrase.slice(0, ++ci);
        if (ci === phrase.length) { deleting = true; return setTimeout(tick, PAUSE_MS); }
      } else {
        typedEl.textContent = phrase.slice(0, --ci);
        if (ci === 0) {
          deleting = false;
          pi = (pi + 1) % phrases.length;
          return setTimeout(tick, START_PAUSE);
        }
      }
      setTimeout(tick, deleting ? DELETE_MS : TYPE_MS);
    }
    setTimeout(tick, 1200);
  }

}());

/* ── Neural Network Canvas ────────────────────────────────────────────── */
(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const canvas = document.getElementById('hero-net');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const NODE_COUNT  = 50;
  const LINK_DIST   = 110;
  const REPEL_DIST  = 80;
  const REPEL_FORCE = 0.45;
  const PULSE_EVERY = 3500;
  const DRIFT_SPEED = 0.3;

  let W, H, nodes, lastPulse = 0;
  let mouseX = -9999, mouseY = -9999;

  function resize() {
    const r = canvas.parentElement.getBoundingClientRect();
    W = canvas.width  = r.width;
    H = canvas.height = r.height;
  }

  function makeNode() {
    return {
      x:  Math.random() * W,
      y:  Math.random() * H,
      vx: (Math.random() - 0.5) * DRIFT_SPEED,
      vy: (Math.random() - 0.5) * DRIFT_SPEED,
      r:  2.5 + Math.random() * 2,
      bright: 0,
    };
  }

  function triggerPulse(now) {
    lastPulse = now;
    const origin = nodes[Math.floor(Math.random() * nodes.length)];
    origin.bright = 1;
    nodes.forEach(n => {
      if (n === origin) return;
      const dx = n.x - origin.x, dy = n.y - origin.y;
      const d = Math.sqrt(dx*dx + dy*dy);
      if (d < LINK_DIST) setTimeout(() => { n.bright = Math.max(n.bright, 0.55); }, d / LINK_DIST * 300);
    });
  }

  function draw(now) {
    ctx.clearRect(0, 0, W, H);
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const [cr, cg, cb] = dark ? [99, 102, 241] : [79, 70, 229];
    const baseAlpha = dark ? 0.58 : 0.10;
    const maxAlpha  = dark ? 0.95 : 0.32;
    const baseNodeAlpha = dark ? 0.72 : 0.24;
    const lw = dark ? 1.8 : 1.0;

    if (now - lastPulse > PULSE_EVERY) triggerPulse(now);

    nodes.forEach(n => {
      const mdx = n.x - mouseX, mdy = n.y - mouseY;
      const md = Math.sqrt(mdx*mdx + mdy*mdy);
      if (md < REPEL_DIST && md > 0) {
        const f = (1 - md / REPEL_DIST) * REPEL_FORCE;
        n.vx += (mdx / md) * f;
        n.vy += (mdy / md) * f;
      }
      n.vx *= 0.98; n.vy *= 0.98;
      const spd = Math.sqrt(n.vx*n.vx + n.vy*n.vy);
      if (spd < 0.05) { n.vx += (Math.random()-0.5)*0.1; n.vy += (Math.random()-0.5)*0.1; }
      if (spd > DRIFT_SPEED * 3) { n.vx = n.vx/spd*DRIFT_SPEED*3; n.vy = n.vy/spd*DRIFT_SPEED*3; }
      n.x += n.vx; n.y += n.vy;
      if (n.x < 0) { n.x = 0; n.vx = Math.abs(n.vx); }
      if (n.x > W) { n.x = W; n.vx = -Math.abs(n.vx); }
      if (n.y < 0) { n.y = 0; n.vy = Math.abs(n.vy); }
      if (n.y > H) { n.y = H; n.vy = -Math.abs(n.vy); }
      n.bright *= 0.97;
    });

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const dx = a.x-b.x, dy = a.y-b.y;
        const d = Math.sqrt(dx*dx+dy*dy);
        if (d > LINK_DIST) continue;
        const alpha = Math.min((1-d/LINK_DIST)*baseAlpha + (a.bright+b.bright)*0.22, maxAlpha);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = `rgba(${cr},${cg},${cb},${alpha})`;
        ctx.lineWidth = lw;
        ctx.stroke();
      }
    }

    nodes.forEach(n => {
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r + n.bright*2, 0, Math.PI*2);
      ctx.fillStyle = `rgba(${cr},${cg},${cb},${baseNodeAlpha + n.bright*0.55})`;
      ctx.fill();
    });

    requestAnimationFrame(draw);
  }

  canvas.parentElement.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
  });
  canvas.parentElement.addEventListener('mouseleave', () => { mouseX = -9999; mouseY = -9999; });

  new ResizeObserver(resize).observe(canvas.parentElement);
  resize();
  nodes = Array.from({ length: NODE_COUNT }, makeNode);
  requestAnimationFrame(draw);
}());

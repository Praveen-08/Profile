/* PK Visuals — main.js  |  Cinematic Animation System */
console.log('PK Visuals main.js loaded');

// ── Motion preference ──────────────────────────────────────────────────
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ── Preloader ──────────────────────────────────────────────────────────
(function () {
  function initPreloader() {
    const preloader = document.getElementById('sitePreloader');
    if (!preloader) {
      document.body.classList.add('site-loaded');
      return;
    }

    if (prefersReduced || sessionStorage.getItem('pkIntroPlayed')) {
      preloader.style.display = 'none';
      document.body.classList.add('site-loaded');
      return;
    }

    sessionStorage.setItem('pkIntroPlayed', 'true');

    const EXIT_DUR = 800;

    function dismissPreloader() {
      preloader.classList.add('is-hiding');
      document.body.classList.add('site-loaded');
      setTimeout(() => { preloader.style.display = 'none'; }, EXIT_DUR + 50);
    }

    setTimeout(dismissPreloader, 1900);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPreloader);
  } else {
    initPreloader();
  }
})();
const isMobile = window.matchMedia('(max-width: 768px)').matches;

// ── Custom cursor ──────────────────────────────────────────────────────
(function () {
  if (prefersReduced) return;
  if (window.matchMedia('(pointer: coarse)').matches) return;
  const dot  = document.createElement('div');
  const ring = document.createElement('div');
  dot.className  = 'cursor-dot';
  ring.className = 'cursor-ring';
  document.body.appendChild(dot);
  document.body.appendChild(ring);

  let mx = -100, my = -100, rx = -100, ry = -100;

  window.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; }, { passive: true });

  const hoverEls = 'a, button, .reel-card, .work-tile, .work-slide__media, .pkg-item, .filter-btn';
  document.addEventListener('mouseover', e => {
    if (e.target.closest(hoverEls)) ring.classList.add('cursor-ring--hover');
  });
  document.addEventListener('mouseout', e => {
    if (e.target.closest(hoverEls)) ring.classList.remove('cursor-ring--hover');
  });

  const lerp = (a, b, t) => a + (b - a) * t;
  function tick() {
    dot.style.transform  = `translate(${mx}px,${my}px) translate(-50%,-50%)`;
    rx = lerp(rx, mx, 0.1);
    ry = lerp(ry, my, 0.1);
    ring.style.transform = `translate(${rx}px,${ry}px) translate(-50%,-50%)`;
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();

// ── Nav: fade-in on load + scroll solidify ─────────────────────────────
const nav = document.getElementById('nav');
if (nav) {
  nav.classList.add('nav--loading');
  window.addEventListener('load', () => {
    requestAnimationFrame(() => nav.classList.remove('nav--loading'));
  });
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 40);
  }, { passive: true });
}

// ── Mobile drawer ──────────────────────────────────────────────────────
const burger = document.getElementById('burger');
const drawer = document.getElementById('drawer');
if (burger && drawer) {
  burger.addEventListener('click', () => {
    const isOpen = drawer.classList.toggle('open');
    burger.classList.toggle('open', isOpen);
    burger.setAttribute('aria-expanded', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
  });
  drawer.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      burger.classList.remove('open');
      drawer.classList.remove('open');
      burger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    });
  });
}

// ── Hero headline — line-by-line reveal ───────────────────────────────
(function () {
  const headline = document.querySelector('.hero__headline');
  if (!headline || prefersReduced) return;

  // Collect child nodes, splitting on <br> boundaries
  const rawHTML = headline.innerHTML;
  // Split into segments on <br> tags
  const segments = rawHTML.split(/<br\s*\/?>/i);
  headline.innerHTML = segments.map((seg, i) =>
    `<span class="hero__line" style="animation-delay:${0.5 + i * 0.18}s">${seg}</span>`
  ).join('');
})();

// ── Hero video — autoplay with mobile fallback ─────────────────────────
const heroVideo = document.querySelector('.hero__video');
if (heroVideo) {
  heroVideo.muted = true;
  const playPromise = heroVideo.play();
  if (playPromise !== undefined) {
    playPromise.catch(() => {
      document.addEventListener('touchstart', () => heroVideo.play(), { once: true });
      document.addEventListener('click',      () => heroVideo.play(), { once: true });
    });
  }
}

// ── Scroll reveal — IntersectionObserver ──────────────────────────────
const revealObs = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('is-visible');
      e.target.classList.add('visible'); // legacy compat
      revealObs.unobserve(e.target);
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

const revealEls = document.querySelectorAll('.reveal, .reveal-up, .reveal-scale, .stagger-item');
console.log('Reveal elements found:', revealEls.length);
revealEls.forEach(el => revealObs.observe(el));

// ── Programmatic stagger on card groups ───────────────────────────────
['.reels__grid .reel-card', '.pkg-grid .pkg-item', '.agents-grid .agent-card',
 '.process-steps .process-step', '.testimonials-grid .testimonial-card',
 '.work-grid .work-tile', '.service-block'].forEach(sel => {
  document.querySelectorAll(sel).forEach((el, i) => {
    if (!el.classList.contains('stagger-item')) {
      el.classList.add('stagger-item');
      el.style.setProperty('--delay', `${i * 80}ms`);
      revealObs.observe(el);
    }
  });
});

// ── Scroll dots ────────────────────────────────────────────────────────
const scrollDots = document.getElementById('scrollDots');
if (scrollDots) {
  const sections = document.querySelectorAll('[data-dot]');
  const dots = scrollDots.querySelectorAll('.scroll-dot');
  const dotObs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        const idx = e.target.dataset.dot;
        dots.forEach((d, i) => d.classList.toggle('active', String(i) === idx));
      }
    });
  }, { threshold: 0.35 });
  sections.forEach(s => dotObs.observe(s));
}

// ── Stats — count-up for numerics, fade for text ──────────────────────
(function () {
  const silk = t => 1 - Math.pow(1 - t, 4);

  function animateCount(el, from, to, decimals, suffix, prefix, dur) {
    const start = performance.now();
    function step(now) {
      const p = Math.min((now - start) / dur, 1);
      const v = from + (to - from) * silk(p);
      el.textContent = prefix + v.toFixed(decimals) + suffix;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  const statObs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      statObs.unobserve(e.target);

      const valEl = e.target.querySelector('.stat-value');
      if (!valEl || prefersReduced) return;

      const rawText = valEl.textContent.trim();
      const numMatch = rawText.match(/^([\d.]+)/);

      if (numMatch) {
        const target = parseFloat(numMatch[1]);
        const decimals = numMatch[1].includes('.') ? 1 : 0;
        const suffix = rawText.slice(numMatch[1].length);
        const dur = 1600;
        const textNode = document.createTextNode('');
        valEl.textContent = '';
        valEl.appendChild(textNode);

        const start = performance.now();
        function step(now) {
          const p = Math.min((now - start) / dur, 1);
          const v = target * silk(p);
          textNode.textContent = v.toFixed(decimals) + suffix;
          if (p < 1) requestAnimationFrame(step);
          else textNode.textContent = target.toFixed(decimals) + suffix;
        }
        requestAnimationFrame(step);
      }
    });
  }, { threshold: 0.5 });

  document.querySelectorAll('.stat-card').forEach(el => statObs.observe(el));
})();

// ── Parallax — work-slide images (desktop only) ───────────────────────
(function () {
  if (prefersReduced || isMobile) return;

  const mediaEls = document.querySelectorAll('.work-slide__media');
  if (!mediaEls.length) return;

  function onScroll() {
    const vh = window.innerHeight;
    mediaEls.forEach(el => {
      const rect = el.getBoundingClientRect();
      // When element centre is at viewport centre, offset = 0
      const centre = rect.top + rect.height / 2 - vh / 2;
      const offset = centre * 0.08; // gentle depth
      el.querySelector('img') && (el.querySelector('img').style.transform = `scale(1.06) translateY(${offset}px)`);
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();

// ── Package cards — hover premium feel (JS-enhanced) ──────────────────
document.querySelectorAll('.pkg-item').forEach(card => {
  card.addEventListener('mouseenter', () => {
    if (prefersReduced) return;
    card.style.transform = 'translateY(-6px)';
  });
  card.addEventListener('mouseleave', () => {
    card.style.transform = '';
  });
});

// ── Reel cards — gold glow on hover ───────────────────────────────────
document.querySelectorAll('.reel-card').forEach(card => {
  card.addEventListener('mouseenter', () => {
    if (prefersReduced) return;
    card.style.boxShadow = '0 0 0 1px rgba(201,168,76,0.35), 0 16px 48px rgba(201,168,76,0.08)';
  });
  card.addEventListener('mouseleave', () => {
    card.style.boxShadow = '';
  });
});

// ── Legacy data-count (keep for any manual overrides) ─────────────────
const legacyCountEls = document.querySelectorAll('[data-count]');
if (legacyCountEls.length) {
  const silk = t => 1 - Math.pow(1 - t, 4);
  const legObs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        const target = parseInt(e.target.dataset.count, 10);
        const dur = 1800;
        const start = performance.now();
        const step = (now) => {
          const p = Math.min((now - start) / dur, 1);
          e.target.textContent = Math.floor(silk(p) * target) + (p >= 1 ? '+' : '');
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
        legObs.unobserve(e.target);
      }
    });
  }, { threshold: 0.5 });
  legacyCountEls.forEach(el => legObs.observe(el));
}

// ── Work filter (portfolio page) ───────────────────────────────────────
const filterBtns = document.querySelectorAll('.filter-btn');
const workTiles  = document.querySelectorAll('.work-tile');
if (filterBtns.length && workTiles.length) {
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.dataset.filter;
      workTiles.forEach(tile => {
        const cats = tile.dataset.category || '';
        const show = filter === 'all' || cats.includes(filter);
        tile.style.display = show ? '' : 'none';
      });
    });
  });
}

// ── Booking form (Formspree AJAX) ────────────────────────────────────────────
(function () {
  const bookForm  = document.getElementById('bookForm');
  const formError = document.getElementById('formError');
  if (!bookForm) return;

  bookForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const required = bookForm.querySelectorAll('[required]');
    let valid = true;
    required.forEach(field => {
      const empty = !field.value.trim();
      field.style.borderColor = empty ? 'rgba(201,100,100,0.6)' : '';
      if (empty) valid = false;
    });
    if (!valid) return;

    const btn = bookForm.querySelector('[type="submit"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
    if (formError) formError.style.display = 'none';

    try {
      const res = await fetch(bookForm.action, {
        method: 'POST',
        body: new FormData(bookForm),
        headers: { Accept: 'application/json' }
      });
      if (res.ok) {
        window.location.href = 'thank-you.html';
      } else {
        throw new Error('error');
      }
    } catch {
      if (formError) formError.style.display = 'block';
      if (btn) { btn.disabled = false; btn.textContent = 'Send Enquiry'; }
    }
  });
})();

// ── Selected Work sticky scroll ─────────────────────────────────────────
(function () {
  const track = document.querySelector('.selected-work-track');
  if (!track || prefersReduced || isMobile) return;
  const projects = track.querySelectorAll('.selected-project');
  const medias   = track.querySelectorAll('.project-media');
  const navItems = track.querySelectorAll('.project-nav-item');
  const bar      = track.querySelector('.project-progress-bar');
  const COUNT    = projects.length;
  let active     = -1;
  let ticking    = false;

  function setActive(idx) {
    if (idx === active) return;
    active = idx;
    projects.forEach((p, i) => p.classList.toggle('active', i === idx));
    medias.forEach((m, i)   => m.classList.toggle('active', i === idx));
    navItems.forEach((n, i) => n.classList.toggle('active', i === idx));
  }

  function update() {
    const trackTop   = track.getBoundingClientRect().top + window.scrollY;
    const scrolled   = window.scrollY - trackTop;
    const scrollable = track.offsetHeight - window.innerHeight;
    const progress   = Math.max(0, Math.min(1, scrolled / scrollable));
    if (bar) bar.style.width = (progress * 100) + '%';
    setActive(Math.min(COUNT - 1, Math.floor(progress * COUNT)));
    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) { requestAnimationFrame(update); ticking = true; }
  }, { passive: true });

  navItems.forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.goto, 10);
      const scrollable = track.offsetHeight - window.innerHeight;
      window.scrollTo({ top: track.offsetTop + scrollable * (idx / COUNT), behavior: 'smooth' });
    });
  });

  update();
})();

// ── Smooth hash scroll ─────────────────────────────────────────────────
document.querySelectorAll('a[href*="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const url = new URL(a.href, location.href);
    if (url.pathname !== location.pathname) return;
    const target = document.getElementById(url.hash.slice(1));
    if (!target) return;
    e.preventDefault();
    const navH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 68;
    window.scrollTo({ top: target.offsetTop - navH - 20, behavior: 'smooth' });
  });
});

// ── Fade carousel ─────────────────────────────────────────────────────
(function () {
  if (prefersReduced) return;

  document.querySelectorAll('[data-fade-carousel]').forEach(carousel => {
    const imgs = Array.from(carousel.querySelectorAll('img'));
    if (imgs.length < 2) return;

    let current = 0;
    imgs[0].classList.add('active');

    setInterval(() => {
      imgs[current].classList.remove('active');
      current = (current + 1) % imgs.length;
      imgs[current].classList.add('active');
    }, 5000);
  });
})();

// ── FAQ Accordion ─────────────────────────────────────────────
(function () {
  document.querySelectorAll('.faq__item').forEach(item => {
    const btn = item.querySelector('.faq__q');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq__item.open').forEach(o => o.classList.remove('open'));
      if (!isOpen) item.classList.add('open');
    });
  });
})();

// ── Testimonial carousel ──────────────────────────────────────
(function () {
  const slides = document.querySelectorAll('.t-slide');
  const counter = document.getElementById('tCounter');
  const prevBtn = document.getElementById('tPrev');
  const nextBtn = document.getElementById('tNext');
  if (!slides.length) return;

  let current = 0;
  let timer;

  function goTo(n) {
    slides[current].classList.remove('t-slide--active');
    current = (n + slides.length) % slides.length;
    slides[current].classList.add('t-slide--active');
    if (counter) counter.textContent = String(current + 1).padStart(2,'0') + ' / ' + String(slides.length).padStart(2,'0');
  }

  if (prevBtn) prevBtn.addEventListener('click', () => { clearInterval(timer); goTo(current - 1); timer = setInterval(() => goTo(current + 1), 5500); });
  if (nextBtn) nextBtn.addEventListener('click', () => { clearInterval(timer); goTo(current + 1); timer = setInterval(() => goTo(current + 1), 5500); });

  timer = setInterval(() => goTo(current + 1), 5500);
})();

// ── Booking date: enforce future dates only ───────────────────
(function () {
  const dateInput = document.getElementById('preferredDate');
  if (!dateInput) return;
  const today = new Date();
  today.setDate(today.getDate() + 1);
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  dateInput.min = `${yyyy}-${mm}-${dd}`;
})();

// ── Before/After Slider ───────────────────────────────────────
(function () {
  function initSlider(slider) {
    const after = slider.querySelector('.after-wrapper');
    const handle = slider.querySelector('.ba-handle');
    const afterImg = slider.querySelector('.after-image');
    if (!after || !handle) return;

    let isDragging = false;

    function syncWidth() {
      if (afterImg) afterImg.style.width = slider.offsetWidth + 'px';
    }

    function setPosition(clientX) {
      const rect = slider.getBoundingClientRect();
      let percent = ((clientX - rect.left) / rect.width) * 100;
      percent = Math.max(5, Math.min(95, percent));
      after.style.width = percent + '%';
      handle.style.left = percent + '%';
      syncWidth();
    }

    function stopDrag() { isDragging = false; }

    syncWidth();
    window.addEventListener('resize', syncWidth);

    handle.addEventListener('pointerdown', function (e) {
      isDragging = true;
      handle.setPointerCapture(e.pointerId);
      setPosition(e.clientX);
    });
    handle.addEventListener('pointermove', function (e) { if (isDragging) setPosition(e.clientX); });
    handle.addEventListener('pointerup', stopDrag);
    handle.addEventListener('pointercancel', stopDrag);

    slider.addEventListener('pointerdown', function (e) {
      isDragging = true;
      setPosition(e.clientX);
    });
    slider.addEventListener('pointermove', function (e) { if (isDragging) setPosition(e.clientX); });
    slider.addEventListener('pointerup', stopDrag);
    slider.addEventListener('pointerleave', stopDrag);
    slider.addEventListener('pointercancel', stopDrag);
  }

  document.querySelectorAll('[data-before-after]').forEach(initSlider);
})();

// ── Hero video mobile autoplay ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
  var heroVideo = document.querySelector('.hero-video');
  if (!heroVideo) return;

  heroVideo.muted = true;
  heroVideo.defaultMuted = true;
  heroVideo.playsInline = true;
  heroVideo.setAttribute('muted', '');
  heroVideo.setAttribute('playsinline', '');
  heroVideo.setAttribute('webkit-playsinline', '');

  function tryPlay() {
    var p = heroVideo.play();
    if (p && typeof p.catch === 'function') {
      p.catch(function () {
        document.body.classList.add('hero-video-fallback');
      });
    }
  }

  tryPlay();
  window.addEventListener('touchstart', tryPlay, { once: true, passive: true });
  window.addEventListener('click', tryPlay, { once: true });
});

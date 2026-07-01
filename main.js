/* PK Visuals — main.js */

// Custom cursor
(function () {
  if (window.matchMedia('(pointer: coarse)').matches) return; // skip on touch devices
  const dot  = document.createElement('div');
  const ring = document.createElement('div');
  dot.className  = 'cursor-dot';
  ring.className = 'cursor-ring';
  document.body.appendChild(dot);
  document.body.appendChild(ring);

  let mx = -100, my = -100, rx = -100, ry = -100;
  let scale = 1;

  window.addEventListener('mousemove', e => {
    mx = e.clientX;
    my = e.clientY;
  }, { passive: true });

  // Expand ring on hoverable elements
  const hoverEls = 'a, button, .reel-card, .work-tile, .work-slide__media, .pkg-card, .filter-btn';
  document.addEventListener('mouseover', e => {
    if (e.target.closest(hoverEls)) {
      scale = 2.2;
      ring.classList.add('cursor-ring--hover');
    }
  });
  document.addEventListener('mouseout', e => {
    if (e.target.closest(hoverEls)) {
      scale = 1;
      ring.classList.remove('cursor-ring--hover');
    }
  });

  // RAF loop — dot snaps, ring lerps
  const lerp = (a, b, t) => a + (b - a) * t;
  function tick() {
    dot.style.transform  = `translate(${mx}px, ${my}px) translate(-50%, -50%)`;
    rx = lerp(rx, mx, 0.1);
    ry = lerp(ry, my, 0.1);
    ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%) scale(${scale})`;
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();

// NAV scroll
const nav = document.getElementById('nav');
if (nav) {
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 40);
  }, { passive: true });
}

// Mobile drawer
const burger = document.getElementById('burger');
const drawer = document.getElementById('drawer');
if (burger && drawer) {
  burger.addEventListener('click', () => {
    burger.classList.toggle('open');
    drawer.classList.toggle('open');
    document.body.style.overflow = drawer.classList.contains('open') ? 'hidden' : '';
  });
  drawer.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      burger.classList.remove('open');
      drawer.classList.remove('open');
      document.body.style.overflow = '';
    });
  });
}

// Reveal on scroll
const revealEls = document.querySelectorAll('.reveal');
if (revealEls.length) {
  const revealObs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        revealObs.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });
  revealEls.forEach(el => revealObs.observe(el));
}

// Scroll dot progress
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

// Hero video — ensure autoplay on mobile
const heroVideo = document.querySelector('.hero__video');
if (heroVideo) {
  heroVideo.muted = true;
  const playPromise = heroVideo.play();
  if (playPromise !== undefined) {
    playPromise.catch(() => {
      // Autoplay blocked — try on first interaction
      document.addEventListener('touchstart', () => heroVideo.play(), { once: true });
      document.addEventListener('click', () => heroVideo.play(), { once: true });
    });
  }
}

// Stat counters
const statEls = document.querySelectorAll('[data-count]');
if (statEls.length) {
  const ease = t => 1 - Math.pow(1 - t, 4);
  const animateStat = (el) => {
    const target = parseInt(el.dataset.count, 10);
    const suffix = el.dataset.count > 99 ? '+' : '+';
    const dur = 1800;
    const start = performance.now();
    const step = (now) => {
      const p = Math.min((now - start) / dur, 1);
      el.textContent = Math.floor(ease(p) * target) + (p === 1 ? suffix : '');
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const statObs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        animateStat(e.target);
        statObs.unobserve(e.target);
      }
    });
  }, { threshold: 0.5 });
  statEls.forEach(el => statObs.observe(el));
}

// Work filter
const filterBtns = document.querySelectorAll('.filter-btn');
const workTiles = document.querySelectorAll('.work-tile');
if (filterBtns.length && workTiles.length) {
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.dataset.filter;
      workTiles.forEach(tile => {
        const cats = tile.dataset.category || '';
        const show = filter === 'all' || cats.includes(filter);
        tile.dataset.hidden = show ? 'false' : 'true';
        tile.style.display = show ? '' : 'none';
      });
    });
  });
}


// Booking form
const bookForm = document.getElementById('bookForm');
const formSuccess = document.getElementById('formSuccess');
if (bookForm && formSuccess) {
  bookForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const firstName = bookForm.querySelector('#firstName');
    const email = bookForm.querySelector('#email');
    const address = bookForm.querySelector('#address');
    let valid = true;
    [firstName, email, address].forEach(field => {
      if (field && !field.value.trim()) {
        field.style.borderColor = 'rgba(201,100,100,0.6)';
        valid = false;
      } else if (field) {
        field.style.borderColor = '';
      }
    });
    if (!valid) return;
    bookForm.style.opacity = '0';
    bookForm.style.transition = 'opacity 0.4s';
    setTimeout(() => {
      bookForm.style.display = 'none';
      formSuccess.style.display = 'block';
      formSuccess.style.opacity = '0';
      requestAnimationFrame(() => {
        formSuccess.style.transition = 'opacity 0.5s';
        formSuccess.style.opacity = '1';
      });
    }, 400);
  });
}

// Smooth hash scroll
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

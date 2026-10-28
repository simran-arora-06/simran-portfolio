(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var header = document.querySelector('.site-header');
  var bar = document.querySelector('.progress');
  var canvas = document.getElementById('scene');
  var parallaxImgs = document.querySelectorAll('[data-parallax]');
  var ticking = false;

  document.getElementById('year').textContent = new Date().getFullYear();

  /* Mobile menu */
  var menuBtn = document.querySelector('.menu-btn');
  var menu = document.getElementById('menu');
  menuBtn.addEventListener('click', function () {
    var open = menu.classList.toggle('open');
    menuBtn.setAttribute('aria-expanded', String(open));
  });
  menu.addEventListener('click', function (e) {
    if (e.target.closest('a')) {
      menu.classList.remove('open');
      menuBtn.setAttribute('aria-expanded', 'false');
    }
  });

  /* Scroll reveal: adds .in when an element enters the viewport */
  var revealEls = document.querySelectorAll('.reveal, .wipe');
  if ('IntersectionObserver' in window && !reduce) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
    revealEls.forEach(function (el) { revealObserver.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('in'); });
  }

  /* Highlight the nav link of the section on screen */
  var links = document.querySelectorAll('.link');
  if ('IntersectionObserver' in window) {
    var sectionObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          links.forEach(function (link) {
            link.classList.toggle('active', link.getAttribute('href') === '#' + entry.target.id);
          });
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    document.querySelectorAll('main section[id]').forEach(function (s) { sectionObserver.observe(s); });
  }

  /* Scroll progress bar, header style and image parallax */
  function update() {
    ticking = false;
    var y = window.scrollY;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.transform = 'scaleX(' + (max > 0 ? y / max : 0) + ')';
    header.classList.toggle('scrolled', y > 24);
    if (!reduce) {
      parallaxImgs.forEach(function (img) {
        var r = img.parentElement.getBoundingClientRect();
        var p = (r.top + r.height / 2 - window.innerHeight / 2) / window.innerHeight;
        img.style.transform = 'translateY(' + (p * -28).toFixed(1) + 'px) scale(1.12)';
      });
    }
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  update();

  /* Three.js particle galaxy: three arms, one for each brand colour */
  function initScene() {
    if (!window.THREE || !canvas) return;

    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    } catch (err) {
      return; // WebGL unavailable: the page still works without the background
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.set(0, 0, 15);

    var count = window.innerWidth < 700 ? 1600 : 3600;
    var positions = new Float32Array(count * 3);
    var colors = new Float32Array(count * 3);
    var palette = [0x7C5CFF, 0x22D3EE, 0xF472B6].map(function (hex) { return new THREE.Color(hex); });
    var white = new THREE.Color(0xffffff);
    var tmp = new THREE.Color();

    for (var i = 0; i < count; i++) {
      var arm = i % 3;
      var radius = Math.pow(Math.random(), 0.75) * 12 + 0.4;
      var angle = radius * 0.5 + arm * (Math.PI * 2 / 3);
      var spread = 0.15 + radius * 0.07;
      positions[i * 3]     = Math.cos(angle) * radius + (Math.random() - 0.5) * spread * 4;
      positions[i * 3 + 1] = (Math.random() - 0.5) * Math.max(0.3, 2.2 - radius * 0.12);
      positions[i * 3 + 2] = Math.sin(angle) * radius + (Math.random() - 0.5) * spread * 4;
      tmp.copy(palette[arm]).lerp(white, Math.random() * 0.35);
      colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
    }

    var geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Soft round sprite so particles are glowing dots, not squares
    var sprite = document.createElement('canvas');
    sprite.width = sprite.height = 64;
    var ctx = sprite.getContext('2d');
    var grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.4, 'rgba(255,255,255,0.6)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);

    var material = new THREE.PointsMaterial({
      size: 0.16,
      map: new THREE.CanvasTexture(sprite),
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    var galaxy = new THREE.Points(geometry, material);
    galaxy.rotation.x = 0.95;
    scene.add(galaxy);

    var mouseX = 0, mouseY = 0;
    window.addEventListener('pointermove', function (e) {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    }, { passive: true });

    function resize() {
      var w = window.innerWidth, h = window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', resize);
    resize();

    var clock = new THREE.Clock();
    var running = true;

    function frame() {
      if (!running) return;
      var t = clock.getElapsedTime();
      var y = window.scrollY;
      var fade = Math.max(0.22, 1 - y / (window.innerHeight * 0.9));

      galaxy.rotation.y = t * 0.06 + y * 0.0006;
      galaxy.rotation.x += (0.95 + mouseY * 0.12 - galaxy.rotation.x) * 0.04;
      camera.position.x += (mouseX * 1.2 - camera.position.x) * 0.04;
      camera.position.z += (15 + Math.min(y * 0.004, 5) - camera.position.z) * 0.06;
      camera.lookAt(0, 0, 0);
      canvas.style.opacity = fade.toFixed(2);

      renderer.render(scene, camera);
      requestAnimationFrame(frame);
    }

    if (reduce) {
      renderer.render(scene, camera); // one still frame, no motion
    } else {
      frame();
      document.addEventListener('visibilitychange', function () {
        running = !document.hidden;
        if (running) frame();
      });
    }
  }

  initScene();
})();

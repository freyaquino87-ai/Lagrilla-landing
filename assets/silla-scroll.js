/* La Silla — cierre épico: zoom cinematográfico scroll-driven hacia la
   Silla Presidencial, full-bleed (cover). El texto y el CTA aparecen
   sobre el close-up final. Frames cargados solo cerca del viewport. */
(function () {
  var section = document.getElementById('silla-video');
  if (!section) return;

  var canvas = document.getElementById('sillaCanvas');
  var loader = document.getElementById('sillaLoader');
  var loaderFill = document.getElementById('sillaLoaderFill');
  var caption = document.getElementById('sillaCaption');
  var staticFallback = document.getElementById('sillaStaticFallback');

  var isMobile = window.innerWidth <= 768;
  var FRAME_COUNT = isMobile ? 32 : 49;
  var FRAME_PATH = isMobile
    ? '/assets/silla-frames-mobile/frame_'
    : '/assets/silla-frames/frame_';
  var FRAME_EXT = '.webp';

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reduceMotion) {
    // Sin scrubbing: close-up fijo con el texto siempre visible.
    canvas.style.display = 'none';
    loader.style.display = 'none';
    if (staticFallback) staticFallback.style.display = 'block';
    if (caption) { caption.style.opacity = '1'; caption.style.transform = 'translate(-50%, 0)'; }
    return;
  }

  var ctx = canvas.getContext('2d');
  var frames = [];
  var loadedCount = 0;
  var started = false;
  var ready = false;
  var currentFrame = -1;
  var ticking = false;

  function pad(n) {
    return String(n).padStart(4, '0');
  }

  function startLoading() {
    if (started) return;
    started = true;
    for (var i = 1; i <= FRAME_COUNT; i++) {
      (function (index) {
        var img = new Image();
        img.decoding = 'async';
        img.onload = onFrameLoaded;
        img.onerror = onFrameLoaded;
        img.src = FRAME_PATH + pad(index) + FRAME_EXT;
        frames[index - 1] = img;
      })(i);
    }
  }

  function onFrameLoaded() {
    loadedCount++;
    var pct = Math.round((loadedCount / FRAME_COUNT) * 100);
    if (loaderFill) loaderFill.style.width = pct + '%';
    if (loadedCount >= FRAME_COUNT) {
      ready = true;
      loader.style.opacity = '0';
      setTimeout(function () { loader.style.display = 'none'; }, 400);
      drawFrame(0);
      onScroll();
    }
  }

  function resizeCanvas() {
    var dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    if (currentFrame >= 0) drawFrame(currentFrame);
  }

  function drawFrame(index) {
    var img = frames[index];
    if (!img || !img.complete || !img.naturalWidth) return;
    var cw = canvas.width;
    var ch = canvas.height;

    // Cover-fit: llena la pantalla de borde a borde, recortando lo necesario.
    var imgRatio = img.naturalWidth / img.naturalHeight;
    var canvasRatio = cw / ch;
    var drawW, drawH;
    if (canvasRatio > imgRatio) {
      drawW = cw; drawH = cw / imgRatio;
    } else {
      drawH = ch; drawW = ch * imgRatio;
    }
    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(img, (cw - drawW) / 2, (ch - drawH) / 2, drawW, drawH);
  }

  function smoothstep(edge0, edge1, x) {
    var t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }

  function updateCaption(progress) {
    if (!caption) return;
    // El texto emerge sobre el close-up, en el último tramo del zoom.
    var opacity = smoothstep(0.8, 0.95, progress);
    caption.style.opacity = opacity;
    caption.style.transform = 'translate(-50%, ' + (14 - opacity * 14) + 'px)';
    // Deja clickear el CTA solo cuando ya es visible.
    caption.style.pointerEvents = opacity > 0.6 ? 'auto' : 'none';
  }

  function onScroll() {
    if (!ready || ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var rect = section.getBoundingClientRect();
      var scrollableHeight = section.offsetHeight - window.innerHeight;
      var progress = scrollableHeight > 0
        ? Math.min(1, Math.max(0, -rect.top / scrollableHeight))
        : 0;
      var frameIndex = Math.min(FRAME_COUNT - 1, Math.floor(progress * FRAME_COUNT));

      if (frameIndex !== currentFrame) {
        currentFrame = frameIndex;
        drawFrame(frameIndex);
      }
      updateCaption(progress);
      ticking = false;
    });
  }

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('scroll', onScroll, { passive: true });

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        startLoading();
        io.disconnect();
      }
    });
  }, { rootMargin: '600px 0px' });
  io.observe(section);
})();

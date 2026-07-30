/* Chapulín en vivo — scroll-driven frame sequence en el costado
   izquierdo de la pantalla. Frames WebP con canal alfa (sin fondo
   sólido), cargados solo cuando la sección se acerca al viewport. */
(function () {
  var section = document.getElementById('chapulin-video');
  if (!section) return;

  var media = document.querySelector('.chapulin-media');
  var canvas = document.getElementById('chapulinCanvas');
  var loader = document.getElementById('chapulinLoader');
  var loaderFill = document.getElementById('chapulinLoaderFill');
  var staticFallback = document.getElementById('chapulinStaticFallback');
  var punchline = document.getElementById('chapulinPunchline');

  var isMobile = window.innerWidth <= 768;
  var FRAME_COUNT = isMobile ? 40 : 60;
  var FRAME_PATH = isMobile
    ? '/assets/chapulin-frames-mobile/frame_'
    : '/assets/chapulin-frames/frame_';
  var FRAME_EXT = '.webp';

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reduceMotion) {
    // Sin scrubbing: solo el póster fijo (ya trae transparencia real).
    canvas.style.display = 'none';
    loader.style.display = 'none';
    if (staticFallback) staticFallback.style.display = 'block';
    if (punchline) punchline.style.opacity = '1';
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
    var w = media.clientWidth;
    var h = media.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    if (currentFrame >= 0) drawFrame(currentFrame);
  }

  function drawFrame(index) {
    var img = frames[index];
    if (!img || !img.complete || !img.naturalWidth) return;
    var cw = canvas.width;
    var ch = canvas.height;
    ctx.clearRect(0, 0, cw, ch);

    var imgRatio = img.naturalWidth / img.naturalHeight;
    var canvasRatio = cw / ch;
    var drawW, drawH, drawX, drawY;
    var scale = 0.92;
    if (canvasRatio > imgRatio) {
      drawH = ch * scale; drawW = drawH * imgRatio;
    } else {
      drawW = cw * scale; drawH = drawW / imgRatio;
    }
    drawX = (cw - drawW) / 2;
    drawY = (ch - drawH) / 2;
    ctx.drawImage(img, drawX, drawY, drawW, drawH);
  }

  function smoothstep(edge0, edge1, x) {
    var t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
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
      // "bueno, casi nadie." aparece justo cuando el Chapulín termina de revelarse.
      if (punchline) punchline.style.opacity = smoothstep(0.85, 1, progress);
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

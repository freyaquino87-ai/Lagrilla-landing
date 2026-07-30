/* Fusión en vivo — scroll-driven frame sequence (tres Lonches de Acarreado
   fusionándose en el personaje). Cover/contain fit, frames cargados solo
   cuando la sección se acerca al viewport. */
(function () {
  var section = document.getElementById('fusion-video');
  if (!section) return;

  var sticky = document.querySelector('.fusion-sticky');
  var canvas = document.getElementById('fusionCanvas');
  var loader = document.getElementById('fusionLoader');
  var loaderFill = document.getElementById('fusionLoaderFill');
  var caption = document.getElementById('fusionCaption');
  var videoFallback = document.getElementById('fusionVideoFallback');

  // En mobile se sirve un set de frames más chico y liviano (menor
  // resolución y fps) para no tardar tanto en cargar en redes lentas.
  var isMobile = window.innerWidth <= 768;
  var FRAME_COUNT = isMobile ? 70 : 105;
  var FRAME_PATH = isMobile
    ? '/assets/scroll-frames-mobile/frame_'
    : '/assets/scroll-frames/frame_';
  var FRAME_EXT = '.webp';

  // El video trae un flash de brillo justo en la explosión (~56% del
  // progreso): antes es más oscuro, después más claro. Igualamos el fondo
  // de la sección a cada tramo para que no se note la costura.
  var BG_BEFORE_RGB = [240, 233, 206];
  var BG_AFTER_RGB = [249, 238, 210];
  var BG_SWITCH_FRAME = Math.round((59 / 105) * FRAME_COUNT);

  function bgForFrame(index) {
    return index < BG_SWITCH_FRAME ? BG_BEFORE_RGB : BG_AFTER_RGB;
  }

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reduceMotion) {
    // Sin scrubbing: solo el video en loop, sin depender del scroll.
    canvas.style.display = 'none';
    loader.style.display = 'none';
    videoFallback.style.display = 'block';
    videoFallback.preload = 'auto';
    videoFallback.play().catch(function () {});
    if (caption) { caption.style.opacity = '1'; caption.style.transform = 'none'; }
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
    ctx.clearRect(0, 0, cw, ch);

    var imgRatio = img.naturalWidth / img.naturalHeight;
    var canvasRatio = cw / ch;
    var drawW, drawH, drawX, drawY;

    // Contain-fit: el video completo siempre visible, con margen alrededor
    // (nunca se recorta arriba/abajo ni a los lados).
    var scale = window.innerWidth > 768 ? 0.78 : 0.9;
    if (canvasRatio > imgRatio) {
      drawH = ch * scale; drawW = drawH * imgRatio;
    } else {
      drawW = cw * scale; drawH = drawW / imgRatio;
    }
    drawX = (cw - drawW) / 2;
    drawY = (ch - drawH) / 2;
    ctx.drawImage(img, drawX, drawY, drawW, drawH);
    drawVignette(drawX, drawY, drawW, drawH, bgForFrame(index));
  }

  function drawVignette(drawX, drawY, drawW, drawH, rgb) {
    // Difumina el borde del frame hacia el color de fondo actual, para que
    // cualquier variación de compresión/viñeta del video no se note como
    // una costura dura. Se estira un círculo unitario a la forma del
    // rectángulo dibujado (elipse), así el degradado llega parejo a los
    // cuatro bordes sin importar su proporción.
    var cx = drawX + drawW / 2;
    var cy = drawY + drawH / 2;
    var c = 'rgb(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ')';
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(drawW / 2, drawH / 2);
    var grad = ctx.createRadialGradient(0, 0, 0.8, 0, 0, 1.06);
    grad.addColorStop(0, c.replace('rgb', 'rgba').replace(')', ',0)'));
    grad.addColorStop(1, c.replace('rgb', 'rgba').replace(')', ',1)'));
    ctx.fillStyle = grad;
    ctx.fillRect(-1.1, -1.1, 2.2, 2.2);
    ctx.restore();
  }

  function smoothstep(edge0, edge1, x) {
    var t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }

  function updateCaption(progress) {
    if (!caption) return;
    // La tarjeta aparece justo cuando el personaje termina de revelarse.
    var opacity = smoothstep(0.62, 0.8, progress);
    caption.style.opacity = opacity;
    caption.style.transform = 'translate(-50%, ' + (10 - opacity * 10) + 'px)';
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
        if (sticky) {
          var bg = bgForFrame(frameIndex);
          sticky.style.backgroundColor = 'rgb(' + bg[0] + ',' + bg[1] + ',' + bg[2] + ')';
        }
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

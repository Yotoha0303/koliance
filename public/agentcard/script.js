(() => {
  "use strict";

  const CARD_WIDTH = 400;
  const CARD_HEIGHT = 250;
  const CARD_RADIUS = 15;
  const SCANNER_RATIO = 0.34;
  const MAX_DPR = 2;
  const FULL_SPEED = 34;
  const REDUCED_SPEED = 12;

  // Replace these relative paths to use another card set. Set crop to null for a full-frame image.
  const CARD_DATA = [
    {
      id: "CARD_01",
      name: "GLM",
      src: "./assets/cards/card-01-glm.png",
      crop: { x: 34, y: 34, width: 1496, height: 911 },
      seed: 1103,
    },
    {
      id: "CARD_02",
      name: "KIMI",
      src: "./assets/cards/card-02-kimi.png",
      crop: { x: 12, y: 14, width: 1563, height: 964 },
      seed: 2207,
    },
    {
      id: "CARD_03",
      name: "CLAUDE",
      src: "./assets/cards/card-03-claude.png",
      crop: { x: 32, y: 40, width: 1498, height: 910 },
      seed: 3301,
    },
    {
      id: "CARD_04",
      name: "GOOGLE",
      src: "./assets/cards/card-04-google.png",
      crop: { x: 33, y: 40, width: 1496, height: 908 },
      seed: 4409,
    },
    {
      id: "CARD_05",
      name: "OPENAI",
      src: "./assets/cards/card-05-openai.png",
      crop: { x: 238, y: 161, width: 1570, height: 954 },
      seed: 5501,
    },
    {
      id: "CARD_06",
      name: "DEEPSEEK",
      src: "./assets/cards/card-06-deepseek.png",
      crop: { x: 26, y: 30, width: 1519, height: 945 },
      seed: 6607,
    },
  ];

  const CODE_LINES = [
    "const AI_CARD = {",
    "  id: \"AGI_2026\",",
    "  neural: \"active\",",
    "  encryption: true,",
    "  scan: \"completed\"",
    "};",
    "function analyze(signal) {",
    "  return tensor.decode(signal);",
    "}",
    "class NeuralCard {}",
    "AI_PROCESS_RUNNING",
    "01010110 11001001 00101101",
    "tokenize(stream, { secure: true });",
    "hash.sync(0x8f2a91c4);",
    "vector[32] => latent.identity",
    "permission: OWNER_VERIFIED",
  ];

  const app = document.querySelector("#scannerApp");
  const stage = document.querySelector("#scanStage");
  const track = document.querySelector("#cardTrack");
  const template = document.querySelector("#cardTemplate");
  const ambientCanvas = document.querySelector("#ambientCanvas");
  const scannerCanvas = document.querySelector("#scannerCanvas");
  const pauseButton = document.querySelector("#pauseButton");
  const resetButton = document.querySelector("#resetButton");
  const loadingState = document.querySelector("#loadingState");
  const loadCount = document.querySelector("#loadCount");
  const activeAsset = document.querySelector("#activeAsset");
  const scanPercent = document.querySelector("#scanPercent");
  const progressMeter = document.querySelector("#progressMeter");
  const streamRate = document.querySelector("#streamRate");
  const checksum = document.querySelector("#checksum");
  const announcer = document.querySelector("#announcer");

  if (!app || !stage || !track || !template || !ambientCanvas || !scannerCanvas) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const state = {
    cards: [],
    particles: [],
    scannerParticles: [],
    offset: 0,
    paused: false,
    previousTime: 0,
    codeTick: -1,
    activeIndex: -1,
    gap: 58,
    ambientWidth: 0,
    ambientHeight: 0,
    stageWidth: 0,
    stageHeight: 0,
    dpr: 1,
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function createRandom(seed) {
    let value = seed >>> 0;
    return () => {
      value += 0x6d2b79f5;
      let result = value;
      result = Math.imul(result ^ (result >>> 15), result | 1);
      result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
      return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
    };
  }

  function roundedRect(context, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + width, y, x + width, y + height, r);
    context.arcTo(x + width, y + height, x, y + height, r);
    context.arcTo(x, y + height, x, y, r);
    context.arcTo(x, y, x + width, y, r);
    context.closePath();
  }

  function configureCardCanvas(canvas) {
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    canvas.width = Math.round(CARD_WIDTH * dpr);
    canvas.height = Math.round(CARD_HEIGHT * dpr);
    canvas.style.width = `${CARD_WIDTH}px`;
    canvas.style.height = `${CARD_HEIGHT}px`;
    const context = canvas.getContext("2d");
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    return { context, dpr };
  }

  function createBuffer() {
    const canvas = document.createElement("canvas");
    const { context, dpr } = configureCardCanvas(canvas);
    return { canvas, context, dpr };
  }

  function clipCard(context) {
    roundedRect(context, 0, 0, CARD_WIDTH, CARD_HEIGHT, CARD_RADIUS);
    context.clip();
  }

  function drawOriginalBuffer(card) {
    const { context, image, data } = card;
    const bufferContext = card.originalBuffer.context;
    const crop = data.crop ?? {
      x: 0,
      y: 0,
      width: image.naturalWidth,
      height: image.naturalHeight,
    };
    const scale = Math.min(CARD_WIDTH / crop.width, CARD_HEIGHT / crop.height);
    const drawWidth = crop.width * scale;
    const drawHeight = crop.height * scale;
    const drawX = (CARD_WIDTH - drawWidth) / 2;
    const drawY = (CARD_HEIGHT - drawHeight) / 2;

    bufferContext.clearRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
    bufferContext.save();
    clipCard(bufferContext);
    bufferContext.fillStyle = "#07101b";
    bufferContext.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
    bufferContext.drawImage(
      image,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      drawX,
      drawY,
      drawWidth,
      drawHeight,
    );
    bufferContext.restore();

    context.original.clearRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  }

  // Build a dense, deterministic code texture so every card has a stable visual identity.
  function drawCodeBuffer(card, tick) {
    const context = card.codeBuffer.context;
    const random = createRandom(card.data.seed + tick * 7919);

    context.clearRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
    context.save();
    clipCard(context);

    const background = context.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
    background.addColorStop(0, "#03120f");
    background.addColorStop(0.48, "#061419");
    background.addColorStop(1, "#080b1c");
    context.fillStyle = background;
    context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

    context.strokeStyle = "rgba(74, 255, 192, 0.075)";
    context.lineWidth = 1;
    for (let x = 8; x < CARD_WIDTH; x += 16) {
      context.beginPath();
      context.moveTo(x + 0.5, 0);
      context.lineTo(x + 0.5, CARD_HEIGHT);
      context.stroke();
    }
    for (let y = 10; y < CARD_HEIGHT; y += 16) {
      context.beginPath();
      context.moveTo(0, y + 0.5);
      context.lineTo(CARD_WIDTH, y + 0.5);
      context.stroke();
    }

    context.font = "8px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
    context.textBaseline = "top";
    const matrixChars = "01{}[]<>/\\|#@$%&*+=:;AI";
    for (let column = 0; column < 52; column += 1) {
      const x = 4 + column * 8;
      const startY = -16 + Math.floor(random() * 22);
      const brightness = 0.08 + random() * 0.19;
      context.fillStyle = `rgba(91, 255, 192, ${brightness})`;
      for (let row = 0; row < 33; row += 1) {
        if (random() > 0.3) {
          const character = matrixChars[Math.floor(random() * matrixChars.length)];
          context.fillText(character, x, startY + row * 9);
        }
      }
    }

    context.fillStyle = "rgba(2, 12, 15, 0.82)";
    context.fillRect(12, 12, 240, 224);
    context.strokeStyle = "rgba(86, 230, 255, 0.24)";
    context.strokeRect(12.5, 12.5, 239, 223);

    context.font = "9px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
    CODE_LINES.forEach((line, index) => {
      const emphasis = index === 0 || index === 10 || index === 11;
      context.fillStyle = emphasis ? "#68ffbc" : index % 3 === 0 ? "#78dff5" : "rgba(196, 255, 224, 0.78)";
      context.fillText(line, 21, 21 + index * 12.6);
    });

    context.strokeStyle = "rgba(86, 230, 255, 0.34)";
    context.lineWidth = 1;
    for (let lane = 0; lane < 7; lane += 1) {
      const y = 32 + lane * 31 + random() * 9;
      context.beginPath();
      context.moveTo(266, y);
      context.lineTo(292 + random() * 36, y);
      context.lineTo(305 + random() * 28, y + (random() - 0.5) * 15);
      context.lineTo(388, y + (random() - 0.5) * 15);
      context.stroke();
      context.fillStyle = lane % 2 ? "#73ffbd" : "#56e6ff";
      context.fillRect(302 + random() * 70, y - 1.5, 3, 3);
    }

    context.font = "600 8px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
    context.fillStyle = "rgba(166, 108, 255, 0.82)";
    context.fillText(`// ${card.data.id} / TOKENIZED`, 268, 17);
    context.fillStyle = "rgba(115, 255, 189, 0.72)";
    context.fillText("NEURAL_LINK / ACTIVE", 268, 229);

    for (let index = 0; index < 16; index += 1) {
      const y = 8 + random() * 234;
      const length = 8 + random() * 56;
      context.fillStyle = index % 3 === 0 ? "rgba(166,108,255,0.22)" : "rgba(86,230,255,0.17)";
      context.fillRect(random() * (CARD_WIDTH - length), y, length, random() > 0.7 ? 2 : 1);
    }

    const vignette = context.createRadialGradient(200, 125, 50, 200, 125, 260);
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,0.42)");
    context.fillStyle = vignette;
    context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
    context.restore();
  }

  // Both visible canvases are cleared and physically clipped on every split update.
  // The synchronized CSS clip-path is an extra compositor boundary, not the conversion itself.
  function renderCardSplit(card, split, force = false) {
    const roundedSplit = clamp(split, 0, CARD_WIDTH);
    if (!force && Math.abs(roundedSplit - card.lastSplit) < 0.35 && card.lastCodeTick === state.codeTick) return;

    const originalContext = card.context.original;
    const codeContext = card.context.code;
    originalContext.clearRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
    codeContext.clearRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

    if (roundedSplit < CARD_WIDTH) {
      originalContext.save();
      clipCard(originalContext);
      originalContext.beginPath();
      originalContext.rect(roundedSplit, 0, CARD_WIDTH - roundedSplit, CARD_HEIGHT);
      originalContext.clip();
      originalContext.drawImage(card.originalBuffer.canvas, 0, 0, CARD_WIDTH, CARD_HEIGHT);
      originalContext.restore();
    }

    if (roundedSplit > 0) {
      codeContext.save();
      clipCard(codeContext);
      codeContext.beginPath();
      codeContext.rect(0, 0, roundedSplit, CARD_HEIGHT);
      codeContext.clip();
      codeContext.drawImage(card.codeBuffer.canvas, 0, 0, CARD_WIDTH, CARD_HEIGHT);
      codeContext.restore();
    }

    const rightInset = Math.max(0, CARD_WIDTH - roundedSplit);
    card.canvas.code.style.clipPath = `inset(0 ${rightInset}px 0 0 round ${CARD_RADIUS}px)`;
    card.canvas.original.style.clipPath = `inset(0 0 0 ${roundedSplit}px round ${CARD_RADIUS}px)`;
    card.element.style.setProperty("--split-x", `${roundedSplit}px`);
    card.element.dataset.split = roundedSplit.toFixed(2);
    card.lastSplit = roundedSplit;
    card.lastCodeTick = state.codeTick;
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Unable to load ${src}`));
      image.src = src;
    });
  }

  async function createCard(data, index) {
    const fragment = template.content.cloneNode(true);
    const element = fragment.querySelector(".card-wrapper");
    const originalCanvas = fragment.querySelector(".original-layer");
    const codeCanvas = fragment.querySelector(".code-layer");

    element.dataset.cardId = data.id;
    element.dataset.cardIndex = String(index);
    element.setAttribute("role", "img");
    element.setAttribute("aria-label", `${data.name} 银行卡，正在进行 AI 数字化扫描`);
    originalCanvas.setAttribute("aria-hidden", "true");
    codeCanvas.setAttribute("aria-hidden", "true");
    track.appendChild(fragment);

    const card = {
      data,
      element,
      canvas: { original: originalCanvas, code: codeCanvas },
      context: {
        original: configureCardCanvas(originalCanvas).context,
        code: configureCardCanvas(codeCanvas).context,
      },
      originalBuffer: createBuffer(),
      codeBuffer: createBuffer(),
      image: null,
      lastSplit: -1,
      lastCodeTick: -1,
      x: 0,
    };

    try {
      card.image = await loadImage(data.src);
      drawOriginalBuffer(card);
      drawCodeBuffer(card, 0);
      renderCardSplit(card, 0, true);
      element.dataset.loadState = "ready";
    } catch (error) {
      element.dataset.loadState = "error";
      drawFallbackCard(card, data.name);
      console.error(error);
    }

    return card;
  }

  function drawFallbackCard(card, label) {
    const context = card.originalBuffer.context;
    context.clearRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
    context.save();
    clipCard(context);
    context.fillStyle = "#0b1020";
    context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
    context.strokeStyle = "rgba(86,230,255,.35)";
    context.strokeRect(18.5, 18.5, CARD_WIDTH - 37, CARD_HEIGHT - 37);
    context.fillStyle = "#a9b7d0";
    context.font = "12px ui-monospace, monospace";
    context.fillText(`${label} / IMAGE UNAVAILABLE`, 32, 48);
    context.restore();
    drawCodeBuffer(card, 0);
    renderCardSplit(card, 0, true);
  }

  function resizeEffects() {
    state.dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    state.ambientWidth = window.innerWidth;
    state.ambientHeight = window.innerHeight;
    state.stageWidth = stage.clientWidth;
    state.stageHeight = stage.clientHeight;
    state.gap = clamp(window.innerWidth * 0.045, 44, 70);

    for (const [canvas, width, height] of [
      [ambientCanvas, state.ambientWidth, state.ambientHeight],
      [scannerCanvas, state.stageWidth, state.stageHeight],
    ]) {
      canvas.width = Math.round(width * state.dpr);
      canvas.height = Math.round(height * state.dpr);
      const context = canvas.getContext("2d");
      context.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    }

    const random = createRandom(9017);
    const particleCount = reducedMotion ? 24 : clamp(Math.round(window.innerWidth / 13), 58, 130);
    state.particles = Array.from({ length: particleCount }, () => ({
      x: random() * state.ambientWidth,
      y: random() * state.ambientHeight,
      size: 0.4 + random() * 1.4,
      speed: 3 + random() * 14,
      drift: (random() - 0.5) * 4,
      phase: random() * Math.PI * 2,
      color: random() > 0.7 ? "violet" : random() > 0.25 ? "cyan" : "green",
    }));

    state.scannerParticles = Array.from({ length: reducedMotion ? 14 : 34 }, (_, index) => ({
      phase: (index / 34) * Math.PI * 2,
      y: random() * state.stageHeight,
      speed: 22 + random() * 55,
      reach: 18 + random() * 88,
      size: 0.7 + random() * 1.6,
    }));
  }

  function drawAmbient(time) {
    const context = ambientCanvas.getContext("2d");
    context.clearRect(0, 0, state.ambientWidth, state.ambientHeight);

    const second = time / 1000;
    context.font = "8px ui-monospace, SFMono-Regular, Menlo, monospace";
    context.textBaseline = "middle";
    state.particles.forEach((particle, index) => {
      const x = (particle.x - second * particle.speed + state.ambientWidth * 2) % state.ambientWidth;
      const y = particle.y + Math.sin(second * 0.45 + particle.phase) * particle.drift;
      const alpha = 0.12 + Math.sin(second + particle.phase) * 0.05;
      const color = particle.color === "violet" ? `166,108,255` : particle.color === "green" ? `115,255,189` : `86,230,255`;
      context.fillStyle = `rgba(${color},${alpha})`;
      context.fillRect(x, y, particle.size, particle.size);
      if (index % 13 === 0) {
        context.fillStyle = `rgba(${color},0.09)`;
        context.fillText(index % 2 ? "0110" : "AI/26", x + 5, y);
      }
    });

    context.strokeStyle = "rgba(98, 123, 184, 0.075)";
    context.lineWidth = 1;
    const horizon = state.ambientHeight * 0.51;
    for (let index = 0; index < 7; index += 1) {
      const y = horizon + (index - 3) * 42;
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(state.ambientWidth, y + Math.sin(second * 0.2 + index) * 2);
      context.stroke();
    }
  }

  function drawScannerEffects(time, activeCard) {
    const context = scannerCanvas.getContext("2d");
    const width = state.stageWidth;
    const height = state.stageHeight;
    const x = width * SCANNER_RATIO;
    const second = time / 1000;
    context.clearRect(0, 0, width, height);

    const energy = activeCard ? 1 : 0.46;
    context.save();
    context.lineWidth = 0.8;
    context.strokeStyle = `rgba(205, 176, 255, ${0.3 * energy})`;
    context.shadowColor = "#8c6bff";
    context.shadowBlur = 8 * energy;
    context.beginPath();
    context.moveTo(x, 0);
    for (let y = 0; y <= height; y += 11) {
      const jitter = Math.sin(y * 0.087 + second * 11) * 2.1 + Math.sin(y * 0.031 - second * 18) * 1.2;
      context.lineTo(x + jitter * energy, y);
    }
    context.stroke();
    context.restore();

    state.scannerParticles.forEach((particle, index) => {
      particle.y -= (particle.speed * energy) / 60;
      if (particle.y < -8) particle.y = height + 8;
      const direction = index % 2 ? -1 : 1;
      const pulse = (Math.sin(second * 1.9 + particle.phase) + 1) / 2;
      const particleX = x + direction * (8 + particle.reach * pulse);
      context.fillStyle = index % 3 === 0 ? `rgba(115,255,189,${0.36 * energy})` : `rgba(86,230,255,${0.31 * energy})`;
      context.fillRect(particleX, particle.y, particle.size, particle.size);

      if (index % 6 === 0) {
        context.strokeStyle = `rgba(166,108,255,${0.12 * energy})`;
        context.beginPath();
        context.moveTo(x, particle.y);
        context.lineTo(particleX, particle.y + Math.sin(second * 3 + index) * 4);
        context.stroke();
      }
    });

    const sweepY = ((time * 0.09) % (height + 60)) - 30;
    const sweepGradient = context.createLinearGradient(x - 62, sweepY, x + 62, sweepY);
    sweepGradient.addColorStop(0, "rgba(86,230,255,0)");
    sweepGradient.addColorStop(0.5, `rgba(238,244,255,${0.62 * energy})`);
    sweepGradient.addColorStop(1, "rgba(166,108,255,0)");
    context.fillStyle = sweepGradient;
    context.fillRect(x - 62, sweepY, 124, 1);
  }

  function updateTelemetry(card, split) {
    if (!card) {
      if (state.activeIndex !== -1) {
        state.activeIndex = -1;
        activeAsset.textContent = "AWAITING / NEXT ASSET";
        scanPercent.textContent = "--";
        progressMeter.style.transform = "scaleX(0)";
      }
      return;
    }

    const index = Number(card.element.dataset.cardIndex);
    const percent = Math.round((split / CARD_WIDTH) * 100);
    activeAsset.textContent = `${card.data.id} / ${card.data.name}`;
    scanPercent.textContent = `${percent}%`;
    progressMeter.style.transform = `scaleX(${percent / 100})`;
    streamRate.textContent = `${(1.74 + percent * 0.015 + index * 0.08).toFixed(2)} GB/s`;
    checksum.textContent = `${(card.data.seed * 13 + percent * 7).toString(16).toUpperCase().padStart(4, "0").slice(-4)}:${(card.data.seed * 31 + percent * 11).toString(16).toUpperCase().padStart(4, "0").slice(-4)}`;

    if (state.activeIndex !== index) {
      state.activeIndex = index;
      announcer.textContent = `正在扫描 ${card.data.name} 银行卡`;
    }
  }

  function updateCards(time) {
    if (!state.previousTime) state.previousTime = time;
    const delta = Math.min(50, time - state.previousTime);
    state.previousTime = time;
    if (!state.paused) {
      state.offset += (delta / 1000) * (reducedMotion ? REDUCED_SPEED : FULL_SPEED);
    }

    const tick = Math.floor(time / 170);
    if (tick !== state.codeTick) {
      state.codeTick = tick;
      state.cards.forEach((card) => drawCodeBuffer(card, tick));
    }

    const scannerX = state.stageWidth * SCANNER_RATIO;
    const stride = CARD_WIDTH + state.gap;
    const cycle = stride * state.cards.length;
    const baseX = scannerX - CARD_WIDTH * 0.5;
    let activeCard = null;
    let activeSplit = 0;

    state.cards.forEach((card, index) => {
      let x = baseX + index * stride - (state.offset % cycle);
      while (x < -CARD_WIDTH - state.gap) x += cycle;
      while (x >= cycle - CARD_WIDTH) x -= cycle;
      card.x = x;
      card.element.style.transform = `translate3d(${x}px, -50%, 0)`;

      const split = clamp(scannerX - x, 0, CARD_WIDTH);
      const isScanning = split > 0 && split < CARD_WIDTH;
      const scanState = isScanning ? "scanning" : split >= CARD_WIDTH ? "code" : "original";
      card.element.dataset.scanState = scanState;
      renderCardSplit(card, split);

      if (isScanning) {
        activeCard = card;
        activeSplit = split;
      }
    });

    updateTelemetry(activeCard, activeSplit);
    return activeCard;
  }

  // One clock owns rail motion, the physical split, data texture, beam energy and particles.
  function animate(time) {
    const activeCard = updateCards(time);
    drawAmbient(time);
    drawScannerEffects(time, activeCard);
    window.requestAnimationFrame(animate);
  }

  function togglePaused(nextPaused = !state.paused) {
    state.paused = nextPaused;
    app.dataset.paused = String(state.paused);
    pauseButton.setAttribute("aria-pressed", String(state.paused));
    pauseButton.setAttribute("aria-label", state.paused ? "继续扫描" : "暂停扫描");
    pauseButton.dataset.tooltip = state.paused ? "继续扫描" : "暂停扫描";
    announcer.textContent = state.paused ? "扫描已暂停" : "扫描已继续";
  }

  function resetTrack() {
    state.offset = 0;
    state.previousTime = 0;
    announcer.textContent = "扫描轨道已重新校准";
  }

  async function initialize() {
    resizeEffects();
    const cardPromises = CARD_DATA.map(async (data, index) => {
      const card = await createCard(data, index);
      const loaded = document.querySelectorAll(".card-wrapper[data-load-state]").length;
      loadCount.textContent = `${loaded} / ${CARD_DATA.length}`;
      return card;
    });

    state.cards = await Promise.all(cardPromises);
    app.dataset.ready = "true";
    app.dataset.cardCount = String(state.cards.length);
    loadingState.hidden = true;
    window.requestAnimationFrame(animate);
  }

  pauseButton.addEventListener("click", () => togglePaused());
  resetButton.addEventListener("click", resetTrack);

  window.addEventListener("keydown", (event) => {
    if (event.code === "Space" && event.target === document.body) {
      event.preventDefault();
      togglePaused();
    }
  });

  window.addEventListener("resize", resizeEffects, { passive: true });

  // Deterministic controls keep visual regression tests independent from wall-clock timing.
  window.__cardScanner = Object.freeze({
    pause() {
      togglePaused(true);
    },
    play() {
      togglePaused(false);
    },
    reset() {
      resetTrack();
    },
    seek(offset) {
      state.offset = Math.max(0, Number(offset) || 0);
      state.previousTime = window.performance.now();
      updateCards(state.previousTime);
    },
    snapshot() {
      return {
        paused: state.paused,
        offset: state.offset,
        cards: state.cards.map((card) => ({
          id: card.data.id,
          x: card.x,
          split: card.lastSplit,
          state: card.element.dataset.scanState,
        })),
      };
    },
  });

  initialize();
})();

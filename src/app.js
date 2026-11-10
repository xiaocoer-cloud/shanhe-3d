(function () {
  'use strict';

  /* ─────────────────────────────────────────────────────────────
     山河纪 · 中国历史疆域三维长卷
     Territory outlines adapted from 江山时序 (GPL-3.0).
     Base map: Natural Earth (public domain).
     ───────────────────────────────────────────────────────────── */

  const D = window.__ATLAS_DATA__;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const damp = (a, b, k) => a + (b - a) * k;

  const START_YEAR = D.meta.from;
  const END_YEAR = 2025;
  const N_ERAS = D.dynasties.length;
  const TOTAL_PHASES = D.dynasties.reduce((n, d) => n + d.phases.length, 0);

  const ERA_EN = {
    zhanguo: 'WARRING STATES', qin: 'QIN', xihan: 'WESTERN HAN', donghan: 'EASTERN HAN',
    sanguo: 'THREE KINGDOMS', xijin: 'WESTERN JIN', dongjin: 'EASTERN JIN', nanbei: 'NORTH & SOUTH',
    sui: 'SUI', tang: 'TANG', wudai: 'FIVE DYNASTIES', beisong: 'NORTHERN SONG',
    nansong: 'SOUTHERN SONG', yuan: 'YUAN', ming: 'MING', qing: 'QING', roc: 'REPUBLIC', prc: 'PRC'
  };
  ERA_EN.zhanguo = 'WARRING STATES';

  const BAND_NAME = {
    zhanguo: '战国', qin: '秦', xihan: '西汉', donghan: '东汉', sanguo: '三国', xijin: '西晋',
    dongjin: '东晋', nanbei: '南北朝', sui: '隋', tang: '唐', wudai: '五代', beisong: '北宋',
    nansong: '南宋', yuan: '元', ming: '明', qing: '清', roc: '民国', prc: '现代'
  };

  const CAPITALS = {
    zhanguo: [{ n: '洛阳', s: '周王城', c: [112.45, 34.62] }],
    qin: [{ n: '咸阳', s: '秦都', c: [108.71, 34.33] }],
    xihan: [{ n: '长安', s: '汉都', c: [108.94, 34.34] }],
    donghan: [{ n: '洛阳', s: '汉都', c: [112.45, 34.62] }],
    sanguo: [
      { n: '洛阳', s: '魏都', c: [112.45, 34.62] },
      { n: '成都', s: '蜀都', c: [104.07, 30.67] },
      { n: '建业', s: '吴都', c: [118.80, 32.06] }
    ],
    xijin: [{ n: '洛阳', s: '晋都', c: [112.45, 34.62] }],
    dongjin: [{ n: '建康', s: '晋都', c: [118.80, 32.06] }],
    nanbei: [{ n: '洛阳', s: '北魏', c: [112.45, 34.62] }, { n: '建康', s: '南朝', c: [118.80, 32.06] }],
    sui: [{ n: '大兴', s: '隋都', c: [108.94, 34.34] }],
    tang: [{ n: '长安', s: '唐都', c: [108.94, 34.34] }],
    wudai: [{ n: '开封', s: '后周', c: [114.31, 34.80] }],
    beisong: [{ n: '开封', s: '宋都', c: [114.31, 34.80] }],
    nansong: [{ n: '临安', s: '宋行在', c: [120.15, 30.27] }],
    yuan: [{ n: '大都', s: '元都', c: [116.40, 39.90] }],
    ming: [{ n: '北京', s: '明都', c: [116.40, 39.90] }],
    qing: [{ n: '北京', s: '清都', c: [116.40, 39.90] }],
    roc: [{ n: '南京', s: '民国', c: [118.80, 32.06] }],
    prc: [{ n: '北京', s: '首都', c: [116.40, 39.90] }]
  };

  const ROLE_LABEL = { main: '主政权', rival: '并立政权', protectorate: '都护 / 羁縻', neighbor: '四邻政权' };
  const ROLE_STYLE = {
    main: { h: 5.05, sat: 0.46, light: 0.4, opacity: 1, label: 1, shadow: true },
    rival: { h: 4.15, sat: 0.4, light: 0.38, opacity: 1, label: 2, shadow: true },
    protectorate: { h: 1.88, sat: 0.28, light: 0.31, opacity: 0.86, label: 3, shadow: false },
    neighbor: { h: 0.78, sat: 0.04, light: 0.075, opacity: 0.42, label: 0, shadow: false }
  };

  /* ── coordinate system ─────────────────────────────────────── */
  const LON0 = 58, LON1 = 150, LAT0 = 7, LAT1 = 58;
  const CX = (LON0 + LON1) / 2;
  const CY = (LAT0 + LAT1) / 2;
  const XS = 0.86;
  const ZS = 1.0;
  const BASE_Y = -0.44;
  const OCEAN_Y = -1.15;
  const CLIP_X = 42.16;
  const CLIP_Z = 28.0;
  const DISC_R = 62;
  const BOUND = { lon0: 55, lon1: 153, lat0: 4, lat1: 60.5 };
  const TERRAIN_REGION = { west: 45, east: 157.5, south: 0, north: 61.6064 };

  function geoX(lon) { return (lon - CX) * XS; }
  function geoZ(lat) { return -(lat - CY) * ZS; }
  function planeX(lon) { return (lon - CX) * XS; }
  function planeY(lat) { return (lat - CY) * ZS; }
  function geoWorld(lon, lat, y) { return new Vector3(geoX(lon), y, geoZ(lat)); }

  /* ── DOM ───────────────────────────────────────────────────── */
  const dom = {
    app: $('#app'),
    canvas: $('#scene'),
    loading: $('#loading'),
    loadingText: $('#loading-text'),
    fallback: $('#fallback'),
    tip: $('#tip'),
    toast: $('#toast'),
    info: $('#info-panel'),
    eraIndex: $('#era-index'),
    eraEn: $('#era-en'),
    eraTitle: $('#era-title'),
    eraBadge: $('#era-badge'),
    eraYears: $('#era-years'),
    eraSummary: $('#era-summary'),
    phaseCaption: $('#phase-caption'),
    eventYear: $('#event-year'),
    eventList: $('#event-list'),
    metaCapital: $('#meta-capital'),
    tlEra: $('#tl-era'),
    tlEn: $('#tl-en'),
    tlYear: $('#tl-year'),
    tlPhase: $('#tl-phase'),
    track: $('#track'),
    trackBands: $('#track-bands'),
    trackTicks: $('#track-ticks'),
    trackEvents: $('#track-events'),
    trackHover: $('#track-hover'),
    playhead: $('#playhead'),
    phBubble: $('#ph-bubble'),
    play: $('#btn-play'),
    prev: $('#btn-prev'),
    next: $('#btn-next'),
    rotate: $('#btn-rotate'),
    reset: $('#btn-reset'),
    layersBtn: $('#btn-layers'),
    layersPop: $('#layers-pop'),
    aboutBtn: $('#btn-about'),
    modal: $('#about-modal'),
    modalClose: $('#modal-close'),
    modalStart: $('#modal-start'),
    compassNeedle: $('#compass-needle'),
    hintPill: $('#hint-pill'),
    footMid: $('#foot-mid'),
    legend: $('#legend')
  };

  const state = {
    year: 750,
    dynIndex: -1,
    phaseIndex: -1,
    phase: null,
    polities: [],
    scaleMode: 'era',
    playing: false,
    playPct: 0,
    draggingTrack: false,
    autoRotate: false,
    hoverMesh: null,
    layers: { neighbors: true, rivers: true, modern: true, labels: true, grid: true, shadow: true, tdt: true },
    startTs: 0,
    introDone: false,
    layoutMode: '',
    hintGone: false
  };

  const cam = {
    cur: { theta: 0.7, phi: 0.92, radius: 148, target: new Vector3(0, -4, 0) },
    want: { theta: 0.38, phi: 0.68, radius: 96, target: new Vector3(-3.5, -6.5, 1) }
  };

  /* ── three objects ─────────────────────────────────────────── */
  let scene, camera, renderer, raycaster, pointer;
  let world, oceanGroup, baseGroup, gridGroup, riverGroup, lakeGroup, modernGroup;
  let polityLayer, capitalGroup, frameGroup;
  let keyLight;
  let baseTopMaterial = null;
  let baseGeo = null;
  let territoryTexture = null;
  let terrainTexture = null;
  let tdtTexture = null;
  let tdtState = 'idle';
  const TDT_KEY = '3344e7270267f505cb699fec886dd230';
  let activeGroup = null;
  let fadingGroups = [];
  let buildRaf = 0;
  let pendingBuild = false;
  let clockLast = 0;
  let labelEls = [];
  let seaLabelEls = [];
  let capitalEls = [];
  let labelsDirty = true;
  let pointerDown = null;
  let pinch = null;
  const touchPoints = new Map();
  let lastRayTs = 0;
  let toastTimer = 0;
  let dragBuildTimer = 0;
  let geomCache = new Map();
  let activeKeys = new Set();
  let builtOnce = false;
  let builtKey = '';
  let introStart = 0;

  const isMobile = () => window.innerWidth < 640;
  const isTablet = () => window.innerWidth >= 640 && window.innerWidth < 1000;
  const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── formatting ────────────────────────────────────────────── */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function pad2(n) { return n < 10 ? '0' + n : String(n); }
  function fmtYear(y) { return y < 0 ? '前 ' + (-y) : String(y); }
  function fmtShort(y) { return y < 0 ? '前' + (-y) : String(y); }
  function fmtFull(y) { return y < 0 ? '公元前 ' + (-y) + ' 年' : '公元 ' + y + ' 年'; }
  function fmtSpan(a, b) { return fmtYear(a) + ' — ' + fmtYear(b); }
  function cleanText(s) {
    return String(s || '')
      .replace(/（拖动滑块[^）]*）/g, '')
      .replace(/（拖动底部时间轴[^）]*）/g, '')
      .replace(/拖动底部时间轴[^。]*。/g, '')
      .replace(/拖动滑块[^。]*。/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  function phaseShort(ph) {
    const c = cleanText(ph && ph.caption);
    const parts = c.split('·');
    return parts.length > 1 ? parts.slice(1).join('·').trim() : c;
  }

  /* ── history lookup ────────────────────────────────────────── */
  function findDynastyIndex(year) {
    let idx = 0;
    for (let i = 0; i < N_ERAS; i++) {
      if (year >= D.dynasties[i].from) idx = i;
    }
    return idx;
  }
  function findPhaseIndex(dyn, year) {
    const ps = dyn.phases;
    for (let i = 0; i < ps.length; i++) {
      if (year < ps[i].until || i === ps.length - 1) return i;
    }
    return ps.length - 1;
  }
  function yearToPct(year) {
    if (state.scaleMode === 'era') {
      const i = findDynastyIndex(year);
      const d = D.dynasties[i];
      const end = i === N_ERAS - 1 ? END_YEAR : d.to;
      const frac = clamp((year - d.from) / Math.max(1, end - d.from), 0, 1);
      return ((i + frac) / N_ERAS) * 100;
    }
    return ((year - START_YEAR) / (END_YEAR - START_YEAR)) * 100;
  }
  function pctToYear(pct) {
    pct = clamp(pct, 0, 100);
    if (state.scaleMode === 'era') {
      const p = (pct / 100) * N_ERAS;
      let i = Math.floor(p);
      if (i >= N_ERAS) i = N_ERAS - 1;
      const d = D.dynasties[i];
      const frac = clamp(p - i, 0, 1);
      const end = i === N_ERAS - 1 ? END_YEAR : d.to;
      return Math.round(d.from + frac * (end - d.from));
    }
    return Math.round(START_YEAR + (pct / 100) * (END_YEAR - START_YEAR));
  }

  function tdtTileLat(y) {
    const n = 2 ** 5;
    return Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * 180 / Math.PI;
  }

  function loadTdtTile(x, y) {
    return new Promise(resolve => {
      const s = (x * 7 + y * 3 + 5) % 8;
      const url = 'https://t' + s + '.tianditu.gov.cn/img_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=img&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX=5&TILEROW=' + y + '&TILECOL=' + x + '&tk=' + TDT_KEY;
      const img = new Image();
      let done = false;
      const finish = ok => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(ok ? img : null);
      };
      const timer = setTimeout(() => finish(false), 9000);
      img.crossOrigin = 'anonymous';
      img.onload = () => finish(true);
      img.onerror = () => finish(false);
      img.src = url;
    });
  }

  async function buildTdtTexture() {
    const x0 = 20, x1 = 29, y0 = 9, y1 = 15;
    const cols = x1 - x0 + 1, rows = y1 - y0 + 1;
    const W = 2048, H = 1122;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#07110c';
    ctx.fillRect(0, 0, W, H);

    const coords = [];
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) coords.push({ x, y });
    }
    const results = [];
    let cursor = 0;
    async function worker() {
      while (cursor < coords.length) {
        const c = coords[cursor++];
        const img = await loadTdtTile(c.x, c.y);
        results.push({ x: c.x, y: c.y, img });
      }
    }
    await Promise.all(Array.from({ length: 6 }, worker));
    const ok = results.filter(r => r.img);
    if (ok.length < coords.length * 0.85) throw new Error('tiles blocked or unavailable');

    const N = 32;
    const west = 45, east = 157.5;
    const north = tdtTileLat(y0), south = tdtTileLat(y1 + 1);
    for (const { x, y, img } of ok) {
      const dx = (x / N * 360 - 180 - west) / (east - west) * W;
      const dw = (1 / N * 360) / (east - west) * W;
      for (let sy = 0; sy < 256; sy += 4) {
        const gy0 = (y * 256 + sy) / (N * 256);
        const gy1 = (y * 256 + sy + 4) / (N * 256);
        const lat0 = Math.atan(Math.sinh(Math.PI * (1 - 2 * gy0))) * 180 / Math.PI;
        const lat1 = Math.atan(Math.sinh(Math.PI * (1 - 2 * gy1))) * 180 / Math.PI;
        const dy = (north - Math.max(lat0, lat1)) / (north - south) * H;
        const dh = (lat0 - lat1) / (north - south) * H;
        try {
          ctx.drawImage(img, 0, sy, 256, 4, dx, dy, dw + 0.6, Math.max(1, dh) + 0.4);
        } catch (e) { throw new Error('canvas blocked (CORS)'); }
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(4,11,8,0.32)';
    ctx.fillRect(0, 0, W, H);
    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return tex;
  }

  async function loadTdtBase(silent) {
    if (tdtState === 'ready' && tdtTexture) {
      const credit = document.querySelector('#tdt-credit');
      if (credit) { credit.hidden = false; credit.textContent = '天地图影像 · © 国家地理信息公共服务平台'; }
      applyBaseMap();
      return;
    }
    if (tdtState === 'loading') return;
    tdtState = 'loading';
    const creditEl = document.querySelector('#tdt-credit');
    if (creditEl) { creditEl.hidden = false; creditEl.textContent = '天地图影像载入中…'; }
    if (!silent) toast('正在载入天地图影像…');
    try {
      const tex = await buildTdtTexture();
      tdtTexture = tex;
      tdtState = 'ready';
      if (!state.layers.tdt) {
        const credit = document.querySelector('#tdt-credit');
        if (credit) credit.hidden = true;
        return;
      }
      const credit = document.querySelector('#tdt-credit');
      if (credit) { credit.hidden = false; credit.textContent = '天地图影像 · © 国家地理信息公共服务平台'; }
      if (baseTopMaterial) {
        baseTopMaterial.map = tex;
        baseTopMaterial.color.setHex(0xa4b0a3);
        baseTopMaterial.roughness = 1;
        baseTopMaterial.needsUpdate = true;
        remapBaseUVs(TERRAIN_REGION);
      }
      if (!silent) toast('天地图影像已载入');
    } catch (e) {
      tdtState = 'failed';
      state.layers.tdt = false;
      const credit = document.querySelector('#tdt-credit');
      if (credit) credit.hidden = true;
      const cb = document.querySelector('.layers-pop input[data-layer="tdt"]');
      if (cb) cb.checked = false;
      if (!silent) saveLayers();
      if (!silent) toast(e.message && /CORS|blocked/.test(e.message) ? '天地图影像不可用：域名未授权' : '天地图影像载入失败');
      console.warn('Tianditu load failed', e);
    }
  }

  function applyBaseMap() {
    if (!baseTopMaterial) return;
    if (state.layers.tdt && tdtTexture) {
      baseTopMaterial.map = tdtTexture;
      baseTopMaterial.color.setHex(0xa4b0a3);
    } else if (terrainTexture) {
      baseTopMaterial.map = terrainTexture;
      baseTopMaterial.color.setHex(0x9aa79a);
    }
    baseTopMaterial.roughness = 1;
    baseTopMaterial.needsUpdate = true;
    remapBaseUVs(TERRAIN_REGION);
  }

  function applyTerrainTexture() {
    if (!baseTopMaterial || !window.__TERRAIN_URI__) return;
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      try {
        const tex = new Texture(img);
        tex.colorSpace = SRGBColorSpace;
        tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        tex.needsUpdate = true;
        terrainTexture = tex;
        if (state.layers.tdt && tdtState === 'ready' && tdtTexture) return;
        baseTopMaterial.map = tex;
        baseTopMaterial.color.setHex(0x9aa79a);
        baseTopMaterial.roughness = 1;
        baseTopMaterial.needsUpdate = true;
        remapBaseUVs(TERRAIN_REGION);
      } catch (e) { console.warn('terrain texture failed', e); }
    };
    img.onerror = () => console.warn('terrain image failed');
    img.src = window.__TERRAIN_URI__;
  }

  /* ── boot ──────────────────────────────────────────────────── */
  function boot() {
    if (!D || !D.dynasties || !D.shapes) {
      showFallback('地图数据未能载入。');
      return;
    }
    try {
      initScene();
      buildAll();
      applyTerrainTexture();
      buildTimeline();
      bindTimeline();
      bindUI();
      if (state.layers.tdt) loadTdtBase(true);
      bindSceneInteraction();
      layoutCamera(true);
      selectYear(750, { immediate: true });
      window.__SHANHE3D__ = { scene, camera, renderer, state, cam, Raycaster, Vector2, Vector3, setYear: (y) => selectYear(y), groups: { oceanGroup, baseGroup, gridGroup, riverGroup, lakeGroup, modernGroup, frameGroup, polityLayer, capitalGroup }, get activeGroup(){ return activeGroup; } };
      state.startTs = performance.now();
      introStart = state.startTs;
      animate(state.startTs);
      setTimeout(() => {
        dom.loading.classList.add('done');
        setTimeout(() => { dom.loading.style.display = 'none'; }, 900);
      }, 520);
      setTimeout(() => hideHint(), 9000);
    } catch (err) {
      console.error(err);
      showFallback('三维场景初始化失败：' + (err && err.message ? err.message : '未知错误'));
    }
  }

  function showFallback(msg) {
    dom.loading.classList.add('done');
    dom.loading.style.display = 'none';
    dom.fallback.hidden = false;
    if (msg) {
      const p = dom.fallback.querySelector('p');
      if (p) p.textContent = msg;
    }
  }

  function canWebGL() {
    try {
      const c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
    } catch (e) { return false; }
  }

  function initScene() {
    if (!canWebGL()) {
      showFallback('此设备暂不支持 WebGL，无法渲染三维地图。');
      throw new Error('WebGL unavailable');
    }

    scene = new Scene();
    scene.background = new Color(0x06100d);
    scene.fog = new Fog(0x06100d, 190, 380);

    camera = new PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 520);

    renderer = new WebGLRenderer({
      canvas: dom.canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile() ? 1.6 : 2));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;
    renderer.shadowMap.enabled = !isMobile();
    renderer.shadowMap.type = PCFSoftShadowMap;

    raycaster = new Raycaster();
    pointer = new Vector2();

    world = new Group();
    scene.add(world);

    oceanGroup = new Group();
    baseGroup = new Group();
    gridGroup = new Group();
    riverGroup = new Group();
    lakeGroup = new Group();
    modernGroup = new Group();
    polityLayer = new Group();
    capitalGroup = new Group();
    frameGroup = new Group();
    world.add(oceanGroup, baseGroup, gridGroup, riverGroup, lakeGroup, modernGroup, frameGroup, polityLayer, capitalGroup);

    setupLights();
  }

  function setupLights() {
    scene.add(new HemisphereLight(0xb9d4c4, 0x0a1410, 0.72));
    scene.add(new AmbientLight(0x9fb7a7, 0.18));

    keyLight = new DirectionalLight(0xffe2b2, 1.55);
    keyLight.position.set(-48, 92, 52);
    keyLight.castShadow = !isMobile();
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.left = -62;
    keyLight.shadow.camera.right = 62;
    keyLight.shadow.camera.top = 62;
    keyLight.shadow.camera.bottom = -62;
    keyLight.shadow.camera.near = 8;
    keyLight.shadow.camera.far = 220;
    keyLight.shadow.bias = -0.0007;
    keyLight.shadow.normalBias = 0.035;
    keyLight.target.position.set(0, 0, 0);
    scene.add(keyLight, keyLight.target);

    const fill = new DirectionalLight(0x6b9db0, 0.52);
    fill.position.set(66, 48, -46);
    scene.add(fill);

    const rim = new PointLight(0xc9a66a, 12, 100, 2);
    rim.position.set(45, 23, 55);
    scene.add(rim);

    const cool = new PointLight(0x6ea892, 7, 90, 2);
    cool.position.set(-52, 18, -44);
    scene.add(cool);
  }

  function buildAll() {
    buildOcean();
    buildBase();
    buildGraticule();
    buildFrame();
    buildRivers();
    buildLakes();
    buildModernBorder();
  }

  /* ── ocean / plinth ────────────────────────────────────────── */
  function oceanTexture() {
    const size = 1024;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(size * 0.5, size * 0.5, size * 0.02, size * 0.5, size * 0.5, size * 0.5);
    g.addColorStop(0, '#1a392e');
    g.addColorStop(0.38, '#11291f');
    g.addColorStop(0.7, '#0a1c14');
    g.addColorStop(1, '#03100b');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);

    ctx.save();
    ctx.translate(size / 2, size / 2);
    for (let i = 1; i <= 13; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, (i / 13) * size * 0.49, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(164,198,174,' + (0.012 + (i % 3) * 0.006) + ')';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    for (let i = 0; i < 2400; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.pow(Math.random(), 0.55) * size * 0.49;
      ctx.fillStyle = 'rgba(190,215,196,' + (0.008 + Math.random() * 0.035) + ')';
      ctx.fillRect(Math.cos(a) * r, Math.sin(a) * r, 1.2, 1.2);
    }
    ctx.restore();

    const tex = new CanvasTexture(c);
    tex.colorSpace = SRGBColorSpace;
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return tex;
  }

  function buildOcean() {
    const tex = oceanTexture();
    const surface = new Mesh(
      new CircleGeometry(DISC_R, 128),
      new MeshBasicMaterial({ map: tex, color: 0xffffff })
    );
    surface.rotation.x = -Math.PI / 2;
    surface.position.y = OCEAN_Y;
    surface.receiveShadow = false;
    oceanGroup.add(surface);

    const side = new Mesh(
      new CylinderGeometry(DISC_R, DISC_R * 0.985, 1.5, 128, 1, true),
      new MeshStandardMaterial({ color: 0x04110c, roughness: 0.72, metalness: 0.25, side: DoubleSide })
    );
    side.position.y = OCEAN_Y - 0.75;
    side.receiveShadow = false;
    oceanGroup.add(side);

    const rim = new Mesh(
      new TorusGeometry(DISC_R, 0.07, 8, 220),
      new MeshBasicMaterial({ color: 0xa88652, transparent: true, opacity: 0.42 })
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = OCEAN_Y + 0.01;
    oceanGroup.add(rim);

    const rim2 = new Mesh(
      new TorusGeometry(DISC_R - 1.15, 0.02, 5, 200),
      new MeshBasicMaterial({ color: 0xc9a66a, transparent: true, opacity: 0.16 })
    );
    rim2.rotation.x = Math.PI / 2;
    rim2.position.y = OCEAN_Y + 0.012;
    oceanGroup.add(rim2);
  }

  /* ── base land ─────────────────────────────────────────────── */
  function ringPairs(ring) {
    const pts = [];
    for (let i = 0; i < ring.length; i += 2) {
      if (Number.isFinite(ring[i]) && Number.isFinite(ring[i + 1])) pts.push([ring[i], ring[i + 1]]);
    }
    return pts;
  }

  function clipRingToRect(pts, b) {
    if (!pts || pts.length < 3) return [];
    const edges = [
      [p => p[0] >= b.lon0, (a, c) => [b.lon0, a[1] + (c[1] - a[1]) * (b.lon0 - a[0]) / (c[0] - a[0])]],
      [p => p[0] <= b.lon1, (a, c) => [b.lon1, a[1] + (c[1] - a[1]) * (b.lon1 - a[0]) / (c[0] - a[0])]],
      [p => p[1] >= b.lat0, (a, c) => [a[0] + (c[0] - a[0]) * (b.lat0 - a[1]) / (c[1] - a[1]), b.lat0]],
      [p => p[1] <= b.lat1, (a, c) => [a[0] + (c[0] - a[0]) * (b.lat1 - a[1]) / (c[1] - a[1]), b.lat1]]
    ];
    let out = pts;
    for (const [inside, intersect] of edges) {
      const inp = out;
      out = [];
      if (!inp.length) break;
      for (let i = 0; i < inp.length; i++) {
        const cur = inp[i];
        const prev = inp[(i + inp.length - 1) % inp.length];
        if (inside(cur)) {
          if (!inside(prev)) out.push(intersect(prev, cur));
          out.push(cur);
        } else if (inside(prev)) {
          out.push(intersect(prev, cur));
        }
      }
    }
    return out;
  }

  function clipLineToRect(pts, b) {
    const out = [];
    const inside = p => p[0] >= b.lon0 && p[0] <= b.lon1 && p[1] >= b.lat0 && p[1] <= b.lat1;
    function cut(a, c) {
      let t0 = 0, t1 = 1;
      const dx = c[0] - a[0], dy = c[1] - a[1];
      const tests = [
        [-dx, a[0] - b.lon0], [dx, b.lon1 - a[0]],
        [-dy, a[1] - b.lat0], [dy, b.lat1 - a[1]]
      ];
      for (const [p, q] of tests) {
        if (p === 0) { if (q < 0) return null; continue; }
        const r = q / p;
        if (p < 0) { if (r > t1) return null; if (r > t0) t0 = r; }
        else { if (r < t0) return null; if (r < t1) t1 = r; }
      }
      return [
        [a[0] + t0 * dx, a[1] + t0 * dy],
        [a[0] + t1 * dx, a[1] + t1 * dy]
      ];
    }
    for (let i = 0; i < pts.length - 1; i++) {
      if (inside(pts[i]) && inside(pts[i + 1])) {
        out.push([pts[i], pts[i + 1]]);
      } else {
        const seg = cut(pts[i], pts[i + 1]);
        if (seg && (Math.abs(seg[0][0] - seg[1][0]) > 1e-5 || Math.abs(seg[0][1] - seg[1][1]) > 1e-5)) out.push(seg);
      }
    }
    return out;
  }

  function makeExtrudeShapes(polygons, tol) {
    const shapes = [];
    for (const poly of polygons || []) {
      if (!poly || !poly.length) continue;
      const outerClipped = clipRingToRect(ringPairs(poly[0]), BOUND);
      if (outerClipped.length < 3) continue;
      const outerPts = simplifyFlatRing(outerClipped.flat(), tol);
      if (!outerPts || outerPts.length < 3) continue;
      const outer = new Shape();
      outer.moveTo(outerPts[0][0], outerPts[0][1]);
      for (let i = 1; i < outerPts.length; i++) outer.lineTo(outerPts[i][0], outerPts[i][1]);
      outer.closePath();
      for (let h = 1; h < poly.length; h++) {
        const holeClipped = clipRingToRect(ringPairs(poly[h]), BOUND);
        if (holeClipped.length < 3) continue;
        const hp = simplifyFlatRing(holeClipped.flat(), tol);
        if (!hp || hp.length < 3) continue;
        const hole = new Path();
        hole.moveTo(hp[0][0], hp[0][1]);
        for (let i = 1; i < hp.length; i++) hole.lineTo(hp[i][0], hp[i][1]);
        hole.closePath();
        outer.holes.push(hole);
      }
      shapes.push(outer);
    }
    return shapes;
  }

  function simplifyFlatRing(ring, tol) {
    if (!ring || ring.length < 6) return null;
    const pts = [];
    for (let i = 0; i < ring.length; i += 2) {
      const x = planeX(ring[i]);
      const y = planeY(ring[i + 1]);
      const prev = pts[pts.length - 1];
      if (!prev || (x - prev[0]) * (x - prev[0]) + (y - prev[1]) * (y - prev[1]) >= tol * tol) {
        pts.push([x, y]);
      }
    }
    if (pts.length < 3) {
      for (let i = 0; i < ring.length; i += 2) pts.push([planeX(ring[i]), planeY(ring[i + 1])]);
    }
    if (pts.length > 3) {
      const a = pts[0], b = pts[pts.length - 1];
      if (Math.abs(a[0] - b[0]) < 0.001 && Math.abs(a[1] - b[1]) < 0.001) pts.pop();
    }
    return pts.length >= 3 ? pts : null;
  }

  function clippedMaterial(opts) {
    return new MeshStandardMaterial(opts);
  }

  function makeBaseTexture() {
    const w = 1024, h = 640;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#050b07';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 170; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const r = 24 + Math.random() * 150;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const light = Math.random() > 0.48;
      g.addColorStop(0, light ? 'rgba(38,60,46,0.075)' : 'rgba(0,3,1,0.1)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < 12000; i++) {
      ctx.fillStyle = 'rgba(190,215,195,' + (0.012 + Math.random() * 0.02) + ')';
      ctx.fillRect(Math.random() * w, Math.random() * h, 1, 1);
    }
    const tex = new CanvasTexture(c);
    tex.colorSpace = SRGBColorSpace;
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return tex;
  }

  function remapBaseUVs(region) {
    if (!baseGeo) return;
    const pos = baseGeo.attributes.position;
    const uv = baseGeo.attributes.uv;
    const x0 = planeX(region.west), x1 = planeX(region.east);
    const y0 = planeY(region.south), y1 = planeY(region.north);
    for (let i = 0; i < pos.count; i++) {
      const u = (pos.getX(i) - x0) / (x1 - x0);
      const v = (-pos.getZ(i) - y0) / (y1 - y0);
      uv.setXY(i, clamp(u, 0, 1), clamp(v, 0, 1));
    }
    uv.needsUpdate = true;
  }

  function buildBase() {
    const shapes = makeExtrudeShapes(D.base.land, 0.17);
    if (!shapes.length) return;
    const geo = new ExtrudeGeometry(shapes, { depth: 0.7, bevelEnabled: false, curveSegments: 1, steps: 1 });
    geo.rotateX(-Math.PI / 2);
    geo.computeVertexNormals();
    baseGeo = geo;

    const top = clippedMaterial({
      color: 0xffffff, map: makeBaseTexture(),
      roughness: 0.98, metalness: 0.01
    });
    const side = clippedMaterial({ color: 0x030806, roughness: 1, metalness: 0 });
    baseTopMaterial = top;
    remapBaseUVs(TERRAIN_REGION);
    const mesh = new Mesh(geo, [top, side]);
    mesh.position.y = OCEAN_Y + 0.03;
    mesh.receiveShadow = true;
    baseGroup.add(mesh);

    const positions = [];
    for (const line of D.base.coast || []) {
      const segs = clipLineToRect(ringPairs(line), BOUND);
      for (const [a, b] of segs) {
        positions.push(planeX(a[0]), OCEAN_Y + 0.735, -planeY(a[1]));
        positions.push(planeX(b[0]), OCEAN_Y + 0.735, -planeY(b[1]));
      }
    }
    if (positions.length) {
      const g = new BufferGeometry();
      g.setAttribute('position', new Float32BufferAttribute(positions, 3));
      const mat = new LineBasicMaterial({
        color: 0x9b8a63, transparent: true, opacity: 0.2, depthWrite: false
      });
      baseGroup.add(new LineSegments(g, mat));
    }
  }

  /* ── frame / graticule ─────────────────────────────────────── */
  function buildFrame() {
    const y = OCEAN_Y + 0.725;
    const pts = [
      -CLIP_X, y, -CLIP_Z, CLIP_X, y, -CLIP_Z,
      CLIP_X, y, -CLIP_Z, CLIP_X, y, CLIP_Z,
      CLIP_X, y, CLIP_Z, -CLIP_X, y, CLIP_Z,
      -CLIP_X, y, CLIP_Z, -CLIP_X, y, -CLIP_Z
    ];
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pts, 3));
    const mat = new LineBasicMaterial({ color: 0xc9a66a, transparent: true, opacity: 0.16, depthWrite: false, depthTest: false });
    frameGroup.add(new LineSegments(g, mat));

    const corners = [
      [-CLIP_X, -CLIP_Z], [CLIP_X, -CLIP_Z], [CLIP_X, CLIP_Z], [-CLIP_X, CLIP_Z]
    ];
    for (const [cx, cz] of corners) {
      const cp = [];
      const sx = cx < 0 ? 1 : -1;
      const sz = cz < 0 ? 1 : -1;
      cp.push(cx, y, cz, cx + sx * 1.4, y, cz);
      cp.push(cx, y, cz, cx, y, cz + sz * 1.4);
      const cg = new BufferGeometry();
      cg.setAttribute('position', new Float32BufferAttribute(cp, 3));
      frameGroup.add(new LineSegments(cg, new LineBasicMaterial({ color: 0xe7cc94, transparent: true, opacity: 0.34, depthWrite: false, depthTest: false })));
    }
  }

  function buildGraticule() {
    const y = OCEAN_Y + 0.045;
    const positions = [];
    for (let lon = 60; lon <= 150; lon += 10) {
      positions.push(geoX(lon), y, geoZ(LAT1), geoX(lon), y, geoZ(LAT0));
    }
    for (let lat = 10; lat <= 50; lat += 10) {
      positions.push(geoX(LON0), y, geoZ(lat), geoX(LON1), y, geoZ(lat));
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(positions, 3));
    const mat = new LineBasicMaterial({ color: 0x8fb29c, transparent: true, opacity: 0.085, depthWrite: false });
    gridGroup.add(new LineSegments(g, mat));
  }

  /* ── water ─────────────────────────────────────────────────── */
  const MAJOR_RIVERS = new Set(['Huang', 'Chang Jiang', 'Yangtze', 'Jinsha', 'Yarlung', 'Lancang', 'Nu', 'Songhua', 'Liao', 'Tarim', 'Heilong Jiang']);
  function buildRivers() {
    const y = OCEAN_Y + 0.745;
    const majorPos = [];
    const minorPos = [];
    for (const r of D.base.rivers || []) {
      const target = MAJOR_RIVERS.has(r.n) ? majorPos : minorPos;
      for (const line of r.d || []) {
        if (!line || line.length < 4) continue;
        const segs = clipLineToRect(ringPairs(line), BOUND);
        for (const [a, b] of segs) {
          target.push(planeX(a[0]), y, -planeY(a[1]));
          target.push(planeX(b[0]), y, -planeY(b[1]));
        }
      }
    }
    const add = (pos, color, opacity) => {
      if (!pos.length) return;
      const g = new BufferGeometry();
      g.setAttribute('position', new Float32BufferAttribute(pos, 3));
      riverGroup.add(new LineSegments(g, new LineBasicMaterial({
        color, transparent: true, opacity, depthWrite: false
      })));
    };
    add(minorPos, 0x679184, 0.2);
    add(majorPos, 0xd2b47a, 0.36);
  }

  function buildLakes() {
    const all = [];
    for (const lake of D.base.lakes || []) {
      for (const poly of lake.d || []) {
        const shapes = makeExtrudeShapes([poly], 0.1);
        if (shapes.length) all.push(shapes[0]);
      }
    }
    if (!all.length) return;
    const geo = new ShapeGeometry(all, 1);
    geo.rotateX(-Math.PI / 2);
    const mat = new MeshBasicMaterial({
      color: 0x0a2a22, transparent: true, opacity: 0.88,
      depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2
    });
    const mesh = new Mesh(geo, mat);
    mesh.position.y = OCEAN_Y + 0.735;
    lakeGroup.add(mesh);
  }

  /* ── modern border ─────────────────────────────────────────── */
  function buildModernBorder() {
    const modern = D.dynasties.find(d => d.key === 'prc');
    if (!modern) return;
    const main = modern.phases[0].snapshot.polities.find(p => p.r === 'main');
    if (!main) return;
    const shape = D.shapes[main.s] || [];
    const y = OCEAN_Y + 0.755;
    const mat = new LineDashedMaterial({
      color: 0xe7cc94, transparent: true, opacity: 0.5,
      dashSize: 0.62, gapSize: 0.5, depthWrite: false
    });
    const pos = [];
    for (const poly of shape) {
      for (const ring of poly) {
        if (!ring || ring.length < 4) continue;
        const segs = clipLineToRect(ringPairs(ring), BOUND);
        for (const [a, b] of segs) {
          pos.push(planeX(a[0]), y, -planeY(a[1]));
          pos.push(planeX(b[0]), y, -planeY(b[1]));
        }
      }
    }
    if (pos.length) {
      const g = new BufferGeometry();
      g.setAttribute('position', new Float32BufferAttribute(pos, 3));
      const lines = new LineSegments(g, mat);
      lines.computeLineDistances();
      modernGroup.add(lines);
    }
  }

  /* ── geometry cache ────────────────────────────────────────── */
  function ensureGeometry(shapeId, height) {
    const key = shapeId + '|' + height.toFixed(2);
    activeKeys.add(key);
    let entry = geomCache.get(key);
    if (entry) { entry.used = performance.now(); return entry.geo; }

    const shapes = makeExtrudeShapes(D.shapes[shapeId], 0.115);
    if (!shapes.length) return null;
    const geo = new ExtrudeGeometry(shapes, {
      depth: height, bevelEnabled: false, curveSegments: 1, steps: 1, UVGenerator: undefined
    });
    geo.rotateX(-Math.PI / 2);
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    entry = { geo, used: performance.now() };
    geomCache.set(key, entry);
    trimGeomCache();
    return geo;
  }

  function trimGeomCache() {
    if (geomCache.size <= 110) return;
    const entries = Array.from(geomCache.entries()).sort((a, b) => a[1].used - b[1].used);
    for (const [key, entry] of entries) {
      if (geomCache.size <= 96) break;
      if (activeKeys.has(key)) continue;
      entry.geo.dispose();
      geomCache.delete(key);
    }
  }

  /* ── polity materials ──────────────────────────────────────── */
  function makeTerritoryTexture() {
    if (territoryTexture) return territoryTexture;
    const size = 256;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#d9d9d9';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 120; i++) {
      const x = Math.random() * size, y = Math.random() * size, r = 8 + Math.random() * 40;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, Math.random() > 0.5 ? 'rgba(255,255,255,0.09)' : 'rgba(60,60,60,0.07)');
      g.addColorStop(1, 'rgba(128,128,128,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < 5000; i++) {
      ctx.fillStyle = 'rgba(80,80,80,' + (0.015 + Math.random() * 0.025) + ')';
      ctx.fillRect(Math.random() * size, Math.random() * size, 1, 1);
    }
    const tex = new CanvasTexture(c);
    tex.wrapS = tex.wrapT = RepeatWrapping;
    tex.repeat.set(0.32, 0.32);
    tex.colorSpace = SRGBColorSpace;
    tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    territoryTexture = tex;
    return tex;
  }

  function makePolityMaterials(p, height) {
    const style = ROLE_STYLE[p.r] || ROLE_STYLE.neighbor;
    const seed = new Color(p.t || D.dynasties[state.dynIndex].tint || '#68786a');
    if (D.dynasties[state.dynIndex].key === 'prc' && p.r === 'main') seed.setHex(0xb94b37);
    const hsl = {};
    seed.getHSL(hsl);
    let sat = clamp(hsl.s * 0.55 + style.sat * 0.65, 0.08, 0.62);
    let light = clamp(style.light + (hsl.l - 0.4) * 0.12, 0.2, 0.58);
    if (p.r === 'neighbor') { sat = 0.04; light = 0.075; }
    const topColor = new Color().setHSL(hsl.h, sat, light);
    const sideColor = new Color().setHSL(hsl.h, sat * 0.8, Math.max(0.08, light * 0.4));
    const baseOpacity = style.opacity;

    const top = new MeshStandardMaterial({
      color: topColor,
      roughness: p.r === 'neighbor' ? 0.82 : 0.54,
      metalness: p.r === 'neighbor' ? 0.06 : 0.14,
      emissive: topColor.clone().multiplyScalar(0.1),
      emissiveIntensity: 0.75,
      transparent: true,
      opacity: baseOpacity,
      depthWrite: true
    });
    const side = new MeshStandardMaterial({
      color: sideColor,
      roughness: 0.9,
      metalness: 0.05,
      transparent: true,
      opacity: baseOpacity,
      depthWrite: true
    });
    top.userData.baseOpacity = baseOpacity;
    side.userData.baseOpacity = baseOpacity;
    top.userData.isTop = true;
    return [top, side];
  }

  function heightFor(p) {
    const style = ROLE_STYLE[p.r] || ROLE_STYLE.neighbor;
    const jitter = ((Math.abs(Number(p.s) || 1) * 37) % 13) / 13 * 0.34;
    return style.h + jitter;
  }

  /* ── phase build ───────────────────────────────────────────── */
  function requestPhaseBuild(force) {
    const key = state.dynIndex + ':' + state.phaseIndex;
    if (!force && key === builtKey) return;
    pendingBuild = true;
    if (buildRaf) return;
    buildRaf = requestAnimationFrame(() => {
      buildRaf = 0;
      if (!pendingBuild) return;
      pendingBuild = false;
      buildPhase();
    });
  }

  function buildPhase() {
    if (!state.phase) return;
    clearHover();
    state.hoverMesh = null;
    const now = performance.now();
    const dyn = D.dynasties[state.dynIndex];
    const ph = state.phase;
    const polities = ph.snapshot.polities || [];
    const group = new Group();
    const labels = [];
    activeKeys = new Set();
    let idx = 0;

    for (const p of polities) {
      if (p.r === 'neighbor' && !state.layers.neighbors) continue;
      if (p.s == null) continue;
      const h = heightFor(p);
      const geo = ensureGeometry(p.s, h);
      if (!geo) continue;
      const mats = makePolityMaterials(p, h);
      const mesh = new Mesh(geo, mats);
      mesh.position.y = BASE_Y;
      mesh.castShadow = !isMobile() && !!(ROLE_STYLE[p.r] || ROLE_STYLE.neighbor).shadow && state.layers.shadow;
      mesh.receiveShadow = true;
      mesh.scale.y = reduceMotion() ? 1 : 0.015;
      mesh.userData.riseDelay = Math.min(idx * 18, 260);
      mesh.userData.polity = {
        name: p.n, role: p.r, anchor: p.a || null, height: h,
        color: mats[0].color.getStyle(), shapeId: p.s
      };
      mesh.userData.materials = mats;
      if (p.r !== 'neighbor') {
        const eg = new EdgesGeometry(geo, 32);
        const em = new LineBasicMaterial({
          color: mats[0].color.clone().offsetHSL(0, 0, 0.14),
          transparent: true, opacity: 0.24, depthWrite: false
        });
        em.userData.baseOpacity = 0.24;
        const edges = new LineSegments(eg, em);
        edges.userData.disposeGeo = true;
        mesh.add(edges);
      }
      group.add(mesh);

      if (p.r !== 'neighbor' && p.a && (!isMobile() || p.r === 'main')) {
        labels.push({
          name: p.n === '中华人民共和国' ? '中国' : p.n,
          role: p.r,
          x: geoX(p.a[0]),
          z: geoZ(p.a[1]),
          y: BASE_Y + h + 1.15,
          color: mats[0].color.getStyle(),
          priority: ROLE_STYLE[p.r].label,
          width: (p.n === '中华人民共和国' ? 2 : p.n.length) * (p.r === 'main' ? 15 : 12.5),
          el: null
        });
      }
      idx++;
    }

    group.userData = { type: 'phase', start: now, labels, dynKey: dyn.key };
    polityLayer.add(group);

    const old = activeGroup;
    if (old) {
      old.userData.fadeStart = now;
      fadingGroups.push(old);
      if (fadingGroups.length > 2) finalizeGroup(fadingGroups.shift());
    }
    activeGroup = group;
    builtKey = state.dynIndex + ':' + state.phaseIndex;
    state.polities = polities;
    buildLabels(labels);
    buildCapitals(dyn, polities);
    trimGeomCache();
    builtOnce = true;
    labelsDirty = true;
  }

  function finalizeGroup(group) {
    if (!group) return;
    if (group.parent) group.parent.remove(group);
    group.traverse(o => {
      if (o.userData && o.userData.disposeGeo && o.geometry) o.geometry.dispose();
      if (o.material) {
        const arr = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of arr) {
          if (m && m.dispose && m.userData && m.userData.baseOpacity != null) m.dispose();
        }
      }
    });
  }

  function setGroupOpacity(group, mul) {
    group.traverse(o => {
      if (!o.material) return;
      const arr = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of arr) {
        if (!m) continue;
        if (m.userData && m.userData.baseOpacity != null) m.opacity = m.userData.baseOpacity * mul;
      }
    });
  }

  /* ── labels ────────────────────────────────────────────────── */
  function buildLabels(labels) {
    labelEls.forEach(x => { if (x.el) x.el.remove(); });
    labelEls = [];
    const layer = dom.app;
    for (const l of labels) {
      if (!state.layers.labels) break;
      const el = document.createElement('div');
      el.className = 'map-label ' + l.role;
      el.style.setProperty('--c', l.color);
      el.innerHTML = '<i></i><span>' + esc(l.name) + '</span>';
      layer.appendChild(el);
      l.el = el;
      l.w = Math.max(26, l.width + 12);
      l.h = l.role === 'main' ? 21 : 18;
      labelEls.push(l);
    }
    labelsDirty = true;
  }

  function buildSeaLabels() {
    seaLabelEls.forEach(x => { if (x.el) x.el.remove(); });
    seaLabelEls = [];
    const items = [
      { t: '黄 海', c: [123.7, 34.2] },
      { t: '东 海', c: [126.8, 27.6] },
      { t: '南 海', c: [114.0, 16.2] },
      { t: '渤 海', c: [119.8, 38.6] }
    ];
    for (const it of items) {
      const el = document.createElement('div');
      el.className = 'sea-label';
      el.textContent = it.t;
      dom.app.appendChild(el);
      seaLabelEls.push({ el, x: geoX(it.c[0]), z: geoZ(it.c[1]), y: OCEAN_Y + 0.1 });
    }
  }

  function projectPoint(x, y, z) {
    const v = new Vector3(x, y, z);
    const dir = v.clone().sub(camera.position);
    camera.getWorldDirection(tmpDir);
    if (dir.dot(tmpDir) <= 0) return null;
    v.project(camera);
    if (v.z > 1 || v.z < -1) return null;
    return {
      x: (v.x * 0.5 + 0.5) * window.innerWidth,
      y: (-v.y * 0.5 + 0.5) * window.innerHeight,
      z: v.z
    };
  }
  const tmpDir = new Vector3();

  function updateLabels() {
    const show = state.layers.labels;
    if (!show) {
      for (const l of labelEls) if (l.el) l.el.style.opacity = '0';
      for (const s of seaLabelEls) s.el.style.opacity = '0';
      for (const c of capitalEls) if (c.el) c.el.style.opacity = '0';
      return;
    }

    const tlTop = window.innerHeight - parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--timeline-h') || '206') + 8;
    const occupied = [];

    const placePolity = (l) => {
      if (!l.el) return;
      const p = projectPoint(l.x, l.y, l.z);
      if (!p || p.y > tlTop || p.y < 58 || p.x < 4 || p.x > window.innerWidth - 4) {
        l.el.style.opacity = '0';
        return;
      }
      const box = { x: p.x - l.w / 2 - 4, y: p.y - l.h / 2 - 3, w: l.w + 8, h: l.h + 6 };
      for (const o of occupied) {
        if (box.x < o.x + o.w && box.x + box.w > o.x && box.y < o.y + o.h && box.y + box.h > o.y) {
          l.el.style.opacity = '0';
          return;
        }
      }
      occupied.push(box);
      l.el.style.transform = 'translate3d(' + p.x.toFixed(1) + 'px,' + p.y.toFixed(1) + 'px,0) translate(-50%,-50%)';
      l.el.style.opacity = '1';
    };

    const sorted = labelEls.slice().sort((a, b) => a.priority - b.priority);
    for (const l of sorted) if (l.priority === 1) placePolity(l);

    for (const c of capitalEls) {
      if (isMobile()) { c.el.style.opacity = '0'; continue; }
      const p = projectPoint(c.x, c.y, c.z);
      if (!p || p.y > tlTop || p.y < 50) { c.el.style.opacity = '0'; continue; }
      const box = { x: p.x - c.w / 2 - 3, y: p.y - c.h / 2 - 3, w: c.w + 6, h: c.h + 6 };
      let hit = false;
      for (const o of occupied) {
        if (box.x < o.x + o.w && box.x + box.w > o.x && box.y < o.y + o.h && box.y + box.h > o.y) { hit = true; break; }
      }
      if (hit) { c.el.style.opacity = '0'; continue; }
      occupied.push(box);
      c.el.style.transform = 'translate3d(' + p.x.toFixed(1) + 'px,' + p.y.toFixed(1) + 'px,0) translate(-50%,-50%)';
      c.el.style.opacity = '1';
    }

    for (const l of sorted) if (l.priority !== 1) placePolity(l);

    for (const s of seaLabelEls) {
      const p = isMobile() ? null : projectPoint(s.x, s.y, s.z);
      if (!p || p.y > tlTop || p.x < 20 || p.x > window.innerWidth - 20) {
        s.el.style.opacity = '0';
        continue;
      }
      s.el.style.transform = 'translate3d(' + p.x.toFixed(1) + 'px,' + p.y.toFixed(1) + 'px,0) translate(-50%,-50%)';
      s.el.style.opacity = '1';
    }

  }

  /* ── capitals ──────────────────────────────────────────────── */
  function buildCapitals(dyn, polities) {
    while (capitalGroup.children.length) {
      const c = capitalGroup.children.pop();
      c.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    }
    capitalEls.forEach(x => { if (x.el) x.el.remove(); });
    capitalEls = [];
    const caps = CAPITALS[dyn.key] || [];
    for (const cap of caps) {
      const x = geoX(cap.c[0]);
      const z = geoZ(cap.c[1]);
      const g = new Group();
      g.position.set(x, BASE_Y, z);
      const h = 5.8;
      const stem = new Mesh(
        new CylinderGeometry(0.035, 0.035, h, 5),
        new MeshBasicMaterial({ color: 0xe7cc94, transparent: true, opacity: 0.55 })
      );
      stem.position.y = h / 2;
      g.add(stem);
      const head = new Mesh(
        new OctahedronGeometry(0.3, 0),
        new MeshBasicMaterial({ color: 0xffdf9e })
      );
      head.position.y = h;
      g.add(head);
      const ring = new Mesh(
        new RingGeometry(0.55, 0.68, 28),
        new MeshBasicMaterial({ color: 0xe7cc94, transparent: true, opacity: 0.45, side: DoubleSide, depthWrite: false })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.05;
      g.add(ring);
      g.userData = { head, ring, phase: Math.random() * Math.PI * 2 };
      capitalGroup.add(g);
      if (!isMobile()) {
        const el = document.createElement('div');
        el.className = 'capital-label';
        el.innerHTML = '<i></i>都城 · ' + esc(cap.n);
        dom.app.appendChild(el);
        capitalEls.push({ el, x, z, y: BASE_Y + h + 1.15, w: 78, h: 18 });
      }
    }
    void polities;
  }

  /* ── info / timeline ui ────────────────────────────────────── */
  function applyEra(dyn) {
    const idx = state.dynIndex;
    dom.eraIndex.textContent = 'CHAPTER ' + pad2(idx + 1) + ' / ' + pad2(N_ERAS);
    dom.eraEn.textContent = ERA_EN[dyn.key] || '';
    dom.eraTitle.textContent = dyn.title;
    dom.eraTitle.classList.toggle('long', dyn.title.length > 4);
    dom.eraTitle.classList.toggle('xlong', dyn.title.length > 6);
    dom.eraBadge.textContent = dyn.badge || '';
    dom.eraYears.textContent = fmtSpan(dyn.from, dyn.to);
    dom.eraSummary.textContent = trimSummary(cleanText(dyn.summary));
    dom.metaCapital.textContent = dyn.key === 'zhanguo'
      ? '洛阳 · 咸阳'
      : ((CAPITALS[dyn.key] || []).map(c => c.n).join(' · ') || dyn.seat || '—');
    dom.tlEra.textContent = BAND_NAME[dyn.key] || dyn.title;
    dom.tlEn.textContent = ERA_EN[dyn.key] || '';
    document.documentElement.style.setProperty('--era-tint', dyn.tint || '#c9a66a');
  }

  function trimSummary(s) {
    if (!s) return '';
    if (s.length <= 230) return s;
    const cut = s.slice(0, 230);
    const stop = Math.max(cut.lastIndexOf('。'), cut.lastIndexOf('；'));
    return (stop > 120 ? cut.slice(0, stop + 1) : cut + '…');
  }

  function updatePhaseUi(dyn, ph) {
    const full = cleanText(ph.caption);
    dom.phaseCaption.textContent = full;
    dom.tlPhase.textContent = phaseShort(ph) || full;
    void dyn;
  }

  function updateEvents(dyn) {
    const events = (dyn.milestones || [])
      .filter(m => m.y <= state.year)
      .sort((a, b) => a.y - b.y)
      .slice(-3)
      .reverse();
    dom.eventYear.textContent = fmtShort(state.year);
    if (!events.length) {
      dom.eventList.innerHTML = '<li class="placeholder"><span>此期尚无纪事</span></li>';
      return;
    }
    dom.eventList.innerHTML = events.map(m =>
      '<li><b>' + esc(fmtShort(m.y)) + '</b><span>' + esc(m.t) + '</span></li>'
    ).join('');
  }

  function updateYearUi() {
    dom.tlYear.textContent = fmtYear(state.year);
    dom.phBubble.textContent = fmtShort(state.year);
    dom.track.setAttribute('aria-valuenow', String(state.year));
    dom.track.setAttribute('aria-valuetext', fmtFull(state.year));
    const pct = yearToPct(state.year);
    dom.playhead.style.left = pct.toFixed(4) + '%';
    dom.playhead.style.transform = '';
    dom.phBubble.style.transform = pct > 94
      ? 'translate(-88%,-100%)'
      : pct < 6
        ? 'translate(-12%,-100%)'
        : 'translate(-50%,-100%)';
    for (const b of dom.trackBands.children) {
      b.classList.toggle('active', Number(b.dataset.index) === state.dynIndex);
    }
  }

  function selectYear(rawYear, options) {
    options = options || {};
    const year = clamp(Math.round(rawYear), START_YEAR, END_YEAR);
    const di = findDynastyIndex(year);
    const dyn = D.dynasties[di];
    const pi = findPhaseIndex(dyn, year);
    const ph = dyn.phases[pi];
    const eraChanged = di !== state.dynIndex;
    const phaseChanged = eraChanged || pi !== state.phaseIndex || !state.phase;

    state.year = year;
    state.dynIndex = di;
    state.phaseIndex = pi;
    state.phase = ph;

    if (eraChanged) {
      applyEra(dyn);
      if (builtOnce) flashInfo();
    }
    if (phaseChanged) {
      updatePhaseUi(dyn, ph);
      if (options.immediate) buildPhase();
      else if (state.draggingTrack) {
        clearTimeout(dragBuildTimer);
        dragBuildTimer = setTimeout(() => {
          if (!state.draggingTrack) requestPhaseBuild();
        }, 170);
      } else requestPhaseBuild();
    }
    updateEvents(dyn);
    updateYearUi();
  }

  function flashInfo() {
    dom.info.style.animation = 'none';
    void dom.info.offsetWidth;
    dom.info.style.animation = '';
  }

  function buildTimeline() {
    dom.trackBands.innerHTML = '';
    dom.trackTicks.innerHTML = '';
    dom.trackEvents.innerHTML = '';
    const totalSpan = END_YEAR - START_YEAR;

    D.dynasties.forEach((d, i) => {
      let left, width;
      if (state.scaleMode === 'era') {
        left = (i / N_ERAS) * 100;
        width = (1 / N_ERAS) * 100;
      } else {
        left = ((d.from - START_YEAR) / totalSpan) * 100;
        width = ((d.to - d.from) / totalSpan) * 100;
      }
      const band = document.createElement('div');
      band.className = 'era-band';
      if (width < 3.6) band.classList.add('narrow');
      if (width < 1.7) band.classList.add('tiny');
      band.dataset.index = i;
      band.style.left = left.toFixed(4) + '%';
      band.style.width = Math.max(0.35, width).toFixed(4) + '%';
      band.title = d.title + ' · ' + fmtSpan(d.from, d.to);
      band.innerHTML = '<span class="era-band-name">' + esc(BAND_NAME[d.key] || d.title) + '</span>';
      dom.trackBands.appendChild(band);

      for (const ph of d.phases) {
        const tick = document.createElement('i');
        tick.className = 'phase-tick';
        tick.style.left = yearToPct(ph.start).toFixed(4) + '%';
        dom.trackTicks.appendChild(tick);
      }
      for (const m of d.milestones || []) {
        if (!m.m) continue;
        const mark = document.createElement('i');
        mark.className = 'event-mark major';
        mark.style.left = yearToPct(m.y).toFixed(4) + '%';
        mark.title = fmtShort(m.y) + ' · ' + m.t;
        dom.trackEvents.appendChild(mark);
      }
    });
    dom.footMid.textContent = (END_YEAR - START_YEAR) + ' 年 · ' + N_ERAS + ' 个时期 · ' + TOTAL_PHASES + ' 幅疆域';
    updateYearUi();
  }

  function bindTimeline() {
    const setFromClientX = clientX => {
      const r = dom.track.getBoundingClientRect();
      const pct = clamp(((clientX - r.left) / r.width) * 100, 0, 100);
      selectYear(pctToYear(pct));
    };

    dom.track.addEventListener('pointerdown', e => {
      if (e.button !== undefined && e.button !== 0) return;
      stopPlay();
      state.draggingTrack = true;
      dom.track.classList.add('dragging');
      if (dom.track.setPointerCapture) dom.track.setPointerCapture(e.pointerId);
      setFromClientX(e.clientX);
      hideHint();
      e.preventDefault();
    });
    dom.track.addEventListener('pointermove', e => {
      if (state.draggingTrack) { setFromClientX(e.clientX); return; }
      if (e.pointerType === 'touch') return;
      const r = dom.track.getBoundingClientRect();
      const pct = clamp(((e.clientX - r.left) / r.width) * 100, 0, 100);
      dom.trackHover.hidden = false;
      dom.trackHover.style.left = pct.toFixed(3) + '%';
      let span = dom.trackHover.querySelector('span');
      if (!span) { span = document.createElement('span'); dom.trackHover.appendChild(span); }
      span.textContent = fmtShort(pctToYear(pct)) + ' 年';
    });
    const end = e => {
      if (!state.draggingTrack) return;
      state.draggingTrack = false;
      dom.track.classList.remove('dragging');
      clearTimeout(dragBuildTimer);
      requestPhaseBuild();
      try { dom.track.releasePointerCapture(e.pointerId); } catch (_) {}
    };
    dom.track.addEventListener('pointerup', end);
    dom.track.addEventListener('pointercancel', end);
    dom.track.addEventListener('pointerleave', () => {
      if (!state.draggingTrack) dom.trackHover.hidden = true;
    });

    dom.track.addEventListener('keydown', e => {
      let handled = true;
      if (e.key === 'ArrowLeft') stepYear(e.shiftKey ? -10 : -1);
      else if (e.key === 'ArrowRight') stepYear(e.shiftKey ? 10 : 1);
      else if (e.key === 'Home') selectYear(START_YEAR);
      else if (e.key === 'End') selectYear(END_YEAR);
      else handled = false;
      if (handled) e.preventDefault();
    });

    $$('.scale-switch button').forEach(btn => {
      btn.addEventListener('click', () => {
        state.scaleMode = btn.dataset.scale;
        $$('.scale-switch button').forEach(b => b.classList.toggle('active', b === btn));
        buildTimeline();
        state.playPct = yearToPct(state.year);
        if (state.playing) state.playPct = yearToPct(state.year);
        toast(state.scaleMode === 'era' ? '时间轴 · 朝代等宽' : '时间轴 · 年代比例');
      });
    });

    dom.play.addEventListener('click', togglePlay);
    dom.prev.addEventListener('click', () => { stopPlay(); stepYear(-1); });
    dom.next.addEventListener('click', () => { stopPlay(); stepYear(1); });
  }

  function stepYear(delta) {
    stopPlay();
    selectYear(state.year + delta);
    hideHint();
  }

  /* ── playback ──────────────────────────────────────────────── */
  function togglePlay() {
    if (state.playing) stopPlay();
    else startPlay();
  }
  function startPlay() {
    if (state.year >= END_YEAR) selectYear(START_YEAR);
    state.playing = true;
    state.playPct = yearToPct(state.year);
    dom.play.classList.add('playing');
    dom.play.setAttribute('aria-label', '暂停历史演进');
    hideHint();
  }
  function stopPlay() {
    if (!state.playing) return;
    state.playing = false;
    dom.play.classList.remove('playing');
    dom.play.setAttribute('aria-label', '播放历史演进');
  }

  /* ── layers / UI ───────────────────────────────────────────── */
  function setLayer(name, on) {
    state.layers[name] = on;
    if (name === 'neighbors') {
      requestPhaseBuild(true);
    } else if (name === 'rivers') {
      riverGroup.visible = on; lakeGroup.visible = on;
    } else if (name === 'modern') {
      modernGroup.visible = on;
    } else if (name === 'grid') {
      gridGroup.visible = on;
    } else if (name === 'labels') {
      if (!on) buildLabels([]);
      else if (state.phase) buildPhase();
    } else if (name === 'tdt') {
      if (on) loadTdtBase();
      else {
        const credit = document.querySelector('#tdt-credit');
        if (credit) credit.hidden = true;
        applyBaseMap();
      }
    } else if (name === 'shadow') {
      renderer.shadowMap.enabled = on;
      if (keyLight) keyLight.castShadow = on;
      polityLayer.traverse(o => { if (o.isMesh) { const arr = Array.isArray(o.material) ? o.material : [o.material]; arr.forEach(m => { m.needsUpdate = true; }); } });
    }
    saveLayers();
  }

  function saveLayers() {
    try { localStorage.setItem('shanhe3d.layers', JSON.stringify(state.layers)); } catch (_) {}
  }
  function loadLayers() {
    try {
      const raw = localStorage.getItem('shanhe3d.layers');
      if (!raw) return;
      const saved = JSON.parse(raw);
      for (const k of Object.keys(state.layers)) {
        if (typeof saved[k] === 'boolean') state.layers[k] = saved[k];
      }
    } catch (_) {}
  }

  function bindUI() {
    loadLayers();
    $$('.layers-pop input[data-layer]').forEach(cb => {
      const name = cb.dataset.layer;
      cb.checked = !!state.layers[name];
      cb.addEventListener('change', () => setLayer(name, cb.checked));
    });
    if (!state.layers.neighbors) {
      // first build should still render; rebuilding with the saved state is handled on first select
    }

    dom.layersBtn.addEventListener('click', e => {
      e.stopPropagation();
      const open = dom.layersPop.hidden;
      dom.layersPop.hidden = !open;
      dom.layersBtn.setAttribute('aria-expanded', String(open));
      dom.layersBtn.classList.toggle('active', open);
    });
    document.addEventListener('pointerdown', e => {
      if (dom.layersPop.hidden) return;
      if (dom.layersPop.contains(e.target) || dom.layersBtn.contains(e.target)) return;
      dom.layersPop.hidden = true;
      dom.layersBtn.setAttribute('aria-expanded', 'false');
      dom.layersBtn.classList.remove('active');
    });

    dom.rotate.addEventListener('click', () => setAutoRotate(!state.autoRotate));
    dom.reset.addEventListener('click', resetView);
    dom.aboutBtn.addEventListener('click', openModal);
    dom.modalClose.addEventListener('click', closeModal);
    dom.modalStart.addEventListener('click', closeModal);
    dom.modal.addEventListener('click', e => { if (e.target === dom.modal) closeModal(); });

    window.addEventListener('keydown', e => {
      if (!dom.modal.hidden) {
        if (e.key === 'Escape') closeModal();
        return;
      }
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (e.key === ' ' && e.target && e.target.closest && e.target.closest('button')) return;
      if (e.target === dom.track && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
      if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); togglePlay(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); stepYear(e.shiftKey ? -10 : -1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); stepYear(e.shiftKey ? 10 : 1); }
      else if (e.key === 'Home') { e.preventDefault(); stopPlay(); selectYear(START_YEAR); }
      else if (e.key === 'End') { e.preventDefault(); stopPlay(); selectYear(END_YEAR); }
      else if (e.key === 'Escape') {
        dom.layersPop.hidden = true;
        dom.layersBtn.classList.remove('active');
        hideTip();
      } else if (e.key === '+' || e.key === '=') { e.preventDefault(); cam.want.radius = clamp(cam.want.radius * 0.86, 48, 310); }
      else if (e.key === '-' || e.key === '_') { e.preventDefault(); cam.want.radius = clamp(cam.want.radius * 1.16, 48, 310); }
      else if (e.key === '0') { e.preventDefault(); resetView(); }
      else if (e.key === 'r' || e.key === 'R') { setAutoRotate(!state.autoRotate); }
    });

    let resizeTimer = 0;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const w = window.innerWidth, h = window.innerHeight;
        renderer.setSize(w, h, false);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, w < 640 ? 1.6 : 2));
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        const prevMode = state.layoutMode;
        layoutCamera(false);
        if (prevMode !== state.layoutMode) requestPhaseBuild(true);
        labelsDirty = true;
      }, 120);
    });
  }

  function setAutoRotate(on) {
    state.autoRotate = on;
    dom.rotate.classList.toggle('active', on);
    toast(on ? '自动旋转 · 开' : '自动旋转 · 关');
  }

  function openModal() {
    dom.modal.hidden = false;
    stopPlay();
  }
  function closeModal() {
    dom.modal.hidden = true;
  }

  function resetView() {
    if (state.autoRotate) setAutoRotate(false);
    const base = baseViewForWindow();
    cam.want.theta = base.theta;
    cam.want.phi = base.phi;
    cam.want.radius = base.radius;
    cam.want.target.copy(base.target);
    toast('视角已复位');
  }

  function baseViewForWindow() {
    if (isMobile()) {
      return { theta: 0.24, phi: 0.5, radius: 235, target: new Vector3(-1, -12, 2) };
    }
    if (isTablet()) {
      return { theta: 0.3, phi: 0.63, radius: 168, target: new Vector3(-5, -12, 1.5) };
    }
    return { theta: 0.33, phi: 0.58, radius: 145, target: new Vector3(-8, -11, 0.5) };
  }

  function layoutCamera(initial) {
    const mode = isMobile() ? 'mobile' : isTablet() ? 'tablet' : 'desktop';
    const base = baseViewForWindow();
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.fov = isMobile() ? 42 : isTablet() ? 37 : 35;
    camera.updateProjectionMatrix();
    if (initial) {
      cam.want.theta = base.theta;
      cam.want.phi = base.phi;
      cam.want.radius = base.radius;
      cam.want.target.copy(base.target);
      if (reduceMotion() || isMobile()) {
        cam.cur.theta = base.theta; cam.cur.phi = base.phi; cam.cur.radius = base.radius; cam.cur.target.copy(base.target);
      } else {
        cam.cur.theta = base.theta + 0.3;
        cam.cur.phi = base.phi + 0.12;
        cam.cur.radius = base.radius * 1.45;
        cam.cur.target.set(base.target.x + 2, base.target.y - 1, base.target.z + 2);
      }
    } else if (mode !== state.layoutMode) {
      cam.want.theta = base.theta;
      cam.want.phi = base.phi;
      cam.want.radius = base.radius;
      cam.want.target.copy(base.target);
    }
    state.layoutMode = mode;
  }

  function hideHint() {
    if (state.hintGone) return;
    state.hintGone = true;
    dom.hintPill.classList.add('gone');
  }

  function toast(msg) {
    dom.toast.textContent = msg;
    dom.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => dom.toast.classList.remove('show'), 1700);
  }

  function showTip(html, x, y) {
    dom.tip.innerHTML = html;
    const px = Math.min(x + 16, window.innerWidth - 220);
    const py = Math.min(y + 18, window.innerHeight - 95);
    dom.tip.style.transform = 'translate3d(' + Math.max(8, px) + 'px,' + Math.max(8, py) + 'px,0)';
    dom.tip.classList.add('show');
  }
  function hideTip() {
    dom.tip.classList.remove('show');
  }

  function hoverMesh(mesh, clientX, clientY) {
    if (state.hoverMesh === mesh) {
      if (mesh && clientX != null) {
        const p = mesh.userData.polity;
        showTip('<b>' + esc(p.name) + '</b><span>' + esc(ROLE_LABEL[p.role] || '') + '</span>', clientX, clientY);
      }
      return;
    }
    clearHover();
    if (!mesh) return;
    state.hoverMesh = mesh;
    const mats = mesh.userData.materials || [];
    for (const m of mats) {
      if (!m.emissive) continue;
      m.userData.origEmissive = m.userData.origEmissive || m.emissive.getHex();
      m.userData.origIntensity = m.userData.origIntensity == null ? m.emissiveIntensity : m.userData.origIntensity;
      m.emissive.setHex(0xc9a66a);
      m.emissiveIntensity = 0.58;
    }
    const p = mesh.userData.polity;
    if (clientX != null) {
      showTip('<b>' + esc(p.name) + '</b><span>' + esc(ROLE_LABEL[p.role] || '') + ' · 点击聚焦</span>', clientX, clientY);
    }
  }

  function clearHover() {
    if (!state.hoverMesh) return;
    const mats = state.hoverMesh.userData.materials || [];
    for (const m of mats) {
      if (!m.emissive) continue;
      if (m.userData.origEmissive != null) m.emissive.setHex(m.userData.origEmissive);
      if (m.userData.origIntensity != null) m.emissiveIntensity = m.userData.origIntensity;
    }
    state.hoverMesh = null;
    hideTip();
  }

  /* ── scene interaction ─────────────────────────────────────── */
  function bindSceneInteraction() {
    const canvas = dom.canvas;

    canvas.addEventListener('contextmenu', e => e.preventDefault());

    canvas.addEventListener('pointerdown', e => {
      if (e.button !== undefined && e.button !== 0 && e.button !== 2) return;
      touchPoints.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touchPoints.size === 2) {
        const pts = Array.from(touchPoints.values());
        pointerDown = null;
        pinch = {
          dist: Math.max(1, Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)),
          cx: (pts[0].x + pts[1].x) / 2,
          cy: (pts[0].y + pts[1].y) / 2,
          radius: cam.want.radius,
          target: cam.want.target.clone()
        };
        canvas.classList.add('dragging');
        e.preventDefault();
        return;
      }
      const mode = (e.button === 2 || e.shiftKey) ? 'pan' : 'orbit';
      pointerDown = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        mode,
        moved: false,
        theta: cam.want.theta,
        phi: cam.want.phi,
        target: cam.want.target.clone()
      };
      canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
      canvas.classList.add('dragging');
      if (state.autoRotate) setAutoRotate(false);
      hideHint();
      e.preventDefault();
    });

    canvas.addEventListener('pointermove', e => {
      if (touchPoints.has(e.pointerId)) touchPoints.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && touchPoints.size >= 2) {
        const pts = Array.from(touchPoints.values()).slice(0, 2);
        const dist = Math.max(1, Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y));
        cam.want.radius = clamp(pinch.radius * pinch.dist / dist, 48, 310);
        const cx = (pts[0].x + pts[1].x) / 2;
        const cy = (pts[0].y + pts[1].y) / 2;
        const dx = cx - pinch.cx, dy = cy - pinch.cy;
        const k = cam.want.radius * 0.0011;
        const th = cam.want.theta;
        cam.want.target.x = clamp(pinch.target.x - Math.cos(th) * dx * k - Math.sin(th) * dy * k, -18, 18);
        cam.want.target.z = clamp(pinch.target.z + Math.sin(th) * dx * k - Math.cos(th) * dy * k, -14, 14);
        hideTip();
        e.preventDefault();
        return;
      }
      if (pointerDown) {
        const dx = e.clientX - pointerDown.x;
        const dy = e.clientY - pointerDown.y;
        if (!pointerDown.moved && Math.hypot(dx, dy) < 3) return;
        pointerDown.moved = true;
        hideTip();
        clearHover();
        if (pointerDown.mode === 'orbit') {
          cam.want.theta = pointerDown.theta - dx * 0.0042;
          cam.want.phi = clamp(pointerDown.phi - dy * 0.0034, 0.26, 1.12);
        } else {
          const k = cam.want.radius * 0.00155;
          const th = pointerDown.theta;
          const tx = pointerDown.target.x - Math.cos(th) * dx * k - Math.sin(th) * dy * k;
          const tz = pointerDown.target.z + Math.sin(th) * dx * k - Math.cos(th) * dy * k;
          cam.want.target.x = clamp(tx, -18, 18);
          cam.want.target.z = clamp(tz, -14, 14);
        }
        return;
      }
      if (e.pointerType === 'touch') return;
      const now = performance.now();
      if (now - lastRayTs < 40) return;
      lastRayTs = now;
      const hit = pickPolity(e.clientX, e.clientY);
      hoverMesh(hit, e.clientX, e.clientY);
      canvas.classList.toggle('pointing', !!hit);
    });

    const end = e => {
      touchPoints.delete(e.pointerId);
      if (pinch) {
        const wasPinching = touchPoints.size < 2;
        if (wasPinching) {
          pinch = null;
          pointerDown = null;
          canvas.classList.remove('dragging');
          try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
          return;
        }
      }
      if (!pointerDown) return;
      const wasDrag = pointerDown.moved;
      const mode = pointerDown.mode;
      pointerDown = null;
      canvas.classList.remove('dragging');
      try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
      if (!wasDrag && mode === 'orbit') {
        const hit = pickPolity(e.clientX, e.clientY);
        if (hit) focusPolity(hit);
        else { clearHover(); hideTip(); }
      }
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', e => {
      touchPoints.delete(e.pointerId);
      pinch = null;
      pointerDown = null;
      canvas.classList.remove('dragging');
    });
    canvas.addEventListener('pointerleave', () => {
      if (!pointerDown) { clearHover(); hideTip(); }
    });

    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const factor = Math.exp(e.deltaY * 0.00125);
      cam.want.radius = clamp(cam.want.radius * factor, 48, 310);
      hideHint();
    }, { passive: false });
  }

  function pickPolity(clientX, clientY) {
    if (!activeGroup) return null;
    const rect = dom.canvas.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(activeGroup.children, false);
    for (const h of hits) {
      if (h.object && h.object.userData && h.object.userData.polity) return h.object;
    }
    return null;
  }

  function focusPolity(mesh) {
    const p = mesh.userData.polity;
    if (!p || !p.anchor) return;
    cam.want.target.x = clamp(geoX(p.anchor[0]), -16, 16);
    cam.want.target.z = clamp(geoZ(p.anchor[1]), -12, 12);
    cam.want.radius = clamp(cam.want.radius * 0.78, 52, 190);
    toast('聚焦 · ' + p.name + ' · ' + (ROLE_LABEL[p.role] || ''));
    hoverMesh(mesh);
  }

  /* ── compass / labels update ───────────────────────────────── */
  function updateCompass() {
    const a = projectPoint(0, 0, 0);
    const b = projectPoint(0, 0, -12);
    if (!a || !b) return;
    const angle = Math.atan2(b.x - a.x, -(b.y - a.y));
    dom.compassNeedle.style.transform = 'translate(-50%,-100%) rotate(' + angle.toFixed(3) + 'rad)';
  }

  /* ── render loop ───────────────────────────────────────────── */
  function animate(now) {
    if (!clockLast) clockLast = now;
    const dt = Math.min(0.05, (now - clockLast) / 1000) || 0.016;
    clockLast = now;

    if (state.autoRotate) cam.want.theta += dt * 0.075;

    const k = 1 - Math.exp(-dt * 5.2);
    cam.cur.theta = damp(cam.cur.theta, cam.want.theta, k);
    cam.cur.phi = damp(cam.cur.phi, cam.want.phi, k);
    cam.cur.radius = damp(cam.cur.radius, cam.want.radius, k);
    cam.cur.target.x = damp(cam.cur.target.x, cam.want.target.x, k);
    cam.cur.target.y = damp(cam.cur.target.y, cam.want.target.y, k);
    cam.cur.target.z = damp(cam.cur.target.z, cam.want.target.z, k);

    const r = cam.cur.radius;
    const sp = Math.sin(cam.cur.phi), cp = Math.cos(cam.cur.phi);
    camera.position.set(
      cam.cur.target.x + r * sp * Math.sin(cam.cur.theta),
      cam.cur.target.y + r * cp,
      cam.cur.target.z + r * sp * Math.cos(cam.cur.theta)
    );
    camera.lookAt(cam.cur.target);
    camera.updateMatrixWorld();

    if (state.playing) {
      const speed = 100 / 100;
      state.playPct = Math.min(100, state.playPct + dt * speed);
      const y = pctToYear(state.playPct);
      if (y !== state.year) selectYear(y);
      else updateYearUi();
      if (state.playPct >= 100) {
        stopPlay();
        selectYear(END_YEAR);
      }
    }

    // geometry rise / fade
    for (const g of [activeGroup].concat(fadingGroups)) {
      if (!g) continue;
      const isFading = fadingGroups.includes(g);
      const t = (now - (g.userData.fadeStart || g.userData.start || now)) / (isFading ? 330 : 620);
      if (isFading) {
        const p = clamp(t, 0, 1);
        setGroupOpacity(g, 1 - p);
        for (const m of g.children) m.scale.y = 1 - p * 0.45;
        if (p >= 1 && fadingGroups.includes(g)) {
          fadingGroups.splice(fadingGroups.indexOf(g), 1);
          finalizeGroup(g);
        }
      } else {
        for (const m of g.children) {
          const delay = m.userData.riseDelay || 0;
          const local = clamp((now - g.userData.start - delay) / 520, 0, 1);
          const e = 1 - Math.pow(1 - local, 4);
          m.scale.y = 0.015 + (1 - 0.015) * e;
        }
      }
    }

    // capital pulse
    const tt = now * 0.001;
    for (const c of capitalGroup.children) {
      if (!c.userData || !c.userData.ring) continue;
      const ph = tt * 1.6 + c.userData.phase;
      c.userData.ring.scale.setScalar(1 + 0.18 * Math.sin(ph));
      c.userData.ring.material.opacity = 0.28 + 0.2 * (0.5 + 0.5 * Math.sin(ph));
      c.userData.head.rotation.y += dt * 0.7;
    }

    renderer.render(scene, camera);
    updateLabels();
    updateCompass();

    requestAnimationFrame(animate);
  }

  /* ── start ─────────────────────────────────────────────────── */
  buildSeaLabels();
  boot();
})();

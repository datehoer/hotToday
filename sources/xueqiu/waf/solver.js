// 雪球 aliyunwaf 挑战求解器：在 jsdom 里跑挑战脚本，产出带 md5__1038 签名的 URL。
//
// 用法: WAF_DIR=<含 page.html + ext_*.js 的目录> WAF_URL=<目标URL> node solver.js
// 输出: 一行 JSON {"url": "...", "ok": true}  或  {"ok": false, "error": "..."}
//
// 说明：挑战脚本是雪球自己的公开前端代码，这里只是把它放到无头环境里跑一遍，
// 由脚本自己算出签名，不涉及破解任何加密。
const fs = require('fs');
const path = require('path');

const DIR = process.env.WAF_DIR;
const TARGET = process.env.WAF_URL;
const UA = process.env.WAF_UA ||
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36';
const WAIT_MS = Number(process.env.WAF_WAIT_MS || 10000);

function fail(error) {
  console.log(JSON.stringify({ ok: false, error: String(error).slice(0, 400) }));
  process.exit(0);
}

if (!DIR || !TARGET) fail('缺少 WAF_DIR / WAF_URL');
for (const f of ['page.html']) {
  if (!fs.existsSync(path.join(DIR, f))) fail('缺少 ' + f);
}

const whatwgURL = require('whatwg-url');
let { JSDOM, VirtualConsole } = require('jsdom');

// jsdom 把跨文档跳转实现成了 not-implemented，navigate() 是唯一能拿到目标 URL 的入口。
// 这里通过 patch-jsdom.js 在 navigate 里插了 global.__wafNav 钩子。
global.__wafNav = (window, newURL) => {
  try { hits.push(whatwgURL.serializeURL(newURL)); } catch (e) {}
};

const hits = [];
const problems = [];

let html = fs.readFileSync(path.join(DIR, 'page.html'), 'utf8');

// 外链脚本路径每轮随机，抓下来内联进去（jsdom 默认不加载外部资源）
const srcs = [...html.matchAll(/<script[^>]*\bsrc="([^"]+)"[^>]*>/gi)];
srcs.forEach((m, i) => {
  const file = path.join(DIR, `ext_${i}.js`);
  if (!fs.existsSync(file)) { problems.push('缺少外链脚本 ' + m[1]); return; }
  const code = fs.readFileSync(file, 'utf8').replace(/<\/script>/gi, '<\\/script>');
  html = html.replace(m[0], `<script>${code}</script>`);
});

const vc = new VirtualConsole();
vc.on('jsdomError', (e) => {
  const msg = String((e && e.message) || e);
  if (!/Not implemented/.test(msg)) problems.push(msg.slice(0, 200));
});
vc.on('error', (...a) => problems.push('console.error: ' + String(a[0]).slice(0, 160)));

// 2d canvas 桩：挑战脚本会拿 canvas 做指纹，jsdom 没实现，给它一组确定性的返回值
function makeCtx2d() {
  const noop = () => {};
  const ctx = {
    canvas: { width: 300, height: 150, toDataURL: () => 'data:image/png;base64,iVBORw0KGgo=' },
    fillText: noop, strokeText: noop, fillRect: noop, clearRect: noop, strokeRect: noop,
    beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, arc: noop, rect: noop,
    fill: noop, stroke: noop, clip: noop, save: noop, restore: noop, scale: noop,
    translate: noop, rotate: noop, transform: noop, setTransform: noop, drawImage: noop,
    quadraticCurveTo: noop, bezierCurveTo: noop, arcTo: noop, ellipse: noop, setLineDash: noop,
    measureText: (t) => ({
      width: String(t || '').length * 7.5,
      actualBoundingBoxAscent: 7, actualBoundingBoxDescent: 2,
      actualBoundingBoxLeft: 0, actualBoundingBoxRight: String(t || '').length * 7.5,
    }),
    getImageData: (x, y, w, h) => ({
      data: new Uint8ClampedArray(Math.max(4, (w | 0) * (h | 0) * 4)),
      width: w | 0, height: h | 0,
    }),
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(Math.max(4, (w | 0) * (h | 0) * 4)) }),
    putImageData: noop,
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    createPattern: () => ({}),
    isPointInPath: () => false, isPointInStroke: () => false,
    textBaseline: 'alphabetic', textAlign: 'start', direction: 'ltr',
    font: '10px sans-serif', fillStyle: '#000', strokeStyle: '#000',
    globalAlpha: 1, globalCompositeOperation: 'source-over',
    lineWidth: 1, lineCap: 'butt', lineJoin: 'miter', miterLimit: 10,
    shadowBlur: 0, shadowColor: 'rgba(0, 0, 0, 0)', shadowOffsetX: 0, shadowOffsetY: 0,
    imageSmoothingEnabled: true, lineDashOffset: 0,
  };
  return ctx;
}

const dom = new JSDOM(html, {
  url: TARGET,                 // 必须是被挑战的那个 URL：签名里带路径
  referrer: 'https://xueqiu.com/',
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  virtualConsole: vc,
  beforeParse(window) {
    try {
      const sc = window.screen;
      for (const [k, v] of Object.entries({
        width: 1440, height: 900, availWidth: 1440, availHeight: 857,
        colorDepth: 24, pixelDepth: 24,
      })) Object.defineProperty(sc, k, { get: () => v, configurable: true });
    } catch (e) { problems.push('screen: ' + e.message); }

    const nav = window.navigator;
    for (const [k, v] of Object.entries({
      userAgent: UA, appVersion: UA.replace('Mozilla/', ''),
      language: 'zh-CN', languages: ['zh-CN', 'zh', 'en'],
      platform: 'MacIntel', vendor: 'Google Inc.', vendorSub: '',
      hardwareConcurrency: 8, deviceMemory: 8,
      maxTouchPoints: 0, webdriver: false, doNotTrack: null,
      productSub: '20030107', appName: 'Netscape', appCodeName: 'Mozilla',
      onLine: true,
    })) {
      try { Object.defineProperty(nav, k, { get: () => v, configurable: true }); } catch (e) {}
    }

    window.chrome = window.chrome || { runtime: {}, app: {}, csi: () => ({}), loadTimes: () => ({}) };
    window.outerWidth = 1440; window.outerHeight = 900;
    window.innerWidth = 1440; window.innerHeight = 780;
    window.devicePixelRatio = 1;

    const create = window.document.createElement.bind(window.document);
    window.document.createElement = function (tag, ...rest) {
      const el = create(tag, ...rest);
      if (String(tag).toLowerCase() === 'canvas') {
        try {
          el.getContext = (kind) => (String(kind).includes('2d') ? makeCtx2d() : null);
          el.toDataURL = () => 'data:image/png;base64,iVBORw0KGgo=';
        } catch (e) {}
      }
      return el;
    };
    window.HTMLCanvasElement.prototype.getContext = function (kind) {
      return String(kind).includes('2d') ? makeCtx2d() : null;
    };
    window.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,iVBORw0KGgo=';
  },
});

// 一抓到签名就返回，不要死等超时
const startedAt = Date.now();
const deadline = startedAt + WAIT_MS;
const timer = setInterval(() => {
  const signed = hits.filter((u) => /[?&]md5__\d+=/.test(u));
  if (signed.length) {
    clearInterval(timer);
    console.log(JSON.stringify({
      ok: true, url: signed[signed.length - 1], hits: hits.length, ms: Date.now() - startedAt,
    }));
    process.exit(0);
  }
  if (Date.now() > deadline) {
    clearInterval(timer);
    fail('没算出签名；捕获 ' + hits.length + ' 次跳转；问题: ' +
      problems.slice(0, 3).join(' | '));
  }
}, 60);

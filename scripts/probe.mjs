
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import WebSocket from 'ws';

const url = process.argv[2] || 'http://localhost:3000';
const width = Number(process.argv[3] || 390);
const height = Number(process.argv[4] || 844);
const out = process.argv[5] || '';
const scroll = Number(process.argv[6] || 0);
const port = 9400 + Math.floor(Math.random() * 400);
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

const proc = spawn(edge, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=' + port,
  '--user-data-dir=' + process.env.TEMP + '/edge-probe-' + port,
  '--window-size=' + width + ',' + height,
  'about:blank'
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getWs() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch('http://127.0.0.1:' + port + '/json/list');
      const list = await res.json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(200);
  }
  throw new Error('no devtools');
}

function auditExpr() {
  const vw = window.innerWidth;
  const doc = document.documentElement;
  const offenders = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const style = getComputedStyle(el);
    if (style.position === 'fixed') continue;
    if (r.right > vw + 2 || r.left < -2) {
      offenders.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.className && typeof el.className === 'string') ? el.className.slice(0, 120) : '',
        left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width),
        text: (el.textContent || '').trim().slice(0, 45),
      });
    }
  }
  offenders.sort((a, b) => b.right - a.right);
  return {
    vw,
    scrollWidth: doc.scrollWidth,
    offenders: offenders.slice(0, 25),
    bodyText: (document.body.innerText || '').slice(0, 120),
    lazyChunks: performance
      .getEntriesByType('resource')
      .map((r) => r.name.split('/').pop())
      .filter((n) => /firebase|CharacterWizard|SystemAndCloudPanel/i.test(n)),
  };
}

function seedChatExpr() {
  const key = 'jjk_cursed_chronicles_campaign_v1';
  const raw = localStorage.getItem(key);
  if (!raw) return false;
  const campaign = JSON.parse(raw);
  const base = campaign.turns[0];
  if (!base) return false;
  const now = new Date().toISOString();
  const second = {
    ...base,
    id: 'turn-2-seed',
    turnNumber: 2,
    timestamp: now,
    playerAction: {
      mode: 'DO',
      text: 'Avanço para o pátio, mantenho a katana baixa e os olhos no Dedo de Sukuna.',
      diceRoll: 17,
      revealedHandVow: true,
    },
    gmResponse: {
      ...base.gmResponse,
      narrative:
        '*Narrador*: Você desce os degraus de concreto sem tirar os olhos do fio de energia que atravessa o pátio. O ar fica mais denso a cada passo, e o zumbido do poste falha uma vez, duas, três.\n\n*Megumi Fushiguro*: Ele não se vira, mas as sombras sob os pés dele se adensam. "Boa. Mantenha essa distância. Se ela cortar o ar antes de você sentir, já era."\n\n*Narrador*: A maldição para de se contorcer. Quatro olhos se fixam em você ao mesmo tempo. O que você faz?',
    },
  };
  campaign.turns = [base, second];
  campaign.updatedAt = now;
  localStorage.setItem(key, JSON.stringify(campaign));
  location.reload();
  return true;
}

const wsUrl = await getWs();
const ws = new WebSocket(wsUrl);
await new Promise((r) => ws.on('open', r));
let id = 0;
const pending = new Map();
ws.on('message', (raw) => {
  const msg = JSON.parse(raw.toString());
  if (msg.id && pending.has(msg.id)) {
    const p = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) p.reject(new Error(msg.error.message));
    else p.resolve(msg.result);
  }
});
function send(method, params) {
  const mid = ++id;
  return new Promise((resolve, reject) => {
    pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params: params || {} }));
  });
}
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 768 });
await send('Page.navigate', { url });
await sleep(2800);
if (process.argv[6] === 'seedchat') {
  await send('Runtime.evaluate', {
    expression: '(' + seedChatExpr.toString() + ')()',
    returnByValue: true,
  });
  await sleep(2600);
} else if (process.argv[6] && process.argv[6].startsWith('click:')) {
  const sel = process.argv[6].slice(6).replace(/"/g, '');
  const clicked = await send('Runtime.evaluate', {
    expression: '(() => { const els = Array.from(document.querySelectorAll(' + JSON.stringify(sel) + ')); const el = els.find((e) => e.offsetParent !== null) || els[0]; if (el) el.click(); return Boolean(el); })()',
    returnByValue: true,
  });
  const dialogs = await send('Runtime.evaluate', { expression: 'document.querySelectorAll(\'[role="dialog"]\').length', returnByValue: true });
  console.log('clicked:' + clicked.result.value + ' dialogs:' + dialogs.result.value);
  await sleep(700);
} else if (process.argv[6] && process.argv[6].startsWith('sel:')) {
  const sel = process.argv[6].slice(4).replace(/"/g, '');
  await send('Runtime.evaluate', {
    expression: '(() => { const el = document.querySelector(' + JSON.stringify(sel) + '); if (el) el.scrollIntoView({ block: "center" }); return Boolean(el); })()',
    returnByValue: true,
  });
  await sleep(600);
} else if (scroll > 0) {
  await send('Runtime.evaluate', { expression: 'window.scrollTo(0,' + scroll + ')' });
  await sleep(500);
}
await send('Runtime.evaluate', {
  expression: "(() => { const b = document.querySelector('[aria-label=\"Dispensar aviso\"]'); if (b) b.click(); return Boolean(b); })()",
  returnByValue: true,
});
await sleep(300);
const expr = '(' + auditExpr.toString() + ')()';
const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
console.log(JSON.stringify(res.result.value, null, 2));
if (out) {
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(out, Buffer.from(shot.data, 'base64'));
  console.log('screenshot:' + out);
}
ws.close();
proc.kill();
process.exit(0);

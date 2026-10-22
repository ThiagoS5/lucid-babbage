/**
 * Verifica a sobreposição entre o texto do narrador (.chat-narrator) e a
 * linha de fala seguinte (.chat-message-row) no feed da crônica.
 *
 * Reproduz a regressão visual relatada: o atalho `margin` em .chat-narrator
 * zerava o margin-bottom e anulava o `space-y-4` da <section>, colando o
 * bubble da fala na última linha da narração.
 *
 * Uso: node scripts/verify-chat-overlap.mjs [url] [width] [height]
 */

import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import WebSocket from 'ws';

const url = process.argv[2] || 'http://localhost:3000/?autostart=1';
const width = Number(process.argv[3] || 390);
const height = Number(process.argv[4] || 844);
const out = process.argv[5] || '';
const port = 9800 + Math.floor(Math.random() * 150);
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

const proc = spawn(edge, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=' + port,
  '--user-data-dir=' + process.env.TEMP + '/edge-chat-overlap-' + port,
  '--window-size=' + width + ',' + height,
  'about:blank',
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

/** Mede o espaçamento real entre a última linha de tinta do narrador e a linha de fala seguinte. */
function measureExpr() {
  const results = [];
  document.querySelectorAll('.chat-narrator').forEach((narrator) => {
    const para = narrator.querySelector('.chat-narrator-text');
    const row = narrator.nextElementSibling;
    if (!para || !row) return;
    if (!row.classList.contains('chat-message-row')) return;

    const range = document.createRange();
    range.selectNodeContents(para);
    const rects = Array.from(range.getClientRects());
    if (!rects.length) return;
    const lastLine = rects[rects.length - 1];

    const bubble = row.querySelector('.chat-bubble').getBoundingClientRect();
    const avatar = row.querySelector('.chat-avatar').getBoundingClientRect();

    results.push({
      narratorMarginBottom: getComputedStyle(narrator).marginBottom,
      gapToBubble: Math.round(bubble.top - lastLine.bottom),
      gapToAvatar: Math.round(avatar.top - lastLine.bottom),
      bubbleOverlapsText:
        bubble.top < lastLine.bottom &&
        bubble.bottom > lastLine.top &&
        bubble.left < lastLine.right &&
        bubble.right > lastLine.left,
      avatarOverlapsText:
        avatar.top < lastLine.bottom &&
        avatar.bottom > lastLine.top &&
        avatar.left < lastLine.right &&
        avatar.right > lastLine.left,
    });
  });
  return results;
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
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width, height, deviceScaleFactor: 1, mobile: width < 768,
});
await send('Page.navigate', { url });

// A campanha de autostart é narrada pela IA: espera o feed populado.
let measurements = [];
for (let attempt = 0; attempt < 40; attempt++) {
  const res = await send('Runtime.evaluate', {
    expression: '(' + measureExpr.toString() + ')()',
    returnByValue: true,
  });
  measurements = res.result.value || [];
  if (measurements.length) break;
  await sleep(500);
}
console.log(JSON.stringify(measurements, null, 2));

// Sem par narrator->fala medido nao ha o que verificar: reprova para nao
// dar um falso verde quando o feed nao carrega.
if (!measurements.length) {
  console.error('FALHA: nenhuma fronteira narrator->fala foi medida (feed vazio?).');
  ws.close();
  proc.kill();
  process.exit(1);
}

const failures = measurements.filter(
  (m) => m.bubbleOverlapsText || m.avatarOverlapsText || m.gapToBubble < 8,
);
console.log(
  failures.length === 0
    ? 'OK: nenhum bubble/avatar sobrepoe a ultima linha do narrador.'
    : 'FALHA: ' + failures.length + ' sobreposicao(oes) entre narracao e fala.',
);

if (out) {
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(out, Buffer.from(shot.data, 'base64'));
  console.log('screenshot:' + out);
}

ws.close();
proc.kill();
process.exit(failures.length === 0 ? 0 : 1);

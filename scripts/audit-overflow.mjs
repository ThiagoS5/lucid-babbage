
import { spawn } from 'node:child_process';
import WebSocket from 'ws';

const url = process.argv[2] || 'http://localhost:3000';
const width = Number(process.argv[3] || 390);
const height = Number(process.argv[4] || 844);
const port = 9300 + Math.floor(Math.random() * 300);
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

const proc = spawn(edge, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=' + port,
  '--user-data-dir=' + process.env.TEMP + '/edge-audit-' + port,
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
  const all = document.querySelectorAll('body *');
  for (const el of all) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const style = getComputedStyle(el);
    if (style.position === 'fixed') continue;
    if (r.right > vw + 2 || r.left < -2) {
      offenders.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.className && typeof el.className === 'string') ? el.className.slice(0, 140) : '',
        left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width),
        text: (el.textContent || '').trim().slice(0, 50),
      });
    }
  }
  offenders.sort((a, b) => b.right - a.right);
  return {
    vw,
    scrollWidth: doc.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
    offenders: offenders.slice(0, 30),
  };
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
await send('Page.navigate', { url });
await sleep(2500);
const expr = '(' + auditExpr.toString() + ')()';
const out = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
console.log(JSON.stringify(out.result.value, null, 2));
ws.close();
proc.kill();
process.exit(0);

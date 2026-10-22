/**
 * Provedor OpenAI-compatível falso para verificacao end-to-end do servidor.
 * Sobe em http://127.0.0.1:8799/v1 e responde /chat/completions (com e sem stream).
 */
import http from 'node:http';

const NARRATIVE = [
  '*Narrador*: O patio noturno da Escola Tecnica Sugisawa cheira a cimento molhado e energia amaldicoada residual. As lampadas fluorescentes piscam em cima de uma figura agachada no chao.',
  '*Satoru Gojo*: Ele abaixa a venda preta, revelando o brilho azul dos Seis Olhos. "Ora, ora... parece que chegamos bem na hora da festa."',
  '*Narrador*: O ar pesa. O que voce faz?',
].join('\n\n');

const TURN_JSON = JSON.stringify({
  engineLog: '0. Teste de integracao com provedor externo.',
  activeStoryCards: ['Teste'],
  activeCardRuleSummary: 'Regra generica.',
  visualEffectTrigger: 'NONE',
  narrative: NARRATIVE,
  imagePrompt: 'test frame',
  isCombatScene: false,
  combatSceneImageQuestion: '',
  nanoBananaAnimePrompt: 'test',
  playerStateUpdate: { physicalCondition: 'Intacto' },
  worldStateUpdate: {
    location: 'Escola Tecnica Sugisawa',
    arc: 'Arco de Teste',
    activeBarrierOrDomain: 'Nenhum',
    npcsInScene: [],
  },
  suggestedActions: ['Avancar', 'Observar', 'Falar'],
});

const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
  });
  req.on('end', () => {
    const parsed = body ? JSON.parse(body) : {};
    const isStream = Boolean(parsed.stream);
    const userMsg = (parsed.messages || []).find((m) => m.role === 'user')?.content || '';
    const sysMsg = (parsed.messages || []).find((m) => m.role === 'system')?.content || '';
    console.log(
      `[mock-provider] ${req.method} ${req.url} stream=${isStream} auth=${Boolean(req.headers.authorization)} ` +
        `vozesCanonicas=${userMsg.includes('VOZES CANÔNICAS')} ` +
        `gojoNoGuia=${userMsg.includes('Satoru Gojo') && userMsg.includes('Dicção')} ` +
        `secaoFidelidade=${sysMsg.includes('FIDELIDADE DE VOZ DOS PERSONAGENS')} ` +
        `secaoAntiAmnesia=${sysMsg.includes('MEMÓRIA DE CENA')} ` +
        `formatoJson=${sysMsg.includes('FORMATO DE RESPOSTA')}`
    );

    if (isStream) {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      const chunks = TURN_JSON.match(/[\s\S]{1,120}/g) || [];
      for (const chunk of chunks) {
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: chunk } }] })}\n\n`);
      }
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ message: { content: TURN_JSON } }] }));
  });
});

server.listen(8799, '127.0.0.1', () => {
  console.log('[mock-provider] ouvindo em http://127.0.0.1:8799/v1');
});

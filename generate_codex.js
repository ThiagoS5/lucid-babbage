import fs from 'fs';
import { GoogleGenAI } from '@google/genai';

const API_KEY = process.env.GEMINI_API_KEY || 'AQ.Ab8RN6Le7THZtmObBBHHpIy1npk82UHY5ayyjP74A1xLILgcZQ';
const ai = new GoogleGenAI({ apiKey: API_KEY });

// Localiza o arquivo JSON
const jsonPath = fs.existsSync('./adventure-UhtU4tSbk-kc-story-cards-284.json')
  ? './adventure-UhtU4tSbk-kc-story-cards-284.json'
  : './json/adventure-UhtU4tSbk-kc-story-cards-284.json';

const rawData = fs.readFileSync(jsonPath, 'utf-8');
const cards = JSON.parse(rawData).filter(c => c.value && c.value.trim() !== '');

const OUTPUT_FILE = './JJK_Codex_Ultra_Completo.md';
const PROGRESS_FILE = './progress.json';
const BATCH_SIZE = 4; // 4 cards por lote para otimizar tempo e manter detalhamento máximo
const MODEL_NAME = 'gemini-3.5-flash-lite'; // Alta taxa de requisições por dia (RPD) no plano gratuito

// Cria o cabeçalho se o arquivo não existir
if (!fs.existsSync(OUTPUT_FILE)) {
  fs.writeFileSync(
    OUTPUT_FILE,
    '# CÓDICE DEFINITIVO E ENCICLOPÉDICO DE JUJUTSU KAISEN\n\nGerado automaticamente via API do Gemini.\n\n---',
    'utf-8'
  );
}

// Determina de onde recomeçar
let startIndex = 78; // 78 cards já estão gravados no arquivo
if (fs.existsSync(PROGRESS_FILE)) {
  try {
    const prog = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
    if (typeof prog.lastProcessedIndex === 'number') {
      startIndex = prog.lastProcessedIndex + 1;
    }
  } catch (e) {
    console.warn('Erro ao ler progress.json, iniciando do índice padrão:', startIndex);
  }
}

console.log(`\n======================================================`);
console.log(`[JJK CODEX] Total de cards válidos: ${cards.length}`);
console.log(`[JJK CODEX] Recomeçando a partir do índice: ${startIndex}`);
console.log(`[JJK CODEX] Cards restantes: ${cards.length - startIndex}`);
console.log(`[JJK CODEX] Modelo: ${MODEL_NAME} | Tamanho do lote: ${BATCH_SIZE}`);
console.log(`======================================================\n`);

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function gerarCodex() {
  for (let i = startIndex; i < cards.length; i += BATCH_SIZE) {
    const lote = cards.slice(i, i + BATCH_SIZE).map((c, idx) => ({
      numero: i + idx + 1,
      title: c.title,
      type: c.type,
      keys: c.keys,
      base_lore: c.value
    }));

    const prompt = `
Você é um especialista enciclopédico supremo no mangá e anime de Jujutsu Kaisen.
Abaixo estão ${lote.length} registros base extraídos de Story Cards de um cenário de RPG:
${JSON.stringify(lote, null, 2)}

Para CADA item acima, gere uma documentação EXTREMAMENTE DETALHADA, rica e imersiva em Markdown (em Português do Brasil), combinando o texto base com todo o conhecimento canônico do mangá e anime (abrangendo desde o início em Sendai quando Yuji Itadori engole o dedo de Sukuna até os arcos de Shibuya e Shinjuku).

Se o item for um PERSONAGEM ou ESPÍRITO AMALDIÇOADO, estruture obrigatoriamente com:
## [Personagem] Nome Completo (Grau e Afiliação)
- **Gatilhos (Keys):** ...
- **Aparência Física e Detalhes Visuais:** (Roupas, cicatrizes, marcas, postura e expressões).
- **Psicologia, Filosofia e Forma de Pensar:** (Motivações, visão sobre a vida, morte e maldições, traumas).
- **Como Age com Amigos e Aliados:** (Tom de voz, lealdade, interações e dinâmicas sociais).
- **Como Age com Inimigos e Desconhecidos:** (Postura em combate, sadismo ou frieza, provocações).
- **Maneirismos de Fala e Frases Típicas (Quotes):** (Frases icônicas canônicas e o tom de voz característico).
- **Estilo de Combate, Técnicas Amaldiçoadas e Arsenal:** (Mecânica exata, condições de ativação, Votos Vinculativos, Domínios e fraquezas).
- **Papel na Cronologia:** (Onde se encontra no início do anime com Yuji e sua evolução).

Se o item for uma TÉCNICA, SHIKIGAMI, FERRAMENTA, LOCAL ou ESTILO MARCIAL, detalhe profundamente:
## [Categoria] Nome do Item
- **Gatilhos (Keys):** ...
- Funcionamento mecânico exato, regras, usuários, pontos fortes/fracos e relevância narrativa na história de Jujutsu Kaisen.

Não economize palavras. Entregue o conteúdo mais denso e completo possível para cada registro.`;

    let sucesso = false;
    let tentativas = 0;
    const maxTentativas = 5;

    while (!sucesso && tentativas < maxTentativas) {
      tentativas++;
      const loteNumero = Math.floor(i / BATCH_SIZE) + 1;
      const totalLotes = Math.ceil(cards.length / BATCH_SIZE);
      const nomes = lote.map(x => x.title).join(', ');

      console.log(`[Lote ${loteNumero}/${totalLotes}] (Cards ${i + 1} a ${Math.min(i + BATCH_SIZE, cards.length)}: ${nomes}) - Tentativa ${tentativas}...`);

      try {
        const interaction = await ai.interactions.create({
          model: MODEL_NAME,
          input: prompt,
          generation_config: {
            max_output_tokens: 8192
          }
        });

        const textoGerado = interaction.output_text;

        if (!textoGerado || textoGerado.trim() === '') {
          throw new Error('A resposta gerada retornou vazia.');
        }

        // Anexa ao arquivo final
        fs.appendFileSync(OUTPUT_FILE, `\n\n${textoGerado}\n\n---`, 'utf-8');

        // Atualiza progresso
        const ultimoIndice = Math.min(i + BATCH_SIZE - 1, cards.length - 1);
        fs.writeFileSync(
          PROGRESS_FILE,
          JSON.stringify({
            lastProcessedIndex: ultimoIndice,
            totalCards: cards.length,
            lastUpdated: new Date().toISOString()
          }, null, 2),
          'utf-8'
        );

        console.log(`✓ Lote ${loteNumero} gravado com sucesso! (${textoGerado.length} caracteres gerados)`);
        sucesso = true;

        // Intervalo de segurança (6 segundos = 10 requisições/minuto, seguro para o limite de 15 RPM)
        await sleep(6000);
      } catch (err) {
        console.error(`✗ Erro no lote ${loteNumero} (tentativa ${tentativas}/${maxTentativas}):`, err.message);

        if (err.message && err.message.includes('429')) {
          const espera = 15000 * tentativas;
          console.log(`Aguardando ${espera / 1000}s devido ao limite de taxa (429)...`);
          await sleep(espera);
        } else {
          await sleep(5000);
        }
      }
    }

    if (!sucesso) {
      console.error(`Falha persistente no lote com cards a partir do índice ${i}. O progresso até ${i - 1} foi preservado.`);
      break;
    }
  }

  console.log('\n======================================================');
  console.log('Processo finalizado ou pausado. Verifique:', OUTPUT_FILE);
  console.log('======================================================\n');
}

gerarCodex();

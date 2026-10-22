import io
import pathlib

ROOT = pathlib.Path(r'C:\Users\Thiago\Documents\antigravity\lucid-babbage')
SERVER = ROOT / 'server.ts'
DEST = ROOT / 'src' / 'server' / 'promptBuilder.ts'

src = io.open(SERVER, encoding='utf-8').read()

def cut(text, start_marker, end_marker):
    assert text.count(start_marker) == 1, f'marcador ausente/duplicado: {start_marker!r}'
    s = text.index(start_marker)
    e = text.index(end_marker, s)
    return text[:s] + text[e:], text[s:e]

# Ordem importa: cada bloco termina exatamente onde o proximo comeca, entao
# extrai-se do inicio para o fim (A -> B -> C). Cortar B antes de A apagaria o
# marcador final de A.
src, block_a = cut(src, 'interface TurnPromptParams {', 'const JJK_RESPONSE_JSON_SCHEMA = {')
src, block_b = cut(src, 'const JJK_RESPONSE_JSON_SCHEMA = {', 'function getGeminiClient(')
src, block_c = cut(src, 'const SYSTEM_INSTRUCTION_GM = `', 'async function startServer(')

def exportify(block, markers):
    for m in markers:
        assert block.count(m) == 1, f'marcador ausente/duplicado no bloco: {m!r}'
        block = block.replace(m, 'export ' + m, 1)
    return block

block_a = exportify(block_a, [
    'interface TurnPromptParams {',
    'interface ArcContractWorld {',
    'function withoutKeys',
    'function renderArcContract',
    'function firstSceneLine',
    'function buildTurnPrompt',
    'function unescapeJsonString',
    'function extractNarrativeFromJson',
])
block_b = exportify(block_b, ['const JJK_RESPONSE_JSON_SCHEMA'])
block_c = exportify(block_c, ['const SYSTEM_INSTRUCTION_GM'])

header = (
    '/**\n'
    ' * Construcao de prompts e parse da resposta do Mestre — extraido de server.ts\n'
    ' * para ser testavel isoladamente.\n'
    ' */\n\n'
)

DEST.parent.mkdir(parents=True, exist_ok=True)
io.open(DEST, 'w', encoding='utf-8', newline='\n').write(
    header + block_a.rstrip() + '\n\n' + block_b.rstrip() + '\n\n' + block_c.rstrip() + '\n'
)

IMPORT = (
    "import {\n"
    "  SYSTEM_INSTRUCTION_GM,\n"
    "  JJK_RESPONSE_JSON_SCHEMA,\n"
    "  buildTurnPrompt,\n"
    "  extractNarrativeFromJson,\n"
    "  firstSceneLine,\n"
    "  type ArcContractWorld,\n"
    "} from './src/server/promptBuilder';\n"
)
ANCHOR = "} from './src/utils/storyCardEra';\n"
assert src.count(ANCHOR) == 1
src = src.replace(ANCHOR, ANCHOR + IMPORT, 1)
io.open(SERVER, 'w', encoding='utf-8', newline='\n').write(src)
print('OK: promptBuilder.ts criado; server.ts agora importa de src/server/promptBuilder.')

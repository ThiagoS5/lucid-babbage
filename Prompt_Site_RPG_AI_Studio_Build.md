# PROMPT DEFINITIVO PARA O GOOGLE AI STUDIO BUILD — JUJUTSU KAISEN: NARRATIVE RPG ENGINE

Copie todo o conteúdo abaixo da linha divisória e cole diretamente no **Google AI Studio Build** (ou ferramenta de geração de aplicações Full-Stack/Front-End com IA).

---

```markdown
# ESPECIFICAÇÃO COMPLETA DE ENGENHARIA E DESIGN: "JUJUTSU KAISEN — CURSED CHRONICLES NARRATIVE RPG"

> **REVISÃO ATUAL (2026-10-21):** este projeto é um **RPG narrativo**, não uma mesa de RPG virtual. Foram removidos atributos, perícias, HP, energia amaldiçoada medida, dados, níveis e XP. Onde este documento ainda descrever barras de HP/EA ou rolagem de d20, considere obsoleto: a IA decide, pela ficção, quando o personagem enfraquece, é ferido ou morre — e quando um inimigo é derrotado.

Construa uma aplicação web completa, ultra-imersiva e responsiva (Mobile-First e Desktop) de **RPG Narrativo Solo ambientado no universo canônico de Jujutsu Kaisen**, onde a IA atua como um **Mestre de RPG vivo, rigoroso e cinematográfico**, utilizando o SDK `@google/genai`.

O aplicativo deve funcionar perfeitamente tanto em **Computadores (layout de 3 colunas: ficha, crônica e mundo)** quanto em **Celulares/Smartphones (layout adaptativo estilo App Nativo com Bottom Navigation Bar, Drawers deslizantes e suporte a `100dvh`)**.

---

## 1. DIREÇÃO DE ARTE, UI/UX, RESPONSIVIDADE E EFEITOS VISUAIS (VFX)

### 1.1. Paleta de Cores e Estética ("Dark Cursed Energy / MAPPA Studio Aesthetic")
- **Fundos Principais:** Preto abissal (`#07070a`), Cinza Obsidiana (`#0f0f14`) e Superfícies translúcidas com *Glassmorphism* (`rgba(18, 18, 26, 0.85)` com `backdrop-filter: blur(12px)`).
- **Cores de Acento e Energia:**
  - **Carmesim Amaldiçoado (Sukuna / Reversão Vermelha / Perigo):** `#e11d48` com brilho neon `#f43f5e`.
  - **Azul Espiritual (Energia Amaldiçoada Padrão / Lapso Azul):** `#2563eb` com ciano elétrico `#38bdf8`.
  - **Roxo Abissal (Vazio Roxo / Grau Especial / Domínio):** `#7c3aed` com aura `#a855f7`.
  - **Branco/Verde Celestial (Técnica Amaldiçoada Reversa - RCT):** `#10b981` e `#ecfdf5`.
  - **Ouro Antigo (Votos Vinculativos / Restrições):** `#f59e0b`.
- **Tipografia:**
  - Títulos, nomes de Técnicas e Banners de Domínio: Fonte display impactante (estilo *Cinzel*, *Rajdhani* ou *Space Grotesk* em caixa alta com *letter-spacing* amplo).
  - Narração e Diálogos: Fonte de leitura ultra-confortável (estilo *Inter* ou *Merriweather* para blocos narrativos longos, com `line-height: 1.75` e controle de tamanho de fonte ajustável pelo usuário: `Pequeno`, `Médio`, `Grande`).

### 1.2. Efeitos Visuais Dinâmicos de Combate e Narrativa (CSS Animations & Canvas Overlay)
Implemente classes e animações visuais reativas disparadas automaticamente pelo estado retornado pelo Mestre no JSON de cada turno:
1. **Kokusen (Black Flash / Raio Negro):**
   - Ao ocorrer um *Black Flash*, dispare uma animação de *Screen Shake* (tremor de câmera de 400ms), um flash de inversão rápida de contraste (120ms) e faíscas elétricas rubro-negras (`#000000` e `#e11d48`) pulsando nas bordas do painel central.
   - Ative o badge **"ZONA DE KOKUSEN (120% POTENCIAL)"** com aura rubro-negra ao redor do avatar do jogador.
2. **Expansão de Domínio (*Ryōiki Tenkai*):**
   - Quando qualquer Expansão de Domínio estiver ativa na cena (`activeBarrierOrDomain`), exiba uma transição visual dramática e fixe um **Banner de Domínio Dominante** no topo do palco narrativo (ex.: *"⚠️ EXPANSÃO DE DOMÍNIO ATIVA: SANTUÁRIO MALEVOLENTE — Acerto Garantido Ativo"*).
   - Altere dinamicamente o brilho da borda do palco central e a atmosfera de fundo de acordo com o domínio (Vermelho Sanguinário para Sukuna, Galáxia/Ciano Cósmico para Vazio Ilimitado de Gojo, Sombras Líquidas para Megumi, Dourado/Judicial para Higuruma, etc.).
3. **Técnica Amaldiçoada Reversa (RCT / Cura):**
   - Quando a narrativa descrever cura por RCT, aplique um brilho esmeralda/branco suave no retrato ou na cena — sem barra de vida.
4. **Exaustão de Técnica Pós-Domínio (*Cursed Technique Burnout*):**
   - A exaustão é narrada: descreva a técnica instável e as consequências na cena. Não há medidor nem botão bloqueado por estado numérico.
5. **Cortina (*Curtain / Tobari*):**
   - Quando uma Cortina estiver abaixada no local, exiba um indicador visual escuro no topo do Radar de Mundo mostrando que a área está isolada de civis e sinais externos.

### 1.3. Responsividade Total: Computador vs. Celular (Mobile App)
- **No Computador (`>= 1024px`):**
  - Layout de **3 Colunas Simultâneas**:
    - Coluna Esquerda (`320px`, retrátil): Ficha narrativa do Feiticeiro.
    - Coluna Central (`flex-1`): Visualizador de Cena 16:9, Feed Narrativo e Console de Ação.
    - Coluna Direita (`340px`, retrátil): Radar de Mundo, NPCs Presentes e Códice RAG.
- **No Celular e Tablet (`< 1024px`):**
  - Usa `height: 100dvh` para evitar problemas com a barra de endereço e o teclado virtual do navegador móvel.
  - **Mini-Header Fixo (Sticky Top Bar):** Exibe de forma ultra-compacta o Nome/Grau, a condição narrativa atual e o local.
  - **Área Principal:** Exibe a aba ativa em tela cheia sem espremer colunas.
  - **Bottom Navigation Bar (Barra Inferior Estilo App Nativo):** 5 abas com ícones grandes (`min-height: 48px`):
    1. `📖 Crônica` (Palco Narrativo + Imagem da Cena + Input de Ação)
    2. `👤 Ficha` (Status, Técnicas, Inventário e Votos)
    3. `👁️ Radar` (Localização, Domínio Ativo e NPCs em Cena)
    4. `📚 Códice` (Lorebook `.md`/`.json` e Diário de Memória)
    5. `⚙️ Sistema` (Save/Load, Modelo de IA, API Key, Tamanho da Fonte)

---

## 2. REGRAS DE OURO DE COMUNICAÇÃO E FORMATAÇÃO DO MESTRE DE RPG

O Mestre de RPG (IA) **DEVE** escrever o campo `narrative` seguindo rigorosamente uma estrutura teatral padronizada, e o Front-End deve possuir um **Renderizador Customizado de Blocos Narrativos** que estiliza cada linha automaticamente:

1. **Momentos de Narração, Ambiente e Impacto (`*Narrador*:`):**
   - Toda descrição de cenário, atmosfera, sons, cheiros, movimentação, passagem de tempo e consequência física deve começar obrigatoriamente com:
     `*Narrador*: [Texto descritivo rico, sensorial e visceral]`
   - **Como o Front-End estiliza:** Bloco com borda lateral azul/roxa sutil, texto fluido e destaque para onomatopeias ou golpes críticos.

2. **Falas, Expressões e Reações de Personagens (`*Nome do Personagem*:`):**
   - Sempre que qualquer NPC, aliado ou inimigo falar ou interagir diretamente, a linha deve começar com o nome exato do personagem entre asteriscos seguido de dois-pontos:
     `*Satoru Gojo*: Ele abaixa levemente a venda preta, revelando o brilho azul incandescente dos Seis Olhos enquanto sorri de canto. "Ora, ora... parece que chegamos bem na hora da festa."`
     `*Ryomen Sukuna*: Uma boca adicional se abre na bochecha com um sorriso sádico. "Continue tentando, pirralho. Vamos ver quanto tempo essa sua determinação patética dura."`
   - **Nota:** Nunca usar o rótulo genérico `*Personagem*:` se o nome do NPC for conhecido; usar um descritivo como `*Feiticeiro Desconhecido*:` ou `*Espírito Amaldiçoado Grotesco*:` apenas enquanto a identidade for secreta.
   - **Como o Front-End estiliza:** Transforma automaticamente em um **Card de Diálogo Destacado**, exibindo a miniatura do avatar do NPC (se já gerada), o nome do personagem em destaque colorido (Azul para Aliado, Amarelo para Neutro, Vermelho para Hostil), as ações físicas em itálico e a fala entre aspas com contraste elevado.

3. **Agência Total do Jogador (Proibido Controlar o Jogador):**
   - O Mestre **NUNCA** decide as falas, pensamentos ou escolhas futuras do jogador. Ele descreve a reação do mundo ao turno anterior, executa as ações dos NPCs e encerra o turno passando a iniciativa para o jogador (`*Narrador*: ... O que você faz?`).

---

## 3. FLUXO DE CRIAÇÃO DE PERSONAGEM E INÍCIO DE CAMPANHA (WIZARD INICIAL)

Ao abrir o site sem uma campanha ativa (ou ao clicar em "Nova Campanha"), exiba um **Criador de Personagem e Cenário Interativo**:

1. **Identidade e Natureza:**
   - Nome do Personagem e Aparência Física detalhada (com botão **"Gerar Avatar Inicial com IA"**).
   - **Facção / Origem:**
     - *Feiticeiro Jujutsu (Escola Técnica de Tóquio ou Kyoto)*
     - *Herdeiro dos Três Grandes Clãs (Gojo, Zenin ou Kamo)*
     - *Usuário de Maldição Independente / Mercenário*
     - *Receptáculo / Portador de Objeto Amaldiçoado (Estilo Yuji Itadori)*
     - *Feto Amaldiçoado Encarnado (Estilo Choso)*
     - *Portador de Restrição Celestial Física (Zero Energia Amaldiçoada em troca de atributos físicos sobre-humanos e sentidos aguçados, estilo Toji/Maki)*
   - **Grau Inicial:** Grau 4, Grau 3, Grau 2, Semi-Grau 1, Grau 1 ou Grau Especial.
2. **Técnica Inata e Arsenal Inicial:**
   - Opção de escolher uma Técnica Canônica (ex.: *Dez Sombras*, *Manipulação de Sangue*, *Fala Amaldiçoada*, *Projeção*, *Proporção 7:3*, *Construção*, *Manipulação de Espíritos Amaldiçoados*) **OU** criar uma **Técnica Inata Original** (com botão *"Gerar Técnica Inata Balanceada com IA"* que preenche Lapso, Reversão, Técnica Máxima e Expansão de Domínio).
   - Escolha de Ferramenta Amaldiçoada inicial (ex.: Katana Imbuída, *Slaughter Demon*, *Playful Cloud*, *Split Soul Katana*, Nenhuma/Artes Marciais).
3. **Ponto de Partida Cronológico (Seletor de Arco):**
   - **Opção 1 (Padrão Canônico):** *Sendai, Julho de 2018 — O Primeiro Dedo* (Escola Sugisawa, início exato com Yuji Itadori e Megumi Fushiguro).
   - **Opção 2:** *Ingresso na Escola Técnica de Tóquio* (Primeiro dia de aula sob tutela de Satoru Gojo).
   - **Opção 3:** *Festival de Intercâmbio das Escolas Irmãs (Tóquio vs. Kyoto)*.
   - **Opção 4:** *Incidente de Shibuya (31 de Outubro de 2018, 19h00 — A Cortina se Fecha)*.
   - **Opção 5:** *Jogo do Abate (Culling Game — Entrada na Colônia)*.
   - **Opção 6:** *Início Personalizado* (O jogador descreve livremente a cena inicial).

---

## 4. DETALHAMENTO DAS 3 COLUNAS / MÓDULOS DA INTERFACE

### A. Coluna Esquerda: Ficha Viva do Feiticeiro / Maldição
1. **Cabeçalho do Personagem:**
   - Retrato quadrado (`1:1`) com moldura reativa ao estado atual (normal, ferido grave, Zona de Kokusen ou Domínio ativo) + botão **"Regerar Retrato"** (atualiza a imagem considerando o estado/ferimentos atuais).
   - Nome, Facção, Clã e Badge de Grau.
2. **Condição Narrativa (sem barras):**
   - **Condição Física/Emocional:** Texto descritivo (`physicalCondition`, ex.: *"Intacto"*, *"Costelas trincadas, sangramento no ombro direito"*, *"Exausto após sustentar o domínio"*).
   - **Sem HP, sem reserva de energia, sem Output e sem badge de estado técnico:** a ficha é literatura; o Mestre decide o peso de cada ferimento e de cada técnica.
3. **Abas Internas da Ficha (Editáveis e Atualizadas pela IA):**
   - **Aba 1 — Técnicas & Domínio:** Descrição mecânica da Técnica Inata, extensões (*Lapse*, *Reversal*, *Maximum*), *Técnica Amaldiçoada Reversa (RCT)*, * Técnicas Anti-Domínio (Domínio Simples / Cesto Oco de Vime / Emoção da Pétala Caída)* e *Expansão de Domínio*.
   - **Aba 2 — Arsenal & Objetos Amaldiçoados:** Lista de Ferramentas Amaldiçoadas equipadas com seu Grau e efeito especial, além de itens consumíveis ou dedos de Sukuna.
   - **Aba 3 — Votos Vinculativos (*Binding Vows*):** Contratos ativos (ex.: *Revelar a Própria Mão* — expor o funcionamento da técnica ao inimigo em troca de torná-la mais eficaz e previsível na ficção; *Hora Extra / Overtime*; ou votos criados durante a campanha).

### B. Coluna Central: Palco Narrativo, Visualizador de Cena e Console de Ação
1. **Visualizador Gráfico da Cena (`16:9` no Topo):**
   - Quadro panorâmico estilizado que exibe a arte da cena atual (gerada via IA a partir do `imagePrompt` do turno).
   - Controles sobre a imagem:
     - Botão **"🎨 Ilustrar Cena Atual"** (gera a imagem sob demanda caso o modo automático esteja desligado).
     - Toggle **"Auto-Gerar Imagem a cada turno"** (Ligado/Desligado — desligado por padrão ou configurável para economizar cota da API).
     - Botão **"🔍 Ampliar (Lightbox)"** e histórico das ilustrações geradas na sessão.
2. **Feed de História (Chat Narrativo Interativo):**
   - Exibe toda a campanha turno a turno com rolagem suave.
   - **Acordeão `[⚙️ NOTAS DO MESTRE]`** no topo de cada resposta: recolhido por padrão; ao clicar, mostra o `engineLog` (o que a cena estabeleceu, o que cada NPC quer e o que ficou em suspenso) e os `activeStoryCards` consultados no Códice. Sem cálculos de atributos, dano ou energia.
   - **Ações de Mensagem em cada turno:**
     - ✏️ **Editar Texto:** Permite corrigir ou ajustar qualquer detalhe da narração ou da ação do jogador.
     - 🔄 **Re-rolar Turno (Retry):** Pede ao Mestre para gerar uma nova versão daquele último turno.
     - ⏪ **Voltar no Tempo (Rewind):** Restaura o histórico, a condição narrativa e o estado do mundo exatamente para aquele turno específico.
     - 🔊 **Ouvir Narração (TTS Nativo / Web Speech API):** Botão opcional para ler a narração em voz alta em Português-BR.
3. **Sugestões Táticas Rápidas (`suggestedActions`):**
   - Acima da barra de digitação, exiba 3 pílulas clicáveis geradas pelo Mestre a cada turno com sugestões contextuais (ex.: *"Ativar Domínio Simples para anular o acerto garantido"*, *"Avançar pelo flanco tentando um Kokusen"*, *"Questionar o espírito sobre quem o enviou"*). Clicar preenche ou envia a ação.
4. **Console de Ação Multimodo (Rodapé):**
   - Seletor de Modo de Entrada com 4 botões claros:
     - ⚔️ **Agir (Do):** Ação física, combate corpo a corpo, movimentação ou furtividade.
     - 💬 **Falar (Say):** Diálogo direto com os personagens em cena. Inclui um toggle **🗣️ "Revelar a Própria Mão (Voto Vinculativo)"**: ao explicar a técnica, o jogador muda o equilíbrio dramático da cena — o oponente entende o funcionamento e pode explorá-lo.
     - ⚡ **Usar Jujutsu (Technique):** Abre um menu rápido com os golpes da ficha do jogador (*Técnica Inata*, *Reforço de EA*, *Tentativa de Black Flash*, *Técnica Reversa (RCT)*, *Domínio Simples*, *Expansão de Domínio*), preenchendo a ação com a técnica escolhida.
     - 📖 **Direcionar Cena (Story / Meta):** Permite ao jogador dar uma instrução narrativa direta ao Mestre (ex.: *"Avance o tempo até a manhã seguinte na Escola Técnica"*).

### C. Coluna Direita: Radar do Mundo e Códice (Lorebook RAG)
1. **Estado do Mundo & Localização:**
   - Card mostrando: **Local Atual**, **Arco/Data Cronológica**, **Estado da Barreira/Domínio** (`Nenhum`, `Cortina Ativa`, `Expansão de Domínio: [Nome]`).
2. **Radar de Presença (NPCs e Ameaças na Cena):**
   - Lista dinâmica alimentada por `worldStateUpdate.npcsInScene`.
   - Cada card de NPC mostra:
     - Retrato `1:1` do NPC (ou ícone de silhueta + botão **"🎨 Gerar Retrato"** que usa o `visualDescription` do NPC para gerar e salvar o avatar dele!).
     - Nome, Grau estimado, Atitude (`Aliado` em azul, `Neutro` em amarelo, `Hostil` em vermelho) e Status físico/postura atual.
3. **Sem rolagem de dados:** o Mestre decide o desfecho pela lógica da cena, pelos limites da técnica e pelas escolhas do jogador. Não exiba dados, modificadores, iniciativa ou tabelas de sucesso.

### 5.1. Modelos Atualizados e Configuração
- Utilize o SDK oficial `@google/genai`.
- **Seletor de Modelo de Texto nas Configurações:**
  - `gemini-3.8-flash` (Padrão recomendado: rápido, multimodal e excelente raciocínio narrativo).
  - `gemini-3.5-flash-lite` (Modo Alta Cota / Econômico: ideal para chaves gratuitas com limite de requisições elevado).
  - `gemini-4-argon` (Modo Ultra Profundo: raciocínio complexo máximo).
- **Modelo de Geração de Imagens:**
  - Utilize `gemini-nano-banana-2.1` (ou `gemini-3-pro-image` / fallback SVG estilizado caso a chave não tenha cota de imagem disponível no momento), garantindo que um erro de rate limit na geração de imagem **nunca** trave ou interrompa o texto da história.
- **Tratamento de Rate Limit (Erro 429):**
  - Se a chamada principal atingir erro `429`, exiba um aviso amigável com contagem regressiva e opção de alternar automaticamente para `gemini-3.5-flash-lite` e reenviar o turno sem perder o texto digitado pelo jogador.

### 5.2. System Prompt do Mestre de Jujutsu Kaisen (Enviado à IA)
O System Prompt do Mestre deve instruir a IA com as seguintes diretrizes inegociáveis:
1. **Fidelidade Absoluta à Obra de Gege Akutami:** Respeite rigorosamente a hierarquia de Graus, o funcionamento mecânico das Técnicas Inatas, o custo de Energia Amaldiçoada, a dificuldade extrema de usar Técnica Reversa (RCT) e Expansão de Domínio, e a personalidade canônica de cada personagem (Satoru Gojo, Ryomen Sukuna, Megumi Fushiguro, Yuji Itadori, Nobara Kugisaki, Kento Nanami, Mahito, Kenjaku, Choso, Toji Fushiguro, Yuta Okkotsu, etc.).
2. **Zero *Plot Armor* Artificial:** Se um feiticeiro de Grau 3 atacar frontalmente um Espírito Amaldiçoado de Grau Especial sem estratégia, ele sofrerá danos críticos ou fatais. Recompense o uso tático do ambiente, Votos Vinculativos, blefes, trabalho em equipe e combinações criativas de técnicas.
3. **Formatação Teatral Obrigatória no campo `narrative`:**
   - Use SEMPRE `*Narrador*:` para iniciar parágrafos de narração, descrição sensorial, coreografia de luta e ambiente.
   - Use SEMPRE `*Nome do Personagem*:` para iniciar parágrafos onde um NPC fala ou reage, descrevendo brevemente sua expressão/ação seguida de sua fala entre aspas.
   - Nunca fale ou aja pelo personagem do jogador.

### 5.3. Schema JSON Estrito de Resposta por Turno (`Structured Output`)
Configure a chamada à API para retornar obrigatoriamente um objeto JSON válido contendo exatamente esta estrutura:

```json
{
  "engineLog": "Notas do Mestre: o que a cena estabeleceu, o que cada NPC quer agora e o que ficou em suspenso — sem atributos, dano, energia ou probabilidades.",
  "activeStoryCards": ["Lista dos títulos dos Story Cards/Códice utilizados neste turno"],
  "visualEffectTrigger": "NONE | BLACK_FLASH | DOMAIN_EXPANSION | RCT_HEAL | TECHNIQUE_BURNOUT | CRITICAL_DAMAGE",
  "narrative": "*Narrador*: Descrição visceral da cena e do impacto da ação do jogador...\n\n*Nome do NPC*: Ação e expressão do personagem. \"Fala canônica e imersiva do NPC.\"\n\n*Narrador*: Gancho final descrevendo a situação imediata e perguntando o que o jogador faz.",
  "imagePrompt": "Anime scene in the dark atmospheric art style of Jujutsu Kaisen by MAPPA studio, high contrast, cursed energy aura, dynamic camera angle, depicting [detailed visual description in English of the exact current scene, no text or watermarks]",
  "playerStateUpdate": {
    "physicalCondition": "Intacto | Ferido no ombro | Exausto após sustentar o domínio",
    "newInventoryItemOrVow": "Opcional: item obtido ou voto vinculado neste turno, ou vazio"
  },
  "worldStateUpdate": {
    "location": "Nome detalhado do local atual",
    "arc": "Nome do Arco e Data/Hora aproximada",
    "activeBarrierOrDomain": "Nenhum | Cortina Ativa | Expansão de Domínio: [Nome do Domínio e Dono]",
    "npcsInScene": [
      {
        "name": "Nome Completo do NPC",
        "grade": "Grau do NPC (ex: Grau Especial, Grau 1)",
        "status": "Condição física aparente e postura tática",
        "attitude": "Aliado | Neutro | Hostil",
        "visualDescription": "Detailed anime character portrait in Jujutsu Kaisen MAPPA style of [aparência física detalhada do NPC em inglês]"
      }
    ]
  },
  "suggestedActions": [
    "Sugestão de ação tática ou combate 1",
    "Sugestão de diálogo ou investigação 2",
    "Sugestão de uso de técnica ou movimentação 3"
  ]
}
```

---

## 6. PERSISTÊNCIA DE DADOS, SAVE/LOAD MULTI-DISPOSITIVO E UX EXTRA

1. **Auto-Save Local Instantâneo:** Salve automaticamente o estado completo da campanha (ficha do jogador, histórico de mensagens, estado do mundo, avatares gerados, memória consolidada e Códice importado) no navegador (`localStorage` / `IndexedDB`) a cada turno.
2. **Exportar e Importar Save (`.json`) para Jogar no PC e no Celular:**
   - Botão **"💾 Exportar Campanha (.json)"**: Baixa um arquivo único com todo o progresso da campanha.
   - Botão **"📂 Importar Campanha (.json)"**: Permite carregar o arquivo no celular ou no computador e continuar exatamente do mesmo turno.
3. **Códice Base Pré-Carregado + Importador:**
   - Inclua já no código um conjunto inicial de Story Cards essenciais de Jujutsu Kaisen (Satoru Gojo, Ryomen Sukuna, Yuji Itadori, Megumi Fushiguro, Nobara Kugisaki, Kento Nanami, Mahito, Choso, Kenjaku, Energia Amaldiçoada, Kokusen, Expansão de Domínio, Votos Vinculativos) para que o jogo funcione imediatamente ao abrir, além do botão para importar o arquivo completo `JJK_Codex_Ultra_Completo.md` ou `adventure-UhtU4tSbk-kc-story-cards-284.json`.
```

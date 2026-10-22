# Revisão 4 — Crônica em formato de chat (mobile, tablet e desktop)

> **Documento histórico.** Registra a revisão de 2026-10-20, anterior à
> remoção do sistema de mesa (atributos, perícias, HP, energia medida, dados,
> níveis e XP). O app atual é um RPG narrativo; onde este relatório menciona
> barras de HP/EA ou rolagem de dados, isso já não existe no produto.

> Redesign da tela de narrativa do projeto **Jujutsu Kaisen: Crônicas de Mesa**.
> Data: 2026-10-20.
> Objetivo: eliminar a densidade de HUD/logs que impedia ler a narração no
> celular, adotando a gramática visual de WhatsApp/Telegram sem perder nenhuma
> função de mesa.

---

## 1. O problema

A tela anterior empilhava, no mesmo fluxo vertical:

- cabeçalho do app + cabeçalho da crônica;
- barra de ferramentas com modelo, fonte, som, cena, undo, retry, nova ficha;
- imagem 16:9 sempre aberta;
- imagem + legenda;
- cabeçalho de turno com badges de dado/voto;
- dois blocos recolhíveis por turno (Log do Motor e HUD & Cards);
- texto da narração em bolha de largura total;
- chips de sugestão;
- seletor de 4 modos + 5 gatilhos de técnica;
- textarea de 3 linhas + botão enviar;
- barra de navegação inferior.

No celular, isso consumia a tela inteira: a narração e a ação enviada ficavam
espremidas entre controles, e a leitura virava rolagem constante.

---

## 2. A solução: uma conversa, não um painel

Novo componente **`ChatNarrativeStage`** (substitui o antigo
`CenterNarrativeStage`, removido). A tela agora tem só três regiões:

### 2.1 Header (56 px)
- avatar, nome, grau e local;
- barras compactas de HP e EA;
- botão `⋯` que abre **um único menu** com tudo o que saiu da tela:
  personagem, mundo/premissa, turno (dado, auto-rolagem, voto, imagem),
  leitura (fonte, modelo, som, auto-imagem), sessão (desfazer, regerar,
  sistema, nova ficha).

### 2.2 Feed de mensagens
- **Narrador**: bolha de entrada, sem avatar, texto em 15 px/1,75 (16 px no
  desktop, 17 px no modo grande).
- **NPC**: bolha de entrada com avatar circular, nome em âmbar e fala em
  itálico.
- **Jogador**: bolha de saída à direita, âmbar, com modo, dado e horário.
- Separador de turno discreto (`Turno 3 · 20:14`) que abre os **detalhes do
  turno**: log do motor, cards ativos, regra em foco, estado e ações.
- Imagem do frame: **desligada por padrão no celular/tablet**; no desktop
  aparece como anexo do turno. Pode ser exibida/gerada pelo menu.
- Streaming: bolha do Mestre com cursor pulsante ou três pontos de digitação.
- Sugestões: chips horizontais acima do compositor; tocar preenche a mensagem,
  não envia sozinho.

### 2.3 Compositor
- Um textarea de uma linha que cresce até 132 px;
- botão `+` com modos, técnicas (Lapso, Reversão, Domínio, RCT, Kokusen),
  dado e Voto;
- botão circular de enviar;
- linha de status discreta: modo, d20 e voto ativo.
- Enter envia, Shift+Enter quebra linha.

---

## 3. Responsividade

| Breakpoint | Comportamento |
|---|---|
| **Mobile (390 px)** | Header do app escondido na aba Crônica; só o header do chat. Imagem off. Bolhas com 88–94% da largura. Compositor + chips + nav inferior. |
| **Tablet (820 px)** | Mesma conversa centralizada em `max-w-2xl` (672 px), imagem off, sem colunas laterais. Aba Ficha/Radar abre o drawer existente. |
| **Desktop (1440 px)** | Três colunas preservadas; a crônica vira uma coluna de chat de 672 px, com imagem do frame no topo do turno. Sidebars continuam recolhíveis. |

O documento **não tem overflow horizontal em 390 px**; o único transbordo é o
carrossel de sugestões, que é horizontal por projeto.

---

## 4. O que não se perdeu

Tudo o que estava na tela continua acessível, mas fora do caminho da leitura:

- Log do motor, cards ativos e regra em foco → **detalhes do turno**.
- HP/EA/output/condição, arco, momento, objetivo, barreira e premissa → **menu ⋯**.
- Dado, auto-rolagem, Voto, desfazer, regerar, nova ficha → **menu ⋯**.
- Lapso/Reversão/Domínio/RCT/Kokusen → **folha “Sua ação”** no botão `+`.
- Gerar imagem, ocultar/mostrar frame, auto-imagem → **menu ⋯**.
- Modelo, tamanho da fonte e som → **menu ⋯**.
- Overlay de Expansão de Domínio → preservado no novo componente.

---

## 5. Verificação visual

Capturas reais em Chrome DevTools Protocol:

- **390×844**: header enxuto, bolhas legíveis, imagem off, menu e folha de ação
  abrindo como bottom sheet.
- **820×1180**: conversa centralizada, sem imagem por padrão.
- **1440×900**: três colunas, chat de 672 px, imagem do turno no topo.
- **Conversa semeada com 2 turnos**: bolha de saída do jogador à direita, com
  `AGIR · D20 17` e selo `Voto: Revelar a Mão (+20%)`; NPC responde na
  sequência, sem reiniciar a cena.

Também foram testados os dois sheets no celular (menu e “Sua ação”), ambos com
`role="dialog"` e backdrop.

---

## 6. Arquivos

| Arquivo | Mudança |
|---|---|
| `src/components/ChatNarrativeStage.tsx` | **novo** — crônica em formato de chat, sheets, composer e detalhes de turno |
| `src/components/CenterNarrativeStage.tsx` | **removido** — substituído pelo novo componente |
| `src/App.tsx` | importa `ChatNarrativeStage`; header mobile escondido na aba Crônica |
| `scripts/probe.mjs` | suporte a clique visível, sheets e seed de conversa para verificação |

Build: **489,71 kB** iniciais (144,92 kB gzip) + chunks sob demanda.
`tsc --noEmit` e `npm run build` passam.

---

## 7. Próximos ajustes possíveis

1. Marcar mensagens já lidas/rolagem com “ir para o fim” quando o jogador sobe
   no histórico.
2. Editar a própria mensagem antes de enviar (hoje só o texto no compositor).
3. Reações rápidas (ex.: “Kokusen!”, “Voto”) como no Telegram.
4. Virtualizar o feed para campanhas com centenas de turnos.

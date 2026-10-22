<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/ead516e9-ac27-4189-8b34-cc53c1765e75

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Modelo de jogo: crônica narrativa

Este projeto é um **RPG narrativo**, não uma mesa de RPG virtual. Não existem
atributos, perícias, HP, reservas de energia medidas, dados, níveis ou XP. A
Ficha Exclusiva é um documento de ficção (personalidade, técnica, limites,
história, ferimentos) e o Mestre IA decide, pela lógica da cena, quando o
personagem enfraquece, é ferido ou morre — e quando um inimigo é derrotado.

## Segurança e limites (opcional)

Os endpoints `/api/gemini/*` agora têm:

- **Rate limit por IP e por rota** (ex.: 20 turnos/min, 6 imagens/min). Respostas
  acima do limite retornam `429` com `Retry-After`.
- **Bloqueio de origem cruzada**: um `Origin` de outro host recebe `403`.
- **Código de acesso opcional**: defina `APP_ACCESS_CODE` no `.env` para exigir
  o cabeçalho `x-access-code`. Para usar pelo navegador, salve o código em
  `localStorage` sob a chave `JJK_SERVER_ACCESS_CODE`; o app envia o valor
  automaticamente em toda chamada `/api`.

Sem `APP_ACCESS_CODE`, o app roda localmente como antes. `/api/health` continua
aberto para diagnóstico.

## Build

`npm run build` gera a ficha de feiticeiro em chunk separado (lazy loading);
a crônica carrega no bundle principal.

## Códice em JSON

`Codex.md` é a fonte canônica do Códice, editada à mão.
`npm run codex:build` compila para
`json/codex/{personagens,habilidades,locais,outros}.json`, e o servidor e a UI
consomem apenas esses JSONs — não há parsing de Markdown em runtime.

O build é determinístico e **fail-fast**: uma tag nova ou um cabeçalho H1 sem
classificação no Markdown **quebra** o build (exit 1, com o nome da tag), em
vez de cair silenciosamente em "lore". Erros de digitação no fonte são
corrigidos só na classificação, sem reescrever o `Codex.md`.

Os JSONs são versionados no git: o diff de conteúdo é auditável e a imagem
Docker não depende do Markdown em runtime. Depois de editar o `Codex.md`,
rode `npm run codex:build` e commite o resultado.

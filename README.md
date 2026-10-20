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

## Segurança e limites (opcional)

Os endpoints `/api/gemini/*` agora têm:

- **Rate limit por IP e por rota** (ex.: 20 turnos/min, 6 imagens/min). Respostas
  acima do limite retornam `429` com `Retry-After`.
- **Bloqueio de origem cruzada**: um `Origin` de outro host recebe `403`.
- **Código de acesso opcional**: defina `APP_ACCESS_CODE` no `.env` para exigir
  o cabeçalho `x-access-code`. A UI pede o código em **Sistema & Nuvem →
  Código de acesso do servidor** e o guarda apenas no navegador.

Sem `APP_ACCESS_CODE`, o app roda localmente como antes. `/api/health` continua
aberto para diagnóstico.

## Build

`npm run build` gera a ficha e o painel de nuvem em chunks separados; o SDK do
Firebase só é baixado quando o painel de nuvem é aberto.

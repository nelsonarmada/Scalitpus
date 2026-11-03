# Publicação no Cloudflare Workers

Usa o ramo `main`, que contém package.json na raiz. O ramo scalitpus-demo contém apenas a demonstração descarregável.

- Root directory: /
- Build command: npm run build
- Deploy command: npx wrangler deploy --name scalitpus --assets ./dist
- Builds → Variables and secrets: NODE_VERSION=24, VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (chave pública publishable/anon).

As variáveis VITE são incorporadas durante a compilação; variáveis Runtime não as substituem.

Depois de alterar o ramo, inicia uma compilação de um novo commit de main. Repetir uma compilação antiga pode continuar a usar o ramo antigo. Confirma o ramo e commit no detalhe da compilação.

Após publicar, ativa o endereço workers.dev em Domains se estiver desativado. Configura o endereço HTTPS em Authentication → URL Configuration no Supabase (Site URL e Redirect URLs). Testa o início de sessão e a partilha entre dispositivos antes de utilizar com o grupo.

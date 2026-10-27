# Scalipus 🏀

Um site leve, em português, para organizar o basket da semana. Funciona no telemóvel e pode ser adicionado ao ecrã principal.

- Administradores marcam jogos: data, hora, local, lotação e recado.
- Um link do grupo pode ser partilhado diretamente no WhatsApp.
- Jogadores entram pelo nome, sem instalar uma aplicação nem criar uma palavra-passe.
- Cada jogador recebe um acesso pessoal e só pode alterar a própria presença.
- Administradores também marcam presenças pelos jogadores.
- Convidados externos são adicionados pelos administradores e ficam isentos.
- A grelha mostra uma linha por jogador, uma coluna «Valor pago» (total acumulado) e uma coluna de presenças por data.
- Administradores e Master registam cada parcela transferida, com data e observação. O total é calculado a partir das parcelas válidas; anulações mantêm o registo e o motivo.
- Só Master e administradores acedem a Transações monetárias e aos totais na grelha. Os montantes e o histórico não são enviados ao navegador dos utilizadores normais.
- O Master pode fundir fichas duplicadas e autorizar administradores individualmente para essa operação. A autorização começa desativada e pode ser retirada a qualquer momento.
- Visão geral mostra a percentagem de participação de cada jogador, com o número de presenças e de jogos passados.
- O Master atribui e retira permissões; administradores não promovem outros utilizadores.
- Vários administradores, com início de sessão por link enviado por email.

O site **não cobra dinheiro**, não recebe dados bancários e não envia mensagens automaticamente. Abre o WhatsApp com a mensagem preparada; o utilizador escolhe o grupo e envia.

## Experimentar localmente

Requer Node.js 22.12+ ou 24 e npm.

```sh
npm ci
npm run dev
```

Sem as variáveis Supabase, a aplicação abre em **modo de demonstração**, com jogadores fictícios e alterações guardadas no `localStorage`. Não há sincronização entre dispositivos nesse modo. Não o uses para registar presenças ou pagamentos reais do grupo.

O código completo está disponível no ramo `main` do repositório GitHub. A demonstração descarregável fica no ramo `scalitpus-demo`. O site ainda não está publicado nem ligado a um projeto Supabase real. Para partilhar dados entre dispositivos, segue os passos abaixo; publicar apenas o HTML da demonstração mantém os dados locais.

### Abrir a demonstração sem instalar nada

`index.html` é a entrada de desenvolvimento do Vite e não funciona quando aberto diretamente como ficheiro ou num visualizador HTML sem compilação. Para obter uma demonstração autónoma:

```sh
npm run build:demo
```

Abre o ficheiro gerado `scalitpus-demo.html` no navegador. Inclui o código, os estilos e as fontes e não precisa de acesso à rede. É sempre uma demonstração com dados fictícios, mesmo que tenhas Supabase configurado. Se o visualizador bloquear o armazenamento do navegador, as alterações mantêm-se apenas enquanto essa janela estiver aberta. Não substitui a publicação do site nem partilha dados entre dispositivos.

## Usar com o grupo real

### 1. Criar a base de dados

1. Cria um projeto no [Supabase](https://supabase.com/), preferencialmente numa região europeia.
2. No **SQL Editor**, executa o conteúdo de [supabase/schema.sql](supabase/schema.sql). Pode ser executado novamente sem apagar dados.
3. Em **Authentication → URL Configuration**, define o **Site URL** com o endereço público do site. Acrescenta esse endereço à lista de **Redirect URLs**. Para desenvolvimento, acrescenta também a origem local da aplicação.
4. Mantém o fornecedor Email ativo e a confirmação por email. O código usa `signInWithOtp`: o administrador recebe um link de acesso. Se personalizares o template de email, mantém `{{ .ConfirmationURL }}`.
5. Copia o Project URL e a chave **publishable/anon** das definições do projeto. A chave pública é própria para o navegador. **Nunca uses uma chave secret ou `service_role` no site.**

O fornecedor de email de teste do Supabase pode limitar destinatários e envios. Antes de convidares outros administradores, configura um SMTP adequado em Authentication se o serviço o exigir. Um jogador normal não precisa de email.

### 2. Configurar a aplicação

Copia `.env.example` para `.env.local` e preenche localmente:

```dotenv
VITE_SUPABASE_URL=https://o-teu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=a-tua-chave-publica
```

Reinicia o servidor de desenvolvimento depois de alterar estas variáveis. Não coloques a palavra-passe da base de dados nem chaves secretas neste ficheiro. `.env.local` é ignorado pelo Git. As duas variáveis `VITE_*` são públicas e integradas no bundle durante a compilação.

### 3. Publicar sem mensalidade obrigatória

O código pode ficar num repositório GitHub gratuito, público ou privado. O site é estático e é compatível com o plano gratuito do **Cloudflare Pages**; os dados e a autenticação ficam no plano gratuito do **Supabase**, sujeitos aos limites e políticas atuais desses serviços. Um domínio próprio é opcional.

1. Usa o código completo do ramo `main` de [nelsonarmada/Scalitpus](https://github.com/nelsonarmada/Scalitpus/tree/main). O ramo `scalitpus-demo` contém apenas a demonstração e não deve ser usado nesta publicação.
2. No [Cloudflare Pages](https://pages.cloudflare.com/), cria um projeto Pages com integração Git, liga esse repositório e escolhe `main` como ramo de produção. A raiz do projeto é a raiz do repositório.
3. Configura:
   - Framework: Vite.
   - Build command: `npm run build`.
   - Output directory: `dist`.
   - Node.js: 24 (se necessário, define a variável `NODE_VERSION=24`).
   - Variáveis de build: `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
4. Publica e usa o endereço HTTPS atribuído pelo Pages. Atualiza os URLs permitidos na autenticação Supabase com esse endereço.
5. Abre o site, entra com o teu email e cria o grupo. Depois cria o primeiro jogo e usa **Partilhar grupo** para enviar o link ao WhatsApp.

Os ficheiros `public/_headers` definem os cabeçalhos de segurança suportados pelo Cloudflare Pages. Se usares outro alojamento, aplica cabeçalhos equivalentes. O projeto usa fontes locais e não carrega bibliotecas de CDNs.

### 4. Operação do grupo

- **Novo jogador:** entra pelo link do grupo, escreve o nome e responde. O acesso fica guardado nesse navegador.
- **Jogador já adicionado pelo administrador:** o administrador usa o ícone de link na linha do jogador e envia o acesso pessoal. Nomes repetidos são recusados para evitar duplicados e apropriação de presenças.
- **Mudança de telemóvel/perda de acesso:** pede ao administrador um novo link pessoal. O anterior deixa de funcionar. Gerar um link exige sessão de administrador.
- **Externo:** o administrador usa Adicionar jogador → Jogador externo. Um membro não pode isentar-se sozinho.
- **Outro administrador:** primeiro inicia sessão pelo seu email; depois o Master adiciona esse email no menu do perfil. Só o Master pode retirar esta permissão.
- **Inscrições por jogo:** na tab Jogos, abre o jogo pretendido e usa «Inscrever-me neste jogo» ou «Cancelar a minha inscrição». O Master e os administradores também podem responder por outros jogadores na lista. A inscrição usa o mesmo par jogador/jogo da grelha em Jogadores: alterar um ecrã atualiza o outro, sem copiar nem criar registos separados. Uma inscrição numa data não afeta as restantes. Utilizadores não se inscrevem em jogos passados.
- **Transações monetárias (administração) — histórico de recebimentos:** regista cada parcela com valor, data da transferência e observação. Exemplo: 20 € + 25 € + 15 € = 60 € acumulados. Na grelha, o total aparece apenas como texto de consulta, sem botão ou edição. Para acrescentar ou anular movimentos, abre exclusivamente a tab Transações monetárias e seleciona o jogador. O total é atualizado automaticamente na grelha. Uma parcela incorreta pode ser anulada com um motivo e continua visível no histórico. Não depende do número de jogos nem calcula dívidas por presença.
- **Permissão de fusão:** no perfil Master → Permissões do grupo, usa «Permitir fusão» ao lado do administrador. A autorização é individual; retirar e voltar a atribuir o nível de administrador não repõe uma autorização antiga. Um administrador não pode atribuir esta permissão, incluindo a si próprio.
- **Fusão de duplicados (Master ou administrador autorizado):** escolhe a ficha a absorver e a ficha que fica, revê o resumo e confirma que são a mesma pessoa. Presenças coincidentes contam uma vez: «sim» prevalece sobre «não», que prevalece sobre «sem resposta». Todas as parcelas, incluindo anuladas, mantêm o identificador, data, valor, autor e nota. As parcelas válidas são somadas; eventuais transferências registadas em duplicado devem ser anuladas explicitamente. A ficha absorvida é arquivada, não apagada, e o seu acesso é invalidado. O acesso da ficha que fica é mantido; envia-o novamente à pessoa se necessário. A operação não concede permissões administrativas.

- **Presenças por data:** cada jogo acrescenta uma coluna. «X» significa presença confirmada, «—» significa que não vai e vazio significa sem resposta. A alteração de uma data não afeta outras datas nem o total pago. Em telemóvel, desliza a grelha horizontalmente; nome e valor ficam fixos. O administrador pode corrigir presenças antigas; o jogador altera apenas as suas respostas a jogos futuros.
- **Telemóvel:** no menu do navegador, escolhe Adicionar ao ecrã principal. É um site com manifesto e ícone; não exige publicação numa loja. As operações do grupo real precisam de Internet.
- **Fuso horário:** os horários dos jogos são apresentados em Europe/Lisbon. O formulário de criação usa a hora local do dispositivo do administrador e guarda o instante em UTC.

## Níveis de acesso

| Nível         | Operações                                                                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Master        | Todas as operações do grupo e atribuição/remoção de administradores.                                                                       |
| Administrador | Criar jogos, gerir jogadores/externos e presenças, registar/anular parcelas; fundir duplicados apenas com autorização explícita do Master. |
| Utilizador    | Consultar jogos/presenças, adicionar o próprio nome se não existir e responder apenas pela própria ficha em jogos futuros.                 |

O criador de um grupo novo fica Master desse grupo. Os acessos pessoais dos jogadores não concedem administração. A autenticação por email identifica Master e administradores. Os dados são separados por grupo.

Na demonstração, o seletor «Testar nível de acesso» permite explorar os três níveis. É apenas uma simulação com dados fictícios no navegador; o seletor não existe em grupos reais. Na versão real, permissões e dados financeiros são decididos exclusivamente pela base de dados.

## Relatório de participação e identidade visual

Na Visão geral, o relatório calcula `presenças confirmadas em jogos passados / número total de jogos passados × 100`. São passados os jogos cuja data e hora de início já passaram. O denominador inclui todo o histórico do grupo, mesmo anterior à inscrição do jogador. Jogos futuros, incluindo confirmações antecipadas, não entram no cálculo. Respostas em falta não contam como presença. As presenças do mesmo jogo contam uma vez, incluindo após uma fusão. Se não há jogos passados, mostra «Sem jogos passados» e «—», em vez de uma percentagem sem base de cálculo. Inclui membros e externos, permite pesquisar e ordena por percentagem.

O site usa a identidade Scalipus — Clube de Setúbal. O ficheiro de apresentação está em `src/assets/scalipus-logo.webp`, otimizado a partir da reprodução preparada com base na imagem fornecida pelo utilizador, e os ícones estão em `public`. O HTML autónomo inclui o logótipo e as fontes para funcionar sem rede. Não foi necessário acrescentar dependências à aplicação para usar as imagens.

## Atualizar uma instalação anterior

Executa novamente `supabase/schema.sql` antes de atualizar uma instalação real. A migração acrescenta `group_admins.can_merge` (por defeito falso), instala a verificação e a delegação de fusão, cria o histórico `payments`, o registo de fusões e os campos de Master/fichas arquivadas, sem apagar jogadores ou presenças. Um total acumulado já preenchido é convertido **uma só vez** num «Saldo anterior — parcelas originais indisponíveis», sem inventar datas ou transferências anteriores. As novas parcelas são registadas individualmente. Totais não são inferidos dos antigos estados «Pago» por jogo. A antiga função de editar totais diretamente deixa de estar acessível aos clientes.

Em grupos antigos, a migração não escolhe arbitrariamente um Master entre os administradores. O responsável pelo projeto Supabase deve identificar a conta correta em Authentication e atribuí-la no SQL Editor, substituindo os dois UUID pelos valores reais:

```sql
update public.groups
set master_user_id = 'UUID-DA-CONTA-DO-NELSON'
where id = 'UUID-DO-GRUPO';
```

Nunca coloques esse comando com valores fictícios no script automático. Em grupos novos, o criador já fica Master e este passo não é necessário.

As demonstrações antigas no navegador recebem o mesmo tratamento de saldo anterior. «Repor dados de demonstração», no menu do perfil, mostra o novo exemplo com parcelas fictícias. Descarrega novamente o ZIP para obter o código atualizado.

## Privacidade e permissões

O link do grupo é um convite privado por posse: quem o receber consegue consultar nomes e presenças e inscrever-se como membro. Os totais e as parcelas de pagamentos são exclusivos da administração e não são incluídos na resposta da API a um utilizador normal, mesmo autenticado. Partilha-o apenas com a equipa. Não é uma listagem pública pesquisável, mas não exige autenticação para leitura. Os links pessoais são credenciais: envia-os só ao jogador correspondente. O token pessoal usa o fragmento do URL e é removido da barra depois de guardado no dispositivo.

Todas as tabelas, incluindo pagamentos e auditoria de fusões, têm RLS ativo e não concedem acesso direto aos clientes. As funções SQL expostas validam os privilégios e limitam as operações:

- leitura por convite do grupo;
- resposta pessoal por token aleatório de 256 bits, guardado como hash SHA-256 na base de dados;
- gestão e registo/anulação de pagamentos apenas por Master ou administrador autenticado do próprio grupo;
- fusões reservadas ao Master ou a um administrador desse grupo com `can_merge=true`; a API volta a verificar a permissão em cada operação;
- atribuição de permissões exclusivamente pelo Master;
- totais calculados a partir de parcelas não anuladas, com histórico e autoria preservados;
- lotação validada na base de dados com bloqueio por jogo;
- separação entre grupos e impossibilidade de cobrar aos externos;
- resposta de jogador bloqueada depois de começar o jogo; administradores podem corrigir o histórico.

A aplicação atualiza o grupo a cada 20 segundos. O sistema de convites é pensado para um pequeno grupo de confiança. Se o link se tornar público, planeia moderação e proteção contra inscrições abusivas antes de alargar a utilização. Há dados pessoais: limita o acesso ao projeto Supabase e conserva apenas o histórico de que o grupo precisa.

## Verificação e desenvolvimento

```sh
npm run build      # TypeScript estrito + compilação de produção
npm test           # parcelas, anulações, fusões e migração de saldos
npm run test:e2e   # percursos reais no Chromium
npm run test:db    # PostgreSQL descartável: permissões e integridade
```

Os testes de navegador usam `/usr/bin/chromium` neste ambiente. Noutro computador, define `CHROMIUM_PATH` para o executável ou instala Chromium através do Playwright e adapta a configuração. Os testes SQL requerem Docker; o script cria e remove o próprio contentor, não publica portas e nunca toca no Supabase real. `tests/bootstrap.sql` simula apenas o contrato de autenticação do Supabase e **não deve ser executado num projeto real**.

`npm run preview` permite verificar a compilação local. As pastas `dist`, `node_modules` e os relatórios de testes são gerados e ignorados pelo Git.

Não existe ainda validação de entrega real de emails, de um projeto Supabase remoto ou de um domínio público. Faz essa verificação depois de configurares os serviços: cria um jogo, abre o convite num segundo dispositivo, responde como jogador e confirma no dispositivo do administrador. Verifica também que o jogador não consegue editar pagamentos.

### Caixa: recebimentos e pagamentos

Na tab **Transações monetárias**, o **Histórico de recebimentos** conserva as transferências dos jogadores. O **Histórico de pagamentos** regista saídas da caixa (por exemplo, aluguer do pavilhão), com valor, data, descrição e autor do registo. Master e administradores podem registar e anular movimentos com motivo; utilizadores normais não recebem estes dados na API.

O resumo apresenta **total recebido**, **total pago** e **saldo disponível = recebimentos válidos − pagamentos válidos**. Os totais abrangem todo o grupo e não mudam com o filtro por jogador. São permitidos saldos negativos, visíveis a vermelho, para poder registar despesas já pagas mesmo que os recebimentos ainda não cubram o valor. Uma saída não altera o acumulado de nenhum jogador. As anulações mantêm o registo original, autor e motivo, excluindo o valor dos totais.

Atualiza a base de dados executando novamente `supabase/schema.sql`: cria a tabela `expenses` e as funções protegidas, sem alterar as transferências existentes. Nas demonstrações guardadas, a ausência de histórico de saídas equivale a zero saídas; não são inventadas despesas anteriores. Saldos anteriores migrados contam como recebimentos, mas despesas antigas terão de ser registadas para o saldo refletir a caixa real.

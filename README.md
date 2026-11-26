# Sem Barreiras Pet

Plataforma acadêmica de adoção responsável que aproxima adotantes de ONGs e abrigos. O frontend usa HTML, CSS e JavaScript puro; o backend usa Flask, SQLAlchemy e PostgreSQL, com alternativa SQLite para desenvolvimento local.

## Estado atual

| Área | Implementação no código local |
| --- | --- |
| Início | Pets disponíveis consultados na API, com busca e atalhos às funções reais |
| Login e cadastro | Senhas com hash, sessões revogáveis de até oito horas e limite persistente de tentativas |
| Ficha do pet | Consulta somente registros da API; cadastro ausente ou falha mostra mensagem explícita |
| Visitas | Solicitação, acompanhamento pelo adotante, confirmação pela gerência, cancelamento e remarcação |
| Contato | Mensagens gravadas com protocolo e consulta restrita à gerência |
| Navegação | Acesso direto ao catálogo, ficha e agendamento; página antiga redireciona sem tutorial |
| Privacidade | HTML e API descrevem os fluxos reais; versões antigas no banco são preservadas |
| Catálogo | Página própria e busca por nome/raça, espécie e porte, também disponível no início |
| Gerência de pets | CRUD completo: cadastro, consulta, edição, exclusão física, arquivamento e reativação |

O seed acadêmico insere Nina com dados fictícios, quando ausente. `assets/js/data/pets.json` é fonte dos dados de seed e testes; as páginas exibem somente pets cadastrados no banco. Não há ficha local simulada quando a API falha ou o pet não existe.

## Estrutura

```text
app.py                     aplicação Flask, arquivos públicos e rotas de API
api/index.py               entrada serverless para o Vercel
config.py                  configuração do backend e conexão com o banco
config.js                  configuração pública do frontend e Google Maps
database.py                instância compartilhada do SQLAlchemy
models.py                  modelos e serialização dos dados
seed.py                    criação de tabelas e inserção dos dados iniciais
seguranca.py               sessões revogáveis e limite persistente de tentativas
regras.py                  validação de contatos, disponibilidade e atendimento
preparacao.py              preparação aditiva e proteção das tabelas de suporte
politica.py                texto atual e publicação de nova versão da política
index.html                 página inicial
privacidade.html           política apresentada no site
pages/                     páginas públicas, minhas-visitas.html e gerencia.html
assets/css/                estilos compartilhados e de cada página
assets/js/main.js          navegação e carregamento dos módulos
assets/js/data/pets.json    dados fictícios compartilhados; pets.js exporta a consulta
assets/js/modules/         API, formulários, ficha, mapas e agendamento
tests/                     testes Python, JavaScript e navegador
IHC/                       pesquisa documental, persona e jornada
inspiracoes/               referências visuais
```

`auth-demo.js` mantém o nome histórico, mas login, cadastro e contato usam a API real.

## Executar localmente

Na raiz do projeto, com Python instalado:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
# Preencha SECRET_KEY no .env com uma chave aleat?ria antes de continuar.
.\.venv\Scripts\python.exe -m flask --app app init-db
.\.venv\Scripts\python.exe app.py
```

Se `.venv` ou `.env` já existirem, reutilize-os sem sobrescrever sua configuração. Acesse `http://localhost:5000`. O comando `python app.py` inicia o servidor de desenvolvimento com depuração; não deve ser usado como servidor de produção.

No ambiente portátil já preparado nesta pasta, o executável Python pode estar em `.venv/python.exe`, em vez de `.venv/Scripts/python.exe`.

### Configuração do banco e da sessão

Configure no `.env`:

- `DATABASE_URL`: conexão PostgreSQL no formato `postgresql+psycopg2://USUARIO:SENHA@HOST:5432/BANCO`.
- `SECRET_KEY`: chave aleatória estável de pelo menos 32 caracteres; não existe chave pública padrão.
- `SB_AUTO_INIT_DB=0`: valor padrão; tabelas e dados não são criados ao carregar a aplicação. Use os comandos explícitos de preparação.
- `FLASK_ENV=production`: ativa cookies Secure para HTTPS; na Vercel, `VERCEL=1` também os ativa. Cookies são HttpOnly e SameSite=Lax.

Para usar SQLite explicitamente em desenvolvimento, configure `DATABASE_URL=sqlite:///sembarreiras.db`. Com a configuração padrão apontando para PostgreSQL local, `config.py` usa SQLite na raiz do projeto se a porta local do PostgreSQL estiver indisponível. Isso não comprova conexão com PostgreSQL.

Não versione `.env` ou bancos locais. Alterar a chave invalida cookies assinados com a chave anterior. Sessões são verificadas no banco a cada requisição protegida; sair e tentar outro login revogam a sessão atual e suas cópias. Cookies antigos que continham somente usuario_id deixam de autorizar acesso. O limite é de dez tentativas por identificador e 60 por IP/ação em 15 minutos, incluindo tentativas bem-sucedidas; os identificadores são protegidos por HMAC. PostgreSQL usa locks transacionais para serializar a reserva das tentativas. JSON tem limite de 32 KiB.

### Inicializar tabelas e dados

A inicialização está centralizada em `seed.py` e pode ser acionada pelo Flask:

```powershell
$env:SB_AUTO_INIT_DB = '0'
python -m flask --app app init-db
```

Use o Python do seu ambiente virtual. Também existe a entrada `python seed.py`. A variável acima evita a inicialização automática antes da execução explícita.

A rotina cria tabelas ausentes e insere a política atual e Nina com fotos demonstrativas quando ausentes. Não cria contas nem troca credenciais. Repetir preserva registros existentes. `db.create_all()` não altera colunas de tabelas já criadas.

Para um banco existente, use `python -m flask --app app prepare-db`: acrescenta as tabelas `sessoes_usuarios`, `tentativas_acesso`, `pet_midias` e `mensagens_contato`, além da versão 2026.11 da política. Não apaga nem altera usuários, visitas, pets ou políticas anteriores. As quatro tabelas novas usam RLS no PostgreSQL e têm acesso direto revogado para os papéis Supabase `anon` e `authenticated`, quando presentes; o backend precisa conectar com um papel proprietário/BYPASSRLS. Não use a chave pública do Supabase no lugar das credenciais de servidor.

Para associar as imagens locais aos exemplos antigos reconhecidos, execute deliberadamente `python -m flask --app app importar-fotos-exemplo` após preparar o banco. Mídias existentes são preservadas. Fotos reais devem ser cadastradas em `pet_midias`; a API lê essas fotos sem preencher dados clínicos ausentes com exemplos.

Confira o plano de preparação e as validações em `CORRECOES_2026-11-17.md` antes de aplicar no ambiente compartilhado.

`setup_db.py` e `atualizar_textos.py` foram removidos: suas funções de criação de tabelas e inserção inicial da política já estão em `seed.py`. A antiga operação que apagava e substituía todas as seções não foi mantida; revisões de políticas existentes exigem atualização deliberada dos dados.

## API

### Agenda dos gerentes

O painel em `pages/gerencia.html` permite consultar solicitações por status e data, ver
pet e contato do solicitante e confirmar visitas pendentes. Exibe 25 registros por
página, com horários de Brasília. A confirmação atualiza `agendamentos.status` para
`confirmado`; não envia e-mail ou mensagem automaticamente. Horários passados e
solicitações canceladas não podem ser confirmados.

O acesso usa o login existente e uma lista de IDs autorizados **no servidor**:

```dotenv
GERENTES_IDS=12,34
```

Os números acima são exemplos. Primeiro cadastre as contas normalmente e confira os
IDs reais no banco (`SELECT id, email FROM usuarios`). Configure somente os IDs das
pessoas autorizadas no `.env` local e nas variáveis da hospedagem; reinicie a aplicação
após alterar. Lista vazia bloqueia todos. Não coloque essa configuração em `config.js`.
O cadastro público não pode conceder permissão de gerente. O login de uma conta
autorizada abre o painel, e a navegação passa a mostrar “Agenda da clínica”.

Senhas administrativas temporárias são hashes com marcador de expiração de 48 horas
no campo existente, sem coluna nova. O login exige troca em `pages/alterar-senha.html`
antes de liberar consultas/alterações da agenda. `POST /api/auth/senha` exige senha
atual, nova senha e confirmação; a troca revoga todas as sessões anteriores da conta.
Senhas e IDs reais ficam somente no ambiente; não são incluídos na documentação.

Esta versão atende uma única clínica e exige as tabelas de suporte descritas acima.
Instalações com várias clínicas precisam de vínculos e isolamento por unidade antes
de compartilhar o painel. Não há bloqueio de capacidade por horário: duas solicitações
podem ser confirmadas no mesmo horário, conforme avaliação do gerente.

Rotas protegidas: `GET /api/gerencia/agendamentos` (filtros `status`, `data`, `pagina`)
e `POST /api/gerencia/agendamentos/<id>/confirmar` (corpo JSON `{}`).

Verificação do painel: `python -m unittest discover -s tests` e
`node tests/browser_gerencia.cjs` (requer Playwright; `PYTHON_EXE` e
`PLAYWRIGHT_MODULE` permitem reutilizar instalações existentes). O teste de navegador
cria dados fictícios em SQLite em memória, sem usar o Supabase.

| Método | Rota | Função |
| --- | --- | --- |
| GET | `/api/status` | Diagnóstico de conexão com o banco |
| GET | `/api/privacidade` | Política ativa e suas seções |
| GET | `/api/pets` | Pets cadastrados; aceita `especie` e `porte` |
| GET | `/api/pets/<id>` | Ficha de um pet cadastrado |
| POST | `/api/auth/cadastro` | Cadastro e início da sessão |
| POST | `/api/auth/login` | Autenticação |
| GET | `/api/auth/me` | Consulta da sessão |
| POST | `/api/auth/logout` | Encerramento da sessão no navegador |
| POST | `/api/agendamentos` | Solicitação de visita vinculada ao usuário autenticado |
| GET | `/api/agendamentos` | Somente as visitas da conta atual, com paginação |
| POST | `/api/agendamentos/<id>/cancelar` | Cancelamento pelo dono ou gerente |
| POST | `/api/agendamentos/<id>/remarcar` | Nova data/horário; volta a pendente |
| POST | `/api/contato` | Registro da mensagem com protocolo |
| GET | `/api/gerencia/contatos` | Consulta de mensagens por gerente |
| GET / POST | `/api/gerencia/pets` | Listagem com busca/filtro/paginação e criação de pets |
| GET / PUT / DELETE | `/api/gerencia/pets/<id>` | Consulta, edição e exclusão física do pet |

O gerente acessa o CRUD pelo link **Gerenciar pets** da agenda, em
`pages/gerencia-pets.html`. O formulário inclui identificação, características,
história, cuidados e até seis fotos por endereço. Dados clínicos estruturados já
existentes são preservados. Fotos possuem descrição e prévia; não há serviço de
upload de arquivos. A busca pública na página inicial filtra nome/raça, espécie e porte.

Pets sem visitas podem ser excluídos fisicamente, junto de sua mídia. Quando há
histórico, o DELETE retorna uma orientação para arquivar; o histórico e seus vínculos
são preservados. Arquivados saem da consulta pública e podem ser reativados.
Antes de retirar a disponibilidade, visitas pendentes/confirmadas a partir de hoje
precisam ser resolvidas. O CRUD usa as tabelas já preparadas, sem migração adicional.

Visitas são aceitas de terça a sábado, entre 09:00 e 15:00, exceto 12:00–13:00, no horário de Brasília. O formulário sugere horas inteiras; a API aceita minutos dentro da faixa. Pets precisam estar disponíveis tanto na solicitação quanto na confirmação/remarcação. Repetir uma solicitação ativa para a mesma conta, pet e horário devolve o registro existente. A remarcação exige nova confirmação. Usuários só consultam/alteram suas próprias visitas; gerentes autorizados gerenciam a agenda. A interface Minhas visitas verifica atualizações a cada 30 segundos enquanto visível. Notificações ficam no sistema; não há envio automático externo.

O botão **Agendar visita** da ficha abre diretamente
`pages/agendar-visita.html?pet_id=<id>`, com nome e foto do animal, sem passar pelo
tutorial. O pet e o preenchimento são preservados ao entrar na conta. A solicitação
e a confirmação da gerência mencionam o nome do pet; o retorno aparece em Minhas
visitas. QR Code não faz parte do fluxo.

As operações POST recebem JSON. Prefira servir frontend e API na mesma origem, mantendo `apiBaseUrl` vazio em `config.js`; a validação de origem atual bloqueia operações de escrita provenientes de outra origem.

## Prévia estática

```powershell
python -m http.server 8000
```

Acesse `http://localhost:8000`. Essa opção permite visualizar as páginas, mas não executa a API: cadastro, login e gravação de visitas dependem do Flask. Evite abrir os HTML por `file://`, pois os módulos JavaScript precisam de um servidor HTTP.

## Implantação

O repositório inclui `vercel.json` e `api/index.py` para encaminhar `/api/*` ao Flask, além de um `Procfile` com `gunicorn app:app` para ambientes compatíveis. GitHub Pages serve apenas a parte estática.

Antes de publicar, prepare as tabelas de suporte, configure SECRET_KEY e DATABASE_URL, defina GERENTES_IDS e valide sessão e persistência na hospedagem. Não use o servidor de depuração em produção. Use HTTPS. O colega responsável pela hospedagem deve validar a integração após a preparação; esta entrega não publica mudanças automaticamente.

Esta documentação descreve o código local. Não confirma o funcionamento da implantação remota.

## Fluxo direto

Tutoriais, painéis ilustrativos, formulário de visita duplicado e mapa fictício
foram retirados da navegação. `pages/catalogo.html` consulta o banco e usa os mesmos
filtros da página inicial. O endereço antigo `pages/como-funciona.html` redireciona
ao catálogo, ou ao formulário direto quando recebe `pet_id`. Mensagens de validação
e ajuda dos campos permanecem para orientar o preenchimento real.

## Validação

Para a apresentação de IHC e WEB I, consulte `ENTREGA_ACADEMICA.md` e
`IHC/Checklist-validacao.md`. A suíte inclui o CRUD completo, exclusão com/sem
histórico, busca, correção de erros, navegação por teclado e telas pequenas.

```powershell
python -m unittest discover -s tests
node --test tests/pet-data.test.mjs
```

Os testes Python usam SQLite em memória, com inicialização automática desativada antes de importar a aplicação. Os cenários de navegador estão em `tests/browser_security.cjs` e exigem o ambiente Playwright descrito no próprio script.

## Acessibilidade e pesquisa

O frontend tem como meta WCAG 2.2 AA e inclui HTML semântico, links para pular ao conteúdo, campos com rótulos, mensagens de erro acessíveis, foco visível e tratamento de movimento reduzido. Esses recursos não equivalem a uma certificação de conformidade.

A persona Camila Souza, a jornada e a pesquisa em `IHC/` orientam as etapas de adoção e os conteúdos sobre custos e adaptação. As referências visuais estão em `inspiracoes/`; o projeto também consultou exemplos do Mobbin. Os créditos das fotos locais estão em `assets/img/CREDITOS.md`.

## Limitações e próximos passos

- Recuperação de senha e acompanhamento da adoção após as visitas continuam fora desta versão.
- Envio de e-mail/SMS/WhatsApp requer escolha e configuração de um provedor; a confirmação já aparece em Minhas visitas.
- Capacidade simultânea por horário e feriados precisam ser definidos pela clínica; não se presume capacidade de uma visita.
- Várias clínicas exigem isolamento por unidade.
- Definir contas gerentes e validar o backend remoto antes de publicar.
- Substituir dados e fotos demonstrativos por registros autorizados das ONGs.

## Autoria das telas

| Arquivo ou área | Responsável |
| --- | --- |
| `assets/css/global.css` | José Paulo |
| Login | José Paulo |
| Cadastro | Ana Clara |
| Início | Lucas |
| `IHC/` | Pesquisa e jornada levantadas por Victor Seixas |

## Recuperação de senha

O link **Esqueci minha senha** no login envia uma mensagem ao endereço cadastrado.
O link de redefinição expira em 30 minutos. Ao redefinir a senha, os links emitidos
para a senha anterior perdem a validade e as sessões dessa conta são encerradas.

No ambiente do backend, configure `SB_PUBLIC_URL` com a origem HTTPS do site
(sem caminho), `SMTP_HOST` e `SMTP_FROM` com um remetente autorizado pelo provedor.
O envio usa SMTP com STARTTLS na porta 587. Para um provedor autenticado, defina
também `SMTP_USER` e `SMTP_PASSWORD` nas variáveis privadas do ambiente.

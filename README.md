# Sem Barreiras Pet

Plataforma acadêmica de adoção responsável que aproxima adotantes de ONGs e abrigos. O frontend usa HTML, CSS e JavaScript puro; o backend usa Flask, SQLAlchemy e PostgreSQL, com alternativa SQLite para desenvolvimento local.

## Estado atual

| Área | Implementação no código local |
| --- | --- |
| Início | Apresentação e quatro pets fictícios em destaque |
| Login e cadastro | Integração com a API, senhas com hash e sessão por cookie |
| Ficha do pet | Consulta à API; dados demonstrativos locais como alternativa de leitura |
| Visitas | Solicitação gravada no banco, exigindo usuário autenticado; não confirma visita nem notifica o abrigo |
| Contato | Formulário demonstrativo: valida os campos, sem enviar ou salvar mensagens |
| Como funciona | Etapas de adoção, exemplos, FAQ e mapa opcional |
| Privacidade | Página HTML estática; API separada para a política cadastrada no banco |
| Catálogo | API com filtros por espécie e porte; página completa de catálogo ainda pendente |

Os pets, abrigos e endereços demonstrativos são fictícios. O banco é inicialmente preenchido com Nina; os demais exemplos das fichas estão em `assets/js/data/pets.js`.

## Estrutura

```text
app.py                     aplicação Flask, arquivos públicos e rotas de API
api/index.py               entrada serverless para o Vercel
config.py                  configuração do backend e conexão com o banco
config.js                  configuração pública do frontend e Google Maps
database.py                instância compartilhada do SQLAlchemy
models.py                  modelos e serialização dos dados
seed.py                    criação de tabelas e inserção dos dados iniciais
index.html                 página inicial
privacidade.html           política apresentada no site
pages/                     login, cadastro, contato, como funciona, quem somos e ficha
assets/css/                estilos compartilhados e de cada página
assets/js/main.js          navegação e carregamento dos módulos
assets/js/data/pets.js      dados fictícios das fichas
assets/js/modules/         API, formulários, ficha, mapas e agendamento
tests/                     testes Python, JavaScript e navegador
IHC/                       pesquisa documental, persona e jornada
inspiracoes/               referências visuais
```

`auth-demo.js` mantém o nome histórico, mas login e cadastro usam a API real. Somente o formulário de contato continua demonstrativo.

## Executar localmente

Na raiz do projeto, com Python instalado:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
# Preencha SECRET_KEY no .env com uma chave aleat?ria antes de continuar.
.\.venv\Scripts\python.exe app.py
```

Se `.venv` ou `.env` já existirem, reutilize-os sem sobrescrever sua configuração. Acesse `http://localhost:5000`. O comando `python app.py` inicia o servidor de desenvolvimento com depuração; não deve ser usado como servidor de produção.

No ambiente portátil já preparado nesta pasta, o executável Python pode estar em `.venv/python.exe`, em vez de `.venv/Scripts/python.exe`.

### Configuração do banco e da sessão

Configure no `.env`:

- `DATABASE_URL`: conexão PostgreSQL no formato `postgresql+psycopg2://USUARIO:SENHA@HOST:5432/BANCO`.
- `SECRET_KEY`: valor aleatório e secreto para assinar sessões. O valor de desenvolvimento não serve para produção.
- `SB_AUTO_INIT_DB=0`: desativa a criação automática de tabelas e dados ao carregar a aplicação. Por padrão, a inicialização está habilitada.

Para usar SQLite explicitamente em desenvolvimento, configure `DATABASE_URL=sqlite:///sembarreiras.db`. Com a configuração padrão apontando para PostgreSQL local, `config.py` usa SQLite na raiz do projeto se a porta local do PostgreSQL estiver indisponível. Isso não comprova conexão com PostgreSQL.

Não versione `.env` ou bancos locais. Alterar a chave de sessão invalida cookies assinados com a chave anterior.

### Inicializar tabelas e dados

A inicialização está centralizada em `seed.py` e pode ser acionada pelo Flask:

```powershell
$env:SB_AUTO_INIT_DB = '0'
python -m flask --app app init-db
```

Use o Python do seu ambiente virtual. Também existe a entrada `python seed.py`. A variável acima evita a inicialização automática antes da execução explícita.

A rotina cria as tabelas ausentes e insere uma política de privacidade com seis seções, o pet Nina e uma conta demonstrativa quando esses registros não existem. Repetir a rotina preserva os registros existentes. `db.create_all()` não migra a estrutura de tabelas já criadas.

`setup_db.py` e `atualizar_textos.py` foram removidos: suas funções de criação de tabelas e inserção inicial da política já estão em `seed.py`. A antiga operação que apagava e substituía todas as seções não foi mantida; revisões de políticas existentes exigem atualização deliberada dos dados.

## API

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

As operações POST recebem JSON. Prefira servir frontend e API na mesma origem, mantendo `apiBaseUrl` vazio em `config.js`; a validação de origem atual bloqueia operações de escrita provenientes de outra origem.

## Prévia estática

```powershell
python -m http.server 8000
```

Acesse `http://localhost:8000`. Essa opção permite visualizar as páginas, mas não executa a API: cadastro, login e gravação de visitas dependem do Flask. Evite abrir os HTML por `file://`, pois os módulos JavaScript precisam de um servidor HTTP.

## Implantação

O repositório inclui `vercel.json` e `api/index.py` para encaminhar `/api/*` ao Flask, além de um `Procfile` com `gunicorn app:app` para ambientes compatíveis. GitHub Pages serve apenas a parte estática.

Antes de publicar, configure o banco e a chave de sessão no ambiente de hospedagem, revise a criação automática da conta demonstrativa e valide sessão e persistência. A implementação atual ainda possui chave padrão de desenvolvimento e cria uma conta com credencial fixa no seed; esses pontos precisam ser tratados para produção.

Esta documentação descreve o código local. Não confirma o funcionamento da implantação remota.

## Google Maps opcional

Preencha `googleMapsApiKey` em `config.js` para habilitar o mapa. Sem chave, a página mostra o endereço em texto. Use uma chave de navegador restrita ao domínio e à Maps JavaScript API; nunca coloque segredos de servidor nesse arquivo público.

## Validação

```powershell
python -m unittest discover -s tests
node --test tests/pet-data.test.mjs
```

Os testes Python usam SQLite em memória, com inicialização automática desativada antes de importar a aplicação. Os cenários de navegador estão em `tests/browser_security.cjs` e exigem o ambiente Playwright descrito no próprio script.

## Acessibilidade e pesquisa

O frontend tem como meta WCAG 2.2 AA e inclui HTML semântico, links para pular ao conteúdo, campos com rótulos, mensagens de erro acessíveis, foco visível e tratamento de movimento reduzido. Esses recursos não equivalem a uma certificação de conformidade.

A persona Camila Souza, a jornada e a pesquisa em `IHC/` orientam as etapas de adoção e os conteúdos sobre custos e adaptação. As referências visuais estão em `inspiracoes/`; o projeto também consultou exemplos do Mobbin. Os créditos das fotos locais estão em `assets/img/CREDITOS.md`.

## Limitações e próximos passos

- Implementar catálogo completo e painel da ONG para avaliar solicitações.
- Implementar recuperação de senha, notificações e acompanhamento real da adoção.
- Contato e painel de acompanhamento ainda são demonstrações.
- Revisar os textos da política no banco: há descrições de recursos planejados que ainda não estão implementados, como exclusão pelo perfil e notificações por e-mail.
- Preparar autenticação e inicialização para produção e validar o backend remoto.
- Substituir dados e fotos demonstrativos por registros autorizados das ONGs.

## Autoria das telas

| Arquivo ou área | Responsável |
| --- | --- |
| `assets/css/global.css` | José Paulo |
| Login | José Paulo |
| Cadastro | Ana Clara |
| Início | Lucas |
| `IHC/` | Pesquisa e jornada levantadas por Victor Seixas |

# Arquitetura

## Visão geral

```
Navegador ──► frontend/ (HTML + CSS + JS puro, servidor estático)
                 │  fetch JSON (CORS restrito)
                 ▼
             backend/ (Flask, API REST em /api)
                 │  SQLAlchemy 2.0
                 ▼
             PostgreSQL (docker-compose.yml)
```

O front-end e o back-end são independentes: o front-end pode ser publicado em qualquer
servidor estático e continua utilizável sem a API (conteúdo essencial está no HTML).
A API não renderiza páginas; apenas expõe JSON.

## Front-end (`frontend/`)

| Camada | Arquivos | Papel |
| --- | --- | --- |
| Páginas | `index.html`, `pages/*.html` | Conteúdo semântico e acessível; funcionam sem JavaScript |
| Estilos base | `assets/css/global.css` | Tokens do design system original, foco visível (anel duplo), reduced-motion |
| Componentes | `assets/css/components.css` | Cabeçalho, menu, botões, rodapé e selo "demonstrativo" das páginas públicas |
| Estilos de página | `home.css`, `como-funciona.css`, `login.css`, `cadastro.css` | Somente o que é específico de cada tela |
| JS de entrada | `assets/js/main.js` | Menu mobile; carrega `config.js` e inicializa módulos sob demanda |
| Módulos | `assets/js/modules/*.js` | `api.js` (HTTP + erros), `maps.js` (Google Maps), `scheduling-form.js` (visitas) |
| Configuração | `config.example.js` → `config.js` | URL da API, chave do Maps, usuário demo. `config.js` não é versionado |

Princípios:

- **Aprimoramento progressivo**: sem JS, o menu fica aberto, o endereço do abrigo e o FAQ
  (`<details>`) continuam acessíveis; o JS só acrescenta comportamento.
- **Módulos ES nativos**, sem build. Exigem servir por HTTP (não `file://`).
- Ordem de CSS: `global.css` → `components.css` → CSS da página.

## Back-end (`backend/`)

```
app/
├── __init__.py          create_app(): Application Factory
├── config.py            Development / Testing / Production (lê o .env da raiz)
├── extensions.py        db (Flask-SQLAlchemy), migrate (Flask-Migrate), cors
├── models/              User, Shelter, Pet, Visit (+ base.py: timestamps e enums)
├── schemas/visit.py     validação do payload de visita (manual, mensagens em pt-BR)
├── services/            regras de negócio (scheduling_service.py)
├── api/                 blueprints: health, shelters, visits (prefixo /api)
├── utils/errors.py      APIError/ValidationError/NotFoundError + handlers JSON
└── seed.py              dados fictícios de desenvolvimento
manage.py                CLI (run, db, seed, frontend-config)
wsgi.py                  ponto de entrada para servidores WSGI
migrations/              Alembic (via Flask-Migrate)
tests/                   pytest
```

### Application Factory e Blueprints

`create_app(config_name)` cria uma aplicação nova a cada chamada, o que permite configurações
diferentes para desenvolvimento, testes e produção sem estado global. Cada recurso tem seu
blueprint (`health`, `shelters`, `visits`), todos aninhados em `api_bp` com prefixo `/api`.

Fluxo de uma requisição: **rota** (HTTP, status, JSON) → **schema** (formato e regras de data) →
**serviço** (existência das entidades, regras de negócio, commit) → **modelo**.
As rotas não acessam regras de negócio diretamente; os serviços não conhecem HTTP.

### Configuração

| Variável | Uso |
| --- | --- |
| `FLASK_ENV` | Seleciona a classe de configuração (o Flask 3 não a usa mais internamente) |
| `SECRET_KEY` | Obrigatória em produção; em desenvolvimento uma temporária é gerada |
| `DATABASE_URL` | `postgresql+psycopg://...` |
| `CORS_ORIGINS` | Lista separada por vírgula; padrão de dev `localhost:8000` |
| `GOOGLE_MAPS_API_KEY` | Repassada ao front-end por `manage.py frontend-config` |

Produção falha na inicialização se `SECRET_KEY` ou `DATABASE_URL` estiverem ausentes.

## Modelo de dados

```
users 1 ──── * visits * ──── 1 shelters 1 ──── * pets
                  * ─────────────────────────────── 0..1 pets
```

| Tabela | Destaques |
| --- | --- |
| `users` | `email` único (normalizado em minúsculas), `password_hash` (Werkzeug), nunca exposto em JSON |
| `shelters` | endereço estruturado, `state` com 2 letras, `latitude`/`longitude` em par e com faixa válida, `is_active` |
| `pets` | `shelter_id` obrigatório, `adoption_status`: disponivel / reservado / adotado / indisponivel |
| `visits` | `user_id` e `shelter_id` obrigatórios, `pet_id` opcional (`SET NULL`), `scheduled_at` em UTC, `status`: solicitado / confirmado / cancelado / concluido |

- Enums gravados como `VARCHAR + CHECK` (`native_enum=False`): adicionar um valor é uma migration simples.
- Convenção de nomes de constraints (`extensions.py`) para que o Alembic consiga alterá-las depois.
- Exclusões de usuário/abrigo com visitas são bloqueadas (`RESTRICT`): histórico não some por acidente.
- `created_at`/`updated_at` em todas as tabelas, com default no banco e na aplicação.

## Fluxo de solicitação de visita

1. A página `como-funciona.html` mostra o abrigo em HTML estático (nome, endereço, horários).
2. `maps.js` tenta `GET /api/shelters/<id>` para atualizar coordenadas e, se houver chave,
   carrega o Google Maps. Qualquer falha mantém o fallback textual.
3. A pessoa escolhe data e horário. `scheduling-form.js` valida (obrigatórios, data não passada).
4. Em **modo prévia** (padrão) nada é enviado; uma mensagem explica o motivo.
   Em **modo demonstração** (dev, `config.js` com `apiBaseUrl` e `demoUserId`) envia
   `POST /api/visits` com `scheduled_at` em ISO 8601 com offset do navegador.
5. A API valida de novo (fonte da verdade), confere usuário/abrigo/pet e grava com status `solicitado`.
6. Resposta 201 → mensagem de sucesso com protocolo e o lembrete de que a ONG precisa confirmar.
   422 → erros associados aos campos; erro de rede → mensagem e dados preservados.

## Evolução prevista

- **Autenticação**: sessão com cookie `HttpOnly` (Flask-Login) ou token. O `user_id` sairá do
  corpo de `POST /api/visits` e virá do usuário autenticado; `ALLOW_DEMO_USER_ID` será removido.
  O modelo `User` já guarda `password_hash`. O cadastro (`pages/cadastro.html`) passará a enviar
  para `POST /api/users`.
- **Catálogo real**: `GET /api/pets` com filtros (espécie, porte, idade, temperamento,
  necessidades especiais) e `pages/catalogo.html`. Os links "Encontrar um pet" hoje apontam
  temporariamente para `index.html#pets-destaque` (marcados com comentário `TEMPORÁRIO`).
- **Disponibilidade**: tabela de horários por abrigo, limite de visitas por faixa, bloqueio de
  conflitos e fuso por abrigo. Hoje a API só impede datas passadas e além de 180 dias.
- **Painel da ONG**: confirmar/cancelar visitas (`PATCH /api/visits/<id>`), `shelter_notes`.
- **Mapa**: autocomplete de endereço no cadastro de abrigos com Places API (New).
- **Página gerada a partir da API**: listar abrigos reais em vez do abrigo estático de demonstração.

## Por que HTML/CSS/JS puro nesta fase

Ver [ADR 001](decisions/001-frontend-backend-structure.md). Em resumo: o projeto é acadêmico,
a equipe já domina HTML/CSS, as telas são poucas e majoritariamente estáticas, e acessibilidade
fica mais previsível com HTML semântico servido pronto. Um framework pode ser adotado depois
sem alterar a API.

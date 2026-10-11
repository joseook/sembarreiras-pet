# Sem Barreiras Pet

Plataforma acadêmica de adoção responsável que aproxima pessoas interessadas em adotar de ONGs e abrigos.
Começou como protótipo de IHC em HTML semântico e CSS puro e agora ganha uma página "Como funciona"
completa e a fundação de uma API em Python/Flask com PostgreSQL.

## O problema

ONGs e abrigos independentes enfrentam caos na triagem de adotantes, no controle de vacinas e na divulgação de animais para feiras de adoção. Ao mesmo tempo, adotantes de primeira viagem precisam de informação confiável para reduzir a ansiedade e tomar uma decisão responsável.

## Oportunidade em IHC

O projeto trabalha com personas de alto apelo emocional: o adotante de primeira viagem, que sente dúvidas e responsabilidade, e o voluntário sobrecarregado, que precisa organizar informações e reduzir tarefas repetitivas. Esses perfis ajudam a construir mapas de empatia ricos e uma jornada que considera descoberta, filtros, perfil do animal, pré-adoção, avaliação, aprovação e acompanhamento posterior.

A página "Como funciona" responde diretamente à persona Camila Souza e à jornada em `IHC/`: explica as etapas sem pressa, deixa claro que a ONG avalia cada pedido, fala de custos e adaptação (as principais dificuldades citadas na pesquisa) e inclui, nos exemplos de pets, um animal idoso e um com deficiência, perfis que a pesquisa aponta como os mais preteridos.

## Escopo da plataforma

- Catálogo público com filtros por porte, espécie, temperamento e necessidades especiais.
- Formulário de pré-adoção e triagem com dados pessoais, moradia e contato.
- Painel administrativo da ONG para aprovar ou reprovar cadastros e atualizar o status da adoção.
- Perfis de animais com informações de saúde, vacinas, comportamento e histórico.
- Agendamento de visitas aos abrigos, com localização no mapa.
- Orientação para adaptação e suporte pós-adoção.

## Estado atual

| Área | Situação |
| --- | --- |
| Home (`index.html`) | Redesenhada (tema creme + terracota, `assets/css/tema.css`). Pets linkam para a ficha |
| Ficha do pet (`pages/pet.html?id=nina`) | Nova. Raça, idade, vacinas, doenças atuais e passadas, exames, convivência e cuidados. Dados fictícios em `assets/js/data/pets.js` |
| Login e cadastro (`frontend/pages/`) | Telas estáticas (José Paulo e Ana Clara). **Não autenticam nem salvam dados** |
| Como funciona (`frontend/pages/como-funciona.html`) | Nova. Etapas, prévia de catálogo, agendamento, FAQ |
| Mapa do abrigo | Funciona com chave do Google Maps; sem chave mostra endereço em texto (fallback) |
| Formulário de visita | **Modo prévia** por padrão (valida, não envia). Envia de verdade em **modo demonstração**, só em desenvolvimento |
| API Flask | `GET /api/health`, `GET /api/shelters`, `GET /api/shelters/<id>`, `POST /api/visits`, `GET /api/visits/<id>` |
| Banco | PostgreSQL com migration inicial e seed de dados fictícios |
| Autenticação, catálogo real, filtros, painel da ONG | **Ainda não implementados** |

Todos os abrigos, endereços e pets de exemplo são **fictícios** e aparecem marcados como "Dados demonstrativos".

## Estrutura

```
sembarreiras-pet/
├── README.md, .env.example, .gitignore, docker-compose.yml
├── docs/                    arquitetura, API, setup e decisões (ADR)
├── frontend/                site estático (HTML, CSS, JS puro)
│   ├── index.html
│   ├── pages/               login, cadastro, como-funciona
│   ├── assets/css/          global, components, home, login, cadastro, como-funciona
│   ├── assets/js/           main.js + modules/ (api, maps, scheduling-form)
│   └── config.example.js    modelo de configuração (config.js não é versionado)
├── backend/                 API Flask
│   ├── app/                 factory, config, models, schemas, services, api, utils
│   ├── migrations/          Alembic (Flask-Migrate)
│   ├── tests/               pytest
│   ├── manage.py, wsgi.py, requirements.txt
├── IHC/                     persona, jornada e pesquisa documental
└── inspiracoes/             referências visuais (antes "inspirações/")
```

Detalhes em [docs/architecture.md](docs/architecture.md).

## Pré-requisitos

- Python 3.12+ (também testado com 3.14)
- Docker com Docker Compose **ou** PostgreSQL 14+ local (somente para a API)
- Um navegador moderno

## Executar o front-end

Na raiz do repositório:

```bash
python3 -m http.server 8000 -d frontend
```

Acesse `http://localhost:8000`. Abrir os arquivos com duplo clique (`file://`) mostra o conteúdo, mas os
módulos JavaScript não carregam; use sempre um servidor estático.

Sem API e sem `config.js`, o site funciona em modo prévia: o console mostra um 404 para `config.js`, o que é esperado.

## Executar o back-end

Passo a passo completo em [docs/setup.md](docs/setup.md). Resumo:

```bash
cp .env.example .env                 # ajuste SECRET_KEY e senha do banco
docker compose up -d db              # sobe só o PostgreSQL (volume persistente)

cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python manage.py db upgrade          # migrations
python manage.py seed                # dados FICTÍCIOS de desenvolvimento
python manage.py frontend-config     # gera frontend/config.js (modo demonstração + Maps)
python manage.py run                 # http://localhost:5000/api/health
```

## Testes

```bash
cd backend && source .venv/bin/activate
pytest
```

Os testes usam **SQLite em memória** (isolado, sem precisar do PostgreSQL). Os modelos evitam recursos
exclusivos do PostgreSQL, então os cenários testados se comportam igual. Para rodar contra um PostgreSQL
descartável, defina `TEST_DATABASE_URL`.

## Google Maps sem expor a chave

1. No Google Cloud Console, ative a **Maps JavaScript API** e crie uma chave de navegador.
2. Restrinja a chave por **HTTP referrer** (ex.: `http://localhost:8000/*` e o domínio de produção) e por API.
3. Coloque a chave em `GOOGLE_MAPS_API_KEY` no `.env` (nunca no código).
4. Rode `python manage.py frontend-config` para gerar `frontend/config.js`, que está no `.gitignore`.

Chaves de navegador ficam visíveis para quem acessa o site (é assim que o Google Maps funciona);
a proteção está nas restrições acima. O módulo usa o carregamento atual (`loading=async`,
`importLibrary`, `AdvancedMarkerElement`). Para autocomplete de endereços no futuro, use a
**Places API (New)**, não a biblioteca legada `places`.

## Acessibilidade

O protótipo segue como meta o nível AA da WCAG 2.2 e inclui:

- HTML semântico com `header`, `nav`, `main`, `section`, `article`, `footer`, `fieldset` e `legend`.
- Skip link para o conteúdo principal e um único `h1` por página, com hierarquia de headings sem saltos.
- Relação explícita entre todos os `label` e seus campos por meio de `for`/`id`.
- Campos obrigatórios com `required` e indicação textual acessível.
- Textos de auxílio e mensagens de erro conectados com `aria-describedby`; erros marcados com `aria-invalid`, foco no primeiro campo inválido.
- Mensagens de envio em região `aria-live`.
- Texto alternativo contextual para imagens informativas; ilustrações decorativas ocultas de leitores de tela.
- Contraste de cores definido no design system; estados que não dependem só de cor (texto, ícone, borda).
- Foco visível por `:focus-visible`, sem remover `outline`.
- FAQ com `<details>`/`<summary>` nativos, sem JavaScript.
- Menu e conteúdo essencial funcionam sem JavaScript (aprimoramento progressivo).
- Unidades relativas, layout responsivo sem rolagem horizontal a partir de 320 px (equivalente a 1280 px com zoom de 400%).
- Respeito a `prefers-reduced-motion`.

## Limitações atuais e próximos passos

- Sem autenticação: o cadastro e o login não funcionam; visitas usam um usuário fictício só em desenvolvimento.
- Sem catálogo real: "Encontrar um pet" aponta temporariamente para `index.html#pets-destaque`
  (procure por `TEMPORÁRIO` nos HTML) até existir `pages/catalogo.html`.
- O abrigo da página "Como funciona" está fixo no HTML (demonstração).
- A API não controla disponibilidade de horários nem conflitos; apenas impede datas passadas.
- As fotos dos pets da home vêm de URLs externas (instáveis) e devem ser substituídas por imagens próprias em
  `frontend/assets/img/`. Na página "Como funciona", a foto do topo e as dos pets fictícios são do Unsplash
  (licença livre, salvas no repositório; créditos em `frontend/assets/img/CREDITOS.md`) e devem ser trocadas
  por fotos enviadas pelas ONGs quando o catálogo real existir.
- O painel "Acompanhe seu pedido" (etapa 4) é um exemplo estático; será preenchido pela API quando houver
  autenticação e pedidos de adoção.

Próximos passos sugeridos: autenticação, `GET /api/pets` com filtros e página de catálogo, painel da ONG
para confirmar visitas e agenda de disponibilidade. Detalhes em [docs/architecture.md](docs/architecture.md#evolução-prevista).

## Autoria das telas

| Arquivo | Responsável |
| --- | --- |
| `frontend/assets/css/global.css` | José Paulo (design system base) |
| `frontend/pages/login.html` / `login.css` | José Paulo |
| `frontend/pages/cadastro.html` / `cadastro.css` | Ana Clara |
| `frontend/index.html` / `home.css` (antigo `index.css`) | Lucas |
| `IHC/` | Persona, jornada e pesquisa documental (jornada e pesquisa levantadas por Victor Seixas) |

## Documentação

- [docs/setup.md](docs/setup.md) — ambiente local passo a passo
- [docs/architecture.md](docs/architecture.md) — camadas, modelos e fluxo de visita
- [docs/api.md](docs/api.md) — endpoints, payloads e respostas
- [docs/decisions/001-frontend-backend-structure.md](docs/decisions/001-frontend-backend-structure.md) — ADR

## Referências de pesquisa

As decisões de fluxo foram comparadas com referências do Mobbin para telas de login, cadastro e seções com imagens de pets. A identidade visual, o conteúdo e a estrutura foram adaptados às inspirações locais do projeto (`inspiracoes/`) e às regras de acessibilidade, sem copiar interfaces literalmente.

# Documentação Técnica do Back-end Python (Flask + PostgreSQL)
### Projeto: Sem Barreiras Pet

Esta documentação foi elaborada para que você e sua equipe compreendam com clareza como o back-end em Python foi estruturado, a responsabilidade de cada arquivo criado e como essa arquitetura se conecta de forma limpa e profissional com o banco de dados PostgreSQL.

---

## 1. Visão Geral da Arquitetura

O sistema adota o padrão de **Camadas Desacopladas**. Em vez de colocar todo o código misturado em um único arquivo com comandos SQL brutos, a responsabilidade foi dividida em componentes especializados:

```mermaid
flowchart TD
    subgraph Cliente["Navegador / Frontend"]
        HTML["Páginas HTML / Formulários"]
        JS["Módulos JS (Fetch API)"]
    end

    subgraph Backend["Servidor Flask"]
        App["app.py (Fábrica e Rotas REST)"]
        Config["config.py (.env)"]
        DB["database.py (SQLAlchemy Engine)"]
        Models["models.py (Entidades ORM)"]
    end

    subgraph Persistencia["Banco de Dados"]
        Postgres[("PostgreSQL\n(sembarreiras_db)")]
    end

    HTML --> JS
    JS -->|Requisições HTTP / JSON| App
    App --> Config
    App --> DB
    App --> Models
    Models --> DB
    DB -->|Driver psycopg2| Postgres
```

### Por que essa separação é importante?
1. **Segurança:** As credenciais do banco e senhas não ficam expostas no código.
2. **Manutenibilidade:** Seus colegas podem alterar colunas ou tabelas diretamente na classe Python (`models.py`) sem ter que reescrever consultas SQL manualmente em vários lugares.
3. **Desacoplamento:** O front-end estático continua funcionando normalmente e ganha suporte a endpoints de API estruturados em JSON.

---

## 2. Detalhamento Arquivo por Arquivo

Abaixo está a explicação de cada arquivo criado e modificado no projeto:

### 2.1. `requirements.txt`
Define a lista de bibliotecas externas necessárias para a aplicação rodar.

* **`Flask`**: O microframework web que gerencia o servidor HTTP, as rotas e as respostas (JSON e arquivos estáticos).
* **`Flask-SQLAlchemy`**: Um ORM (*Object-Relational Mapping*). Ele traduz objetos e classes do Python em comandos SQL do PostgreSQL automaticamente.
* **`psycopg2-binary`**: O driver C/Python que realiza a comunicação de baixo nível entre o Python e o motor do PostgreSQL.
* **`python-dotenv`**: Lê arquivos `.env` e carrega variáveis de ambiente de forma transparente.
* **`Werkzeug`**: Conjunto de utilitários de segurança do Flask, usado aqui principalmente para gerar hashes criptografados de senhas (`generate_password_hash` e `check_password_hash`).

---

### 2.2. `.env.example` e `.env`
Gerenciamento de segredos e configurações do ambiente (prática recomendada pelos padrões *12-Factor App*).

* **O que faz:** Guarda variáveis como a URL de conexão do banco de dados (`DATABASE_URL`), nível de debug (`FLASK_DEBUG`) e chave de sessão (`SECRET_KEY`).
* **Regra importante:** O arquivo `.env` contém credenciais reais do seu computador e **nunca** deve ser commitado no Git (já está protegido no `.gitignore`). O arquivo `.env.example` é o modelo versionado que seus colegas usam como referência.
* **Exemplo de URL do Postgres:**
  ```ini
  DATABASE_URL=postgresql+psycopg2://postgres:postgres@localhost:5432/sembarreiras_db
  ```
  Onde: `postgres` (usuário) : `postgres` (senha) @ `localhost` (servidor) : `5432` (porta) / `sembarreiras_db` (nome do banco).

---

### 2.3. `config.py`
Centraliza toda a inteligência de configuração da aplicação.

* **Leitura do `.env`:** Invoca `load_dotenv()` logo na inicialização para carregar as variáveis.
* **Tratamento de Dialeto:** Converte automaticamente URLs com prefixo legado `postgres://` para o padrão explícito `postgresql+psycopg2://`.
* **Configuração de Pool:** Define opções como `pool_pre_ping=True` (garante que conexões inativas ou reabertas pelo PostgreSQL não gerem exceções no servidor).

---

### 2.4. `database.py`
Responsável por isolar a instância do banco:

```python
from flask_sqlalchemy import SQLAlchemy
db = SQLAlchemy()
```

* **Por que existe em um arquivo separado?**  
  Para evitar o problema de **importação circular** (*circular dependency*). Os modelos (`models.py`) precisam do `db` para definir as tabelas, e a aplicação (`app.py`) precisa do `db` para inicializar a conexão. Ao colocar `db` em `database.py`, ambos os arquivos podem importá-lo de forma limpa.

---

### 2.5. `models.py`
Representa o esquema de dados do sistema em forma de classes Python relacionais.

```mermaid
erDiagram
    POLITICA_PRIVACIDADE ||--o{ SECOES_PRIVACIDADE : "possui"
    USUARIOS ||--o{ AGENDAMENTOS : "solicita"
    PETS ||--o{ AGENDAMENTOS : "tem"

    POLITICA_PRIVACIDADE {
        int id PK
        string versao
        date ultima_atualizacao
        boolean ativo
    }

    SECOES_PRIVACIDADE {
        int id PK
        int politica_id FK
        int ordem
        string titulo
        text conteudo
    }

    USUARIOS {
        int id PK
        string nome
        string email UK
        string telefone
        string senha_hash
        string tipo_moradia
        boolean consentimento
        datetime criado_em
    }

    PETS {
        string id PK
        string nome
        string especie
        string sexo
        string raca
        string status
        json vacinas
        json temperamento
    }

    AGENDAMENTOS {
        int id PK
        int usuario_id FK
        string pet_id FK
        date data_visita
        string horario
        text mensagem
        string status
    }
```

#### Principais Destaques dos Modelos:
1. **`PoliticaPrivacidade` e `SecaoPrivacidade`:** A inicialização das tabelas e da política está centralizada em `seed.py`, com chave estrangeira em cascata (`ondelete='CASCADE'`). Os scripts antigos `setup_db.py` e `atualizar_textos.py` foram removidos por redundância.
2. **`Usuario` (Segurança):** 
   - A senha crua **nunca** é gravada no banco. O método `set_senha(senha)` gera um hash unidirecional (ex.: `pbkdf2:sha256:...`).
   - O método `check_senha(senha)` compara a senha fornecida com o hash de forma resistente a ataques de temporização (*timing attacks*).
   - O método `to_dict()` serializa o usuário para o frontend omitindo propositalmente o hash da senha.
3. **`Pet`:** 
   - Utiliza campos relacionais comuns e campos do tipo `JSON` para armazenar estruturas flexíveis (como a lista de vacinas e históricos de saúde da ficha do pet).
4. **`Agendamento`:** 
   - Registra o vínculo da visita agendada ao abrigo por um adotante.

---

### 2.6. `seed.py`
Script utilitário para popular o banco de dados pela primeira vez (*data seeding*).

* **`db.create_all()`:** Conecta ao banco de dados e cria todas as tabelas mapeadas no `models.py` caso elas ainda não existam.
* **Carga Inicial da Política de Privacidade:** Insere a versão 1.0 e as 6 seções textuais atualizadas.
* **Carga do Pet Demonstrativo:** Cadastra a cachorrinha "Nina" com todo o seu prontuário de vacinas, temperamento e exames.
* **Carga de Usuário de Teste:** Cria a conta de teste `admin@sembarreiras.pet` (senha: `senha1234`).
* **Idempotência:** Antes de inserir qualquer registro, o script verifica se ele já existe para não gerar duplicidade.

---

### 2.7. `app.py`
O núcleo da aplicação Flask. Utiliza o padrão *Application Factory* (`create_app()`).

#### Rotas Estáticas (Frontend):
* `GET /`: Serve a página inicial `index.html`.
* `GET /privacidade`: Serve a página `privacidade.html`.
* `GET /<path:filename>`: Serve com segurança os arquivos das pastas `assets/` e `pages/`.

#### Rotas de API (Endpoints REST):
* `GET /api/status`: Permite testar a conexão com o PostgreSQL em tempo real, informando o driver e a lista de tabelas criadas.
* `GET /api/privacidade`: Retorna a política de privacidade e suas seções ordenadas em formato JSON.
* `GET /api/pets`: Retorna o catálogo de pets (suporta parâmetros de filtro como `?especie=Cachorro&porte=Médio`).
* `GET /api/pets/<id>`: Retorna a ficha completa de um animal específico.
* `POST /api/auth/cadastro`: Recebe os dados do formulário de cadastro, valida campos obrigatórios, confere e-mail duplicado e salva o novo usuário com senha criptografada.
* `POST /api/auth/login`: Autentica o e-mail e senha informados e armazena o ID na sessão (`session`).
* `GET /api/auth/me`: Retorna os dados do usuário conectado no momento.
* `POST /api/auth/logout`: Limpa a sessão.
* `POST /api/agendamentos`: Registra a intenção de visita ao abrigo.

#### Comando CLI:
* Adiciona o comando de terminal `flask init-db`, permitindo que os colegas executem a carga inicial diretamente pelo terminal do Flask.

---

### 2.8. `tests/test_backend.py`
Bateria de testes automatizados baseada no framework padrão `unittest`.

* Utiliza uma base de dados isolada em memória (`sqlite:///:memory:`), de modo que os testes rodam em menos de 2 segundos sem precisar que o PostgreSQL esteja instalado ou ligado na máquina local.
* Valida:
  1. Criação e integridade das tabelas via `seed.py`.
  2. Resposta do endpoint `/api/status`.
  3. Carga das seções em `/api/privacidade`.
  4. Consulta ao catálogo de pets em `/api/pets`.
  5. Fluxo completo de cadastro de usuário e validação de login (com credenciais certas e erradas).
  6. Registro de agendamento de visita em `/api/agendamentos`.

---

### 2.9. `GUIA_POSTGRES.md`
Documento enxuto e prático preparado especificamente para os seus colegas de equipe. Ele explica o passo a passo exato para:
1. Criar o banco no PostgreSQL (`CREATE DATABASE sembarreiras_db;`).
2. Configurar o `.env`.
3. Rodar `python seed.py`.
4. Iniciar a aplicação com `python app.py`.

---

## 3. Resumo dos Comandos Úteis

| Objetivo | Comando |
| --- | --- |
| Ativar o ambiente virtual | `.\venv\Scripts\Activate.ps1` |
| Executar todos os testes | `python -m unittest discover tests` |
| Criar tabelas e popular o banco | `python seed.py` ou `flask init-db` |
| Iniciar o servidor Flask | `python app.py` |
| Verificar se o banco conectou | Acessar no navegador: `http://127.0.0.1:5000/api/status` |

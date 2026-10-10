# Setup local (Linux)

Pré-requisitos: Python 3.12+, Docker com Docker Compose (ou um PostgreSQL 14+ local) e Git.
Todos os comandos partem da raiz do repositório, salvo indicação.

## 1. Variáveis de ambiente

```bash
cp .env.example .env
python3 -c "import secrets; print(secrets.token_hex(32))"   # cole o valor em SECRET_KEY
```

Edite `.env`: troque `POSTGRES_PASSWORD` e repita a mesma senha em `DATABASE_URL`.
Há um único `.env`, na raiz, lido pelo Flask e pelo Docker Compose.

## 2. PostgreSQL

Com Docker:

```bash
docker compose up -d db
docker compose ps          # aguarde o estado "healthy"
```

Sem Docker (PostgreSQL instalado no sistema):

```bash
sudo -u postgres createuser --pwprompt sembarreiras
sudo -u postgres createdb --owner sembarreiras sembarreiras_pet
```

## 3. Ambiente Python

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 4. Migrations e dados de desenvolvimento

```bash
python manage.py db upgrade      # cria as tabelas
python manage.py seed            # abrigo, pets e usuário FICTÍCIOS (idempotente)
```

## 5. Iniciar a API

```bash
python manage.py run            # http://localhost:5000
curl http://localhost:5000/api/health
```

## 6. Configuração do front-end (opcional)

```bash
python manage.py frontend-config   # gera frontend/config.js (ignorado pelo Git)
```

Ele usa `GOOGLE_MAPS_API_KEY` do `.env` e o id do usuário de demonstração do seed.
Sem esse arquivo, o site funciona em "modo prévia" (formulário não envia, mapa mostra o fallback).

## 7. Servir o front-end

Em outro terminal, na raiz do repositório:

```bash
python3 -m http.server 8000 -d frontend
```

Acesse `http://localhost:8000` e `http://localhost:8000/pages/como-funciona.html`.
Use um servidor HTTP: os módulos JavaScript (`type="module"`) não carregam via `file://`.
A porta 8000 é a que está liberada em `CORS_ORIGINS`; se mudar, atualize o `.env`.

## 8. Testes

```bash
cd backend && source .venv/bin/activate
pytest
```

Os testes usam SQLite em memória (não precisam do PostgreSQL). Para rodá-los contra um
PostgreSQL **descartável**: `TEST_DATABASE_URL=postgresql+psycopg://... pytest`.

## Problemas comuns

| Sintoma | Causa provável |
| --- | --- |
| `Configuração obrigatória ausente: DATABASE_URL` | `.env` não criado ou sem `DATABASE_URL` |
| `connection refused` na porta 5432 | PostgreSQL não está rodando (`docker compose up -d db`) |
| Formulário mostra "Modo prévia" | `frontend/config.js` ausente ou `demoUserId` vazio: rode `seed` e `frontend-config` |
| Erro de CORS no console | A origem do front-end não está em `CORS_ORIGINS` |
| "Mapa indisponível neste ambiente." | `GOOGLE_MAPS_API_KEY` vazia ou recusada pelo Google |

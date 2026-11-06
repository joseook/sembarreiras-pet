# Guia de Integração com PostgreSQL — Sem Barreiras Pet

Este documento orienta os desenvolvedores a configurar e integrar o banco de dados PostgreSQL com o back-end em Flask.

---

## 1. Pré-requisitos

1. **Python 3.10+** instalado.
2. **PostgreSQL** instalado e em execução (localmente ou via Docker).

---

## 2. Preparação do Ambiente Python

No terminal, na raiz do repositório:

### Windows (PowerShell):
```powershell
# 1. Ativar o ambiente virtual (caso já exista venv):
.\venv\Scripts\Activate.ps1

# Se ainda não criou a venv:
python -m venv venv
.\venv\Scripts\Activate.ps1

# 2. Instalar as dependências:
pip install -r requirements.txt
```

### Linux / macOS / Bash:
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

---

## 3. Configuração do PostgreSQL

### Passo 1: Criar o Banco de Dados
Acesse o terminal do PostgreSQL (`psql`) ou ferramenta como pgAdmin/DBeaver e crie a base de dados:

```sql
CREATE DATABASE sembarreiras_db;
```

### Passo 2: Configurar o arquivo `.env`
Copie o arquivo `.env.example` para `.env` (se ainda não existir):

```powershell
cp .env.example .env
```

Edite o arquivo `.env` com as credenciais do seu PostgreSQL local:

```ini
FLASK_ENV=development
FLASK_DEBUG=1
SECRET_KEY=sua-chave-secreta-aqui

# Ajuste com seu usuario, senha, host e porta:
DATABASE_URL=postgresql+psycopg2://postgres:postgres@localhost:5432/sembarreiras_db
```

---

## 4. Criação das Tabelas e Dados Iniciais (Seed)

Para criar automaticamente todas as tabelas no PostgreSQL e inserir os dados iniciais (Política de Privacidade, seções e pet demonstrativo), execute:

```powershell
python seed.py
```

*Alternativamente, usando a CLI do Flask:*
```powershell
flask init-db
```

---

## 5. Executar o Servidor Flask

```powershell
python app.py
```

O servidor iniciará em `http://127.0.0.1:5000/`.

---

## 6. Endpoints Disponíveis da API

| Método | Endpoint | Descrição |
| --- | --- | --- |
| `GET` | `/api/status` | Retorna o status da aplicação e a saúde da conexão com o PostgreSQL |
| `GET` | `/api/privacidade` | Retorna a política de privacidade ativa e suas seções ordenadas |
| `GET` | `/api/pets` | Lista todos os pets (aceita filtros `?especie=` e `?porte=`) |
| `GET` | `/api/pets/<id>` | Retorna os detalhes de um pet específico |
| `POST` | `/api/auth/cadastro` | Cadastra novo usuário (criptografa senha com hash) |
| `POST` | `/api/auth/login` | Autentica o usuário e cria a sessão |
| `GET` | `/api/auth/me` | Retorna os dados do usuário autenticado na sessão atual |
| `POST` | `/api/auth/logout` | Encerra a sessão do usuário |
| `POST` | `/api/agendamentos` | Registra solicitação de visita a um pet/abrigo |

---

## 7. Modelos Relacionais Implementados (`models.py`)

* **`politica_privacidade`**: Versão, data de atualização e status ativo.
* **`secoes_privacidade`**: Seções textuais vinculadas à política por chave estrangeira (`politica_id`) em cascata.
* **`usuarios`**: Nome, e-mail único, telefone, senha com hash seguro (`werkzeug.security`) e tipo de moradia.
* **`pets`**: Ficha completa do animal, incluindo campos JSON para vacinas, temperamento e exames.
* **`agendamentos`**: Relacionamento entre usuário, pet e data/horário de visita ao abrigo.

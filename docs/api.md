# API REST — Sem Barreiras Pet

Base: `http://localhost:5000/api` (desenvolvimento). Todas as respostas são JSON em UTF-8.

## Convenções

- Sucesso de item: `{"data": {...}}`
- Sucesso de lista: `{"data": [...], "meta": {"total": N}}`
- Erro (sempre o mesmo formato):

```json
{
  "error": {
    "code": "validation_error",
    "message": "Alguns dados precisam ser corrigidos.",
    "details": { "scheduled_at": "Escolha uma data e horário no futuro." }
  }
}
```

- Datas/horas: ISO 8601. As respostas vêm sempre em UTC (`...Z`). Na entrada, envie com offset
  (ex.: `2026-10-20T10:00:00-03:00`); sem offset, a API assume `APP_TIMEZONE` (padrão `America/Maceio`).
- CORS: apenas as origens de `CORS_ORIGINS`, métodos `GET`, `POST`, `OPTIONS`.

| Código | Quando |
| --- | --- |
| 200 | Leitura com sucesso |
| 201 | Recurso criado (visita) |
| 400 | Corpo não é JSON válido (`invalid_json`) |
| 404 | Recurso inexistente ou abrigo inativo (`not_found`) |
| 405 | Método não permitido |
| 422 | Dados inválidos (`validation_error`, com `details` por campo) |
| 501 | Visitas desabilitadas: ambiente sem modo demonstração e sem autenticação (`auth_not_implemented`) |
| 503 | Banco de dados indisponível (somente no health check) |
| 500 | Erro inesperado (`internal_error`) |

---

## `GET /api/health`

Verifica a API e a conexão com o banco.

**200**

```json
{ "status": "ok", "service": "sembarreiras-pet-api", "database": "ok" }
```

**503** — `{"status": "degraded", "service": "sembarreiras-pet-api", "database": "unavailable"}`

---

## `GET /api/shelters`

Lista os abrigos **ativos** (`is_active = true`) em ordem alfabética.

**200**

```json
{
  "data": [
    {
      "id": 1,
      "name": "Abrigo Patas Livres",
      "description": "Abrigo FICTÍCIO criado pelo seed de desenvolvimento. Não é uma entidade real.",
      "contact_phone": null,
      "contact_email": "contato@abrigo-patas-livres.invalid",
      "address": {
        "line": "Rua Demonstrativa, nº 000 (endereço fictício)",
        "neighborhood": "Bairro Exemplo",
        "city": "Maceió",
        "state": "AL",
        "postal_code": "00000-000",
        "full": "Rua Demonstrativa, nº 000 (endereço fictício), Bairro Exemplo, Maceió - AL, 00000-000"
      },
      "latitude": -9.6658,
      "longitude": -35.7353,
      "is_active": true,
      "updated_at": "2026-10-10T22:50:00Z"
    }
  ],
  "meta": { "total": 1 }
}
```

Com o banco vazio a lista vem vazia (`"data": [], "meta": {"total": 0}`). Rode `python manage.py seed`
para criar o abrigo de demonstração.

## `GET /api/shelters/<id>`

Detalhe de um abrigo ativo, no mesmo formato do item acima, dentro de `data`.
O front-end usa `latitude`/`longitude` daqui para posicionar o mapa.

- **200** — `{"data": { ...abrigo... }}`
- **404** — abrigo inexistente ou inativo.

---

## `POST /api/visits`

Cria uma solicitação de visita. Status inicial sempre `solicitado`; a ONG confirma depois.

> **Sem autenticação nesta fase.** O `user_id` vai no corpo e só é aceito com
> `ALLOW_DEMO_USER_ID` ativo (FLASK_ENV `development` ou `testing`). Em `production`
> os endpoints de visitas respondem **501** até a autenticação existir; depois disso o
> usuário virá da sessão/token e `user_id` deixará de ser aceito no corpo.

**Payload**

| Campo | Tipo | Obrigatório | Regras |
| --- | --- | --- | --- |
| `user_id` | inteiro | sim | > 0, usuário existente |
| `shelter_id` | inteiro | sim | > 0, abrigo existente e ativo |
| `pet_id` | inteiro ou `null` | não | pet do mesmo abrigo, com status `disponivel` ou `reservado` |
| `scheduled_at` | string ISO 8601 | sim | no futuro e em até 180 dias |
| `adopter_notes` | string ou `null` | não | até 1000 caracteres (espaços nas pontas são removidos) |

Campos desconhecidos (inclusive `status`) são ignorados.

```json
{
  "user_id": 1,
  "shelter_id": 1,
  "pet_id": null,
  "scheduled_at": "2026-10-20T10:00:00-03:00",
  "adopter_notes": "Gostaria de conhecer o Café."
}
```

**201** — cabeçalho `Location: /api/visits/2`

```json
{
  "data": {
    "id": 2,
    "user_id": 1,
    "shelter_id": 1,
    "pet_id": null,
    "scheduled_at": "2026-10-20T13:00:00Z",
    "status": "solicitado",
    "status_label": "Solicitado",
    "adopter_notes": "Gostaria de conhecer o Café.",
    "shelter_notes": null,
    "shelter": { "id": 1, "name": "Abrigo Patas Livres" },
    "created_at": "2026-10-10T22:54:29Z",
    "updated_at": "2026-10-10T22:54:29Z"
  }
}
```

**422** — data no passado:

```json
{
  "error": {
    "code": "validation_error",
    "message": "Alguns dados precisam ser corrigidos.",
    "details": { "scheduled_at": "Escolha uma data e horário no futuro." }
  }
}
```

**422** — corpo vazio `{}`: `details` contém `user_id`, `shelter_id` e `scheduled_at` com `"Campo obrigatório."`.

**422** — referências inexistentes: `{"user_id": "Usuário não encontrado.", "shelter_id": "Abrigo não encontrado ou indisponível."}`.

**400** — corpo não JSON: `{"error": {"code": "invalid_json", ...}}`.

## `GET /api/visits/<id>`

Detalhe de uma solicitação, no mesmo formato da resposta 201.

- **200** — `{"data": { ...visita... }}`
- **404** — visita inexistente.
- **501** — fora do modo demonstração (mesma regra do POST).

---

## Valores de status

| Recurso | Valor gravado | Rótulo |
| --- | --- | --- |
| `Pet.adoption_status` | `disponivel`, `reservado`, `adotado`, `indisponivel` | Disponível, Reservado, Adotado, Indisponível |
| `Visit.status` | `solicitado`, `confirmado`, `cancelado`, `concluido` | Solicitado, Confirmado, Cancelado, Concluído |

Os valores são gravados sem acento (estáveis para integrações); os rótulos com acento vêm em `*_label`.

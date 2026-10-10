# ADR 001 — Estrutura front-end / back-end

- **Status:** aceita
- **Data:** 2026-10-10

## Contexto

O protótipo tinha todos os arquivos HTML e CSS na raiz, sem JavaScript, back-end ou banco.
A próxima etapa precisa de uma página "Como funciona" com agendamento de visita e mapa,
uma API para abrigos e visitas, e uma base que a equipe consiga manter. A equipe é
acadêmica, já trabalha com HTML/CSS e tem a acessibilidade (WCAG 2.2 AA) como requisito central.

## Decisão

1. Separar o repositório em `frontend/` (estático) e `backend/` (API Flask), com `docs/` para documentação.
2. Manter o front-end em **HTML, CSS e JavaScript puro**, com módulos ES nativos e sem etapa de build.
   O conteúdo essencial fica no HTML; o JavaScript apenas aprimora.
3. Back-end em **Flask** com Application Factory, Blueprints, Flask-SQLAlchemy (SQLAlchemy 2.0),
   Flask-Migrate (Alembic) e **PostgreSQL**. Validação manual, sem Marshmallow, pela pouca quantidade de campos.
4. Um único `.env` na raiz para Flask e Docker Compose; o front-end recebe a configuração por um
   `config.js` gerado e não versionado.
5. Enquanto não há autenticação, as visitas usam um **usuário de demonstração** apenas em
   desenvolvimento; em produção os endpoints de visitas retornam 501.

## Consequências

- O front-end abre com qualquer servidor estático (`python3 -m http.server`) e pode ser publicado sem a API.
- Não há bundler: arquivos JS são carregados como estão. Isso limita bibliotecas de terceiros, de propósito.
- Os caminhos relativos mudaram (`pages/`, `assets/`); quem abria os arquivos da raiz precisa servir `frontend/`.
- A API pode ser consumida por um futuro front-end em framework, app mobile ou painel da ONG sem mudanças.
- Testes rodam em SQLite em memória (rápidos); diferenças específicas do PostgreSQL precisam de
  um teste opcional com `TEST_DATABASE_URL`.

## Alternativas descartadas

- **React/Vue/Angular ou Tailwind agora**: exigiriam build, aumentariam a curva de aprendizado e
  arriscariam regressões de acessibilidade nas telas que já existem, sem ganho proporcional para poucas páginas.
- **Templates Jinja servidos pelo Flask**: acoplariam o front-end ao back-end e impediriam publicar o
  protótipo como site estático.
- **Django**: mais completo, porém mais pesado do que o necessário para uma API pequena nesta etapa.
- **ENUM nativo do PostgreSQL**: alterar valores exige migrations mais delicadas; `VARCHAR + CHECK` dá a mesma garantia.
- **Simular login no front-end**: daria uma falsa sensação de conta real; preferimos um modo demonstração explícito.

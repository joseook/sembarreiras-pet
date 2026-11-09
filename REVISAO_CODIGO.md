# Revisão de código e testes — 2026-11-09

> Registro da auditoria original. As correções locais posteriores e os resultados atualizados estão em [CORRECOES.md](CORRECOES.md). Este documento preserva as evidências anteriores às alterações.

Base examinada: `fd1dede` (merge do PR #6). A revisão encontrou falhas funcionais e de segurança. Os seis testes existentes passam, mas não cobrem os problemas abaixo. O código da aplicação não foi alterado nesta auditoria.

## Escopo e ambiente

- Inspeção de Python, módulos JavaScript, HTML, estilos, configuração de publicação, scripts auxiliares e documentação.
- Python 3.13.9 portátil instalado apenas em `.venv/`, pasta ignorada pelo Git; dependências de `requirements.txt` instaladas para execução local.
- Backend real Flask/SQLAlchemy com SQLite **em memória**; nenhum acesso ao banco remoto e nenhum dado real de usuário utilizado.
- Navegador Chromium 156 via Playwright: oito páginas em 1440, 390 e 320 px, totalizando 24 combinações. Testados também os quatro pets e um identificador inexistente.
- Fluxos exercitados: validação, cadastro, login, logout normal, logout com falha de rede, API indisponível, contato, visita e estado do menu.
- Compilação dos arquivos Python e verificação de sintaxe de todos os módulos JavaScript aprovadas.
- Sem commit, push ou deploy. Não foi validado o site remoto, PostgreSQL, Supabase ou Google Maps com chave real. As verificações básicas de acessibilidade não equivalem a uma certificação WCAG.

## Achados por prioridade

### 1. Crítico — rota de arquivos permite acesso fora das pastas públicas

**Código:** `app.py:59–62`.

A autorização examina somente o primeiro segmento do caminho, mas entrega o arquivo a partir da raiz do repositório. Um caminho começando com `assets/` e contendo subida de diretório passa nessa autorização. Uma requisição local a `/assets/..%2fapp.py` retornou **HTTP 200** com o arquivo da aplicação, enquanto `/app.py` diretamente retornou 404.

O acesso fica limitado à raiz passada ao Flask, mas pode alcançar arquivos privados existentes dentro dela, incluindo configuração e banco local. Não foi solicitado o conteúdo de arquivos de credenciais nesta auditoria. A exposição no Vercel depende do roteamento e dos arquivos presentes no pacote publicado.

**Correção indicada:** servir cada pasta pública a partir de sua própria raiz; usar uma lista explícita para arquivos públicos da raiz. Adicionar regressão para caminhos codificados e subidas de diretório.

### 2. Alto — falha da API gera autenticação fictícia e salva senha em texto puro

**Código:** `assets/js/modules/auth-demo.js:201–277`.

Com a requisição de login bloqueada, o navegador mostrou usuário conectado, mas `/api/auth/me` respondeu `autenticado: false`. Com a requisição de cadastro bloqueada, o código gravou a senha fictícia sem hash em `sb_usuarios_locais` e anunciou sucesso. Há ainda uma credencial de demonstração embutida que ativa esse caminho local.

**Correção indicada:** remover o fallback de autenticação e a gravação de senhas no navegador; falhas de rede devem manter o formulário e informar que a operação não foi concluída. Remover dados legados dessas chaves locais sem transferi-los ao servidor.

### 3. Alto — agendamentos sem sessão e atribuição a outro usuário

**Código:** `app.py:211–245`.

Sem login, a API retornou **201** para um agendamento anônimo. Ao informar `usuario_id` de um usuário existente no corpo, retornou **201** atribuindo o agendamento a ele. O teste existente de agendamento inclusive aprova a criação sem autenticação.

**Correção indicada:** exigir sessão válida e obter a identidade exclusivamente dela; ignorar ou rejeitar identidade fornecida no corpo. Ajustar a cobertura para exigir 401 sem login.

### 4. Alto — nome do usuário permite execução de JavaScript no menu

**Código:** `assets/js/main.js:63–79` e `app.py:133–150`.

O nome armazenado é interpolado em `innerHTML`. Uma prova local e inofensiva com um elemento SVG no primeiro nome executou um evento e definiu uma variável de teste no navegador. O cadastro não restringe HTML em nomes. A reprodução confirmou o ponto de execução usando um valor fictício em `localStorage`.

**Correção indicada:** construir a saudação com `createElement` e `textContent`; confirmar o usuário por `/api/auth/me` antes de exibi-lo. Sanitização no cadastro não substitui a renderização segura.

### 5. Alto — sessão continua ativa após saída com falha de rede

**Código:** `assets/js/main.js:81–90`.

O botão apaga o estado local antes de confirmar o logout e ignora falhas. Bloqueando a requisição de saída, o menu passou a mostrar **Entrar**, enquanto `/api/auth/me` continuou respondendo `autenticado: true`. O logout normal encerrou a sessão corretamente.

Separadamente, uma tentativa de login com senha errada respondeu 401 e preservou a sessão anterior. Esse comportamento pode ser uma decisão de produto, mas atualmente a interface não esclarece que uma conta já está autenticada.

**Correção indicada:** confirmar o encerramento no servidor; informar a falha e permitir nova tentativa. Definir comportamento explícito para acessar o login ou trocar de conta estando autenticado.

### 6. Alto — ficha da Nina não renderiza quando a API responde

**Código:** `models.py` (`Pet.to_dict`) e `assets/js/modules/pet-ficha.js:365,449–456`.

Nas três larguras, a página permaneceu em **Carregando a ficha do animal...**, sem `h1`, com `Cannot read properties of undefined (reading 'forEach')`. A API entrega um objeto sem `etiquetas`, `fotos`, `convive` e outros campos exigidos pelo componente. Como a requisição funciona, o fallback estático não é utilizado. Simba, Bento e Mel renderizaram pelo fallback, pois não estão no banco inicializado.

**Correção indicada:** definir um contrato completo entre API e interface e tratar ausência de dados antes de renderizar. Não apresentar dados fictícios como informação clínica de um pet real.

### 7. Alto — formulário de contato envia para cadastro de usuário

**Código:** `pages/contato.html:63` e `assets/js/modules/auth-demo.js:132–134`.

Preenchi corretamente nome, e-mail, assunto e mensagem. O navegador enviou para **`/api/auth/cadastro`** e exibiu **Todos os campos obrigatórios devem ser preenchidos.** A detecção de cadastro considera apenas a existência de um campo chamado `nome`, também presente no contato. O atributo `data-demo-mensagem` não é utilizado.

**Correção indicada:** separar explicitamente os formulários e seus destinos. O contato precisa de um fluxo próprio; enquanto não existir envio real, sua validação deve ser local e não chamar autenticação.

### 8. Médio — validações do servidor insuficientes

**Código:** `app.py:132–150,213–233`.

Resultados locais das requisições diretas:

| Entrada | Resultado observado |
| --- | --- |
| Visita em 2020 e horário `99:99` | 201 |
| Mensagem com 1.001 caracteres | 201 |
| Data numérica em vez de texto | `TypeError` não tratado; em produção resulta em erro 500 |
| Cadastro com e-mail inválido, telefone de um caractere, moradia desconhecida e consentimento falso | 201 |
| Pet inexistente no agendamento | 201 no SQLite local; PostgreSQL pode rejeitar pela chave estrangeira |

**Correção indicada:** validar tipos, limites, consentimento, opções permitidas, data/horário e referências no servidor. Não depender das restrições HTML nem das diferenças entre bancos.

### 9. Médio — visita perde o pet escolhido e mantém informação contraditória

**Código:** `assets/js/modules/pet-ficha.js:126` e `assets/js/modules/scheduling-form.js:152–156`; `pages/como-funciona.html:361`.

O link de visita não transporta o identificador do pet; o formulário não envia `pet_id`. A visita feita com sessão válida foi gravada com `usuario_id` correto, mas `pet_id: null`. O HTML continuou afirmando que a solicitação não seria enviada, embora a API a tenha salvo. Sem API, o JavaScript muda silenciosamente para prévia.

**Correção indicada:** transportar e validar o pet selecionado, alinhar textos ao funcionamento real e exibir falhas reais de envio. A gravação não comprova que um abrigo recebeu notificação ou tem painel de acesso.

### 10. Médio — solicita conta mesmo com sessão ativa e redireciona cadastro para login

**Código:** `assets/js/modules/pet-ficha.js:128–129`, `assets/js/main.js:96–100` e `assets/js/modules/auth-demo.js:165–176`.

Na ficha do Bento, o botão **Criar conta para adotar** continuou visível estando autenticado. A lógica de ocultação só trata links dentro de itens de lista. O cadastro também inicia uma sessão no servidor, mas redireciona para a página de login, pedindo acesso novamente sem necessidade.

**Correção indicada:** usar uma fonte única para o estado de sessão e adaptar todas as ações; escolher entre cadastro com entrada automática ou cadastro seguido de login, mantendo interface e backend coerentes.

### 11. Médio — inicialização, configuração e diagnóstico exigem revisão

**Código:** `seed.py:9,117–129`, `config.py:20,34–38` e `app.py:68–91,168,245`.

Constatado por inspeção: a inicialização imprime a URL completa do banco e cria uma conta de demonstração com senha fixa; a chave de sessão tem um valor padrão previsível; SQLite é escolhido automaticamente quando o PostgreSQL local não responde; erros devolvem detalhes internos e o diagnóstico público lista tabelas. A falta de configuração adequada no deploy pode tornar esses comportamentos relevantes em produção. Nenhuma credencial remota foi inspecionada ou registrada.

**Correção indicada:** separar ambiente de desenvolvimento de produção; exigir configuração de produção, eliminar conta fixa automática e retirar dados de conexão e detalhes internos dos logs/respostas públicas. A inicialização atual cria tabelas, mas não substitui migrações.

### 12. Baixo — documentação e imagens externas

- `README.md` e `privacidade.html` dizem que não há backend, persistência ou envio de dados, divergindo do código e dos testes reais de cadastro/agendamento. A opção de lembrar acesso e os textos sem JavaScript também permanecem ilustrativos.
- As cinco imagens externas de `pages/quem-somos.html` não carregaram no ambiente de teste. Não foi possível concluir se as URLs falham publicamente ou se houve bloqueio de rede local. As imagens locais carregaram.
- `atualizar_textos.py` executa alteração de banco no nível do módulo e usa credencial local fixa; foi inspecionado e compilado, mas **não executado**. Não deve ser parte da inicialização normal.

## Resultado por página

| Página | Resultado local |
| --- | --- |
| Início | Renderização e menu móvel funcionando; estado de sessão tem os problemas descritos |
| Login | Validação vazia funcionou, com foco no e-mail; login real normal funcionou; falha de API ativa autenticação fictícia |
| Cadastro | Cadastro real funcionou; redirecionamento pede login mesmo com sessão; falha de API salva senha local |
| Como funciona | Renderiza; visita real salva, mas mantém aviso de prévia e perde o pet selecionado |
| Contato | Renderiza; envio válido chama API errada e falha |
| Quem somos | Renderiza; cinco imagens externas indisponíveis no ambiente |
| Pet | Nina quebra com API; Simba, Bento e Mel renderizam dados estáticos |
| Privacidade | Renderiza; conteúdo diverge do comportamento atual |

Não houve rolagem horizontal em nenhuma das 24 combinações de página/largura. Nos menus móveis presentes, abrir e fechar com Escape funcionou. Os campos examinados tinham rótulos e os identificadores de `aria-describedby` existiam. As âncoras internas da página atual foram resolvidas. O teste de referências locais de HTML passou.

## Evidências e reprodução

Os scripts exploratórios, respostas locais e capturas estão em `.venv/`, sem versionamento: `browser-audit.cjs`, `backend-audit.py`, `serve_audit.py` e `audit/`. Dados fictícios persistiram apenas no SQLite em memória durante a execução. Para os testes existentes, foi definido `DATABASE_URL=sqlite:///:memory:` antes de importar a aplicação, evitando o banco configurado externamente.

Com o Python portátil preparado, a suíte existente pode ser repetida no PowerShell:

```powershell
$env:DATABASE_URL = 'sqlite:///:memory:'
.\.venv\python.exe -m unittest discover -s tests -v
```

**Resultado: 6 testes aprovados.** As sondagens exploratórias documentam falhas; não são uma nova suíte de regressão aprovada. Prioridade sugerida: fechar acesso a arquivos privados, corrigir autenticação/sessão, proteger agendamentos e renderização de nomes, depois reparar contato, ficha e textos.

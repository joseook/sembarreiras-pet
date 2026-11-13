# Correções locais de segurança e estabilidade

## Estado da entrega

- Base: main em `9aebe1f9ce6235b6696ccba93eb3c74c6d702c76`.
- Branch local: `fix/seguranca-estabilidade-local`.
- Sem commits, push, merge, deploy, migrações ou acesso a bancos remotos.
- Flask, SQLAlchemy, HTML, CSS e JavaScript puro preservados. Nenhuma dependência adicionada.
- Contato continua demonstrativo; nenhum endpoint, tabela ou mecanismo de envio foi criado.
- CSS, imagens, landing page, configuração Vercel e requirements foram preservados.

## Etapas verificadas

### 1. Testes antes das correções

Arquivos: `tests/test_backend.py`, `tests/test_security.py` e `tests/browser_security.cjs`.

Os testes negativos reproduziram visitas sem autenticação, acesso a arquivos privados e limpeza incompleta do estado da sessão. As sondagens de navegador reproduziram execução de HTML por nome e quebra da ficha com dados incompletos. O teste positivo de agendamento passou a autenticar um usuário fictício, em vez de aprovar a vulnerabilidade.

Os testes definem SQLite em memória antes da importação da aplicação. `SB_AUTO_INIT_DB=0` permite desativar o seed automático no processo de teste; os dados de teste são preparados explicitamente. O comportamento padrão de inicialização fora dos testes não foi alterado.

### 2. Arquivos privados e autorização das visitas

Arquivo de aplicação: `app.py`.

- `assets/` e `pages/` são servidos com suas próprias raízes. `send_from_directory` não recebe mais a raiz do projeto para esses caminhos.
- Visitas exigem usuário existente associado à sessão. Uma identidade no corpo não autoriza nem altera a autoria.
- O servidor rejeita tipos inválidos, formatos inválidos de data/horário e mensagens acima do limite. Os horários de negócio e o fuso não foram redesenhados nesta rodada.
- POSTs da API exigem JSON e rejeitam origem diferente da origem do servidor. O frontend atual na mesma origem foi testado; integração autenticada entre origens distintas exige revisão específica de CORS/cookies.
- Sessões inválidas são limpas. Logout limpa todo o estado da sessão e expira o cookie no navegador que realizou a operação.
- Respostas da API usam no-store.

Regressões previstas: visitantes passam a receber 401; clientes que enviavam formulário nativo em vez de JSON recebem 415. Arquivos públicos e o fluxo JSON atual continuam acessíveis nos testes.

### 3. Autenticação real e nomes seguros

Arquivos: `assets/js/modules/api.js`, `assets/js/modules/auth-demo.js`, `assets/js/main.js`, `pages/login.html`, `pages/cadastro.html`.

- Removidos cadastro/login locais, credencial de fallback e gravação de senhas/perfis em localStorage.
- As duas chaves locais legadas são apagadas sem leitura ou migração das senhas. Outros dados de armazenamento do navegador não são apagados.
- Cadastro e login dependem da API e da sessão por cookie. O cadastro já autenticado pelo servidor segue para o início.
- O nome exibido pelo menu vem da sessão confirmada e é inserido com textContent, preservando as classes e apresentação existentes.
- Falha de logout informa erro e permite nova tentativa. A interface não anuncia saída antes da confirmação.
- O checkbox ilustrativo de lembrar acesso foi mantido, com descrição honesta. A duração da sessão não foi alterada.

Regressão prevista: contas que existiam somente no navegador deixam de ser tratadas como contas reais. Sem serviço disponível, o acesso falha de forma explícita.

### 4. Contato demonstrativo isolado

Arquivos: `pages/contato.html` e `assets/js/modules/auth-demo.js`.

O tipo do formulário é explícito. O contato apenas valida os campos e apresenta a mensagem demonstrativa já definida no HTML. Não chama autenticação, não cria contas, não envia dados e não os persiste. Campos, botão, estilos e estrutura foram mantidos.

### 5. Contrato da ficha da Nina

Arquivos: `assets/js/modules/pet-data.js`, `assets/js/modules/pet-ficha.js`, `models.py`, `tests/pet-data.test.mjs` e testes de navegador.

- O normalizador preserva campos conhecidos e trata dados opcionais ausentes ou com tipos inesperados.
- Dados de saúde ausentes não significam vacinação em dia ou ausência de doença.
- A serialização mantém null quando não há registros de vacinas, doenças ou exames. Uma lista explicitamente vazia continua sendo diferenciada de informação desconhecida.
- Isso altera a representação de campos opcionais da API de [] para null quando o valor original do banco é nulo. A interface desta branch aceita ambos; eventuais consumidores externos precisam ser conferidos.
- Galerias e dados completos dos exemplos existentes foram preservados. A ficha recebida da API não é substituída por uma história ou informação clínica fictícia para preencher lacunas.
- Quando a API não cadastra uma foto, a ficha apresenta esse estado; não foi inventada uma imagem de um animal real.
- Não houve mudança em tabelas, colunas, registros ou seed dos animais para corrigir a renderização.

### 6. Integração da visita e tratamento de erros

Arquivos: `assets/js/modules/scheduling-form.js`, `pages/como-funciona.html`, `app.py`, `seed.py`.

Visitas usam a mesma comunicação real com a API. Uma falha de conexão não muda silenciosamente para prévia, não anuncia registro e não limpa o formulário. O sucesso depende da resposta de registro. Não foi criado painel ou notificação ao abrigo.

Detalhes internos de erros e URLs de conexão não são enviados ao cliente nem impressos pelo seed. Os logs de criação da conta demonstrativa deixam de imprimir a senha. O comportamento de criação dessa conta permanece como pendência descrita abaixo; nenhum registro existente foi alterado automaticamente.

## Validação final

- 18 testes Python: API, arquivos públicos/privados, autorização, identidade, logout, formatos, serialização e ocultação de detalhes sensíveis.
- 5 testes Node: normalização, preservação dos exemplos e distinção de dados de saúde ausentes.
- 13 cenários Chromium: autenticação real, falhas de rede, XSS, contato, visitas, ficha incompleta e regressão das páginas.
- O cenário responsivo percorre 11 URLs (incluindo os quatro pets) em 1440, 390 e 320 px: 33 combinações, sem rolagem horizontal detectada e com menu por teclado funcionando.
- Sintaxe Python/JavaScript, referências locais, consistência das dependências instaladas e git diff --check verificados.

Uma execução de visita encontrou falha de conexão local; o teste foi repetido sem retirar suas asserções e passou. O teste de navegação foi ajustado para esperar o conteúdo necessário, em vez de depender da ausência de tráfego de rede de serviços externos.

Comandos no PowerShell deste workspace:

```powershell
$env:DATABASE_URL = 'sqlite:///:memory:'
$env:SB_AUTO_INIT_DB = '0'
.\.venv\python.exe -m unittest discover -s tests -v
node --test tests/pet-data.test.mjs
$env:PYTHON_EXE = (Resolve-Path '.venv/python.exe').Path
# PLAYWRIGHT_MODULE pode apontar para uma instalação de Playwright existente.
node tests/browser_security.cjs
```

O script de navegador imprime uma pasta temporária com resultados e capturas de falhas. Não utiliza o Vercel ou o banco remoto. A mensagem de erro injetada no teste de falha de cadastro é intencional e não representa falha na suíte.

## Logout: funcionamento confirmado e parte pausada

O fluxo normal encerra o estado da sessão processado pelo Flask e expira o cookie do navegador. O servidor passa a tratar esse navegador como anônimo e rejeita visitas após logout.

O Flask atual utiliza cookies assinados, sem armazenamento de sessões no servidor. Uma cópia previamente obtida de um cookie pode continuar válida após logout; limpar o cookie do navegador não revoga cópias existentes. Não foi implementada revogação persistente, e esta entrega não afirma resolver esse cenário.

A parte de revogação completa foi pausada e uma decisão foi solicitada ao usuário. A proposta separada é usar identificadores de sessão revogáveis no servidor, com armazenamento persistente, expiração e testes de reutilização após logout. Não criar armazenamento apenas em memória do processo: ele não é suficiente para múltiplas instâncias no Vercel.

## Chave e contas demonstrativas: proposta antes de publicar

Verificado no código atual: config.py ainda possui chave padrão pública e seed.py ainda cria uma conta demonstrativa com senha conhecida. Ocultar logs não elimina esses riscos. As configurações remotas não foram consultadas ou modificadas.

Proposta, pendente de autorização para a parte de produção:

1. Configurar uma chave de sessão aleatória e estável no ambiente de produção, fora do repositório; validar a configuração antes da implantação. A rotação da chave desconecta sessões e precisa ser planejada.
2. Remover a criação automática de contas demonstrativas do caminho de produção e usar somente fixtures isoladas nos testes. Não apagar, trocar senhas ou revogar contas existentes automaticamente na inicialização.
3. Revisar de forma autorizada qualquer conta demonstrativa já existente no ambiente remoto.
4. Separar a preparação/migração do banco da inicialização das funções, com validação prévia e sem fallback silencioso de persistência em produção.
5. Conferir logs do erro 500 e o pacote efetivamente servido pelo Vercel antes de qualquer publicação. A configuração Vercel não foi alterada nesta rodada.

## Pendências e limites

- Sem autorização para commits ou publicação; toda a entrega permanece local e não commitada.
- Nenhuma nova tabela, migração, dependência ou integração de e-mail foi criada.
- Revogação de cópias de cookies, chave de produção e conta demonstrativa continuam bloqueadores de uma afirmação de segurança completa para produção.
- PostgreSQL, concorrência, configuração real e erro 500 do Vercel não foram validados nesta etapa. Ready não é tratado como teste funcional.
- Integrações externas que dependam dos formatos anteriores da API precisam de revisão antes de publicar.
- Idempotência de visitas, regras completas de horário, revisão integral da política de privacidade e rate limiting ficam fora desta rodada.


## Atualiza??o ? 2026-11-12: revis?o e corre??es adicionais

Esta se??o substitui as pend?ncias anteriores referentes ? chave padr?o e ? cria??o autom?tica de contas no c?digo local.

- A inicializa??o recusa chave ausente, com menos de 32 caracteres ou igual ? chave p?blica antiga, fora dos testes. N?o h? chave padr?o; configure uma chave aleat?ria e est?vel em SECRET_KEY. O exemplo de ambiente n?o inclui credencial utiliz?vel.
- O seed n?o cria usu?rios nem modifica contas existentes. A eventual conta demonstrativa remota ainda precisa de revis?o autorizada pela equipe.
- A API exige consentimento booleano true para cadastro e rejeita hor?rios passados considerando Bras?lia (UTC-03:00). O navegador usa o mesmo fuso.
- O link da ficha transporta pet_id at? o formul?rio, que o envia ? API. A API continua validando a exist?ncia do pet; exemplos presentes apenas no cat?logo est?tico n?o s?o gravados como pets reais.
- Verifica??o: 23 testes Python, 5 JavaScript e 13 cen?rios Chromium aprovados, com banco em mem?ria. O navegador exercitou v?nculo da Nina, fuso diferente de Bras?lia e 33 combina??es de p?gina/largura. Nenhum banco remoto acessado e nenhuma publica??o realizada.
- A revoga??o persistente de cookies copiados e a valida??o do ambiente remoto continuam pendentes. Nenhuma migra??o foi criada.

# Revisão do sistema — 17/11/2026

> Diagnóstico original preservado. As correções posteriores estão detalhadas em
> `CORRECOES_2026-11-17.md`; os achados abaixo descrevem o estado anterior.

Revisão do código local, incluindo o painel de gerência ainda não publicado.
Os erros abaixo foram identificados por leitura do código e, quando indicado,
reproduzidos em SQLite em memória e Chromium. Nenhum dado do Supabase foi alterado.
Esta revisão não valida a implantação Vercel nem a persistência destes fluxos em
PostgreSQL. A conexão de leitura com o Supabase foi confirmada anteriormente.

## Erros confirmados

### 1. Cópia de cookie continua autenticada depois de sair — alta prioridade

Referência: `app.py:258` e sessões padrão do Flask.

Reprodução: autenticar, guardar o cookie de sessão, sair, reapresentar a cópia em
outro cliente. `/api/auth/me` ainda retorna `autenticado: true`. Para uma conta de
gerente autorizada, a cópia também recebe 200 na agenda protegida.

O logout funciona no navegador que removeu o cookie, mas não revoga cópias obtidas
anteriormente. O risco depende de alguém obter uma sessão válida; não permite criar
um cookie válido sem a chave. Implementar sessões revogáveis persistidas no servidor,
com expiração e testes de reutilização. Armazenamento somente em memória não resolve
múltiplas instâncias da hospedagem.

### 2. Login recusado mantém a conta anterior ativa — alta prioridade

Referência: `app.py:222`.

Reprodução: entrar com a conta A e tentar entrar com a conta B usando senha errada.
O POST retorna 401, mas a consulta de sessão continua autenticada como A. Se A for
gerente, a agenda continua acessível. Isso deixa a identidade usada pelo sistema
diferente da tentativa de acesso mostrada ao usuário.

Definir e implementar a troca de conta: limpar a sessão anterior no início da
tentativa de login e criar uma nova sessão apenas após autenticação bem-sucedida.

### 3. Página de privacidade contradiz o tratamento real — alta prioridade

Referência: `privacidade.html:28`, `pages/cadastro.html` e `seed.py:57`.

A página ligada ao cadastro afirma que os formulários não enviam nem salvam dados
e que não existe conta real ou banco conectado. O cadastro e os agendamentos usam
a API e persistem dados. Além disso, o texto inicial da política na API descreve
exclusão pelo perfil e notificações que não existem no sistema atual.

Alinhar os textos ao comportamento implementado. A política existente no banco
precisa de revisão deliberada: editar o seed não atualiza registros já existentes.
Este achado verifica consistência do produto; não constitui avaliação jurídica.

### 4. Pet de exemplo ausente no banco oferece visita que falha — média prioridade

Referência: `assets/js/modules/pet-ficha.js:469` e `app.py:292`.

Reprodução em banco isolado com apenas Nina: API do Simba retorna 404, mas a ficha
usa o exemplo local e apresenta “Agendar visita”. O formulário envia `pet_id=simba`
e recebe 404 “Pet não encontrado”. O mesmo mecanismo se aplica aos outros exemplos
não cadastrados e pode ocorrer quando a API fica indisponível.

Distinguir ficha demonstrativa de registro confirmado pela API. Manter exemplos
apenas para consulta ou cadastrar deliberadamente os pets que poderão receber
visitas. A página inicial também é estática e não acompanha inclusão/adoção no banco.

### 5. Agendamento e confirmação aceitam pet já adotado — média prioridade

Referência: `app.py:288` e `app.py:369`.

Reprodução: criar pet com `status='adotado'`, solicitar visita futura e confirmar
como gerente. As respostas são 201 e 200. A API verifica a existência do pet, mas
não sua disponibilidade; a confirmação também não reavalia essa condição.

Validar os estados elegíveis ao solicitar e ao confirmar. Ajustar também as ações
da ficha e a apresentação da página inicial conforme o estado do animal.

### 6. Dias de atendimento informados não são respeitados — média prioridade

Referência: `pages/como-funciona.html:379`, `scheduling-form.js` e `app.py:298`.

A interface informa atendimento de terça a sábado. Foi possível criar visita em
domingo, e o gerente conseguiu confirmá-la. O servidor aceita qualquer horário
válido, inclusive 03:17; os horários do formulário são descritos como sugeridos,
portanto a faixa obrigatória ainda precisa ser definida pelo responsável.

Aplicar calendário de funcionamento no servidor e no formulário. Definir faixa,
feriados e duração antes de impor bloqueio de horários.

### 7. Cadastro aceita contatos inválidos pela API — média prioridade

Referência: `app.py:174` e limites de colunas em `models.py:60`.

Reprodução: enviar `email='isto-nao-e-email'` e `telefone='abc'` com os demais campos
válidos. A API retorna 201. O navegador valida parte desses campos, mas uma chamada
direta não passa pelas validações HTML. A conta pode ficar sem contato utilizável.

Validar formato e comprimento no servidor, alinhados ao formulário e às colunas.
Também não há limites de comprimento para nome/e-mail/telefone na rota: a reação
a valores longos precisa ser verificada em PostgreSQL; SQLite não reproduz seus
limites de VARCHAR. Não foi provocada essa falha no banco remoto.

### 8. Login perde o destino e o pet da visita — média prioridade

Referência: `assets/js/modules/auth-demo.js:130`.

Reprodução em Chromium: iniciar em
`como-funciona.html?pet_id=nina#etapa-visita`, entrar pelo menu e autenticar. O
destino passa a ser `index.html`; pet, etapa e preenchimento não são recuperados.

Preservar um destino interno validado para retornar após autenticação e manter o
contexto da solicitação, sem guardar senhas no navegador.

### 9. Fotos dos destaques somem na ficha recebida da API — média prioridade

Referência: `models.py:121`, `pet-ficha.js:74` e `assets/js/data/pets.js`.

A página inicial mostra fotos locais, mas a API não possui campo/relacionamento
de fotos no modelo Pet nem envia fotos. Na ficha da Nina carregada da API, foi
confirmada a ausência de imagens e a mensagem “Foto não cadastrada”. Na alternativa
estática, a galeria existe. Outros detalhes presentes somente nos exemplos também
não estão no modelo, como abrigo e convivência.

Definir armazenamento e contrato desses dados no backend. Não preencher fatos
clínicos ausentes com dados fictícios. Uma associação explícita de imagens autorizadas
aos exemplos pode resolver a demonstração, sem fingir cadastro de fotos reais.

### 10. Documentação descreve proteções já corrigidas como pendentes — baixa prioridade

Referência: `README.md:83`, `README.md:149` e `RELATORIO_SEGURANCA_LOCAL.md`.

O README ainda diz que existe chave padrão pública e criação automática de conta
demonstrativa. O código atual exige chave configurada e o seed não cria usuários.
Também há referência à ausência de painel apesar da implementação local recente.
Os relatórios antigos devem continuar identificados como históricos; a documentação
de uso atual precisa refletir o código revisado.

## Limitações e regras ainda por definir

- **Duplicação de solicitações:** dois POSTs iguais retornam 201 e criam dois
  registros. Falta uma regra/idempotência para reenvio da mesma solicitação.
- **Capacidade:** duas visitas podem ser confirmadas no mesmo horário. Isso só é
  conflito se a clínica definir capacidade excedida; não foi presumido limite de uma.
- **Retorno ao adotante:** não existe tela/API para o próprio adotante acompanhar
  suas visitas e confirmações. O gerente precisa comunicar manualmente, como já
  informa o painel. Não há notificação automática, cancelamento ou remarcação na UI.
- **Contato:** o formulário continua demonstrativo, sem envio nem persistência.
- **Acesso de gerentes:** as contas reais ainda precisam ser escolhidas e seus IDs
  configurados em `GERENTES_IDS`. A prévia local usa banco fictício e login automático
  restrito a localhost; não deve ser usada como servidor de produção.
- **Uma clínica:** não existe isolamento por unidade, conforme documentado no painel.
- **Preparação de produção:** sem limitação de tentativas de login na aplicação;
  `SESSION_COOKIE_SECURE` fica falso e `SESSION_COOKIE_SAMESITE` não é explicitado na
  configuração local. Não foi verificada proteção adicional da hospedagem. Definir
  limites e cookies conforme HTTPS antes de publicar. O modo `python app.py` ativa
  depuração e deve continuar limitado ao desenvolvimento.
- **Maps e imagens externas:** dependem de rede/serviços de terceiros. Não foi
  validada uma chave real do Google Maps nesta revisão.

## Verificações concluídas

- 30 testes Python e 5 testes JavaScript aprovados.
- 13 cenários da suíte Chromium existente aprovados, incluindo cadastro, login,
  logout, erros de rede, XSS, agendamento autenticado, ficha e menu responsivo.
- 33 combinações de 11 URLs com larguras 1440, 390 e 320 px na suíte existente.
- Teste do painel aprovado: autorização, login, listagem segura, paginação,
  confirmação persistida, filtros, vazio, falha e logout; quatro larguras verificadas.
- Sondagens adicionais reproduziram os achados de sessão, cadastro, visitas e
  disponibilidade em banco isolado; dois cenários adicionais Chromium confirmaram
  galeria, ação para pet ausente e perda do destino após login.
- `git diff --check` aprovado. Os testes aprovados demonstram os cenários cobertos;
  não significam ausência dos erros adicionais encontrados nesta revisão.

Evidências locais de navegador:

- `%TEMP%/sbp-browser-security-8MbTMO` — suíte existente.
- `%TEMP%/sbp-gerencia-gpstn3` — painel.
- `%TEMP%/sbp-browser-security-w5iCwJ` — sondagens adicionais.

Esta tarefa produziu diagnóstico. Nenhuma correção destes achados, migração,
commit, push ou publicação foi realizada.

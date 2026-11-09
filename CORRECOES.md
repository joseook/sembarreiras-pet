# Correções locais — 2026-11-09

Este documento registra as correções e a validação local anteriores à publicação. A validação descrita abaixo não acessou o banco remoto. O usuário autorizou posteriormente o envio ao GitHub e a publicação; o resultado da implantação deve ser conferido nos checks do commit.

## Alterações

- Rotas de arquivos passam a limitar cada pasta pública à sua própria raiz. Tentativas de subir diretórios, inclusive com caracteres codificados, retornam 404.
- Login e cadastro dependem da API. Removidos o acesso simulado, a credencial fixa no frontend e o armazenamento de contas/senhas no navegador. As chaves locais legadas são apagadas sem migração.
- Menu consulta a sessão real e renderiza nomes como texto. O logout só é tratado como concluído após confirmação do servidor; falhas são exibidas e permitem nova tentativa.
- Cadastro já autenticado segue para o início ou para o destino de retorno. Acessar login/cadastro com sessão ativa não exige novo acesso. Uma nova tentativa de login inválida encerra a sessão anterior.
- Agendamento exige sessão e usa exclusivamente a identidade do servidor. Valida pet, disponibilidade, data futura, dias de funcionamento, horários de Brasília e tamanho/tipo da mensagem. O pet escolhido é mantido na solicitação.
- Contato tem endpoint e tabela próprios, valida os dados, registra a mensagem e retorna protocolo. Não cria conta nem envia e-mail.
- Quatro pets de exemplo são inseridos quando ausentes, sem sobrescrever registros. A ficha recebe os campos estruturais necessários, preserva a galeria e indica informações não cadastradas. Sem serviço, exemplos ficam apenas para leitura, sem agendamento.
- Textos de formulários, README e privacidade foram alinhados ao funcionamento real. O checkbox ilustrativo de lembrar acesso foi removido. Mensagens de rede preservam o preenchimento e não simulam sucesso.
- Imagens externas da página Quem somos têm alternativas locais para falhas de carregamento.
- Removidos diagnóstico público de tabelas e detalhes internos de erros, além da impressão da conexão do banco. Requisições de outra origem são recusadas, exceto uma origem explicitamente configurada.
- Produção exige chave de sessão aleatória e PostgreSQL explícito. O banco não é trocado silenciosamente. A conta de demonstração não é criada; somente a senha pública antiga é revogada se ainda estiver em uso, preservando a conta e seus vínculos.
- O script antigo que apagava as seções de privacidade foi desativado. Dados e políticas existentes são preservados; a revisão de políticas já cadastradas no banco continua sendo uma tarefa da equipe.

## Configuração de publicação

O vercel.json agora contém uma lista explícita de arquivos estáticos e a função Python; arquivos privados não são saídas de publicação estática. A .vercelignore exclui ambientes locais, bancos, credenciais e evidências de teste do pacote. Essa configuração segue a [documentação de configuração da Vercel](https://vercel.com/docs/project-configuration/vercel-json). O funcionamento da implantação ainda precisa de validação no ambiente remoto.

Antes de publicar, conferir SECRET_KEY aleatória com pelo menos 32 caracteres e DATABASE_URL PostgreSQL no Vercel. A nova tabela mensagens_contato depende de permissão de criação no banco. A inicialização cria tabelas ausentes, mas não migra colunas existentes. Frontend e API na mesma origem são o caminho padrão; cookies entre sites diferentes exigem configuração adicional.

## Validação

- 22 testes Python aprovados, usando SQLite em memória: persistência e hash, sessão, identidade de visitas, validações, contato, arquivos privados, erros de banco, dados legados, configuração de produção e lista de publicação.
- 38 verificações de navegador aprovadas com Flask real e Chromium: 24 combinações de página/largura (1440, 390 e 320 px) e 14 cenários de formulários, galeria, navegação, sessões, falhas de rede, imagens alternativas, leitura de exemplos sem API e proteção contra execução de HTML. Resultado final registrado em test-results/browser-results.json.
- Compilação Python, sintaxe JavaScript e git diff --check aprovados.
- Nenhum dado real utilizado; nenhuma operação em Supabase/PostgreSQL remoto.

Scripts reproduzíveis: tests/test_backend.py e tests/browser-regression.cjs. Instruções de execução no README.md. Evidências em test-results, ignorado pelo Git.

Limites: validação remota do Vercel/PostgreSQL pendente. Pets e abrigo continuam sendo exemplos explicitamente identificados. Não foram implementados painel de atendimento/ONG, notificações, recuperação de senha ou autoatendimento de conta.

## Simplificação posterior

O frontend permanece em JavaScript puro, conforme pedido do usuário. Os dados públicos de exemplo agora têm uma única fonte em assets/js/data/pets.json; pets.js apenas os carrega e seed.py lê o mesmo arquivo. JSON é usado somente como formato de dados.

O módulo auth-demo.js foi renomeado para formularios.js e os destinos de login, cadastro e contato estão explícitos em uma tabela curta. O carregamento redundante de configuração foi removido de main.js. A inicialização do banco foi dividida em três funções diretas: criar política, criar pets e revogar a senha pública antiga. Validações e chamadas da API ficaram mais explícitas, com a cobertura de segurança preservada. O README apresenta um mapa dos arquivos.

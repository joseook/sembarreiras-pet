# Correções da revisão — 17/11/2026

## Comportamento resultante

| Achado | Correção implementada |
| --- | --- |
| Cookie válido após logout | Sessões revogáveis no banco, token aleatório guardado como hash, validade de oito horas e limpeza de expiradas. Logout e troca/tentativa de login revogam a sessão atual. |
| Conta anterior após login recusado | Revogação antes da nova autenticação, inclusive corpo de login inválido. Cookies legados sem token persistente não autorizam. |
| Privacidade contraditória | Página e API usam o texto atual de politica.py, com alternativa HTML fiel ao funcionamento. A preparação acrescenta versão 2026.11 sem apagar políticas anteriores. |
| Exemplo inexistente oferecia visita | Ficha de exemplo é somente leitura; agendamento depende de registro disponível da API. Formulário com pet_id confere existência/disponibilidade antes de habilitar envio. |
| Visita a pet adotado | Solicitar, confirmar e remarcar verificam disponibilidade no servidor. Início consulta a disponibilidade atual da API. |
| Atendimento ignorado | De terça a sábado, 09:00–15:00, exceto 12:00–13:00; horários em Brasília. Interface sugere horas inteiras e servidor aceita minutos dentro da faixa. |
| Contatos inválidos no cadastro | Validação no servidor de e-mail, telefone e limites das colunas; senha limitada a 128 caracteres. JSON limitado a 32 KiB. |
| Perda do destino após login | Retorno somente a páginas internas permitidas; preserva pet e etapa. Rascunho temporário da visita fica na aba por até 30 minutos e é removido após retorno/envio. Senhas não são armazenadas no navegador. |
| Fotos ausentes na API | Tabela pet_midias e campo fotos na API; seed novo associa fotos a Nina. Associação aos exemplos antigos é explícita, exige identidade do exemplo e não sobrescreve fotos existentes nem inventa dados clínicos. |
| Documentação incorreta | README atualizado; relatório antigo sinalizado como histórico; auditoria original preservada. |

Também implementados:

- Reenvio da mesma solicitação ativa devolve o registro existente. PostgreSQL
  serializa as operações da mesma conta com locks de linha, inclusive remarcações.
- Tela Minhas visitas: lista apenas registros do adotante, recebe status da gerência,
  verifica atualizações enquanto visível e permite cancelar/remarcar.
- Gerentes também podem cancelar/remarcar. Alterar data/horário exige nova confirmação.
- Contato real com protocolo, persistência e caixa de mensagens restrita à gerência.
- Limite persistente de tentativas, com HMAC dos identificadores; dez por identificador
  e 60 por IP/ação em 15 minutos, incluindo tentativas bem-sucedidas. PostgreSQL usa
  advisory locks transacionais na contagem/reserva. Sem dependência de memória local
  de uma função serverless; não confia no cabeçalho X-Forwarded-For enviado pelo cliente.
- Cookies HttpOnly/SameSite=Lax; Secure quando FLASK_ENV=production ou VERCEL=1.
  PostgreSQL remoto exige SSL e tempo limite de conexão.
- Inicialização automática desativada por padrão; preparação por comandos explícitos.

## Preparação do banco existente

Revisável em `migrations/20261117_suporte.sql` e `preparacao.py`.
São quatro tabelas aditivas:

| Tabela | Finalidade |
| --- | --- |
| sessoes_usuarios | Hash do token, vínculo da conta e expiração |
| tentativas_acesso | Identificador protegido e horário da tentativa |
| pet_midias | Fotos vinculadas ao pet existente |
| mensagens_contato | Mensagem com protocolo para consulta pela equipe |

Nenhuma coluna de usuarios, pets ou agendamentos é removida ou alterada.
No PostgreSQL, criação e restrição das novas tabelas são transacionais. Elas têm RLS
habilitado e acesso direto revogado para os papéis anon/authenticated, se presentes;
a conexão Flask precisa de um papel proprietário/BYPASSRLS. Não se altera a política
de acesso das cinco tabelas originais nesta preparação.

```powershell
$env:SB_AUTO_INIT_DB = '0'
.\.venv\python.exe -m flask --app app prepare-db
# Opcional, somente para fotos dos exemplos antigos reconhecidos:
.\.venv\python.exe -m flask --app app importar-fotos-exemplo
```

O SQL avulso prepara somente as tabelas. O comando prepare-db também acrescenta a
política atual e preserva versões e edições anteriores. init-db é destinado à
inicialização de demonstração e pode inserir Nina; não é necessário para atualizar
um banco existente. Nunca trocar DATABASE_URL para uma base de teste compartilhada
ao executar os testes: as suítes isolam explicitamente seu próprio SQLite em memória.

## Verificação local concluída

- 51 testes Python, 5 testes JavaScript e 20 cenários Chromium distintos aprovados:
  execução geral de 19 e execução posterior das sete correções, incluindo um cenário
  adicional de navegação autenticada em cinco larguras.
- Suíte Chromium da gerência aprovada, incluindo paginação, confirmação, falha,
  autorização, logout e quatro larguras (1440, 768, 390, 320 px).
- 33 combinações de páginas/larguras da suíte geral; Minhas visitas também foi
  exercitada em 1440, 390 e 320 px.
- Novos testes cobrem cookie copiado após logout/login recusado, expiração, limites,
  identidade, disponibilidade, atendimento, duplicação, status, remarcação,
  cancelamento, contatos, mídia, política e preparação repetida sem perda de dados.
- DDL compilado para PostgreSQL; testes funcionais locais usam SQLite em memória.
  Execução na base compartilhada e validação PostgreSQL devem constar separadamente.

Evidências de navegador: `%TEMP%/sbp-browser-security-rzYfPH`,
`%TEMP%/sbp-browser-security-7uKHKj` e `%TEMP%/sbp-gerencia-qrceNt`.

## Limites e ativação

- Preparação do Supabase aplicada e verificada: quatro tabelas presentes com RLS,
  sem SELECT/INSERT direto para anon/authenticated; SSL do cliente ativo; contagens
  de usuários, pets e agendamentos preservadas. Política passou de uma para duas
  versões, preservando a anterior, e uma mídia de exemplo reconhecido foi associada.
  As garantias novas passam a valer quando o novo código estiver em execução.
- Validação adicional no PostgreSQL: cadastro, sessão, duplicação, confirmação,
  acompanhamento, remarcação, cancelamento, contato e cookie copiado após logout
  passaram com dados fictícios em transação externa desfeita. Contagens das seis
  tabelas exercitadas foram verificadas após rollback, sem registros de teste restantes.
- A chave local de sessão estava inválida; uma chave segura foi gerada somente no
  .env ignorado pelo Git, sem exposição. A chave da hospedagem não foi alterada.
- Único gerente definido pelo usuário e configurado em GERENTES_IDS local. A conta
  existente no Supabase recebeu senha temporária, válida por 48 horas, com troca
  obrigatória antes de liberar a agenda. Nenhum outro perfil foi alterado. A senha
  não consta da documentação; sua cópia de entrega local foi removida após entrega.
- Troca de senha verificada em 54 testes Python e cenário Chromium específico:
  credencial temporária bloqueia a agenda, troca libera acesso e invalida a senha
  antiga e as sessões anteriores. Nenhuma nova tabela foi necessária nessa etapa.
- Capacidade por horário, feriados e isolamento entre várias clínicas dependem de
  regras do responsável; não se presume capacidade de uma visita por horário.
- Notificações estão no sistema, por atualização de status; e-mail/SMS/WhatsApp exigem
  provedor e configuração, que não foram inventados. Recuperação de senha e exclusão
  automática pelo perfil continuam fora desta entrega e não são prometidas na UI.
- A implantação Vercel não foi alterada ou validada; não houve commit, push ou deploy.

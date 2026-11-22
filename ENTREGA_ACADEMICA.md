# Entrega acadêmica — IHC e Laboratório de Programação III (WEB I)

## Escopo da apresentação

Plataforma de adoção responsável com consulta de pets e gestão de visitas a uma
unidade. O fluxo implementado termina no acompanhamento da visita. Avaliação para
adoção, assinatura de termo e acompanhamento pós-adoção são conduzidos fora do
sistema. As telas consultam os registros do banco; não há tutorial ou painel simulado.

Este roteiro organiza os recursos existentes; não substitui os critérios dos
professores, que ainda precisam ser fornecidos. A linguagem/framework exigidos e a
obrigatoriedade de CRUD completo precisam ser confirmadas no enunciado.

## Demonstração principal

Antes do fluxo de visitas, demonstrar o CRUD em **Gerência → Gerenciar pets**:

1. Cadastrar um pet fictício com nome, espécie, sexo, características e foto com descrição.
2. Localizar pela busca, abrir a ficha e conferir a persistência dos dados.
3. Editar o nome ou a história e conferir a mudança na consulta pública.
4. Criar outro pet sem visitas e usar **Excluir**: a exclusão é física, pela API DELETE.
5. Usar **Arquivar** em um pet com histórico já resolvido e mostrar que o histórico
   permanece. Reativar para mostrar que o arquivamento pode ser desfeito.

Para apresentar as visitas:

1. Abrir a página inicial e apresentar a proposta e os pets consultados no banco.
2. Abrir uma ficha cadastrada e mostrar informações, fotos e ação para visita.
3. Cadastrar uma conta fictícia de adotante ou entrar com uma já preparada.
4. Clicar em Agendar visita na ficha: abrir o formulário direto, já vinculado ao
   animal, sem tutorial. Solicitar data futura, de terça a sábado, em horário de atendimento.
5. Mostrar o retorno de sucesso e o status pendente em **Minhas visitas**.
6. Em outro navegador ou janela privativa, entrar como gerente. Usar a conta
   autorizada; trocar a senha temporária antes da apresentação, se ainda necessário.
7. Filtrar a agenda, localizar a solicitação e confirmar.
8. Voltar à conta do adotante e atualizar a lista: mostrar o status confirmado e a
   mensagem com o nome do pet. Não há QR Code.
9. Remarcar a visita e demonstrar o retorno a pendente. Depois cancelar e demonstrar
   o status cancelado. Explicar que cancelamento preserva o registro.
10. Enviar uma mensagem em Contato, guardar o protocolo e localizar a mensagem na
    gerência. Não prometer envio de e-mail: a mensagem é consultada no sistema.

Usar duas sessões de navegador separadas para não substituir a conta do adotante
pela conta de gerente. Evitar várias pessoas compartilhando a mesma conta na prova.
Senhas e strings de conexão não devem aparecer nos slides, no código ou no projetor.

## O que explicar em IHC

| Aspecto | Onde demonstrar |
| --- | --- |
| Público e necessidades | Materiais de persona, empatia e jornada na pasta IHC |
| Navegação e organização | Página inicial, catálogo, ficha, agendamento e Minhas visitas |
| Visibilidade do estado | Mensagens de envio, pendente, confirmado e cancelado |
| Prevenção e recuperação de erro | Campos obrigatórios, datas inválidas e mensagens junto aos campos |
| Controle do usuário | Confirmação de cancelamento e possibilidade de remarcação |
| Consistência | Cores, tipografia, componentes, rótulos e termos entre as páginas |
| Acessibilidade | Labels, navegação por Tab, foco visível, link de pular conteúdo e regiões de status |
| Responsividade | Repetir o fluxo em computador e largura de celular |

Materiais já presentes: pesquisa documental de adoção, persona/mapa de empatia e
jornada da usuária. Revisar esses documentos antes de apresentar e explicar quais
decisões da interface respondem às necessidades identificadas. Os conteúdos dos PDFs
não foram reavaliados nesta etapa.

Um teste acadêmico de usabilidade pode pedir a outra pessoa: localizar um pet,
solicitar uma visita e encontrar a confirmação. Registrar dificuldades observadas,
tempo aproximado, erros e ajustes realizados. Não inventar participantes ou resultados.

## O que explicar em WEB I

| Parte | Implementação atual |
| --- | --- |
| Estrutura | HTML semântico nas páginas |
| Apresentação | CSS compartilhado e estilos de cada página |
| Interação | JavaScript puro, eventos de formulário e atualizações no DOM |
| Comunicação | Fetch com JSON entre navegador e API Flask |
| Backend | Rotas e regras de negócio em app.py e regras.py |
| Persistência | SQLAlchemy com PostgreSQL/Supabase; testes isolados com SQLite |
| Relacionamentos | Agendamento ligado a usuário e pet; fotos ligadas ao pet |
| Validação | Navegador orienta o preenchimento e servidor valida antes de salvar |

Mostrar no código um caminho completo: formulário de visita → JavaScript → POST
da API → criação do registro → consulta pela gerência → atualização do status →
consulta do adotante. Explicar o uso de chave primária e estrangeira nas tabelas.

### CRUD de pets implementado

| Operação | Método e rota | Persistência |
| --- | --- | --- |
| Create | POST /api/gerencia/pets | Inclui Pet e suas fotos em PetMidia |
| Read | GET /api/gerencia/pets e GET /api/gerencia/pets/id | Consulta, busca, filtro e paginação |
| Update | PUT /api/gerencia/pets/id | Atualiza informações e fotos, mantendo a identidade e o histórico |
| Delete | DELETE /api/gerencia/pets/id | Remove fisicamente o pet e sua mídia quando não existem visitas vinculadas |

Arquivar é uma opção adicional de atualização de status; não substitui o DELETE.
Pets com histórico não são excluídos fisicamente. Visitas ativas a partir de hoje
precisam ser resolvidas antes de retirar a disponibilidade. O motivo do bloqueio
é mostrado na interface, com orientação para a próxima ação.

O formulário permite até seis fotos por endereço HTTP/HTTPS ou imagem já presente
no projeto. Há prévia, descrição da imagem e remoção de fotos. Não foi criado um
serviço de upload de arquivos. Registros clínicos estruturados existentes são
preservados ao editar os campos básicos.

## Pendências que podem influenciar a nota

- Confirmar enunciados, linguagem/framework aceitos, itens obrigatórios e forma da
  entrega: URL, repositório, relatório ou apresentação local.
- CRUD completo de pets e busca pública por nome/raça, espécie e porte estão
  implementados. Favoritos não fazem parte desta entrega; confirmar se são exigidos.
- Fazer ensaio manual do fluxo em dois navegadores e testar o acesso no computador
  e na rede que serão usados na prova.
- Conferir se os PDFs de IHC, os slides e as telas descrevem o mesmo escopo.
- Preparar dados fictícios suficientes para demonstrar listagem e filtros, sem
  mudar registros existentes durante o ensaio sem intenção.
- Saber explicar trechos de HTML, CSS, JavaScript, rotas e modelos sem depender
  apenas da demonstração visual.

## Preparação prática

Seguir o README para executar o projeto. O servidor local precisa continuar em
execução para os formulários funcionarem; uma prévia estática não executa a API.
A instalação já usada nesta máquina dispõe de Python em `.venv/python.exe`.

O acesso local real foi preparado na porta 5090 nesta sessão; a prévia fictícia
da porta 5089 é uma demonstração separada. Para demonstrar persistência no Supabase,
usar o servidor real e verificar sua conexão antes da prova. Publicar o site só é
necessário se a entrega exigir uma URL acessível fora do computador.

Verificações desta entrega: 62 testes Python, 5 testes JavaScript, 27 cenários de
navegador e suíte separada da agenda aprovados. CRUD, filtros, validação, teclado,
cancelamento de edição e responsividade foram exercitados em dados fictícios.
Confira também IHC/Checklist-validacao.md para o ensaio manual com outra pessoa.

O CRUD também foi validado no PostgreSQL real com dados fictícios em uma transação
externa integralmente desfeita. Criação, consulta, edição, DELETE físico, mídia,
preservação de histórico, arquivamento e reativação passaram; as contagens foram
conferidas depois do rollback. Não foi necessária migração adicional.

### Onde mostrar o código durante a prova

| Arquivo | O que explicar |
| --- | --- |
| pages/gerencia-pets.html | Formulário, labels, campos obrigatórios e diálogo de edição |
| assets/css/gerencia-pets.css | Grade responsiva, estados de erro e aparência das ações |
| assets/js/modules/gerencia-pets.js | Eventos, fetch/JSON, preenchimento da edição e retorno das ações |
| app.py | cadastrar_pet, pets_gerencia, editar_pet e excluir_pet |
| pet_form.py | Validação dos campos antes da persistência |
| models.py | Chave primária do pet, fotos vinculadas e chave estrangeira dos agendamentos |
| tests/test_crud_pets.py | Como reproduzir as quatro operações sem alterar os dados reais |

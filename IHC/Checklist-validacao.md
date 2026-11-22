# IHC — validação e roteiro de observação

Escopo: consulta de pets, CRUD pela gerência e gestão de visitas. O sistema mantém
HTML, CSS e JavaScript puro, com API Flask e persistência relacional.

## Decisões implementadas e verificadas

| Princípio | Implementação | Verificação realizada |
| --- | --- | --- |
| Visibilidade do estado | Carregando, salvando, sucesso, erro e resultado vazio | Cenários de navegador e inspeção da interface |
| Linguagem compreensível | Cadastrar, editar, arquivar, reativar e excluir com consequências explicadas | Revisão textual e roteiro de apresentação |
| Controle e liberdade | Cancelar edição, Escape e escolha de descartar ou manter dados | Teste de teclado e confirmação de descarte |
| Consistência | Tema, rótulos e componentes compartilhados com o restante do site | Inspeção visual no computador e celular |
| Prevenção de erros | Campos obrigatórios, limites e confirmação de exclusão definitiva | Testes de formulário e API |
| Recuperação de erros | Mensagem específica, foco no erro e preenchimento preservado | Cenário de foto inválida seguido de correção e envio |
| Reconhecimento | Campos preenchidos na edição, opções visíveis e descrição dos status | Testes de leitura e edição |
| Acessibilidade | Labels, foco visível, diálogo nativo, regiões de status e imagens descritas | Testes de foco, teclado e responsividade |
| Busca eficiente | Nome/raça, espécie e porte no catálogo; nome/raça/status na gerência | Testes de busca, resultado vazio e limpeza de filtros |
| Preservação do histórico | Exclusão física bloqueada com visitas; arquivamento e reativação | Testes de vínculos e mensagens de orientação |

Larguras exercitadas para o CRUD: 1440, 768, 390 e 320 px. Não foi detectada rolagem
horizontal da página nem do diálogo nesses cenários. O diálogo mantém a navegação
por teclado dentro do formulário e devolve o acesso à listagem ao fechar.

Os testes automatizados e a inspeção visual não substituem uma avaliação com pessoas.
Não houve teste com participantes reais nesta etapa, nem certificação de acessibilidade.

O botão **Criar conta** usa a terracota do tema, com texto branco e cantos levemente
arredondados. Hover escurece a terracota; foco de teclado acrescenta anel branco e
terracota escura, mantendo consistência com a paleta da página. Estados normal,
hover e foco e as larguras 390/320 px foram conferidos no navegador.

## Ensaio de usabilidade com outra pessoa

Preparar uma conta de teste e dados fictícios. Não mostrar senhas durante a gravação
ou apresentação. Explicar a tarefa e observar antes de orientar o participante.

| Tarefa | Resultado esperado |
| --- | --- |
| Encontrar um gato pequeno | Filtrar o catálogo e abrir a ficha correta |
| Cadastrar um pet pela gerência | Identificar obrigatórios e receber retorno de cadastro |
| Corrigir uma foto com endereço inválido | Entender o aviso e corrigir sem refazer o cadastro |
| Editar a história e desistir | Reconhecer Cancelar/Escape e decidir sobre o descarte |
| Excluir um pet novo sem visitas | Compreender a confirmação e ver a remoção da lista |
| Excluir um pet com histórico | Compreender o bloqueio e identificar a alternativa de arquivar |
| Solicitar visita e conferir confirmação | Encontrar Minhas visitas e compreender os status |

Registrar, para cada tarefa: conclusão, dúvidas, erros observados, necessidade de
ajuda, tempo aproximado e comentário da pessoa. Usar códigos de participante em
vez de dados pessoais. Não preencher resultados antes de realizar o teste.

Perguntas finais: “O que foi mais difícil?”, “Você entendeu a diferença entre
arquivar e excluir?” e “O retorno do sistema deixou claro se a ação funcionou?”.

## Material para explicar à banca

- Persona, mapa de empatia, jornada e pesquisa documental já estão na pasta IHC.
- Relacionar as necessidades descritas nesses materiais às decisões da interface.
- Demonstrar uma tarefa completa, um erro com recuperação e uma ação desfeita.
- Mostrar responsividade e navegação por Tab sem depender somente do mouse.
- Apresentar as funções reais do catálogo, agendamento e gerência. Etapas de adoção
  após a visita são conduzidas pelo abrigo fora do sistema e não possuem painel simulado.

Evidências técnicas desta rodada: resultados em
`%TEMP%/sbp-browser-security-0OVsj3` e `%TEMP%/sbp-gerencia-YmOcGD`.
Capturas do CRUD estão na pasta de resultados da suíte geral, com nomes
`crud-lista-largura.png` e `crud-form-largura.png`.

O servidor local real foi atualizado na porta 5090. A tela de gestão é
`http://127.0.0.1:5090/pages/gerencia-pets.html`, acessível à conta gerente já definida.

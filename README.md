# Sem Barreiras Pet

Projeto acadêmico de adoção responsável, com HTML/CSS/JavaScript e API Flask/SQLAlchemy.
Os pets e abrigos iniciais são exemplos. Cadastro, login, contato e visitas usam o
servidor e o banco configurado; não há autenticação simulada ou senhas no navegador.

## Executar localmente

Instale Python e, na raiz:

~~~powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe app.py
~~~

Acesse http://localhost:5000. Sem DATABASE_URL, o desenvolvimento usa SQLite local.
Se uma URL foi definida, sua falha é informada; não há troca silenciosa de banco.
Neste workspace, o Python portátil preparado está em .venv/python.exe.

Um servidor apenas estático permite visualizar páginas, mas os formulários precisam
da API. Abrir por file:// impede os módulos JavaScript de funcionar.

## Fluxos

- Cadastro exige consentimento e já inicia a sessão; login e logout usam cookies.
- A sessão é confirmada no servidor; contas locais das versões antigas são descartadas.
- Visitas exigem login e datas futuras, de terça a sábado, nos horários de Brasília
  disponíveis. O pet escolhido é enviado ao servidor. O registro fica pendente.
- Contato registra a mensagem e retorna um protocolo. Não envia e-mail.
- As quatro fichas iniciais são criadas sem sobrescrever animais já cadastrados.
  Campos ausentes no banco aparecem como não informados.
- Sem API, uma ficha de exemplo pode ser exibida para leitura, sem agendamento.
- Ainda não há painel da ONG, notificações, recuperação de senha ou edição/exclusão de conta.

## Onde encontrar cada parte

| Arquivo | Responsabilidade |
| --- | --- |
| app.py | Rotas da API e validações dos dados recebidos |
| models.py | Tabelas e formato dos dados devolvidos pela API |
| config.py | Configuração local e de produção |
| seed.py | Criação das tabelas e dos exemplos iniciais |
| assets/js/modules/api.js | Comunicação do navegador com a API |
| assets/js/modules/formularios.js | Login, cadastro e contato |
| assets/js/modules/scheduling-form.js | Solicitação de visita |
| assets/js/modules/pet-ficha.js | Exibição da ficha do animal |
| assets/js/data/pets.json | Fonte única dos pets de exemplo, compartilhada pelo navegador e pelo banco |

## Configuração e publicação

Use .env.example como referência. Não versione .env.
Em produção, configure SECRET_KEY aleatória de ao menos 32 caracteres e DATABASE_URL
com PostgreSQL persistente. APP_ENV=production ou VERCEL=1 desativa configuração implícita
de desenvolvimento. As tabelas ausentes são criadas na inicialização; alterações em
colunas existentes exigem migrações.

A conta de demonstração antiga não é criada. Se ainda usar a senha pública original,
essa senha é revogada na inicialização, preservando o registro e seus vínculos.

O deploy usa api/index.py e vercel.json. Enviar ao GitHub aciona a integração Vercel
existente. Esta correção é local; PostgreSQL e sessão no deploy precisam de validação.

Prefira frontend e API na mesma origem. config.js permite uma API separada;
configure FRONTEND_ORIGIN no servidor. Cookies entre sites diferentes exigem
configuração adicional de domínio/SameSite; não são habilitados automaticamente.

Google Maps é opcional: configure a chave de navegador restrita em config.js.
Sem chave, o endereço permanece disponível em texto.

## Testes

~~~powershell
$env:DATABASE_URL = 'sqlite:///:memory:'
python -m unittest discover -s tests -v
~~~

A suíte usa SQLite em memória e não acessa o banco remoto.
Para os testes de navegador, instale Playwright num ambiente de testes e execute:

~~~powershell
node tests/browser-regression.cjs
~~~

Defina PLAYWRIGHT_MODULE com o caminho do módulo se ele estiver instalado em outra pasta.
Defina PYTHON_EXE para selecionar o interpretador (padrão: python).
O script inicia um servidor local com banco em memória e o encerra ao terminar.
Evidências ficam em test-results, pasta ignorada pelo Git.

A auditoria original está em REVISAO_CODIGO.md. Resultados das correções: CORRECOES.md.

## Pesquisa e autoria das telas

As referências de IHC (persona, jornada e pesquisa documental) permanecem em IHC/;
as inspirações visuais estão em inspiracoes/. Créditos das fotos locais estão em
assets/img/CREDITOS.md. O projeto mantém HTML semântico, rótulos de formulários,
mensagens acessíveis, menu por teclado e respeito à preferência por movimento reduzido.

| Arquivo ou área | Responsável |
| --- | --- |
| assets/css/global.css | José Paulo (design system base) |
| pages/login.html / login.css | José Paulo |
| pages/cadastro.html / cadastro.css | Ana Clara |
| index.html / home.css (antigo index.css) | Lucas |
| IHC/ | Persona, jornada e pesquisa documental; jornada e pesquisa levantadas por Victor Seixas |

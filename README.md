# Sem Barreiras Pet

Plataforma acadêmica de adoção responsável que aproxima pessoas interessadas em adotar de ONGs e abrigos.
Nesta fase é um **site estático** (HTML semântico, CSS e JavaScript puro), publicado no GitHub Pages:
não há back-end, banco de dados, API nem autenticação.

## O problema

ONGs e abrigos independentes enfrentam caos na triagem de adotantes, no controle de vacinas e na divulgação de animais para feiras de adoção. Ao mesmo tempo, adotantes de primeira viagem precisam de informação confiável para reduzir a ansiedade e tomar uma decisão responsável.

## Oportunidade em IHC

O projeto trabalha com personas de alto apelo emocional: o adotante de primeira viagem, que sente dúvidas e responsabilidade, e o voluntário sobrecarregado, que precisa organizar informações e reduzir tarefas repetitivas. Esses perfis ajudam a construir mapas de empatia ricos e uma jornada que considera descoberta, filtros, perfil do animal, pré-adoção, avaliação, aprovação e acompanhamento posterior.

A página "Como funciona" responde diretamente à persona Camila Souza e à jornada em `IHC/`: explica as etapas sem pressa, deixa claro que a ONG avalia cada pedido, fala de custos e adaptação (as principais dificuldades citadas na pesquisa) e inclui, nos exemplos de pets, um animal idoso e um com deficiência, perfis que a pesquisa aponta como os mais preteridos.

## Escopo da plataforma (visão completa)

- Catálogo público com filtros por porte, espécie, temperamento e necessidades especiais.
- Formulário de pré-adoção e triagem com dados pessoais, moradia e contato.
- Painel administrativo da ONG para aprovar ou reprovar cadastros e atualizar o status da adoção.
- Perfis de animais com informações de saúde, vacinas, comportamento e histórico.
- Agendamento de visitas aos abrigos, com localização no mapa.
- Orientação para adaptação e suporte pós-adoção.

## Estado atual

| Área | Situação |
| --- | --- |
| Home (`index.html`) | Tema creme + terracota (`assets/css/tema.css`). Pets linkam para a ficha |
| Ficha do pet (`pages/pet.html?id=nina`) | Raça, idade, vacinas, doenças atuais e passadas, exames, convivência e cuidados. Dados fictícios em `assets/js/data/pets.js` |
| Login e cadastro (`pages/login.html`, `pages/cadastro.html`) | Cartão em duas colunas (painel institucional + formulário). Validam os campos com mensagens acessíveis e mostram um aviso de **demonstração**: não autenticam, não enviam e não salvam dados |
| Como funciona (`pages/como-funciona.html`) | Etapas, prévia de catálogo, agendamento, FAQ |
| Formulário de visita | **Modo prévia**: valida e confirma o preenchimento, mas não envia ao abrigo |
| Mapa do abrigo | Desenhado só se houver chave do Google Maps em `config.js`; sem chave, mostra o endereço em texto |
| Autenticação, catálogo real, filtros, painel da ONG, back-end | **Ainda não implementados** |

Todos os abrigos, endereços e pets de exemplo são **fictícios** e aparecem marcados como "Dados demonstrativos".

## Estrutura

```
sembarreiras-pet/
├── index.html                 landing page
├── config.js                  configuração pública (chave do Google Maps, vazia por padrão)
├── pages/                     login, cadastro, como-funciona, pet
├── assets/
│   ├── css/
│   │   ├── global.css         base: foco visível, skip link, .sr-only, .back-link
│   │   ├── tema.css           tokens do tema creme + terracota, cabeçalho, botões, rodapé
│   │   ├── auth.css           componente compartilhado de login e cadastro
│   │   ├── components.css     base da página "Como funciona" (apelidos dos tokens do tema)
│   │   └── home.css, login.css, cadastro.css, como-funciona.css, pet.css
│   ├── js/
│   │   ├── main.js            menu mobile + carrega módulos sob demanda
│   │   ├── data/pets.js       pets fictícios da ficha
│   │   └── modules/           auth-demo, maps, pet-ficha, scheduling-form
│   └── img/                   fotos locais (créditos em assets/img/CREDITOS.md)
├── IHC/                       persona, jornada e pesquisa documental
└── inspiracoes/               referências visuais
```

Ordem dos estilos: `global.css` → `tema.css` → `<página>.css` (login e cadastro carregam `auth.css`
antes do CSS da página; "Como funciona" carrega `components.css` antes de `tema.css`).

## Executar localmente

Na raiz do repositório:

```bash
python3 -m http.server 8000
```

Acesse `http://localhost:8000`. Abrir os arquivos com duplo clique (`file://`) mostra o conteúdo, mas os
módulos JavaScript não carregam; use sempre um servidor estático.

## Publicar no GitHub Pages

O site fica na raiz do repositório, então basta, em **Settings → Pages**, escolher a branch `main` e a pasta
`/ (root)`. Todos os caminhos são relativos e funcionam também em `usuario.github.io/sembarreiras-pet/`.

## Google Maps (opcional)

Com a chave vazia em `config.js` (padrão), a página "Como funciona" mostra o endereço do abrigo em texto.
Para desenhar o mapa:

1. No Google Cloud Console, ative a **Maps JavaScript API** e crie uma chave de navegador.
2. Restrinja a chave por **HTTP referrer** (ex.: `http://localhost:8000/*` e o domínio do GitHub Pages) e por API.
3. Preencha `googleMapsApiKey` em `config.js` (raiz do site).

Chaves de navegador ficam visíveis para quem acessa o site (é assim que o Google Maps funciona), por isso
`config.js` é versionado e publicado junto com o site; a proteção está nas restrições acima. Nunca use ali
uma chave sem restrição nem chaves de outras APIs.

## Acessibilidade

O protótipo segue como meta o nível AA da WCAG 2.2 e inclui:

- HTML semântico com `header`, `nav`, `main`, `section`, `article`, `footer`, `fieldset` e `legend`.
- Skip link para o conteúdo principal e um único `h1` por página, com hierarquia de headings sem saltos.
- Relação explícita entre todos os `label` e seus campos por meio de `for`/`id`.
- Campos obrigatórios com `required` e indicação textual acessível.
- Textos de auxílio e mensagens de erro conectados com `aria-describedby`; erros marcados com `aria-invalid`, foco no primeiro campo inválido.
- Mensagens de envio em região `aria-live`.
- Texto alternativo contextual para imagens informativas; ilustrações decorativas ocultas de leitores de tela.
- Contraste de cores definido no design system; estados que não dependem só de cor (texto, ícone, borda).
- Foco visível por `:focus-visible`, sem remover `outline`.
- FAQ com `<details>`/`<summary>` nativos, sem JavaScript.
- Menu e conteúdo essencial funcionam sem JavaScript (aprimoramento progressivo). Sem JS, login e cadastro
  usam a validação nativa do navegador e não enviam nada.
- Unidades relativas, layout responsivo sem rolagem horizontal a partir de 320 px (equivalente a 1280 px com zoom de 400%).
- Respeito a `prefers-reduced-motion`.

## Limitações atuais e próximos passos

- Sem back-end: login, cadastro e solicitação de visita apenas validam os campos e mostram um aviso honesto
  de demonstração. Não há recuperação de senha, "lembrar acesso" real, login social nem política de privacidade publicada.
- Sem catálogo real: "Encontrar um pet" aponta temporariamente para `index.html#pets-destaque`
  (procure por `TEMPORÁRIO` nos HTML) até existir `pages/catalogo.html`.
- O abrigo da página "Como funciona" está fixo no HTML (demonstração).
- As fotos são do Unsplash (licença livre, salvas no repositório; créditos em `assets/img/CREDITOS.md`) e
  devem ser trocadas por fotos enviadas pelas ONGs quando o catálogo real existir.
- O painel "Acompanhe seu pedido" (etapa 4) é um exemplo estático.

Próximos passos sugeridos: back-end com autenticação, política de privacidade, catálogo com filtros e
painel da ONG para confirmar visitas.

## Autoria das telas

| Arquivo | Responsável |
| --- | --- |
| `assets/css/global.css` | José Paulo (design system base) |
| `pages/login.html` / `login.css` | José Paulo |
| `pages/cadastro.html` / `cadastro.css` | Ana Clara |
| `index.html` / `home.css` (antigo `index.css`) | Lucas |
| `IHC/` | Persona, jornada e pesquisa documental (jornada e pesquisa levantadas por Victor Seixas) |

## Referências de pesquisa

As decisões de fluxo foram comparadas com referências do Mobbin para telas de login, cadastro e seções com imagens de pets. A identidade visual, o conteúdo e a estrutura foram adaptados às inspirações locais do projeto (`inspiracoes/`) e às regras de acessibilidade, sem copiar interfaces literalmente.

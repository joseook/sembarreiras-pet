# Sem Barreiras Pet

Protótipo acadêmico de uma plataforma de adoção responsável, desenvolvido para a primeira etapa prática de IHC com HTML semântico e CSS puro.

## O problema

ONGs e abrigos independentes enfrentam caos na triagem de adotantes, no controle de vacinas e na divulgação de animais para feiras de adoção. Ao mesmo tempo, adotantes de primeira viagem precisam de informação confiável para reduzir a ansiedade e tomar uma decisão responsável.

## Oportunidade em IHC

O projeto trabalha com personas de alto apelo emocional: o adotante de primeira viagem, que sente dúvidas e responsabilidade, e o voluntário sobrecarregado, que precisa organizar informações e reduzir tarefas repetitivas. Esses perfis ajudam a construir mapas de empatia ricos e uma jornada que considera descoberta, filtros, perfil do animal, pré-adoção, avaliação, aprovação e acompanhamento posterior.

## Escopo da plataforma

- Catálogo público com filtros por porte, espécie, temperamento e necessidades especiais.
- Formulário de pré-adoção e triagem com dados pessoais, moradia e contato.
- Painel administrativo da ONG para aprovar ou reprovar cadastros e atualizar o status da adoção.
- Perfis de animais com informações de saúde, vacinas, comportamento e histórico.
- Orientação para adaptação e suporte pós-adoção.

Nesta entrega foram implementadas as três telas estáticas da etapa atual:

- `index.html`: landing page institucional e vitrine de pets.
- `login.html`: página de acesso.
- `cadastro.html`: página de cadastro do adotante.

## Acessibilidade

O protótipo segue como meta o nível AA da WCAG e inclui:

- HTML semântico com `header`, `nav`, `main`, `section`, `article`, `footer`, `fieldset` e `legend`.
- Skip link para o conteúdo principal.
- Relação explícita entre todos os `label` e seus campos por meio de `for`/`id`.
- Campos obrigatórios com `required` e indicação textual acessível.
- Textos de auxílio conectados com `aria-describedby`.
- Texto alternativo contextual para imagens informativas.
- Contraste de cores definido no design system global.
- Foco visível por `:focus-visible`, sem remover `outline`.
- Unidades relativas, layout responsivo e suporte a zoom.
- Respeito a `prefers-reduced-motion`.

## Limitações desta etapa

Como o escopo exige HTML e CSS puro, não há JavaScript, lógica fullstack, autenticação real, filtros funcionais ou persistência de dados. Os formulários usam a validação nativa do navegador e ações estáticas apenas para demonstrar continuidade de navegação.

## Arquivos

| Arquivo | Responsabilidade |
| --- | --- |
| `global.css` | Variáveis, tokens WCAG, tipografia, foco e utilitários globais |
| `login.html` / `login.css` | Tela de login acessível |
| `cadastro.html` / `cadastro.css` | Tela de cadastro e triagem inicial |
| `index.html` / `landing.css` | Landing page, conteúdo institucional e pets em destaque |
| `IHC/` | Persona, jornada, pesquisa documental e materiais da primeira etapa |
| `inspirações/` | Referências visuais de login, cadastro e landing page |

## Executar localmente

Não há dependências de instalação. Basta abrir `index.html` no navegador ou iniciar um servidor estático na raiz do projeto:

```bash
python3 -m http.server 8000
```

Depois, acesse `http://localhost:8000`.

## Referências de pesquisa

As decisões de fluxo foram comparadas com referências do Mobbin para telas de login, cadastro e seções com imagens de pets. A identidade visual, o conteúdo e a estrutura foram adaptados às inspirações locais do projeto e às regras de acessibilidade, sem copiar interfaces literalmente.

/**
 * Sem Barreiras Pet — pet-ficha.js
 * Monta a ficha completa do animal (pages/pet.html?id=nina).
 *
 * Tudo é criado com createElement + textContent (nunca innerHTML com dados),
 * então um texto vindo de API no futuro não consegue injetar HTML.
 */
import { PETS, buscarPet } from '../data/pets.js';

const STATUS_VACINA = {
  'em-dia': { texto: 'Em dia', classe: 'p-selo--ok' },
  pendente: { texto: 'Pendente', classe: 'p-selo--alerta' },
  'nao-se-aplica': { texto: 'Não indicada', classe: 'p-selo--neutro' },
};

const CONVIVENCIA = {
  sim: { texto: 'Convive bem', classe: 'p-conv--sim', simbolo: '✓' },
  nao: { texto: 'Não recomendado', classe: 'p-conv--nao', simbolo: '✕' },
  'nao-testado': { texto: 'Ainda não testado', classe: 'p-conv--talvez', simbolo: '?' },
};

/** Cria um elemento com classe e texto (opcionais). */
function el(tag, classe, texto) {
  const no = document.createElement(tag);
  if (classe) no.className = classe;
  if (texto !== undefined) no.textContent = texto;
  return no;
}

function anexar(pai, ...filhos) {
  filhos.filter(Boolean).forEach((filho) => pai.append(filho));
  return pai;
}

/** "2026-03-12" -> "12/03/2026" */
function formatarData(iso) {
  if (!iso) return '—';
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

function sim(valor) {
  return valor ? 'Sim' : 'Não';
}

function secao(id, titulo, ...conteudo) {
  const s = el('section', 'p-secao');
  s.id = id;
  s.setAttribute('aria-labelledby', `${id}-titulo`);
  const h2 = el('h2', 'p-secao-titulo', titulo);
  h2.id = `${id}-titulo`;
  return anexar(s, h2, ...conteudo);
}

/* ---------------- Galeria ---------------- */

function montarGaleria(pet) {
  const galeria = el('div', 'p-galeria');
  galeria.setAttribute('role', 'group');
  galeria.setAttribute('aria-label', `Fotos de ${pet.nome}`);

  const principal = el('div', 'p-foto-principal');
  const img = document.createElement('img');
  img.width = 900;
  img.height = 1125;
  principal.append(img);

  const miniaturas = el('ul', 'p-miniaturas');

  function mostrar(indice) {
    const foto = pet.fotos[indice];
    img.src = foto.src;
    img.alt = foto.alt;
    miniaturas.querySelectorAll('button').forEach((botao, i) => {
      botao.setAttribute('aria-pressed', String(i === indice));
    });
  }

  pet.fotos.forEach((foto, indice) => {
    const li = el('li');
    const botao = el('button', 'p-miniatura');
    botao.type = 'button';
    botao.setAttribute('aria-label', `Ver foto ${indice + 1} de ${pet.fotos.length}`);
    const mini = document.createElement('img');
    mini.src = foto.src;
    mini.alt = '';
    mini.width = 180;
    mini.height = 180;
    botao.append(mini);
    botao.addEventListener('click', () => mostrar(indice));
    li.append(botao);
    miniaturas.append(li);
  });

  mostrar(0);
  return anexar(galeria, principal, miniaturas);
}

/* ---------------- Cartão lateral de ação ---------------- */

function montarCartaoAcao(pet) {
  const cartao = el('aside', 'p-cartao');
  cartao.setAttribute('aria-labelledby', 'cartao-titulo');

  const titulo = el('h2', 'p-cartao-titulo', `Quer conhecer ${artigo(pet, 'a')} ${pet.nome}?`);
  titulo.id = 'cartao-titulo';

  const vacinasPendentes = pet.vacinas.filter((v) => v.status === 'pendente').length;
  const resumo = el('ul', 'p-cartao-resumo');
  [
    pet.castrado ? 'Castração feita' : 'Castração a fazer (abrigo cobre)',
    vacinasPendentes === 0 ? 'Vacinas em dia' : `${vacinasPendentes} vacina(s) pendente(s)`,
    pet.doencasAtuais.length === 0 ? 'Sem doença atual' : 'Tem condição de saúde: veja os detalhes',
  ].forEach((texto) => resumo.append(el('li', null, texto)));

  const agendar = el('a', 't-btn t-btn--terracota', 'Agendar visita');
  agendar.href = 'como-funciona.html#etapa-visita';

  const conta = el('a', 't-btn t-btn--contorno', 'Criar conta para adotar');
  conta.href = 'cadastro.html';

  const nota = el(
    'p',
    'p-cartao-nota',
    'Adotar não tem pressa: você visita, conversa com o abrigo e só então decide.',
  );

  return anexar(cartao, titulo, resumo, agendar, conta, nota);
}

/** Artigo para frases: 'a' (a Nina) / 'o' (o Simba) conforme o sexo. */
function artigo(pet, tipo) {
  const feminino = pet.sexo === 'Fêmea';
  if (tipo === 'a') return feminino ? 'a' : 'o';
  return feminino ? 'ela' : 'ele';
}

/* ---------------- Seções ---------------- */

function montarFatos(pet) {
  const fatos = [
    ['Espécie', pet.especie],
    ['Raça', pet.raca],
    ['Idade', pet.idade],
    ['Sexo', pet.sexo],
    ['Porte', `${pet.porte} (${pet.peso})`],
    ['Pelagem', pet.cor],
    ['Castrado(a)', sim(pet.castrado)],
    ['Microchip', sim(pet.microchip)],
    ['Nível de energia', pet.energia],
    ['Abrigo', pet.abrigo],
  ];
  const dl = el('dl', 'p-fatos');
  fatos.forEach(([nome, valor]) => {
    const bloco = el('div');
    anexar(bloco, el('dt', null, nome), el('dd', null, valor));
    dl.append(bloco);
  });
  return dl;
}

function montarSobre(pet) {
  const tags = el('ul', 'p-tags');
  pet.temperamento.forEach((t) => tags.append(el('li', 't-chip t-chip--terracota', t)));
  return secao(
    'sobre',
    `Sobre ${artigo(pet, 'a')} ${pet.nome}`,
    el('h3', 'p-sub', 'Temperamento'),
    tags,
    el('h3', 'p-sub', 'História'),
    el('p', 'p-texto', pet.historia),
    el('h3', 'p-sub', 'Rotina e necessidades'),
    el('p', 'p-texto', pet.rotina),
  );
}

function montarConvivencia(pet) {
  const grade = el('ul', 'p-conv-grade');
  [
    ['Crianças', pet.convive.criancas],
    ['Outros cães', pet.convive.caes],
    ['Gatos', pet.convive.gatos],
  ].forEach(([nome, valor]) => {
    const info = CONVIVENCIA[valor];
    const li = el('li', `p-conv ${info.classe}`);
    const simbolo = el('span', 'p-conv-simbolo', info.simbolo);
    simbolo.setAttribute('aria-hidden', 'true');
    anexar(li, simbolo, el('span', 'p-conv-nome', nome), el('span', 'p-conv-texto', info.texto));
    grade.append(li);
  });

  return secao(
    'convivencia',
    'Convivência',
    grade,
    el('p', 'p-texto', `Vida em apartamento: ${pet.apartamento}.`),
  );
}

function montarVacinas(pet) {
  const tabela = el('table', 'p-tabela');
  const legenda = el('caption', 'sr-only', `Carteira de vacinação de ${pet.nome}`);
  const cabeca = el('thead');
  const linhaCabeca = el('tr');
  ['Vacina', 'Aplicada em', 'Próxima dose', 'Situação'].forEach((nome) => {
    const th = el('th', null, nome);
    th.scope = 'col';
    linhaCabeca.append(th);
  });
  cabeca.append(linhaCabeca);

  const corpo = el('tbody');
  pet.vacinas.forEach((vacina) => {
    const info = STATUS_VACINA[vacina.status];
    const linha = el('tr');
    const nome = el('th', null, vacina.nome);
    nome.scope = 'row';
    const selo = el('span', `p-selo ${info.classe}`, info.texto);
    const celulaStatus = el('td');
    celulaStatus.setAttribute('data-rotulo', 'Situação');
    celulaStatus.append(selo);

    const aplicada = el('td', null, formatarData(vacina.aplicada));
    aplicada.setAttribute('data-rotulo', 'Aplicada em');
    const proxima = el('td', null, formatarData(vacina.proxima));
    proxima.setAttribute('data-rotulo', 'Próxima dose');
    anexar(linha, nome, aplicada, proxima, celulaStatus);
    corpo.append(linha);
  });
  anexar(tabela, legenda, cabeca, corpo);

  const extras = el('ul', 'p-lista');
  anexar(extras, el('li', null, pet.vermifugo), el('li', null, pet.antiparasitario));

  // A tabela fica numa região rolável para telas pequenas
  const rolagem = el('div', 'p-tabela-rolagem');
  rolagem.append(tabela);

  return anexar(
    el('div', 'p-bloco'),
    el('h3', 'p-sub', 'Carteira de vacinação'),
    rolagem,
    el('h3', 'p-sub', 'Vermífugo e antiparasitário'),
    extras,
  );
}

function montarDoencas(pet) {
  const atuais = el('div', 'p-bloco');
  atuais.append(el('h3', 'p-sub', 'Condição de saúde atual'));
  if (pet.doencasAtuais.length === 0) {
    const ok = el('p', 'p-aviso p-aviso--ok', `Nenhuma doença diagnosticada no momento. ${pet.alergias === 'Nenhuma conhecida.' ? 'Sem alergias conhecidas.' : ''}`.trim());
    atuais.append(ok);
  } else {
    pet.doencasAtuais.forEach((d) => {
      const cartao = el('article', 'p-aviso p-aviso--alerta');
      const titulo = el('h4', 'p-aviso-titulo', d.nome);
      const lista = el('dl', 'p-aviso-lista');
      [
        ['Situação', d.situacao],
        ['Tratamento', d.tratamento],
        ['Custo estimado', d.custoMensal],
      ].forEach(([nome, valor]) => {
        if (!valor) return;
        anexar(lista, el('dt', null, nome), el('dd', null, valor));
      });
      anexar(cartao, titulo, lista);
      atuais.append(cartao);
    });
  }

  const passadas = el('div', 'p-bloco');
  passadas.append(el('h3', 'p-sub', 'Histórico de doenças'));
  if (pet.doencasPassadas.length === 0) {
    passadas.append(el('p', 'p-texto', 'Nenhuma doença anterior registrada.'));
  } else {
    const lista = el('ul', 'p-historico');
    pet.doencasPassadas.forEach((d) => {
      const li = el('li');
      anexar(li, el('strong', null, d.nome), el('span', 'p-historico-quando', d.quando), el('span', null, d.situacao));
      lista.append(li);
    });
    passadas.append(lista);
  }

  const alergias = el('div', 'p-bloco');
  anexar(alergias, el('h3', 'p-sub', 'Alergias'), el('p', 'p-texto', pet.alergias));

  return secao('saude', 'Saúde e doenças', atuais, passadas, alergias);
}

function montarExames(pet) {
  const tabela = el('table', 'p-tabela');
  anexar(tabela, el('caption', 'sr-only', `Exames de ${pet.nome}`));
  const cabeca = el('thead');
  const linhaCabeca = el('tr');
  ['Exame', 'Resultado', 'Data'].forEach((nome) => {
    const th = el('th', null, nome);
    th.scope = 'col';
    linhaCabeca.append(th);
  });
  cabeca.append(linhaCabeca);
  const corpo = el('tbody');
  pet.exames.forEach((exame) => {
    const linha = el('tr');
    const nome = el('th', null, exame.nome);
    nome.scope = 'row';
    const resultado = el('td', null, exame.resultado);
    resultado.setAttribute('data-rotulo', 'Resultado');
    const data = el('td', null, formatarData(exame.data));
    data.setAttribute('data-rotulo', 'Data');
    anexar(linha, nome, resultado, data);
    corpo.append(linha);
  });
  anexar(tabela, cabeca, corpo);
  const rolagem = el('div', 'p-tabela-rolagem');
  rolagem.append(tabela);
  return rolagem;
}

function montarCuidados(pet) {
  return secao(
    'cuidados',
    'Cuidados e alimentação',
    el('h3', 'p-sub', 'Cuidados específicos'),
    el('p', 'p-texto', pet.cuidados),
    el('h3', 'p-sub', 'Alimentação'),
    el('p', 'p-texto', pet.alimentacao),
  );
}

function montarAbrigo(pet) {
  const aviso = el('p', 'p-aviso p-aviso--info');
  aviso.append(
    'Dados de exemplo. Antes da adoção, o abrigo entrega a carteira de vacinação e os laudos originais. ',
    (() => {
      const link = el('a', null, 'Veja o passo a passo da adoção');
      link.href = 'como-funciona.html';
      return link;
    })(),
    '.',
  );
  return secao('abrigo', 'Abrigo responsável', el('p', 'p-texto', `${pet.nome} está no ${pet.abrigo}.`), aviso);
}

/* ---------------- Página ---------------- */

function montarFicha(pet) {
  const raiz = el('div', 'p-ficha');

  const cabecalho = el('header', 'p-cabecalho');
  const h1 = el('h1', null, pet.nome);
  h1.id = 'titulo-pet';
  const linha = el('p', 'p-cabecalho-linha', `${pet.especie} · ${pet.raca} · ${pet.idade} · ${pet.sexo}`);
  const etiquetas = el('ul', 'p-tags');
  pet.etiquetas.forEach((e) => etiquetas.append(el('li', 't-chip t-chip--terracota', e)));
  anexar(cabecalho, h1, linha, etiquetas);

  // Navegação interna (âncoras), no estilo das abas de uma página de anúncio
  const nav = el('nav', 'p-abas');
  nav.setAttribute('aria-label', 'Seções da ficha');
  const lista = el('ul');
  [
    ['sobre', 'Sobre'],
    ['convivencia', 'Convivência'],
    ['vacinas', 'Vacinas'],
    ['saude', 'Saúde'],
    ['exames', 'Exames'],
    ['cuidados', 'Cuidados'],
  ].forEach(([id, nome]) => {
    const li = el('li');
    const a = el('a', null, nome);
    a.href = `#${id}`;
    li.append(a);
    lista.append(li);
  });
  nav.append(lista);

  const coluna = el('div', 'p-coluna');
  anexar(
    coluna,
    montarFatos(pet),
    montarSobre(pet),
    montarConvivencia(pet),
    (() => {
      const s = secao('vacinas', 'Vacinas e prevenção');
      s.append(montarVacinas(pet));
      return s;
    })(),
    montarDoencas(pet),
    secao('exames', 'Exames realizados', montarExames(pet)),
    montarCuidados(pet),
    montarAbrigo(pet),
  );

  const lateral = el('div', 'p-lateral');
  lateral.append(montarCartaoAcao(pet));

  const corpo = el('div', 'p-corpo');
  anexar(corpo, coluna, lateral);

  const topo = el('div', 'p-topo');
  anexar(topo, montarGaleria(pet), anexar(el('div', 'p-topo-info'), cabecalho));

  return anexar(raiz, topo, nav, corpo);
}

function montarNaoEncontrado(container) {
  container.replaceChildren();
  const caixa = el('div', 'p-aviso p-aviso--erro');
  caixa.setAttribute('role', 'alert');
  anexar(
    caixa,
    el('h1', 'p-aviso-titulo', 'Não encontramos esse animal'),
    el('p', null, 'O endereço pode estar incorreto ou o pet já foi adotado. Escolha um dos animais abaixo:'),
  );
  const lista = el('ul', 'p-tags');
  PETS.forEach((pet) => {
    const li = el('li');
    const a = el('a', 't-btn t-btn--contorno t-btn--pequeno', pet.nome);
    a.href = `pet.html?id=${encodeURIComponent(pet.id)}`;
    li.append(a);
    lista.append(li);
  });
  caixa.append(lista);
  container.append(caixa);
  document.title = 'Animal não encontrado - Sem Barreiras Pet';
}

function iniciar() {
  const container = document.querySelector('[data-ficha]');
  if (!container) return;

  const id = new URLSearchParams(window.location.search).get('id');
  const pet = id ? buscarPet(id) : null;
  if (!pet) {
    montarNaoEncontrado(container);
    return;
  }

  container.replaceChildren(montarFicha(pet));
  document.title = `${pet.nome}, ${pet.raca} - Sem Barreiras Pet`;
}

iniciar();

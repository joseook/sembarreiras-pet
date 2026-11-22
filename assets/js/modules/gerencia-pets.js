import { currentSession, requestApi } from './api.js';

const $ = id => document.getElementById(id);
const editor = $('editor'), form = $('form-pet'), filtros = $('filtros');
let pagina = 1, filtro = new URLSearchParams({ status: 'todos' });
let ocupado = false, salvando = false, alterado = false, editando = null, numeroFoto = 0;
const nomesTexto = ['nome', 'especie', 'sexo', 'status', 'raca', 'idade', 'porte', 'peso', 'cor',
  'resumo', 'historia', 'rotina', 'apartamento', 'vermifugo', 'antiparasitario', 'alergias'];
const estados = { disponivel: 'Disponível', 'em-adocao': 'Em adoção', adotado: 'Adotado', arquivado: 'Arquivado' };

function el(tag, texto, classe) {
  const no = document.createElement(tag);
  if (texto !== undefined) no.textContent = texto;
  if (classe) no.className = classe;
  return no;
}
function avisar(texto, erro = false) {
  $('feedback').textContent = texto; $('feedback').classList.toggle('erro', erro);
}
function tratarErro(erro) {
  avisar(erro.message, true);
  if (erro.status === 401 || erro.status === 403) {
    $('painel').hidden = true; $('lista').replaceChildren();
    $('acesso').hidden = erro.status !== 401;
  }
}
function limparErros() {
  $('form-erro').hidden = true;
  form.querySelectorAll('[aria-invalid]').forEach(campo => campo.removeAttribute('aria-invalid'));
  form.querySelectorAll('.pet-erro').forEach(erro => { erro.hidden = true; erro.textContent = ''; });
}
function exibirErros(erro) {
  $('form-erro').textContent = erro.message; $('form-erro').hidden = false;
  for (const [nome, mensagem] of Object.entries(erro.campos || {})) {
    const aviso = $('erro-' + nome), campo = form.elements.namedItem(nome);
    if (aviso) { aviso.textContent = mensagem; aviso.hidden = false; }
    if (campo && campo.setAttribute) {
      campo.setAttribute('aria-invalid', 'true');
      const descricoes = new Set((campo.getAttribute('aria-describedby') || '').split(' ').filter(Boolean));
      if (aviso) descricoes.add(aviso.id);
      campo.setAttribute('aria-describedby', [...descricoes].join(' '));
    }
  }
  (form.querySelector('[aria-invalid="true"]') || $('form-erro')).focus();
}

function adicionarFoto(foto = {}, focar = true) {
  if ($('fotos').children.length >= 6) return;
  const numero = ++numeroFoto, grupo = el('div', undefined, 'pet-foto');
  const endereco = el('input'); endereco.dataset.fotoSrc = ''; endereco.id = `foto-src-${numero}`;
  endereco.required = true; endereco.maxLength = 1500; endereco.value = foto.src || '';
  endereco.placeholder = 'https://… ou ../assets/img/pets/nina.jpg';
  const descricao = el('input'); descricao.dataset.fotoAlt = ''; descricao.id = `foto-alt-${numero}`;
  descricao.required = true; descricao.maxLength = 200; descricao.value = foto.alt || '';
  for (const [texto, campo] of [['Endereço da foto', endereco], ['Descrição da imagem', descricao]]) {
    const campoGrupo = el('div', undefined, 'pet-campo'), label = el('label', texto);
    label.htmlFor = campo.id; campoGrupo.append(label, campo); grupo.append(campoGrupo);
  }
  const imagem = el('img'); imagem.alt = foto.alt || 'Prévia da foto'; imagem.hidden = true;
  const aviso = el('p', '', 'pet-ajuda'); aviso.setAttribute('role', 'status');
  function mostrar() {
    aviso.textContent = ''; imagem.hidden = !endereco.value.trim();
    if (endereco.value.trim()) { imagem.src = endereco.value.trim(); imagem.alt = descricao.value.trim() || 'Prévia da foto'; }
  }
  imagem.addEventListener('error', () => { imagem.hidden = true; aviso.textContent = 'Não foi possível exibir a foto. Confira o endereço.'; });
  endereco.addEventListener('change', mostrar); descricao.addEventListener('change', mostrar);
  const remover = el('button', 'Remover foto'); remover.type = 'button';
  remover.setAttribute('aria-label', `Remover foto ${numero}`);
  remover.addEventListener('click', () => {
    grupo.remove(); alterado = true; $('adicionar-foto').disabled = false; $('adicionar-foto').focus();
  });
  grupo.append(imagem, aviso, remover); $('fotos').append(grupo); mostrar();
  $('adicionar-foto').disabled = $('fotos').children.length >= 6;
  if (focar) { alterado = true; endereco.focus(); }
}

async function abrir(petId = null) {
  if (ocupado) return;
  let pet = null;
  if (petId) {
    ocupado = true; avisar('Carregando a ficha para edição…');
    try { pet = (await requestApi('/api/gerencia/pets/' + encodeURIComponent(petId))).pet; }
    catch (erro) { tratarErro(erro); return; }
    finally { ocupado = false; }
  }
  form.reset(); limparErros(); $('fotos').replaceChildren(); numeroFoto = 0;
  editando = pet?.id || null;
  $('editor-titulo').textContent = pet ? 'Editar pet: ' + pet.nome : 'Cadastrar pet';
  $('salvar-pet').textContent = pet ? 'Salvar alterações' : 'Cadastrar pet';
  for (const nome of nomesTexto) form.elements.namedItem(nome).value = pet?.[nome] ?? (nome === 'status' ? 'disponivel' : '');
  for (const nome of ['castrado', 'microchip']) form.elements.namedItem(nome).value = pet?.[nome] === true ? 'sim' : pet?.[nome] === false ? 'nao' : '';
  form.elements.temperamento.value = (pet?.temperamento || []).join(', ');
  $('adicionar-foto').disabled = false;
  for (const foto of pet?.fotos || []) adicionarFoto(foto, false);
  alterado = false; editor.showModal(); $('pet-nome').focus();
}
function fechar() {
  if (salvando || (alterado && !window.confirm('Descartar as alterações que ainda não foram salvas?'))) return;
  alterado = false; editor.close();
}
$('fechar-editor').addEventListener('click', fechar); $('cancelar-editor').addEventListener('click', fechar);
editor.addEventListener('cancel', evento => { evento.preventDefault(); fechar(); });
form.addEventListener('input', () => { alterado = true; });
form.addEventListener('change', () => { alterado = true; });
window.addEventListener('beforeunload', evento => { if (editor.open && alterado) { evento.preventDefault(); evento.returnValue = ''; } });
$('adicionar-foto').addEventListener('click', () => adicionarFoto());
$('novo-pet').addEventListener('click', () => abrir());

form.addEventListener('submit', async evento => {
  evento.preventDefault();
  if (salvando) return;
  limparErros();
  const dados = Object.fromEntries(nomesTexto.map(nome => [nome, form.elements.namedItem(nome).value]));
  for (const nome of ['castrado', 'microchip']) {
    const valor = form.elements.namedItem(nome).value;
    dados[nome] = valor === '' ? null : valor === 'sim';
  }
  dados.temperamento = form.elements.temperamento.value.split(',').map(v => v.trim()).filter(Boolean);
  dados.fotos = [...$('fotos').children].map(grupo => ({ src: grupo.querySelector('[data-foto-src]').value, alt: grupo.querySelector('[data-foto-alt]').value }));
  salvando = true; $('editor-campos').disabled = true; $('salvar-pet').disabled = true;
  $('salvar-pet').textContent = 'Salvando…';
  try {
    const resultado = await requestApi('/api/gerencia/pets' + (editando ? '/' + encodeURIComponent(editando) : ''), { method: editando ? 'PUT' : 'POST', body: dados });
    alterado = false; editor.close();
    filtros.elements.q.value = resultado.pet.nome; filtros.elements.status.value = 'todos';
    filtro = new URLSearchParams(new FormData(filtros)); pagina = 1;
    await carregar(resultado.mensagem); $('resumo').focus();
  } catch (erro) { $('editor-campos').disabled = false; exibirErros(erro); }
  finally {
    salvando = false; $('editor-campos').disabled = false; $('salvar-pet').disabled = false;
    $('adicionar-foto').disabled = $('fotos').children.length >= 6;
    $('salvar-pet').textContent = editando ? 'Salvar alterações' : 'Cadastrar pet';
  }
});

function cartao(pet) {
  const item = el('li', undefined, 'agenda-card pet-cartao');
  if (pet.fotos?.[0]?.src) {
    const img = el('img'); img.src = pet.fotos[0].src; img.alt = pet.fotos[0].alt || pet.nome;
    img.loading = 'lazy'; img.addEventListener('error', () => { img.replaceWith(el('p', 'Foto indisponível')); }, { once: true });
    item.append(img);
  }
  item.append(el('h3', pet.nome), el('span', estados[pet.status] || 'Status não informado', 'agenda-status'),
    el('p', [pet.especie, pet.raca, pet.idade, pet.porte].filter(Boolean).join(' · ')));
  const acoes = el('div', undefined, 'agenda-acoes');
  const editar = el('button', 'Editar'); editar.type = 'button'; editar.setAttribute('aria-label', 'Editar ' + pet.nome);
  editar.addEventListener('click', () => abrir(pet.id)); acoes.append(editar);
  if (pet.status !== 'arquivado') {
    const ficha = el('a', 'Ver ficha'); ficha.href = 'pet.html?id=' + encodeURIComponent(pet.id); acoes.append(ficha);
  }
  for (const [texto, acao] of [[pet.status === 'arquivado' ? 'Reativar' : 'Arquivar', 'status'], ['Excluir', 'excluir']]) {
    const botao = el('button', texto); botao.type = 'button'; botao.setAttribute('aria-label', texto + ' ' + pet.nome);
    if (acao === 'excluir') botao.className = 'pet-excluir';
    botao.addEventListener('click', async () => {
      if (ocupado) return;
      const confirmacao = acao === 'excluir' ? `Excluir ${pet.nome} definitivamente? Essa ação não pode ser desfeita. Pets com histórico devem ser arquivados.`
        : pet.status === 'arquivado' ? `Reativar ${pet.nome} e permitir novas visitas?` : `Arquivar ${pet.nome}? Ele sairá da consulta pública, e o histórico será preservado.`;
      if (!window.confirm(confirmacao)) return;
      ocupado = true; botao.disabled = true;
      try {
        const resultado = await requestApi('/api/gerencia/pets/' + encodeURIComponent(pet.id), {
          method: acao === 'excluir' ? 'DELETE' : 'PUT',
          body: acao === 'excluir' ? {} : { status: pet.status === 'arquivado' ? 'disponivel' : 'arquivado' },
        });
        ocupado = false; await carregar(resultado.mensagem); $('resumo').focus();
      } catch (erro) { tratarErro(erro); }
      finally { ocupado = false; botao.disabled = false; }
    });
    acoes.append(botao);
  }
  item.append(acoes); return item;
}

async function carregar(mensagem = '') {
  if (ocupado) return;
  ocupado = true; $('painel').setAttribute('aria-busy', 'true');
  $('anterior').disabled = $('proxima').disabled = true; $('novo-pet').disabled = true;
  $('lista').replaceChildren(); avisar('Consultando pets…');
  try {
    const params = new URLSearchParams(filtro); params.set('pagina', pagina);
    let dados = await requestApi('/api/gerencia/pets?' + params);
    if (!dados.pets.length && pagina > 1) {
      pagina = Math.max(1, Math.ceil(dados.total / dados.por_pagina)); params.set('pagina', pagina);
      dados = await requestApi('/api/gerencia/pets?' + params);
    }
    $('lista').replaceChildren(...dados.pets.map(cartao));
    $('resumo').textContent = dados.total === 1 ? '1 pet encontrado' : `${dados.total} pets encontrados`;
    $('pagina').textContent = `Página ${pagina} de ${Math.max(1, Math.ceil(dados.total / dados.por_pagina))}`;
    $('anterior').disabled = pagina <= 1; $('proxima').disabled = pagina * dados.por_pagina >= dados.total;
    avisar(mensagem || (dados.total ? 'Lista atualizada.' : 'Nenhum pet encontrado. Limpe os filtros ou cadastre um pet.'));
  } catch (erro) { tratarErro(erro); $('resumo').textContent = 'Consulta indisponível'; }
  finally { ocupado = false; $('novo-pet').disabled = false; $('painel').removeAttribute('aria-busy'); }
}
filtros.addEventListener('submit', evento => {
  evento.preventDefault(); if (ocupado) return;
  filtro = new URLSearchParams(new FormData(filtros)); pagina = 1; carregar();
});
filtros.addEventListener('reset', evento => {
  evento.preventDefault(); if (ocupado) return;
  filtros.elements.q.value = ''; filtros.elements.status.value = 'todos';
  filtro = new URLSearchParams({ status: 'todos' }); pagina = 1; carregar();
});
for (const [id, passo] of [['anterior', -1], ['proxima', 1]]) $(id).addEventListener('click', () => { if (!ocupado) { pagina += passo; carregar(); } });
$('sair').addEventListener('click', async () => {
  if (ocupado) return; ocupado = true;
  try { await requestApi('/api/auth/logout', { method: 'POST', body: {} }); window.location.assign('login.html'); }
  catch (erro) { tratarErro(erro); } finally { ocupado = false; }
});
try {
  const sessao = await currentSession();
  if (!sessao.autenticado) { avisar('Entre na sua conta para gerenciar pets.'); $('acesso').hidden = false; }
  else if (!sessao.usuario.gerente) { avisar('Acesso exclusivo da gerência.', true); $('sair').hidden = false; }
  else if (sessao.usuario.trocar_senha) window.location.replace('alterar-senha.html');
  else { $('painel').hidden = false; $('sair').hidden = false; await carregar(); }
} catch (erro) { tratarErro(erro); }

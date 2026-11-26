import { currentSession, requestApi } from './api.js';
import { acoesVisita } from './agenda-acoes.js';
import { ocupar } from './form-feedback.js';

const painel = document.getElementById('painel');
const feedback = document.getElementById('feedback');
const lista = document.getElementById('lista');
const filtros = document.getElementById('filtros');
const anterior = document.getElementById('anterior');
const proxima = document.getElementById('proxima');
const sair = document.getElementById('sair');
let pagina = 1;
let ocupado = false;
let filtroAtual = new URLSearchParams({ status: 'pendente' });

function avisar(texto, erro = false) {
  feedback.textContent = texto;
  feedback.classList.toggle('erro', erro);
}

function elemento(tag, texto, classe) {
  const node = document.createElement(tag);
  if (texto !== undefined) node.textContent = texto;
  if (classe) node.className = classe;
  return node;
}

function tratarErro(erro) {
  avisar(erro.message, true);
  if (erro.status === 401 || erro.status === 403) {
    lista.replaceChildren();
    painel.hidden = true;
    document.getElementById('acesso').hidden = erro.status !== 401;
  }
}

function card(visita) {
  const item = elemento('li', undefined, 'agenda-card');
  const topo = elemento('div', undefined, 'agenda-card-topo');
  const data = visita.data_visita.split('-').reverse().join('/');
  topo.append(elemento('h3', `${data} às ${visita.horario}`));
  const estados = { pendente: 'Pendente', confirmado: 'Confirmado', cancelado: 'Cancelado' };
  const estado = Object.hasOwn(estados, visita.status) ? visita.status : '';
  topo.append(elemento('span', estados[estado] || 'Status não informado', `agenda-status agenda-status--${estado}`));
  const detalhes = elemento('dl');
  for (const [titulo, valor] of [
    ['Solicitação', `#${visita.id}`], ['Pet', visita.pet_nome || 'Não informado'],
    ['Solicitante', visita.solicitante?.nome || 'Cadastro indisponível'],
    ['Telefone', visita.solicitante?.telefone || 'Não informado'],
    ['E-mail', visita.solicitante?.email || 'Não informado'],
  ]) {
    const grupo = elemento('div');
    grupo.append(elemento('dt', titulo), elemento('dd', valor));
    detalhes.append(grupo);
  }
  item.append(topo, detalhes, elemento('p', visita.mensagem || 'Sem mensagem do solicitante.', 'agenda-mensagem'));
  if (visita.status === 'pendente') {
    const botao = elemento('button', 'Confirmar visita', 't-btn t-btn--terracota');
    botao.type = 'button';
    // O nome acessível começa pelo texto visível (WCAG 2.5.3)
    botao.setAttribute('aria-label', `Confirmar visita: solicitação ${visita.id}, ${data} às ${visita.horario}`);
    botao.addEventListener('click', async () => {
      if (ocupado) return;
      if (!window.confirm(`Confirmar a visita de ${visita.solicitante?.nome || 'solicitante'} em ${data} às ${visita.horario}?`)) return;
      ocupado = true;
      ocupar(botao, true, 'Confirmando…');
      try {
        const resultado = await requestApi(`/api/gerencia/agendamentos/${visita.id}/confirmar`, { method: 'POST', body: {} });
        ocupado = false;
        await carregar(resultado.mensagem);
        document.getElementById('resumo').focus();
      } catch (erro) {
        tratarErro(erro);
        ocupar(botao, false);
        feedback.focus();
      } finally { ocupado = false; }
    });
    item.append(botao);
  }
  item.append(acoesVisita(visita, carregar, tratarErro, () => !ocupado));
  return item;
}

async function carregar(mensagem = '') {
  if (ocupado) return;
  ocupado = true;
  painel.setAttribute('aria-busy', 'true');
  lista.replaceChildren();
  avisar(mensagem ? `${mensagem} Atualizando lista…` : 'Carregando agendamentos…');
  anterior.disabled = proxima.disabled = true;
  filtros.querySelector('button').disabled = true;
  try {
    const parametros = new URLSearchParams(filtroAtual);
    parametros.set('pagina', pagina);
    let resultado = await requestApi('/api/gerencia/agendamentos?' + parametros);
    if (!resultado.agendamentos.length && pagina > 1) {
      pagina = Math.max(1, Math.ceil(resultado.total / resultado.por_pagina));
      parametros.set('pagina', pagina);
      resultado = await requestApi('/api/gerencia/agendamentos?' + parametros);
    }
    lista.replaceChildren(...resultado.agendamentos.map(card));
    document.getElementById('resumo').textContent = resultado.total === 1
      ? '1 agendamento encontrado' : `${resultado.total} agendamentos encontrados`;
    document.getElementById('pagina').textContent = `Página ${pagina} de ${Math.max(1, Math.ceil(resultado.total / resultado.por_pagina))}`;
    anterior.disabled = pagina <= 1;
    proxima.disabled = pagina * resultado.por_pagina >= resultado.total;
    avisar(mensagem || (resultado.total ? 'Agenda atualizada.' : 'Nenhum agendamento para estes filtros.'));
  } catch (erro) {
    document.getElementById('resumo').textContent = 'Não foi possível atualizar a agenda';
    document.getElementById('pagina').textContent = '';
    tratarErro(erro);
  } finally {
    ocupado = false;
    filtros.querySelector('button').disabled = false;
    painel.removeAttribute('aria-busy');
  }
}

filtros.addEventListener('submit', evento => {
  evento.preventDefault();
  if (ocupado) return;
  filtroAtual = new URLSearchParams(new FormData(filtros));
  pagina = 1;
  carregar();
});
anterior.addEventListener('click', () => { if (!ocupado && pagina > 1) { pagina--; carregar(); } });
proxima.addEventListener('click', () => { if (!ocupado) { pagina++; carregar(); } });
sair.addEventListener('click', async () => {
  if (ocupado) return;
  ocupado = true;
  sair.disabled = true;
  try {
    await requestApi('/api/auth/logout', { method: 'POST', body: {} });
    lista.replaceChildren();
    window.location.assign('login.html');
  } catch (erro) { tratarErro(erro); }
  finally { ocupado = false; sair.disabled = false; }
});

try {
  const sessao = await currentSession();
  if (!sessao.autenticado) {
    avisar('Entre na sua conta para acessar a agenda.');
    document.getElementById('acesso').hidden = false;
  } else if (!sessao.usuario?.gerente) {
    avisar('Acesso exclusivo para gerentes autorizados. Solicite a liberação ao responsável pelo sistema.', true);
    sair.hidden = false;
  } else {
    painel.hidden = false;
    sair.hidden = false;
    await carregar();
  }
} catch (erro) { tratarErro(erro); }

let paginaContatos = 1, carregandoContatos = false;
async function carregarContatos() {
  if (carregandoContatos) return;
  carregandoContatos = true;
  const status = document.getElementById('contatos-status');
  const listaContatos = document.getElementById('contatos-lista');
  const voltar = document.getElementById('contatos-anterior');
  const avancar = document.getElementById('contatos-proxima');
  voltar.disabled = avancar.disabled = true;
  listaContatos.replaceChildren(); status.textContent = 'Consultando mensagens…';
  try {
    const dados = await requestApi('/api/gerencia/contatos?pagina=' + paginaContatos);
    for (const contato of dados.contatos) {
      const item = elemento('li', undefined, 'agenda-card');
      item.append(elemento('h3', contato.assunto), elemento('p', `${contato.nome} — ${contato.email}`),
        elemento('p', contato.mensagem, 'agenda-mensagem'), elemento('p', 'Protocolo: ' + contato.protocolo));
      listaContatos.append(item);
    }
    status.textContent = dados.total ? `${dados.total} mensagem(ns) registrada(s).` : 'Nenhuma mensagem registrada.';
    document.getElementById('contatos-pagina').textContent = `Página ${paginaContatos}`;
    voltar.disabled = paginaContatos <= 1; avancar.disabled = paginaContatos * 25 >= dados.total;
  } catch (erro) { status.textContent = erro.message; tratarErro(erro); }
  finally { carregandoContatos = false; }
}
document.getElementById('contatos').addEventListener('toggle', evento => { if (evento.target.open) carregarContatos(); });
document.getElementById('contatos-anterior').addEventListener('click', () => { if (!carregandoContatos && paginaContatos > 1) { paginaContatos--; carregarContatos(); } });
document.getElementById('contatos-proxima').addEventListener('click', () => { if (!carregandoContatos) { paginaContatos++; carregarContatos(); } });

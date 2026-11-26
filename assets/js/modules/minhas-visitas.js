import { currentSession, requestApi } from './api.js';
import { acoesVisita } from './agenda-acoes.js';
const painel = document.getElementById('painel');
const feedback = document.getElementById('feedback');
const lista = document.getElementById('lista');
const atualizar = document.getElementById('atualizar');
let pagina = 1, ocupado = false, assinatura = '';

function erro(erro) {
  feedback.textContent = erro.message; feedback.classList.add('erro');
  if (erro.status === 401) {
    painel.hidden = true; lista.replaceChildren(); document.getElementById('acesso').hidden = false;
  }
}

async function carregar(mensagem = '', silencioso = false) {
  if (ocupado) return;
  ocupado = true; atualizar.disabled = true;
  try {
    let dados = await requestApi('/api/agendamentos?pagina=' + pagina);
    if (pagina > 1 && !dados.agendamentos.length) {
      pagina = Math.max(1, Math.ceil(dados.total / dados.por_pagina));
      dados = await requestApi('/api/agendamentos?pagina=' + pagina);
    }
    const novaAssinatura = JSON.stringify(dados.agendamentos);
    if (novaAssinatura !== assinatura || !silencioso) {
      const editando = lista.contains(document.activeElement) || lista.querySelector('details[open]');
      if (silencioso && editando) {
        feedback.textContent = 'Há atualizações nas visitas. Termine a edição e clique em Atualizar visitas.';
        return;
      }
      lista.replaceChildren(...dados.agendamentos.map(visita => {
        const item = document.createElement('li'); item.className = 'agenda-card';
        const titulo = document.createElement('h2'); titulo.textContent = `Visita #${visita.id} — ${visita.pet_nome || 'Visita ao abrigo'}`;
        const quando = document.createElement('p'); quando.textContent = visita.data_visita.split('-').reverse().join('/') + ' às ' + visita.horario;
        const estado = document.createElement('p'); estado.className = 'agenda-status';
        estado.textContent = ({ pendente: 'Pendente de confirmação', confirmado: 'Confirmada — sua visita foi aprovada', cancelado: 'Cancelada' })[visita.status] || visita.status;
        item.append(titulo, quando, estado, acoesVisita(visita, carregar, erro, () => !ocupado));
        if (visita.status === 'confirmado' && visita.pet_nome) {
          const confirmacao = document.createElement('p');
          confirmacao.className = 'agenda-aviso';
          confirmacao.textContent = `Sua visita para conhecer ${visita.pet_nome} está confirmada para ${visita.data_visita.split('-').reverse().join('/')} às ${visita.horario}.`;
          item.insertBefore(confirmacao, item.lastElementChild);
        }
        return item;
      }));
    }
    feedback.classList.remove('erro');
    feedback.textContent = mensagem || (!dados.total ? 'Você ainda não tem visitas registradas.' : assinatura && assinatura !== novaAssinatura ? 'Suas visitas foram atualizadas. Confira os novos status.' : 'Suas visitas estão atualizadas.');
    assinatura = novaAssinatura;
    document.getElementById('pagina').textContent = `Página ${pagina} de ${Math.max(1, Math.ceil(dados.total / 25))}`;
    document.getElementById('anterior').disabled = pagina <= 1;
    document.getElementById('proxima').disabled = pagina * 25 >= dados.total;
  } catch (falha) { erro(falha); }
  finally { ocupado = false; atualizar.disabled = false; }
}
atualizar.addEventListener('click', () => carregar());
for (const [id, passo] of [['anterior', -1], ['proxima', 1]]) {
  document.getElementById(id).addEventListener('click', () => { if (!ocupado) { pagina += passo; carregar(); } });
}
document.getElementById('sair').addEventListener('click', async () => {
  if (ocupado) return;
  ocupado = true;
  try { await requestApi('/api/auth/logout', { method: 'POST', body: {} }); window.location.assign('login.html'); }
  catch (falha) { erro(falha); } finally { ocupado = false; }
});
try {
  const sessao = await currentSession();
  if (!sessao.autenticado) { document.getElementById('acesso').hidden = false; feedback.textContent = 'Entre na sua conta para acompanhar suas visitas.'; }
  else { painel.hidden = false; document.getElementById('sair').hidden = false; await carregar(); }
} catch (falha) { erro(falha); }
window.setInterval(() => { if (!document.hidden && !painel.hidden) carregar('', true); }, 30000);

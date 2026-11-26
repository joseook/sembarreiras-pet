import { requestApi } from './api.js';
import { ocupado, ocupar } from './form-feedback.js';

function focarResumo(erro = false) {
  const resumo = !erro && document.getElementById('resumo');
  (resumo && !resumo.closest('[hidden]') ? resumo : document.getElementById('feedback'))?.focus();
}

export function acoesVisita(visita, aoAtualizar, aoErro, podeIniciar = () => true) {
  const grupo = document.createElement('div');
  grupo.className = 'agenda-acoes';
  if (!['pendente', 'confirmado'].includes(visita.status)) return grupo;
  const cancelar = document.createElement('button');
  cancelar.type = 'button'; cancelar.textContent = 'Cancelar visita';
  cancelar.addEventListener('click', async () => {
    if (ocupado(cancelar) || !podeIniciar() || !window.confirm(`Cancelar a visita #${visita.id}?`)) return;
    ocupar(cancelar, true);
    try {
      const resultado = await requestApi(`/api/agendamentos/${visita.id}/cancelar`, { method: 'POST', body: {} });
      await aoAtualizar(resultado.mensagem);
      focarResumo();
    } catch (erro) { aoErro(erro); focarResumo(true); }
    finally { ocupar(cancelar, false); }
  });
  const detalhes = document.createElement('details');
  const resumo = document.createElement('summary'); resumo.textContent = 'Remarcar visita';
  const form = document.createElement('form'); form.className = 'agenda-filtros';
  const data = document.createElement('input'); data.type = 'date'; data.required = true;
  data.min = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
  const horario = document.createElement('select');
  for (const hora of ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00']) {
    const option = document.createElement('option'); option.value = option.textContent = hora; horario.append(option);
  }
  data.id = `remarcar-data-${visita.id}`; horario.id = `remarcar-hora-${visita.id}`;
  for (const [texto, campo] of [['Nova data', data], ['Novo horário (Brasília)', horario]]) {
    const div = document.createElement('div');
    const label = document.createElement('label'); label.htmlFor = campo.id; label.textContent = texto;
    div.append(label, campo); form.append(div);
  }
  const nota = document.createElement('p'); nota.textContent = 'De terça a sábado. A remarcação precisa de nova confirmação.';
  const salvar = document.createElement('button'); salvar.type = 'submit'; salvar.textContent = 'Solicitar novo horário';
  form.append(salvar);
  form.addEventListener('submit', async evento => {
    evento.preventDefault();
    if (!podeIniciar() || ocupado(salvar)) return;
    ocupar(salvar, true);
    try {
      const resultado = await requestApi(`/api/agendamentos/${visita.id}/remarcar`, {
        method: 'POST', body: { data: data.value, horario: horario.value },
      });
      await aoAtualizar(resultado.mensagem);
      focarResumo();
    } catch (erro) { aoErro(erro); focarResumo(true); }
    finally { ocupar(salvar, false); }
  });
  detalhes.append(resumo, nota, form); grupo.append(cancelar, detalhes);
  return grupo;
}

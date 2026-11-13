import { requestApi } from './api.js';

const LIMITE_MENSAGEM = 1000;

function hojeLocalISO() {
  const agora = new Date();
  const local = new Date(agora.getTime() - 3 * 60 * 60000);
  return local.toISOString().slice(0, 10);
}

/** Todas as visitas usam o horário de Brasília, independentemente do navegador. */
function montarDataHora(data, horario) {
  const iso = `${data}T${horario}:00-03:00`;
  return { momento: new Date(iso), iso };
}

function formatarDataHora(iso) {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return iso;
  return data.toLocaleString('pt-BR', {
    dateStyle: 'full', timeStyle: 'short', timeZone: 'America/Sao_Paulo',
  }) + ' (horário de Brasília)';
}

export function initSchedulingForm(form) {
  const campos = {
    data: form.elements.namedItem('data'),
    horario: form.elements.namedItem('horario'),
    mensagem: form.elements.namedItem('mensagem'),
  };
  const status = form.querySelector('[data-form-status]');

  form.noValidate = true;
  campos.data.min = hojeLocalISO();

  function definirErro(nome, mensagem) {
    const campo = campos[nome];
    const erro = form.querySelector(`[data-erro-de="${nome}"]`);
    if (!campo || !erro) return;
    if (mensagem) {
      campo.setAttribute('aria-invalid', 'true');
      erro.textContent = mensagem;
      erro.hidden = false;
    } else {
      campo.removeAttribute('aria-invalid');
      erro.textContent = '';
      erro.hidden = true;
    }
  }

  function limparErros() {
    Object.keys(campos).forEach((nome) => definirErro(nome, ''));
  }

  function mostrarStatus(tipo, paragrafos) {
    status.dataset.tipo = tipo;
    status.replaceChildren(
      ...paragrafos.map((texto) => {
        const p = document.createElement('p');
        p.textContent = texto;
        return p;
      }),
    );
  }

  function validar() {
    const erros = {};
    const data = campos.data.value;
    const horario = campos.horario.value;

    if (!data) erros.data = 'Escolha a data da visita.';
    else if (data < hojeLocalISO()) erros.data = 'Escolha uma data a partir de hoje.';

    if (!horario) erros.horario = 'Escolha um horário para a visita.';

    if (data && horario && !erros.data) {
      const { momento } = montarDataHora(data, horario);
      if (momento.getTime() <= Date.now()) erros.horario = 'Esse horário já passou. Escolha outro.';
    }

    if (campos.mensagem.value.length > LIMITE_MENSAGEM) {
      erros.mensagem = `A mensagem pode ter no máximo ${LIMITE_MENSAGEM} caracteres.`;
    }
    return erros;
  }

  function aplicarErros(erros) {
    const nomes = Object.keys(erros);
    nomes.forEach((nome) => definirErro(nome, erros[nome]));
    const primeiro = nomes.map((nome) => campos[nome]).find(Boolean);
    if (primeiro) primeiro.focus();
    return nomes.length;
  }

  // Remove a marcação de erro assim que a pessoa corrige o campo
  Object.entries(campos).forEach(([nome, campo]) => {
    campo.addEventListener('change', () => {
      if (campo.getAttribute('aria-invalid') === 'true') definirErro(nome, '');
    });
  });

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    if (form.querySelector('button[type="submit"]').disabled) return;
    limparErros();

    const erros = validar();
    const totalErros = aplicarErros(erros);
    if (totalErros > 0) {
      mostrarStatus('erro', [
        totalErros === 1
          ? 'Há 1 campo para corrigir. A mensagem aparece logo abaixo dele.'
          : `Há ${totalErros} campos para corrigir. As mensagens aparecem abaixo de cada um.`,
      ]);
      return;
    }

    const { iso } = montarDataHora(campos.data.value, campos.horario.value);
    const botao = form.querySelector('button[type="submit"]');
    const textoOriginalBotao = botao ? botao.textContent : '';

    try {
      if (botao) {
        botao.disabled = true;
        botao.textContent = 'Enviando ao abrigo...';
      }

      const resultado = await requestApi('/api/agendamentos', {
        method: 'POST',
        body: {
          data: campos.data.value,
          horario: campos.horario.value,
          mensagem: campos.mensagem.value.trim() || null,
          pet_id: new URLSearchParams(window.location.search).get('pet_id') || null,
        },
      });
      if (!resultado.agendamento) throw new Error('Não foi possível confirmar o registro da visita.');
      mostrarStatus('sucesso', [
        'Solicitação registrada para ' + formatarDataHora(iso) + '.',
        'Aguarde a confirmação antes de ir ao abrigo.',
      ]);
      form.reset();
    } catch (erro) {
      mostrarStatus('erro', [erro.message]);
    } finally {
      if (botao) {
        botao.disabled = false;
        botao.textContent = textoOriginalBotao;
      }
    }
  });
}

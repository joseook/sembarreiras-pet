/**
 * Formulário "Solicitar visita" — Sem Barreiras Pet
 * Integração com API REST e Fallback gracioso.
 *
 * Se a API estiver ativa, registra o agendamento no banco de dados.
 * Se estiver no Vercel (modo estático), exibe a confirmação amigável de prévia.
 */

const LIMITE_MENSAGEM = 1000;

function hojeLocalISO() {
  const agora = new Date();
  const local = new Date(agora.getTime() - agora.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

/** Monta "AAAA-MM-DDTHH:MM:00-03:00" com o fuso do navegador. */
function montarDataHora(data, horario) {
  const momento = new Date(`${data}T${horario}:00`);
  const offsetMin = -momento.getTimezoneOffset();
  const sinal = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return { momento, iso: `${data}T${horario}:00${sinal}${hh}:${mm}` };
}

function formatarDataHora(iso) {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return iso;
  return data.toLocaleString('pt-BR', { dateStyle: 'full', timeStyle: 'short' });
}

async function carregarApiBaseUrl() {
  try {
    const modulo = await import(new URL('../../../config.js', import.meta.url).href);
    return (modulo.default && modulo.default.apiBaseUrl) ? modulo.default.apiBaseUrl.replace(/\/+$/, '') : '';
  } catch {
    return '';
  }
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

      const apiBase = await carregarApiBaseUrl();
      const resposta = await fetch(`${apiBase}/api/agendamentos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          data: campos.data.value,
          horario: campos.horario.value,
          mensagem: campos.mensagem.value.trim() || null,
        }),
      });

      const resultado = await resposta.json().catch(() => null);

      if (resposta.ok && resultado) {
        mostrarStatus('sucesso', [
          `Solicitação gravada com sucesso no banco de dados para ${formatarDataHora(iso)}!`,
          'O abrigo parceiro já tem acesso ao seu agendamento para análise e confirmação.',
        ]);
        form.reset();
        return;
      }

      if (resultado && resultado.erro) {
        mostrarStatus('erro', [resultado.erro]);
        return;
      }

      throw new Error('API_INDISPONIVEL');
    } catch (err) {
      console.info('API de agendamentos indisponível no ambiente atual, usando modo prévia:', err.message);
      mostrarStatus('info', [
        `Tudo certo com o preenchimento: visita em ${formatarDataHora(iso)}.`,
        'Como esta é uma prévia do protótipo, a solicitação não foi enviada ao abrigo.',
      ]);
    } finally {
      if (botao) {
        botao.disabled = false;
        botao.textContent = textoOriginalBotao;
      }
    }
  });
}

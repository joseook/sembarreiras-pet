/**
 * Formulário "Solicitar visita" — envia para POST /api/visits.
 *
 * Modos (decididos pela configuração, ver frontend/config.example.js):
 * - "previa"       (padrão): valida os campos, mas NÃO envia nada. Usado
 *                   quando não há API configurada ou usuário de demonstração.
 * - "demonstracao" (somente desenvolvimento): envia para a API em nome do
 *                   usuário de demonstração criado pelo seed. Existe apenas
 *                   enquanto a autenticação não é implementada.
 *
 * Mensagens vão para a região [data-form-status] (role="status", aria-live)
 * e os erros de campo ficam ligados aos inputs por aria-describedby.
 */

import { ApiError, NetworkError, requestJson } from './api.js';

const LIMITE_MENSAGEM = 1000;

/** Campos da API -> nome do campo no formulário. */
const CAMPOS_API = {
  scheduled_at: 'data',
  adopter_notes: 'mensagem',
};

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

export function initSchedulingForm(form, config) {
  const campos = {
    data: form.elements.namedItem('data'),
    horario: form.elements.namedItem('horario'),
    mensagem: form.elements.namedItem('mensagem'),
  };
  const botao = form.querySelector('[data-submit]');
  const status = form.querySelector('[data-form-status]');
  const avisoModo = form.querySelector('[data-form-mode]');
  const textoBotao = botao.textContent;

  const modoDemonstracao = Boolean(config.apiBaseUrl && config.demoUserId);
  const shelterId = Number.parseInt(form.dataset.shelterId, 10);

  // Com JavaScript ativo, a validação passa a ser feita aqui (mensagens em português e acessíveis).
  form.noValidate = true;
  campos.data.min = hojeLocalISO();

  if (modoDemonstracao && avisoModo) {
    avisoModo.innerHTML =
      '<strong>Modo demonstração (desenvolvimento):</strong> a solicitação será registrada ' +
      'na API local em nome de um usuário fictício, porque o login ainda não existe.';
  }

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

  function definirCarregando(carregando) {
    botao.disabled = carregando;
    botao.setAttribute('aria-busy', String(carregando));
    botao.textContent = carregando ? 'Enviando solicitação…' : textoBotao;
  }

  /** Validação no navegador. A API valida de novo (fonte da verdade). */
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

    if (!modoDemonstracao) {
      mostrarStatus('info', [
        `Tudo certo com o preenchimento: visita em ${formatarDataHora(iso)}.`,
        'Como esta é uma prévia, a solicitação não foi enviada ao abrigo. ' +
          'Quando o login estiver disponível, ela seguirá para a ONG confirmar.',
      ]);
      return;
    }

    definirCarregando(true);
    mostrarStatus('info', ['Enviando sua solicitação…']);

    try {
      const { data: visita } = await requestJson(config.apiBaseUrl, '/visits', {
        method: 'POST',
        json: {
          user_id: Number(config.demoUserId),
          shelter_id: shelterId,
          scheduled_at: iso,
          adopter_notes: campos.mensagem.value.trim() || null,
        },
      });
      form.reset();
      mostrarStatus('sucesso', [
        `Solicitação enviada! Protocolo nº ${visita.id}, para ${formatarDataHora(visita.scheduled_at)}.`,
        'Agora é com a ONG: a visita só fica confirmada depois da resposta do abrigo.',
      ]);
    } catch (erro) {
      if (erro instanceof ApiError && (erro.status === 400 || erro.status === 422)) {
        const errosCampo = {};
        const gerais = [];
        Object.entries(erro.details).forEach(([campoApi, mensagem]) => {
          const nome = CAMPOS_API[campoApi];
          if (nome) errosCampo[nome] = mensagem;
          else gerais.push(mensagem);
        });
        aplicarErros(errosCampo);
        mostrarStatus('erro', [erro.message, ...gerais]);
      } else if (erro instanceof ApiError) {
        mostrarStatus('erro', [
          erro.message || 'O servidor não conseguiu registrar a solicitação.',
          'Tente novamente em alguns minutos.',
        ]);
      } else if (erro instanceof NetworkError) {
        mostrarStatus('erro', [
          'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.',
          'Seus dados continuam preenchidos no formulário.',
        ]);
      } else {
        mostrarStatus('erro', ['Algo inesperado aconteceu. Tente novamente.']);
      }
    } finally {
      definirCarregando(false);
    }
  });
}

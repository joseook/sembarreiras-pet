/**
 * Sem Barreiras Pet — auth-demo.js
 * Formulários de login e cadastro em modo DEMONSTRAÇÃO.
 *
 * Ainda não existe autenticação nem API: nada é enviado ou salvo.
 * Este módulo:
 * - assume a validação (novalidate) para mostrar erros em português,
 *   ligados a cada campo por aria-describedby e marcados com aria-invalid;
 * - leva o foco ao primeiro campo com erro;
 * - só depois de todos os campos válidos mostra, na região
 *   [data-form-status] (role="status", aria-live="polite"), a mensagem
 *   honesta definida em data-demo-mensagem no <form>.
 *
 * Sem JavaScript, o navegador faz a validação nativa e o form usa
 * method="dialog", que não envia nada nem recarrega a página.
 */

const MENSAGENS = {
  obrigatorio: 'Preencha este campo.',
  checkbox: 'Marque esta opção para continuar.',
  radio: 'Escolha uma das opções.',
  email: 'Informe um e-mail válido, por exemplo nome@exemplo.com.',
  formato: 'Confira o formato deste campo.',
};

function mensagemDeErro(campo) {
  const { validity } = campo;
  if (validity.valueMissing) {
    if (campo.type === 'checkbox') return MENSAGENS.checkbox;
    if (campo.type === 'radio') return MENSAGENS.radio;
    return MENSAGENS.obrigatorio;
  }
  if (validity.typeMismatch && campo.type === 'email') return MENSAGENS.email;
  if (validity.tooShort) {
    return `Use pelo menos ${campo.minLength} caracteres (agora são ${campo.value.length}).`;
  }
  if (validity.patternMismatch) return campo.dataset.erroFormato || MENSAGENS.formato;
  return campo.validationMessage;
}

/** Rádios do mesmo grupo compartilham um único erro, ligado ao fieldset. */
function idDoErro(campo) {
  return `${campo.type === 'radio' ? campo.name : campo.id}-erro`;
}

function camposDoGrupo(form, campo) {
  return campo.type === 'radio' ? Array.from(form.elements[campo.name]) : [campo];
}

function adicionarDescricao(campo, id) {
  const ids = (campo.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
  if (!ids.includes(id)) campo.setAttribute('aria-describedby', [id, ...ids].join(' '));
}

function removerDescricao(campo, id) {
  const ids = (campo.getAttribute('aria-describedby') || '').split(/\s+/).filter((item) => item && item !== id);
  if (ids.length) campo.setAttribute('aria-describedby', ids.join(' '));
  else campo.removeAttribute('aria-describedby');
}

function mostrarErro(form, campo) {
  const id = idDoErro(campo);
  let erro = document.getElementById(id);
  if (!erro) {
    erro = document.createElement('p');
    erro.id = id;
    erro.className = 'field__erro';
    campo.closest('.field, .field-check, fieldset').append(erro);
  }
  erro.textContent = `Erro: ${mensagemDeErro(campo)}`;
  camposDoGrupo(form, campo).forEach((item) => {
    item.setAttribute('aria-invalid', 'true');
    adicionarDescricao(item, id);
  });
}

function limparErro(form, campo) {
  const id = idDoErro(campo);
  document.getElementById(id)?.remove();
  camposDoGrupo(form, campo).forEach((item) => {
    item.removeAttribute('aria-invalid');
    removerDescricao(item, id);
  });
}

/** Troca o texto da região viva; limpar antes garante novo anúncio. */
function anunciar(status, conteudo, tipo) {
  status.classList.toggle('auth-status--erro', tipo === 'erro');
  status.replaceChildren();
  window.setTimeout(() => status.append(...conteudo), 50);
}

function iniciarFormulario(form) {
  const status = form.querySelector('[data-form-status]');
  form.noValidate = true;

  form.addEventListener('submit', (evento) => {
    evento.preventDefault();

    const invalidos = [];
    const gruposVistos = new Set();
    Array.from(form.elements).forEach((campo) => {
      if (!campo.willValidate) return;
      if (campo.type === 'radio') {
        if (gruposVistos.has(campo.name)) return;
        gruposVistos.add(campo.name);
      }
      if (campo.checkValidity()) {
        limparErro(form, campo);
      } else {
        mostrarErro(form, campo);
        invalidos.push(campo);
      }
    });

    if (invalidos.length) {
      const total = invalidos.length;
      anunciar(status, [`${total} ${total === 1 ? 'campo precisa' : 'campos precisam'} de revisão. O foco foi levado ao primeiro.`], 'erro');
      invalidos[0].focus();
      return;
    }

    const destaque = document.createElement('strong');
    destaque.textContent = 'Demonstração: ';
    anunciar(status, [destaque, `${form.dataset.demoMensagem} Nenhum dado foi enviado ou salvo.`]);
  });

  // Ao corrigir um campo que estava com erro, o aviso some sem esperar novo envio
  const revalidar = (evento) => {
    const campo = evento.target;
    if (campo.getAttribute('aria-invalid') === 'true' && campo.checkValidity()) limparErro(form, campo);
  };
  form.addEventListener('input', revalidar);
  form.addEventListener('change', revalidar);
}

document.querySelectorAll('form[data-auth-demo]').forEach(iniciarFormulario);

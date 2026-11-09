import { api, sessaoAtual, destinoRetorno } from './api.js';

const ROTAS = {
  login: '/api/auth/login',
  cadastro: '/api/auth/cadastro',
  contato: '/api/contato',
};

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

/** Troca o texto da região viva; limpar antes garante novo anúncio por leitores de tela. */
function anunciar(status, conteudo, tipo) {
  status.classList.toggle('auth-status--erro', tipo === 'erro');
  status.replaceChildren();
  window.setTimeout(() => status.append(...conteudo), 50);
}

function iniciarFormulario(form) {
  const status = form.querySelector('[data-form-status]');
  form.noValidate = true;

  form.addEventListener('submit', async (evento) => {
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

    const botao = form.querySelector('button[type="submit"]');
    if (botao.disabled) return;
    const original = botao.textContent;
    const tipo = form.dataset.formulario;
    const dados = Object.fromEntries(new FormData(form));
    if (tipo === 'cadastro') dados.consentimento = form.elements.consentimento.checked;
    botao.disabled = true;
    botao.textContent = 'Enviando...';
    let sucesso = false;
    try {
      const resultado = await api(ROTAS[tipo], { method: 'POST', body: dados });
      if (tipo === 'contato') {
        anunciar(status, [resultado.mensagem + ' Protocolo: ' + resultado.protocolo + '.']);
        form.reset();
      } else {
        if (!resultado.usuario) throw new Error('Resposta de acesso inválida. Tente novamente.');
        sucesso = true;
        form.reset();
        anunciar(status, [resultado.mensagem + ' Redirecionando...']);
        location.assign(destinoRetorno());
      }
    } catch (erro) {
      anunciar(status, [erro.message], 'erro');
    } finally {
      if (!sucesso) {
        botao.disabled = false;
        botao.textContent = original;
      }
    }
  });

  const revalidar = (evento) => {
    const campo = evento.target;
    if (campo.getAttribute('aria-invalid') === 'true' && campo.checkValidity()) limparErro(form, campo);
  };
  form.addEventListener('input', revalidar);
  form.addEventListener('change', revalidar);
}

document.querySelectorAll('form[data-formulario]').forEach(iniciarFormulario);
const retorno = new URLSearchParams(location.search).get('retorno');
if (retorno) {
  document.querySelectorAll('.auth-alternativa a[href="login.html"],.auth-alternativa a[href="cadastro.html"]').forEach(link => {
    const url = new URL(link.href);
    url.searchParams.set('retorno', retorno);
    link.href = url.href;
  });
}
if (document.querySelector('form[data-formulario="login"],form[data-formulario="cadastro"]')) {
  sessaoAtual().then(sessao => {
    if (sessao.autenticado) location.replace(destinoRetorno());
  }).catch(() => { /* Formulário permanece disponível para nova tentativa. */ });
}

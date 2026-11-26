import { requestApi } from './api.js';
import { destinoSeguro } from './destino.js';
import { iniciarMostrarSenha, ocupado, ocupar } from './form-feedback.js';

const destino = destinoSeguro(new URLSearchParams(window.location.search).get('next'));
if (destino) {
  document.querySelectorAll('a[href="login.html"], a[href="cadastro.html"]').forEach(link => {
    link.href += '?next=' + encodeURIComponent(destino);
  });
}

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

function validarDigitos(campo) {
  if (!campo.dataset.digitos) return;
  const [minimo, maximo] = campo.dataset.digitos.split('-').map(Number);
  const total = campo.value.replace(/\D/g, '').length;
  const fora = campo.value && !campo.validity.patternMismatch && (total < minimo || total > maximo);
  campo.setCustomValidity(fora ? `Use de ${minimo} a ${maximo} dígitos, com DDD (agora são ${total}).` : '');
}

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

function mostrarErro(form, campo, texto) {
  const id = idDoErro(campo);
  let erro = document.getElementById(id);
  if (!erro) {
    erro = document.createElement('p');
    erro.id = id;
    erro.className = 'field__erro';
    campo.closest('.field, .field-check, fieldset').append(erro);
  }
  erro.textContent = `Erro: ${texto || mensagemDeErro(campo)}`;
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

function anunciar(status, conteudo, tipo, focar = false) {
  status.classList.toggle('auth-status--erro', tipo === 'erro');
  status.setAttribute('role', tipo === 'erro' ? 'alert' : 'status');
  status.tabIndex = -1;
  status.replaceChildren();
  window.setTimeout(() => {
    status.append(...conteudo);
    if (focar) status.focus();
  }, 50);
}

function errosDoServidor(form, tipo, erro) {
  const campos = { ...(erro.campos || {}) };
  if (tipo === 'cadastro' && erro.status === 409 && !campos.email) campos.email = erro.message;
  return Object.entries(campos)
    .map(([nome, texto]) => [form.elements.namedItem(nome), texto])
    .filter(([campo]) => campo instanceof HTMLElement && campo.willValidate)
    .map(([campo, texto]) => { mostrarErro(form, campo, String(texto)); return campo; });
}

function iniciarFormulario(form) {
  const status = form.querySelector('[data-form-status]');
  form.noValidate = true;
  iniciarMostrarSenha(form);

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
      validarDigitos(campo);
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
    if (ocupado(botao)) return;
    const tipo = form.dataset.authForm;
    const dados = Object.fromEntries(new FormData(form));
    if (tipo === 'cadastro') dados.consentimento = form.elements.consentimento.checked;

    ocupar(botao, true, tipo === 'contato' ? 'Enviando...' : tipo === 'cadastro' ? 'Cadastrando...' : 'Entrando...');
    let concluido = false;
    try {
      const resultado = await requestApi(tipo === 'contato' ? '/api/contato' : '/api/auth/' + tipo, { method: 'POST', body: dados });
      if (tipo === 'contato') {
        anunciar(status, [`${resultado.mensagem} Protocolo: ${resultado.protocolo}. A equipe consultará a mensagem no sistema; não há envio automático de e-mail.`]);
        form.reset();
        return;
      }
      if (!resultado.usuario) throw new Error('Não foi possível confirmar o acesso. Tente novamente.');
      concluido = true;
      anunciar(status, [resultado.mensagem + ' Redirecionando...']);
      form.reset();
      window.location.assign(resultado.usuario.trocar_senha ? 'alterar-senha.html' : destino || (resultado.usuario.gerente ? 'gerencia.html' : '../index.html'));
    } catch (erro) {
      const comErro = errosDoServidor(form, tipo, erro);
      anunciar(status, [erro.message], 'erro', !comErro.length);
      comErro[0]?.focus();
    } finally {
      if (!concluido) ocupar(botao, false);
    }
  });

  const revalidar = (evento) => {
    const campo = evento.target;
    if (campo.getAttribute('aria-invalid') !== 'true') return;
    validarDigitos(campo);
    if (campo.checkValidity()) limparErro(form, campo);
  };
  form.addEventListener('input', revalidar);
  form.addEventListener('change', revalidar);
}

document.querySelectorAll('form[data-auth-form]').forEach(iniciarFormulario);

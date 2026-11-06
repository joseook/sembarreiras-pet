/**
 * Sem Barreiras Pet — auth-demo.js
 * Formulários de login e cadastro com suporte à API Flask e Fallback Suave.
 *
 * Funcionamento inteligente:
 * 1. Valida todos os campos com foco na acessibilidade (WCAG 2.2 AA).
 * 2. Tenta enviar os dados para a API REST (/api/auth/cadastro ou /api/auth/login).
 * 3. Se a API estiver ativa (Flask + PostgreSQL/SQLite), salva os dados de verdade no banco.
 * 4. Se a API estiver offline (ex: site estático no Vercel ou GitHub Pages),
 *    ativa graciosamente o modo de demonstração sem quebrar a interface.
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
    const textoOriginalBotao = botao ? botao.textContent : '';

    // Identifica se é formulário de cadastro ou login
    const isCadastro = Boolean(form.elements.nome);
    const endpoint = isCadastro ? '/api/auth/cadastro' : '/api/auth/login';

    try {
      if (botao) {
        botao.disabled = true;
        botao.textContent = isCadastro ? 'Cadastrando no banco...' : 'Entrando...';
      }

      // Prepara os dados
      const formData = new FormData(form);
      const dados = Object.fromEntries(formData.entries());
      if (isCadastro) {
        dados.consentimento = form.elements.consentimento ? form.elements.consentimento.checked : true;
      }

      // Tenta enviar para a API REST
      const resposta = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(dados)
      });

      const resultado = await resposta.json().catch(() => null);

      if (resposta.ok && resultado) {
        const destaque = document.createElement('strong');
        destaque.textContent = 'Sucesso! ';

        if (isCadastro) {
          anunciar(status, [
            destaque,
            `${resultado.mensagem || 'Usuário cadastrado com sucesso!'} Bem-vindo(a), ${resultado.usuario?.nome || ''}. Redirecionando para o login...`
          ]);
          form.reset();
          setTimeout(() => {
            window.location.href = 'login.html';
          }, 1800);
        } else {
          anunciar(status, [
            destaque,
            `${resultado.mensagem || 'Login realizado com sucesso!'} Redirecionando para o início...`
          ]);
          setTimeout(() => {
            window.location.href = '../index.html';
          }, 1200);
        }
        return;
      }

      // Se a API retornou erro de negócio (ex: e-mail já existe ou senha inválida)
      if (resultado && resultado.erro) {
        anunciar(status, [resultado.erro], 'erro');
        return;
      }

      // Se a rota não respondeu (ex: 404 no Vercel estático)
      throw new Error('API_INDISPONIVEL');

    } catch (err) {
      // Fallback gracioso: mantém funcionamento do protótipo estático sem tela quebrada
      console.info('API indisponível no ambiente atual, usando modo demonstrativo:', err.message);
      const destaque = document.createElement('strong');
      destaque.textContent = 'Demonstração: ';
      anunciar(status, [destaque, `${form.dataset.demoMensagem} Nenhum dado foi enviado ou salvo.`]);
    } finally {
      if (botao) {
        botao.disabled = false;
        botao.textContent = textoOriginalBotao;
      }
    }
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

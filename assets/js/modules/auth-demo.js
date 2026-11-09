/**
 * Sem Barreiras Pet — auth-demo.js
 * Formulários de login e cadastro com suporte à API Flask e Fallback Local Inteligente.
 *
 * Funcionamento:
 * 1. Valida todos os campos com foco na acessibilidade (WCAG 2.2 AA).
 * 2. Tenta enviar os dados para a API REST (/api/auth/cadastro ou /api/auth/login).
 * 3. Se a API estiver ativa (Flask + PostgreSQL/Supabase), salva os dados no banco.
 * 4. Se a API estiver offline (ex: site estático no GitHub Pages ou Vercel),
 *    ativa o armazenamento local via localStorage para que o cadastro e o login
 *    funcionem perfeitamente para qualquer visitante.
 */

const MENSAGENS = {
  obrigatorio: 'Preencha este campo.',
  checkbox: 'Marque esta opção para continuar.',
  radio: 'Escolha uma das opções.',
  email: 'Informe um e-mail válido, por exemplo nome@exemplo.com.',
  formato: 'Confira o formato deste campo.',
};

async function carregarApiBaseUrl() {
  try {
    const modulo = await import(new URL('../../../config.js', import.meta.url).href);
    return (modulo.default && modulo.default.apiBaseUrl) ? modulo.default.apiBaseUrl.replace(/\/+$/, '') : '';
  } catch {
    return '';
  }
}

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
    const apiBase = await carregarApiBaseUrl();
    const endpoint = `${apiBase}${isCadastro ? '/api/auth/cadastro' : '/api/auth/login'}`;

    // Prepara os dados
    const formData = new FormData(form);
    const dados = Object.fromEntries(formData.entries());
    if (isCadastro) {
      dados.consentimento = form.elements.consentimento ? form.elements.consentimento.checked : true;
    }

    try {
      if (botao) {
        botao.disabled = true;
        botao.textContent = isCadastro ? 'Cadastrando...' : 'Entrando...';
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
          if (resultado.usuario) {
            localStorage.setItem('sb_usuario_atual', JSON.stringify(resultado.usuario));
          }
          anunciar(status, [
            destaque,
            `${resultado.mensagem || 'Usuário cadastrado com sucesso!'} Bem-vindo(a), ${resultado.usuario?.nome || ''}. Redirecionando para o login...`
          ]);
          form.reset();
          setTimeout(() => {
            window.location.href = 'login.html';
          }, 1800);
        } else {
          if (resultado.usuario) {
            localStorage.setItem('sb_usuario_atual', JSON.stringify(resultado.usuario));
          }
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

      // Se a rota não respondeu (ex: 404 no GitHub Pages)
      throw new Error('API_INDISPONIVEL');

    } catch (err) {
      // Fallback inteligente com LocalStorage para ambientes estáticos (ex: GitHub Pages)
      console.info('API remota não disponível, operando em modo local:', err.message);

      if (isCadastro) {
        const usuariosLocais = JSON.parse(localStorage.getItem('sb_usuarios_locais') || '[]');
        const jaExiste = usuariosLocais.some((u) => u.email === dados.email);

        if (jaExiste) {
          anunciar(status, ['Este e-mail já está cadastrado no sistema.'], 'erro');
          return;
        }

        const novoUsuario = {
          id: Date.now(),
          nome: dados.nome,
          email: dados.email,
          telefone: dados.telefone,
          tipo_moradia: dados.tipo_moradia || 'casa',
          consentimento: dados.consentimento,
          senha: dados.senha,
          criado_em: new Date().toISOString()
        };

        usuariosLocais.push(novoUsuario);
        localStorage.setItem('sb_usuarios_locais', JSON.stringify(usuariosLocais));
        localStorage.setItem('sb_usuario_atual', JSON.stringify({
          id: novoUsuario.id,
          nome: novoUsuario.nome,
          email: novoUsuario.email,
          tipo_moradia: novoUsuario.tipo_moradia
        }));

        const destaque = document.createElement('strong');
        destaque.textContent = 'Sucesso! ';
        anunciar(status, [
          destaque,
          `Usuário cadastrado com sucesso! Bem-vindo(a), ${novoUsuario.nome}. Redirecionando para o login...`
        ]);
        form.reset();
        setTimeout(() => {
          window.location.href = 'login.html';
        }, 1800);
        return;
      } else {
        const usuariosLocais = JSON.parse(localStorage.getItem('sb_usuarios_locais') || '[]');
        const ehAdminDemo = (dados.email === 'admin@sembarreiras.pet' && dados.senha === 'senha1234');
        const usuarioEncontrado = usuariosLocais.find((u) => u.email === dados.email && u.senha === dados.senha);

        if (ehAdminDemo || usuarioEncontrado) {
          const usuarioSessao = usuarioEncontrado
            ? { id: usuarioEncontrado.id, nome: usuarioEncontrado.nome, email: usuarioEncontrado.email, tipo_moradia: usuarioEncontrado.tipo_moradia }
            : { id: 1, nome: 'Adotante Teste', email: 'admin@sembarreiras.pet', tipo_moradia: 'casa' };

          localStorage.setItem('sb_usuario_atual', JSON.stringify(usuarioSessao));

          const destaque = document.createElement('strong');
          destaque.textContent = 'Sucesso! ';
          anunciar(status, [
            destaque,
            `Login realizado com sucesso! Bem-vindo(a), ${usuarioSessao.nome}. Redirecionando para o início...`
          ]);
          setTimeout(() => {
            window.location.href = '../index.html';
          }, 1200);
          return;
        } else {
          anunciar(status, ['Credenciais inválidas. Verifique seu e-mail e senha.'], 'erro');
          return;
        }
      }
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

/**
 * Apoio de acessibilidade compartilhado pelos formulários.
 * - ocupar(): bloqueia o botão durante o envio sem `disabled`, para o foco não cair no <body>.
 * - mensagem(): erros viram role="alert" e recebem o foco; sucesso usa role="status".
 * - iniciarMostrarSenha(): botão "Mostrar senha" (aria-pressed) em cada campo de senha.
 */

export function ocupado(botao) {
  return botao?.getAttribute('aria-disabled') === 'true';
}

export function ocupar(botao, ativo, texto) {
  if (!botao) return;
  if (ativo) {
    botao._conteudoOriginal = Array.from(botao.childNodes, (no) => no.cloneNode(true));
    botao.setAttribute('aria-disabled', 'true');
    if (texto) botao.textContent = texto;
  } else {
    botao.removeAttribute('aria-disabled');
    if (botao._conteudoOriginal) botao.replaceChildren(...botao._conteudoOriginal);
    delete botao._conteudoOriginal;
  }
}

/** Escreve a mensagem; em erro, usa role="alert" e leva o foco até ela. */
export function mensagem(elemento, texto, { erro = false, focar = erro } = {}) {
  if (!elemento) return;
  elemento.setAttribute('role', erro ? 'alert' : 'status');
  elemento.classList.toggle('auth-status--erro', erro);
  if (!elemento.hasAttribute('tabindex')) elemento.tabIndex = -1;
  elemento.textContent = texto;
  if (focar) elemento.focus();
}

export function iniciarMostrarSenha(raiz = document) {
  raiz.querySelectorAll('input[type="password"]').forEach((campo) => {
    if (!campo.id || campo.dataset.mostrarSenha) return;
    campo.dataset.mostrarSenha = 'true';
    const rotulo = document.querySelector(`label[for="${campo.id}"]`);
    const nome = (rotulo?.firstChild?.textContent || rotulo?.textContent || 'senha').trim();
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'campo-senha__mostrar';
    botao.setAttribute('aria-pressed', 'false');
    botao.setAttribute('aria-controls', campo.id);
    const extra = document.createElement('span');
    extra.className = 'sr-only';
    extra.textContent = `: ${nome}`;
    botao.append('Mostrar senha', extra);
    botao.addEventListener('click', () => {
      const visivel = campo.type === 'password';
      campo.type = visivel ? 'text' : 'password';
      botao.setAttribute('aria-pressed', String(visivel));
    });
    const grupoCampo = campo.closest('.field');
    if (grupoCampo) grupoCampo.append(botao); else campo.after(botao);
    campo.form?.addEventListener('reset', () => {
      campo.type = 'password';
      botao.setAttribute('aria-pressed', 'false');
    });
  });
}

import { requestApi } from './api.js';
import { iniciarMostrarSenha, mensagem, ocupado, ocupar } from './form-feedback.js';

window.addEventListener('hashchange', () => {
  if (window.location.hash) window.location.reload();
});

const token = window.location.hash.slice(1);
const form = document.getElementById(token ? 'redefinir' : 'solicitar');
const status = document.getElementById('status');
const botao = form.querySelector('button[type="submit"]');

if (token) {
  window.history.replaceState(null, '', window.location.pathname);
  document.title = 'Redefinir senha | Sem Barreiras Pet';
  document.getElementById('titulo').textContent = 'Redefinir senha';
  document.getElementById('orientacao').textContent = 'Escolha uma senha de 8 a 128 caracteres.';
  document.getElementById('novo-link').hidden = false;
}

form.addEventListener('submit', async evento => {
  evento.preventDefault();
  if (ocupado(botao)) return;
  const dados = Object.fromEntries(new FormData(form));
  if (token && dados.nova_senha !== dados.confirmacao) {
    mensagem(status, 'A nova senha e a confirmação precisam ser iguais.', { erro: true });
    return;
  }
  if (token) dados.token = token;
  ocupar(botao, true);
  mensagem(status, token ? 'Salvando nova senha…' : 'Solicitando link…');
  try {
    const rota = token ? 'redefinir-senha' : 'recuperar-senha';
    const resposta = await requestApi('/api/auth/' + rota, { method: 'POST', body: dados });
    form.reset();
    mensagem(status, resposta.mensagem, { focar: Boolean(token) });
    if (token) form.hidden = true;
  } catch (erro) {
    mensagem(status, erro.message, { erro: true });
  } finally {
    ocupar(botao, false);
  }
});

form.hidden = false;
iniciarMostrarSenha(form);

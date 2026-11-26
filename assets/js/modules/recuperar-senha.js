import { requestApi } from './api.js';

const token = window.location.hash.slice(1);
const form = document.getElementById(token ? 'redefinir' : 'solicitar');
const status = document.getElementById('status');
const botao = form.querySelector('button');

if (token) {
  window.history.replaceState(null, '', window.location.pathname);
  document.title = 'Redefinir senha | Sem Barreiras Pet';
  document.getElementById('titulo').textContent = 'Redefinir senha';
  document.getElementById('orientacao').textContent = 'Escolha uma senha de 8 a 128 caracteres.';
  document.getElementById('novo-link').hidden = false;
}

form.addEventListener('submit', async evento => {
  evento.preventDefault();
  if (botao.disabled) return;
  const dados = Object.fromEntries(new FormData(form));
  if (token && dados.nova_senha !== dados.confirmacao) {
    status.textContent = 'A nova senha e a confirmação precisam ser iguais.';
    return;
  }
  if (token) dados.token = token;
  botao.disabled = true;
  status.textContent = token ? 'Salvando nova senha…' : 'Solicitando link…';
  try {
    const rota = token ? 'redefinir-senha' : 'recuperar-senha';
    const resposta = await requestApi('/api/auth/' + rota, { method: 'POST', body: dados });
    form.reset();
    status.textContent = resposta.mensagem;
    if (token) form.hidden = true;
  } catch (erro) {
    status.textContent = erro.message;
  } finally {
    botao.disabled = false;
  }
});

form.hidden = false;

import { requestApi, currentSession } from './api.js';
import { iniciarMostrarSenha, mensagem, ocupado, ocupar } from './form-feedback.js';
const form = document.getElementById('form-senha');
const status = document.getElementById('status');
iniciarMostrarSenha(form);
try {
  if (!(await currentSession()).autenticado) window.location.replace('login.html');
} catch (erro) { mensagem(status, erro.message, { erro: true, focar: false }); }
form.addEventListener('submit', async evento => {
  evento.preventDefault();
  const botao = form.querySelector('button[type="submit"]');
  if (ocupado(botao)) return;
  if (form.elements.nova_senha.value !== form.elements.confirmacao.value) {
    mensagem(status, 'A nova senha e a confirmação precisam ser iguais.', { erro: true }); return;
  }
  ocupar(botao, true); mensagem(status, 'Salvando nova senha…');
  try {
    const resultado = await requestApi('/api/auth/senha', { method: 'POST', body: Object.fromEntries(new FormData(form)) });
    form.reset(); mensagem(status, resultado.mensagem);
    window.location.assign(resultado.usuario.gerente ? 'gerencia.html' : 'minhas-visitas.html');
  } catch (erro) { mensagem(status, erro.message, { erro: true }); ocupar(botao, false); }
});

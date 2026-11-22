import { requestApi, currentSession } from './api.js';
const form = document.getElementById('form-senha');
const status = document.getElementById('status');
try {
  if (!(await currentSession()).autenticado) window.location.replace('login.html');
} catch (erro) { status.textContent = erro.message; }
form.addEventListener('submit', async evento => {
  evento.preventDefault();
  const botao = form.querySelector('button');
  if (botao.disabled) return;
  if (form.elements.nova_senha.value !== form.elements.confirmacao.value) {
    status.textContent = 'A nova senha e a confirmação precisam ser iguais.'; return;
  }
  botao.disabled = true; status.textContent = 'Salvando nova senha…';
  try {
    const resultado = await requestApi('/api/auth/senha', { method: 'POST', body: Object.fromEntries(new FormData(form)) });
    form.reset(); status.textContent = resultado.mensagem;
    window.location.assign(resultado.usuario.gerente ? 'gerencia.html' : 'minhas-visitas.html');
  } catch (erro) { status.textContent = erro.message; botao.disabled = false; }
});

import { api, sessaoAtual } from './modules/api.js';
import config from '../../config.js';

// Menu, sessão e módulos usados nesta página.
function iniciarMenu() {
  const botaoMenu = document.getElementById('botao-menu');
  const menuPrincipal = document.getElementById('menu-principal');
  if (!botaoMenu || !menuPrincipal) return;

  botaoMenu.addEventListener('click', () => {
    const aberto = botaoMenu.getAttribute('aria-expanded') === 'true';
    botaoMenu.setAttribute('aria-expanded', String(!aberto));
    menuPrincipal.classList.toggle('menu-aberto', !aberto);
  });

  // Esc fecha o menu e devolve o foco ao botão
  document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape' && botaoMenu.getAttribute('aria-expanded') === 'true') {
      botaoMenu.setAttribute('aria-expanded', 'false');
      menuPrincipal.classList.remove('menu-aberto');
      botaoMenu.focus();
    }
  });
}

async function iniciarModulos() {
  const mapa = document.querySelector('[data-map]');
  const formVisita = document.querySelector('[data-scheduling-form]');
  if (formVisita) {
    const { initSchedulingForm } = await import('./modules/scheduling-form.js');
    initSchedulingForm(formVisita);
  }

  // Só o mapa precisa da configuração (chave do Google Maps)
  if (mapa) {
    const { initShelterMap } = await import('./modules/maps.js');
    initShelterMap(mapa, config);
  }
}

async function atualizarNavegacaoUsuario() {
  let sessao;
  try { sessao = await sessaoAtual(); } catch { return; }
  if (!sessao.autenticado) return;
  const nome = sessao.usuario.nome.trim().split(/\s+/)[0];
  document.querySelectorAll('.t-nav-entrar').forEach(item => {
    const saudacao = document.createElement('span');
    saudacao.className = 't-nav-usuario';
    saudacao.textContent = 'Olá, ' + nome + ' ';
    const sair = document.createElement('button');
    sair.type = 'button';
    sair.className = 't-btn-logout';
    sair.textContent = 'Sair';
    const status = document.createElement('span');
    status.setAttribute('role', 'alert');
    item.replaceChildren(saudacao, sair, status);
    sair.addEventListener('click', async () => {
      if (sair.disabled) return;
      sair.disabled = true;
      status.textContent = '';
      try {
        await api('/api/auth/logout', { method: 'POST', body: {} });
        const atual = await sessaoAtual();
        if (atual.autenticado) throw new Error('A sessão continua ativa. Tente sair novamente.');
        location.reload();
      } catch (erro) {
        status.textContent = ' Não foi possível sair. ' + erro.message;
        sair.disabled = false;
      }
    });
  });
  document.querySelectorAll('a[href$="cadastro.html"].t-btn').forEach(link => {
    link.hidden = true;
    const li = link.closest('li');
    if (li) li.hidden = true;
  });
}

iniciarMenu();
document.querySelectorAll('img[data-fallback]').forEach(img => {
  const substituir = () => {
    img.src = img.dataset.fallback;
    img.alt = img.dataset.fallbackAlt || 'Imagem ilustrativa';
  };
  img.addEventListener('error', substituir, { once: true });
  if (img.complete && !img.naturalWidth) substituir();
});
atualizarNavegacaoUsuario();
iniciarModulos().catch(() => {
  const status = document.querySelector('[data-form-status]');
  if (status) status.textContent = 'Não foi possível carregar o formulário. Recarregue a página.';
});
window.addEventListener('pageshow', evento => {
  if (evento.persisted) location.reload();
});

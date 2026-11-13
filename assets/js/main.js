import { currentSession, requestApi } from './modules/api.js';

/**
 * Sem Barreiras Pet — main.js
 * Ponto de entrada compartilhado pelas páginas públicas.
 *
 * - Controla o menu mobile (antes era um <script> inline na home).
 * - Carrega a configuração pública (config.js na raiz).
 * - Inicializa módulos somente nas páginas que têm os elementos
 *   correspondentes (mapa e formulário de visita).
 */

const CONFIG_PADRAO = Object.freeze({
  googleMapsApiKey: '',
  googleMapsMapId: 'DEMO_MAP_ID',
});

/** Lê config.js (raiz do site); se faltar ou falhar, usa os valores padrão. */
async function carregarConfig() {
  try {
    const modulo = await import(new URL('../../config.js', import.meta.url).href);
    return { ...CONFIG_PADRAO, ...(modulo.default || {}) };
  } catch {
    return { ...CONFIG_PADRAO };
  }
}

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
    const config = await carregarConfig();
    const { initShelterMap } = await import('./modules/maps.js');
    initShelterMap(mapa, config);
  }
}

async function atualizarNavegacaoUsuario() {
  let sessao;
  try { sessao = await currentSession(); } catch { return; }
  if (sessao.autenticado !== true || typeof sessao.usuario?.nome !== 'string') return;

  const nome = sessao.usuario.nome.trim().split(/\s+/)[0];
  document.querySelectorAll('.t-nav-entrar').forEach(item => {
    const saudacao = document.createElement('span');
    saudacao.className = 't-nav-usuario';
    saudacao.textContent = 'Olá, ' + nome;
    saudacao.style.fontWeight = '600';
    saudacao.style.marginRight = '0.5rem';
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 't-btn-logout';
    botao.textContent = 'Sair';
    botao.setAttribute('aria-label', 'Sair da conta');
    Object.assign(botao.style, {
      background: 'none', border: 'none', color: 'inherit', cursor: 'pointer',
      textDecoration: 'underline', font: 'inherit',
    });
    const status = document.createElement('span');
    status.setAttribute('role', 'alert');
    item.replaceChildren(saudacao, botao, status);
    botao.addEventListener('click', async () => {
      if (botao.disabled) return;
      botao.disabled = true;
      status.textContent = '';
      try {
        await requestApi('/api/auth/logout', { method: 'POST', body: {} });
        if ((await currentSession()).autenticado) throw new Error('A sessão continua ativa.');
        window.location.reload();
      } catch (erro) {
        status.textContent = ' Não foi possível sair. ' + erro.message;
        botao.disabled = false;
      }
    });
  });
  document.querySelectorAll('a[href$="cadastro.html"].t-btn').forEach(botao => {
    const item = botao.closest('li');
    if (item && !item.classList.contains('t-nav-entrar')) item.style.display = 'none';
  });
}

iniciarMenu();
atualizarNavegacaoUsuario();
iniciarModulos();

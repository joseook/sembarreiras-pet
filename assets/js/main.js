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

function atualizarNavegacaoUsuario() {
  const usuarioSalvo = localStorage.getItem('sb_usuario_atual');
  if (!usuarioSalvo) return;

  try {
    const usuario = JSON.parse(usuarioSalvo);
    if (!usuario || !usuario.nome) return;

    const primeiroNome = usuario.nome.split(' ')[0];
    const itensEntrar = document.querySelectorAll('.t-nav-entrar');

    itensEntrar.forEach((item) => {
      item.innerHTML = `
        <span class="t-nav-usuario" style="font-weight: 600; margin-right: 0.5rem;">Olá, ${primeiroNome}</span>
        <button type="button" class="t-btn-logout" style="background: none; border: none; color: inherit; cursor: pointer; text-decoration: underline; font: inherit;" aria-label="Sair da conta">Sair</button>
      `;

      const btnLogout = item.querySelector('.t-btn-logout');
      if (btnLogout) {
        btnLogout.addEventListener('click', async () => {
          localStorage.removeItem('sb_usuario_atual');
          try {
            await fetch('/api/auth/logout', { method: 'POST' });
          } catch {
            // Fallback caso backend esteja offline
          }
          window.location.reload();
        });
      }
    });

    document.querySelectorAll('a[href$="cadastro.html"].t-btn').forEach((btn) => {
      const li = btn.closest('li');
      if (li && !li.classList.contains('t-nav-entrar')) {
        li.style.display = 'none';
      }
    });
  } catch (e) {
    console.warn('Erro ao ler dados do usuário:', e);
  }
}

iniciarMenu();
atualizarNavegacaoUsuario();
iniciarModulos();

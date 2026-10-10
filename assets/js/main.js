/**
 * Sem Barreiras Pet — main.js
 * Ponto de entrada compartilhado pelas páginas públicas.
 *
 * - Controla o menu mobile (antes era um <script> inline na home).
 * - Carrega a configuração opcional (frontend/config.js).
 * - Inicializa módulos somente nas páginas que têm os elementos
 *   correspondentes (mapa e formulário de visita).
 */

const CONFIG_PADRAO = Object.freeze({
  apiBaseUrl: null,
  googleMapsApiKey: '',
  googleMapsMapId: 'DEMO_MAP_ID',
  demoUserId: null,
});

/** Lê frontend/config.js; se não existir, usa os valores padrão. */
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
  if (!mapa && !formVisita) return;

  const config = await carregarConfig();

  if (mapa) {
    const { initShelterMap } = await import('./modules/maps.js');
    initShelterMap(mapa, config);
  }

  if (formVisita) {
    const { initSchedulingForm } = await import('./modules/scheduling-form.js');
    initSchedulingForm(formVisita, config);
  }
}

iniciarMenu();
iniciarModulos();

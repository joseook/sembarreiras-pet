import { currentSession, requestApi } from './modules/api.js';
import { linkAcesso } from './modules/destino.js';

const CONFIG_PADRAO = Object.freeze({
  googleMapsApiKey: '',
  googleMapsMapId: 'DEMO_MAP_ID',
});

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

  if (mapa) {
    const config = await carregarConfig();
    const { initShelterMap } = await import('./modules/maps.js');
    initShelterMap(mapa, config);
  }
}

async function atualizarNavegacaoUsuario() {
  document.querySelectorAll('.t-nav-entrar a').forEach(link => { link.href = new URL('../../pages/' + linkAcesso(), import.meta.url).href; });
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
    const visitas = document.createElement('a');
    visitas.href = new URL('../../pages/minhas-visitas.html', import.meta.url).href;
    visitas.textContent = 'Minhas visitas';
    visitas.style.marginRight = '1rem';
    item.prepend(visitas);
    if (sessao.usuario.gerente) {
      const agenda = document.createElement('a');
      agenda.href = new URL('../../pages/gerencia.html', import.meta.url).href;
      agenda.textContent = 'Agenda da clínica';
      agenda.style.marginRight = '1rem';
      item.prepend(agenda);
    }
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

function iniciarPausaFaixa() {
  const faixa = document.querySelector('.h-faixa');
  if (!faixa) return;
  const botao = document.createElement('button');
  botao.type = 'button';
  botao.className = 'h-faixa-pausa';
  botao.textContent = 'Pausar faixa';
  botao.addEventListener('click', () => {
    const pausada = faixa.classList.toggle('h-faixa--pausada');
    botao.textContent = pausada ? 'Retomar faixa' : 'Pausar faixa';
  });
  faixa.prepend(botao);
}

iniciarMenu();
iniciarPausaFaixa();
atualizarNavegacaoUsuario();
iniciarModulos();
if (document.querySelector('.h-pets-grade')) import('./modules/catalogo.js');

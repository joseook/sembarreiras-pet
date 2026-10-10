/**
 * Mapa do abrigo — Google Maps JavaScript API (carregamento dinâmico).
 *
 * Princípios:
 * - O endereço em texto já está no HTML; o mapa é um complemento, nunca a
 *   única forma de informar a localização.
 * - Sem chave (config.googleMapsApiKey vazio), com chave inválida ou sem rede,
 *   o fallback textual do HTML permanece visível. Nada bloqueia a página.
 * - Usa a API atual: carregamento com `loading=async`, `google.maps.importLibrary`
 *   e `AdvancedMarkerElement` (não usa o `google.maps.Marker` legado).
 *
 * Estrutura esperada no HTML:
 *   <div data-map data-shelter-id data-lat data-lng data-nome data-mock>
 *     <div data-map-canvas hidden></div>
 *     <div data-map-fallback> ... [data-map-status] [data-map-route]
 *         [data-map-lat] [data-map-lng] ... </div>
 *   </div>
 */

import { requestJson } from './api.js';

const SCRIPT_ID = 'google-maps-js-api';
const TEMPO_LIMITE_MS = 10000;
const ZOOM_PADRAO = 15;

let carregamentoMaps = null;

/** Injeta o script do Google Maps uma única vez e resolve quando estiver pronto. */
function carregarGoogleMaps(chave) {
  if (window.google?.maps?.importLibrary) return Promise.resolve(window.google.maps);
  if (carregamentoMaps) return carregamentoMaps;

  carregamentoMaps = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Tempo esgotado ao carregar o mapa.')), TEMPO_LIMITE_MS);

    window.__sbpGoogleMapsPronto = () => {
      clearTimeout(timer);
      resolve(window.google.maps);
    };

    const parametros = new URLSearchParams({
      key: chave,
      v: 'weekly',
      loading: 'async',
      language: 'pt-BR',
      region: 'BR',
      callback: '__sbpGoogleMapsPronto',
    });

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?${parametros}`;
    script.async = true;
    script.onerror = () => {
      clearTimeout(timer);
      reject(new Error('Falha ao baixar o script do Google Maps.'));
    };
    document.head.append(script);
  });

  return carregamentoMaps;
}

function lerAbrigoDoHtml(container) {
  return {
    id: container.dataset.shelterId || null,
    nome: container.dataset.nome || 'Abrigo',
    latitude: Number.parseFloat(container.dataset.lat),
    longitude: Number.parseFloat(container.dataset.lng),
    mock: container.dataset.mock === 'true',
  };
}

/**
 * Busca as coordenadas atualizadas na API (GET /api/shelters/<id>).
 * Em qualquer falha devolve os dados do HTML, sem interromper a página.
 */
async function buscarAbrigoNaApi(abrigo, config) {
  if (!config.apiBaseUrl || !abrigo.id) return abrigo;
  try {
    const { data } = await requestJson(config.apiBaseUrl, `/shelters/${encodeURIComponent(abrigo.id)}`);
    if (data?.latitude == null || data?.longitude == null) return abrigo;
    return {
      ...abrigo,
      nome: data.name || abrigo.nome,
      latitude: Number(data.latitude),
      longitude: Number(data.longitude),
      // "mock" vem do HTML (data-mock). Quando a página for gerada a partir da
      // API com abrigos reais, basta publicar data-mock="false".
    };
  } catch {
    return abrigo;
  }
}

function atualizarFallback(container, abrigo) {
  const lat = container.querySelector('[data-map-lat]');
  const lng = container.querySelector('[data-map-lng]');
  if (lat) lat.textContent = String(abrigo.latitude);
  if (lng) lng.textContent = String(abrigo.longitude);

  // Link de rota só para abrigos reais: rota para um ponto fictício confundiria a pessoa.
  const rota = container.querySelector('[data-map-route]');
  if (rota && !abrigo.mock && Number.isFinite(abrigo.latitude) && Number.isFinite(abrigo.longitude)) {
    const destino = `${abrigo.latitude},${abrigo.longitude}`;
    const link = document.createElement('a');
    link.href = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destino)}`;
    link.rel = 'noopener';
    link.target = '_blank';
    link.textContent = `Como chegar ao ${abrigo.nome} (abre o Google Maps em nova aba)`;
    rota.replaceChildren(link);
  }
}

function mostrarStatus(container, mensagem) {
  const status = container.querySelector('[data-map-status]');
  if (status) status.textContent = mensagem;
}

/**
 * Inicializa o mapa do abrigo.
 * @param {HTMLElement} container elemento com [data-map]
 * @param {{googleMapsApiKey?: string, googleMapsMapId?: string, apiBaseUrl?: string|null}} config
 */
export async function initShelterMap(container, config) {
  const canvas = container.querySelector('[data-map-canvas]');
  const fallback = container.querySelector('[data-map-fallback]');

  const abrigo = await buscarAbrigoNaApi(lerAbrigoDoHtml(container), config);
  atualizarFallback(container, abrigo);

  const temCoordenadas = Number.isFinite(abrigo.latitude) && Number.isFinite(abrigo.longitude);
  if (!config.googleMapsApiKey || !canvas || !temCoordenadas) {
    mostrarStatus(container, 'Mapa indisponível neste ambiente.');
    return;
  }

  // Chamado pelo Google quando a chave é recusada (inválida, sem cobrança, referrer bloqueado).
  window.gm_authFailure = () => {
    canvas.hidden = true;
    if (fallback) fallback.hidden = false;
    mostrarStatus(container, 'Mapa indisponível neste ambiente.');
  };

  try {
    await carregarGoogleMaps(config.googleMapsApiKey);
    const { Map } = await google.maps.importLibrary('maps');
    const { AdvancedMarkerElement } = await google.maps.importLibrary('marker');

    const rotulo = abrigo.mock
      ? `Mapa com a localização de exemplo do ${abrigo.nome} (dados demonstrativos)`
      : `Mapa com a localização do ${abrigo.nome}`;
    canvas.setAttribute('role', 'region');
    canvas.setAttribute('aria-label', rotulo);
    canvas.title = rotulo;
    canvas.hidden = false;

    const posicao = { lat: abrigo.latitude, lng: abrigo.longitude };
    const mapa = new Map(canvas, {
      center: posicao,
      zoom: ZOOM_PADRAO,
      mapId: config.googleMapsMapId || 'DEMO_MAP_ID',
      clickableIcons: false,
    });
    new AdvancedMarkerElement({ map: mapa, position: posicao, title: abrigo.nome });

    // O fallback continua visível (rota e coordenadas). O texto não afirma que o
    // mapa carregou: com chave inválida o Google às vezes só registra "InvalidKey"
    // no console, sem chamar gm_authFailure, e não há sinal confiável para detectar.
    mostrarStatus(container, abrigo.mock
      ? 'Mapa com localização de exemplo. Se ele não aparecer, use o endereço em texto acima.'
      : 'Se o mapa não aparecer, use o endereço em texto acima.');
  } catch {
    canvas.hidden = true;
    mostrarStatus(container, 'Mapa indisponível neste ambiente.');
  }
}

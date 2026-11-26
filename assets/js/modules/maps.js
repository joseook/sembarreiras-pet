const SCRIPT_ID = 'google-maps-js-api';
const TEMPO_LIMITE_MS = 10000;
const ZOOM_PADRAO = 15;

let carregamentoMaps = null;

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
    nome: container.dataset.nome || 'Abrigo',
    latitude: Number.parseFloat(container.dataset.lat),
    longitude: Number.parseFloat(container.dataset.lng),
    mock: container.dataset.mock === 'true',
  };
}

function atualizarFallback(container, abrigo) {
  const lat = container.querySelector('[data-map-lat]');
  const lng = container.querySelector('[data-map-lng]');
  if (lat) lat.textContent = String(abrigo.latitude);
  if (lng) lng.textContent = String(abrigo.longitude);

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

export async function initShelterMap(container, config) {
  const canvas = container.querySelector('[data-map-canvas]');
  const fallback = container.querySelector('[data-map-fallback]');

  const abrigo = lerAbrigoDoHtml(container);
  atualizarFallback(container, abrigo);

  const temCoordenadas = Number.isFinite(abrigo.latitude) && Number.isFinite(abrigo.longitude);
  if (!config.googleMapsApiKey || !canvas || !temCoordenadas) {
    mostrarStatus(container, 'Mapa indisponível neste ambiente.');
    return;
  }

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

    mostrarStatus(container, abrigo.mock
      ? 'Mapa com localização de exemplo. Se ele não aparecer, use o endereço em texto acima.'
      : 'Se o mapa não aparecer, use o endereço em texto acima.');
  } catch {
    canvas.hidden = true;
    mostrarStatus(container, 'Mapa indisponível neste ambiente.');
  }
}

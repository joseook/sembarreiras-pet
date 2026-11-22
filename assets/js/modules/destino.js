const PAGINAS = new Set(['/pages/catalogo.html', '/pages/agendar-visita.html', '/pages/pet.html', '/pages/minhas-visitas.html', '/pages/gerencia.html', '/pages/gerencia-pets.html']);

export function destinoSeguro(valor) {
  if (!valor) return '';
  try {
    const url = new URL(valor, window.location.origin);
    return url.origin === window.location.origin && PAGINAS.has(url.pathname)
      ? url.pathname + url.search + url.hash : '';
  } catch { return ''; }
}

export function linkAcesso(pagina = 'login.html') {
  return pagina + '?next=' + encodeURIComponent(window.location.pathname + window.location.search + window.location.hash);
}

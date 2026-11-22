/** Comunicação com a API real. Não cria contas ou sessões no navegador. */
async function apiBase() {
  try {
    const { default: config } = await import('../../../config.js');
    return (config.apiBaseUrl || '').replace(/\/+$/, '');
  } catch {
    return '';
  }
}

// Remove o armazenamento inseguro das versões anteriores sem ler as senhas.
try {
  localStorage.removeItem('sb_usuarios_locais');
  localStorage.removeItem('sb_usuario_atual');
} catch { /* O navegador pode bloquear armazenamento local. */ }

export async function requestApi(path, { method = 'GET', body, aceitarLista = false } = {}) {
  const options = {
    method, credentials: 'include', cache: 'no-store',
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  };
  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }
  let response;
  try {
    response = await fetch((await apiBase()) + path, options);
  } catch {
    throw new Error('Não foi possível conectar ao serviço. Confira sua conexão e tente novamente.');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok || !data || typeof data !== 'object' || (Array.isArray(data) && !aceitarLista)) {
    if (data?.codigo === 'TROCAR_SENHA') window.location.assign(new URL('../../../pages/alterar-senha.html', import.meta.url).href);
    const error = new Error(data?.erro || 'Serviço temporariamente indisponível. Tente novamente.');
    error.status = response.status;
    error.campos = data?.campos || {};
    throw error;
  }
  return data;
}

export const currentSession = () => requestApi('/api/auth/me');

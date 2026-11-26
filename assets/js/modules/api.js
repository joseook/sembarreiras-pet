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

// Usada quando o servidor não devolve JSON (ex.: falha da plataforma de hospedagem).
function mensagemPorStatus(status) {
  if (status === 401) return 'Sua sessão expirou. Entre novamente.';
  if (status === 403) return 'Você não tem permissão para esta ação.';
  if (status === 404) return 'Recurso não encontrado.';
  if (status === 413) return 'O conteúdo enviado excede o limite permitido.';
  if (status === 429) return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
  if (status >= 500) return 'O servidor está com instabilidade. Tente novamente em instantes.';
  return 'Serviço temporariamente indisponível. Tente novamente.';
}

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
  } catch (falha) {
    if (falha?.name === 'TimeoutError') throw new Error('O serviço demorou para responder. Tente novamente em instantes.');
    throw new Error('Não foi possível conectar ao serviço. Confira sua conexão e tente novamente.');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok || !data || typeof data !== 'object' || (Array.isArray(data) && !aceitarLista)) {
    if (data?.codigo === 'TROCAR_SENHA') window.location.assign(new URL('../../../pages/alterar-senha.html', import.meta.url).href);
    const error = new Error(data?.erro || mensagemPorStatus(response.status));
    error.status = response.status;
    error.campos = data?.campos || {};
    throw error;
  }
  return data;
}

export const currentSession = () => requestApi('/api/auth/me');

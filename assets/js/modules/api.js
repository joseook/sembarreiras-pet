import config from '../../../config.js';

const base = (config.apiBaseUrl || '').replace(/\/+$/, '');

export async function api(path, { method = 'GET', body } = {}) {
  const opcoes = {
    method,
    credentials: 'include',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  };
  if (body !== undefined) {
    opcoes.headers['Content-Type'] = 'application/json';
    opcoes.body = JSON.stringify(body);
  }

  let resposta;
  try {
    resposta = await fetch(`${base}${path}`, opcoes);
  } catch {
    throw new Error('Não foi possível conectar ao serviço. Confira sua conexão e tente novamente.');
  }
  const dados = await resposta.json().catch(() => null);
  if (!resposta.ok || !dados) {
    const erro = new Error(dados?.erro || 'Serviço temporariamente indisponível. Tente novamente.');
    erro.status = resposta.status;
    throw erro;
  }
  return dados;
}

// Remove o armazenamento inseguro das versões anteriores, sem ler ou migrar senhas.
try {
  localStorage.removeItem('sb_usuarios_locais');
  localStorage.removeItem('sb_usuario_atual');
} catch { /* A aplicação também funciona com armazenamento local bloqueado. */ }

export const sessaoAtual = () => api('/api/auth/me');

/** Só permite retorno para páginas deste site, inclusive sob um subdiretório. */
export function destinoRetorno() {
  const inicio = new URL('../../../index.html', import.meta.url);
  const parametro = new URLSearchParams(location.search).get('retorno');
  if (!parametro) return inicio.href;
  try {
    const url = new URL(parametro, location.href);
    const raiz = new URL('./', inicio);
    if (url.origin === raiz.origin && url.pathname.startsWith(raiz.pathname) && !/\/(login|cadastro)\.html$/.test(url.pathname)) return url.href;
  } catch { /* Retorno inválido usa o início. */ }
  return inicio.href;
}

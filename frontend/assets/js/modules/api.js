/**
 * Cliente HTTP mínimo para a API Flask (ver docs/api.md).
 * Centraliza timeout e tratamento de erros para mapa e formulário.
 */

const TEMPO_LIMITE_MS = 10000;

/** Erro lançado quando a API responde com status de erro (4xx/5xx). */
export class ApiError extends Error {
  constructor(status, corpo) {
    super(corpo?.error?.message || `Erro HTTP ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.code = corpo?.error?.code || null;
    this.details = corpo?.error?.details || {};
  }
}

/** Erro de rede, CORS ou tempo limite: a API não respondeu. */
export class NetworkError extends Error {
  constructor(causa) {
    super('Não foi possível conectar ao servidor.');
    this.name = 'NetworkError';
    this.cause = causa;
  }
}

/**
 * Faz uma requisição JSON. Retorna o corpo já convertido.
 * @param {string} baseUrl ex.: "http://localhost:5000/api"
 * @param {string} caminho ex.: "/visits"
 * @param {RequestInit & {json?: unknown}} opcoes
 */
export async function requestJson(baseUrl, caminho, opcoes = {}) {
  const { json, ...init } = opcoes;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TEMPO_LIMITE_MS);

  const headers = { Accept: 'application/json', ...(init.headers || {}) };
  if (json !== undefined) headers['Content-Type'] = 'application/json';

  let resposta;
  try {
    resposta = await fetch(baseUrl.replace(/\/$/, '') + caminho, {
      ...init,
      headers,
      body: json !== undefined ? JSON.stringify(json) : init.body,
      signal: controller.signal,
    });
  } catch (erro) {
    throw new NetworkError(erro);
  } finally {
    clearTimeout(timer);
  }

  const corpo = await resposta.json().catch(() => null);
  if (!resposta.ok) throw new ApiError(resposta.status, corpo);
  return corpo;
}

/**
 * Configuração do front-end — ARQUIVO DE EXEMPLO (versionado).
 *
 * Como usar:
 *   1. Gere o arquivo real a partir do .env da raiz (recomendado):
 *        cd backend && python manage.py frontend-config
 *      ou copie manualmente:
 *        cp frontend/config.example.js frontend/config.js
 *   2. O arquivo frontend/config.js é ignorado pelo Git. NUNCA versione
 *      uma chave real do Google Maps.
 *
 * Sem frontend/config.js o site continua funcionando: o mapa mostra o
 * fallback textual e o formulário de visita fica em "modo prévia".
 */
export default {
  // URL base da API Flask. null = não chamar a API (modo prévia).
  apiBaseUrl: 'http://localhost:5000/api',

  // Chave de navegador do Google Maps JavaScript API.
  // Restrinja a chave por "HTTP referrer" e por API no Google Cloud Console.
  googleMapsApiKey: '',

  // Map ID exigido pelos marcadores avançados (AdvancedMarkerElement).
  // "DEMO_MAP_ID" é o ID de demonstração documentado pelo Google.
  googleMapsMapId: 'DEMO_MAP_ID',

  // SOMENTE DESENVOLVIMENTO: id do usuário de demonstração criado pelo seed.
  // Enquanto não há autenticação, as visitas são registradas em nome dele.
  // Deixe null para manter o formulário em modo prévia.
  demoUserId: null,
};

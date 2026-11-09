/**
 * Configuração pública do site (lida por assets/js/main.js e módulos).
 *
 * googleMapsApiKey: chave de NAVEGADOR da Maps JavaScript API. Ela fica visível
 * para quem acessa o site (é assim que o Google Maps funciona), então restrinja-a
 * por HTTP referrer no Google Cloud Console. Vazia = mapa substituído pelo
 * endereço em texto na página "Como funciona".
 *
 * apiBaseUrl: URL base da API Flask (ex: 'https://sembarreiras-pet.onrender.com').
 * Deixe vazio ('') para usar rotas relativas (quando o frontend é servido pelo Flask).
 */
export default {
  googleMapsApiKey: '',
  googleMapsMapId: 'DEMO_MAP_ID',
  apiBaseUrl: '',
};

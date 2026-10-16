/**
 * Configuração pública do site (lida por assets/js/main.js).
 *
 * googleMapsApiKey: chave de NAVEGADOR da Maps JavaScript API. Ela fica visível
 * para quem acessa o site (é assim que o Google Maps funciona), então restrinja-a
 * por HTTP referrer no Google Cloud Console. Vazia = mapa substituído pelo
 * endereço em texto na página "Como funciona".
 */
export default {
  googleMapsApiKey: '',
  googleMapsMapId: 'DEMO_MAP_ID',
};

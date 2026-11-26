import { requestApi } from './api.js';
try {
  const politica = await requestApi('/api/privacidade');
  const secoes = politica.secoes.map(secao => {
    const bloco = document.createElement('section');
    const titulo = document.createElement('h2'); titulo.textContent = secao.titulo;
    const texto = document.createElement('p'); texto.textContent = secao.conteudo;
    bloco.append(titulo, texto); return bloco;
  });
  document.getElementById('politica-secoes').replaceChildren(...secoes);
} catch {  }

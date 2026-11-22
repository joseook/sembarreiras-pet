import { requestApi } from './api.js';

const grade = document.querySelector('.h-pets-grade');
const nota = document.querySelector('.h-catalogo-status');
const filtros = document.getElementById('filtros-pets');
let carregando = false;
async function carregar() {
  if (carregando) return;
  carregando = true;
  const params = new URLSearchParams(new FormData(filtros)); params.set('status', 'disponivel');
  for (const campo of filtros.elements) campo.disabled = true;
  grade.setAttribute('aria-busy', 'true');
  grade.replaceChildren();
  nota.textContent = 'Consultando pets disponíveis…';
  nota.setAttribute('role', 'status');
  try {
    const pets = await requestApi('/api/pets?' + params, { aceitarLista: true });
    for (const pet of pets) {
      const item = document.createElement('li'); item.className = 'h-pet';
      const link = document.createElement('a'); link.className = 'h-pet-link';
      const urlFicha = new URL('../../../pages/pet.html', import.meta.url);
      urlFicha.searchParams.set('id', pet.id);
      link.href = urlFicha.href;
      const foto = document.createElement('div'); foto.className = 'h-pet-foto';
      if (pet.fotos?.[0]?.src) {
        const img = document.createElement('img');
        img.src = new URL(pet.fotos[0].src, urlFicha).href;
        img.alt = pet.fotos[0].alt || `Foto de ${pet.nome}`;
        img.width = 900; img.height = 1125; img.loading = 'lazy';
        img.addEventListener('error', () => { img.replaceWith(document.createTextNode('Foto indisponível')); }, { once: true });
        foto.append(img);
      } else { foto.textContent = 'Foto não cadastrada'; }
      const corpo = document.createElement('div'); corpo.className = 'h-pet-corpo';
      const titulo = document.createElement('h3'); titulo.textContent = pet.nome;
      const resumo = document.createElement('p'); resumo.textContent = [pet.especie, pet.idade, pet.porte].filter(Boolean).join(' · ');
      const acao = document.createElement('p'); acao.textContent = 'Conhecer ' + pet.nome + ' →';
      corpo.append(titulo, resumo, acao); link.append(foto, corpo); item.append(link); grade.append(item);
    }
    const quantidade = pets.length === 1 ? '1 pet encontrado' : `${pets.length} pets encontrados`;
    nota.textContent = pets.length ? `${quantidade}. A visita depende de confirmação.` : 'Nenhum pet encontrado para estes filtros. Tente outra busca ou limpe os filtros.';
  } catch {
    nota.textContent = 'Não foi possível consultar a disponibilidade. Use Buscar pets para tentar novamente.';
  } finally {
    carregando = false; grade.removeAttribute('aria-busy');
    for (const campo of filtros.elements) campo.disabled = false;
  }
}
filtros.addEventListener('submit', evento => { evento.preventDefault(); carregar(); });
filtros.addEventListener('reset', evento => {
  evento.preventDefault(); if (carregando) return;
  filtros.elements.q.value = ''; filtros.elements.especie.value = ''; filtros.elements.porte.value = ''; carregar();
});
await carregar();

/** Dados públicos de exemplo, compartilhados com a inicialização do banco. */
export const PETS = await fetch(new URL('./pets.json', import.meta.url), {
  signal: AbortSignal.timeout(5000),
})
  .then(resposta => resposta.ok ? resposta.json() : [])
  .catch(() => []);

export function buscarPet(id) {
  return PETS.find(pet => pet.id === id) || null;
}

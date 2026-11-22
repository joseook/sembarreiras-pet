import dados from './pets.json' with { type: 'json' };

export const PETS = dados;
export function buscarPet(id) {
  return PETS.find(pet => pet.id === id) || null;
}

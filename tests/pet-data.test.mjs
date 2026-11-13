import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizarPet } from '../assets/js/modules/pet-data.js';
import { PETS } from '../assets/js/data/pets.js';

test('Ficha completa conserva todos os dados conhecidos e não modifica a entrada', () => {
  for (const exemplo of PETS) {
    const original = JSON.stringify(exemplo);
    const ficha = normalizarPet(exemplo);
    for (const campo of ['nome', 'historia', 'energia', 'convive', 'cuidados', 'alimentacao',
                         'abrigo', 'vacinas', 'exames', 'fotos']) {
      assert.deepEqual(ficha[campo], exemplo[campo]);
    }
    assert.equal(JSON.stringify(exemplo), original);
  }
});

test('Resposta incompleta preserva a história do servidor e indica ausência de dados', () => {
  const ficha = normalizarPet({ id: 'nina', nome: 'Nina', historia: 'História da API.' });
  assert.equal(ficha.historia, 'História da API.');
  assert.deepEqual(ficha.fotos, []);
  assert.equal(ficha.informado.doencasAtuais, false);
  assert.equal(ficha.informado.vacinas, false);
  assert.equal(ficha.castrado, null);
  assert.equal(ficha.convive.criancas, 'nao-informado');
});

test('Tipos inesperados e listas com itens inválidos não viram fatos de saúde', () => {
  const ficha = normalizarPet({ id: 'nina', nome: 'Nina', fotos: [null, {}, { src: 'foto.jpg' }],
    etiquetas: {}, vacinas: [null], doencasAtuais: {}, convive: { gatos: 'incerto' } });
  assert.equal(ficha.fotos.length, 1);
  assert.deepEqual(ficha.etiquetas, []);
  assert.equal(ficha.informado.vacinas, false);
  assert.equal(ficha.informado.doencasAtuais, false);
  assert.equal(ficha.convive.gatos, 'nao-informado');
});

test('Listas explicitamente vazias são diferenciadas de informações ausentes', () => {
  const ficha = normalizarPet({ id: 'nina', nome: 'Nina', doencasAtuais: [] });
  assert.equal(ficha.informado.doencasAtuais, true);
  assert.equal(ficha.informado.doencasPassadas, false);
});

test('Respostas sem identidade válida são rejeitadas de forma explícita', () => {
  for (const valor of [null, [], {}, { id: 'nina' }, { id: 42, nome: 'Nina' }]) {
    assert.throws(() => normalizarPet(valor), TypeError);
  }
});

/** Contrato da ficha: campos opcionais ausentes não representam fatos de saúde. */
const texto = (valor, padrao = 'Não informado') =>
  typeof valor === 'string' && valor.trim() ? valor : padrao;
const textos = valor => Array.isArray(valor) ? valor.filter(item => typeof item === 'string') : [];
const registros = valor => Array.isArray(valor)
  ? valor.filter(item => item && typeof item === 'object' && !Array.isArray(item)) : [];

export function normalizarPet(dados) {
  if (!dados || typeof dados !== 'object' || Array.isArray(dados) ||
      typeof dados.id !== 'string' || !dados.id.trim() ||
      typeof dados.nome !== 'string' || !dados.nome.trim()) {
    throw new TypeError('A ficha precisa de identificador e nome válidos.');
  }
  const pet = { ...dados };
  for (const campo of ['especie', 'raca', 'idade', 'sexo', 'porte', 'peso', 'cor', 'energia',
    'historia', 'rotina', 'apartamento', 'cuidados', 'alimentacao', 'abrigo',
    'vermifugo', 'antiparasitario', 'alergias']) {
    pet[campo] = texto(dados[campo]);
  }
  pet.castrado = typeof dados.castrado === 'boolean' ? dados.castrado : null;
  pet.microchip = typeof dados.microchip === 'boolean' ? dados.microchip : null;
  pet.etiquetas = textos(dados.etiquetas);
  pet.temperamento = textos(dados.temperamento);
  pet.fotos = registros(dados.fotos).filter(foto => typeof foto.src === 'string' && foto.src.trim());
  pet.convive = {};
  for (const campo of ['criancas', 'caes', 'gatos']) {
    const valor = dados.convive?.[campo];
    pet.convive[campo] = ['sim', 'nao', 'nao-testado'].includes(valor) ? valor : 'nao-informado';
  }
  pet.informado = {};
  for (const campo of ['vacinas', 'doencasAtuais', 'doencasPassadas', 'exames']) {
    const lista = registros(dados[campo]);
    pet.informado[campo] = Array.isArray(dados[campo]) && lista.length === dados[campo].length;
    pet[campo] = lista;
  }
  return pet;
}

/**
 * Sem Barreiras Pet — dados de demonstração dos pets.
 *
 * ATENÇÃO: todos os nomes, históricos e dados de saúde abaixo são FICTÍCIOS.
 * Servem para validar a interface da ficha do animal. Quando existir back-end,
 * esta lista deve vir da API (o formato dos campos pode ser mantido).
 *
 * Datas no formato AAAA-MM-DD; a ficha converte para dd/mm/aaaa.
 * status das vacinas: "em-dia" | "pendente" | "nao-se-aplica"
 */
export const PETS = [
  {
    id: 'nina',
    nome: 'Nina',
    especie: 'Cachorro',
    sexo: 'Fêmea',
    raca: 'Cocker Spaniel',
    idade: '2 anos',
    porte: 'Médio',
    peso: '11 kg',
    cor: 'Caramelo',
    castrado: true,
    microchip: true,
    resumo: 'Calma, adora carinho e já é acostumada com crianças.',
    etiquetas: ['Gentil', 'Carinhosa'],
    energia: 'Moderada',
    convive: { criancas: 'sim', caes: 'sim', gatos: 'nao-testado' },
    apartamento: 'Sim, desde que passeie todo dia',
    temperamento: ['Gentil', 'Carinhosa', 'Sociável', 'Dócil'],
    historia:
      'Nina foi encontrada com cerca de 1 ano, sozinha, perto de uma feira. Está no abrigo há 9 meses, ' +
      'já aprendeu comandos básicos (senta, fica e vem) e anda bem na guia. Gosta de colo e de ficar perto das pessoas.',
    rotina:
      'Dois passeios curtos por dia e brincadeiras com bolinha. Estranha barulhos altos (fogos), então precisa de um ' +
      'cantinho tranquilo.',
    vacinas: [
      { nome: 'V10 (polivalente)', aplicada: '2026-03-12', proxima: '2027-03-12', status: 'em-dia' },
      { nome: 'Antirrábica', aplicada: '2026-03-12', proxima: '2027-03-12', status: 'em-dia' },
      { nome: 'Gripe canina (tosse dos canis)', aplicada: '2026-03-26', proxima: '2027-03-26', status: 'em-dia' },
      { nome: 'Leishmaniose', aplicada: null, proxima: '2026-11-05', status: 'pendente' },
    ],
    vermifugo: 'Último vermífugo em 02/09/2026 (a cada 3 meses).',
    antiparasitario: 'Antipulgas e carrapatos em dia, aplicado em 20/09/2026.',
    doencasPassadas: [
      { nome: 'Otite no ouvido esquerdo', quando: 'Janeiro de 2026', situacao: 'Curada com tratamento de 10 dias.' },
      { nome: 'Sarna leve (ácaros)', quando: 'Dezembro de 2025', situacao: 'Curada. Chegou ao abrigo com a pele irritada.' },
    ],
    doencasAtuais: [],
    alergias: 'Nenhuma conhecida.',
    exames: [
      { nome: 'Leishmaniose', resultado: 'Negativo', data: '2026-08-14' },
      { nome: 'Cinomose / Parvovirose', resultado: 'Sem sinais clínicos', data: '2026-08-14' },
      { nome: 'Hemograma', resultado: 'Normal', data: '2026-08-14' },
    ],
    cuidados:
      'Limpar as orelhas toda semana (raça com tendência a otite) e escovar o pelo 2 a 3 vezes por semana.',
    alimentacao: 'Ração para cães adultos de porte médio, 2 refeições por dia.',
    abrigo: 'Abrigo Patas Livres',
    fotos: [
      { src: '../assets/img/pets/nina.jpg', alt: 'Nina, cadela cocker spaniel de pelagem caramelo, olhando para a câmera' },
      { src: '../assets/img/pets/nina-2.jpg', alt: 'Cadela de pelo claro e orelhas longas deitada na grama, de barriga para cima' },
      { src: '../assets/img/pets/nina-3.jpg', alt: 'Cadela caramelo com o focinho sobre um lençol branco' },
    ],
  },

  {
    id: 'simba',
    nome: 'Simba',
    especie: 'Gato',
    sexo: 'Macho',
    raca: 'Sem raça definida (SRD)',
    idade: '1 ano',
    porte: 'Pequeno',
    peso: '3,8 kg',
    cor: 'Laranja e branco',
    castrado: true,
    microchip: false,
    resumo: 'Curioso e brincalhão, se dá bem com outros gatos.',
    etiquetas: ['Brincalhão', 'Curioso'],
    energia: 'Alta',
    convive: { criancas: 'sim', caes: 'nao-testado', gatos: 'sim' },
    apartamento: 'Sim, com redes de proteção nas janelas',
    temperamento: ['Brincalhão', 'Curioso', 'Sociável', 'Falante'],
    historia:
      'Simba nasceu na rua e foi resgatado com 3 meses, junto de dois irmãos que já foram adotados. ' +
      'Cresceu em lar temporário com outros gatos e está acostumado com caixa de areia e arranhador.',
    rotina:
      'Precisa de brincadeiras todos os dias (varinha, bolinhas) para gastar energia. Dorme bastante à tarde.',
    vacinas: [
      { nome: 'V4 (quádrupla felina)', aplicada: '2026-02-18', proxima: '2027-02-18', status: 'em-dia' },
      { nome: 'Antirrábica', aplicada: '2026-03-04', proxima: '2027-03-04', status: 'em-dia' },
      { nome: 'FeLV (leucemia felina)', aplicada: '2026-03-04', proxima: '2027-03-04', status: 'em-dia' },
    ],
    vermifugo: 'Último vermífugo em 10/09/2026 (a cada 3 meses).',
    antiparasitario: 'Antipulgas em dia, aplicado em 28/09/2026.',
    doencasPassadas: [
      { nome: 'Rinotraqueíte felina (espirros e olhos lacrimejando)', quando: 'Setembro de 2025', situacao: 'Curada. Pode voltar em períodos de estresse.' },
      { nome: 'Verminose', quando: 'Agosto de 2025', situacao: 'Tratada ao ser resgatado.' },
    ],
    doencasAtuais: [],
    alergias: 'Nenhuma conhecida.',
    exames: [
      { nome: 'FIV (AIDS felina)', resultado: 'Negativo', data: '2026-02-10' },
      { nome: 'FeLV (leucemia felina)', resultado: 'Negativo', data: '2026-02-10' },
      { nome: 'Hemograma', resultado: 'Normal', data: '2026-02-10' },
    ],
    cuidados: 'Manter as janelas teladas. Se aparecerem espirros, procurar o veterinário cedo.',
    alimentacao: 'Ração para gatos castrados, 3 pequenas refeições por dia, mais água fresca sempre.',
    abrigo: 'Abrigo Patas Livres',
    fotos: [
      { src: '../assets/img/pets/simba.jpg', alt: 'Simba, gato laranja e branco de olhos verdes, olhando para a câmera' },
      { src: '../assets/img/pets/simba-2.jpg', alt: 'Gato rajado cinza em pé sobre uma pedra, em meio ao verde' },
      { src: '../assets/img/pets/simba-3.jpg', alt: 'Gato rajado de olhos amarelos sobre fundo cinza claro' },
    ],
  },

  {
    id: 'bento',
    nome: 'Bento',
    especie: 'Cachorro',
    sexo: 'Macho',
    raca: 'Golden Retriever',
    idade: '8 anos',
    porte: 'Grande',
    peso: '31 kg',
    cor: 'Dourado',
    castrado: true,
    microchip: true,
    resumo: 'Tranquilo e companheiro, ideal para uma casa mais calma.',
    etiquetas: ['Leal', 'Sênior'],
    energia: 'Baixa',
    convive: { criancas: 'sim', caes: 'sim', gatos: 'nao-testado' },
    apartamento: 'Sim, se houver elevador ou poucos degraus',
    temperamento: ['Leal', 'Tranquilo', 'Paciente', 'Companheiro'],
    historia:
      'Bento viveu 7 anos com um tutor idoso que precisou se mudar para uma instituição e não pôde levá-lo. ' +
      'Chegou ao abrigo triste, mas se adaptou rápido. Segue as pessoas pela casa e adora deitar perto de quem está por perto.',
    rotina:
      'Passeios lentos de 20 minutos, duas vezes ao dia. Evitar escadas longas e pisos muito lisos.',
    vacinas: [
      { nome: 'V10 (polivalente)', aplicada: '2026-04-09', proxima: '2027-04-09', status: 'em-dia' },
      { nome: 'Antirrábica', aplicada: '2026-04-09', proxima: '2027-04-09', status: 'em-dia' },
      { nome: 'Gripe canina (tosse dos canis)', aplicada: null, proxima: null, status: 'nao-se-aplica' },
    ],
    vermifugo: 'Último vermífugo em 15/08/2026 (a cada 3 meses).',
    antiparasitario: 'Antipulgas e carrapatos em dia, aplicado em 01/10/2026.',
    doencasPassadas: [
      { nome: 'Erliquiose (doença do carrapato)', quando: '2024', situacao: 'Curada. Faz exame de sangue de controle a cada 6 meses.' },
      { nome: 'Pequeno lipoma retirado', quando: 'Maio de 2026', situacao: 'Cirurgia sem intercorrências.' },
    ],
    doencasAtuais: [
      {
        nome: 'Artrose leve nos quadris',
        situacao: 'Controlada com medicação.',
        tratamento: 'Condroitina e glucosamina todos os dias; anti-inflamatório só se houver dor.',
        custoMensal: 'Cerca de R$ 90 por mês (valor de exemplo).',
      },
    ],
    alergias: 'Nenhuma conhecida.',
    exames: [
      { nome: 'Raio-X de quadril', resultado: 'Artrose leve', data: '2026-06-18' },
      { nome: 'Erliquiose / Babesiose', resultado: 'Negativo', data: '2026-08-20' },
      { nome: 'Função renal e hepática', resultado: 'Normal para a idade', data: '2026-08-20' },
    ],
    cuidados:
      'Cama ortopédica ou macia, ração sênior e controle de peso. Consulta de rotina a cada 6 meses.',
    alimentacao: 'Ração sênior para raças grandes, 2 refeições por dia.',
    abrigo: 'Abrigo Patas Livres',
    fotos: [
      { src: '../assets/img/pets/bento.jpg', alt: 'Bento, golden retriever idoso, deitado entre a vegetação e olhando para o lado' },
      { src: '../assets/img/pets/bento-2.jpg', alt: 'Golden retriever com o queixo apoiado em uma cerca de madeira' },
      { src: '../assets/img/pets/bento-3.jpg', alt: 'Cão de pelo claro olhando para cima, com a boca aberta' },
    ],
  },

  {
    id: 'mel',
    nome: 'Mel',
    especie: 'Gato',
    sexo: 'Fêmea',
    raca: 'Sem raça definida (SRD)',
    idade: '4 meses',
    porte: 'Pequeno',
    peso: '1,4 kg',
    cor: 'Cinza rajada',
    castrado: false,
    microchip: false,
    resumo: 'Filhote cheia de energia, ainda aprendendo sobre o mundo.',
    etiquetas: ['Filhote', 'Enérgica'],
    energia: 'Muito alta',
    convive: { criancas: 'sim', caes: 'nao-testado', gatos: 'sim' },
    apartamento: 'Sim, com muita brincadeira',
    temperamento: ['Enérgica', 'Curiosa', 'Afetuosa', 'Destemida'],
    historia:
      'Mel foi encontrada com cerca de 3 semanas, sozinha, e foi alimentada com mamadeira por voluntárias do abrigo. ' +
      'Por isso é muito apegada a pessoas. Já usa a caixa de areia sozinha.',
    rotina:
      'Filhotes precisam de várias refeições ao dia e de companhia. Não é ideal para quem passa o dia inteiro fora.',
    vacinas: [
      { nome: 'V4 (quádrupla felina) - 1ª dose', aplicada: '2026-08-28', proxima: '2026-09-25', status: 'em-dia' },
      { nome: 'V4 (quádrupla felina) - 2ª dose', aplicada: '2026-09-25', proxima: '2026-10-23', status: 'pendente' },
      { nome: 'Antirrábica', aplicada: null, proxima: '2026-12-04', status: 'pendente' },
    ],
    vermifugo: 'Vermifugada em 25/09/2026; repetir em 25/10/2026.',
    antiparasitario: 'Antipulgas para filhotes aplicado em 25/09/2026.',
    doencasPassadas: [
      { nome: 'Conjuntivite', quando: 'Julho de 2026', situacao: 'Curada com colírio.' },
    ],
    doencasAtuais: [],
    alergias: 'Nenhuma conhecida.',
    exames: [
      { nome: 'FIV / FeLV', resultado: 'Negativo', data: '2026-08-28' },
    ],
    cuidados:
      'Ainda não pode ser castrada: a cirurgia é feita a partir dos 6 meses e o abrigo cobre o procedimento. ' +
      'O termo de adoção exige que ela seja castrada.',
    alimentacao: 'Ração para filhotes, 4 refeições por dia até os 6 meses.',
    abrigo: 'Abrigo Patas Livres',
    fotos: [
      { src: '../assets/img/pets/mel.jpg', alt: 'Mel, gatinha filhote levantando a patinha em direção à câmera, sobre fundo azul claro' },
      { src: '../assets/img/pets/mel-2.jpg', alt: 'Gato laranja deitado em um piso de madeira, olhando para cima' },
      { src: '../assets/img/pets/mel-3.jpg', alt: 'Gatinho rajado em pé no chão, bocejando' },
    ],
  },
];

export function buscarPet(id) {
  return PETS.find((pet) => pet.id === id) || null;
}

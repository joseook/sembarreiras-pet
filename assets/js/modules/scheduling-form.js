import { currentSession, requestApi } from './api.js';
import { ocupado, ocupar } from './form-feedback.js';
import { linkAcesso } from './destino.js';

const LIMITE_MENSAGEM = 1000;

function hojeLocalISO() {
  const agora = new Date();
  const local = new Date(agora.getTime() - 3 * 60 * 60000);
  return local.toISOString().slice(0, 10);
}

function montarDataHora(data, horario) {
  const iso = `${data}T${horario}:00-03:00`;
  return { momento: new Date(iso), iso };
}

function formatarDataHora(iso) {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return iso;
  return data.toLocaleString('pt-BR', {
    dateStyle: 'full', timeStyle: 'short', timeZone: 'America/Sao_Paulo',
  }) + ' (horário de Brasília)';
}

export function initSchedulingForm(form) {
  const campos = {
    data: form.elements.namedItem('data'),
    horario: form.elements.namedItem('horario'),
    mensagem: form.elements.namedItem('mensagem'),
  };
  const status = form.querySelector('[data-form-status]');

  form.noValidate = true;
  campos.data.min = hojeLocalISO();
  const petId = new URLSearchParams(window.location.search).get('pet_id') || null;
  let petNome = '';
  const selecao = document.querySelector('[data-pet-selecionado]');
  const chaveRascunho = 'sb_visita_rascunho:' + (petId || 'geral');
  try {
    const rascunho = JSON.parse(sessionStorage.getItem(chaveRascunho) || 'null');
    if (rascunho && Date.now() - rascunho.salvoEm < 30 * 60000) {
      for (const nome of Object.keys(campos)) if (typeof rascunho[nome] === 'string') campos[nome].value = rascunho[nome];
    }
    sessionStorage.removeItem(chaveRascunho);
  } catch {  }
  function salvarRascunho() {
    try {
      sessionStorage.setItem(chaveRascunho, JSON.stringify({ salvoEm: Date.now(),
        ...Object.fromEntries(Object.entries(campos).map(([nome, campo]) => [nome, campo.value])) }));
    } catch {  }
  }
  document.addEventListener('click', evento => {
    const link = evento.target.closest('a');
    if (link && /\/(login|cadastro)\.html/.test(new URL(link.href).pathname)) salvarRascunho();
  });

  function definirErro(nome, mensagem) {
    const campo = campos[nome];
    const erro = form.querySelector(`[data-erro-de="${nome}"]`);
    if (!campo || !erro) return;
    if (mensagem) {
      campo.setAttribute('aria-invalid', 'true');
      erro.textContent = mensagem;
      erro.hidden = false;
    } else {
      campo.removeAttribute('aria-invalid');
      erro.textContent = '';
      erro.hidden = true;
    }
  }

  function limparErros() {
    Object.keys(campos).forEach((nome) => definirErro(nome, ''));
  }

  function mostrarStatus(tipo, paragrafos, focar = false) {
    status.dataset.tipo = tipo;
    status.setAttribute('role', tipo === 'erro' ? 'alert' : 'status');
    status.tabIndex = -1;
    if (focar) window.setTimeout(() => status.focus(), 0);
    status.replaceChildren(
      ...paragrafos.map((texto) => {
        const p = document.createElement('p');
        p.textContent = texto;
        return p;
      }),
    );
  }

  function validar() {
    const erros = {};
    const data = campos.data.value;
    const horario = campos.horario.value;

    if (!data) erros.data = 'Escolha a data da visita.';
    else if (data < hojeLocalISO()) erros.data = 'Escolha uma data a partir de hoje.';
    else if ([0, 1].includes(new Date(data + 'T12:00:00-03:00').getUTCDay())) erros.data = 'O abrigo recebe visitas de terça a sábado.';

    if (!horario) erros.horario = 'Escolha um horário para a visita.';

    if (data && horario && !erros.data) {
      const { momento } = montarDataHora(data, horario);
      if (momento.getTime() <= Date.now()) erros.horario = 'Esse horário já passou. Escolha outro.';
    }

    if (campos.mensagem.value.length > LIMITE_MENSAGEM) {
      erros.mensagem = `A mensagem pode ter no máximo ${LIMITE_MENSAGEM} caracteres.`;
    }
    return erros;
  }

  function aplicarErros(erros) {
    const nomes = Object.keys(erros);
    nomes.forEach((nome) => definirErro(nome, erros[nome]));
    const primeiro = nomes.map((nome) => campos[nome]).find(Boolean);
    if (primeiro) primeiro.focus();
    return nomes.length;
  }

  Object.entries(campos).forEach(([nome, campo]) => {
    campo.addEventListener('change', () => {
      if (campo.getAttribute('aria-invalid') === 'true') definirErro(nome, '');
    });
  });

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const botaoEnvio = form.querySelector('button[type="submit"]');
    if (botaoEnvio.disabled || ocupado(botaoEnvio)) return;
    limparErros();

    const erros = validar();
    const totalErros = aplicarErros(erros);
    if (totalErros > 0) {
      mostrarStatus('erro', [
        totalErros === 1
          ? 'Há 1 campo para corrigir. A mensagem aparece logo abaixo dele.'
          : `Há ${totalErros} campos para corrigir. As mensagens aparecem abaixo de cada um.`,
      ]);
      return;
    }

    const { iso } = montarDataHora(campos.data.value, campos.horario.value);
    const botao = botaoEnvio;

    try {
      ocupar(botao, true, 'Enviando ao abrigo...');

      const resultado = await requestApi('/api/agendamentos', {
        method: 'POST',
        body: {
          data: campos.data.value,
          horario: campos.horario.value,
          mensagem: campos.mensagem.value.trim() || null,
          pet_id: new URLSearchParams(window.location.search).get('pet_id') || null,
        },
      });
      if (!resultado.agendamento) throw new Error('Não foi possível confirmar o registro da visita.');
      const nome = resultado.agendamento.pet_nome || petNome;
      mostrarStatus('sucesso', [
        'Solicitação registrada' + (nome ? ' para conhecer ' + nome : '') + ' em ' + formatarDataHora(iso) + '.',
        'Aguarde a confirmação da gerência antes de ir à clínica. Consulte o retorno em Minhas visitas.',
      ]);
      form.reset();
      try { sessionStorage.removeItem(chaveRascunho); } catch {  }
      const acompanhar = document.createElement('a');
      acompanhar.href = 'minhas-visitas.html'; acompanhar.textContent = 'Acompanhar minhas visitas';
      status.append(acompanhar);
      status.focus();
    } catch (erro) {
      const nomes = Object.keys(erro.campos || {}).filter((nome) => campos[nome]);
      nomes.forEach((nome) => definirErro(nome, String(erro.campos[nome])));
      mostrarStatus('erro', [erro.message], !nomes.length);
      if (nomes.length) campos[nomes[0]].focus();
      if (erro.status === 401) {
        const acesso = document.createElement('a');
        acesso.href = linkAcesso(); acesso.textContent = 'Entrar e continuar esta solicitação';
        status.append(acesso);
      }
    } finally {
      ocupar(botao, false);
    }
  });
  currentSession().then((sessao) => {
    if (sessao.autenticado) return;
    const aviso = document.createElement('p');
    aviso.className = 'visita-aviso-acesso';
    aviso.append('Para enviar a solicitação, entre na sua conta. O que você preencher aqui será mantido. ');
    const entrar = document.createElement('a');
    entrar.href = linkAcesso(); entrar.textContent = 'Entrar para agendar';
    const criar = document.createElement('a');
    criar.href = linkAcesso('cadastro.html'); criar.textContent = 'criar uma conta';
    aviso.append(entrar, ' ou ', criar, '.');
    const titulo = form.querySelector('h2');
    if (titulo) titulo.after(aviso); else form.prepend(aviso);
  }).catch(() => {  });

  if (petId) {
    const botao = form.querySelector('button[type="submit"]');
    botao.disabled = true;
    requestApi('/api/pets/' + encodeURIComponent(petId)).then(pet => {
      if (pet.status !== 'disponivel') throw new Error('Este pet não está disponível para visitas.');
      petNome = pet.nome;
      if (selecao) {
        document.querySelectorAll('[data-pet-nome]').forEach(elemento => { elemento.textContent = pet.nome; });
        document.title = `Visita para conhecer ${pet.nome} | Sem Barreiras Pet`;
        const ficha = selecao.querySelector('[data-pet-ficha]');
        ficha.href = 'pet.html?id=' + encodeURIComponent(pet.id); ficha.hidden = false;
        const foto = selecao.querySelector('img');
        if (pet.fotos?.[0]?.src) {
          foto.src = pet.fotos[0].src; foto.alt = pet.fotos[0].alt || `Foto de ${pet.nome}`; foto.hidden = false;
          foto.addEventListener('error', () => { foto.hidden = true; }, { once: true });
        }
        const resumo = selecao.querySelector('[data-pet-resumo]');
        resumo.textContent = [pet.especie, pet.raca, pet.idade].filter(Boolean).join(' · ');
      }
      botao.disabled = false;
    }).catch(erro => {
      if (selecao) selecao.querySelector('[data-pet-resumo]').textContent = 'Não foi possível selecionar este pet. Volte à página inicial para escolher outro.';
      mostrarStatus('erro', [erro.status === 404 ? 'Este pet não está cadastrado para visitas. Escolha um pet disponível no início.' : erro.message]);
    });
  } else if (selecao) {
    selecao.querySelector('[data-pet-resumo]').textContent = 'Selecione um animal na página inicial.';
    form.querySelector('button[type="submit"]').disabled = true;
    mostrarStatus('erro', ['Escolha um pet na página inicial para agendar uma visita.']);
  }
}

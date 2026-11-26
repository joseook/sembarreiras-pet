"""Validações compartilhadas pelas rotas de solicitação, confirmação e remarcação."""
import re
from datetime import datetime, timedelta, timezone

BRASILIA = timezone(timedelta(hours=-3))


def email_valido(email, limite=120):
    return isinstance(email, str) and len(email) <= limite and bool(
        re.fullmatch(r'[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[A-Za-z]{2,}', email))


def telefone_valido(telefone):
    return (isinstance(telefone, str) and len(telefone) <= 30
            and bool(re.fullmatch(r'[0-9()\s+\-]+', telefone))
            and 10 <= len(re.sub(r'\D', '', telefone)) <= 15)


JANELA_VISITA_DIAS = 90
SENHAS_COMUNS = {
    '12345678', '123456789', '1234567890', '87654321', '11111111', '00000000',
    'password', 'password1', 'senha123', 'senha1234', 'qwertyui', 'qwerty123',
    'abcdefgh', 'abc12345', 'iloveyou', 'sembarreiras', 'sembarreiraspet',
}


def problema_senha(senha):
    """Retorna a mensagem de erro da senha, ou None quando ela é aceitável."""
    if not isinstance(senha, str) or not 8 <= len(senha) <= 128:
        return 'Use uma senha de 8 a 128 caracteres.'
    if len(senha.strip()) < 8 or len(set(senha)) < 4 or senha.lower() in SENHAS_COMUNS:
        return 'Essa senha é fácil de adivinhar. Misture letras, números ou símbolos.'
    return None


def texto_significativo(texto):
    """Colapsa espaços repetidos para validar o tamanho real do conteúdo."""
    return ' '.join(texto.split())


def escapar_like(texto):
    """Faz % e _ da busca valerem como texto literal no LIKE/ILIKE."""
    return texto.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_')


def validar_visita(data_texto, horario, agora=None):
    if not isinstance(data_texto, str) or not isinstance(horario, str):
        raise ValueError('Data e horário devem ser textos válidos.')
    try:
        if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', data_texto) or not re.fullmatch(r'\d{2}:\d{2}', horario):
            raise ValueError()
        data = datetime.strptime(data_texto, '%Y-%m-%d').date()
        hora = datetime.strptime(horario, '%H:%M').time()
    except ValueError:
        raise ValueError('Confira a data e o horário informados.') from None
    if data.weekday() not in {1, 2, 3, 4, 5}:
        raise ValueError('O abrigo recebe visitas de terça a sábado.')
    if not '09:00' <= horario <= '15:00' or '12:00' <= horario < '13:00':
        raise ValueError('Escolha um horário entre 09:00 e 15:00, exceto de 12:00 a 13:00.')
    agora = agora or datetime.now(BRASILIA)
    if datetime.combine(data, hora, tzinfo=BRASILIA) <= agora:
        raise ValueError('Escolha uma data e horário futuros (horário de Brasília).')
    if data > agora.date() + timedelta(days=JANELA_VISITA_DIAS):
        raise ValueError(f'Escolha uma data nos próximos {JANELA_VISITA_DIAS} dias.')
    return data

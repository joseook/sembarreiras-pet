"""Validações compartilhadas pelas rotas de solicitação, confirmação e remarcação."""
import re
from datetime import datetime, timedelta, timezone

BRASILIA = timezone(timedelta(hours=-3))


def email_valido(email, limite=120):
    return isinstance(email, str) and len(email) <= limite and bool(
        re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', email))


def telefone_valido(telefone):
    return (isinstance(telefone, str) and len(telefone) <= 30
            and bool(re.fullmatch(r'[0-9()\s+\-]+', telefone))
            and 10 <= len(re.sub(r'\D', '', telefone)) <= 15)


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
    # Os horários da interface são sugestões. A faixa válida segue o atendimento.
    if not '09:00' <= horario <= '15:00' or '12:00' <= horario < '13:00':
        raise ValueError('Escolha um horário entre 09:00 e 15:00, exceto de 12:00 a 13:00.')
    if datetime.combine(data, hora, tzinfo=BRASILIA) <= (agora or datetime.now(BRASILIA)):
        raise ValueError('Escolha uma data e horário futuros (horário de Brasília).')
    return data

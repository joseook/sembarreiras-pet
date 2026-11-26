import smtplib
import ssl
from email.message import EmailMessage
from urllib.parse import quote, urlsplit

from flask import current_app
from itsdangerous import URLSafeTimedSerializer

from seguranca import chave_limite


def serializador():
    return URLSafeTimedSerializer(current_app.secret_key, salt='recuperacao-senha-v1')


def versao_senha(usuario):
    return chave_limite(f'recuperacao:{usuario.id}:{usuario.senha_hash}')


def email_configurado():
    config = current_app.config
    origem = urlsplit(config.get('SB_PUBLIC_URL') or '')
    return (
        origem.scheme == 'https' and origem.hostname and not origem.username
        and not origem.password and origem.path in ('', '/')
        and not origem.query and not origem.fragment
        and all(config.get(chave) for chave in ('SMTP_HOST', 'SMTP_FROM'))
        and bool(config.get('SMTP_USER')) == bool(config.get('SMTP_PASSWORD'))
    )


def enviar_recuperacao(usuario):
    config = current_app.config
    token = serializador().dumps([usuario.id, versao_senha(usuario)])
    base = config['SB_PUBLIC_URL'].rstrip('/')
    link = f'{base}/pages/esqueci-senha.html#{quote(token, safe="")}'
    mensagem = EmailMessage()
    mensagem['Subject'] = 'Redefina sua senha | Sem Barreiras Pet'
    mensagem['From'] = config['SMTP_FROM']
    mensagem['To'] = usuario.email
    mensagem.set_content(
        f'Use o link abaixo para redefinir sua senha em até 30 minutos.\n\n{link}\n\n'
        'Se você não pediu a redefinição, ignore este e-mail.'
    )
    with smtplib.SMTP(config['SMTP_HOST'], 587, timeout=6) as cliente:
        cliente.starttls(context=ssl.create_default_context())
        if config.get('SMTP_USER'):
            cliente.login(config['SMTP_USER'], config['SMTP_PASSWORD'])
        cliente.send_message(mensagem)

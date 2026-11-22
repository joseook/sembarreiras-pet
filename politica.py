"""Texto de funcionamento do serviço, sem prometer recursos inexistentes."""
from datetime import date
from database import db
from models import PoliticaPrivacidade, SecaoPrivacidade

VERSAO = '2026.11'
SECOES = [
    ('1. Dados cadastrados', 'O cadastro registra nome, e-mail, telefone, tipo de moradia, consentimento e senha protegida por hash. As visitas registram pet, data, horário, mensagem e status. O contato registra nome, e-mail, assunto e mensagem. Use dados fictícios enquanto o projeto estiver em demonstração.'),
    ('2. Uso dos dados', 'Os dados permitem autenticar a conta, organizar visitas e atender mensagens. Gerentes autorizados consultam solicitações e contatos para realizar o atendimento. Não há pagamento ou adoção automática pelo site.'),
    ('3. Sessões e acesso', 'O site usa cookie de sessão e um registro de sessão revogável no servidor, com duração máxima de oito horas. Sair encerra a sessão atual. A proteção contra excesso de tentativas guarda identificadores protegidos por HMAC, sem registrar a senha digitada.'),
    ('4. Acompanhamento e mensagens', 'O status das visitas pode ser consultado em Minhas visitas. Confirmações, cancelamentos e remarcações aparecem no sistema ao atualizar a página. Não há envio automático de e-mail, SMS ou WhatsApp. O contato gera protocolo e fica disponível à gerência; o site não promete prazo de resposta.'),
    ('5. Solicitações sobre seus dados', 'Para pedir correção ou exclusão de dados, envie uma mensagem em Contato. A equipe precisa verificar a identidade e tratar a solicitação. Não existe exclusão automática pelo perfil nem recuperação automática de senha nesta versão.'),
    ('6. Serviços externos e atualizações', 'A hospedagem e o banco processam os dados necessários ao funcionamento do serviço. Quando habilitado, o Google Maps conecta o navegador ao Google; algumas imagens da página Quem somos usam serviço externo. Esta página descreve a versão atual e deve ser consultada novamente após atualizações. Não há notificação automática por e-mail sobre mudanças.'),
]


def politica_atual():
    return {'versao': VERSAO, 'ultima_atualizacao': '2026-11-17', 'ativo': True,
            'secoes': [{'ordem': i, 'titulo': titulo, 'conteudo': conteudo}
                       for i, (titulo, conteudo) in enumerate(SECOES, 1)]}


def publicar_politica():
    """Acrescenta a versão atual; preserva todas as políticas e edições anteriores."""
    if PoliticaPrivacidade.query.filter_by(versao=VERSAO).first():
        return
    politica = PoliticaPrivacidade(versao=VERSAO, ultima_atualizacao=date(2026, 11, 17), ativo=True)
    db.session.add(politica)
    db.session.flush()
    db.session.add_all([SecaoPrivacidade(politica_id=politica.id, ordem=i,
        titulo=titulo, conteudo=conteudo) for i, (titulo, conteudo) in enumerate(SECOES, 1)])
    db.session.commit()

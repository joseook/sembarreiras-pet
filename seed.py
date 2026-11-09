"""Cria tabelas e exemplos ausentes, preservando os dados existentes."""
import json
import secrets
from pathlib import Path
from sqlalchemy.exc import SQLAlchemyError
from database import db
from models import PoliticaPrivacidade, SecaoPrivacidade, Usuario, Pet

ARQUIVO_PETS = Path(__file__).parent / 'assets' / 'js' / 'data' / 'pets.json'
CAMPOS_PET = (
    'id', 'nome', 'especie', 'sexo', 'raca', 'idade', 'porte', 'peso', 'cor',
    'castrado', 'microchip', 'resumo', 'historia', 'rotina', 'apartamento',
    'temperamento', 'vacinas', 'exames', 'vermifugo', 'antiparasitario', 'alergias',
)

# Textos iniciais; a política já cadastrada não é sobrescrita.
SECOES_PRIVACIDADE = [
    (
        '1. Informações que Coletamos',
        'O cadastro registra nome, e-mail, telefone, tipo de moradia e consentimento. Visitas registram usuário, pet quando escolhido, data, horário e mensagem. O contato registra nome, e-mail, assunto e mensagem.',
    ),
    (
        '2. Como Usamos as Suas Informações',
        'Os dados permitem acessar a conta, registrar solicitações de visita e mensagens de contato. O registro de uma visita não confirma a adoção.',
    ),
    (
        '3. Compartilhamento e Privacidade dos Dados',
        'Os dados são armazenados no banco configurado pela equipe. Serviços de hospedagem podem processar informações técnicas de acesso conforme suas condições. Não há notificações por e-mail ou painel da ONG nesta versão.',
    ),
    (
        '4. Segurança das Informações',
        'Senhas são armazenadas como hash e o acesso utiliza cookie de sessão. Os formulários dependem do serviço; falhas de conexão não criam contas locais nem salvam senhas no navegador.',
    ),
    (
        '5. Seus Direitos e Controle',
        'Use a página de contato para falar com a equipe sobre seus dados. Edição e exclusão por autoatendimento ainda não estão disponíveis. Responsáveis, retenção e procedimentos precisam ser definidos antes de uso público com dados reais.',
    ),
    (
        '6. Alterações nesta Política',
        'Estas informações descrevem a implementação atual e devem ser revistas pela equipe quando o funcionamento mudar. Para testar, utilize dados fictícios.',
    ),
]


def criar_politica():
    if PoliticaPrivacidade.query.first():
        return
    politica = PoliticaPrivacidade()
    db.session.add(politica)
    db.session.flush()
    for ordem, (titulo, conteudo) in enumerate(SECOES_PRIVACIDADE, start=1):
        db.session.add(SecaoPrivacidade(
            politica_id=politica.id, ordem=ordem, titulo=titulo, conteudo=conteudo,
        ))


def criar_pets():
    exemplos = json.loads(ARQUIVO_PETS.read_text(encoding='utf-8'))
    for exemplo in exemplos:
        if db.session.get(Pet, exemplo['id']):
            continue
        dados = {campo: exemplo[campo] for campo in CAMPOS_PET}
        dados['doencas_passadas'] = exemplo['doencasPassadas']
        dados['doencas_atuais'] = exemplo['doencasAtuais']
        db.session.add(Pet(**dados))


def revogar_senha_de_teste():
    usuario = Usuario.query.filter_by(email='admin@sembarreiras.pet').first()
    if usuario and usuario.check_senha('senha1234'):
        usuario.set_senha(secrets.token_urlsafe(48))


def inicializar_banco(app):
    with app.app_context():
        try:
            db.create_all()
            criar_politica()
            criar_pets()
            revogar_senha_de_teste()
            db.session.commit()
            return True
        except SQLAlchemyError:
            db.session.rollback()
            app.logger.error('Não foi possível inicializar o banco. Confira a configuração.')
            return False


if __name__ == '__main__':
    from app import app
    inicializar_banco(app)

from datetime import date
from flask import Flask
from config import Config
from database import db
from models import PoliticaPrivacidade, SecaoPrivacidade, Usuario, Pet

def inicializar_banco(app: Flask):
    with app.app_context():
        print(f"[*] Conectando ao banco em: {app.config['SQLALCHEMY_DATABASE_URI']}")
        
        try:
            db.create_all()
            print("[+] Tabelas criadas com sucesso (db.create_all)!")
        except Exception as e:
            print(f"[-] Erro ao conectar/criar tabelas no banco de dados: {e}")
            print("[!] Dica: Verifique se o PostgreSQL está em execução e se o banco 'sembarreiras_db' foi criado.")
            return False

        # 1. Popula Política de Privacidade se não existir
        if not PoliticaPrivacidade.query.first():
            print("[*] Inserindo Política de Privacidade e seções...")
            politica = PoliticaPrivacidade(versao='1.0', ultima_atualizacao=date.today(), ativo=True)
            db.session.add(politica)
            db.session.flush()

            secoes = [
                SecaoPrivacidade(
                    politica_id=politica.id,
                    ordem=1,
                    titulo='1. Informações que Coletamos',
                    conteudo='Quando você se cadastra na Sem Barreiras Pet, coletamos dados essenciais como seu nome completo, e-mail, telefone de contato e o tipo de moradia (casa ou apartamento). Também podemos registrar informações de navegação e preferências para personalizar sua experiência e recomendar os pets que melhor se adaptam à sua rotina.'
                ),
                SecaoPrivacidade(
                    politica_id=politica.id,
                    ordem=2,
                    titulo='2. Como Usamos as Suas Informações',
                    conteudo='Seus dados são utilizados exclusivamente para facilitar e tornar seguro o processo de adoção. Com eles, criamos o seu perfil de adotante, conectamos você aos animais ideais para o seu estilo de vida e garantimos um canal de comunicação direto e transparente entre você e as ONGs, abrigos ou protetores parceiros.'
                ),
                SecaoPrivacidade(
                    politica_id=politica.id,
                    ordem=3,
                    titulo='3. Compartilhamento e Privacidade dos Dados',
                    conteudo='A Sem Barreiras Pet tem um compromisso rigoroso com a sua privacidade: não vendemos nem alugamos suas informações pessoais a terceiros. Seus dados de contato apenas são compartilhados com os protetores responsáveis no exato momento em que você demonstra interesse oficial em adotar um pet específico, visando dar andamento ao processo legal de adoção.'
                ),
                SecaoPrivacidade(
                    politica_id=politica.id,
                    ordem=4,
                    titulo='4. Segurança das Informações',
                    conteudo='Implementamos medidas rigorosas de segurança técnica e organizacional para proteger seus dados contra acessos não autorizados, alterações ou divulgações. Nosso sistema utiliza as melhores práticas do mercado, incluindo a criptografia das suas senhas, para garantir que o seu ambiente de adoção seja um local seguro.'
                ),
                SecaoPrivacidade(
                    politica_id=politica.id,
                    ordem=5,
                    titulo='5. Seus Direitos e Controle',
                    conteudo='Você tem o controle total sobre os seus dados na nossa plataforma. A qualquer momento, através do seu perfil, você pode solicitar a visualização, a atualização, a correção ou até mesmo a exclusão permanente da sua conta e de todas as suas informações pessoais do nosso banco de dados.'
                ),
                SecaoPrivacidade(
                    politica_id=politica.id,
                    ordem=6,
                    titulo='6. Alterações nesta Política',
                    conteudo='Reservamos o direito de atualizar esta Política de Privacidade periodicamente para refletir melhorias contínuas nos nossos serviços ou novas exigências legais. Sempre que houver uma alteração significativa, notificaremos você através do e-mail cadastrado ou por um aviso em destaque na nossa plataforma.'
                )
            ]
            db.session.add_all(secoes)
            print("[+] Política de privacidade populada com sucesso!")
        else:
            print("[i] Política de privacidade já existente.")

        # 2. Popula Pet padrão (Nina) se não existir
        if not Pet.query.filter_by(id='nina').first():
            print("[*] Inserindo pet demonstrativo padrão (Nina)...")
            nina = Pet(
                id='nina',
                nome='Nina',
                especie='Cachorro',
                sexo='Fêmea',
                raca='Cocker Spaniel',
                idade='2 anos',
                porte='Médio',
                peso='11 kg',
                cor='Caramelo',
                castrado=True,
                microchip=True,
                resumo='Calma, adora carinho e já é acostumada com crianças.',
                apartamento='Sim, desde que passeie todo dia',
                temperamento=['Gentil', 'Carinhosa', 'Sociável', 'Dócil'],
                historia=(
                    'Nina foi encontrada com cerca de 1 ano, sozinha, perto de uma feira. Está no abrigo há 9 meses, '
                    'já aprendeu comandos básicos (senta, fica e vem) e anda bem na guia. Gosta de colo e de ficar perto das pessoas.'
                ),
                rotina='Dois passeios curtos por dia e brincadeiras com bolinha. Estranha barulhos altos (fogos), então precisa de um cantinho tranquilo.',
                vacinas=[
                    {'nome': 'V10 (polivalente)', 'aplicada': '2026-03-12', 'proxima': '2027-03-12', 'status': 'em-dia'},
                    {'nome': 'Antirrábica', 'aplicada': '2026-03-12', 'proxima': '2027-03-12', 'status': 'em-dia'},
                    {'nome': 'Gripe canina (tosse dos canis)', 'aplicada': '2026-03-26', 'proxima': '2027-03-26', 'status': 'em-dia'},
                    {'nome': 'Leishmaniose', 'aplicada': None, 'proxima': '2026-11-05', 'status': 'pendente'}
                ],
                vermifugo='Último vermífugo em 02/09/2026 (a cada 3 meses).',
                antiparasitario='Antipulgas e carrapatos em dia, aplicado em 20/09/2026.',
                doencas_passadas=[
                    {'nome': 'Otite no ouvido esquerdo', 'quando': 'Janeiro de 2026', 'situacao': 'Curada com tratamento de 10 dias.'},
                    {'nome': 'Sarna leve (ácaros)', 'quando': 'Dezembro de 2025', 'situacao': 'Curada. Chegou ao abrigo com a pele irritada.'}
                ],
                doencas_atuais=[],
                alergias='Nenhuma conhecida.',
                exames=[
                    {'nome': 'Hemograma completo', 'data': '2026-03-12', 'resultado': 'Normal.'},
                    {'nome': 'Sorologia para Leishmaniose', 'data': '2026-03-12', 'resultado': 'Negativo.'}
                ],
                status='disponivel'
            )
            db.session.add(nina)
            print("[+] Pet Nina inserido com sucesso!")
        else:
            print("[i] Pet Nina já cadastrado.")

        # 3. Cria um usuário de demonstração se não existir
        if not Usuario.query.filter_by(email='admin@sembarreiras.pet').first():
            print("[*] Criando usuário de demonstração/teste...")
            usuario_demo = Usuario(
                nome='Adotante Teste',
                email='admin@sembarreiras.pet',
                telefone='(11) 98765-4321',
                tipo_moradia='casa',
                consentimento=True
            )
            usuario_demo.set_senha('senha1234')
            db.session.add(usuario_demo)
            print("[+] Usuário demonstrativo criado: admin@sembarreiras.pet (senha: senha1234)")
        else:
            print("[i] Usuário demonstrativo já existente.")

        db.session.commit()
        print("\n=== Banco inicializado e semeado com sucesso! ===")
        return True

if __name__ == '__main__':
    from app import create_app
    app = create_app()
    inicializar_banco(app)

"""Script de inicialização do banco de dados PostgreSQL para o Sem Barreiras Pet."""
from app import app
from database import db
from models import PoliticaPrivacidade, SecaoPrivacidade, Usuario, Pet, Agendamento

def inicializar_banco():
    with app.app_context():
        print("A conectar ao PostgreSQL e a criar as tabelas...")
        try:
            # Cria todas as tabelas mapeadas pelos modelos SQLAlchemy
            db.create_all()
            print("Tabelas criadas/verificadas com sucesso!")

            # Insere dados iniciais na Política de Privacidade se a tabela estiver vazia
            if not PoliticaPrivacidade.query.first():
                print("A inserir dados iniciais da Política de Privacidade...")
                politica = PoliticaPrivacidade(versao="1.0", ativo=True)
                db.session.add(politica)
                db.session.flush()  # Gera o id da política para vincular às seções

                secao1 = SecaoPrivacidade(
                    politica_id=politica.id,
                    ordem=1,
                    titulo="Informações que Coletamos",
                    conteudo="A Sem Barreiras Pet coleta informações pessoais que você nos fornece voluntariamente ao se cadastrar em nossos serviços, como nome e e-mail."
                )
                secao2 = SecaoPrivacidade(
                    politica_id=politica.id,
                    ordem=2,
                    titulo="Como Usamos Suas Informações",
                    conteudo="Utilizamos os dados coletados para melhorar sua experiência, garantir a segurança do sistema e personalizar as sugestões de adoção."
                )
                db.session.add_all([secao1, secao2])
                db.session.commit()
                print("Dados da Política de Privacidade inseridos com sucesso!")
            else:
                print("A Política de Privacidade já possui dados cadastrados.")

        except Exception as e:
            db.session.rollback()
            print(f"Erro ao inicializar o banco de dados: {e}")

if __name__ == '__main__':
    inicializar_banco()
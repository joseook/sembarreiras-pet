import psycopg2

SENHA = 'postgres'

print("Conectando ao banco de dados para atualizar os textos...")
conexao = psycopg2.connect(dbname="sembarreiras_db", user="postgres", password=SENHA, host="localhost", port="5432")
cursor = conexao.cursor()

cursor.execute("SELECT id FROM politica_privacidade LIMIT 1;")
id_politica = cursor.fetchone()[0]

cursor.execute("DELETE FROM secoes_privacidade;")

novas_secoes = [
    (id_politica, 1, '1. Informações que Coletamos', 'Quando você se cadastra na Sem Barreiras Pet, coletamos dados essenciais como seu nome completo, e-mail, telefone de contato e o tipo de moradia (casa ou apartamento). Também podemos registrar informações de navegação e preferências para personalizar sua experiência e recomendar os pets que melhor se adaptam à sua rotina.'),
    (id_politica, 2, '2. Como Usamos as Suas Informações', 'Seus dados são utilizados exclusivamente para facilitar e tornar seguro o processo de adoção. Com eles, criamos o seu perfil de adotante, conectamos você aos animais ideais para o seu estilo de vida e garantimos um canal de comunicação direto e transparente entre você e as ONGs, abrigos ou protetores parceiros.'),
    (id_politica, 3, '3. Compartilhamento e Privacidade dos Dados', 'A Sem Barreiras Pet tem um compromisso rigoroso com a sua privacidade: não vendemos nem alugamos suas informações pessoais a terceiros. Seus dados de contato apenas são compartilhados com os protetores responsáveis no exato momento em que você demonstra interesse oficial em adotar um pet específico, visando dar andamento ao processo legal de adoção.'),
    (id_politica, 4, '4. Segurança das Informações', 'Implementamos medidas rigorosas de segurança técnica e organizacional para proteger seus dados contra acessos não autorizados, alterações ou divulgações. Nosso sistema utiliza as melhores práticas do mercado, incluindo a criptografia das suas senhas, para garantir que o seu ambiente de adoção seja um local seguro.'),
    (id_politica, 5, '5. Seus Direitos e Controle', 'Você tem o controle total sobre os seus dados na nossa plataforma. A qualquer momento, através do seu perfil, você pode solicitar a visualização, a atualização, a correção ou até mesmo a exclusão permanente da sua conta e de todas as suas informações pessoais do nosso banco de dados.'),
    (id_politica, 6, '6. Alterações nesta Política', 'Reservamos o direito de atualizar esta Política de Privacidade periodicamente para refletir melhorias contínuas nos nossos serviços ou novas exigências legais. Sempre que houver uma alteração significativa, notificaremos você através do e-mail cadastrado ou por um aviso em destaque na nossa plataforma.')
]

cursor.executemany("""
    INSERT INTO secoes_privacidade (politica_id, ordem, titulo, conteudo) 
    VALUES (%s, %s, %s, %s)
""", novas_secoes)

conexao.commit()
cursor.close()
conexao.close()

print("Textos atualizados com sucesso para a versão brasileira!")
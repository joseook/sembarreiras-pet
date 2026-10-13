from flask import Flask, render_template
import psycopg2
from psycopg2.extras import RealDictCursor

app = Flask(__name__, template_folder='.')

DB_CONFIG = {
    'dbname': 'sembarreiras_db',
    'user': 'postgres',
    'password': 'postgres',
    'host': 'localhost',
    'port': '5432'
}

def get_db_connection():
    return psycopg2.connect(**DB_CONFIG, cursor_factory=RealDictCursor)

@app.route('/privacidade')
def politica_privacidade():
    conn = get_db_connection()
    cur = conn.cursor()
    
    cur.execute("SELECT id, versao, ultima_atualizacao FROM politica_privacidade WHERE ativo = TRUE LIMIT 1;")
    politica = cur.fetchone()
    
    secoes = []
    if politica:
        cur.execute("""
            SELECT titulo, conteudo 
            FROM secoes_privacidade 
            WHERE politica_id = %s 
            ORDER BY ordem ASC;
        """, (politica['id'],))
        secoes = cur.fetchall()
        
    cur.close()
    conn.close()
    
    return render_template('privacidade.html', politica=politica, secoes=secoes)

if __name__ == '__main__':
    app.run(debug=True)
"""Servidor local opcional para o mesmo site estático publicado no GitHub Pages."""
from pathlib import Path
from flask import Flask, send_from_directory

ROOT = Path(__file__).resolve().parent
app = Flask(__name__, static_folder=None)

@app.route('/')
def home():
    return send_from_directory(ROOT, 'index.html')

@app.route('/privacidade')
def politica_privacidade():
    return send_from_directory(ROOT, 'privacidade.html')

@app.route('/<path:filename>')
def arquivo_publico(filename):
    # Exponha somente os arquivos que fazem parte do site.
    path = Path(filename)
    if path.parts[0] in {'assets', 'pages'} or filename in {'config.js', 'privacidade.html', 'index.html'}:
        return send_from_directory(ROOT, filename)
    from flask import abort
    abort(404)

if __name__ == '__main__':
    app.run()

"""Blueprint raiz da API REST (prefixo /api).

Cada recurso tem seu próprio blueprint, registrado aqui.
"""

from flask import Blueprint

from .health import bp as health_bp
from .shelters import bp as shelters_bp
from .visits import bp as visits_bp

api_bp = Blueprint("api", __name__, url_prefix="/api")
api_bp.register_blueprint(health_bp)
api_bp.register_blueprint(shelters_bp)
api_bp.register_blueprint(visits_bp)

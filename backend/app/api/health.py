"""GET /api/health — verificação de saúde da API e do banco."""

import logging

from flask import Blueprint, jsonify
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from ..extensions import db

bp = Blueprint("health", __name__)
logger = logging.getLogger(__name__)


@bp.get("/health")
def health():
    try:
        db.session.execute(text("SELECT 1"))
        database = "ok"
    except SQLAlchemyError:
        logger.exception("Banco de dados indisponível no health check")
        db.session.rollback()
        database = "unavailable"

    healthy = database == "ok"
    body = {
        "status": "ok" if healthy else "degraded",
        "service": "sembarreiras-pet-api",
        "database": database,
    }
    return jsonify(body), 200 if healthy else 503

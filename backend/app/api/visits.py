"""Visitas: POST /api/visits e GET /api/visits/<id>.

ATENÇÃO — sem autenticação nesta fase:
o ``user_id`` vem no corpo da requisição. Isso só é aceito quando
``ALLOW_DEMO_USER_ID`` está ativo (desenvolvimento e testes). Em produção
os endpoints respondem 501 até a autenticação ser implementada; então o
usuário passará a vir da sessão/token, nunca do corpo.
"""

from flask import Blueprint, current_app, jsonify, request, url_for

from ..schemas.visit import validate_visit_payload
from ..services import scheduling_service
from ..utils.errors import APIError

bp = Blueprint("visits", __name__, url_prefix="/visits")


@bp.before_request
def require_demo_mode():
    if not current_app.config["ALLOW_DEMO_USER_ID"]:
        raise APIError(
            "Agendamento indisponível: a autenticação ainda não foi implementada neste ambiente.",
            status_code=501,
            code="auth_not_implemented",
        )


@bp.post("")
def create_visit():
    payload = request.get_json(silent=True)
    if payload is None:
        raise APIError("Envie um corpo JSON válido com o cabeçalho Content-Type: application/json.",
                       code="invalid_json")

    visit_request = validate_visit_payload(
        payload,
        default_tz=current_app.config["APP_TIMEZONE"],
        max_days_ahead=current_app.config["VISIT_MAX_DAYS_AHEAD"],
    )
    visit = scheduling_service.create_visit(visit_request)

    response = jsonify({"data": visit.to_dict()})
    response.status_code = 201
    response.headers["Location"] = url_for("api.visits.get_visit", visit_id=visit.id)
    return response


@bp.get("/<int:visit_id>")
def get_visit(visit_id: int):
    visit = scheduling_service.get_visit(visit_id)
    return jsonify({"data": visit.to_dict()})

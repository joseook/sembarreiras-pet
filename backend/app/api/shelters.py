"""Abrigos: GET /api/shelters e GET /api/shelters/<id>."""

from flask import Blueprint, jsonify

from ..extensions import db
from ..models import Shelter
from ..utils.errors import NotFoundError

bp = Blueprint("shelters", __name__, url_prefix="/shelters")


@bp.get("")
def list_shelters():
    """Lista apenas abrigos ativos, em ordem alfabética."""
    shelters = db.session.scalars(
        db.select(Shelter).where(Shelter.is_active.is_(True)).order_by(Shelter.name)
    ).all()
    return jsonify({"data": [shelter.to_dict() for shelter in shelters],
                    "meta": {"total": len(shelters)}})


@bp.get("/<int:shelter_id>")
def get_shelter(shelter_id: int):
    shelter = db.session.get(Shelter, shelter_id)
    if shelter is None or not shelter.is_active:
        raise NotFoundError("Abrigo não encontrado.")
    return jsonify({"data": shelter.to_dict()})

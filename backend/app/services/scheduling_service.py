"""Regras de negócio do agendamento de visitas.

Nesta fase o serviço só garante a integridade do pedido:
- usuário existe;
- abrigo existe e está ativo;
- se houver pet, ele pertence ao abrigo e ainda pode receber visitas;
- toda visita nasce com status "solicitado" (a ONG confirma depois).

Evolução futura (documentada em docs/architecture.md): agenda de
disponibilidade do abrigo, limite de visitas por horário, conflito de
horários, notificações e confirmação/cancelamento pela ONG.
"""

from ..extensions import db
from ..models import Pet, Shelter, User, Visit, VisitStatus
from ..schemas.visit import VisitRequest
from ..utils.errors import NotFoundError, ValidationError


def create_visit(request: VisitRequest) -> Visit:
    errors: dict[str, str] = {}

    if db.session.get(User, request.user_id) is None:
        errors["user_id"] = "Usuário não encontrado."

    shelter = db.session.get(Shelter, request.shelter_id)
    if shelter is None or not shelter.is_active:
        errors["shelter_id"] = "Abrigo não encontrado ou indisponível."

    if request.pet_id is not None:
        pet = db.session.get(Pet, request.pet_id)
        if pet is None or pet.shelter_id != request.shelter_id:
            errors["pet_id"] = "Pet não encontrado neste abrigo."
        elif not pet.accepts_visits:
            errors["pet_id"] = "Este pet não está disponível para visitas."

    if errors:
        raise ValidationError(errors)

    visit = Visit(
        user_id=request.user_id,
        shelter_id=request.shelter_id,
        pet_id=request.pet_id,
        scheduled_at=request.scheduled_at,
        adopter_notes=request.adopter_notes,
        status=VisitStatus.SOLICITADO,
    )
    db.session.add(visit)
    db.session.commit()
    return visit


def get_visit(visit_id: int) -> Visit:
    visit = db.session.get(Visit, visit_id)
    if visit is None:
        raise NotFoundError("Solicitação de visita não encontrada.")
    return visit

"""Validação do payload de solicitação de visita.

Validação manual (sem Marshmallow): são poucos campos e as mensagens
precisam estar em português, prontas para exibição no formulário.
Esta camada só verifica formato e regras de data; a existência de
usuário/abrigo/pet é verificada no serviço.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from ..utils.errors import ValidationError

NOTES_MAX_LENGTH = 1000


@dataclass(frozen=True)
class VisitRequest:
    user_id: int
    shelter_id: int
    pet_id: int | None
    scheduled_at: datetime  # sempre em UTC
    adopter_notes: str | None


def _positive_int(value, *, required: bool) -> tuple[int | None, str | None]:
    if value is None or value == "":
        return None, ("Campo obrigatório." if required else None)
    # bool é subclasse de int em Python: True não deve virar id 1.
    if isinstance(value, bool):
        return None, "Informe um número inteiro."
    if isinstance(value, str) and value.strip().isdigit():
        value = int(value.strip())
    if not isinstance(value, int):
        return None, "Informe um número inteiro."
    if value <= 0:
        return None, "Informe um número inteiro positivo."
    return value, None


def parse_scheduled_at(value, *, default_tz: str) -> datetime:
    """Converte ISO 8601 em datetime UTC. Sem offset, assume ``default_tz``."""
    if not isinstance(value, str) or not value.strip():
        raise ValueError("Campo obrigatório.")
    try:
        parsed = datetime.fromisoformat(value.strip())
    except ValueError:
        raise ValueError("Use o formato de data e hora ISO 8601, ex.: 2026-05-20T14:00:00-03:00.") from None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=ZoneInfo(default_tz))
    return parsed.astimezone(timezone.utc)


def validate_visit_payload(payload, *, default_tz: str, max_days_ahead: int,
                           now: datetime | None = None) -> VisitRequest:
    """Valida o corpo de ``POST /api/visits``. Lança ``ValidationError`` (422)."""
    if not isinstance(payload, dict):
        raise ValidationError({"body": "Envie um objeto JSON."})

    now = now or datetime.now(timezone.utc)
    errors: dict[str, str] = {}

    user_id, error = _positive_int(payload.get("user_id"), required=True)
    if error:
        errors["user_id"] = error

    shelter_id, error = _positive_int(payload.get("shelter_id"), required=True)
    if error:
        errors["shelter_id"] = error

    pet_id, error = _positive_int(payload.get("pet_id"), required=False)
    if error:
        errors["pet_id"] = error

    scheduled_at = None
    try:
        scheduled_at = parse_scheduled_at(payload.get("scheduled_at"), default_tz=default_tz)
    except ValueError as exc:
        errors["scheduled_at"] = str(exc)
    else:
        if scheduled_at <= now:
            errors["scheduled_at"] = "Escolha uma data e horário no futuro."
        elif scheduled_at > now + timedelta(days=max_days_ahead):
            errors["scheduled_at"] = f"Escolha uma data em até {max_days_ahead} dias."

    notes = payload.get("adopter_notes")
    if notes is not None and not isinstance(notes, str):
        errors["adopter_notes"] = "A mensagem deve ser um texto."
    elif isinstance(notes, str):
        notes = notes.strip() or None
        if notes and len(notes) > NOTES_MAX_LENGTH:
            errors["adopter_notes"] = f"A mensagem pode ter no máximo {NOTES_MAX_LENGTH} caracteres."

    if errors:
        raise ValidationError(errors)

    return VisitRequest(
        user_id=user_id,
        shelter_id=shelter_id,
        pet_id=pet_id,
        scheduled_at=scheduled_at,
        adopter_notes=notes,
    )

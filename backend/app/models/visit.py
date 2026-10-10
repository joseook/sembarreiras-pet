"""Solicitação de visita a um abrigo (opcionalmente para conhecer um pet)."""

import enum
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..extensions import db
from .base import TimestampMixin, enum_type, isoformat_utc
from .pet import Pet


class VisitStatus(str, enum.Enum):
    """Ciclo de vida da visita. Toda visita nasce como SOLICITADO."""

    SOLICITADO = "solicitado"   # enviado pela pessoa adotante
    CONFIRMADO = "confirmado"   # aceito pela ONG
    CANCELADO = "cancelado"     # cancelado por qualquer uma das partes
    CONCLUIDO = "concluido"     # visita realizada

    @property
    def label(self) -> str:
        return {
            "solicitado": "Solicitado",
            "confirmado": "Confirmado",
            "cancelado": "Cancelado",
            "concluido": "Concluído",
        }[self.value]


class Visit(TimestampMixin, db.Model):
    __tablename__ = "visits"
    __table_args__ = (
        Index("ix_visits_shelter_scheduled", "shelter_id", "scheduled_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    shelter_id: Mapped[int] = mapped_column(
        ForeignKey("shelters.id", ondelete="RESTRICT"), nullable=False
    )
    # Opcional: a pessoa pode visitar o abrigo antes de escolher um pet.
    pet_id: Mapped[int | None] = mapped_column(
        ForeignKey("pets.id", ondelete="SET NULL"), nullable=True, index=True
    )
    # Sempre gravado em UTC (timestamptz no PostgreSQL).
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[VisitStatus] = mapped_column(
        enum_type(VisitStatus, "visit_status"),
        default=VisitStatus.SOLICITADO,
        server_default=VisitStatus.SOLICITADO.value,
        nullable=False,
    )
    adopter_notes: Mapped[str | None] = mapped_column(Text)
    shelter_notes: Mapped[str | None] = mapped_column(Text)

    user: Mapped["User"] = relationship(back_populates="visits")  # noqa: F821
    shelter: Mapped["Shelter"] = relationship(back_populates="visits")  # noqa: F821
    pet: Mapped[Pet | None] = relationship()

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "shelter_id": self.shelter_id,
            "pet_id": self.pet_id,
            "scheduled_at": isoformat_utc(self.scheduled_at),
            "status": self.status.value,
            "status_label": self.status.label,
            "adopter_notes": self.adopter_notes,
            "shelter_notes": self.shelter_notes,
            "shelter": {"id": self.shelter.id, "name": self.shelter.name} if self.shelter else None,
            "created_at": isoformat_utc(self.created_at),
            "updated_at": isoformat_utc(self.updated_at),
        }

    def __repr__(self) -> str:
        return f"<Visit {self.id} {self.status.value}>"

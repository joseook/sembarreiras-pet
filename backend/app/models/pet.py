"""Animal disponível (ou não) para adoção."""

import enum

from sqlalchemy import CheckConstraint, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..extensions import db
from .base import TimestampMixin, enum_type, isoformat_utc


class AdoptionStatus(str, enum.Enum):
    """Situação de adoção do pet. Valor gravado no banco (sem acentos) -> rótulo."""

    DISPONIVEL = "disponivel"
    RESERVADO = "reservado"
    ADOTADO = "adotado"
    INDISPONIVEL = "indisponivel"

    @property
    def label(self) -> str:
        return {
            "disponivel": "Disponível",
            "reservado": "Reservado",
            "adotado": "Adotado",
            "indisponivel": "Indisponível",
        }[self.value]


class Pet(TimestampMixin, db.Model):
    __tablename__ = "pets"
    __table_args__ = (
        CheckConstraint("length(trim(name)) > 0", name="name_not_blank"),
        Index("ix_pets_shelter_status", "shelter_id", "adoption_status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    shelter_id: Mapped[int] = mapped_column(
        ForeignKey("shelters.id", ondelete="RESTRICT"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    # Campos de catálogo em texto livre controlado pela ONG nesta fase.
    # Ex.: species "cao"/"gato"; size "pequeno"/"medio"/"grande";
    # age_group "filhote"/"adulto"/"idoso". Podem virar enums quando o
    # catálogo e os filtros forem implementados.
    species: Mapped[str] = mapped_column(String(30), nullable=False)
    breed: Mapped[str | None] = mapped_column(String(80))
    size: Mapped[str | None] = mapped_column(String(20))
    age_group: Mapped[str | None] = mapped_column(String(20))
    temperament: Mapped[str | None] = mapped_column(String(200))
    special_needs: Mapped[str | None] = mapped_column(Text)
    description: Mapped[str | None] = mapped_column(Text)
    adoption_status: Mapped[AdoptionStatus] = mapped_column(
        enum_type(AdoptionStatus, "adoption_status"),
        default=AdoptionStatus.DISPONIVEL,
        server_default=AdoptionStatus.DISPONIVEL.value,
        nullable=False,
    )

    shelter: Mapped["Shelter"] = relationship(back_populates="pets")  # noqa: F821

    @property
    def accepts_visits(self) -> bool:
        return self.adoption_status in (AdoptionStatus.DISPONIVEL, AdoptionStatus.RESERVADO)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "shelter_id": self.shelter_id,
            "name": self.name,
            "species": self.species,
            "breed": self.breed,
            "size": self.size,
            "age_group": self.age_group,
            "temperament": self.temperament,
            "special_needs": self.special_needs,
            "description": self.description,
            "adoption_status": self.adoption_status.value,
            "adoption_status_label": self.adoption_status.label,
            "updated_at": isoformat_utc(self.updated_at),
        }

    def __repr__(self) -> str:
        return f"<Pet {self.id} {self.name}>"

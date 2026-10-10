"""ONG ou abrigo responsável pelos animais."""

from sqlalchemy import Boolean, CheckConstraint, Double, Index, String, Text, true
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..extensions import db
from .base import TimestampMixin, isoformat_utc


class Shelter(TimestampMixin, db.Model):
    __tablename__ = "shelters"
    __table_args__ = (
        CheckConstraint("length(trim(name)) > 0", name="name_not_blank"),
        CheckConstraint("length(state) = 2", name="state_uf"),
        CheckConstraint("latitude IS NULL OR (latitude BETWEEN -90 AND 90)", name="latitude_range"),
        CheckConstraint("longitude IS NULL OR (longitude BETWEEN -180 AND 180)", name="longitude_range"),
        # Coordenadas vêm em par: ou as duas, ou nenhuma.
        CheckConstraint("(latitude IS NULL) = (longitude IS NULL)", name="coordinates_pair"),
        Index("ix_shelters_city_state", "city", "state"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    contact_phone: Mapped[str | None] = mapped_column(String(20))
    contact_email: Mapped[str | None] = mapped_column(String(254))

    address_line: Mapped[str] = mapped_column(String(200), nullable=False)
    neighborhood: Mapped[str | None] = mapped_column(String(100))
    city: Mapped[str] = mapped_column(String(100), nullable=False)
    state: Mapped[str] = mapped_column(String(2), nullable=False)  # UF, ex.: "AL"
    postal_code: Mapped[str | None] = mapped_column(String(9))  # "00000-000"

    # Graus decimais (WGS84). Precisão dupla é suficiente para mapas.
    latitude: Mapped[float | None] = mapped_column(Double)
    longitude: Mapped[float | None] = mapped_column(Double)

    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default=true(), nullable=False, index=True
    )

    pets: Mapped[list["Pet"]] = relationship(back_populates="shelter")  # noqa: F821
    visits: Mapped[list["Visit"]] = relationship(back_populates="shelter")  # noqa: F821

    @property
    def full_address(self) -> str:
        parts = [self.address_line, self.neighborhood, f"{self.city} - {self.state}", self.postal_code]
        return ", ".join(part for part in parts if part)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "contact_phone": self.contact_phone,
            "contact_email": self.contact_email,
            "address": {
                "line": self.address_line,
                "neighborhood": self.neighborhood,
                "city": self.city,
                "state": self.state,
                "postal_code": self.postal_code,
                "full": self.full_address,
            },
            "latitude": self.latitude,
            "longitude": self.longitude,
            "is_active": self.is_active,
            "updated_at": isoformat_utc(self.updated_at),
        }

    def __repr__(self) -> str:
        return f"<Shelter {self.id} {self.name}>"

"""Pessoa adotante."""

from sqlalchemy import CheckConstraint, String
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates
from werkzeug.security import check_password_hash, generate_password_hash

from ..extensions import db
from .base import TimestampMixin, isoformat_utc


class User(TimestampMixin, db.Model):
    """Conta de quem deseja adotar.

    A autenticação ainda não foi implementada; o modelo já guarda a senha
    apenas como hash (nunca em texto puro) para a próxima etapa.
    """

    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("length(trim(name)) > 0", name="name_not_blank"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    # Normalizado em minúsculas (ver validate_email) para garantir unicidade real.
    email: Mapped[str] = mapped_column(String(254), unique=True, nullable=False)
    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)

    visits: Mapped[list["Visit"]] = relationship(back_populates="user")  # noqa: F821

    @validates("email")
    def validate_email(self, _key: str, value: str) -> str:
        return value.strip().lower()

    def set_password(self, password: str) -> None:
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)

    def to_dict(self) -> dict:
        """Representação pública: nunca inclui password_hash."""
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "phone": self.phone,
            "created_at": isoformat_utc(self.created_at),
        }

    def __repr__(self) -> str:
        return f"<User {self.id} {self.email}>"

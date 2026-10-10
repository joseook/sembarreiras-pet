"""estrutura inicial: users, shelters, pets, visits

Enums (Pet.adoption_status, Visit.status) são gravados como VARCHAR + CHECK
(native_enum=False) para simplificar migrations futuras. Gerado por
autogenerate e revisado manualmente para PostgreSQL.

Revision ID: b24468677dc0
Revises: 
Create Date: 2026-10-10 19:53:39.036688

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b24468677dc0'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # ### gerado pelo Alembic e revisado manualmente (defaults portáveis para PostgreSQL) ###
    op.create_table('shelters',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=150), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('contact_phone', sa.String(length=20), nullable=True),
    sa.Column('contact_email', sa.String(length=254), nullable=True),
    sa.Column('address_line', sa.String(length=200), nullable=False),
    sa.Column('neighborhood', sa.String(length=100), nullable=True),
    sa.Column('city', sa.String(length=100), nullable=False),
    sa.Column('state', sa.String(length=2), nullable=False),
    sa.Column('postal_code', sa.String(length=9), nullable=True),
    sa.Column('latitude', sa.Double(), nullable=True),
    sa.Column('longitude', sa.Double(), nullable=True),
    sa.Column('is_active', sa.Boolean(), server_default=sa.true(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.CheckConstraint('(latitude IS NULL) = (longitude IS NULL)', name=op.f('ck_shelters_coordinates_pair')),
    sa.CheckConstraint('latitude IS NULL OR (latitude BETWEEN -90 AND 90)', name=op.f('ck_shelters_latitude_range')),
    sa.CheckConstraint('length(state) = 2', name=op.f('ck_shelters_state_uf')),
    sa.CheckConstraint('length(trim(name)) > 0', name=op.f('ck_shelters_name_not_blank')),
    sa.CheckConstraint('longitude IS NULL OR (longitude BETWEEN -180 AND 180)', name=op.f('ck_shelters_longitude_range')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_shelters'))
    )
    with op.batch_alter_table('shelters', schema=None) as batch_op:
        batch_op.create_index('ix_shelters_city_state', ['city', 'state'], unique=False)
        batch_op.create_index(batch_op.f('ix_shelters_is_active'), ['is_active'], unique=False)

    op.create_table('users',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=120), nullable=False),
    sa.Column('email', sa.String(length=254), nullable=False),
    sa.Column('phone', sa.String(length=20), nullable=False),
    sa.Column('password_hash', sa.String(length=255), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.CheckConstraint('length(trim(name)) > 0', name=op.f('ck_users_name_not_blank')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_users')),
    sa.UniqueConstraint('email', name=op.f('uq_users_email'))
    )
    op.create_table('pets',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('shelter_id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=80), nullable=False),
    sa.Column('species', sa.String(length=30), nullable=False),
    sa.Column('breed', sa.String(length=80), nullable=True),
    sa.Column('size', sa.String(length=20), nullable=True),
    sa.Column('age_group', sa.String(length=20), nullable=True),
    sa.Column('temperament', sa.String(length=200), nullable=True),
    sa.Column('special_needs', sa.Text(), nullable=True),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('adoption_status', sa.Enum('disponivel', 'reservado', 'adotado', 'indisponivel', name='adoption_status', native_enum=False, create_constraint=True, length=20), server_default='disponivel', nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.CheckConstraint('length(trim(name)) > 0', name=op.f('ck_pets_name_not_blank')),
    sa.ForeignKeyConstraint(['shelter_id'], ['shelters.id'], name=op.f('fk_pets_shelter_id_shelters'), ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_pets'))
    )
    with op.batch_alter_table('pets', schema=None) as batch_op:
        batch_op.create_index('ix_pets_shelter_status', ['shelter_id', 'adoption_status'], unique=False)

    op.create_table('visits',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('shelter_id', sa.Integer(), nullable=False),
    sa.Column('pet_id', sa.Integer(), nullable=True),
    sa.Column('scheduled_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('status', sa.Enum('solicitado', 'confirmado', 'cancelado', 'concluido', name='visit_status', native_enum=False, create_constraint=True, length=20), server_default='solicitado', nullable=False),
    sa.Column('adopter_notes', sa.Text(), nullable=True),
    sa.Column('shelter_notes', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.ForeignKeyConstraint(['pet_id'], ['pets.id'], name=op.f('fk_visits_pet_id_pets'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['shelter_id'], ['shelters.id'], name=op.f('fk_visits_shelter_id_shelters'), ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_visits_user_id_users'), ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_visits'))
    )
    with op.batch_alter_table('visits', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_visits_pet_id'), ['pet_id'], unique=False)
        batch_op.create_index('ix_visits_shelter_scheduled', ['shelter_id', 'scheduled_at'], unique=False)
        batch_op.create_index(batch_op.f('ix_visits_user_id'), ['user_id'], unique=False)

    # ### end Alembic commands ###


def downgrade():
    # ### gerado pelo Alembic e revisado manualmente (defaults portáveis para PostgreSQL) ###
    with op.batch_alter_table('visits', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_visits_user_id'))
        batch_op.drop_index('ix_visits_shelter_scheduled')
        batch_op.drop_index(batch_op.f('ix_visits_pet_id'))

    op.drop_table('visits')
    with op.batch_alter_table('pets', schema=None) as batch_op:
        batch_op.drop_index('ix_pets_shelter_status')

    op.drop_table('pets')
    op.drop_table('users')
    with op.batch_alter_table('shelters', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_shelters_is_active'))
        batch_op.drop_index('ix_shelters_city_state')

    op.drop_table('shelters')
    # ### end Alembic commands ###

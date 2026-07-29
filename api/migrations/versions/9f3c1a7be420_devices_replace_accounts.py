"""devices replace accounts; plants and waterings move to the device

Revision ID: 9f3c1a7be420
Revises: 5cb4d83162de
Create Date: 2026-07-29

The app became local-first: a phone keeps its own plants, waterings and photos,
and the API is now only a metered proxy for PlantNet and Perenual plus the shared
species cache. Accounts, tokens, plants and the watering log all leave the server.

This drops user data. That is intentional and was agreed pre-launch — the
downgrade recreates the tables but cannot recreate their contents.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "9f3c1a7be420"
down_revision: str | Sequence[str] | None = "5cb4d83162de"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "devices",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("quota_day", sa.String(length=10), nullable=True),
        sa.Column("quota_used", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_devices_token_hash"), "devices", ["token_hash"], unique=True)

    # Order matters: children before parents, since plants references both users
    # and species_cache.
    op.drop_table("watering_events")
    op.drop_table("plants")
    op.drop_table("auth_tokens")
    op.drop_table("users")


def downgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("timezone", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)

    op.create_table(
        "auth_tokens",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_auth_tokens_token_hash"), "auth_tokens", ["token_hash"], unique=True)

    op.create_table(
        "plants",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("nickname", sa.String(length=120), nullable=True),
        sa.Column("scientific_name", sa.String(length=255), nullable=False),
        sa.Column("common_name", sa.String(length=255), nullable=True),
        sa.Column("image_key", sa.String(length=255), nullable=True),
        sa.Column("interval_days", sa.Integer(), nullable=True),
        sa.Column("species_cache_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["species_cache_id"], ["species_cache.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_plants_user_id"), "plants", ["user_id"], unique=False)
    op.create_index(
        op.f("ix_plants_species_cache_id"), "plants", ["species_cache_id"], unique=False
    )

    op.create_table(
        "watering_events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("plant_id", sa.Integer(), nullable=False),
        sa.Column("watered_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_watering_events_plant_id"), "watering_events", ["plant_id"], unique=False
    )

    op.drop_index(op.f("ix_devices_token_hash"), table_name="devices")
    op.drop_table("devices")

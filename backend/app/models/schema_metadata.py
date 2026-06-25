from datetime import datetime

from sqlalchemy import DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SchemaMetadata(Base):
    __tablename__ = "schema_metadata"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    connection_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    database_name: Mapped[str] = mapped_column(String(255), nullable=False)
    db_type: Mapped[str] = mapped_column(String(32), nullable=False)
    table_count: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

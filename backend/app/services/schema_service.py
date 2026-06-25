from typing import Any

from sqlalchemy import inspect, text

from app.db.connection_manager import ConnectionState, connection_manager
from app.db.mongo import mongo_store
from app.schemas.schema import ColumnInfo, DashboardResponse, ForeignKeyInfo, SchemaResponse, TableInfo


def _quote_identifier(state: ConnectionState, name: str) -> str:
    preparer = state.engine.dialect.identifier_preparer
    return preparer.quote(name)


def _table_count_sql(state: ConnectionState, table_name: str) -> str:
    return f"SELECT COUNT(*) AS total FROM {_quote_identifier(state, table_name)}"


def fetch_schema(connection_id: str | None = None, *, include_counts: bool = False) -> SchemaResponse:
    cached = connection_manager.get_schema_cache(connection_id)
    if cached and not include_counts:
        return SchemaResponse(**cached)

    state = connection_manager.get(connection_id)
    inspector = inspect(state.engine)
    table_names = inspector.get_table_names()
    tables: list[TableInfo] = []

    with state.engine.connect() as connection:
        for table_name in table_names:
            pk = inspector.get_pk_constraint(table_name) or {}
            pk_columns = set(pk.get("constrained_columns") or [])
            foreign_keys = [
                ForeignKeyInfo(
                    column=(fk.get("constrained_columns") or [""])[0],
                    referred_table=fk.get("referred_table") or "",
                    referred_column=(fk.get("referred_columns") or [""])[0],
                )
                for fk in inspector.get_foreign_keys(table_name)
            ]
            fk_columns = {fk.column for fk in foreign_keys}

            columns = [
                ColumnInfo(
                    name=column["name"],
                    data_type=str(column["type"]),
                    nullable=bool(column.get("nullable", True)),
                    primary_key=column["name"] in pk_columns,
                    foreign_key=column["name"] in fk_columns,
                    default=str(column.get("default")) if column.get("default") is not None else None,
                )
                for column in inspector.get_columns(table_name)
            ]

            row_count = None
            if include_counts:
                try:
                    row_count = int(connection.execute(text(_table_count_sql(state, table_name))).scalar_one())
                except Exception:
                    row_count = None

            tables.append(
                TableInfo(
                    name=table_name,
                    columns=columns,
                    primary_keys=list(pk_columns),
                    foreign_keys=foreign_keys,
                    row_count=row_count,
                )
            )

    response = SchemaResponse(
        connection_id=str(state.connection_id),
        db_type=state.db_type.value,
        database=state.database,
        tables=tables,
    )
    cache_payload = response.model_dump()
    connection_manager.set_schema_cache(cache_payload, str(state.connection_id))
    mongo_store.save_schema_metadata(
        {
            "connection_id": str(state.connection_id),
            "database": state.database,
            "db_type": state.db_type.value,
            "schema": cache_payload,
        }
    )
    return response


def schema_for_prompt(connection_id: str | None = None) -> dict[str, Any]:
    schema = fetch_schema(connection_id)
    return {
        "db_type": schema.db_type,
        "database": schema.database,
        "tables": [
            {
                "name": table.name,
                "columns": [
                    {
                        "name": column.name,
                        "type": column.data_type,
                        "primary_key": column.primary_key,
                        "foreign_key": column.foreign_key,
                    }
                    for column in table.columns
                ],
                "primary_keys": table.primary_keys,
                "foreign_keys": [fk.model_dump() for fk in table.foreign_keys],
            }
            for table in schema.tables
        ],
    }


def dashboard_stats(connection_id: str | None = None, *, user_id: str | None = None) -> DashboardResponse:
    if not connection_manager.has_default() and connection_id is None:
        return DashboardResponse(connected=False)

    state = connection_manager.get(connection_id)
    schema = fetch_schema(str(state.connection_id), include_counts=True)
    total_rows = sum(table.row_count or 0 for table in schema.tables)
    largest = max(schema.tables, key=lambda table: table.row_count or 0, default=None)
    recent = mongo_store.list_history(limit=5, user_id=user_id)

    return DashboardResponse(
        connected=True,
        connection_id=str(state.connection_id),
        db_type=state.db_type.value,
        database=state.database,
        tables=len(schema.tables),
        rows=total_rows,
        largest_table={"name": largest.name, "rows": largest.row_count or 0} if largest else None,
        recent_queries=[
            {
                "id": str(item.get("_id")),
                "prompt": item.get("prompt"),
                "selected_query": item.get("selected_query"),
                "timestamp": item.get("timestamp"),
            }
            for item in recent
        ],
    )

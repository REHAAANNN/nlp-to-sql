from fastapi import APIRouter, Depends

from app.auth.dependencies import current_user
from app.schemas.query import (
    AnalyzeImpactRequest,
    AnalyzeImpactResponse,
    ExecuteQueryRequest,
    ExecuteQueryResponse,
    ExplainQueryRequest,
    ExplainQueryResponse,
    GenerateQueryRequest,
    GenerateQueryResponse,
)
from app.services.query_service import analyze_impact, execute_query, explain_query, generate_queries
from app.utils.exceptions import AppError


router = APIRouter(tags=["query"])


def _connection_id(user: dict, requested: str | None = None) -> str:
    connection_id = requested or user.get("active_database_id")
    if not connection_id:
        raise AppError("Select a database before generating or running queries", status_code=400)
    return str(connection_id)


@router.post("/generate-query", response_model=GenerateQueryResponse)
async def generate_query(
    payload: GenerateQueryRequest,
    user: dict = Depends(current_user),
) -> GenerateQueryResponse:
    return generate_queries(payload.prompt, _connection_id(user, payload.connection_id), user_id=str(user["_id"]))


@router.post("/explain-query", response_model=ExplainQueryResponse)
async def explain_query_route(
    payload: ExplainQueryRequest,
    user: dict = Depends(current_user),
) -> ExplainQueryResponse:
    return explain_query(payload.query, _connection_id(user, payload.connection_id))


@router.post("/analyze-impact", response_model=AnalyzeImpactResponse)
async def analyze_impact_route(
    payload: AnalyzeImpactRequest,
    user: dict = Depends(current_user),
) -> AnalyzeImpactResponse:
    return analyze_impact(payload.query, _connection_id(user, payload.connection_id))


@router.post("/execute-query", response_model=ExecuteQueryResponse)
async def execute_query_route(
    payload: ExecuteQueryRequest,
    user: dict = Depends(current_user),
) -> ExecuteQueryResponse:
    return execute_query(
        payload.query,
        _connection_id(user, payload.connection_id),
        confirm_destructive=payload.confirm_destructive,
    )

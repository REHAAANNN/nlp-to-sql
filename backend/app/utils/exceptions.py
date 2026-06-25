from fastapi import HTTPException, status


class AppError(Exception):
    status_code = status.HTTP_400_BAD_REQUEST
    message = "Application error"

    def __init__(self, message: str | None = None, status_code: int | None = None):
        self.message = message or self.message
        self.status_code = status_code or self.status_code
        super().__init__(self.message)


class ConnectionNotFoundError(AppError):
    status_code = status.HTTP_404_NOT_FOUND
    message = "No active database connection found"


class UnsafeQueryError(AppError):
    status_code = 422
    message = "Query failed safety validation"


class AIServiceError(AppError):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    message = "AI provider is unavailable"


def to_http_exception(error: AppError) -> HTTPException:
    return HTTPException(status_code=error.status_code, detail=error.message)

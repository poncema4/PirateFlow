"""
Global error handlers for consistent API error responses.

Every error response follows:
    {"detail": "Human-readable message", "code": "MACHINE_READABLE_CODE"}

Installed in main.py via install_error_handlers(app).
"""

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


# Map HTTP status codes to machine-readable error codes
_STATUS_TO_CODE = {
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    409: "CONFLICT",
    422: "VALIDATION_ERROR",
    429: "RATE_LIMITED",
    500: "INTERNAL_ERROR",
    503: "AI_UNAVAILABLE",
}


def install_error_handlers(app: FastAPI) -> None:
    """Register custom exception handlers on the FastAPI app."""

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        """Handle all HTTPException (401, 403, 404, 409, 429, etc.)."""
        code = _STATUS_TO_CODE.get(exc.status_code, "ERROR")
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": str(exc.detail), "code": code},
            headers=getattr(exc, "headers", None),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        """Simplify Pydantic's verbose 422 errors into a readable message."""
        errors = exc.errors()
        # Build a human-readable summary of what's wrong
        messages = []
        for err in errors:
            loc = " -> ".join(str(l) for l in err.get("loc", []) if l != "body")
            msg = err.get("msg", "Invalid value")
            messages.append(f"{loc}: {msg}" if loc else msg)

        detail = "; ".join(messages) if messages else "Invalid request data"
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={"detail": detail, "code": "VALIDATION_ERROR"},
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        """Catch-all for unexpected errors. Never leak internals."""
        # Log the real error server-side
        import traceback
        traceback.print_exc()

        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "An unexpected error occurred", "code": "INTERNAL_ERROR"},
        )

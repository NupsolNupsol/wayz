"""The errors this service is willing to describe to a caller.

Anything not on this list becomes a generic 500 with a request id and nothing else. An
employee asking a question must never be shown a stack trace, a connection string or the
name of a provider that happens to be down.
"""

from __future__ import annotations


class ServiceError(Exception):
    status_code = 500
    code = "internal_error"
    # What a person is allowed to read, in Arabic — this is an Arabic-first product.
    public_message = "حدث خطأ غير متوقع. حاول مرة أخرى."

    def __init__(self, detail: str | None = None, public_message: str | None = None):
        super().__init__(detail or self.public_message)
        self.detail = detail or self.public_message
        if public_message:
            self.public_message = public_message


class AuthError(ServiceError):
    status_code = 401
    code = "unauthorized"
    public_message = "غير مصرح بالوصول."


class ForbiddenError(ServiceError):
    status_code = 403
    code = "forbidden"
    public_message = "لا تملك صلاحية لهذا الإجراء."


class NotFoundError(ServiceError):
    status_code = 404
    code = "not_found"
    public_message = "العنصر المطلوب غير موجود."


class ValidationError(ServiceError):
    status_code = 422
    code = "invalid_request"
    public_message = "الطلب غير صالح."


class DependencyError(ServiceError):
    """A provider we depend on is unavailable — Qdrant, OpenAI, the embedder, the TTS."""

    status_code = 503
    code = "dependency_unavailable"
    public_message = "الخدمة غير متاحة حالياً. حاول مرة أخرى بعد قليل."

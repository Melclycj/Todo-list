"""
Application-level exception hierarchy.

All deliberate business-rule violations raised by services should use AppError
(or a subclass) so the global exception handler can safely expose their message
to the client. Plain ValueError from third-party code falls through to the
catch-all 500 handler instead of leaking internal details.
"""


class AppError(ValueError):
    """
    Base class for all intentional, user-facing business-rule errors.

    Subclass ValueError so existing `pytest.raises(ValueError)` tests still pass
    and callers that catch ValueError keep working during any migration period.
    """

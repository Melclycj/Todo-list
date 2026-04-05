# Coding Style

## Immutability (CRITICAL)

ALWAYS create new objects, NEVER mutate existing ones. In Python, use `@dataclass(frozen=True)` or `NamedTuple`.

## File Organization

- 200-400 lines typical, 800 max
- Organize by feature/domain, not by type
- Functions under 50 lines, no nesting >4 levels

## Python

- PEP 8, type annotations on all function signatures
- **black** for formatting, **isort** for imports, **ruff** for linting

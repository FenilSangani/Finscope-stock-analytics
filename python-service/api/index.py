"""Vercel entry point for the market data service.

Vercel runs each file under api/ as its own function and serves an exported
ASGI `app` directly, so this just puts the project root on the import path and
re-exports the FastAPI application defined in main.py.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app  # noqa: E402

__all__ = ["app"]

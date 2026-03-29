from supabase import create_client, Client

from .config import settings
from .local_db import LocalDBClient


def get_supabase():
    """
    Returns a DB client based on configuration:
    - DATABASE_URL is set  → LocalDBClient (local PostgreSQL via psycopg2)
    - DATABASE_URL is empty → Supabase cloud client
    """
    if settings.DATABASE_URL:
        return LocalDBClient(settings.DATABASE_URL)
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

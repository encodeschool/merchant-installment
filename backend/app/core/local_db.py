"""
Local PostgreSQL adapter that mimics the Supabase client query interface.

Supported chain:
  db.table(name)
    .select(cols, count=None)
    .eq(col, val) / .neq / .in_ / .gte / .lte / .gt / .lt
    .order(col, desc=False)
    .limit(n)
    .offset(n)
    .execute()          → SimpleResponse(data, count)

  db.table(name).insert(row).execute()
  db.table(name).update(row).eq(...).execute()
  db.table(name).delete().eq(...).execute()
"""
from __future__ import annotations

import datetime
import json
import uuid
from dataclasses import dataclass, field
from typing import Any

import psycopg2
import psycopg2.extras


def _serialize(val: Any) -> Any:
    """Convert psycopg2 native types to JSON-compatible types (mirrors Supabase behaviour)."""
    if isinstance(val, datetime.datetime):
        return val.isoformat()
    if isinstance(val, datetime.date):
        return val.isoformat()
    if isinstance(val, uuid.UUID):
        return str(val)
    if isinstance(val, dict):
        return {k: _serialize(v) for k, v in val.items()}
    if isinstance(val, list):
        return [_serialize(v) for v in val]
    return val


def _serialize_row(row: dict) -> dict:
    return {k: _serialize(v) for k, v in row.items()}


@dataclass
class SimpleResponse:
    data: list[dict]
    count: int | None = None


class QueryBuilder:
    def __init__(self, conn, table: str):
        self._conn = conn
        self._table = table
        self._op: str = "select"          # select | insert | update | delete
        self._cols: str = "*"
        self._want_count: bool = False
        self._filters: list[str] = []
        self._params: list[Any] = []
        self._order_col: str | None = None
        self._order_desc: bool = False
        self._limit_val: int | None = None
        self._offset_val: int | None = None
        self._insert_row: dict | None = None
        self._update_row: dict | None = None

    # ------------------------------------------------------------------ ops
    def select(self, cols: str = "*", count: str | None = None) -> "QueryBuilder":
        self._op = "select"
        self._cols = cols if cols != "*" else "*"
        self._want_count = count is not None
        return self

    def insert(self, row: dict) -> "QueryBuilder":
        self._op = "insert"
        self._insert_row = row
        return self

    def update(self, row: dict) -> "QueryBuilder":
        self._op = "update"
        self._update_row = row
        return self

    def delete(self) -> "QueryBuilder":
        self._op = "delete"
        return self

    # ------------------------------------------------------------------ filters
    def eq(self, col: str, val: Any) -> "QueryBuilder":
        self._filters.append(f"{col} = %s")
        self._params.append(val)
        return self

    def neq(self, col: str, val: Any) -> "QueryBuilder":
        self._filters.append(f"{col} != %s")
        self._params.append(val)
        return self

    def in_(self, col: str, vals: list) -> "QueryBuilder":
        if not vals:
            self._filters.append("FALSE")
        else:
            placeholders = ",".join(["%s"] * len(vals))
            self._filters.append(f"{col} IN ({placeholders})")
            self._params.extend(vals)
        return self

    def gte(self, col: str, val: Any) -> "QueryBuilder":
        self._filters.append(f"{col} >= %s")
        self._params.append(val)
        return self

    def lte(self, col: str, val: Any) -> "QueryBuilder":
        self._filters.append(f"{col} <= %s")
        self._params.append(val)
        return self

    def gt(self, col: str, val: Any) -> "QueryBuilder":
        self._filters.append(f"{col} > %s")
        self._params.append(val)
        return self

    def lt(self, col: str, val: Any) -> "QueryBuilder":
        self._filters.append(f"{col} < %s")
        self._params.append(val)
        return self

    # ------------------------------------------------------------------ modifiers
    def order(self, col: str, desc: bool = False) -> "QueryBuilder":
        self._order_col = col
        self._order_desc = desc
        return self

    def limit(self, n: int) -> "QueryBuilder":
        self._limit_val = n
        return self

    def offset(self, n: int) -> "QueryBuilder":
        self._offset_val = n
        return self

    def range(self, start: int, end: int) -> "QueryBuilder":
        """Supabase-compatible range: rows from start to end (inclusive)."""
        self._offset_val = start
        self._limit_val = end - start + 1
        return self

    # ------------------------------------------------------------------ execute
    def execute(self) -> SimpleResponse:
        with self._conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            if self._op == "select":
                return self._exec_select(cur)
            elif self._op == "insert":
                return self._exec_insert(cur)
            elif self._op == "update":
                return self._exec_update(cur)
            elif self._op == "delete":
                return self._exec_delete(cur)
        return SimpleResponse(data=[])

    def _where_clause(self) -> tuple[str, list]:
        if not self._filters:
            return "", self._params
        return "WHERE " + " AND ".join(self._filters), self._params

    def _exec_select(self, cur) -> SimpleResponse:
        where, params = self._where_clause()
        order = ""
        if self._order_col:
            direction = "DESC" if self._order_desc else "ASC"
            order = f"ORDER BY {self._order_col} {direction}"
        limit = f"LIMIT {self._limit_val}" if self._limit_val is not None else ""
        offset = f"OFFSET {self._offset_val}" if self._offset_val is not None else ""

        sql = f"SELECT {self._cols} FROM {self._table} {where} {order} {limit} {offset}".strip()
        cur.execute(sql, params)
        rows = [_serialize_row(dict(r)) for r in cur.fetchall()]

        count = None
        if self._want_count:
            count_sql = f"SELECT COUNT(*) FROM {self._table} {where}".strip()
            cur.execute(count_sql, params)
            count = cur.fetchone()["count"]

        return SimpleResponse(data=rows, count=count)

    def _exec_insert(self, cur) -> SimpleResponse:
        row = self._insert_row or {}
        cols = ", ".join(row.keys())
        placeholders = ", ".join(
            [f"%s::jsonb" if isinstance(v, (dict, list)) else "%s" for v in row.values()]
        )
        vals = [
            json.dumps(v) if isinstance(v, (dict, list)) else v
            for v in row.values()
        ]
        sql = f"INSERT INTO {self._table} ({cols}) VALUES ({placeholders}) RETURNING *"
        cur.execute(sql, vals)
        self._conn.commit()
        inserted = cur.fetchone()
        return SimpleResponse(data=[_serialize_row(dict(inserted))] if inserted else [])

    def _exec_update(self, cur) -> SimpleResponse:
        row = self._update_row or {}
        set_parts = [
            f"{k} = %s::jsonb" if isinstance(v, (dict, list)) else f"{k} = %s"
            for k, v in row.items()
        ]
        set_vals = [
            json.dumps(v) if isinstance(v, (dict, list)) else v
            for v in row.values()
        ]
        where, filter_params = self._where_clause()
        sql = f"UPDATE {self._table} SET {', '.join(set_parts)} {where} RETURNING *"
        cur.execute(sql, set_vals + filter_params)
        self._conn.commit()
        rows = [_serialize_row(dict(r)) for r in cur.fetchall()]
        return SimpleResponse(data=rows)

    def _exec_delete(self, cur) -> SimpleResponse:
        where, params = self._where_clause()
        sql = f"DELETE FROM {self._table} {where} RETURNING *"
        cur.execute(sql, params)
        self._conn.commit()
        rows = [_serialize_row(dict(r)) for r in cur.fetchall()]
        return SimpleResponse(data=rows)


class LocalDBClient:
    """Drop-in replacement for supabase.Client using psycopg2."""

    def __init__(self, database_url: str):
        self._conn = psycopg2.connect(database_url)
        self._conn.autocommit = False

    def table(self, name: str) -> QueryBuilder:
        return QueryBuilder(self._conn, name)

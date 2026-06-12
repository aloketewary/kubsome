
import pytest
from api.routes.analytics import run_sql_query

def test_sql_query_hardening():
    # Helper to simulate body
    def check(sql):
        return run_sql_query({"sql": sql})

    # These should be blocked
    assert "not allowed" in check("DROP TABLE pods")["error"]
    assert "Multiple statements not allowed" in check("SELECT 1; DROP TABLE pods")["error"]
    assert "not allowed" in check("-- comment\nDROP TABLE pods")["error"]
    assert "not allowed" in check("/* comment */ DROP TABLE pods")["error"]
    assert "not allowed" in check("DELETE FROM pods")["error"]
    assert "not allowed" in check("UPDATE pods SET status='pwned'")["error"]

    # These should be allowed (will fail later on actual execution if DB not connected, but should pass security check)
    # We check that it doesn't return a security error
    res = check("SELECT * FROM raw_pod_metrics")
    assert "error" not in res or "duckdb not installed" in res["error"] or "Table with name raw_pod_metrics does not exist" in res["error"]

    res = check("WITH cte AS (SELECT 1) SELECT * FROM cte")
    assert "error" not in res or "duckdb not installed" in res["error"] or "Table with name raw_pod_metrics does not exist" in res["error"]

def test_comment_stripping_edge_cases():
    def check(sql):
        return run_sql_query({"sql": sql})

    # Entirely comments
    assert "No SQL provided after stripping comments" in check("-- only a comment")["error"]
    assert "No SQL provided after stripping comments" in check("/* multi\nline\ncomment */")["error"]

    # Keyword obscured by comments
    assert "not allowed" in check("/* */ DROP TABLE x")["error"]
    assert "not allowed" in check("--\nDROP TABLE x")["error"]

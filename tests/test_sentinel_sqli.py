import pytest
from api.routes.analytics import run_sql_query

def test_sql_injection_protection():
    # Test comment bypass
    assert "error" in run_sql_query({"sql": "/* comment */ DROP TABLE raw_pod_metrics"})
    assert "error" in run_sql_query({"sql": "-- comment\nDROP TABLE raw_pod_metrics"})

    # Test multi-statement
    assert "error" in run_sql_query({"sql": "SELECT 1; DROP TABLE raw_pod_metrics"})

    # Test forbidden keywords
    assert "error" in run_sql_query({"sql": "UPDATE raw_pod_metrics SET cpu_millicores = 0"})
    assert "error" in run_sql_query({"sql": "DELETE FROM raw_pod_metrics"})
    assert "error" in run_sql_query({"sql": "TRUNCATE raw_pod_metrics"})
    assert "error" in run_sql_query({"sql": "ALTER TABLE raw_pod_metrics ADD COLUMN pwned INTEGER"})

def test_legitimate_queries():
    # These should NOT return an error (or at least not a safety error)
    # We ignore "duckdb not installed" error if it happens in CI

    queries = [
        "SELECT * FROM raw_pod_metrics LIMIT 10",
        "WITH cte AS (SELECT 1) SELECT * FROM cte",
        "DESCRIBE raw_pod_metrics",
        "EXPLAIN SELECT 1",
        "SHOW TABLES",
        "SUMMARIZE raw_pod_metrics",
    ]

    for sql in queries:
        result = run_sql_query({"sql": sql})
        if "error" in result:
            assert "not allowed via API" not in result["error"]
            assert "Multiple statements" not in result["error"]

def test_semicolon_handling():
    # Trailing semicolon should be OK if it's the only one
    result = run_sql_query({"sql": "SELECT 1;"})
    if "error" in result:
        assert "Multiple statements" not in result["error"]

    # Multiple semicolons should be blocked
    assert "error" in run_sql_query({"sql": "SELECT 1; SELECT 2;"})

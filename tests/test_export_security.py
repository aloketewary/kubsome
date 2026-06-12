
import pytest
from unittest.mock import MagicMock, patch
from core.analytics.export import export_csv, export_parquet

@patch("core.analytics.export.get_conn")
@patch("core.analytics.export.EXPORT_DIR")
def test_export_csv_parameterization(mock_dir, mock_get_conn):
    mock_conn = MagicMock()
    mock_get_conn.return_value = mock_conn
    mock_dir.mkdir = MagicMock()

    # Test raw_pods which has parameterization
    path = export_csv(query_name="raw_pods", days=10)

    # Check that execute was called with parameters
    args, kwargs = mock_conn.execute.call_args
    sql = args[0]
    params = args[1]

    assert "INTERVAL (?) DAYS" in sql
    assert params == [10]
    assert path is not None

@patch("core.analytics.export.get_conn")
@patch("core.analytics.export.EXPORT_DIR")
def test_export_parquet_parameterization(mock_dir, mock_get_conn):
    mock_conn = MagicMock()
    mock_get_conn.return_value = mock_conn
    mock_dir.mkdir = MagicMock()

    path = export_parquet(query_name="hourly", days=30)

    args, kwargs = mock_conn.execute.call_args
    sql = args[0]
    params = args[1]

    assert "INTERVAL (?) DAYS" in sql
    assert params == [30]
    assert path is not None

@patch("core.analytics.export.get_conn")
@patch("core.analytics.export.EXPORT_DIR")
def test_export_csv_no_params(mock_dir, mock_get_conn):
    mock_conn = MagicMock()
    mock_get_conn.return_value = mock_conn
    mock_dir.mkdir = MagicMock()

    # daily query has no (?)
    export_csv(query_name="daily")

    args, kwargs = mock_conn.execute.call_args
    params = args[1]
    assert params is None

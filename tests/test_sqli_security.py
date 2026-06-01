import unittest
from unittest.mock import patch, MagicMock
from core.analytics.incidents import search_incidents, incident_metrics
from core.collectors.idle_resources import _detect_idle_deployments

class TestSQLISecurity(unittest.TestCase):
    @patch("core.analytics.engine.get_conn")
    def test_search_incidents_sqli(self, mock_get_conn):
        mock_conn = MagicMock()
        mock_get_conn.return_value = mock_conn

        # Malicious query
        malicious_query = "x' OR 1=1 --"
        search_incidents(query=malicious_query)

        # Get the SQL that was executed
        # Filters out calls without params (like from _ensure_tables)
        calls_with_params = [c for c in mock_conn.execute.call_args_list if len(c[0]) > 1]

        for call in calls_with_params:
            sql = call[0][0]
            params = call[0][1]

            # Check that the malicious string is NOT interpolated
            self.assertNotIn(malicious_query, sql, "SQL injection vulnerability detected in search_incidents!")
            self.assertIn("?", sql)
            self.assertIn(f"%{malicious_query}%", params)

    @patch("core.analytics.engine.get_conn")
    def test_incident_metrics_sqli(self, mock_get_conn):
        mock_conn = MagicMock()
        mock_get_conn.return_value = mock_conn

        # Malicious days
        malicious_days = "90'; DROP TABLE incidents; --"
        incident_metrics(days=malicious_days)

        # Check all execute calls
        calls_with_params = [c for c in mock_conn.execute.call_args_list if len(c[0]) > 1]
        self.assertGreater(len(calls_with_params), 0)

        for call in calls_with_params:
            sql = call[0][0]
            params = call[0][1]
            self.assertNotIn(malicious_days, sql, "SQL injection vulnerability detected in incident_metrics!")
            self.assertIn("?", sql)
            self.assertIn(malicious_days, params)

    @patch("core.analytics.engine.execute")
    def test_detect_idle_deployments_sqli(self, mock_execute):
        # Malicious ctx
        malicious_ctx = "prod' OR 1=1 --"
        _detect_idle_deployments(malicious_ctx, "default")

        args, kwargs = mock_execute.call_args
        sql = args[0]
        params = args[1]

        self.assertNotIn(malicious_ctx, sql, "SQL injection vulnerability detected in _detect_idle_deployments!")
        self.assertIn("?", sql)
        self.assertIn(malicious_ctx, params)

if __name__ == "__main__":
    unittest.main()

from core.collectors.search import search_resources
from unittest.mock import patch, MagicMock
from core.cache import invalidate

def test_search_resources_mocked():
    invalidate()
    with patch("core.collectors.search.subprocess.run") as mock_run:
        def side_effect(cmd, **kwargs):
            kind = cmd[cmd.index("get") + 1]
            mock = MagicMock()
            mock.returncode = 0
            if kind == "pods":
                mock.stdout = "pod-alpha pod-beta"
            elif kind == "deployments":
                mock.stdout = "dep-alpha"
            else:
                mock.stdout = ""
            return mock

        mock_run.side_effect = side_effect

        results = search_resources("alpha")
        assert len(results) >= 2
        kinds = [r["kind"] for r in results]
        assert "Pod" in kinds
        assert "Deployment" in kinds

        # Verify caching
        mock_run.reset_mock()
        search_resources("alpha")
        assert mock_run.call_count == 0

if __name__ == "__main__":
    import pytest
    pytest.main([__file__])

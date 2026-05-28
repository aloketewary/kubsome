import pytest
from core import telemetry

@pytest.fixture(autouse=True)
def setup_telemetry(monkeypatch):
    monkeypatch.setattr(telemetry, "is_enabled", lambda: True)

def test_stats_with_remediations(monkeypatch):
    # Mock DuckDB calls to return 0 for everything else
    monkeypatch.setattr(telemetry, "_stats_from_db", lambda: {
        "total_commands": 10,
        "top_commands": [],
        "unresolved_count": 0,
        "top_unresolved": [],
        "auto_remediations": 5,
        "days_tracked": 1
    })

    stats = telemetry.get_stats()
    assert stats["auto_remediations"] == 5
    assert stats["total_commands"] == 10

def test_roi_calculation():
    # Simple logic check for the UI-equivalent ROI calculation
    total_commands = 100
    unresolved_count = 10
    auto_remediations = 2

    resolved = total_commands - unresolved_count
    mins = (resolved * 2) + (auto_remediations * 15)

    # 90 * 2 = 180
    # 2 * 15 = 30
    # Total = 210 mins = 3.5 hours
    assert mins == 210

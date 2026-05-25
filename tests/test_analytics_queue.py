"""
Tests for analytics queue — UUID7 ordering, enqueue/drain,
concurrency, corruption handling, and edge cases.
"""

import json
import os
import time
import unittest
import threading
from pathlib import Path
from unittest.mock import patch, MagicMock
from core.analytics.queue import (
    uuid7, enqueue, drain, queue_stats,
    start_drain_loop, stop_drain_loop, QUEUE_DIR,
    _process_events,
)


class TestUUID7(unittest.TestCase):
    """UUID7 generation — time-ordering and uniqueness."""

    def test_uuid7_format(self):
        """UUID7 should be a valid UUID string."""
        uid = uuid7()
        self.assertEqual(len(uid), 36)
        self.assertEqual(uid.count("-"), 4)

    def test_uuid7_uniqueness(self):
        """1000 UUID7s should all be unique."""
        ids = [uuid7() for _ in range(1000)]
        self.assertEqual(len(set(ids)), 1000)

    def test_uuid7_time_ordered(self):
        """UUID7s generated sequentially should sort chronologically."""
        ids = []
        for _ in range(100):
            ids.append(uuid7())
        self.assertEqual(ids, sorted(ids))

    def test_uuid7_time_ordered_across_delay(self):
        """UUID7s with time gap should maintain order."""
        id1 = uuid7()
        time.sleep(0.01)
        id2 = uuid7()
        self.assertLess(id1, id2)


class TestEnqueue(unittest.TestCase):
    """Enqueue — file creation, atomicity, content."""

    def setUp(self):
        """Clean queue before each test."""
        if QUEUE_DIR.exists():
            for f in QUEUE_DIR.glob("*.json"):
                f.unlink()
            for f in QUEUE_DIR.glob(".*.tmp"):
                f.unlink()

    def tearDown(self):
        """Clean queue after each test."""
        if QUEUE_DIR.exists():
            for f in QUEUE_DIR.glob("*.json"):
                f.unlink()
            for f in QUEUE_DIR.glob(".*.tmp"):
                f.unlink()

    def test_enqueue_creates_file(self):
        """Enqueue should create a .json file in the queue dir."""
        enqueue("test_event", {"key": "value"})
        files = list(QUEUE_DIR.glob("*.json"))
        self.assertEqual(len(files), 1)

    def test_enqueue_returns_uuid7_id(self):
        """Enqueue should return a valid UUID7 event ID."""
        eid = enqueue("test", {})
        self.assertEqual(len(eid), 36)

    def test_enqueue_file_content(self):
        """Enqueued file should contain valid JSON with expected fields."""
        eid = enqueue("pod_metrics", {"rows": [[1, 2, 3]]})
        f = QUEUE_DIR / f"{eid}.json"
        self.assertTrue(f.exists())
        data = json.loads(f.read_text())
        self.assertEqual(data["id"], eid)
        self.assertEqual(data["type"], "pod_metrics")
        self.assertIn("ts", data)
        self.assertEqual(data["data"]["rows"], [[1, 2, 3]])

    def test_enqueue_no_tmp_files_left(self):
        """After enqueue, no .tmp files should remain."""
        enqueue("test", {"x": 1})
        tmp_files = list(QUEUE_DIR.glob(".*.tmp"))
        self.assertEqual(len(tmp_files), 0)

    def test_enqueue_multiple_events(self):
        """Multiple enqueues should create multiple files."""
        for i in range(10):
            enqueue("test", {"i": i})
        files = list(QUEUE_DIR.glob("*.json"))
        self.assertEqual(len(files), 10)

    def test_enqueue_empty_data(self):
        """Enqueue with empty data should still work."""
        eid = enqueue("empty", {})
        f = QUEUE_DIR / f"{eid}.json"
        data = json.loads(f.read_text())
        self.assertEqual(data["data"], {})

    def test_enqueue_large_payload(self):
        """Enqueue should handle large payloads."""
        rows = [[f"ts_{i}", "ctx", "ns", f"pod-{i}", "deploy",
                 "container", i, i * 2, 100, 200, 128, 256, 0, "Running"]
                for i in range(500)]
        eid = enqueue("pod_metrics", {"rows": rows})
        f = QUEUE_DIR / f"{eid}.json"
        data = json.loads(f.read_text())
        self.assertEqual(len(data["data"]["rows"]), 500)

    def test_enqueue_special_characters(self):
        """Enqueue should handle special characters in data."""
        eid = enqueue("test", {"msg": 'quotes "and" newlines\nand tabs\t'})
        f = QUEUE_DIR / f"{eid}.json"
        data = json.loads(f.read_text())
        self.assertIn("quotes", data["data"]["msg"])

    def test_enqueue_creates_queue_dir(self):
        """Enqueue should create the queue directory if missing."""
        import shutil
        if QUEUE_DIR.exists():
            shutil.rmtree(QUEUE_DIR)
        enqueue("test", {"x": 1})
        self.assertTrue(QUEUE_DIR.exists())


class TestDrain(unittest.TestCase):
    """Drain — processing, ordering, error handling."""

    def setUp(self):
        if QUEUE_DIR.exists():
            for f in QUEUE_DIR.glob("*.json"):
                f.unlink()

    def tearDown(self):
        if QUEUE_DIR.exists():
            for f in QUEUE_DIR.glob("*.json"):
                f.unlink()

    @patch("core.analytics.engine.execute_many")
    def test_drain_processes_pod_metrics(self, mock_exec):
        """Drain should insert pod_metrics rows into DuckDB."""
        row = ["2025-01-01", "ctx", "ns", "pod-1", "deploy",
               "c", 100, 256, 50, 200, 128, 512, 0, "Running"]
        enqueue("pod_metrics", {"rows": [row]})
        processed = drain()
        self.assertEqual(processed, 1)
        mock_exec.assert_called()
        call_args = mock_exec.call_args_list[0]
        self.assertIn("raw_pod_metrics", call_args[0][0])

    @patch("core.analytics.engine.execute_many")
    def test_drain_processes_node_metrics(self, mock_exec):
        """Drain should insert node_metrics rows into DuckDB."""
        row = ["2025-01-01", "ctx", "node-1", 45, 60, 4000, 16384, 30]
        enqueue("node_metrics", {"rows": [row]})
        processed = drain()
        self.assertEqual(processed, 1)
        mock_exec.assert_called()
        call_args = mock_exec.call_args_list[0]
        self.assertIn("raw_node_metrics", call_args[0][0])

    @patch("core.analytics.engine.execute_many")
    def test_drain_processes_collection_log(self, mock_exec):
        """Drain should insert collection_log entries."""
        enqueue("collection_log", {
            "ts": "2025-01-01", "level": "raw",
            "pods": 10, "nodes": 3, "duration_ms": 500,
        })
        processed = drain()
        self.assertEqual(processed, 1)
        mock_exec.assert_called()
        call_args = mock_exec.call_args_list[0]
        self.assertIn("collection_log", call_args[0][0])

    @patch("core.analytics.engine.execute_many")
    def test_drain_removes_files(self, mock_exec):
        """Drain should delete processed files."""
        enqueue("test", {"rows": []})
        enqueue("test", {"rows": []})
        self.assertEqual(len(list(QUEUE_DIR.glob("*.json"))), 2)
        drain()
        self.assertEqual(len(list(QUEUE_DIR.glob("*.json"))), 0)

    @patch("core.analytics.engine.execute_many")
    def test_drain_empty_queue(self, mock_exec):
        """Drain on empty queue should return 0 and not call DB."""
        processed = drain()
        self.assertEqual(processed, 0)
        mock_exec.assert_not_called()

    @patch("core.analytics.engine.execute_many")
    def test_drain_respects_batch_size(self, mock_exec):
        """Drain should only process up to batch_size events."""
        for i in range(20):
            enqueue("pod_metrics", {"rows": [[f"row_{i}"]]})
        processed = drain(batch_size=5)
        self.assertEqual(processed, 5)
        remaining = len(list(QUEUE_DIR.glob("*.json")))
        self.assertEqual(remaining, 15)

    @patch("core.analytics.engine.execute_many")
    def test_drain_handles_corrupted_file(self, mock_exec):
        """Drain should skip and remove corrupted JSON files."""
        QUEUE_DIR.mkdir(parents=True, exist_ok=True)
        # Write a corrupted file
        bad_file = QUEUE_DIR / f"{uuid7()}.json"
        bad_file.write_text("not valid json {{{")
        # Write a good file
        enqueue("pod_metrics", {"rows": [["good"]]})
        processed = drain()
        # Should process the good one, skip the bad one
        self.assertEqual(processed, 1)
        # Both files should be removed
        self.assertEqual(len(list(QUEUE_DIR.glob("*.json"))), 0)

    @patch("core.analytics.engine.execute_many")
    def test_drain_processes_in_time_order(self, mock_exec):
        """Drain should process events in UUID7 time order."""
        enqueue("pod_metrics", {"rows": [["first"]]})
        time.sleep(0.01)
        enqueue("pod_metrics", {"rows": [["second"]]})
        time.sleep(0.01)
        enqueue("pod_metrics", {"rows": [["third"]]})
        drain()
        # All rows should be in one call, in order
        call_args = mock_exec.call_args_list[0]
        rows = call_args[0][1]
        self.assertEqual(rows[0], ("first",))
        self.assertEqual(rows[1], ("second",))
        self.assertEqual(rows[2], ("third",))

    @patch("core.analytics.engine.execute_many")
    def test_drain_handles_empty_rows(self, mock_exec):
        """Drain should handle events with empty rows gracefully."""
        enqueue("pod_metrics", {"rows": []})
        processed = drain()
        self.assertEqual(processed, 1)
        # execute_many should NOT be called with empty list
        for call in mock_exec.call_args_list:
            if "raw_pod_metrics" in call[0][0]:
                self.fail("Should not insert empty rows")

    @patch("core.analytics.engine.execute_many")
    def test_drain_unknown_event_type(self, mock_exec):
        """Drain should silently skip unknown event types."""
        enqueue("unknown_type", {"foo": "bar"})
        processed = drain()
        self.assertEqual(processed, 1)
        # File removed, no DB call
        self.assertEqual(len(list(QUEUE_DIR.glob("*.json"))), 0)


class TestQueueStats(unittest.TestCase):
    """Queue stats — depth and age reporting."""

    def setUp(self):
        if QUEUE_DIR.exists():
            for f in QUEUE_DIR.glob("*.json"):
                f.unlink()

    def tearDown(self):
        if QUEUE_DIR.exists():
            for f in QUEUE_DIR.glob("*.json"):
                f.unlink()

    def test_stats_empty_queue(self):
        """Stats on empty queue should show depth 0."""
        stats = queue_stats()
        self.assertEqual(stats["depth"], 0)
        self.assertEqual(stats["oldest_age_s"], 0)

    def test_stats_with_events(self):
        """Stats should reflect queued event count."""
        enqueue("a", {})
        enqueue("b", {})
        enqueue("c", {})
        stats = queue_stats()
        self.assertEqual(stats["depth"], 3)
        self.assertGreaterEqual(stats["oldest_age_s"], 0)

    def test_stats_oldest_age(self):
        """Oldest age should reflect time since first event."""
        enqueue("old", {})
        time.sleep(0.1)
        stats = queue_stats()
        self.assertGreaterEqual(stats["oldest_age_s"], 0.05)


class TestConcurrency(unittest.TestCase):
    """Concurrent enqueue from multiple threads."""

    def setUp(self):
        if QUEUE_DIR.exists():
            for f in QUEUE_DIR.glob("*.json"):
                f.unlink()

    def tearDown(self):
        if QUEUE_DIR.exists():
            for f in QUEUE_DIR.glob("*.json"):
                f.unlink()

    def test_concurrent_enqueue(self):
        """Multiple threads enqueuing simultaneously should not lose events."""
        errors = []
        count = 50

        def _enqueue_batch(thread_id):
            try:
                for i in range(count):
                    enqueue("pod_metrics", {"thread": thread_id, "i": i})
            except Exception as e:
                errors.append(e)

        threads = [threading.Thread(target=_enqueue_batch, args=(t,)) for t in range(4)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        self.assertEqual(len(errors), 0)
        files = list(QUEUE_DIR.glob("*.json"))
        self.assertEqual(len(files), 4 * count)

    @patch("core.analytics.engine.execute_many")
    def test_drain_while_enqueue(self, mock_exec):
        """Drain should work correctly even while new events are being enqueued."""
        # Pre-fill queue
        for i in range(10):
            enqueue("pod_metrics", {"rows": [[f"pre_{i}"]]})

        # Start enqueuing in background
        stop = threading.Event()

        def _enqueue_loop():
            while not stop.is_set():
                enqueue("pod_metrics", {"rows": [["concurrent"]]})
                time.sleep(0.005)

        t = threading.Thread(target=_enqueue_loop)
        t.start()

        # Drain the pre-filled events
        time.sleep(0.02)
        processed = drain(batch_size=10)
        stop.set()
        t.join()

        # Should have processed exactly 10 (the pre-filled ones)
        self.assertEqual(processed, 10)
        # New events from concurrent enqueue should still be in queue
        remaining = len(list(QUEUE_DIR.glob("*.json")))
        self.assertGreater(remaining, 0)


class TestDrainLoop(unittest.TestCase):
    """Drain loop — start/stop lifecycle."""

    def setUp(self):
        if QUEUE_DIR.exists():
            for f in QUEUE_DIR.glob("*.json"):
                f.unlink()

    def tearDown(self):
        stop_drain_loop()
        if QUEUE_DIR.exists():
            for f in QUEUE_DIR.glob("*.json"):
                f.unlink()

    @patch("core.analytics.queue.drain")
    def test_drain_loop_calls_drain(self, mock_drain):
        """Drain loop should call drain periodically."""
        mock_drain.return_value = 0
        start_drain_loop(interval=0.05)
        time.sleep(0.2)
        stop_drain_loop()
        self.assertGreater(mock_drain.call_count, 2)

    @patch("core.analytics.queue.drain")
    def test_drain_loop_no_double_start(self, mock_drain):
        """Starting drain loop twice should not create duplicate threads."""
        mock_drain.return_value = 0
        start_drain_loop(interval=0.05)
        start_drain_loop(interval=0.05)
        time.sleep(0.15)
        stop_drain_loop()
        # Should not have excessive calls (only one loop running)
        self.assertLess(mock_drain.call_count, 10)


class TestEdgeCases(unittest.TestCase):
    """Edge cases — permissions, disk full simulation, missing dir."""

    def setUp(self):
        if QUEUE_DIR.exists():
            for f in QUEUE_DIR.glob("*.json"):
                f.unlink()

    def tearDown(self):
        if QUEUE_DIR.exists():
            for f in QUEUE_DIR.glob("*.json"):
                f.unlink()

    def test_drain_nonexistent_queue_dir(self):
        """Drain should return 0 if queue dir doesn't exist."""
        import shutil
        if QUEUE_DIR.exists():
            shutil.rmtree(QUEUE_DIR)
        processed = drain()
        self.assertEqual(processed, 0)

    def test_enqueue_with_none_data(self):
        """Enqueue with None values in data should serialize correctly."""
        eid = enqueue("test", {"value": None, "list": [None, 1]})
        f = QUEUE_DIR / f"{eid}.json"
        data = json.loads(f.read_text())
        self.assertIsNone(data["data"]["value"])
        self.assertEqual(data["data"]["list"], [None, 1])

    def test_enqueue_with_datetime_data(self):
        """Enqueue should handle datetime objects via default=str."""
        from datetime import datetime
        eid = enqueue("test", {"ts": datetime(2025, 1, 1, 12, 0, 0)})
        f = QUEUE_DIR / f"{eid}.json"
        data = json.loads(f.read_text())
        self.assertIn("2025", data["data"]["ts"])

    @patch("core.analytics.engine.execute_many")
    def test_drain_mixed_event_types(self, mock_exec):
        """Drain should correctly route mixed event types."""
        enqueue("pod_metrics", {"rows": [["pod_row"]]})
        enqueue("node_metrics", {"rows": [["node_row"]]})
        enqueue("collection_log", {
            "ts": "2025-01-01", "level": "raw",
            "pods": 5, "nodes": 2, "duration_ms": 100,
        })
        drain()
        # Should have calls for all three tables
        sql_calls = [call[0][0] for call in mock_exec.call_args_list]
        self.assertTrue(any("raw_pod_metrics" in s for s in sql_calls))
        self.assertTrue(any("raw_node_metrics" in s for s in sql_calls))
        self.assertTrue(any("collection_log" in s for s in sql_calls))


if __name__ == "__main__":
    unittest.main()

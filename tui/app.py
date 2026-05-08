from textual.app import App, ComposeResult
from textual.widgets import (
    Header, Footer, TabbedContent,
    TabPane, Static, DataTable
)
from textual import work

from core.context import context
from core.collectors.pods import collect_pods
from core.collectors.nodes import collect_nodes
from core.collectors.deployments import (
    collect_deployments
)
from core.collectors.events import collect_events
from core.collectors.metrics import top_pods
from core.collectors.security import security_scan
from core.collectors.jobs import list_cronjobs, list_jobs
from core.collectors.scaling import list_hpa
from core.analyzer import (
    analyze_pods, analyze_nodes,
    analyze_deployments
)
from config.settings import SETTINGS


class KubeasyApp(App):
    CSS = """
    Screen {
        background: $surface;
    }
    #overview-panel {
        height: auto;
        margin: 1;
        padding: 1;
        border: solid $primary;
    }
    DataTable {
        height: 1fr;
    }
    #status-bar {
        dock: bottom;
        height: 1;
        background: $primary;
        color: $text;
        padding: 0 1;
    }
    """

    BINDINGS = [
        ("q", "quit", "Quit"),
        ("r", "refresh", "Refresh"),
        ("1", "tab_overview", "Overview"),
        ("2", "tab_pods", "Pods"),
        ("3", "tab_events", "Events"),
        ("4", "tab_metrics", "Metrics"),
        ("5", "tab_security", "Security"),
        ("6", "tab_jobs", "Jobs"),
    ]

    TITLE = "Kubsome"
    SUB_TITLE = "Kubernetes Operational Workspace"

    def compose(self) -> ComposeResult:
        yield Header()
        with TabbedContent(
            "Overview", "Pods", "Events",
            "Metrics", "Security", "Jobs"
        ):
            with TabPane("Overview", id="tab-overview"):
                yield Static(id="overview-content")
            with TabPane("Pods", id="tab-pods"):
                yield DataTable(id="pods-table")
            with TabPane("Events", id="tab-events"):
                yield DataTable(id="events-table")
            with TabPane("Metrics", id="tab-metrics"):
                yield DataTable(id="metrics-table")
            with TabPane("Security", id="tab-security"):
                yield DataTable(id="security-table")
            with TabPane("Jobs", id="tab-jobs"):
                yield DataTable(id="jobs-table")
        yield Static(id="status-bar")
        yield Footer()

    def on_mount(self) -> None:
        self._setup_tables()
        self.refresh_data()
        self.set_interval(
            SETTINGS["refresh_interval"],
            self.refresh_data
        )

    def _setup_tables(self) -> None:
        pods_table = self.query_one("#pods-table", DataTable)
        pods_table.add_columns(
            "Status", "Pod", "Phase", "Restarts", "Age"
        )
        pods_table.cursor_type = "row"

        events_table = self.query_one("#events-table", DataTable)
        events_table.add_columns(
            "Type", "Kind", "Object", "Reason", "Message", "Count"
        )

        metrics_table = self.query_one("#metrics-table", DataTable)
        metrics_table.add_columns("Pod", "CPU", "Memory")

        security_table = self.query_one("#security-table", DataTable)
        security_table.add_columns(
            "Severity", "Pod", "Issue", "Fix"
        )

        jobs_table = self.query_one("#jobs-table", DataTable)
        jobs_table.add_columns(
            "Status", "Name", "Type", "Schedule/State"
        )

    @work(thread=True)
    def refresh_data(self) -> None:
        self._refresh_overview()
        self._refresh_pods()
        self._refresh_events()
        self._refresh_metrics()
        self._refresh_security()
        self._refresh_jobs()
        self._update_status()

    def _refresh_overview(self) -> None:
        try:
            pods = collect_pods()
            nodes = collect_nodes()
            deployments = collect_deployments()

            pod_h = analyze_pods(pods)
            node_h = analyze_nodes(nodes)
            dep_h = analyze_deployments(deployments)

            content = (
                f"🌐 Context: {context.current_context}\n"
                f"📁 Namespace: {context.namespace}\n\n"
                f"📦 Pods:        "
                f"✓ {pod_h['healthy']}  "
                f"⚠ {pod_h['warning']}  "
                f"✗ {pod_h['critical']}\n"
                f"🖥️  Nodes:       "
                f"✓ {node_h['healthy']}  "
                f"⚠ {node_h['warning']}\n"
                f"🚀 Deployments: "
                f"✓ {dep_h['healthy']}  "
                f"✗ {dep_h['unavailable']}\n"
            )

            self.call_from_thread(self._set_overview, content)
        except Exception:
            pass

    def _set_overview(self, content: str) -> None:
        self.query_one("#overview-content", Static).update(content)

    def _refresh_pods(self) -> None:
        try:
            pods = collect_pods()
            self.call_from_thread(self._update_pods_table, pods)
        except Exception:
            pass

    def _update_pods_table(self, pods) -> None:
        table = self.query_one("#pods-table", DataTable)
        table.clear()

        pods_sorted = sorted(
            pods,
            key=lambda x: (x["status"] != "Running", -x["restarts"])
        )

        for pod in pods_sorted:
            icon = (
                "●" if pod["status"] == "Running"
                else "⚠" if pod["status"] == "Pending"
                else "✗"
            )
            table.add_row(icon, pod["name"], pod["status"], str(pod["restarts"]), "")

    def _refresh_events(self) -> None:
        try:
            events = collect_events(limit=30)
            self.call_from_thread(self._update_events_table, events)
        except Exception:
            pass

    def _update_events_table(self, events) -> None:
        table = self.query_one("#events-table", DataTable)
        table.clear()
        for ev in events:
            table.add_row(
                ev["type"], ev["kind"], ev["object"],
                ev["reason"], ev["message"][:50], str(ev["count"])
            )

    def _refresh_metrics(self) -> None:
        try:
            pods = top_pods()
            self.call_from_thread(self._update_metrics_table, pods)
        except Exception:
            pass

    def _update_metrics_table(self, pods) -> None:
        table = self.query_one("#metrics-table", DataTable)
        table.clear()
        for pod in pods:
            table.add_row(pod["name"], pod["cpu"], pod["memory"])

    def _refresh_security(self) -> None:
        try:
            findings = security_scan()
            self.call_from_thread(self._update_security_table, findings)
        except Exception:
            pass

    def _update_security_table(self, findings) -> None:
        table = self.query_one("#security-table", DataTable)
        table.clear()
        for f in findings[:20]:
            table.add_row(
                f["severity"].upper(), f["pod"],
                f["issue"], f["fix"]
            )

    def _refresh_jobs(self) -> None:
        try:
            cjs = list_cronjobs()
            jobs = list_jobs()
            self.call_from_thread(self._update_jobs_table, cjs, jobs)
        except Exception:
            pass

    def _update_jobs_table(self, cjs, jobs) -> None:
        table = self.query_one("#jobs-table", DataTable)
        table.clear()

        for cj in cjs:
            icon = "⏸" if cj["suspended"] else "🕐"
            table.add_row(
                icon, cj["name"], "CronJob", cj["schedule"]
            )

        for job in jobs:
            icon = "✓" if job["state"] == "Succeeded" else "✗" if job["state"] == "Failed" else "▶"
            table.add_row(
                icon, job["name"], "Job", job["state"]
            )

    def _update_status(self) -> None:
        self.call_from_thread(self._set_status)

    def _set_status(self) -> None:
        widget = self.query_one("#status-bar", Static)
        widget.update(
            f" {context.current_context} │ "
            f"{context.namespace} │ "
            f"'r' refresh │ 1-6 tabs │ 'q' quit"
        )

    def action_refresh(self) -> None:
        self.refresh_data()

    def action_tab_overview(self) -> None:
        self.query_one(TabbedContent).active = "tab-overview"

    def action_tab_pods(self) -> None:
        self.query_one(TabbedContent).active = "tab-pods"

    def action_tab_events(self) -> None:
        self.query_one(TabbedContent).active = "tab-events"

    def action_tab_metrics(self) -> None:
        self.query_one(TabbedContent).active = "tab-metrics"

    def action_tab_security(self) -> None:
        self.query_one(TabbedContent).active = "tab-security"

    def action_tab_jobs(self) -> None:
        self.query_one(TabbedContent).active = "tab-jobs"

    def on_data_table_row_selected(
        self, event: DataTable.RowSelected
    ) -> None:
        table = event.data_table
        if table.id == "pods-table":
            row = table.get_row(event.row_key)
            pod_name = row[1]
            self.notify(f"Selected: {pod_name}", title="Pod")


def run_tui():
    app = KubeasyApp()
    app.run()

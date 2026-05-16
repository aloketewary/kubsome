## 2025-05-14 - [NLP Matcher Optimization]
**Learning:** In high-frequency functions like the NLP matcher, local data structure allocation and repetitive fuzzy matching loops can significantly increase overhead. Flattening the search space and using a single `process.extract` call against a larger list is much more efficient than multiple `process.extractOne` calls in a loop, as it reduces transitions between Python and C-extensions in `rapidfuzz`.

**Action:** Always hoist static data structures to module constants and consolidate fuzzy matching calls where possible.

## 2025-05-15 - [Parallel Log Fetching]
**Learning:** Sequential log fetching via  for multiple pods (e.g., log correlation) creates a significant bottleneck that scales linearly with the number of pods. Since these are I/O-bound subprocess calls, parallelization using  reduces the total latency to that of the slowest single request.
**Action:** Use  for batch resource operations (logs, describe, etc.) across multiple pods. Always handle empty input lists to avoid  in .

## 2025-05-15 - [Parallel Log Fetching]
**Learning:** Sequential log fetching via `kubectl logs` for multiple pods (e.g., log correlation) creates a significant bottleneck that scales linearly with the number of pods. Since these are I/O-bound subprocess calls, parallelization using `ThreadPoolExecutor` reduces the total latency to that of the slowest single request.
**Action:** Use `ThreadPoolExecutor` for batch resource operations (logs, describe, etc.) across multiple pods. Always handle empty input lists to avoid `ValueError` in `max_workers`.

## 2026-05-13 - [Unified Cached Resource Fetching]
**Learning:** Multiple collectors independently fetching the same Kubernetes resources (pods, nodes, etc.) create redundant I/O and shell overhead. Centralizing resource fetching into a unified, cached raw fetcher (`get_raw_resources`) allows different components to share the same data within the cache window, significantly reducing the total number of `kubectl` executions.

**Action:** Use a shared, cached raw resource fetcher for primary Kubernetes objects and parallelize top-level data aggregation (like overviews) to minimize latency.

## 2024-05-16 - [Optimized Multi-Context Overview]
**Learning:** Parallelizing Kubernetes resource fetching across different contexts/namespaces significantly improves dashboard responsiveness. However, a common anti-pattern is calling `.result()` immediately after `.submit()`, which serializes execution. Correct usage involves submitting all tasks before resolving results. Additionally, skipping unnecessary resources (like nodes in app-specific views) further reduces latency and cluster load.
**Action:** Always submit all concurrent tasks to the `ThreadPoolExecutor` before calling `.result()` on any future, and use cached fetchers for shared resource data.

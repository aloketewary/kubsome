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

## 2025-05-16 - [Sequential ThreadPoolExecutor Anti-pattern]
**Learning:** A common anti-pattern in the codebase was calling `.result()` immediately after `executor.submit()`, which effectively serializes the execution. True parallelism requires submitting all tasks first and collecting their futures, then resolving them.

**Action:** Always submit all background tasks to a `ThreadPoolExecutor` and store their future objects before calling `.result()` on any of them to ensure concurrent execution.

## 2025-05-16 - [Cost Collector Optimization]
**Learning:** Cost-related collectors often fetch multiple resource types (Pods, ConfigMaps, PVCs, Deployments) sequentially, leading to cumulative I/O latency. Moving to a centralized, cached fetcher and parallelizing independent resource fetches significantly improves responsiveness.

**Action:** Consolidate resource fetching into the cached 'get_raw_resources' and use 'ThreadPoolExecutor' for multi-resource lookups in collectors.

## 2026-05-18 - [Parallel Resource Fetching in Overview]
**Learning:** Sequential kubectl calls in API routes create a significant latency floor, especially for multi-resource overviews. Using a ThreadPoolExecutor to parallelize these calls reduces response time from O(N) to O(1) relative to the number of resource types. Additionally, leveraging a unified cached fetcher prevents redundant I/O when multiple parts of the application request the same data.
**Action:** Always parallelize independent resource fetches in aggregate routes and use the shared `get_raw_resources` cache.

## 2026-05-20 - [Parallelizing Uptime Collector]
**Learning:** The Uptime collector performed sequential `kubectl` calls (API check, node fetch, pod fetch), leading to a high latency floor. Refactoring it to use `ThreadPoolExecutor` for parallelizing these independent I/O tasks and leveraging the centralized `get_raw_resources` cache significantly improves responsiveness.

**Action:** Use `ThreadPoolExecutor` and the centralized `get_raw_resources` fetcher to parallelize independent Kubernetes resource fetches within collectors.

## 2026-05-20 - [Parallelizing RBAC Permission Checks]
**Learning:** Sequential `kubectl auth can-i` checks for a permission matrix (N resources × M verbs) create a significant latency bottleneck that grows linearly. By using a `ThreadPoolExecutor`, we can parallelize these independent I/O tasks and reduce total response time to nearly a single call's latency. Additionally, using the unified cached fetcher for RBAC listings ensures consistency and reduces redundant API traffic.

**Action:** Always parallelize bulk authorization checks and leverage the centralized `get_raw_resources` cache for Kubernetes resource listings.

## 2026-05-22 - [Parallel Resource Name Fetching in Search]
**Learning:** Sequential `kubectl` calls to fetch names for multiple resource types (Pods, Deployments, Services, etc.) for fuzzy searching created a significant latency floor. By parallelizing these independent I/O tasks using `ThreadPoolExecutor` and applying a 60-second cache, the search response time was reduced from O(N) to O(1) relative to the number of resource types.

**Action:** Use `ThreadPoolExecutor` and `@cached` for bulk resource discovery operations to minimize latency in interactive features like fuzzy search.

## 2026-05-24 - [Optimizing Image Pull Secret Diagnostics]
**Learning:** Sequential 'kubectl' calls for each ServiceAccount found in a pod list created an O(N) bottleneck. Additionally, using direct 'subprocess.run' bypassed the centralized caching and hardening logic of the unified fetcher.

**Action:** Replace sequential resource lookups with batch fetches (e.g., all ServiceAccounts in a namespace) using 'get_raw_resources' to reduce shell overhead from O(N) to O(1).

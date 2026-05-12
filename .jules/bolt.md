## 2025-05-14 - [NLP Matcher Optimization]
**Learning:** In high-frequency functions like the NLP matcher, local data structure allocation and repetitive fuzzy matching loops can significantly increase overhead. Flattening the search space and using a single `process.extract` call against a larger list is much more efficient than multiple `process.extractOne` calls in a loop, as it reduces transitions between Python and C-extensions in `rapidfuzz`.

**Action:** Always hoist static data structures to module constants and consolidate fuzzy matching calls where possible.

## 2025-05-15 - [Parallel Log Fetching]
**Learning:** Sequential log fetching via  for multiple pods (e.g., log correlation) creates a significant bottleneck that scales linearly with the number of pods. Since these are I/O-bound subprocess calls, parallelization using  reduces the total latency to that of the slowest single request.
**Action:** Use  for batch resource operations (logs, describe, etc.) across multiple pods. Always handle empty input lists to avoid  in .

## 2025-05-15 - [Parallel Log Fetching]
**Learning:** Sequential log fetching via `kubectl logs` for multiple pods (e.g., log correlation) creates a significant bottleneck that scales linearly with the number of pods. Since these are I/O-bound subprocess calls, parallelization using `ThreadPoolExecutor` reduces the total latency to that of the slowest single request.
**Action:** Use `ThreadPoolExecutor` for batch resource operations (logs, describe, etc.) across multiple pods. Always handle empty input lists to avoid `ValueError` in `max_workers`.

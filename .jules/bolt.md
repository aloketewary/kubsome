## 2025-05-14 - [NLP Matcher Optimization]
**Learning:** In high-frequency functions like the NLP matcher, local data structure allocation and repetitive fuzzy matching loops can significantly increase overhead. Flattening the search space and using a single `process.extract` call against a larger list is much more efficient than multiple `process.extractOne` calls in a loop, as it reduces transitions between Python and C-extensions in `rapidfuzz`.

**Action:** Always hoist static data structures to module constants and consolidate fuzzy matching calls where possible.

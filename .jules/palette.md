## 2025-05-16 - [ARIA Pattern for Command Palettes]
**Learning:** Command palettes require a specific ARIA pattern (combobox + listbox) to be accessible to screen readers, allowing them to track the active selection using `aria-activedescendant`.
**Action:** Always implement `role="combobox"`, `aria-activedescendant`, and `role="listbox"` when building interactive search-and-select components.

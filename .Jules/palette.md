## 2026-05-10 - [Keyboard Accessibility in Lists]
**Learning:** For complex lists with nested actions, both the list item and the action icons need independent keyboard support (tabindex, role, listeners). Crucially, action icons must stop event propagation to avoid triggering the parent item's primary action (like selection).
**Action:** Always add `$event.stopPropagation()` to keyboard listeners of nested interactive elements. Use `:focus-visible` with `box-shadow: inset` to provide clear focus indicators without shifting the layout.

## 2026-05-11 - [Consistency in Icon-Only Buttons]
**Learning:** This application frequently uses `<i>` tags as interactive elements. These must consistently have `aria-label`, `tabindex="0"`, `role="button"`, and both `(click)` and `(keydown)` listeners (handling both Enter and Space) to ensure they are accessible.
**Action:** When encountering icon-only interactions, verify they fulfill the full accessibility checklist (Label + Role + Tabindex + Click + Enter/Space Keyboard support).

## 2026-05-17 - [WAI-ARIA Combobox Pattern for Search]
**Learning:** For command palettes or search-and-select components, implementing the WAI-ARIA Combobox pattern is essential for screen reader accessibility. This involves setting `role="combobox"`, `aria-autocomplete="list"`, `aria-expanded`, and `aria-haspopup="listbox"` on the input, and linking it to a `role="listbox"` container via `aria-controls` and `aria-activedescendant`.
**Action:** Always implement full ARIA Combobox attributes when building search-and-select components. Ensure each result item has `role="option"` and a unique ID for `aria-activedescendant` mapping.

## 2026-05-10 - [Keyboard Accessibility in Lists]
**Learning:** For complex lists with nested actions, both the list item and the action icons need independent keyboard support (tabindex, role, listeners). Crucially, action icons must stop event propagation to avoid triggering the parent item's primary action (like selection).
**Action:** Always add `$event.stopPropagation()` to keyboard listeners of nested interactive elements. Use `:focus-visible` with `box-shadow: inset` to provide clear focus indicators without shifting the layout.

## 2026-05-11 - [Consistency in Icon-Only Buttons]
**Learning:** This application frequently uses `<i>` tags as interactive elements. These must consistently have `aria-label`, `tabindex="0"`, `role="button"`, and both `(click)` and `(keydown)` listeners (handling both Enter and Space) to ensure they are accessible.
**Action:** When encountering icon-only interactions, verify they fulfill the full accessibility checklist (Label + Role + Tabindex + Click + Enter/Space Keyboard support).

## 2026-05-15 - [Accessibility for Grid/Heatmap Cells]
**Learning:** Data-dense visualizations like heatmaps are often overlooked for accessibility. Treating each cell as an interactive button with `role="button"`, `tabindex="0"`, and `aria-label` providing the cell's data/meaning makes these features usable by keyboard and screen-reader users.
**Action:** When implementing grid or heatmap-like components, ensure every interactive cell has a clear focus state and keyboard listeners for Enter/Space.

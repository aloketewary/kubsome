## 2026-05-10 - [Keyboard Accessibility in Lists]
**Learning:** For complex lists with nested actions, both the list item and the action icons need independent keyboard support (tabindex, role, listeners). Crucially, action icons must stop event propagation to avoid triggering the parent item's primary action (like selection).
**Action:** Always add `$event.stopPropagation()` to keyboard listeners of nested interactive elements. Use `:focus-visible` with `box-shadow: inset` to provide clear focus indicators without shifting the layout.

## 2026-05-10 - [Keyboard Accessibility in Lists]
**Learning:** For complex lists with nested actions, both the list item and the action icons need independent keyboard support (tabindex, role, listeners). Crucially, action icons must stop event propagation to avoid triggering the parent item's primary action (like selection).
**Action:** Always add `$event.stopPropagation()` to keyboard listeners of nested interactive elements. Use `:focus-visible` with `box-shadow: inset` to provide clear focus indicators without shifting the layout.

## 2026-05-11 - [Consistency in Icon-Only Buttons]
**Learning:** This application frequently uses `<i>` tags as interactive elements. These must consistently have `aria-label`, `tabindex="0"`, `role="button"`, and both `(click)` and `(keydown)` listeners (handling both Enter and Space) to ensure they are accessible.
**Action:** When encountering icon-only interactions, verify they fulfill the full accessibility checklist (Label + Role + Tabindex + Click + Enter/Space Keyboard support).

## 2026-05-14 - [Granular Feedback for Copy Actions]
**Learning:** For components with multiple copyable elements (like step-based runbooks), a global "copied" state causes confusing UI updates across all items. Tracking the state per-item (e.g., in the item interface) provides precise visual feedback and improves the user's confidence that the correct content was copied.
**Action:** Use per-item boolean flags (e.g., `copied`, `outputCopied`) to toggle icons and tooltips for individual clipboard actions.

## 2026-05-19 - [Enhancing Command Palette Discoverability]
**Learning:** Users often search for Command Palette actions using the keyboard shortcuts they've already memorized. Making search logic whitespace-insensitive (e.g., "gp" matches "G P") and explicitly searching the hint/shortcut field allows users to navigate with minimal keystrokes.
**Action:** Always include navigation hints (shortcuts) in search indexes and normalize both query and index (remove whitespace/casing) for shortcut matching.

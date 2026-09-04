# UI Design System — Kubsome "SaaS Noir"

## Core Aesthetic: Cyberpunk Minimal / Cross-Grid

### Philosophy
- **No box fills** — cards are transparent, the dark canvas (`#0B0908`) runs continuously
- **Hairline rules** — 1px intersecting lines separate content, not rounded bordered boxes
- **Typography drives hierarchy** — large thin numbers (weight 300) draw the eye, tiny muted labels provide context
- **Warm palette** — amber/gold accents, never cold blue/cyan

---

## Color Palette

### Dark Mode (default)
```
--bg:             #0B0908       (warm near-black canvas)
--bg-card:        #110f0d       (barely different, mostly unused)
--bg-elevated:    #181412       (subtle lift)
--text:           #f5f0eb       (warm white)
--text-secondary: #a89e94       (warm gray)
--text-muted:     #6b6058       (brown-gray)
--accent:         #d09c60       (amber/gold)
--success:        #4ade80       (bright green)
--danger:         #f43f5e       (red)
--warning:        #f59e0b       (amber)
--purple:         #a78bfa       (lavender)
```

### Light Mode (`[data-theme="light"]`)
```
--bg:             #faf8f6       (warm cream)
--text:           #1a1412       (warm near-black)
--text-secondary: #5e544b       (warm brown-gray)
--text-muted:     #9a8e84       (warm taupe)
--accent:         #9a5129       (burnt orange)
--success:        #16a34a       (muted green, no glow)
--danger:         #dc2626       (muted red, no glow)
--warning:        #b45309       (dark amber)
--purple:         #7c3aed       (deep purple)
```

### Border Colors
```
Dark:   rgba(94, 84, 75, 0.06-0.20)   — warm brown at low opacity
Light:  rgba(0, 0, 0, 0.03-0.08)      — black at very low opacity
```

### Text Color Usage (dark mode rgba)
```
Primary:    rgba(245, 240, 235, 0.9)   — headings, hero values
Secondary:  rgba(245, 240, 235, 0.75)  — body text, names
Muted:      rgba(168, 158, 148, 0.5)   — labels, metadata
Disabled:   rgba(168, 158, 148, 0.4)   — hints, kbd shortcuts
```

---

## Border & Layout Rules

### Cross-Grid Hairlines
- Cards use `background: transparent` and `border: none`
- Separation via `border-bottom: 1px solid rgba(94, 84, 75, 0.06-0.08)`
- Vertical dividers: `border-left: 1px solid rgba(94, 84, 75, 0.08-0.15)`
- `border-radius: 0` everywhere (no rounded corners on containers)
- Status indicators (left accent): `border-left: 2px solid <color>` with 0.3-0.4 opacity

### Holo-Card (primary container)
- `::after` = horizontal hairline at top (full width)
- `::before` = vertical hairline at left (full height)
- Glow variants only intensify the `::after` color
- No background fill, no border, no border-radius

### Metric-Tile
- No background, no rounded corners
- Separated by `border-left: 1px solid rgba(94, 84, 75, 0.2)`
- First child has no left border
- Metrics strip: `gap: 0`, tiles sit flush

---

## Typography

### Hero Metrics
```css
font-family: 'JetBrains Mono', monospace;
font-size: 20-28px;
font-weight: 300;        /* thin geometric */
letter-spacing: -0.04em;
color: var(--text);
```

### Labels / Metadata
```css
font-size: 9-10px;
font-weight: 600-700;
text-transform: uppercase;
letter-spacing: 0.06-0.08em;
color: var(--text-muted);
```

### Body / Names
```css
font-family: 'JetBrains Mono', monospace;
font-size: 11-12px;
font-weight: 500;
color: var(--text-secondary);
```

---

## Interactive States

### Hover (dark)
```css
background: rgba(208, 156, 96, 0.02);   /* barely perceptible amber tint */
transform: translateY(-1px) or translateX(2px);
```

### Hover (light)
```css
background: rgba(0, 0, 0, 0.015);
```

### Active / Selected
```css
background: rgba(208, 156, 96, 0.04);   /* dark */
color: #d09c60;
box-shadow: inset 2px 0 0 #d09c60;      /* left accent bar */
```

### Focus-visible
```css
box-shadow: inset 0 0 0 1px rgba(208, 156, 96, 0.2-0.3);
```

---

## Glow & Effects

### Dark Mode Only
- Status beacons: `box-shadow: 0 0 4-6px <color>`
- Progress bars: `box-shadow: 0 0 3px <color> at 0.2-0.3 opacity`
- Accent bar on metric-tile: `box-shadow: 0 0 6px <color> at 0.4 opacity`

### Light Mode
- **No glow** — remove all `filter: drop-shadow()` and `box-shadow` glow
- Use solid muted colors without luminance effects

---

## Component Patterns

### Page Header
```html
<div class="intel-header">
  <div class="intel-title-block">
    <h1 class="intel-title"><span class="title-icon">◈</span> Title</h1>
    <p class="intel-subtitle">metadata · timestamp</p>
  </div>
  <div class="intel-controls">
    <app-live-indicator />
    <button class="ctrl-btn"><i class="pi pi-refresh"></i></button>
  </div>
</div>
```

### Metrics Strip
```html
<div class="metrics-strip">
  <app-metric-tile label="Label" value="42" accent="cyan" />
  ...
</div>
```
- `gap: 0`, tiles separated by left-border
- Bottom hairline: `border-bottom: 1px solid rgba(94, 84, 75, 0.15)`

### Data Rows
```css
border: none;
border-bottom: 1px solid rgba(94, 84, 75, 0.06);
background: transparent;
padding: 7-10px;
```

### Empty State
```html
<div class="empty-state">
  <div class="empty-icon"><i class="pi pi-..."></i></div>
  <span>Message</span>
  <span class="empty-hint">Hint</span>
</div>
```
- Icon: circular border, no fill (`border-radius: 50%; border: 1px solid`)

---

## Light Mode Override Pattern

Every feature `.scss` file must include:
```scss
:host-context([data-theme="light"]) {
  .title-icon { color: #9a5129; }
  // borders → rgba(0, 0, 0, 0.04)
  // hovers → rgba(0, 0, 0, 0.015)
  // accents → #9a5129 (burnt orange)
  // success → #16a34a (no glow)
  // danger → #dc2626 (no glow)
  // remove all box-shadow glow, filter: drop-shadow
}
```

---

## Files Using `var(--text)` (correct)
- dashboard.scss, pods.scss, events.scss, metrics.scss
- deployments.scss, jobs.scss, timeline.scss, namespace.scss

## Files That May Still Need Updates
Any `.scss` or inline `styles` using:
- `rgba(255, 255, 255, ...)` for text → replace with `var(--text)` / `var(--text-muted)`
- `#00d4ff` → replace with `#d09c60` (dark) / `#9a5129` (light)
- `#10b981` → replace with `#4ade80` (dark) / `#16a34a` (light)
- `border-radius: 10-16px` on containers → replace with `0`
- `background: rgba(13,17,28,...)` or `linear-gradient(...)` on cards → replace with `transparent`
- Missing `:host-context([data-theme="light"])` block


## Current Command-Center Layout Contract

The rules below are the current implementation contract for dense Kubernetes operations screens. They refine older visual guidance where operational readability requires bordered surfaces, restrained fills, or small radii. Reuse the structure and rhythm, not feature-specific class names or markup.

### Shell and Width

- Feature hosts use `display: block; width: 100%; max-width: 100%; margin: 0`.
- Let the application shell own outer gutters and sidebar offsets.
- Do not use `100vw`, negative viewport math, or sidebar-specific width calculations inside feature stylesheets.
- Keep page content `min-width: 0` so long resource names do not force horizontal overflow.

### Spacing Rhythm

Use an 8px-based rhythm with named page-local variables where a screen has multiple sections:

```scss
.page-root {
  --page-section-gap: 28px;
  --page-control-gap: 20px;
}
```

- Use 20px between adjacent controls or summary surfaces.
- Use 28px between major content sections or numbered operational surfaces.
- Use 12px below section headings before their data surface.
- Use 16px vertical padding for primary data rows when detail visibility matters.
- Use 10px to 14px for compact controls and toolbar padding.
- Avoid stacking unrelated margins on both parent and child. Prefer one parent-owned section gap.

### Operational Surface Pattern

- Keep major operational sections in a clear vertical flow unless the information architecture explicitly requires parallel comparison.
- Full-width data surfaces are preferred for names, status, metadata, and actions that must remain readable together.
- Use bordered or lightly tinted containers when they communicate grouping, selection, loading, or error state. Do not apply a card treatment to every nested element.
- Use one consistent radius scale per feature. `var(--radius)` is for primary surfaces and `var(--radius-sm)` is for compact controls and row groups.
- Use semantic state hooks such as `[data-status]`, selected classes, and warning or alert classes. State color must communicate real resource state, not decoration.

### Metrics and Filters

- Metrics strips sit 20px away from adjacent control surfaces.
- Metric tiles may use feature-specific responsive columns. Do not force a fixed tile count across features.
- Command bars should have a clear 20px separation from metrics and a 28px separation from the main resource list when no wrapper surface exists.
- Selection toolbars use their own grouped surface and sit 28px away from the resource list. Preserve keyboard focus, `aria-pressed`, and action grouping.

### Responsive Contract

Responsive breakpoints are page-specific because resource rows have different column contracts. Every multi-column layout must declare its collapse behavior.

- `1080px`: collapse wide hero or summary compositions and reduce metric columns where needed.
- `860px`: collapse resource table headings and move secondary metadata or actions below the primary identity when the row requires it.
- `768px`: simplify secondary controls and allow grouped headers to wrap.
- `640px`: use two-column metrics, stack selection toolbars, tighten row padding, and remove nonessential context.
- `520px`: move trailing progress or action content below the resource identity when necessary.

Do not add a breakpoint only to match another page. Preserve each feature's existing interaction and grid contract.

### Motion and Accessibility

- Keep hover and state transitions short and limited to background, border, color, transform, or opacity.
- Every animated state must have a `prefers-reduced-motion: reduce` override that disables transitions and nonessential animation.
- Preserve existing button hit areas, focus-visible outlines, live regions, dialog placement, and event propagation boundaries during visual updates.
- Loading, empty, error, retry, and pagination states are part of the layout contract and need spacing consistent with the successful state.

### Adoption Rules

- Start with feature-local CSS. Do not extract shared selectors or mixins until at least three features share the same DOM contract.
- Preserve feature behavior, template bindings, status values, event handlers, and API lifecycle code during spacing work.
- Jobs-specific telemetry, progress rails, and CronJob cards are optional treatments. Pods should keep its deployment grouping, status beacon, selection controls, and action grid.

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

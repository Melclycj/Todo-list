# UI Grounding — Premium Task App · 2026-06-20

> Status: READ-ONLY audit; no code was modified.
> All reference-app descriptions marked **[lower-confidence, knowledge-based]** — drawn from well-documented public design language, not a local corpus.

---

## 1. Reference Baseline

### Linear [lower-confidence, knowledge-based]

- **Color/contrast**: Near-black surface (`#0f0f0f` family) with pure-white text. Accent is a muted violet/purple — never saturated. Secondary surfaces are 1-step lighter than the main background. System states use semantic hues (amber for warning, green for done) at low saturation to avoid screaming.
- **Typography**: "Inter" (or a close variable-weight grotesque). Scale is tight: body ~13–14 px in list rows, section headers ~11 px uppercased. Strong weight contrast (400 body / 600 label / 700 page title). No serif pairing.
- **Spacing & density**: Ultra-dense. List rows are ~28–32 px tall. Padding inside rows is ~6–8 px vertical, 12 px horizontal. Section dividers are thin rules or simply a 4 px gap; no card chrome around individual items.
- **Elevation/depth**: Almost flat. A single subtle border separates columns/panels. Modals use a slight backdrop blur but no heavy drop-shadow card. The main surface itself has near-zero texture.
- **Motion**: Keyboard-first; transitions are 100–150 ms ease-out, mostly opacity + subtle translateY(4 px). Command-palette appears with a 120 ms fade+scale from 0.97→1. No decorative animation.
- **Empty/loading/error**: Skeletons match the exact row chrome; no pulsing blobs. Empty states use one clean icon + one line of text, no illustration. Errors surface inline within the row, not as modal toasts.

---

### Things 3 [lower-confidence, knowledge-based]

- **Color/contrast**: Native macOS-ish light (warm off-white `#f5f5f0` family) + bold color accents per area (coral Today, blue Anytime, purple Someday, etc.). High saturation for navigation landmarks, near-zero saturation for the content list area. Dark mode inverts cleanly.
- **Typography**: San Francisco (system) on macOS; on web equivalents, a humanist sans at ~14 px list body. Area titles use a large, relaxed weight (24–28 px bold). Notes field shifts to a slightly looser proportional size.
- **Spacing & density**: Medium density. Row height ~36–40 px. Generous left-indent for checkboxes. No horizontal rules between rows unless a date-group header is present.
- **Elevation/depth**: Sidebar has a barely-perceptible background lift (1-2 % luminance step). Content area is pure white. No shadows on cards; the sidebar/main split uses a border of ~1 px at ~12 % opacity.
- **Motion**: macOS-native spring physics for list inserts/removes. Checkbox animation is a custom draw-stroke (150 ms). Completed tasks slide-fade out in ~200 ms.
- **Empty/loading**: Minimal; a single sentence placeholder centered in the list. No illustration.

---

### Todoist [lower-confidence, knowledge-based]

- **Color/contrast**: Brand red used for project labels, priority dots, and primary CTA. The body UI is otherwise neutral — white content area, light sidebar at ~96 % white. Dark mode uses a cooler near-black.
- **Typography**: "Figtree" (recently) or "Roboto" before. Body ~14 px, task title ~14–15 px medium, due-date/meta ~12 px regular in muted. Strong use of weight and color to hierarchy within a single row (title > meta/label > flair).
- **Spacing & density**: Dense-medium. Row height ~32–36 px. Priority color dots flush left. Project label pill right-aligned. Very little whitespace between groups — only a 2 px rule or label header.
- **Elevation**: Flat by default. Quick-add input uses a 4 px corner shadow. No card chrome on list items.
- **Motion**: 150 ms check animation; completed tasks cross-out then fade in ~300 ms. Reorder drag uses a box-shadow lift (4–8 px blur).
- **Empty/loading/error**: Illustrated empty states (small vector art of a beach / star / etc.) — the one notable exception to premium minimalism in this set.

---

### Superhuman [lower-confidence, knowledge-based]

- **Color/contrast**: Dark-first (the product is famous for it). Near-black `#1a1a1a` family, warm not cold. Accent is a bright amber/gold used sparingly (keyboard shortcut hints, read/unread indicator). Text is a warm off-white, not pure `#ffffff`.
- **Typography**: "Graphik" or similar geometric grotesque. Tight tracking, 13–14 px body in thread rows. Subject lines are 500-weight; preview text is 400 in muted. "AI Triage" uses a distinct tint to separate inference from human signal.
- **Spacing & density**: The densest in this set. Rows are ~26–30 px. Padding is ~4 px vertical, 16 px horizontal. The product is explicit: "every pixel counts."
- **Elevation**: Practically none. Split-pane layout has a 1 px divider. Reading pane content area is white / near-black with zero drop-shadow chrome.
- **Motion**: The signature is keyboard-shortcut animations — brief highlight ripples, a split-second context flash, smooth row-advance. All transitions < 120 ms. Speed is the message.
- **Empty/loading/error**: "Inbox Zero" state is a key moment — a celebratory minimal illustration (a rocket or done badge) that appears only at zero. Otherwise errors are inline banners, never blocking modals.

---

### Height [lower-confidence, knowledge-based]

- **Color/contrast**: Neutral mid-gray canvas (~`#f8f8f8`) with a cooler dark sidebar (near-navy or near-black). Accent is a blue-purple spectrum. Status chips use full-saturation colors on white backgrounds.
- **Typography**: "Inter" at 13–14 px for list rows. Headers use a slight weight bump (600). Labels and metadata at 11–12 px. Column headers uppercase 10–11 px.
- **Spacing & density**: Dense-medium. Rows ~28–32 px. Tables use very tight row padding, board cards more generous. Gap between groups is a 6–8 px visual space, not a full separator.
- **Elevation**: Board view cards carry a subtle 1 px border + 0 px shadow by default, 4 px shadow on hover/drag. List view is flat.
- **Motion**: Drag-and-drop uses a quick scale-up (1.02) + shadow lift. Status transitions animate the chip fill. ~150–200 ms throughout.
- **Empty/loading/error**: Skeleton loaders match column widths exactly. Empty board columns show a dashed-border placeholder card.

---

### Notion [lower-confidence, knowledge-based]

- **Color/contrast**: White-dominant, system-font feel. Light sidebar at ~96 % white, slightly warm. The default body content width is constrained (~720 px) with generous page margin. Dark mode is a cool near-black.
- **Typography**: Mixed: page title uses a large serif ("Playfair" style in some themes) or a bold sans for default databases. Body content is ~16 px to support long reading. Database rows drop to ~14 px. Strong contrast between page-title hierarchy and body/table rows.
- **Spacing & density**: The widest variance — document pages are loose; table/database views go dense (rows ~28–34 px). Full-page database headers are generous (icon + cover image optional).
- **Elevation**: Near-zero in tables. Pages feel like paper — no drop-shadow card chrome. Inline menus get a 4 px shadow.
- **Motion**: Minimal deliberate motion. Cursor/selection highlight animates in ~100 ms. Page transitions are near-instant. The absence of motion is a design statement.
- **Empty/loading/error**: Empty database pages show a gentle "New page" prompt + keyboard shortcut hint. Errors surface as brief red inline text or a toast for network failures.

---

## 2. Distilled "Premium Task App" Design Principles

Across the six references, seven consistent principles emerge:

### P1 — Color: Neutral canvas, surgical accent
The primary surface is near-achromatic (light or dark). A single accent hue (blue, violet, amber, or coral) is used only for active state, CTA, and meaningful status. Avoid multiple competing accent colors. The "gray" in the gray scale should have a consistent warm or cool lean — not zero-saturation.

### P2 — Typography: Tight scale, weight as hierarchy
Body copy in list rows lands at 13–14 px (not 15–16 px for a dense task list). Weight is the primary hierarchy lever: 400 body, 500 label, 600–700 section/page title. Line-height in rows is 1.2–1.35, not 1.5 (1.5 is for reading text). A second type family (e.g. a display serif or a distinct grotesque) is optional but only meaningful at headers, never in list rows.

### P3 — Density: Task rows are compact
Premium productivity apps treat whitespace as a scarce resource inside the list pane. Row height 28–36 px is the sweet spot. Internal padding: 6–8 px vertical, 12–16 px horizontal. Section labels are 10–11 px uppercase, not the same scale as body. "Spacious" in these apps means the page title or empty area, not the list rows.

### P4 — Elevation: Flat list, lifted chrome only for actions
The list is flat — no per-item card shadow, no border-boxed cards. Elevation (subtle shadow, border, or backdrop blur) is reserved for: modals/drawers, quick-add inputs, drag feedback, command palettes. The sidebar/content split uses a thin 1 px border at low opacity, not a heavy shadow.

### P5 — Motion: Functional, sub-200 ms, opacity-first
Transitions communicate state change, not personality. Duration: 100–150 ms for micro-interactions (hover, selection), 200–250 ms for panel slides and list entry. Easing: ease-out cubic. Axes: opacity + small translateY (4–6 px) for entries; no scale unless it's a modal. Reduced-motion is honored.

### P6 — Depth via surface differentiation, not shadows
Depth is achieved by a 2–3 step luminance ladder (sidebar slightly off-canvas, canvas itself, card/popover above), not by stacking box shadows. Each step is a 2–5 % luminance shift, consistent hue family.

### P7 — States: Inline, minimal footprint
Empty states: one icon + one sentence, center-aligned. Loading: skeleton bars that match content geometry (not spinning blobs). Error: inline within the affected element, or a dismissible toast that does not block interaction. No full-page error overlays for recoverable states.

---

## 3. Candidate Visual Directions

### Direction A — "Slate Studio" (recommended)

- **Mood**: Clean, professional, editorial-cool. Confident without being flashy.
- **Palette direction**: Background off-white with a cool lean (220 hue, 3–4 % saturation). Sidebar one step darker (4–5 % saturation, same hue). Primary accent: a deep saturated blue-violet (hue ~240–250, 70–75 % saturation, 50–55 % lightness). Grays share the cool hue throughout — no warm/neutral/cool conflict.
- **Type pairing**: Inter as sole family. Tighten body to 13–14 px in list rows, bump page-title to 22–24 px 700. Sidebar labels 11 px uppercase 600.
- **Density level**: Dense — row height ~30–32 px, vertical padding 6 px.
- **Key differentiator**: The current app already runs Inter + blue primary — this direction sharpens it: colder grays, tighter type scale, dental-precise density. Lowest friction to implement.

---

### Direction B — "Warm Ink" (distinctive)

- **Mood**: Humanist, premium-notebook feel. Closer to Things 3 / Bear on the warmth axis.
- **Palette direction**: Background warm off-white (hue ~40, 3 % saturation, 99 % lightness). Sidebar warm gray (40 hue, 4–5 % sat). Accent: a terracotta-amber or deep amber-gold (hue ~35–38, 80 % sat, 52 % lightness). Text near-black with a warm lean (hue ~35, 10 % sat, 8 % lightness).
- **Type pairing**: Inter for UI chrome + a humanist serif (e.g. Lora, Source Serif 4, or Playfair) optionally for empty-state copy and page titles only.
- **Density level**: Medium-dense — row height ~34–36 px, slightly more breathing room than Slate Studio, to match the warmer personality.
- **Key differentiator**: Stands apart from the default blue-gray productivity app. Warm amber accent is memorable and friendlier than violet. Requires replacing the gray token family — medium effort.

---

### Direction C — "Graphite Night" (premium dark mode)

- **Mood**: Focused, professional dark. Superhuman-adjacent.
- **Palette direction**: Dark-first. Main canvas near-black warm (hue ~220, 6 % sat, 10–12 % lightness). Sidebar deeper (8–9 % lightness). Text warm off-white (0 % sat, 92–94 % lightness). Accent: electric indigo or bright violet (hue ~250, 85 % sat, 65 % lightness) — pops against the dark surface.
- **Type pairing**: Inter, same tight scale as Direction A.
- **Density level**: Dense — 28–30 px rows.
- **Key differentiator**: The current app has no dark mode; adding one is a separate engineering effort. This direction is the highest premium signal but also the highest implementation cost. Suitable as a Phase 2 target after the light theme is polished.

---

## 4. Current-App Gap Analysis

### Baseline facts (read from source)

| Token | Current value | Implication |
|---|---|---|
| `--background` | `220 2% 100%` — pure white, barely any hue | Reads as generic white-page, not premium off-white |
| `--muted` | `220 2% 96%` | Sidebar is only 4 % off background — almost invisible step |
| `--muted-foreground` | `220 2% 45%` | Gray text is near-achromatic — no hue identity |
| `--border` | `220 2% 90%` | Borders nearly invisible and hue-mismatched from foreground |
| `--primary` | `221 83% 53%` | Generic electric blue — high saturation, mid lightness. Not wrong, but unrefined. |
| `--accent` | `214 100% 94%` | Very light blue wash for active nav. Works but the saturation spike (100%) reads cheap. |
| `font-size: 15px body` | — | Too large for dense task rows; forces either tall rows or cramped text |
| `line-height: 1.5` | — | Document-reading value; in list rows this inflates row height |
| `--radius: 0.5rem` | — | 8 px radius — slightly chunky for a productivity app; 4–6 px is more refined |
| Nav active state | `border-l-2 border-primary rounded-l-none` | Functional but heavy-handed; the left-bar + accent fill + border-removal is triple-signaling |
| Sidebar width | bg-muted, same border treatment | The 2 % luminance step from main canvas makes sidebar invisible in the visual hierarchy |
| Animation | `fadeInRow` 0.3s ease-out | Duration is slightly long (200 ms would be sharper); only one animation defined |

### Gaps mapped to principles

| Principle | Gap | Severity |
|---|---|---|
| P1 Color | Gray tokens have <2% saturation — no hue identity; accent at 100% sat is visually cheap | High |
| P2 Typography | 15 px body + 1.5 line-height inflates row height; no scale differentiation for meta/label vs title | High |
| P3 Density | Without knowing row height from JSX: 15 px body + 1.5 lh → ~22 px line; padding in rows likely pushes to 40–48 px — too tall for dense productivity feel | High |
| P4 Elevation | Sidebar and main canvas have nearly identical background — no clear depth layer | Medium |
| P5 Motion | `fadeInRow` is the only motion; 300 ms is slightly sluggish; no hover micro-transitions evident in CSS | Low–Medium |
| P6 Depth | 2 % muted vs 100 % background: depth ladder is too shallow | Medium |
| P7 States | Cannot fully audit without TaskList.tsx and loading components, but `fadeIn` only suggests no skeleton strategy | Medium |

### Priority fixes for any direction

1. Reduce body `font-size` to 13–14 px for list context; keep 15 px for wider reading areas.
2. Drop `line-height` to 1.3–1.4 for list rows.
3. Inject 2–4 % saturation into the gray tokens (matching the chosen direction's hue lean) to give the palette a coherent hue identity.
4. Reduce `--radius` from 0.5 rem (8 px) to 0.25–0.375 rem (4–6 px) for tighter feel.
5. Replace `--accent: 214 100% 94%` with a lower-saturation tint (40–60 % sat) for the nav active fill.
6. Lift sidebar luminance step: `--muted` should be 3–5 % darker than background (not just 4 % lighter = nearly invisible).
7. Tighten `fadeInRow` to 180–200 ms and add a 100–120 ms ease-out on nav hover bg-color.
8. Simplify active nav indicator: pick either left-bar OR bg-fill, not both.

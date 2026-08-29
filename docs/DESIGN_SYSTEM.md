# CloseSync Brand & UI Design System

## 1. Design direction

CloseSync should feel:

- premium
- modern
- calm
- spacious
- professional
- trustworthy
- precise
- intentionally designed

The visual philosophy takes inspiration from the restraint, hierarchy, whitespace, and clarity associated with high-quality product design such as Apple and Google Antigravity, without copying either brand.

The logo is expressive. The application interface should be quieter.

**Brand expression:** vivid

**Product interface:** restrained

---

## 2. Typography

### Primary font

**Geist**

Fallback stack:

`Geist → Inter → system-ui → Segoe UI → Helvetica → Arial → sans-serif`

### Weight system

- 400 — body copy
- 500 — buttons, labels, navigation, compact UI
- 600 — headings and important values
- 700 — exceptional emphasis only

Avoid 800 and 900 in normal product UI.

### Type scale

| Role | Size | Weight | Line height |
|---|---:|---:|---:|
| Marketing display | 48px | 600 | 1.08 |
| Page title / H1 | 36px | 600 | 1.15 |
| H2 | 28px | 600 | 1.20 |
| H3 | 22px | 600 | 1.30 |
| H4 / card title | 18px | 600 | 1.35 |
| Large body | 16px | 400 | 1.55 |
| Default UI/body | 15px | 400 | 1.55 |
| Small UI | 14px | 400/500 | 1.45 |
| Metadata / caption | 12px | 400/500 | 1.40 |

### Typography rules

- Use tighter letter spacing for large headings.
- Keep body text neutral and easy to scan.
- Do not create arbitrary intermediate text sizes unless required by a reusable component.
- Use font weight to create hierarchy before introducing another colour.
- Avoid excessive bold text.

### Application implementation

- Geist is loaded in `index.html` alongside Inter as the documented web-font fallback.
- Tailwind's `font-sans` utility resolves to `var(--cs-font-sans)`.
- Caveat is retained only for handwritten signature rendering.
- Exported proposal documents may keep document-specific typography until their templates are migrated and visually re-approved.

---

## 3. Brand colour system

The CloseSync logo moves through blue, violet, and magenta.

### Core brand colours

- **Brand Blue:** `#2458FF`
- **Brand Violet:** `#7A3CFF`
- **Brand Magenta:** `#F000FF`

### Functional primary

The central violet is the primary product colour.

- **Primary:** `#7A3CFF`
- **Primary Hover:** `#6930F3`
- **Primary Active:** `#5823D9`

### Brand gradient

`linear-gradient(135deg, #2458FF 0%, #7A3CFF 52%, #F000FF 100%)`

Use the full gradient sparingly.

Suitable:
- logo
- selected marketing accents
- restrained AI indicators
- occasional premium brand moments

Avoid:
- ordinary cards
- every CTA
- large dashboard backgrounds
- standard form fields
- table rows
- excessive decorative blobs

---

## 4. Soft brand tints

### Blue
- Blue 50 — `#EEF3FF`
- Blue 100 — `#DCE7FF`

### Violet
- Violet 50 — `#F5F1FF`
- Violet 100 — `#E8DDFF`
- Violet 200 — `#D5C2FF`

### Magenta
- Magenta 50 — `#FFF0FF`
- Magenta 100 — `#FFD9FF`

Use these for:
- selected badges
- active navigation states
- subtle callouts
- AI surfaces
- low-emphasis brand highlighting

---

## 5. Neutral UI palette

Most of the interface should use neutrals.

### Backgrounds

- Page — `#FFFFFF`
- Subtle — `#F8F9FB`
- Muted — `#F3F4F6`
- Elevated — `#FFFFFF`
- Strong dark surface — `#111318`

### Text

- Primary — `#111318`
- Secondary — `#5F636D`
- Tertiary — `#8B909A`
- Disabled — `#ADB1B8`
- Inverse — `#FFFFFF`

### Borders

- Subtle — `#ECEEF1`
- Default — `#E1E4E8`
- Strong — `#CDD1D7`

### Colour balance

As a rough visual rule:

- 70–80% neutral surfaces
- 15–20% restrained brand interaction/accent
- 5% or less expressive gradient/blue/magenta moments

This is a principle, not a literal measurement requirement.

---

## 6. Semantic colours

Semantic states should remain distinct from brand colours.

### Success
- Main — `#16875D`
- Background — `#ECF8F3`
- Border — `#BCE8D5`

### Warning
- Main — `#B56A00`
- Background — `#FFF7E8`
- Border — `#F3D39A`

### Error
- Main — `#D92D20`
- Background — `#FFF1F0`
- Border — `#F5C2BE`

### Information
- Main — `#2563EB`
- Background — `#EFF6FF`
- Border — `#BFDBFE`

Do not use violet as a substitute for success, error, or warning.

---

## 7. Spacing

Use a 4px base system.

- 4px — tiny internal gap
- 8px — compact gap
- 12px — control/internal spacing
- 16px — standard spacing
- 20px — medium component spacing
- 24px — card/content padding
- 32px — larger groups
- 40px — section separation
- 48px — major internal separation
- 64px — page/marketing separation
- 80px — large section separation
- 96px — marketing section separation

### Spacing principle

Prefer whitespace before adding another container, border, or background.

---

## 8. Radius system

- XS — 6px
- SM — 8px
- MD — 10px
- LG — 14px
- XL — 18px
- Full — 9999px

### Recommended usage

- Small controls / menu items — 6–8px
- Buttons / inputs — 8px
- Dropdowns — 10px
- Cards — 14px
- Modals / major floating surfaces — 18px
- Pills / avatars — full radius

Avoid making every element heavily rounded.

---

## 9. Shadows

CloseSync should not depend on shadows for hierarchy.

### Shadow levels

**XS**

Very subtle card/surface lift.

**SM**

Menus or interactive cards.

**MD**

Dropdowns and floating panels.

**LG**

Modals or major overlays.

Ordinary dashboard cards should generally use a subtle border with no shadow or XS shadow.

Avoid:
- large soft shadows around every card
- strong coloured shadows
- permanent floating appearance across the whole dashboard

---

## 10. Buttons

### Primary

Use for the dominant action in a section.

- violet background
- white text
- 8px radius
- medium weight
- approximately 40px default height

Examples:
- Create proposal
- Add client
- Send invoice

Do not place several visually equal primary buttons beside each other unless genuinely necessary.

### Secondary

- white background
- dark text
- subtle border

### Ghost

- transparent background
- secondary text
- subtle neutral hover state

### Destructive

- error colour
- only for destructive actions

### Button hierarchy

Primary → Secondary → Ghost

The visual hierarchy should match the importance of the action.

---

## 11. Inputs and forms

Inputs should be:

- white
- subtle grey border
- 8px radius
- approximately 42px height
- 14px text
- clearly labelled
- restrained violet focus ring

Labels:
- 14px
- 500 weight
- primary text

Placeholder:
- tertiary text

Form sections should use spacing before adding boxes around every group.

---

## 12. Cards and surfaces

### Default card

- white
- subtle border
- 14px radius
- 24px padding
- no shadow or XS shadow

### Important rule

**Not everything is a card.**

Before placing content inside a card, ask whether it could be structured using:

1. whitespace
2. typography
3. alignment
4. dividers
5. section backgrounds

Use cards when information genuinely belongs inside a contained object.

Avoid nested cards unless there is a clear interaction or information hierarchy.

---

## 13. Navigation

### Sidebar

- neutral white/subtle background
- subtle right border
- 14px labels
- medium weight
- simple outline icons

### Default nav item

Secondary text.

### Hover

Subtle neutral background + primary text.

### Active

Violet 50 background + primary violet text/icon.

Avoid:
- gradient active nav items
- large shadows
- bright coloured sidebar backgrounds
- many competing badge colours

---

## 14. Tables and data-dense UI

Tables should prioritise scanning.

- subtle outer border where useful
- restrained header background
- 12–14px labels
- 14px body text
- light row dividers
- very subtle hover state
- no alternating saturated row colours

Status should use semantic pills rather than coloured table backgrounds.

---

## 15. Badges

Badges should be compact and quiet.

Use:
- neutral
- primary
- success
- warning
- error

Avoid unnecessary badges. If plain text communicates the information clearly, use plain text.

---

## 16. Icons

Use one consistent icon library.

Preferred style:
- clean outline icons
- consistent stroke width
- restrained sizing

Avoid mixing:
- filled icons
- outline icons
- emoji
- multiple unrelated icon libraries

Icon colour should normally inherit the surrounding text colour.

---

## 17. AI-specific design language

AI is one of the few areas where CloseSync can become slightly more expressive.

Permitted:
- violet tint
- subtle brand-gradient border/accent
- gradient icon treatment
- small AI badge
- extremely light gradient wash

Keep AI experiences integrated with the rest of the product rather than turning them into a separate neon visual system.

---

## 18. Page hierarchy

Typical application page:

1. Page title
2. Short supporting description if needed
3. Primary page action
4. Main content
5. Secondary content

Page headers should have breathing room.

Do not overcrowd the top of the page with:
- multiple banners
- many buttons
- excessive badges
- large cards
- decorative graphics

---

## 19. Motion

Motion should feel quick and functional.

Suggested timing:

- Fast — 120ms
- Normal — 180ms
- Slow — 260ms

Use motion for:
- hover feedback
- menu opening
- modal transitions
- small state changes

Avoid motion that delays normal use.

Respect `prefers-reduced-motion`.

---

## 20. Accessibility

Always preserve:

- visible keyboard focus
- sufficient contrast
- readable body text
- semantic HTML
- correct labels
- touch-friendly controls
- reduced-motion preferences

Do not communicate state through colour alone.

---

## 21. Responsive behaviour

Desktop design must not simply shrink onto mobile.

On smaller screens:

- reduce page padding
- stack page-header content
- preserve readable control sizes
- allow tables to scroll or use suitable responsive patterns
- collapse navigation appropriately
- retain hierarchy and whitespace

Do not remove essential information purely to make a layout fit.

---

## 22. Visual anti-patterns

Avoid the generic AI-generated SaaS look.

Do not default to:

- a rounded card around every section
- gradient buttons everywhere
- glowing borders
- glassmorphism
- oversized shadows
- too many pills
- excessive icon containers
- purple backgrounds across large areas
- arbitrary colour variations
- unnecessarily large hero copy inside application screens
- excessive 700–900 font weights
- random 17px/19px/21px one-off font sizes
- one-off radii
- one-off shadows
- decorative elements without purpose

---

## 23. Decision rule for new UI

When Codex needs to design something new:

1. Search the application for an existing equivalent.
2. Reuse the existing component when possible.
3. Use the design tokens.
4. Match surrounding density and hierarchy.
5. Introduce a new reusable pattern only if necessary.
6. If a reusable design pattern is introduced, document or tokenise it rather than duplicating local styling.

**Consistency overrides novelty.**

---

## 24. Implementation contract

The implementation lives in `src/styles/closesync-design-system.css`.

- All CloseSync tokens use the `--cs-*` prefix.
- Shared design-system classes use the `cs-*` prefix.
- Tailwind/shadcn semantic theme variables such as `--background`, `--primary`, `--card`, and `--success` remain in `src/index.css`. They use HSL channel values and must not be replaced by hex-valued CloseSync tokens.
- Existing dark and light themes remain supported. New UI should use semantic shadcn colours for theme-aware surfaces and CloseSync brand tokens for intentional brand moments.
- Reusable primitives in `src/components/ui/` consume the typography, radius, shadow, and motion tokens. Prefer those primitives over page-local equivalents.
- Existing one-off values are legacy migration candidates, not permission to add more. Normalise them only when their owning component is being intentionally changed and regression-tested.

# VASCUSCAN AI — Medical Dark Dashboard Design

## Purpose & Context
Real-time cardiovascular monitoring platform for clinical signal collection and AI-powered risk assessment. Users are healthcare professionals and researchers monitoring patient vitals under time-sensitive conditions. The interface must convey trust, precision, and immediate readability.

## Tone
**Minimalist clinical precision** — no decorative elements, only functional layers. Dark, professional, surgical. Every visual element serves data clarity.

## Differentiation
Fine grid overlays on waveform backgrounds create a "sensor display" aesthetic. Semantic medical color badges (green=normal, yellow=warning, red=critical) replace generic status indicators. Cyan accent (#00d4ff) signals active monitoring and primary CTAs. Card-based elevation system with deliberate surface hierarchy.

## Color Palette (OKLCH — Dark Mode Only)

| Token | L C H | Usage |
|-------|-------|-------|
| background | 0.09 0 0 | Primary surface (#0a0e1a-equivalent) |
| card | 0.13 0 0 | Secondary surfaces, elevated panels |
| border | 0.20 0 0 | Fine grid lines, subtle dividers |
| foreground | 0.96 0 0 | Primary text (near white) |
| muted-foreground | 0.50 0 0 | Secondary text labels |
| accent/primary | 0.68 0.24 198 | Cyan (#00d4ff-equivalent) — active states, highlights |
| medical-green | 0.65 0.22 138 | Normal status badges |
| medical-amber | 0.68 0.20 62 | Warning status badges |
| medical-red | 0.60 0.22 25 | Critical status badges |
| medical-purple | 0.68 0.22 300 | Blood pressure accent |
| medical-yellow | 0.72 0.20 84 | Pulse transit time accent |

## Typography
- **Display/Body**: Figtree (balanced, readable, medical-grade sans-serif)
- **Mono**: JetBrainsMono (data labels, metric values, timestamps)
- **Scale**: 12px labels → 14px body → 16px section titles → 24px vital values
- **Weight**: 400 regular, 700 bold for hierarchy

## Shape Language
- **Border-radius**: 6px (cards, badges), 3px (buttons, inputs), 0px (icons)
- **Spacing**: 8px base unit (grid, padding, gaps)
- **Shadows**: Minimal, only depth for card elevation — `0 2px 8px rgba(0,0,0,0.3)`

## Structural Zones

| Zone | Background | Border | Depth |
|------|------------|--------|-------|
| Header | `card` | `border-b` | Elevated |
| Sidebar (patient info) | `card` | `border-r` | Elevated |
| Main content (waveforms) | `background` with `waveform-grid` overlay | `border` | Neutral |
| Right panel (vitals) | `card` per section | `border` | Elevated |
| Badges/alerts | `medical-*` at 10–15% opacity | `medical-*` at 100% | Overlay |

## Component Patterns
- **Cards**: Rounded 6px, `bg-card`, `border border-border`, padding 12px
- **Badges**: Semantic color at 15% opacity background + 100% color text, 12px text, 6px radius
- **Vital boxes**: Icon (colored square 24×24px) + label (12px muted) + value (24px bold, medical accent) + ±buttons
- **Waveform backgrounds**: `waveform-grid` utility (fine 20px × 20px grid overlay at 30% opacity)
- **Buttons**: `bg-primary` (cyan) for primary, `bg-destructive` (red) for STOP, `border border-border` for secondary
- **Text**: Foreground for headings/data, muted-foreground for labels, medical-* colors for status

## Motion
None — clinical interface prioritizes data stability over animations. Only hover states for interactive elements (opacity +10%, no transitions).

## Constraints
- **Contrast**: AA+ (minimum 7:1 foreground/background)
- **Responsive**: Desktop/tablet; fixed layout optimized for monitoring stations
- **Real-time**: No animation overhead; grid and waveforms render natively
- **No decoration**: Zero gradients, blur, or glassmorphism — purity over visual richness

## Signature Detail
Grid overlay on waveform backgrounds (`waveform-grid` utility) creates sensor-like authenticity. Semantic medical color coding replaces generic status — hospitals recognize green/yellow/red instantly. Elevated card system (three-tier depth) guides eye hierarchy without decoration.

---
version: "1.0"
name: "RevPARMAX"
endpoint: "/design.md"
description: "The revenue command center for multi-property operators. A calm, instrument-grade system where the interface stays quiet and the numbers that move money are the only elements wearing color."
stack:
  framework: "TanStack Start + React 19"
  styling: "Tailwind v4 (CSS-first tokens)"
  primitives: "shadcn/ui on @base-ui/react"
  charts: "recharts"
  icons: "lucide-react"
themeing: "token-based; toggle .dark on <html>"
routes:
  guide: "/design"
  brand_kit: "/brand"
  spec: "/design.md"
colors:
  ember-50: "#FFEDE6"
  ember-200: "#FFC3AD"
  ember-500: "#FF5A2C"   # core beacon → --primary
  ember-600: "#DF440F"   # text on light → --accent-foreground
  ember-800: "#A8330B"
  ember-bright: "#FF7E54" # dark-mode accent
  light-bg: "#F4F2EC"
  light-surf: "#FFFDF9"
  light-surf2: "#FBF8F1"
  light-line: "#E7E1D5"
  light-mid: "#7D756A"
  light-ink: "#1A1714"
  dark-bg: "#0F100E"
  dark-surf: "#171814"
  dark-surf2: "#21221C"
  dark-mid: "#928F86"
  dark-ink: "#F3F2EE"
  pos-light: "#2E9E68"
  pos-dark: "#46C489"
  neg-light: "#D8453B"
  neg-dark: "#F2685E"
tokens:
  # shadcn semantic vars these brand colors map onto (see index.css)
  primary: "ember-500"
  primary-foreground: "#FFFFFF"
  background: "light-bg / dark-bg"
  card: "light-surf / dark-surf"
  accent: "ember-50 / ember wash"
  ring: "ember-500"
  destructive: "neg"
  chart-1: "ember"        # focus series
  chart-2: "mid neutral"
  chart-3: "positive"
  chart-4: "negative"
  chart-5: "low neutral"
typography:
  display: { fontFamily: "Space Grotesk", weights: "500/600", use: "headings, hero numerals" }
  body: { fontFamily: "Hanken Grotesk", weights: "400-800", use: "UI & long-form" }
  mono: { fontFamily: "IBM Plex Mono", weights: "400-600", use: "every number, label, metadata" }
rounded:
  sm: "8px"   # controls, tags, inputs
  md: "12px"  # menus, segmented
  lg: "16px"  # metric/chart/ledger cards
  xl: "22px"  # primary layout boundaries
  pill: "100px"
spacing: { base: "4px grid" }
motion:
  principle: "Calm by default; charts earn one expressive 'ignite' beat on reveal."
  patterns: ["draw-on lines", "fade-up confidence band", "ember glow on live edge", "count-up numbers"]
  reveal: "useReveal() adds data-lit; CSS .rpm-* animates"
  reduced_motion: "honored — final state shown instantly"
components:
  button-primary: { backgroundColor: "{colors.ember-500}", textColor: "#FFFFFF", rounded: "{rounded.md}" }
  button-soft: { backgroundColor: "{colors.ember-50}", textColor: "{colors.ember-600}", rounded: "{rounded.md}" }
  badge-live: { backgroundColor: "{colors.ember-50}", textColor: "{colors.ember-600}", rounded: "{rounded.pill}", indicator: "matching dot" }
  metric-card-focus: { glow: "radial ember-wash", deltaColor: "{colors.ember-600}", rounded: "{rounded.lg}" }
---

## Overview

Instrument-grade clarity meets calm minimalism. RevPARMAX is a flight deck for hospitality revenue managers: warm, low-contrast neutral surfaces frame critical, high-frequency data, and color acts purely as an intentional beacon — signaling movement, interaction, and priority.

This document is the machine-readable contract for the design system, served at `/design.md` for LLMs and agents. The visual reference is at `/design`; the brand kit at `/brand`.

## Colors

Warm neutrals carry ~95% of the surface area; **Ember (`#FF5A2C`)** is the single brand accent — it marks the live signal, the focal metric, and the primary action, nothing more. Functional **green/red** are bound strictly to directional data and kept slightly desaturated so ember always wins the eye. Backgrounds use warm Paper/Surface (light) and Deep Charcoal (dark) — never pure white or black.

In code, brand colors map onto the shadcn semantic tokens in `index.css` (`--primary` = ember, `--background` = paper, etc.), so every shadcn component adopts the brand automatically. Brand-specific utilities (`text-ember`, `bg-surface-2`, `text-mid`) are exposed via `@theme inline`.

## Typography

Three roles, no overlap. **Space Grotesk** for display moments, **Hanken Grotesk** for everything you read, **IBM Plex Mono** for every number so figures align like a ledger (always tabular-nums).

## Layout & Shape

Strict 4px spacing grid. Rounded, architectural geometry: `sm` (8px) controls, `md` (12px) menus, `lg` (16px) cards, `xl` (22px) layout boundaries, `pill` for status. Depth is structural — one soft warm shadow in light, thin borders + localized ember glow in dark.

## Motion

Calm by default; charts earn one expressive beat — they **ignite** on reveal: lines draw on, the confidence band fades up, the live edge glows ember, headline numbers count up. Motion is spent like the accent color — on the thing that matters — and fully honors `prefers-reduced-motion`.

## Components

Built on shadcn/@base-ui primitives with `cva` + `cn` + `data-slot`. One primary ember action per screen; everything else neutral. Tags carry a matching indicator dot. Cards always sit on a solid `card` surface. Charts are recharts wrappers themed via `--chart-*` tokens with the light-up motion baked in.

## Do's and Don'ts

- **Do** keep numbers in `IBM Plex Mono`, tabular, for ledger alignment.
- **Do** use Paper/Surface instead of pure white in light mode.
- **Don't** use ember for secondary actions, body text, or decoration.
- **Don't** let patterns run edge-to-edge; fade them toward margins.
- **Don't** rotate, tilt, or gradient the "Apex" logomark.

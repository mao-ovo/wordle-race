# Visual Design Guardrails (Zero-Slop Rule)

- BANNED: Do not use decorative emojis as UI icons (e.g., no "🚀 Launch", "✨ Features", "🔥 Stats").
- ICONS: Exclusively use Lucide Icons (`lucide-react`) or Phosphor Icons with consistent 16px/20px sizing and 1.5px stroke width.
- COLOR PALETTE: Neutral-first. Base the theme on zinc/slate scales. Limit accents to a single muted primary (e.g., #0F172A slate or #2563EB clean blue). Never default to dark-mode violet/purple neon gradients.
- COMPONENT LIBRARY: Use shadcn/ui and Tailwind CSS primitives. Do not invent inline styles or arbitrary ad-hoc CSS classes.
- TYPOGRAPHY: Strict scale: 12px (metadata), 14px (body/inputs), 16px (subtitles), 20px-24px (titles). No unformatted display fonts.
- DENSITY: Aim for software density (compact tables, defined borders `border-border/60`), not marketing-page floatiness.

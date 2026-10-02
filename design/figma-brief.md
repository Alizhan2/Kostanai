# Allur Plant Twin — Figma design brief

Scope: composed product screens and the reusable components they require; no full unrelated UI library.

## Screens

- Desktop overview, 1440 px: navigation, shift, scenario controls, production KPI, site map, incident panel, buffer forecast, trend chart and line table.
- Desktop incidents: incident history and suggested intervention.
- Desktop lines: throughput, capacity, production, downtime and state.
- Desktop quality: first-pass quality by production area.
- Desktop reports: shift summary, export actions and intervention journal.
- Mobile overview, 390 px: compact navigation, stacked sections, KPI in two columns.

## Product language

Russian interface. Synthetic data and conditional facility map must be identified. Risk index is a score, not a calibrated probability. Use the shortage example: buffer 12 kits, consumption 20/h, delivery 4/h, horizon 45 minutes, risk 75/100.

## Foundations

Source font: Arial (the last CSS overrides earlier DM Sans/Manrope declarations). Keep Arial when available; select a verified closest substitute only if it is unavailable and document that substitution.

Color tokens from styles.css: background #f5f6f8, panel #ffffff, ink #18212c, muted #8993a0, divider #e9edf1, navigation #141c26, accent #cbf36b, success #27a878, warning #f0a43a, danger #e56d64, info #5389d8. Secondary labels may be darkened in the design for readability.

Components needed: button (primary/secondary), navigation item (active/default), filter (selected/default), status badge (running/warning/stopped), KPI card, incident row, section header, line table row, map zone. Bind reusable colors/spacing/radius to variables. Repeated text roles use text styles.

## Acceptance

Native editable text and layers; reusable components and instances; auto layout for related content; no full-screen raster in any delivered frame. Check fonts, descendants, image-filled nodes and one composition screenshot. Interactive navigation between the main desktop frames if supported.

## Discovery already complete locally

No Code Connect files exist for the needed components in this repository. The app has no external content images; its logo and avatars are text/shapes, its map and graph are CSS/SVG. The source screenshot is visual reference only.

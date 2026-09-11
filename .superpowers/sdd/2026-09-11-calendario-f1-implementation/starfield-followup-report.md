# Starfield follow-up

Implemented the animated starfield from the reference: perspective stars advance toward the viewer, grow with closeness, twinkle with per-star phase, respond subtly to pointer position, and recycle when leaving the viewport. Reduced-motion mode draws a stable snapshot with no animation loop.

Focused tests were added for reduced-motion behavior and depth-driven movement. The local `pnpm vitest` command could not run because Vitest is not available in the project executable environment (`vitest is not recognized`).

Round 1 alignment: ported maxDepth 1500, focal length from viewport, 320–760 density range, smoothed pointer targets, and reduced-motion pointer listener behavior. Movement test now seeds Math.random for stable same-star radius comparison.

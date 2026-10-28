# Greg Chlosta: portfolio

A small 3D valley you explore on a dirt bike. Each of the 8 stops tells you something about me. A plain "classic view" holds the same content for anyone who'd rather just read (it's also the fallback when WebGL isn't available).

Built with Vite, TypeScript and Three.js. Every model is procedural, so there are no assets to download.

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build into dist/
```

## Edit content

All text, links and station colours live in [`src/content.ts`](src/content.ts).

| File | What it does |
| --- | --- |
| `src/world.ts` | Terrain, sky, Rockies, Calgary skyline, forest, campfire |
| `src/models.ts` | Bike, car and the 8 station props |
| `src/rider.ts` | Arcade bike physics |
| `src/main.ts` | Scene setup, stations, camera, game loop |
| `src/ui.ts` / `src/style.css` | Intro, HUD, fact cards, classic view |

## Deploy (Vercel)

Import the GitHub repo in Vercel. It auto-detects Vite (build `npm run build`, output `dist`), so no config is needed.

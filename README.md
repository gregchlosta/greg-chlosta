# Greg Chlosta — Portfolio

Live at **[gregchlosta.tech](https://gregchlosta.tech/)**.

A small 3D valley you explore on a dirt bike, introduced by a cartoon 3D version of me. Each of the 8 stops tells you something about me. A plain "classic view" holds the same content for anyone who'd rather just read (it's also the fallback when WebGL isn't available).

Built with Vite, TypeScript and Three.js. Every model is procedural, so there are no external 3D assets to download.

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build into dist/
npm run preview  # preview production build locally
```

## Edit content

All text, links and station colours live in [`src/content.ts`](src/content.ts).

| File | What it does |
| --- | --- |
| `src/main.ts` | Entry point, WebGL detection, lazy-loads the 3D scene |
| `src/valley.ts` | Scene setup, bloom composer, stations, camera, game loop |
| `src/world.ts` | Terrain, sky, Rockies, Calgary skyline, forest, campfire |
| `src/models.ts` | Bike, car and the 8 station props |
| `src/avatar.ts` | Greg's cartoon 3D head on the landing screen (follows the pointer, blinks) |
| `src/rider.ts` | Arcade bike physics |
| `src/effects.ts` | Instanced particle system (dust, discovery bursts) |
| `src/input.ts` | Keyboard input handler |
| `src/ui.ts` / `src/style.css` | Intro, HUD, fact cards, classic view |

## Deploy (Vercel)

Import the GitHub repo in Vercel. It auto-detects Vite (build `npm run build`, output `dist`), and `vercel.json` handles permanent redirects from `gregchlosta.vercel.app` to `https://gregchlosta.tech` along with security and caching headers.

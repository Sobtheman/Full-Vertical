# Full Vertical — website

Homepage for Full Vertical (never "LLC"), a creative technology studio. One page, seven sections, plus contact form and footer.

## Source of truth
- `references/01-hero.png … 07-contact.png` are the approved designs. Match them. Do not redesign.
- Copy in `index.html` is approved. Do not rewrite it. Stage descriptions in `src/main.js` (`stages`) are a draft awaiting approval.
- Palette lives in CSS variables at the top of `src/styles.css`.
- Logo: `public/art/logo-fv*.png` is a placeholder cut from `references/logo-fv-minimal.webp`. Final logo pending.

## How we work
- Discuss first, build on Sebastian's go. Change one section at a time. Never rewrite the whole site for one element.
- Work on the `work` branch. Never push to a live branch or deploy without his OK.
- No invented clients, numbers, history or results.
- Test in the browser at 1440 and 390 before saying something works.

## Running it
- No build step and nothing to install. Preview: `scripts/serve.ps1` (plain PowerShell) serves the folder at http://localhost:5173, with `public/` as fallback.
- Sebastian does not want software installed on his computer. Do not install Node or anything else without asking.
- `tests/` (Playwright) and `scripts/make-plates.mjs` need Node; run them only where Node already exists (cloud/CI). Locally, verify in the browser pane.
- `ribbon.html` is a test page for the live ribbon (`src/ribbon.js`). It is not part of the site yet.

## Layout notes
- Desktop sizes use `calc(N * var(--u))`, where N is pixels in the 1672px-wide reference.
- At 1000px and below, `--u` is 1px and the mobile rules at the bottom of `src/styles.css` take over.

## Not connected yet (`src/config.js`)
- `bookingUrl`, `contactEndpoint`, `social.*` are empty. The site says "not connected" instead of faking it.
- Run the Claude Security plugin before the form goes live.

## Provisional art
Everything in `public/art/` is cropped from the low-res references (1672×941). Project images are generated concept images, not client photography. Clean high-res art is still needed.

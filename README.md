# Ivan Arena — portfolio

A static, white-on-black portfolio with selected photography, books and published writing. No frontend framework, runtime dependencies, tracking or external font requests.

## Develop

Requires Node.js 24 and Python 3.

```sh
npm ci
npx playwright install chromium
npm run preview
```

Open http://127.0.0.1:4173. `npm run preview` builds the public site and serves `dist/`; `npm run serve` serves an existing build.

```sh
npm test          # Build, then run desktop/mobile tests
npm run build    # Export the production site to dist/
```

Tests use Chromium. Set `CHROMIUM_PATH` to use an existing installation. All public-site tests run from a clean checkout; the additional original-file integrity test runs only when private source images are available locally.

## Deployment

**Only `dist/` is deployable. Never serve the repository root.**

The GitHub Actions workflow in `.github/workflows/deploy.yml` tests pull requests and deploys successful builds of `main` to **https://ivanarena.github.io/art/**. GitHub Pages must use **GitHub Actions**, not branch-root publishing.

The build copies only explicitly referenced public files, rather than entire asset directories. Originals, application archives, development metadata, fonts, scripts, templates, Git files and stray files beside previews cannot enter the deployment artifact. Public URLs are content-versioned so changed images and styles do not reuse stale caches. `.nojekyll` marks the output as plain static files.

## Pages

- **Home**: an indented editorial introduction. A small portrait follows the normal cursor on fine-pointer desktops above 900px; it never intercepts clicks. Reduced motion uses a stationary desktop image. Phones, coarse-pointer devices and narrow windows show no portrait.
- **Selected works**: three series and a Books entry. Hover or visible keyboard focus shows one decorative preview ribbon at a time. Hover takes priority over restored focus after Back/Forward navigation. Books is not in the navbar.
- **Series pages**: original project paragraphs and references beside a large, horizontally browsable image ribbon. Text and images stack on phones. Artwork is not clickable and never opens a fullscreen viewer.
- **Books**: the title list shares the exact four-row layout, margins and height of Selected works. On mobile, previews follow the full-height list rather than squeezing it. The books stay in one large, vertically centred horizontal row. Hover or keyboard focus turns a cover; selecting a book replaces the text list with only its description and purchase link. Close or Escape restores the list and keyboard focus. Static descriptions remain readable without JavaScript.
- **Elsewhere**: three verified published poems, with publisher links and dates. Development verification is in `docs/published-writing.md`; that file is not deployed.

Every page has the same fixed, full-width navbar: Home / Selected works / Elsewhere / Instagram / Email. Page-label headings remain accessible but visually hidden.

## Content and assets

- `series.json`: public project descriptions and references, preserved verbatim from the artist-provided material. Preserve original wording, punctuation and the title spelling **Alexythimia**.
- `artwork-metadata.json`: explicit selection and credits, keyed by private source filename.
- `works.js`: generated build-time catalogue of public derivatives and display dimensions; not a runtime script or deployed file.
- `books.json`: book titles, purchase URLs, cover properties and the supplied English/Italian descriptions, including the full Versi Liberi biography.
- `series-template.html` and the four page templates: static HTML inputs for `scripts/build.mjs`.

The photography selection contains 24 works: six from A Face in the Crowd, three Alexythimia works in I/II/III order, and 15 from For Now We See Through a Glass, Darkly. Removed works do not return merely because an original remains locally archived.

### Private originals

`res/works/` and `res/publications/` are **ignored private inputs**, not repository or deployment assets. They remain on the author's machine with a separate private backup. A fresh public checkout intentionally has no originals. Previously committed source files may still exist in older Git history; this project does not rewrite that history.

To regenerate derivatives locally, restore the private inputs to those directories, update the selection or book data, and run:

```sh
npm run assets
npm run build
```

Commit only the generated, metadata-free public derivatives and catalogue. Photography previews are capped at 960px, series images at 1440px and book covers at 960px, without upscaling. EXIF orientation is applied before metadata is stripped; catalogue dimensions describe the upright image. The Light 6, immediately before Michelle, is vertical. Originals are never modified.

The public portrait is a metadata-free, 960×960 WebP at `res/portraits/ivan.webp`; its source photo stays private. Images delivered to a browser can be saved or captured. Disabled native dragging is only a casual deterrent, not copy protection.

## Presentation and interaction

Typography uses locally installed Helvetica Neue Bold / Helvetica, with Arial and sans-serif fallbacks. Proprietary font files are not bundled or redistributed. Other devices use their own fonts; identical rendering everywhere requires a suitable webfont licence.

Main text, titles, links, dates, credits and references share a responsive 28–44px size, weight 700, 1.15 leading and +0.01em tracking. Navigation, copyright and physical book-spine labels are smaller. All surfaces are black and interface text is white; original artwork and cover colours are unchanged.

`main.js` implements a bounded three-cycle ribbon with wheel, drag, native touch and keyboard browsing. Resizing preserves browsing position; visual repetitions have no duplicate IDs or accessibility stops. No autoplay or artwork modal is used. Without JavaScript, the original static strip remains finite and natively scrollable.

`books.js` keeps hover previews separate from selected descriptions, cancels superseded text effects and scroll requests, and respects reduced motion. Printed 3D cover planes never receive blur/fade effects. `site.js` handles the portrait and progressively enhanced native page transitions; books opt out so their printed planes stay sharp.

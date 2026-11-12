# Ivan Arena — selected work

A static portfolio with an introduction and expandable horizontal gallery centered together vertically and horizontally on the homepage, plus separate books and published-writing pages. No runtime dependencies, third-party requests, tracking, or frontend compilation.

## Preview

```sh
npm run preview
```

Open http://127.0.0.1:4173. This automatically exports and serves `dist/`, which contains no originals or repository files. Node and Python 3 are required for the local tools, not the deployed site. The site also opens directly from `dist/index.html`.

## Homepage

`index.html` opens with the artist's full introduction, navigation and horizontal photo strip centered together as a compact group in the viewport. The gallery stays on the homepage: clicking a photograph expands the endless horizontal ribbon at that work, without navigating to another page. Inspecting a ribbon photograph opens the fitted detail view. Closing folds the gallery back into the homepage preview.

The site uses self-hosted **Afacad Regular (400)** with sentence-case interface text throughout, with white backgrounds, soft-black text and warm-grey secondary credits. Book covers and photographs themselves are unchanged. Books and writing link directly to this homepage. The old `gallery.html` URL redirects to it. Without JavaScript, the introduction, links and a native horizontally scrollable photographic selection remain available.

## Motion

Page headings, gallery arrivals, inspected photographs, book captions, and published-writing entries use matching soft blur/fade arrivals. Browsers supporting native same-origin cross-document View Transitions also blur/fade between photography and writing pages; other browsers keep ordinary navigation and the arrival effects. The books page opts out of whole-page effects so its 3D objects remain sharp and opaque, including on arrival and departure. Links, modifier-clicks, history, and external destinations are not intercepted. The small shared `site.js` registers navigation-lifecycle handlers before rendering and updates the copyright year. Interrupted/skipped native transitions are handled without suppressing application errors. Reduced-motion users get instant navigation and no blur/fade animations.

## Gallery

- A varied-height horizontal photo strip sits just below the introduction, with the whole group centered on both axes. A click expands the selected photograph into the full-screen endless ribbon. Full aspect ratios and consistent gaps are preserved without overlaps or cropping, including short landscape screens.
- Browsing is horizontal on desktop and phones: wheel, trackpad, drag, arrow keys/buttons and touch swipes. Desktop uses a bounded, virtualized ribbon; phones use native horizontal momentum scrolling with three fixed cycles and idle-time rebasing. There is no autoplay.
- Progressive masked frosting softens the left/right edges of the gallery and inspection view. It never intercepts input or blurs controls. Forced-colors mode hides these decorative layers.
- Selecting a ribbon photograph, pressing Enter, or using the inspect control opens the fitted inspection layer, with smaller clickable blurred neighbors. Individual images and captions use the restored blur/fade transitions.
- Photos stay sharp at rest and on hover. Explicit keyboard focus on a ribbon photograph softly blurs its peers; leaving that focus restores them.
- The inspected photograph stays fitted without cropping, click-to-zoom, original links or download controls. Neighbor buttons, arrow keys and horizontal phone swipes select other works. Browser accessibility zoom remains available.
- Escape, the close control or empty inspection canvas returns to the expanded ribbon. Closing the ribbon returns to the homepage strip, restoring its selection, focus and page scroll. Both dialog layers contain keyboard focus; the collapsed homepage keeps normal browser tabbing.
- Dialogs follow the dynamic viewport, safe areas and measured caption/control heights. Touch controls are at least 44px. Delayed image loads cannot replace a more recently selected photograph.
- Credits show the catalogue title, medium and year. Editable metadata lives in `artwork-metadata.json`, keyed by original filename so deleting/reordering photographs does not rename surviving work. Current titles are catalogue/series labels rather than invented individual titles; unverified medium defaults to **Digital image**, and unknown dates remain `null`, displayed as **n.d.** Filenames, file timestamps and copyright years are not used to fabricate artwork dates. Only public credit fields are exported.
- Reduced-motion mode skips opening/closing and caption animations, but keeps the static edge frosting. No pictures autoplay or shuffle.

The curated selection is generated from the remaining photographs in `res/works/`. Book covers stay out of the photo gallery (`INCLUDE_PUBLICATIONS = false` in `scripts/prepare-assets.mjs`) and are displayed separately on `books.html`. Deleted/excluded works and their stale previews are excluded from the published gallery. Series are interleaved; the numbers within each series are catalogue positions, not newly invented artwork titles. No music assets existed in the source repo.

## Books

`books.html` is a separate, responsive 3D bookshelf with four publications, led by **The Second Thought** (Amazon product ID `B0HB2SYTR4`). It is described as a **hybrid work**. Its cover is copied from the existing local ebook project, and its 2026 edition year comes from the book's copyright page. Click/tap a spine to rotate its cover into view; selecting another folds the previous book away. Covers, spines, and the 3D scene stay fully sharp and opaque throughout; only the original rotation/width transitions animate the books themselves. Captions crossfade through an inert, ID-free outgoing snapshot while the live title, purchase URL, and accessible state update immediately. Rapid switches replace, rather than queue, old snapshots. Click the active book or empty canvas to fold it closed. Arrow keys select neighboring books, and Escape closes the active one. Reduced-motion preferences are respected, including changes made during an animation.

Titles, publication years, and purchase links come from the original portfolio. The spines use cover-matched colors; original spine artwork was not supplied. Purchase links retain the existing Amazon product IDs.

The standalone `books.js` and `books.css` do not load or change the photograph gallery. `npm run books:assets` generates metadata-free WebP cover derivatives in `res/book-covers/` without upscaling the original covers. `npm run assets` regenerates both photographs and covers. Originals in `res/publications/` remain excluded from the published output.

## Elsewhere

`elsewhere.html` lists three confirmed online poems with direct publisher links, outlet names, and publication dates. They were located through the author's submissions tracker and independently verified on Panel and Wayfarer public pages. No private tracker files, pending submissions, correspondence, or unpublished work are copied or exported. See `docs/published-writing.md` for public-source verification notes (development documentation, not published).

The page is static, uses the shared font and navigation, and makes no requests to publishers until a reader follows a link.

## Assets

Originals in `res/works/` and `res/publications/` are unchanged. Committed WebP previews are capped at **960px on the longest edge (quality 80)**; focused views at **1440px (quality 82)**. Aspect ratios are preserved, metadata is stripped, and smaller images are never upscaled. Original paths are omitted from the client manifest. The horizontal ribbon uses 960px derivatives, including on high-density displays; the moderately larger 1440px derivative loads only for inspection. The ribbon's DOM stays bounded as you browse.

### Image-saving limitations

Image right-click, native image dragging, touch callouts, and artwork printing are discouraged, and there is no original/download link. These are **casual deterrents, not protection**: screenshots and saving pixels received by the browser cannot be prevented. Browser shortcuts and accessibility features remain available.

The original files remain in the repository. `npm run build` uses an explicit allowlist to export only the webpage, scripts, fonts, favicon, and low-resolution images into `dist/`. The preview serves only that directory. The build content-versions scripts, styles, covers, and artwork URLs to prevent stale mobile caches mixing different builds. **Deploy only `dist/`**: publishing the repository root instead would expose the originals. This does not remove copies already published on the existing live site; nothing has been pushed or deployed. Display-sized derivatives will always remain copyable.

To regenerate previews and `works.js` after adding or deleting artwork (deleted-work previews are automatically removed):

```sh
npm ci
npm run assets
```

Typography: locally hosted **Afacad Regular (400)**, with proper sentence capitalization for the introduction, navigation and interface labels. Published work titles and link destinations retain their original form. The regular Latin WOFF2 is self-hosted (approximately 13KB); there are no runtime Google Fonts requests. Licensed under the SIL Open Font License (see `res/fonts/Afacad-OFL.txt`). White backgrounds with soft-black text (`#1c1b19`), warm-grey secondary credits, and restrained black hover states. Navigation links are understated and underline on hover or keyboard focus. Photographs and book artwork retain their original colors. The full artist introduction and links are visible above the centered gallery strip. The expanded gallery retains quiet two-line artwork credits.

## Tests

```sh
npm ci
npx playwright install chromium
npm test
```

Set `CHROMIUM_PATH` to use an existing Chromium binary. Desktop and mobile tests cover every remaining work, derivative privacy/quality, intro/preview geometry, gallery expansion and return, regular font loading and sentence casing, fallback browsing without JavaScript, bounded endless scrolling, progressive edge blur, inspection, image-loading races, neighboring works, hover clarity, blur/fade transitions, saving deterrents, keyboard/focus restoration, native horizontal momentum, real touch gestures, and responsive captions/controls.

## Publishing

Run `npm run build`, then publish **only the contents of `dist/`** using the static host's artifact/output-directory setting. Do not publish the repository root. The export contains no originals, tests, development scripts, or Git metadata. No Node server is needed in production.

# Published writing: public-source verification

Only published work is listed on `elsewhere.html`. No submissions, pending decisions, editor correspondence, drafts, or private tracker content are exported.

The author's submissions tracker identifies three published poems. Each was checked against a live public publication page before inclusion:

| Work | Outlet | Publication date | Public source |
| --- | --- | --- | --- |
| the idiot | Panel Online | 2026-10-26 | https://panel-magazine.com/the-idiot/ |
| insignificance | Wayfarer Magazine | 2026-10-16 | https://wayfarermagazine.substack.com/p/insignificance |
| to catch a butterfly | Wayfarer Magazine | 2026-10-15 | https://wayfarermagazine.substack.com/p/to-catch-a-butterfly |

Panel's public WordPress post endpoint (`https://panel-magazine.com/wp-json/wp/v2/posts/4844`) confirms the title in the post body, the byline “Ivan Arena,” the canonical link, and its publication date. The WordPress title field is blank, so it was not used alone.

Both Wayfarer pages identify the poem as by Ivan Arena. Their canonical URLs and `datePublished` structured metadata confirm the links and dates above. The public archive search also confirms “To Catch a Butterfly” and its byline.

The website links to the publisher's own page rather than reproducing poem text or publisher artwork. This file is development documentation and is not included in `dist/`.

# Kirche Felsengrund — Live WordPress Site Analysis

Reference document for the React/TypeScript rebuild. Captures the state of
`https://www.kirche-felsengrund.ch/` (WordPress 7.0.4, Avada/Fusion theme) as observed on
2026-09-07. This is the church's own site, being analyzed by its owner to guide the rebuild — treat
everything here as **content/structure reference**, not something to copy verbatim (design tokens,
images, and copy should be adapted, not scraped 1:1).

> Note: pages were fetched via an AI-summarizing fetch tool, so some detail (exact wording, exact
> field order) is paraphrased rather than a verbatim transcript. Where something could be confirmed
> from raw HTML/CSS (title, meta tags, colors, fonts, plugin names) it is stated directly; otherwise
> it's phrased as an observation/summary from the fetched page.

## Overview

Kirche Felsengrund is an evangelical free church ("Freie Missionsgemeinde", part of the Verband
Freier Missionsgemeinden Schweiz) in Oetwil am See, Switzerland. The current site is a WordPress
install using the **Avada/Fusion Builder** theme, in German (`de-CH`), focused on:

- Service times and church programs (Gottesdienst, Dinner Church, kids/youth groups, small groups,
  senior programs, Bible classes)
- Social ministry (food bank, life counseling, "Ich brauche Hilfe" support hub)
- Two lightweight interactive features: a prayer wall ("Gebetswand") and a sermon feedback box
  ("Parkplatz")
- A self-hosted sermon podcast (direct MP3 links, own RSS feed) rather than a third-party platform
- Standard EU/CH-oriented legal pages (Datenschutz, Cookie-Richtlinie)

## Meta / SEO

From the raw homepage HTML `<head>`:

- **`<html lang="de-CH">`**, with `prefix="og: http://ogp.me/ns# fb: http://ogp.me/ns/fb#"`
- **Title**: `Kirche Felsengrund – Kirche, die verändert` (tagline: "Church that transforms")
- **Meta description** (homepage, drawn from the "Parkplatz" section copy — looks like a
  mis-generated/fallback description rather than a deliberately authored one):
  > "News / Parkplatz / Hast du eine Frage zur letzten Predigt? Oder hast du ein Anliegen oder
  > Feedback, das du gerne loswerden willst? Dann ist das hier dein Parkplatz, wo du deine Fragen,
  > Anliegen und Feedbacks parkieren kannst. Wir freuen uns auf deine…" (truncated)
- **Open Graph**: `og:locale=de_CH`, `og:type=website`, `og:site_name=Kirche Felsengrund`,
  `og:title` empty, `og:description` = same as meta description, `og:url` = homepage,
  `og:image` = the FMG logo PNG (170×111)
- **Favicon**: a cropped photo (`cropped-aaron-burden-52692-unsplash-1-*.jpg`, from Unsplash),
  served at 32×32, 192×192, and as `apple-touch-icon` (180×180) / `msapplication-TileImage` (270×270)
  — i.e. **not a custom-drawn logo mark**, just a cropped stock photo used as favicon.
- **Generator tags**: `WordPress 7.0.4` and `Seriously Simple Podcasting 3.17.0` (the podcast plugin)
- **robots**: `max-image-preview:large`
- RSS feeds exposed: `/feed/`, `/comments/feed/`, and a dedicated `/feed/podcast` (Podcast RSS)
- oEmbed endpoints exposed (`wp-json/oembed/1.0/embed`)

**Identified plugins/tooling** (from asset URLs/IDs in the HTML):
- **Avada / Fusion Builder** (theme) — dynamic per-page CSS at
  `wp-content/uploads/fusion-styles/<hash>.min.css`
- **Complianz GDPR/CCPA** cookie consent (`complianz-gdpr` plugin) — banner + cookie blocker
- **Contact Form 7** + **Contact Form 7 Image Captcha** (`cf7ic`) — used for the site's contact/
  registration forms (image-based CAPTCHA, e.g. "select the cup")
- **Seriously Simple Podcasting** — powers `/podcast-5/` and the podcast RSS feed
- **WP Rocket** (or similar) — the lazy-load/delayed-script loader (`RocketLazyLoadScripts`) seen
  inline at the top of every page, deferring third-party scripts until user interaction
- **"Pretty Google Calendar"** plugin — powers `/agenda-google/` (embeds a Google Calendar)
- No Google Analytics/GTM, Facebook Pixel, Matomo, or Hotjar script tags were found referenced in
  the fetched HTML itself. However, the **cookie policy page explicitly lists "Marketing" cookies for
  YouTube** (`GPS`, `VISITOR_INFO1_LIVE`, `YSC`, `PREF`) and a **"Miscellaneous" category naming
  Wistia video tracking and Mixpanel analytics** — meaning those *can* load depending on embedded
  content/consent, even though no such script tag is unconditionally present on the pages checked.
  The privacy policy separately names **Google** as a third party that collects data via the site.

## Navigation & Sitemap

### Main nav (top-level + dropdown)

- **Home**
- **Über uns** → `/uber-uns/`
- **Agenda** → `/agenda-google/` (embedded Google Calendar, "loading…" placeholder until JS runs)
- **Angebote** (dropdown), grouped roughly by category:
  - Gottesdienst → `/gottesdienst/`
  - Dinnerchurch → `/dinner-church/` (page links out to external `dinnerchurch.ch`)
  - Kids-Treff → `/kids-treff/`
  - Jungschar → `/jungschar/`
  - Highlight → `/highlight/`
  - Smallgroups → `/smallgroups/`
  - Biblischer Unterricht → `/biblischer-unterricht/`
  - Senioren → `/senioren/`
  - Seniorenessen 60+ → `/seniorenessen-60/`
  - Lebensmittelabgabe → `/lebensmittelabgabe/`
- **Podcast** → `/podcast-5/`
- **Ich brauche Hilfe** → `/ich-brauche-hilfe/`
- **Kontakt & Spenden** → `/kontakt/`

(CLAUDE.md's described nav — with an explicit "Human Flourishing" item and a slightly different
grouping — is the *intended* structure for the rebuild; the live site's actual top-level menu found
during this crawl did not surface a distinct "Human Flourishing" nav entry or sub-groups labeled
Gottesdienst/Kinder & Jugend/Gemeinschaft/Senioren/Hilfe & Service as literal dropdown group headers
— those appear to be a categorization CLAUDE.md imposed on the flat list of Angebote links. Worth
reconciling directly against the live dropdown DOM if pixel-perfect nav grouping matters.)

### Footer

- Copyright: `© Copyright 2019 | Kirche Felsengrund All Rights Reserved`
- Credits: "Powered by Christian Weidmann & Raphael Baumeler" (site developers)
- Legal links: **Datenschutz** (`/datenschutz/`), **Cookie Richtlinie EU** (`/cookie-richtlinie-eu/`)
- Cookie consent management link/widget (Complianz "Zustimmungseinstellungen verwalten")
- No social media icons/links and no phone number were found in the footer itself (phone number
  exists on the Kontakt page body instead).

### Full URL inventory (from `wp-sitemap-posts-page-1.xml` + `wp-sitemap-posts-post-1.xml` +
`wp-sitemap-posts-podcast-1.xml`)

Pages:
```
/                          /uber-uns/                 /angebote/
/ich-brauche-hilfe/        /smallgroups/               /highlight/
/jungschar/                /kids-treff/                /kontakt/
/dinner-church/            /lebensmittelabgabe/        /wegbeschreibung/
/podcast-5/                /gebetsformular/            /lebensberatung/
/jetzt-fuer-mich-beten/    /gebetswand/                /jungschar-bilder/
/datenschutz/              /cookie-richtlinie-eu/      /agenda-google/
/test/                     /biblischer-unterricht/     /gottesdienst/
/senioren/                 /seniorenessen-60/
```
Posts (blog-post content type — appear to be duplicate/legacy versions of some Angebote pages, likely
from a prior site restructuring):
```
/angebote/  /kids-treff/  /jungschar/  /highlight/  /smallgroups/  /dinner-church/
/lebensmittelabgabe/  /biblischer-unterricht/  /leidtragende/  /gebetswand/
/dinner-church-2/  /gottesdienst/  /jungschar-2/
```
Podcast episodes:
```
/podcast/test-episode/
```
Note the presence of `/test/`, `/dinner-church-2/`, `/jungschar-2/` and a `test-episode` podcast post
— these look like leftover draft/duplicate content from WordPress editing, not intentional pages;
don't treat them as real IA to replicate.

## Page-by-Page Inventory

| Path | Purpose | Key content |
|---|---|---|
| `/` | Homepage | Welcome/service-times section (Sunday 09:45, monthly Dinner-Church 18:00), Jungschar teaser, Gebetswand section, Parkplatz feedback section, event flyer images (Dinner Church, food distribution, "mercy fund") |
| `/uber-uns/` | About | Vision/welcome text, a short statement of faith (God the Father / Jesus / Holy Spirit, resurrection etc.), church's denominational affiliation (Verband Freier Missionsgemeinden Schweiz), leadership team with photos and bios (see below), 4 core values (Gospel, Hope, Faith, Love) each with a Bible reference |
| `/angebote/` | Offers overview/index | Lists all program offerings as cards/teasers with short descriptions, linking to each dedicated page (Smallgroups, Lebensmittelabgabe, Kids-Treff, Jungschar, Highlight, Gottesdienst, Dinner-Church, Biblischer Unterricht) |
| `/gottesdienst/` | Sunday service info | Service time (Sun 09:45–~11:15), a generic welcome invitation, one interior-church photo, "Hier treffen wir uns zum Gottesdienst" location teaser, link out to Dinner Church |
| `/dinner-church/` | Dinner Church teaser | Mostly seasonal flyer images ("Flyer Dinner Church 2026-Herbst"); a "Zur Dinner Church Homepage" link out to the external `dinnerchurch.ch` site, which is the actual info/registration hub |
| `/kids-treff/` | Kids program | Sunday-morning kids program (Bible story, crafts, games), casual/direct invitation copy, no visible schedule specifics or signup form |
| `/jungschar/` | Youth group (grades 1–8) | Every-other-Saturday-afternoon activities (games, crafts, grilling, climbing/rappelling, singing, Bible teaching); meeting point "der Storch" in front of Schulhaus Blattenacher; leader team listed with names/photos (Sonja Lutz as Jungscharhauptleiterin + phone number, plus Fabienne, Cédric, Debby); multiple action photos |
| `/jungschar-bilder/` | Jungschar photo gallery (not individually fetched, but present in sitemap — likely an image gallery page) | — |
| `/highlight/` | Teen group | Every-second-Friday-evening social gathering for teens; contact form; a seasonal program-flyer image ("Highlight Herbst 2026 Programm") |
| `/smallgroups/` | Small groups / house groups | Bible study + prayer + discussion in small groups, casual "drop in" invitation; contact form (name/subject/message/email) |
| `/biblischer-unterricht/` | Bible class | Open to all youth regardless of church affiliation; framed as "an exciting journey" into life/faith questions; minimal scheduling info given |
| `/senioren/` | Senior ministry | Twice-monthly gathering for Bible reading + fellowship; authored/dated post ("by Oliver Lutz, April 26 2026" — note future-dated relative to real-world "today", likely placeholder/demo content on the live site); contact form with CAPTCHA |
| `/seniorenessen-60/` | Senior meal (60+) | Monthly Tuesday communal meal + games/conversation; requires advance signup; contact form |
| `/lebensmittelabgabe/` | Food bank | Weekly Monday 16:30–17:15 food handout; eligibility = low income / supplementary benefits / social assistance, with written proof required; single image + eligibility text, no address given (implicitly "just show up") |
| `/ich-brauche-hilfe/` | "I need help" hub | Two sub-offerings: prayer request ("Betet für mich" → `/jetzt-fuer-mich-beten/`) and pastoral/life counseling ("Lebensberatung" → `/lebensberatung/`); framing copy about prayer's effectiveness and pastoral support |
| `/lebensberatung/` | Life counseling | Free, confidential counseling; 48h response commitment; contact form with name/email (required), phone (optional), subject, message, preferred contact method (email/phone), and preferred counselor gender (male/female) |
| `/jetzt-fuer-mich-beten/` | Prayer request form | Fields: topic ("Um welches Thema geht es?"), display name/nickname ("Wie möchtest du genannt werden?"), free-text description, optional email (for notifications), an end-date for how long to pray, and a yes/no consent toggle for publishing on the public prayer wall; explicit confidentiality note |
| `/gebetsformular/` | Prayer form (appears to be an alternate/older prayer request form URL, possibly superseded by `/jetzt-fuer-mich-beten/`) | Fetched content didn't render the form fields (only nav/cookie chrome) — likely the same or a legacy version of the prayer request form |
| `/gebetswand/` | Public prayer wall | Displays published prayer requests grouped/tagged by theme; only one category ("Leidtragende" — "those suffering") was visible in this crawl, with a short framing/invitation text to pray for people quietly suffering. Individual prayer-request cards were not captured in this crawl — worth a follow-up direct fetch if the display format (card layout, how anonymity is shown, how many are listed) matters for the rebuild |
| `/kontakt/` | Contact & donations | Contact form (name/subject/message/email + image CAPTCHA); direct contact person Oliver Lutz (`oliver.lutz@kirche-felsengrund.ch`); physical address "Felsengrund 1, 8618 Oetwil am See"; an embedded location map; bank donation details — IBAN `CH79 0070 0114 6002 0178 2`, account holder "Freie Missionsgemeinde Oetwil am See", plus a Swiss QR-bill (QR-Zahlteil) image; thank-you note to donors; no phone number or social links on this page (phone is only on `/datenschutz/`: `044 929 15 87`) |
| `/wegbeschreibung/` | Directions | Fetch only returned cookie-consent chrome, no actual address/map/parking content came through — needs a manual re-check if turn-by-turn directions content matters (this may indicate the page genuinely has very little unique content beyond an embedded map, or a fetch/rendering issue) |
| `/agenda-google/` | Agenda/calendar | Embeds a Google Calendar via the "Pretty Google Calendar" plugin; client-side rendered ("loading…" placeholder in static HTML) |
| `/podcast-5/` | Sermon podcast | Self-hosted, no third-party platform embed — direct MP3 links per episode, own podcast RSS feed (`/feed/podcast`) via Seriously Simple Podcasting; example episodes: "07.12.2025 – Oliver Lutz – Nicht verzagen, Mut fassen", "24.12.23 – Oliver Lutz", "10.03.24 – Oliver Lutz – Die Verleugnung des Petrus", "18.02.24 – Oliver Lutz – 4. Mose", "11.02.24 – Iosif Omusoru – Gemeinde unter Gnade und Frieden", "04.02.24 – Oliver Lutz – Säen und ernten", "24.01.24 – Oliver Lutz" |
| `/datenschutz/` | Privacy policy | See Legal/Compliance section below |
| `/cookie-richtlinie-eu/` | Cookie policy | See Legal/Compliance section below |
| `/test/`, `/dinner-church-2/`, `/jungschar-2/`, `/podcast/test-episode/` | Leftover/duplicate/draft content | Not meaningful for the rebuild |

### Leadership team (from `/uber-uns/`)

- **Oliver Lutz** — Pastor, PhD in theology, born 1969 (also the site's admin contact / privacy-policy contact / prayer-form author attribution elsewhere)
- **Erwin Meier** — Community leader, born 1967, involved in worship/prayer meetings
- **Tabea Meier** — Youth leader, born 1991, trained nurse
- **Sonja Lutz** — Children's program leader, born 1969 (also listed as Jungschar main leader on `/jungschar/`)

## Theme & Visual Design

- **Theme engine**: Avada (ThemeFusion) with the Fusion Builder page builder — evident from
  `fusion-*` CSS classes, `awb-*` (Avada Website Builder) utility classes, and a per-page compiled
  CSS file at `wp-content/uploads/fusion-styles/<hash>.min.css`.
- **Fonts**: confirmed via the compiled Fusion CSS — **`'Open Sans'`** used pervasively for body/UI
  text (30+ declarations), and **`Raleway`** also present (41 occurrences) — consistent with
  CLAUDE.md's existing note that these were "already correct" for the rebuild (Open Sans body /
  Raleway display).
- **Brand colors**: the deep magenta **`#a31366`** and soft pink **`#fda1d5`** (CLAUDE.md's
  `--kf-brand-accent` / `--kf-clr-pink-100`) were each found exactly once in the compiled Fusion CSS,
  confirming these are real theme colors pulled from the live site rather than guesses. The
  Gutenberg/WP block-editor default palette (`--wp--preset--color--awb-color-*`: greens, blues,
  grays — e.g. `rgba(160,206,78,1)`, `rgba(63,124,205,1)`, `rgba(26,128,182,1)`) is also present in
  `global-styles-inline-css` but appears to be WordPress/Avada's generic default swatch set, **not**
  representative of this site's actual applied brand palette — don't mistake those for the real
  colors.
- **Favicon/logo**: the favicon is a cropped Unsplash stock photo, not the church's own logo mark —
  the actual logo used in `og:image` and presumably the header is
  `wp-content/uploads/2019/06/FMG-Logo-bearbeitet-Versuch-3-1-*.png` ("FMG" = Freie Missionsgemeinde,
  the church's former/legal name). This matches the repo's existing `assets/icons/Logo4c_*` SVG
  variants family already gathered for the rebuild.
- **Layout style**: full-width, wide-layout Avada template (`avada-html-layout-wide`,
  `avada-html-header-position-top`, `avada-html-has-bg-image-full`) — a top-positioned header, and a
  full-bleed background image/hero treatment on at least the homepage template.
- **Recurring UI patterns observed**:
  - Program/offer pages follow a consistent template: title → one hero/context image → short
    descriptive paragraph → (sometimes) a Contact Form 7 inquiry form → footer.
  - Contact-style forms (name/subject/message/email + image CAPTCHA) are reused across many pages
    (Smallgroups, Highlight, Senioren, Seniorenessen, Kontakt) rather than each having bespoke UI —
    this is literally the same CF7 form pattern reused as a generic "get in touch about this program"
    widget, not a dedicated registration flow.
  - Seasonal flyer/poster images (PNG/JPG "Flyer Herbst 2026" style graphics) are used in place of
    structured content on at least Dinner-Church and Highlight — i.e. program schedules are
    literally distributed as poster images rather than as structured page content. CLAUDE.md already
    flags that "seasonal event flyers... were not carried over" — this confirms that's a real,
    recurring pattern on the live site, not a one-off.

## Functional Features

- **Prayer wall ("Gebetswand")**: two related URLs — a submission form (`/jetzt-fuer-mich-beten/`,
  and a possibly-legacy `/gebetsformular/`) and a public display page (`/gebetswand/`). Submission
  fields: topic, display name/nickname, free-text description, optional email, prayer end-date, and
  a public/private (wall-publish) consent toggle. The display page groups/tags requests by theme
  (only "Leidtragende" was visible in this crawl).
- **Sermon feedback ("Parkplatz")**: referenced prominently in the homepage meta description — a
  place to "park" questions/feedback/concerns about the last sermon. (The dedicated page/form for
  this wasn't separately identified in the sitemap — it may live inline on the homepage or under
  `/gottesdienst/`; worth a direct look at the homepage's rendered DOM if replicating this exactly.)
- **Life counseling request** (`/lebensberatung/`): name, email, optional phone, subject, message,
  preferred contact method, preferred counselor gender — a more detailed intake form than the other
  "contact us" forms on the site.
- **Contact/general inquiry forms**: Contact Form 7 + image CAPTCHA plugin, reused verbatim across
  Kontakt, Smallgroups, Highlight, Senioren, Seniorenessen — fields: name, subject, message, email
  (+ CAPTCHA).
- **Agenda / calendar**: Google Calendar embed via "Pretty Google Calendar" plugin, client-rendered.
- **Podcast**: self-hosted sermon audio via Seriously Simple Podcasting, own RSS feed, no external
  platform (no Spotify/Apple Podcasts embeds seen).
- **Cookie consent**: Complianz GDPR/CCPA banner with four categories — Funktional (Functional),
  Präferenzen (Preferences), Statistiken (Statistics), Marketing — plus a "manage consent settings"
  link, consistent with the cookie policy page's categories.
- **Donations**: bank transfer via IBAN + Swiss QR-bill image (no online payment processor/embedded
  checkout observed).
- **No language switcher** was found — the site appears to be German-only (`de-CH`).
- **No on-site search** was observed in the fetched pages.
- **External embeds**: `dinnerchurch.ch` (separate site the Dinner-Church page links out to), and the
  church is described as affiliated with `fmg-oetwil.ch` (an older/parallel domain, likely the
  church's previous name/branding, "Freie Missionsgemeinde Oetwil" — possibly still resolving or a
  legacy redirect target; worth checking whether it's still live before relying on it).

## Content Categories

Matches CLAUDE.md's expected shape well, with the caveat that the live site's dropdown didn't
present these as literal labeled sub-groups (see Navigation section above) — the categorization is
inferred from what kind of program each Angebot is:

- **Gottesdienst**: `/gottesdienst/` (Sunday service), `/dinner-church/` (monthly alt. format,
  links to external dinnerchurch.ch), `/podcast-5/` (sermon recordings)
- **Kinder & Jugend**: `/kids-treff/` (kids, Sunday), `/jungschar/` (grades 1–8, biweekly Saturday),
  `/highlight/` (teens, biweekly Friday)
- **Gemeinschaft**: `/smallgroups/` (house groups/Bible study), `/biblischer-unterricht/` (open Bible
  class for youth)
- **Senioren**: `/senioren/` (biweekly fellowship), `/seniorenessen-60/` (monthly meal, 60+)
- **Hilfe & Service**: `/lebensmittelabgabe/` (weekly food bank), `/ich-brauche-hilfe/` (hub),
  `/lebensberatung/` (counseling), `/jetzt-fuer-mich-beten/` + `/gebetswand/` (prayer)
- **Human Flourishing**: no distinct page/nav item was found under this label during this crawl —
  CLAUDE.md's mention of it may be aspirational/from an older version of the nav, or it may be a
  dropdown label not captured by the sitemap-based crawl. Worth a direct look at the rendered header
  dropdown DOM to confirm whether it still exists.

## Legal / Compliance

**`/datenschutz/` (Privacy Policy)**
- Data controller: Oliver Lutz, Kirche Felsengrund, Oetwil am See — contact
  `oliver.lutz@kirche-felsengrund.ch` / `044 929 15 87`
- Data collected: names, prayer requests, donation info, event photos/videos, social media activity,
  publication appearances; sourced both directly from users and from third parties reporting on
  someone's behalf
- International transfers: possible outside the EEA, with EU Standard Contractual Clauses as a
  safeguard when needed
- Purposes: communication, prayer lists, fundraising, newsletters, contract management, site
  operation, mission-related market analysis, training, legal compliance
- Recipients/third parties: business partners, IT/bank/insurance/shipping service providers, prayer
  list distributors, authorities, and **explicitly names Google** as a party collecting data via the
  site
- User rights: access, correction, consent withdrawal, deletion, objection — with limits for legal
  retention (donor data ~10 years)

**`/cookie-richtlinie-eu/` (Cookie Policy)**
- Consent tool: **Complianz** (cookie names like `cmplz_consenttype`, `cmplz_consented_services`
  confirm this)
- Categories: Functional/Technical, Marketing/Tracking, and a "Miscellaneous/under investigation"
  bucket
- Named cookies/services: WordPress functional cookies (`wpEmojiSettingsSupports`,
  `wordpress_test_cookie`, `wp-settings`); **YouTube** marketing cookies (`GPS`,
  `VISITOR_INFO1_LIVE`, `YSC`, `PREF`); Miscellaneous bucket names **Wistia** (video) and **Mixpanel**
  (analytics)
- Last updated: 2023-11-19; scoped to EU/EEA + Swiss residents

No separate **Impressum** page was found in the sitemap — Impressum-equivalent info (operator name,
address, contact) appears folded into `/datenschutz/` and `/kontakt/` instead, which is common
practice for small Swiss/EU nonprofit sites that don't have a hard legal Impressum requirement in the
German sense.

## Rebuild Recommendations

1. **Nav grouping needs direct DOM verification.** The sitemap/page crawl gives a flat list of
   Angebote pages; CLAUDE.md's grouped-dropdown structure (Gottesdienst / Kinder & Jugend /
   Gemeinschaft / Senioren / Hilfe & Service / Human Flourishing) wasn't independently confirmed as
   the literal live dropdown structure by this crawl — worth a quick manual check of the rendered
   header dropdown before treating the grouping as gospel, especially the "Human Flourishing" item
   which didn't surface here at all.
2. **"Parkplatz" (feedback) needs its exact live location confirmed.** It's prominent in the meta
   description but no standalone `/parkplatz`-style URL exists in the sitemap — it likely lives
   inline on the homepage. Since `FeedbackForm` already exists in the rebuild, just confirm its
   copy/fields match reality by inspecting the rendered homepage DOM directly.
2. **Favicon is a stock photo, not a logo mark** — the rebuild already uses proper SVG logo variants,
   which is an improvement; no need to replicate the cropped-photo favicon.
3. **Two prayer-form URLs exist** (`/jetzt-fuer-mich-beten/` and `/gebetsformular/`) with the same
   apparent purpose — likely one is legacy. The rebuild's single `PrayerWallForm` consolidating this
   into one form (with fields: topic, name/nickname, description, optional email, and a
   public/anonymous toggle) is a sensible simplification; CLAUDE.md's "isAnonymous flag, nothing ever
   shown publicly" is actually a deliberate **simplification** vs. the live site, which *does*
   publicly display prayer requests by theme on `/gebetswand/` when the submitter opts in — worth a
   product-level confirmation that hiding all prayer content from the public view (rather than
   showing opted-in ones) is the intended behavior change, not an oversight.
4. **Seasonal flyer images (Dinner Church, Highlight, homepage events)** are a real, recurring
   content pattern on the live site that CLAUDE.md already flags as not yet replicated — this
   crawl confirms it's used in at least 2–3 places, so if fidelity to the live site matters, a
   generic "flyer/poster image" content block (separate from the structured `Offer` model) may be
   worth considering as a future feature, exactly as CLAUDE.md anticipates.
5. **No Impressum page** — the rebuild doesn't need to add one; the live site itself folds that
   info into Datenschutz/Kontakt.
6. **Donations are IBAN + Swiss QR-bill only**, no payment processor — if a "Spenden" page/section is
   built, a static IBAN/QR-bill display (no checkout integration) matches the live site.
7. **Podcast is self-hosted MP3 + RSS**, not a Spotify/Apple embed — if reintroducing the podcast
   nav item, a simple list of audio files (own hosting, e.g. via R2) plus an RSS feed matches the
   original rather than requiring a third-party podcast host integration.
8. **Consent/analytics footprint is deliberately light** — no hard-coded GA/GTM/Meta Pixel script was
   found; tracking exposure comes only from opt-in embeds (YouTube) and a cookie-policy mention of
   Wistia/Mixpanel that may be legacy/unused. The rebuild currently has no analytics either — this is
   consistent, not a gap.
9. **Contact-style forms are heavily reused as a generic "inquire about this program" widget** across
   many Angebote pages on the live site (Smallgroups, Highlight, Senioren, Seniorenessen) — the
   current rebuild's `Offer.registration` field on the domain model could optionally support a
   similar lightweight "ask about this" affordance per offer, though this isn't necessarily required
   for parity.
10. **`/wegbeschreibung/` (directions) content didn't come through in this crawl** — if a directions/
    parking page is wanted for the rebuild (CLAUDE.md explicitly avoids embedding Google Maps
    imagery and uses a plain `mapsLink` instead, which sidesteps whatever this page does), no further
    action is likely needed, but flagging that this page's actual content is unverified here.

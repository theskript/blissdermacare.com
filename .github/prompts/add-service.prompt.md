---
description: "Add a new service, package, or both to the Bliss Dermacare website. Updates all affected files: services page, homepage, booking form, Stripe serverless function, Layout.astro, and FAQ. Use when: adding a service, adding a package, new treatment, new offering, new seasonal package."
name: "Add Service or Package"
argument-hint: "Describe the new service and/or package to add (name, price, duration, type)"
agent: "agent"
---

# Add New Service / Package — Bliss Dermacare

You are updating the Bliss Dermacare website (Astro + Tailwind). A service, a package, or both are being added. Follow every step below in order. Do not skip any file.

## What to Add

**User input:** $input

If the user did not specify pricing or duration, research current market rates for the Wesley Chapel / Tampa, FL area (zip 33545) before proceeding. Reference competitor businesses and industry standards to determine competitive pricing.

---

## Step 1 — Gather Context

Read these files before making any changes:

- [src/pages/services/index.astro](../../src/pages/services/index.astro) — services listing page
- [src/pages/index.astro](../../src/pages/index.astro) — homepage
- [src/pages/book/index.astro](../../src/pages/book/index.astro) — booking form
- [netlify/functions/create-checkout-session.cjs](../../netlify/functions/create-checkout-session.cjs) — Stripe serverless function
- [src/layouts/Layout.astro](../../src/layouts/Layout.astro) — global nav, promo bar, and cart script

Identify:
1. The correct **service ID** (kebab-case, e.g. `custom-spray-tan`) — must be consistent across ALL files
2. Whether this is an **individual service**, a **package** (combo of 2+ services), or both
3. Whether a package should be **solo-only** (cannot be combined with other services at booking)
4. Which section it belongs to on the services page (Facials, Advanced Treatments, Semipermanent Makeup, Lash & Brow, Body Treatments, Packages, Seasonal Packages, etc.)

---

## Step 2 — Services Page (`src/pages/services/index.astro`)

### Individual service
- Add a **featured card** (2-column layout: image left, content right) placed **above** the existing service grid in the relevant section
- Use amber `NEW` badge styling consistent with existing new-service cards
- Include: name, description, price, duration, 4–6 feature bullet points, Book Now CTA linking to `/book/` with `data-service-id="<id>"`
- If this pairs well with an existing package, add a cross-link note below the CTA

### Package
- Add the `id="seasonal-packages"` anchor to the Seasonal Packages section if not already present
- Add a **featured wide card** (2-column layout) placed **above** the existing packages grid
- Use `NEW` + `SEASONAL` dual badge styling (amber) consistent with existing package cards
- Include: name, component services listed, total price, savings vs. separate, duration, bullet points, Book CTA with `data-service-id="<id>"`

### New service category
- If adding a **brand-new category** (e.g. Advanced Treatments, Semipermanent Makeup), add a full `<section id="<category-id>">` before the Membership Upsell section
- Use the alternating background pattern: white (`bg-white`) for odd sections, neutral-50 (`bg-neutral-50`) for even
- Include a section header with a label span, h2, and short description paragraph
- Use a 3-col grid (`md:grid-cols-2 lg:grid-cols-3`) for the service cards within the section

### Images
- Source a relevant, high-quality image from Pexels (free license)
- Verify the URL returns HTTP 200 before using it: `curl -s -o /dev/null -w "%{http_code}" "<url>"`
- Download it locally to `public/images/<descriptive-name>.jpg` using curl
- Reference it as `/images/<descriptive-name>.jpg` in the `src` attribute — never use external CDN URLs

---

## Step 3 — Layout & Global Cart (`src/layouts/Layout.astro`)

Update **four** things in Layout.astro:

### 3a — Promo bar text
Update the two `<span>` tags inside the promo bar (`<!-- Promo Bar -->` section) to mention the new service or category:
- Desktop span (`.hidden.sm:inline`): name the addition and mention member plans
- Mobile span (`.sm:hidden`): one concise phrase

### 3b — Desktop nav dropdown (`<!-- Services dropdown -->`)
Add a link under the appropriate category group. If it's a **new category**, add a new `<div class="my-2 mx-5 border-t ...">` divider, a `<p>` category label, and `<a>` links to `#<category-id>`. If it belongs to an **existing category**, add an `<a>` under that group.

### 3c — Mobile menu
Add a matching `<a>` in the `<!-- Mobile Menu -->` div (`id="mobile-menu"`) for any new section or category.

### 3d — Global cart objects
Inside the `<!-- GLOBAL CART SCRIPT -->` block update:
- `SERVICES`: add `'<id>': { name: '...', price: <dollars>, duration: '...' }`
- `DURATIONS`: add `'<id>': <minutes>`
- `SOLO`: add `'<id>'` **only** if this must be booked alone (packages, medical/advanced, semipermanent makeup, long multi-hour sessions)

---

## Step 4 — Homepage (`src/pages/index.astro`)

### If it's a notable new/featured individual service
- Add a **spotlight section** before `<!-- New This Season -->` using the amber/golden gradient pattern (`bg-gradient-to-br from-amber-50 via-[#fdf6ec] to-rose-50`)
- Two-column layout: content (left) with headline, bullets, price display, and Book CTA; image (right) with floating badge card
- CTA button links to `/book/` with `data-service-id="<id>"`

### If it's a new service category
- Add a **category preview section** before `<!-- New This Season -->` with `bg-neutral-50 border-y border-neutral-100`
- Two wide image cards side by side, each linking to `/services/#<category-id>`
- Overlay text on each card: category name, list of key services, and "Explore treatments →" CTA

### Always
- Update the **"New This Season"** `<h2>` and description paragraph to mention the new addition
- For new individual services or packages: add the new service to the **strip grid** (`grid-cols-2 md:grid-cols-3 lg:grid-cols-N`):
  - Increment `lg:grid-cols-N` by 1
  - Add a card with amber border + `NEW` badge pill, price display, and link to `/services/#<section>`

---

## Step 5 — Booking Form (`src/pages/book/index.astro`)

### Checkbox UI
Add a new `<label>` block in the appropriate section:
- **Individual services**: in the matching category section (Facials / Lash & Brow / Body Treatments / Advanced Treatments / Semipermanent Makeup / etc.)
- **Packages**: in the Seasonal Packages section
- **New category**: add a new `<div>` section with a category label and a grid of checkbox labels

Use this pattern (adapt section/styling as needed):
```html
<label class="cursor-pointer block">
  <input type="checkbox" name="service" value="<id>" class="sr-only peer" />
  <div class="rounded-xl border-2 border-amber-200 p-4 peer-checked:border-primary-500 peer-checked:bg-primary-50 hover:border-amber-300 transition-all relative">
    <span class="absolute top-2 right-2 text-[10px] font-bold bg-amber-500 text-white px-2 py-0.5 rounded-full">NEW</span>
    <p class="font-semibold text-sm text-neutral-900"><Service Name></p>
    <p class="text-xs text-neutral-500 mt-0.5"><Component description or tagline></p>
    <p class="text-xs text-neutral-400 mt-1">$<price> · <duration></p>
    <!-- Age restriction note if applicable -->
  </div>
</label>
```

### JavaScript data objects
Update ALL four objects inside the `<script>` block:

| Object | What to add |
|--------|-------------|
| `PRICES` | `'<id>': <price as number>` (dollars, not cents) |
| `SERVICE_LABELS` | `'<id>': '<Display Name>'` |
| `DURATIONS` | `'<id>': <minutes as number>` |
| `SOLO_SERVICES` | Add `'<id>'` **only** if this is a package or standalone-only service |

---

## Step 6 — Stripe Function (`netlify/functions/create-checkout-session.cjs`)

Update BOTH objects (prices here are in **cents** — multiply dollars × 100):

```js
// In PRICES object:
'<id>': <price_in_cents>,

// In SERVICE_LABELS object:
'<id>': '<Display Name>',
```

### Sync verification
After editing, run this to confirm zero drift between `PRICES` and `SERVICE_LABELS`:
```bash
node -e "
const src = require('fs').readFileSync('./netlify/functions/create-checkout-session.cjs','utf8');
const priceKeys = [...src.match(/const PRICES = \{([\s\S]*?)\};/)[1].matchAll(/'([^']+)':/g)].map(m=>m[1]);
const labelKeys = [...src.match(/const SERVICE_LABELS = \{([\s\S]*?)\};/)[1].matchAll(/'([^']+)':/g)].map(m=>m[1]);
const missing = priceKeys.filter(k => !labelKeys.includes(k));
const extra = labelKeys.filter(k => !priceKeys.includes(k));
console.log('Mismatches:', [...missing, ...extra].length ? [...missing, ...extra] : 'none ✓');
"
```

---

## Step 7 — FAQ (`src/pages/faq/index.astro`)

If adding a **new service category** or a service type that clients commonly have questions about (injectables, semipermanent makeup, medical treatments, etc.):
- Add 1–2 new FAQ entries to the `faqs` array
- Place them before the "What should I do before and after a facial or treatment?" entry
- Include a link to the relevant services page section using `<a href='/services/#<section-id>' class='text-primary-600 hover:underline'>...</a>`

---

## Step 8 — Validate

Run error checks on all modified files:
- `src/pages/services/index.astro`
- `src/pages/index.astro`
- `src/pages/book/index.astro`
- `netlify/functions/create-checkout-session.cjs`
- `src/layouts/Layout.astro`
- `src/pages/faq/index.astro`

Fix any errors before proceeding.

---

## Key Conventions (never deviate)

| Convention | Rule |
|---|---|
| Service IDs | kebab-case strings, identical in every file |
| Images | Always downloaded locally to `public/images/`, never external CDN URLs |
| Prices (booking page JS) | Dollars as plain numbers (`65`) |
| Prices (Stripe function) | Cents as integers (`6500`) |
| Packages | Always add to `SOLO_SERVICES` set in booking page JS and `SOLO` set in Layout.astro cart |
| New badge styling | `bg-amber-500 text-white` pill, amber border (`border-amber-200`) |
| CTA links | `/book/` — the booking page JS reads `data-service-id` from the referring link |
| Sections | Match the category of the existing service groupings on the services and booking pages |
| Advanced / medical / SPMU | Always mark as `SOLO_SERVICES` — these cannot be combined with other services |
| New categories | Add to: services page section, booking form section, nav dropdown, mobile menu, cart SERVICES/DURATIONS/SOLO, homepage category preview, FAQ |

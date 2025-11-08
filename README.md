Bliss Dermacare — static copy

This repository contains a scraped static version of https://blissdermacare.framer.website/ stored in `downloaded_site/`.

What I added/changed:
- `downloaded_site/` — static HTML pages and assets produced by a headless render of the SPA
- `amplify.yml` — AWS Amplify configuration for static site hosting (serves contents of `downloaded_site/`)
- `.gitignore` and `package.json` for local tooling
- `scrape.js` — node script used to scrape the site (uses puppeteer)

To run the scraper locally (requires Node.js):

```cmd
npm install
node scrape.js
```

To deploy to AWS Amplify:
- Create an Amplify app in the AWS Console and connect this repository. Amplify will use `amplify.yml` and serve `downloaded_site/` as static artifacts.

Notes:
- The push step to GitHub may require authentication (username/password or PAT). If you prefer not to provide credentials here, push from your machine.

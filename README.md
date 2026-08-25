# LiquidCache — VLDB 2026 talk

13-minute conference talk for *LiquidCache: Efficient Pushdown Caching for Cloud-Native Data Analytics*, built as a static website.

## Present

Open `index.html` in a browser (no build step), or serve locally:

```bash
python3 -m http.server 8000
```

Navigate with arrow keys / space; `Home`/`End` jump to the first/last slide; `#N` in the URL deep-links to slide N. Print to PDF from the browser for a backup copy (each slide is one landscape page).

## Deploy

- **GitHub Pages**: push to `main`; `.github/workflows/deploy.yml` publishes the site (enable Pages → Source: GitHub Actions in repo settings).
- **Cloudflare Pages**: create a project from this repo with no build command and output directory `/`.

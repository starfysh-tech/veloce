# Partner Site — Build & Deploy Guide

## How it works

Pages are encrypted with [StatiCrypt v3](https://github.com/robinmoisson/staticrypt) before deploy. Partners receive the passphrase out-of-band (email, 1Password share, etc.). **The passphrase is never committed to this repo.**

---

## One-time GitHub setup

### 1. Set the `STATICRYPT_PASSWORD` repo secret

1. Go to **Settings → Secrets and variables → Actions**.
2. Click **New repository secret**.
3. Name: `STATICRYPT_PASSWORD`, Value: your chosen passphrase.
4. Save.

### 2. Enable GitHub Pages with source = GitHub Actions

1. Go to **Settings → Pages**.
2. Under **Source**, select **GitHub Actions**.
3. Save. (No branch/folder selection needed — the workflow handles it.)

---

## Deploying

Push to `docs/partner-site` or trigger the workflow manually via **Actions → Deploy Partner Site to GitHub Pages → Run workflow**.

---

## Local preview

```bash
# Unencrypted preview (fast, no password required)
npm run site:preview
# → http://localhost:3000

# Encrypted preview (mimics production — requires STATICRYPT_PASSWORD in env)
STATICRYPT_PASSWORD=yourpassphrase npm run site:encrypt
npx serve _site-preview
# → http://localhost:3000  (will prompt for passphrase)
```

`site:encrypt` copies `site/` to `_site-preview/` (gitignored) and encrypts in place. Delete `_site-preview/` when done.

---

## Passphrase sharing model

- The passphrase lives only in the GitHub Actions secret and in your secure credential store.
- Share it with partners via an out-of-band channel (encrypted email, shared password manager, etc.).
- Rotate by updating the repo secret and re-deploying; existing partners will need the new passphrase.

---

## Security limitation — linked assets are NOT encrypted

> **StatiCrypt encrypts only the HTML files.** Anything referenced by `<link>`, `<img>`, `<script>`, etc. is served as plain public files on GitHub Pages.

Concretely:
- `assets/site.css` — **publicly readable** (no auth required).
- `images/*.png` (or any file under `site/images/`) — **publicly readable**. Anyone who guesses or discovers a URL can fetch the image without entering the password.

**Mitigation for sensitive screenshots:** Inline images as base64 data-URIs inside the HTML:

```html
<img src="data:image/png;base64,iVBORw0KGgo..." alt="Screenshot" />
```

A base64-inlined image is embedded in the encrypted HTML, so it is protected by StatiCrypt. Images that are acceptable to be public (logos, generic icons) can remain as regular `<img src="images/...">` references.

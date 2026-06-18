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

Push to `main` after the partner-site PR merges, or trigger the workflow manually via **Actions → Deploy Partner Site to GitHub Pages → Run workflow**.

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

## Asset gating — screenshots are auto-inlined

StatiCrypt encrypts only the HTML files; anything referenced by `<img>`/`<link>` would
otherwise be served as a plain public file on Pages. The build closes that gap
automatically:

- **`scripts/inline-site-images.mjs`** runs in the deploy workflow (and in
  `npm run site:encrypt`) *before* StatiCrypt. It rewrites every
  `<img src="images/…">` into a base64 **WebP** data-URI embedded in the HTML, then
  deletes the `images/` dir and the internal-only files (`_template.html`, `SHOTS.md`,
  `BUILD.md`) from the build output. So the screenshots ship **inside** the encrypted
  HTML — not as public files.
- CI installs `sharp` for PNG → WebP compression. Locally (no `sharp`) the script
  falls back to inlining the original PNG bytes — correct, just larger — so previews
  still work.
- **`assets/site.css` remains public** by design — it's presentation only and reveals
  nothing. If that ever changes, inline it too.

Authoring stays simple: reference screenshots normally as `<img src="images/name.png">`.
The inline step handles gating at build time; the source HTML stays readable and the
`site:preview` (unencrypted) view still loads the images from disk.

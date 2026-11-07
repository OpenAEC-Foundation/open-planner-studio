# Approved application logos

The PNG masters are the approved Snap Store logos. `icons.json` records their source URLs, SHA-256 checksums and all generated application assets. Transparency and the approved artwork are preserved.

Regenerate with Python 3 and Pillow installed:

```sh
python3 scripts/generate-approved-icons.py
```

Do not redraw these logos or replace them with the foundation symbol. Historical screenshots and unrelated third-party branding are not application icon sources.

`npm run verify:icons` checks the result without Python: source hash, square master, the size of every generated file, and that `index.html` and `public/manifest.webmanifest` only name icons listed in `icons.json`. The master is 512 px; the 1024 px outputs are scaled up from it. Replace the master with a larger original when the designer supplies one.

In the interface, use `AppLogo` (`src/components/common/AppLogo.tsx`) for the app's own mark. Do not use it for document or company logos.

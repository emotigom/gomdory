# Education Library Public Assets

HTML presentation bundles in this directory are published to the Cloudflare R2 public assets bucket.

- Public origin: `https://assets.gomdory.com`
- R2 bucket: `gom-public-assets`
- Public URL paths must not include `/gom-public-assets/` or `/public/`.

## Shared favicon

When a browser opens an HTML presentation on `assets.gomdory.com`, it may automatically request `/favicon.ico` even if the presentation does not reference a favicon explicitly.

To avoid a harmless but noisy `404 /favicon.ico` console entry, upload a shared favicon object to the root of the `gom-public-assets` R2 bucket:

```text
favicon.ico
```

The repository already includes `public/favicon.ico` and `public/favicon.svg`; use `public/favicon.ico` as the default source for the R2 root object unless a new shared brand favicon is prepared.

After upload, the favicon should resolve at:

```text
https://assets.gomdory.com/favicon.ico
```

Presentation assets should stay under their own `education-library/<slug>/` prefixes. Only shared browser-discovery assets, such as the root favicon, should be uploaded at the bucket root.

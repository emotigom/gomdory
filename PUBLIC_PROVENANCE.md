# Public Source Provenance

This repository is a clean-history export of publishable Gomdory application source.

## Repository-local compatibility packages

The packages under `vendor/` in the public source snapshot are small repository-local compatibility implementations used through `file:` dependencies. They are not presented as complete upstream distributions merely because their package names resemble upstream packages.

The public snapshot currently treats these packages as part of the Gomdory source tree and keeps their code reviewable alongside the application.

## Courseware and binary content

The initial public code snapshot intentionally excludes the private courseware/media overlay, including:

- `public/lesson-kits/**`;
- binary lesson/courseware media whose redistribution provenance has not been individually cleared;
- the static Three.js fallback previously stored under the private courseware tree.

Those assets remain outside the public code repository until their redistribution rights and required notices are independently cleared.

## Production boundary

Production credentials, incident evidence, release authority, provider configuration, private content manifests, and historical operations material are not part of this repository.

A public source commit is build/review evidence only. It does not authorize production deployment.

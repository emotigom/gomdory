# Public link policy

Public pages must not link directly to private GitHub repository documents. In particular, gomdory.com pages must not send visitors to `github.com/*/gom-clean/blob/main/docs/*` because the repository is private and the link becomes a broken or inaccessible public experience.

When public visitors need documentation, use one of these targets instead:

- Site-owned public pages, such as `/school` or `/school/adoption-readiness`
- Public downloads, such as PDFs under `/downloads`
- Documents in a public repository
- Admin-only screens for operator/internal links

Internal developer docs and README files may still reference local `docs/*.md` files when they are not rendered as public-site links.

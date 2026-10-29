# Security and deployment notes

## What the code now enforces

- Email-code verification is counted per IP on the server, before Convex Auth
  checks the code. `otpGuard.noteVerifyAttempt` and `beginSend` use the IP from
  Convex request metadata, store only a salted SHA-256 hash in a ten-minute
  bucket, and never expose a write to the browser. The public `otpGuard.status`
  query takes no arguments and answers only for the signed-in account.
- A guest who adds an email keeps the same `users` row and every set attached to
  it. The `createOrUpdateUser` callback links the verified email to the current
  anonymous user; an already-verified account still wins.
- `users.deleteAccount` is a single authenticated mutation that removes sets,
  cards, quiz and exam rows, tutor threads, papers, courses, timetable rows,
  uploads, progress shares, auth accounts and sessions, and finally the user.
- Share and auth routes are marked `noindex`; the 404 shell is also `noindex`.
- The old Cognito PDF proxy is gone. Past-paper buttons open the publisher's
  own page, so no third-party paper bytes are served from this domain.
- `public/_headers` and `vercel.json` carry a strict CSP, `frame-ancestors
  'none'`, `X-Frame-Options: DENY`, `nosniff`, a referrer policy and a
  permissions policy. `script-src 'self'` is possible because the theme boot
  script is now `public/theme-init.js`, not inline.

## Owner actions that cannot be done from this repository

These need account or host access, not a code change. They are still required
for the audit's acceptance criteria.

1. **Make the source private or split it.** Change `Codegister/bluprint` to
   private, or keep a private source repository and publish only `dist/` to a
   public `gh-pages` branch or a second repository. A private repository's
   GitHub Pages site needs a plan that includes Pages for private repositories.
2. **Rewrite the old author email out of history.** The address is in published
   history, not in the current tree. From a fresh clone, create a temporary
   mailmap (replace `<old-address>` with the address found in the commits) and
   run:
   ```sh
   printf 'Codegister <112625972+Codegister@users.noreply.github.com> <%s>\n' '<old-address>' > /tmp/bluprint-mailmap
   git filter-repo --mailmap /tmp/bluprint-mailmap --force
   rm /tmp/bluprint-mailmap
   git push --force-with-lease origin main
   ```
   This rewrites every commit and requires every collaborator to re-clone. It
   was not run here because this workspace cannot force-push `main`.
3. **Retire `bluprint.freebuff.app`.** That host is not configured in this
   repository. Set a permanent redirect to
   `https://codegister.github.io/bluprint/` at the host or DNS provider, or take
   the old deployment down. The current canonical URL in `index.html`, the
   manifest and the share links is the GitHub Pages URL.
4. **Move off GitHub Pages for headers and 200 deep links.** GitHub Pages
   ignores `_headers`, cannot set response headers and returns its `404.html`
   for `/tutor`, `/sets/*`, `/privacy` and `/share/*`. `public/_redirects` and
   `vercel.json` are ready for Netlify, Cloudflare Pages or Vercel; deploy there
   and point the canonical URL at the new host. Until then the meta CSP is only
   partial: `frame-ancestors` is ignored in a meta tag, so clickjacking cannot
   be fully prevented on Pages.
5. **Past papers now link to the publisher.** The `/cognito-paper` proxy has
   been removed. The Past papers page credits the boards and Cognito, links to
   the question paper and mark scheme on Cognito's own site in a new tab, and
   offers a takedown route. Bluprint no longer serves or redistributes the
   third-party PDFs; the licence question is therefore avoided rather than
   assumed. Bluprint's own generated questions remain available.

## Reporting a vulnerability

Use the private security advisory form on the repository, or the contact in
`public/.well-known/security.txt`. Please do not open a public issue for an
unfixed vulnerability.

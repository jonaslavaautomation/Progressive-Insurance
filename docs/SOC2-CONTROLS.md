# SOC 2 Control Inventory: LAVA Training

SOC 2 is an attestation by an independent CPA firm on the design (Type I) and the operating
effectiveness over a period (Type II) of an organization's controls against the AICPA Trust
Services Criteria. **Software alone cannot be "SOC 2 compliant."** This document lists the technical
controls implemented in this repository, mapped to the criteria, and the organizational controls
LAVA Automation must operate and evidence for an audit.

Scope: the LAVA Training web app (static React SPA on Vercel, source on GitHub). The app has no
server-side database; training data is stored only in each user's browser.

## Implemented technical controls

| Criteria | Control | Where | Evidence for the auditor |
|---|---|---|---|
| CC6.1 Logical access | Every request, including JavaScript, CSS, images and documents, requires credentials. Unauthenticated visitors receive only a 401, so the application code is never delivered to them. | `middleware.ts` (Vercel Routing Middleware) | Middleware source; Vercel env var `SITE_USERS` change history |
| CC6.1 | Passwords are stored only as SHA-256 hashes in an environment variable, compared in constant time; unknown users take the same path as wrong passwords. | `middleware.ts` | Source review |
| CC6.1 | Fails closed: if no users are configured the site returns 503 instead of opening. | `middleware.ts` | Source review |
| CC6.2 / CC6.3 Provisioning & removal | One named account per person in `SITE_USERS`; removing the entry revokes access on the next request. | Vercel project settings | Access list + review records (see organizational controls) |
| CC6.6 Boundary protection | Strict Content-Security-Policy (`script-src 'self'`, no inline scripts, `object-src 'none'`, `frame-ancestors 'none'`), X-Frame-Options DENY, X-Content-Type-Options nosniff, Permissions-Policy denying camera/mic/location/payment, COOP/CORP same-origin, `noindex`. | `vercel.json` | Response headers (securityheaders.com scan) |
| CC6.7 Data in transit | HTTPS only with HSTS (2 years, includeSubDomains, preload); `upgrade-insecure-requests`. | `vercel.json`, Vercel TLS | Header scan, SSL Labs report |
| CC6.8 / CC7.1 Vulnerability management | Production dependencies audited on every PR (`npm audit --omit=dev --audit-level=high`); Dependabot weekly update PRs; unused packages removed. | `.github/workflows/ci.yml`, `.github/dependabot.yml` | CI run history, Dependabot PRs |
| CC8.1 Change management | All changes reach production through pull requests; CI must pass (audit, type checks, lint, build, no source maps). | GitHub PRs, `ci.yml` | PR history with approvals and checks |
| C1.1 Confidentiality | No secrets or API keys in the client bundle; `.env*` git-ignored; source maps, console output and code comments stripped from production builds. | `vite.config.ts`, `.gitignore` | Build output review |
| C1.2 Disposal | "Sign out and clear this computer" erases all locally stored training data; 15-minute idle session timeout with warning. | `src/services/session.ts`, `src/components/SessionGuard.tsx` | Demo / screenshots |
| P / C1 Data minimization | Sign-in screen and policy require fictitious data only; reference accounts are fictitious; documents are watermarked "Training simulation, not proof of insurance". | UI | Screenshots |
| CC7.2 Monitoring (user activity) | In-app Activity Log records every quote, bind, document, payment and sign-in with user and time (per browser). | `src/services/activity.ts` | Activity Log export (CSV) |

### Known limitations (documented risks)

| Risk | Treatment |
|---|---|
| Basic authentication is a single factor and has no lockout. | **Recommended:** replace with SSO + MFA: Vercel Authentication / Deployment Protection, or Cloudflare Access / Okta / Entra ID in front of the site. |
| Anyone who is signed in can view the shipped JavaScript in DevTools. | Accepted: this is true of every web app. No secrets are shipped; all access control is enforced at the edge before code is delivered. |
| Training data in the browser's localStorage is not encrypted. | Accepted for fictitious data. Real customer data would require a server-side database with encryption at rest, which is out of scope. |
| The Activity Log lives in each browser, not a central log. | **Recommended:** enable a Vercel log drain to a SIEM for central request logs. |
| `esbuild` (≤0.24.2) moderate advisory affects only the local dev server. | Accepted: not part of the production bundle. Resolve by upgrading Vite when practical. |

## Organizational controls LAVA Automation must operate

These are required for a SOC 2 report and cannot be implemented in code:

1. **Governance (CC1, CC2):** written information security policy, acceptable use, data classification; named security owner; annual policy review.
2. **Risk assessment (CC3):** annual risk assessment and a risk register (start with the table above).
3. **Access management (CC6.2-CC6.3):** documented onboarding and offboarding; quarterly access review of `SITE_USERS`, GitHub org members and Vercel team members; MFA enforced on GitHub and Vercel accounts; least privilege (only admins can change env vars or merge to `main`).
4. **Branch protection (CC8.1):** in GitHub, require pull requests, at least one approving review and passing CI on `main`; disallow force pushes.
5. **Vendor management (CC9.2):** keep SOC 2 reports for Vercel, GitHub and Google (Fonts) on file; review annually.
6. **Incident response (CC7.3-CC7.5):** written incident response plan, contact list, and post-incident reviews; test annually.
7. **Security awareness (CC1.4):** annual training for staff and trainees, including the "fictitious data only" rule.
8. **HR security (CC1.4):** background checks and confidentiality agreements as appropriate.
9. **Business continuity (A1):** document recovery (redeploy from GitHub) and test it.
10. **Audit:** engage a CPA firm; most organizations do a readiness assessment, then a Type I, then a Type II over 3-12 months. Compliance automation tools (e.g. Vanta, Drata, Secureframe) can collect evidence.

## Configuration checklist (before going live)

- [ ] Set `SITE_USERS` in Vercel for Production and Preview (see `.env.example`). Until it is set, the site returns 503.
- [ ] Enable MFA on every GitHub and Vercel account.
- [ ] Turn on GitHub branch protection for `main` (required review and passing CI).
- [ ] Optionally enable Vercel Deployment Protection or an SSO proxy for MFA.
- [ ] Rename the GitHub repository and Vercel project to remove third-party trademarks.

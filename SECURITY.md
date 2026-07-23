# Security policy

## Supported build

Security fixes target the latest public beta shown in `package.json`. Older beta artifacts may be removed rather than patched.

## Reporting

Use the repository's **private vulnerability report** at:

https://github.com/YOxyfel/constellore/security/advisories/new

Do not open a public issue containing an exploit, bearer token, Recovery Kit, private player data, payment information, or an unpatched vulnerability. If private reporting is unavailable, open a public issue stating only that a private contact is required.

Include the affected build ID, route or endpoint, reproduction steps, impact, and a minimal proof of concept that does not access another person's data.

## Safe testing boundary

Good-faith testing is limited to profiles, tokens, and runs you created yourself. Do not degrade availability, automate large request volumes, attempt social engineering, access another player's data, or test third-party infrastructure without its permission.

The current beta does not authorize paid bug-bounty rewards. Oxyfel Games will acknowledge a reproducible private report when operationally possible, investigate it, and coordinate disclosure after affected builds have been protected.


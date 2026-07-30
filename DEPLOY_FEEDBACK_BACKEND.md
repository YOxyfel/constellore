# Free anonymous feedback backend

Constellore's public game already saves every missing-combination idea locally and retries temporary delivery failures. This Worker is the free hosted receiver that makes those ideas reach Oxyfel Games without GitHub, an account, a name, or an email address.

## What is stored

The receiver accepts only:

- two released Constellore words;
- one optional suggested result of at most 28 characters;
- one fixed reason;
- the game mode;
- a random duplicate-check identifier.

The raw duplicate-check identifier and the player's IP address are never stored. The identifier is converted to a one-way, pair-scoped HMAC. Reports older than 180 days without activity are deleted automatically. Arbitrary comments, links, email addresses, unknown words, and combinations that already have an authored answer are rejected.

## Free Cloudflare resources

The receiver uses one Cloudflare Worker and one D1 database. A free `workers.dev` address is enough; no domain or paid plan is required.

The only account-owned action is signing in to Cloudflare. Run all commands from the repository root.

## One-time deployment

1. Sign in:

   ```powershell
   npx --yes wrangler@4.114.0 login
   ```

2. Create the EU-jurisdiction D1 database and add its opaque binding to the existing Wrangler configuration:

   ```powershell
   npx --yes wrangler@4.114.0 d1 create constellore-feedback --jurisdiction eu --binding DB --update-config --config workers/feedback/wrangler.jsonc
   ```

3. Apply the schema:

   ```powershell
   npx --yes wrangler@4.114.0 d1 migrations apply DB --remote --config workers/feedback/wrangler.jsonc
   ```

4. Generate two different temporary secrets and transmit them directly to Cloudflare. They are not written to the repository:

   ```powershell
   $env:REPORT_HMAC_SECRET = node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
   $env:CONSTELLORE_ADMIN_TOKEN = node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
   $env:REPORT_HMAC_SECRET | npx --yes wrangler@4.114.0 secret put REPORT_HMAC_SECRET --config workers/feedback/wrangler.jsonc
   $env:CONSTELLORE_ADMIN_TOKEN | npx --yes wrangler@4.114.0 secret put CONSTELLORE_ADMIN_TOKEN --config workers/feedback/wrangler.jsonc
   ```

5. Deploy:

   ```powershell
   npm run feedback:deploy
   ```

   Save the exact `https://constellore-feedback.<account-subdomain>.workers.dev` URL printed by Wrangler.

6. Verify storage:

   ```powershell
   $workerBase = "https://constellore-feedback.<account-subdomain>.workers.dev"
   Invoke-RestMethod "$workerBase/healthz"
   ```

   A healthy response contains `"ok": true` and `"storage": "d1"`.

7. Clear the temporary HMAC value from the shell. Keep the admin token in a password manager because it is required to read the private aggregate:

   ```powershell
   Remove-Item Env:REPORT_HMAC_SECRET
   ```

## Connect GitHub Pages and itch.io

The public endpoint must be the exact HTTPS report route:

```text
https://constellore-feedback.<account-subdomain>.workers.dev/api/combination-reports
```

Set the GitHub Actions repository variable:

```powershell
gh variable set PUBLIC_FEEDBACK_API_URL --repo YOxyfel/constellore --body "$workerBase/api/combination-reports"
```

Push or manually run the Pages workflow. It will inject the receiver into the public game without exposing either secret.

Build the itch package with the same public URL:

```powershell
$env:PUBLIC_FEEDBACK_API_URL = "$workerBase/api/combination-reports"
npm run build:release
Remove-Item Env:PUBLIC_FEEDBACK_API_URL
```

Upload the newly generated versioned ZIP from `dist-itch`.

## Read the reports

The existing operator exporter works with this Worker:

```powershell
$env:CONSTELLORE_OPERATOR_BASE_URL = $workerBase
$env:CONSTELLORE_ADMIN_TOKEN = "<the admin token kept in your password manager>"
npm run --silent operator:feedback | Set-Content ".\constellore-feedback.json" -Encoding utf8
Remove-Item Env:CONSTELLORE_OPERATOR_BASE_URL
Remove-Item Env:CONSTELLORE_ADMIN_TOKEN
```

The JSON contains aggregate word pairs, suggested answers, reasons, modes, and counts. It contains no raw player identifier, IP address, email address, or open comment. The same rows can also be inspected inside Cloudflare's D1 dashboard after signing in.

## Updating the word graph

Whenever authored recipes change, regenerate the receiver's released-word and authored-pair manifest before deployment:

```powershell
npm run feedback:manifest
npm run feedback:test
```

The normal `npm run check` suite also fails if this manifest becomes stale.

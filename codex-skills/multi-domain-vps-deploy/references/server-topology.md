# Server Topology: 51.68.143.29

This file captures the last confirmed layout of the shared VPS. Re-check live state before making changes.

## Known domains

- `magazynek.online`
- `panel.ceo`
- `sms.panel.ceo`
- `gdzieciegniecie.pl` (user says it points to the same server; verify live ownership before editing)

## Known app directories under /opt

Confirmed previously:
- `/opt/gdzieciegniecie`
- `/opt/magazynek/current`
- `/opt/smsapi/current`
- `/opt/mailserver`

No confirmed `momentum` or `momentum-way` deployment directory was found during earlier searches.

## Confirmed static site mapping

### gdzie-cie-gniecie
- repo slug: `gdzie-cie-gniecie`
- public URL: `https://gdzieciegniecie.pl/`
- live files directory: `/opt/gdzieciegniecie`
- observed live server response: Caddy served the site directly from that directory on `2026-03-22`
- safe deploy pattern: sync local `dist/` with `rsync -az --delete` to `root@51.68.143.29:/opt/gdzieciegniecie/`
- verify `https://gdzieciegniecie.pl/` and the current `/assets/index-*.js` URL after deploy

## Known running services and patterns

### Magazynek
- lives under `/opt/magazynek/current`
- uses Docker Compose
- shared TLS/routing was previously handled by Caddy in:
  - `/opt/magazynek/current/ops/deploy/Caddyfile`
- known containers included:
  - `magazynek-web`
  - `magazynek-api`
  - `magazynek-postgres`

### SMS / panel.ceo side
- app directory previously found at `/opt/smsapi/current`
- `.env` there previously contained `APP_DOMAIN=sms.panel.ceo`
- known container: `smsapi-app`
- traffic for `panel.ceo` and `sms.panel.ceo` was previously repaired by editing the shared Caddy in `magazynek`

## Important historical finding

At one point:
- `panel.ceo` failed at TLS because the shared Caddy only served `magazynek.online`
- adding `panel.ceo, sms.panel.ceo` to the shared Caddy restored host-level TLS and routing
- after that, `https://panel.ceo/momentum-way/` returned `404`, which means the host worked but the path/app did not exist in the deployed application

Interpretation:
- if `panel.ceo/momentum-way` is missing, first suspect missing app or missing path route, not TLS

## Safe remote checks

Start with these:
```bash
find /opt -maxdepth 3 -iname '*momentum*' 2>/dev/null
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}'
grep -RIn 'panel.ceo\|sms.panel.ceo\|magazynek.online\|gdzieciegniecie.pl' /opt /etc/nginx 2>/dev/null
```

To inspect the shared Caddy case:
```bash
cd /opt/magazynek/current/ops/deploy
docker compose ps
cat Caddyfile
```

To inspect the sms app:
```bash
cd /opt/smsapi/current
ls -la
cat .env
```

## Deployment heuristics for this VPS

- If the new app belongs to `magazynek.online`, it will likely be managed from `/opt/magazynek/current`.
- If the new app belongs to `panel.ceo` or `sms.panel.ceo`, do not assume it lives inside `smsapi`; confirm first.
- If no existing app directory owns the requested project, create a new `/opt/<slug>` deployment root and add only the minimum proxy rule needed.
- For path-based routes on `panel.ceo`, prefer keeping host-level TLS in the shared proxy and routing only `/slug/*` to the new app.

## Verification checklist

After any change, verify all of these:
```bash
curl -I https://panel.ceo/
curl -I https://panel.ceo/momentum-way/
curl -I https://sms.panel.ceo/admin
curl -I https://magazynek.online/
openssl s_client -connect panel.ceo:443 -servername panel.ceo </dev/null
```

If one of the unrelated hosts breaks, revert the exact live change directly after confirming which file or route caused it.

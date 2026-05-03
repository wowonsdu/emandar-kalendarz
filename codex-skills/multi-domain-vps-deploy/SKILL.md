---
name: multi-domain-vps-deploy
description: Use when asked to route, deploy, or recover a project under panel.ceo, magazynek.online, or gdzieciegniecie.pl on root@51.68.143.29, especially when work involves /opt app directories and shared reverse-proxy changes that must not break existing hosts.
---

# Multi-Domain VPS Deploy

Use this skill when a user asks to expose an app on the shared VPS at `root@51.68.143.29`, for example under `panel.ceo/momentum-way`, `magazynek.online`, or `gdzieciegniecie.pl`.

The goal is to add or recover routing safely. Treat this box as a shared server: prefer additive changes, verify ownership before editing anything, and do not assume the proxy is nginx just because the user says so.

## Known project mappings

When the current repo is `gdzie-cie-gniecie`, treat it as this confirmed static deploy target unless live inspection proves otherwise:
- public URL: `https://gdzieciegniecie.pl/`
- live directory: `/opt/gdzieciegniecie`
- deploy host: `root@51.68.143.29`
- deploy method: sync local `dist/` with `rsync -az --delete`
- verify both the root URL and the current hashed asset URL return `200`

## Trigger Examples

Use this skill for requests like:
- "Pod panel.ceo/momentum-way ma działać projekt X"
- "Wdróż aplikację pod gdzieciegniecie.pl"
- "Znajdź, gdzie na serwerze siedzi aplikacja i podepnij ją pod domenę"
- "Napraw routing domeny na tym VPS-ie, ale niczego nie zepsuj"

Do not use this skill for ordinary app-only feature work that does not touch deployment, domains, `/opt`, Docker, or the reverse proxy.

## Workflow

### 1. Confirm the target routing shape

Before touching the server, derive these four values from the request:
- `domain`: exact host, for example `panel.ceo`
- `pathPrefix`: optional path segment, for example `/momentum-way`
- `appSlug`: deployment name, usually a slug like `momentum-way`
- `upstreamType`: static site, Node app, Docker service, or unknown

If the user only gives a URL target like `panel.ceo/momentum-way`, assume:
- `domain = panel.ceo`
- `pathPrefix = /momentum-way`
- `appSlug = momentum-way`

### 2. Inventory the remote state first

SSH to `root@51.68.143.29` and inspect before editing.

Always check:
- what exists under `/opt`
- whether the app already exists under a different name
- whether traffic is currently terminated by Caddy, nginx, or something else
- whether the target app already has a running container or service

Start with:
```bash
find /opt -maxdepth 3 \( -type d -o -type f \) -iname '*momentum*' 2>/dev/null
find /opt /srv /var/www /home /root -type d -iname 'momentum*' 2>/dev/null
find /etc/nginx /opt -maxdepth 4 -type f \( -name 'Caddyfile' -o -name '*.conf' -o -name 'compose.yaml' -o -name 'docker-compose.yml' \) 2>/dev/null
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}'
```

If the project name is unknown or fuzzy, search file contents too:
```bash
grep -RIn --exclude-dir=node_modules --exclude-dir=.git 'momentum' /opt /srv /var/www /home /root 2>/dev/null
```

### 3. Decide whether to reuse or create a deployment directory

Prefer this order:
1. Existing project directory already matching the app
2. Existing app family directory for the same host or system
3. New `/opt/<app-slug>` deployment root

Rules:
- Do not drop a new project into an unrelated app directory just because it shares the same server.
- If an existing project already owns the host and the new app is only a path-mounted sub-app, keep the new routing change in the host owner's proxy config, but keep the app code/deploy in its own `/opt/<app-slug>` directory unless the existing project clearly already organizes sub-apps internally.
- If you create a new deployment root, prefer a structure that is easy to reason about later, for example `/opt/<app-slug>/current` or the existing pattern used by neighboring apps.

### 4. Detect the actual reverse proxy owner

Do not assume nginx. Detect it.

Use this rule:
- If Caddy is terminating TLS for the host, edit the owning `Caddyfile`
- If nginx is terminating TLS for the host, edit the owning `server` block
- If a containerized proxy fronts multiple apps, update that proxy instead of creating a second competing listener

For this VPS, read [references/server-topology.md](references/server-topology.md) first, then re-check the live state before editing.

### 5. Make additive proxy changes only

Never replace whole host blocks unless the user explicitly asks for a migration.

Preferred patterns:
- Caddy host block with `handle_path /slug/*` for path-based apps
- nginx `location /slug/` inside the existing `server_name` block

For path-based apps, preserve the existing default handler for the host.

Caddy pattern:
```caddy
panel.ceo {
  encode zstd gzip

  handle_path /momentum-way/* {
    reverse_proxy momentum-way-app:3000
  }

  handle {
    reverse_proxy smsapi-app:3000
  }
}
```

nginx pattern:
```nginx
server {
  server_name panel.ceo;

  location /momentum-way/ {
    proxy_pass http://127.0.0.1:3100/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location / {
    proxy_pass http://127.0.0.1:3000;
  }
}
```

Important:
- For path routing, verify whether the target app supports a base path. If it assumes `/`, it may need a base URL setting or rewrite support before exposing it under `/momentum-way`.
- Never delete existing host aliases just to make the new route work.

### 6. Validate, reload, verify

Do not create server-side backup directories or `*.bak` copies as part of the default deploy flow.

Validate before reload:
- Caddy: `caddy validate --config <file>` or container equivalent
- nginx: `nginx -t`
- Docker Compose: `docker compose config`

Then reload the smallest possible surface.

Verify with:
```bash
curl -I https://panel.ceo/momentum-way/
curl -I https://magazynek.online/
openssl s_client -connect panel.ceo:443 -servername panel.ceo </dev/null
```

Also verify unrelated hosts that share the same proxy still work.

### 7. Report clearly

When done, report:
- what directory now owns the app
- what proxy file was changed
- what command was used to reload
- exact verification results for the target route and for at least one neighboring host

## Safety Rules

- Treat `/opt` as shared ownership territory.
- Prefer inspecting and extending the existing deployment pattern over inventing a new one.
- Do not stand up a second TLS terminator on ports `80/443` when one already exists.
- Do not overwrite shared config just to fix one host.
- If SSH becomes flaky or blocked, stop and report that live confirmation is incomplete.
- If the app is missing entirely, say so plainly and switch from "routing fix" to "new deploy" mode.

## References

Read these only as needed:
- [references/server-topology.md](references/server-topology.md): current known layout of this VPS, known domains, and what already runs in `/opt`

# Facebook comments: Comments Manager shows them, SocialAiDigital Sync finds none

## Short summary

SocialAiDigital Sync **is working**. It lists your Facebook Page posts via the Meta Graph API.  
**Comments Manager** (Facebook’s own UI) can still show comments that Graph returns as empty (`data: []`).  
That is a **Meta app / Development mode / App Review** visibility limit — not a broken Inbox filter.

Typical Sync banner:

```text
Facebook: synced 0 new (0 updated) from 0 fetched.
Scanned 40 posts (0 with comment signal); checked 40 …
Graph returned none …
Probe: … summaryTotal=0, probeDataLength=0
Token: … granted=[… pages_read_engagement, pages_read_user_content …]
```

---

## What each part means

| Message | Meaning |
|--------|---------|
| `0 fetched` / `0 new` | No Facebook comments were saved to the database |
| `Scanned N posts` | Graph successfully listed Page posts |
| `0 with comment signal` | Graph report `comments.summary.total_count` as 0 / missing on those posts |
| `Graph returned none` | `/{post-id}/comments` returned an empty list (often HTTP 200, no hard error) |
| `probe … summaryTotal=0` | A sample post was checked; Graph still said 0 comments |
| `granted=[… pages_read_* …]` | Scopes are on the token — missing permission is **not** the usual cause when you see this |

**Permissions on the token ≠ ability to read every public commenter’s text** while the app is in Development mode or before Live + App Review.

```text
Comments Manager  →  shows all Page comments (native Facebook)
Graph API (Dev)  →  often only comments from Admin / Developer / Tester on the app
SocialAiDigital Sync         →  only what Graph returns  →  Inbox stays empty for Facebook
```

---

## How to fix (do in this order)

### 1. App roles (required)

1. Open [Meta for Developers](https://developers.facebook.com) → your app.  
2. **App roles** → ensure the Facebook user who **admins the Page** (e.g. Myindiaservice) is **Admin**, **Developer**, or **Tester** on the app.

### 2. Test comment (confirms Dev-mode filtering)

1. On a Page post, leave a comment **as that same role account** (e.g. `TEST from admin`).  
2. In SocialAiDigital → **Connect** → **Sync comments** (Facebook).  
3. Check Inbox → platform **Facebook**.

| Result | Conclusion |
|--------|------------|
| Test comment appears (`fetched >= 1`) | Dev-mode filtering confirmed. Public users’ comments need Live + App Review. |
| Still `0 fetched` | Reconnect Facebook, confirm connected Page id matches Comments Manager, then continue to step 3. |

### 3. Public commenters (Panasia, etc.)

1. Meta Developer Console → **App Review** for:  
   - `pages_read_engagement`  
   - `pages_read_user_content`  
2. Set the app to **Live**.  
3. In SocialAiDigital: **Reconnect Facebook** → **Sync comments**.

Without Live + approved permissions, random users’ comments usually **never** appear in Graph — even if Comments Manager shows them.

### 4. After any Meta change

Always: **Reconnect Facebook** → **Sync comments** → Inbox filter **Facebook**.

Deploy note: Graph/sync logic lives on the **API** service. Redeploy the API on Render after code pushes; the static client alone is not enough.

After Connect, you must stay logged in: on the Render API set `CLIENT_URL=https://www.socialaidigital.com` (not localhost first) and redeploy the API so OAuth returns to the live site with your JWT.

---

## What SocialAiDigital already does (code)

- Deep-scans posts (paging, up to ~250).  
- Merges `published_posts` + `feed` + `posts`.  
- Falls through empty nested `comments.data` to `/{post}/comments`.  
- Probes one post and prints scopes when Sync finds 0.  
- Surfaces a clear Connect / Sync error when `fetched === 0`.

Code cannot invent comments that Graph hides.

---

## Quick checklist

- [ ] Page admin is Admin/Developer/Tester on the Meta app  
- [ ] Test comment as that role user → Sync → appears in Inbox  
- [ ] App Review approved for the two `pages_read_*` permissions  
- [ ] App mode = **Live**  
- [ ] Reconnect Facebook + Sync after going Live  
- [ ] Connected Page name/id matches Comments Manager  

## Meta Developer Tools MCP (inspect only)

Cursor can read Meta app settings via [Developer Tools MCP](https://developers.facebook.com/documentation/mcp/devtools-mcp) (`https://mcp.facebook.com/devtools`). It does **not** set Privacy URLs, App Domains, or OAuth redirect URIs. Write access is webhooks only.

Config: user `~/.cursor/mcp.json` and this repo [`.cursor/mcp.json`](../.cursor/mcp.json). After adding the server:

1. Cursor **Settings → Tools & Integrations** → **Meta Developer Tools** → **Needs login**.
2. Sign in with the Meta account that admins app `1645663120309703`.
3. Grant **Read** on that app.

Then ask the agent to list apps and show basic settings. Cross-check against live:

| Setting | Expected |
|--------|----------|
| Privacy Policy | `https://www.socialaidigital.com/privacy` |
| Terms of Service | `https://www.socialaidigital.com/terms` |
| User data deletion | `https://www.socialaidigital.com/data-deletion` |
| Valid OAuth Redirect URI | `https://api.socialaidigital.com/api/connections/meta/callback` |
| App Domains | `socialaidigital.com`, `api.socialaidigital.com` |

If redirect URI or domains do not match, fix them in [Meta Developer Console](https://developers.facebook.com/apps) — not via MCP.

### Authenticate stuck on `127.0.0.1 refused to connect`

Cursor often listens only on IPv6 (`[::1]:8787`) while Facebook redirects to IPv4 `http://127.0.0.1:8787/callback`. Confirm with:

```bash
lsof -nP -iTCP:8787 -sTCP:LISTEN
```

If you see `[::1]:8787` and not `127.0.0.1:8787`:

1. Cursor → **Authenticate** (keep Cursor open).
2. In another terminal from the repo root:

```bash
node scripts/cursor-mcp-ipv4-proxy.mjs
```

3. Facebook → **Continue**. The proxy forwards IPv4 to Cursor.
4. Stop the proxy with Ctrl+C after MCP shows connected.

This does not change SocialAiDigital’s API callback (`https://api.socialaidigital.com/api/connections/meta/callback`).

---

## Related

- Connect UI copy: `client/src/pages/Connections.jsx` (Facebook panel)  
- Sync / Graph: `server/services/meta.js`  
- Deploy: `docs/RENDER_DEPLOYMENT.md`

# Meta automation safety (Delulu-style SaaS)

SocialAiDigital already uses **one Meta App + per-user OAuth tokens** (same shape as Delulu). Official Graph APIs are allowed; **burst writes and rapid sync** trigger “automated behaviour” warnings.

## Part A — Account cool-down (do now)

1. Keep Meta app in **Development** until pacing is proven on a test Page.
2. Settings → turn **Auto-reply on sync OFF** and **Instagram sales agent OFF**.
3. Sync Facebook/Instagram at most 1–2×/day while cooling down.
4. Prefer **manual Post reply** for hot leads.
5. Accounts Center → log out unknown sessions; remove unknown Business integrations.
6. Disable unofficial n8n/Zapier auto-like / auto-comment / scrapers on the same account.

## Built-in product safeguards

| Control | Behavior |
|---------|----------|
| Sync cooldown | FB/IG sync rejected for **10 minutes** after last sync |
| Per-sync auto-reply cap | Max **5** Meta write slots (public replies + IG private_replies) per sync |
| Outbound delay | Random **3–6s** between Meta comment/DM writes |
| Daily budget | Default `autoReplyDailyLimit` **20**; public reply and DM each count |
| Graph backoff | Retries on HTTP 429 and Meta codes 4 / 17 / 32 |
| Idempotency | `platformReplyId: pending` + `replyClaimedAt`; stale pending reclaimable after **2 minutes** |

Defaults: FB scan `maxPosts=20`, `maxScan=80`; IG `maxMedia=10`.

## Live go-live gate

Do **not** switch Meta app to Live until:

- [ ] Auto-reply / sales agent remain **default OFF** for new users
- [ ] Test only on a **dedicated test Page / test IG** (not personal main account)
- [ ] App Review approved for needed scopes (comment reply first; messaging later)
- [ ] Privacy Policy + Data deletion URLs live; OAuth redirects match production
- [ ] Early Live daily auto-reply limit ≤ 10–20 with monitoring
- [ ] Users reconnect after Live so tokens get approved scopes

## Multi-tenant rules

- Never use Client A’s token for Client B (already enforced via `Connection` + `userId`).
- Resolve webhooks by Page / IG account id → that user’s connection.
- Prefer webhooks over aggressive polling for Live scale.

## Related docs

- [FACEBOOK_COMMENTS_SYNC.md](./FACEBOOK_COMMENTS_SYNC.md) — Dev vs Live comment visibility
- [META_INSTAGRAM_SETUP.md](./META_INSTAGRAM_SETUP.md) — OAuth and messaging

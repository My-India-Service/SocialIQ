# Platform reply — live verification checklist

Run after deploy to confirm posting works in your Meta/Google apps. Dev mode only delivers to app testers/admins until App Review approves comment-reply permissions.

## Prerequisites

- [ ] YouTube connected via Google OAuth (`youtube.force-ssl` scope)
- [ ] Facebook Page connected via Meta OAuth (`pages_manage_engagement`) — for FB comments only
- [ ] Instagram via **Connect with Instagram** (`instagram_business_manage_comments`) **or** via Facebook Page link
- [ ] LinkedIn Company Page via **Connect LinkedIn** (Community Management API)
- [ ] Settings → Auto-reply enabled (optional, for sync test)

## Instagram connect paths

| Path | Redirect | Facebook Page required? |
|------|----------|---------------------------|
| Connect with Instagram | instagram.com | No |
| Connect via Facebook Page | facebook.com | Yes (IG linked to Page) |

## Manual post (Inbox)

| Platform | Steps | Pass |
|----------|-------|------|
| **YouTube** | Sync → open a comment → **Post reply & mark done** → verify reply on YT | ☐ |
| **Facebook** | Same → verify reply on Page post | ☐ |
| **Instagram** | Same → verify reply on IG post | ☐ |
| **LinkedIn** | Same → verify reply on Company Page post | ☐ |

After each post, confirm in Voxa:

- [ ] `Posted on platform` badge shows (no Post button)
- [ ] `postedReplyAt` timestamp in helper text
- [ ] Status = Replied (unless you only used Save without posting)

## Duplicate guard

- [ ] Click Post again on same comment → API returns 409 / “already posted”
- [ ] Post button replaced by “Posted on platform” badge

## Auto-reply on sync

1. Settings → enable Auto-reply, threshold 80, daily limit ≥ 1
2. Post a new hot-lead or high-intent sales comment on YT/FB/IG (or wait for organic)
3. Connect → Sync

Confirm:

- [ ] Sync message includes `Auto-replied on platform: N`
- [ ] Comment has platform reply visible
- [ ] If auto-routed to sales, status stays **Sent to sales** (not overwritten to Replied)
- [ ] Daily remaining count decreases in Settings

## Error paths

- [ ] Disconnect platform → Post shows reconnect hint + **Open Connect** link
- [ ] Missing Meta permission → error mentions `pages_manage_engagement` or `instagram_manage_comments`

## WhatsApp (out of scope)

- [ ] WhatsApp comments show Copy + Save without posting only (no Post button)

# SocialAiDigital on the shared AWS server

SocialIQ runs next to the Unaffected Healthcare apps on the AWS EC2 server (`3.24.15.132`, Sydney) without changing them.

| | Healthcare (do not touch) | SocialIQ |
|---|---|---|
| Static | `/var/www/unaffectedhealthcare`, `/var/www/portal` | `/var/www/socialaidigital` |
| API | `/var/www/unaffectedhealthcare-api`, `/var/www/portal-api` | `/var/www/socialaidigital-api/server` |
| PM2 | `main-api` :5500, `portal-api` :5001 | `socialaidigital-api` :5600 |
| nginx | `unaffectedhealthcare.in.conf`, `portal.unaffectedhealthcare.in.conf` | `socialaidigital.com.conf` |
| TLS | Let's Encrypt | Cloudflare Origin Certificate, `/etc/ssl/socialaidigital/` |

The site and API share one origin: `https://www.socialaidigital.com` serves the React build, and `/api/*` is proxied to port 5600. Render stays live until the DNS switch in step 6 and is the rollback.

---

## 1. Check the server

```bash
ssh -i <aws-key>.pem ubuntu@3.24.15.132
free -h          # if total RAM < 2 GB, add swap (below)
df -h /          # need ~1 GB free
ss -ltnp         # 5600 must be free
pm2 ls           # note main-api / portal-api restart counts for later comparison
```

Optional swap (does not affect running apps):

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## 2. Cloudflare Origin Certificate (zone socialaidigital.com)

1. Cloudflare → **socialaidigital.com** → SSL/TLS → Origin Server → **Create Certificate**.
   Hostnames: `socialaidigital.com`, `*.socialaidigital.com`. Validity 15 years. Key type RSA.
2. On the server:
   ```bash
   sudo mkdir -p /etc/ssl/socialaidigital
   sudo nano /etc/ssl/socialaidigital/origin.pem   # paste the Origin Certificate
   sudo nano /etc/ssl/socialaidigital/origin.key   # paste the Private Key
   sudo chmod 600 /etc/ssl/socialaidigital/origin.key
   ```
3. SSL/TLS → Overview → **Full (strict)** for this zone (Render also works with it). This setting is per zone; the healthcare zone is unchanged.

## 3. Bootstrap (SocialIQ paths only)

From your Mac:

```bash
scp -i <aws-key>.pem -r deploy/socialaidigital ubuntu@3.24.15.132:~/socialaidigital-deploy
```

On the server:

```bash
bash ~/socialaidigital-deploy/server-bootstrap.sh
```

The script refuses to continue if port 5600 is taken, and removes only its own site if `nginx -t` fails.

## 4. Environment, database, GitHub

1. **.env**
   ```bash
   cp ~/socialaidigital-deploy/env/production.env.example /var/www/socialaidigital-api/server/.env
   nano /var/www/socialaidigital-api/server/.env   # fill secrets from Render → voxa-api → Environment
   chmod 600 /var/www/socialaidigital-api/server/.env
   ```
   Keep `PORT=5600` and `CRISIS_MONITOR_ENABLED=false` until cutover.
2. **MongoDB Atlas** (SocialIQ project) → Network Access → add `3.24.15.132/32`.
3. **Deploy key** (on your Mac):
   ```bash
   ssh-keygen -t ed25519 -N '' -C socialiq-deploy-aws -f ~/.ssh/sq_aws_deploy
   ssh -i <aws-key>.pem ubuntu@3.24.15.132 "cat >> ~/.ssh/authorized_keys" < ~/.ssh/sq_aws_deploy.pub
   ```
4. GitHub → `My-India-Service/SocialIQ` → Settings → Secrets and variables → Actions:

   | Secret | Value |
   |---|---|
   | `SQ_AWS_HOST` | `3.24.15.132` |
   | `SQ_AWS_USER` | `ubuntu` |
   | `SQ_AWS_SSH_KEY` | contents of `~/.ssh/sq_aws_deploy` (private key) |

5. Actions → **Deploy SocialAiDigital to AWS** → Run workflow (or push to `main`). Until the three secrets exist the workflow skips the deploy instead of failing.

On the server afterwards:

```bash
pm2 ls                                   # socialaidigital-api online; main-api / portal-api unchanged
curl -s localhost:5600/api/health
pm2 save
```

## 5. Private test (users still on Render)

1. Cloudflare DNS → add `new` → A → `3.24.15.132` → Proxied.
2. Open `https://new.socialaidigital.com`: register/login, Inbox, Billing, Connect, `/privacy-policy.html`, `/sitemap.xml`, `/robots.txt`.
   OAuth buttons will only work after step 6.1 adds the new redirect URIs; they point at `www`, so test them after cutover.
3. Healthcare still fine: `https://unaffectedhealthcare.in`, `https://portal.unaffectedhealthcare.in`, `pm2 ls` restart counts unchanged.

## 6. Cutover

1. **Add new URLs, keep the old Render ones:**
   - Google Cloud (OAuth client): redirect URIs `https://www.socialaidigital.com/api/connections/youtube/callback` and `https://www.socialaidigital.com/api/auth/google/callback`.
   - Meta (Facebook app): `https://www.socialaidigital.com/api/connections/meta/callback`.
   - Meta (Instagram app): `https://www.socialaidigital.com/api/connections/instagram/callback`; webhook `https://www.socialaidigital.com/api/instagram/webhook`.
   - LinkedIn / TikTok (if used): `/api/connections/linkedin/callback`, `/api/connections/tiktok/callback`.
   - Razorpay webhook: `https://www.socialaidigital.com/api/checkout/razorpay/webhook`.
2. **Cloudflare DNS:** `www` and `@` → A → `3.24.15.132` → Proxied (replace the Render CNAMEs). Takes effect within a minute.
3. **Background monitor:** on AWS set `CRISIS_MONITOR_ENABLED=true` and run `pm2 restart socialaidigital-api --update-env`; on Render set it to `false`.
4. **Verify:** `curl -sI https://www.socialaidigital.com` (server: nginx), login, Connect YouTube + Sync, `pm2 logs socialaidigital-api --lines 50 --nostream`.

**Rollback:** point `www` and `@` back to the Render CNAMEs and swap the `CRISIS_MONITOR_ENABLED` values back.

## 7. After cutover (24–48 h)

- In the repo, change `client/public/runtime-config.js` so only `*.onrender.com` hosts use the Render API, and update `render.yaml` / docs.
- Delete the `new` DNS record.
- Remove the `socialiq-37aa.onrender.com` redirect URIs from Google and Meta; remove `socialiq-37aa.onrender.com` from Google Auth Platform → Branding → Authorized domains.
- Render: disable auto-deploy, delete both services after a quiet week.
- Try `EMAIL_OTP_ENABLED=true` once a test email sends from this server (SMTP port 587).

## Day-to-day

- Every push to `main` deploys (build in GitHub Actions → rsync → `npm ci` → `pm2 startOrReload`).
- Logs: `pm2 logs socialaidigital-api`. Restart: `pm2 restart socialaidigital-api --update-env` after editing `.env`.
- Never run `pm2 delete all`, `pm2 restart all` or edit the healthcare nginx files from this project.

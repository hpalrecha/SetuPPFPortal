# Deploying VAS (pulsevas.p91india.com)

The build and container steps below are **manual and must be run on the EC2 host**.
Nothing in this repository deploys itself: there is no CI, no GitHub Actions workflow,
and no auto-deploy. Pushing to `main` publishes code and changes nothing in production.

> The host runs **8+ other P91 applications as sibling containers** (`p91elite`,
> `justsignsvas`, `khartarportal`, `carcarebooker`, …). Never run `docker compose`,
> `docker system prune`, `docker stop $(docker ps -q)` or any project-wide command
> there. Every step below names exactly one container.

| | |
|---|---|
| Host | `ubuntu@ip-172-26-6-244` |
| Source on host | `/home/ubuntu/p91/setuppfportal/repo` (tracks `main`) |
| Container | `setuppfportal`, `127.0.0.1:8090->5000/tcp`, restart `unless-stopped` |
| Env file | `/home/ubuntu/p91/setuppfportal/env.list` |
| Front door | nginx (:80/:443) reverse proxy; TLS terminates at an AWS LB |

**The Dockerfile is not in git.** It exists only on the host, untracked. That is a
standing risk: nothing in GitHub records how this app is built.

---

## 1. Before deploying — confirm the signing key will not move

A container replacement that changes `JWT_SECRET` silently invalidates **every**
logged-in user's token at once. At the client that is indistinguishable from ordinary
expiry, which is why it is worth ruling out explicitly.

```bash
# Does the running container get JWT_SECRET from the env file (not a generated value)?
grep -c '^JWT_SECRET=' /home/ubuntu/p91/setuppfportal/env.list     # expect: 1
docker inspect setuppfportal --format '{{range .Config.Env}}{{println .}}{{end}}' \
  | grep -c '^JWT_SECRET='                                         # expect: 1
```

Both must print `1`. **Do not print the value itself.**

If `env.list` has no `JWT_SECRET` line but the container does, the secret exists only
inside the running container and **will be lost on the next replacement** — copy it into
`env.list` before going further, or every user gets logged out on redeploy.

The application now logs a fingerprint of the key at startup (never the key):

```
[auth] JWT signing key fingerprint=a1b2c3d4 source=JWT_SECRET env var expiresIn=7d
```

Record it before and after any redeploy. **If the fingerprint changes, every existing
session was invalidated.** If `source=` reads `built-in development fallback`, the
container is not running with `NODE_ENV=production` and is signing tokens with a
publicly known key — fix that before anything else.

## 2. Make the build reproducible (one-line Dockerfile change)

The Dockerfile currently contains:

```dockerfile
RUN rm -f package-lock.json && npm install
```

This deletes the committed lockfile and re-resolves every dependency at build time.
It is the mechanism behind the ~7-week installer photo-upload outage: an
`@aws-sdk` minor bumped itself during an unrelated rebuild and changed presigned-URL
checksum behaviour, with no code change on our side. Replace it with:

```dockerfile
RUN npm ci
```

`npm ci` installs exactly what `package-lock.json` records and fails loudly if the
lockfile and `package.json` disagree. Verified in this repo: `npm ci` succeeds and
resolves the pinned AWS SDK versions.

As defence in depth — and so this is safe *even if the Dockerfile is never changed* —
the three AWS SDK packages are now pinned to exact versions in `package.json`, so a
bare `npm install` also resolves them deterministically. `tests/dependency-determinism.test.ts`
fails if anyone reintroduces a range.

## 3. Deploy

```bash
cd /home/ubuntu/p91/setuppfportal/repo
git fetch origin && git status          # expect a clean tree on main
git pull --ff-only origin main

TAG=$(date +%Y%m%d-%H%M)
docker build -t setuppfportal:$TAG .    # NOT `docker compose build`

# Capture the live container's exact runtime config before touching it.
docker inspect setuppfportal --format '{{json .HostConfig.PortBindings}}'
docker inspect setuppfportal --format '{{json .HostConfig.RestartPolicy}}'

# Rename rather than delete — this is the rollback.
docker rename setuppfportal setuppfportal_prev_$TAG
docker stop setuppfportal_prev_$TAG

docker run -d \
  --name setuppfportal \
  --env-file /home/ubuntu/p91/setuppfportal/env.list \
  -p 127.0.0.1:8090:5000 \
  --restart unless-stopped \
  setuppfportal:$TAG
```

Using `--env-file env.list` preserves the database connection, S3 configuration,
`PULSE_WEBHOOK_SECRET` and `JWT_SECRET` unchanged. Nothing above touches another
container, the shared network, or any volume.

## 4. Verify before walking away

```bash
docker logs setuppfportal 2>&1 | grep '\[auth\] JWT'   # fingerprint MUST match step 1
# VAS has no health endpoint; the SPA index is the liveness check.
curl -s -o /dev/null -w '%{http_code}\n' localhost:8090/                  # 200
curl -s -X POST localhost:8090/api/objects/upload-file                    # {"error":"Authentication required"}
curl -s -X POST localhost:8090/api/objects/upload-file \
  -H 'Authorization: Bearer bogus'                                        # {"error":"Invalid token"}
curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:8090/api/auth/refresh  # 401 without a token
```

Then, in a browser as a real installer — this is the step that has never actually been
observed end to end, and the only one that proves the pipeline works:

1. Log in. Confirm no immediate bounce back to `/login`.
2. Open a job card and **upload a pre-installation photo and a batch-number photo.**
3. Confirm an existing stored photo still displays.

## 5. Rollback

The previous container was renamed, not deleted:

```bash
docker stop setuppfportal && docker rm setuppfportal
docker rename setuppfportal_prev_<TAG> setuppfportal
docker start setuppfportal
docker logs --tail 50 setuppfportal
```

Keep `setuppfportal_prev_<TAG>` until an installer has confirmed a real photo upload.
Only then remove it, **by name**:

```bash
docker rm setuppfportal_prev_<TAG>
```

## 6. Known standing risks

- The Dockerfile is untracked and exists on one host only. Losing that box loses the
  build definition. Committing it here would be a genuine improvement.
- Base image is `node:20-slim`; the AWS SDK warns it will require Node >= 22 after
  January 2027, so a rebuild after that date can produce a broken image.
- Logout is client-side only. These JWTs have never been revocable server-side — a
  stolen token stays valid until it expires. `/api/auth/refresh` does not change that
  (it requires an already-valid token), but it does mean a stolen token can be kept
  alive. Server-side revocation is the fix if that ever matters.

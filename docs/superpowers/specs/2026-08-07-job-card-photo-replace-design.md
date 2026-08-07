# Job Card Photo Replace — Design

**Date:** 2026-08-07
**Status:** Approved by user, pending implementation plan

## Problem

Job card photos (pre-installation inspection photos, post-installation gallery
photos, and rework photos) are currently upload-once: they're set during the
normal workflow (start, completion, rework request) and after that are
view-only forever. There is no way for anyone — including admins — to fix a
bad photo (wrong angle, blurry, wrong file) without going through support or
direct DB edits. This spec adds a controlled "replace" capability.

## Scope

**In scope:**
- Replacing (overwriting) an existing photo with a newly uploaded file, for:
  - Pre-installation photos (4 fixed angle columns: front/back/left/right)
  - Post-installation gallery photos (`job_card_media` rows, `type = IMAGE` only)
  - Rework photos (entries in the `photos` array inside `reworkDetailsJson`)
- Access for four roles: `SUPER_ADMIN`, `ADMIN`, `PARTNER_ADMIN`, `DETAILING_PARTNER`.

**Out of scope (explicitly not building):**
- Deleting a photo outright (no replacement).
- Adding new photos to the post-install gallery beyond what the workflow already adds.
- Replacing video items in `job_card_media` (`type = VIDEO`).
- Locking edits based on job card status (CLOSED, warranty issued, etc.) — replacement is always allowed regardless of status, per explicit decision.
- Deleting the old S3 object when replaced (old object is left orphaned in S3; cheap and gives an extra recovery path beyond the audit log).

## Current state (reference)

Photos are stored in three different shapes, all ultimately pointing at S3
objects under a flat key `setuppf-uploads/<uuid>.ext`
(`server/objectStorage.ts:42-44`), normalized to `/objects/uploads/<uuid>.ext`
before being persisted:

| Photo set | Storage shape | Location |
|---|---|---|
| Pre-installation | 4 fixed `text` URL columns on `job_cards` | `shared/schema.ts:568-575` |
| Post-installation gallery | Separate `job_card_media` table, one row per item (`type`, `url`, `caption`) | `shared/schema.ts:616-623` |
| Rework photos | `photos: string[]` inside JSONB column `reworkDetailsJson` | `shared/schema.ts:604` |

No edit/delete/replace capability exists today for any of these — confirmed
across `server/storage.ts`, `server/routes.ts`, and the read-only viewer
components (`ViewPreInstallationModal.tsx`, `image-modal.tsx`).

Existing patterns this design reuses:
- **Upload mechanism:** `ObjectUploader` (`client/src/components/ObjectUploader.tsx`) wraps Uppy + `@uppy/aws-s3`, driven by a presigned PUT URL from `POST /api/objects/upload` (`server/routes.ts:8674`). Already used for pre-installation uploads (`PreInstallationModal.tsx`).
- **Safe-edit pattern:** `PATCH /api/job-cards/:id/details` (`server/routes.ts:5109-5179`) — role-gated, field-whitelisted. New endpoints mirror this shape.
- **Role middleware:** `requireRole([...])` in `server/middleware.ts:51`.
- **Partner ownership check:** inline pattern at `server/routes.ts:8822-8830`, built on `userPartnerIds(user)` (`server/middleware.ts:19`).
- **Audit logging:** `auditLog(entity, action)` middleware (`server/middleware.ts:181`).

## Design

### Permissions

- `SUPER_ADMIN` / `ADMIN`: may replace photos on any job card.
- `PARTNER_ADMIN` / `DETAILING_PARTNER`: may replace photos only on job cards
  belonging to their own partner (same ownership rule as
  `server/routes.ts:8822-8830`). Attempting to replace a photo on another
  partner's job card returns `403`.
- All other roles: `403`.

### Backend — three new endpoints

One endpoint per storage shape, since the three shapes address a photo
differently (fixed column / row id / array index). Each endpoint:

1. `authenticate` → `requireRole([SUPER_ADMIN, ADMIN, PARTNER_ADMIN, DETAILING_PARTNER])`.
2. Load the job card; `404` if it doesn't exist.
3. If the caller is `PARTNER_ADMIN`/`DETAILING_PARTNER`, verify the job card's partner is in `userPartnerIds(user)`; `403` otherwise.
4. Validate the request body contains a `url` pointing at a normalized `/objects/...` path (reject raw/foreign URLs); `400` otherwise.
5. Locate the specific photo to replace; `404` if the angle/media id/array index doesn't exist.
6. Update the DB (single column write / `job_card_media` row update / JSON array element replace).
7. Write an audit log entry: `{ jobCardId, photoType, identifier, oldUrl, newUrl, userId }`.
8. Return the updated job card (or media row).

| Endpoint | Identifier | DB change | New storage.ts method needed? |
|---|---|---|---|
| `PATCH /api/job-cards/:id/pre-installation/:angle` | `angle` ∈ `front\|back\|left\|right` | Update the matching `pre_installation_photo_*` column | No — extend existing update path |
| `PATCH /api/job-cards/:id/media/:mediaId` | `mediaId` | Update `url` on the `job_card_media` row (must be `type = IMAGE`; `400` if `VIDEO`) | Yes — `updateJobCardMedia(mediaId, url)` (none exists today) |
| `PATCH /api/job-cards/:id/rework/:photoIndex` | array index into `reworkDetailsJson.photos` | Replace that array element, write back the JSONB column | No — read-modify-write on the JSON column |

The old S3 object is **not** deleted — the endpoint only ever writes the new
URL over the old one in the DB.

### Frontend

- A small pencil/edit icon overlays each eligible photo thumbnail in:
  - `client/src/pages/JobCardsNew.tsx` pre-install section (`:3112-3167`) and post-install section (`:3172-3206`)
  - `ViewPreInstallationModal.tsx`
  - The combined `ImageModal` lightbox (`:3450-3470`)
  - The rework photos display (`:2617-2620`)
- The icon renders only when the logged-in user is permitted: always for `SUPER_ADMIN`/`ADMIN`; for `PARTNER_ADMIN`/`DETAILING_PARTNER`, only when the job card belongs to their partner. Video items in the post-install gallery never get the icon.
- Clicking the icon opens `ObjectUploader` configured for 1 file, image types only (`.jpg`, `.jpeg`, `.png`).
- On upload completion, the frontend calls the matching `PATCH` endpoint with the new object path, then invalidates/refetches the job card query so the thumbnail updates immediately.
- Failure (403/404/400) shows a toast; the old photo is left untouched (DB is only updated after the endpoint succeeds).

### Data flow (single replace)

1. Permitted user clicks the pencil icon on a photo.
2. Frontend calls `POST /api/objects/upload` → presigned PUT URL.
3. Uppy uploads the new file directly to S3.
4. On complete, frontend calls the relevant `PATCH .../<type>/<identifier>` with the raw upload URL.
5. Backend normalizes the URL, re-checks role + ownership, updates the DB, writes the audit log entry, responds with the updated record.
6. Frontend refetches; new thumbnail displays.

### Error handling

- `403` — role not permitted, or partner role does not own the job card.
- `404` — job card not found, or the specific angle/media id/rework index doesn't exist.
- `400` — uploaded URL isn't a valid `/objects/...` path, or target media row is `type = VIDEO`.

### Testing

- Backend integration tests per endpoint: allowed roles succeed, disallowed roles get `403`, `PARTNER_ADMIN`/`DETAILING_PARTNER` succeed on their own job card and get `403` on another partner's, audit log row is written with correct old/new URLs, `404`s for bad identifiers, `400` for a `VIDEO` media row.
- Manual verification in the running app: replace a photo as one role from each permission tier (e.g. `ADMIN` and `DETAILING_PARTNER`) and confirm the new photo displays immediately and the old S3 object is untouched (not deleted).

## Addendum (2026-08-07, during plan-writing)

The UI-placement list above named 4 locations for the pencil icon. During
implementation planning, `ImageModal` was confirmed to be a generic shared
lightbox (used with a plain `images`/`initialIndex`/`isOpen`/`onClose` prop
interface, no job-card-specific knowledge) and `ViewPreInstallationModal` a
separate read-only viewer with its own internal lightbox state. Duplicating
the replace affordance into both would mean widening a shared component's
public interface and re-implementing the replace mutation a second time,
for photos that are already reachable and editable from the main grid.
Decision: the pencil icon ships only on the two main grids
(`JobCardsNew.tsx` pre-install and post-install sections) and the rework
photos list — not inside `ViewPreInstallationModal` or the `ImageModal`
lightbox. Every photo remains editable; there's just one entry point
instead of three.

## Open questions / notes for the implementation plan

- Confirm exact field name(s) for job card → partner linkage used by `userPartnerIds` ownership checks, to reuse verbatim rather than re-deriving.
- Decide the exact audit log `entity`/`action` string pair (e.g. `job_card_photo` / `replace`) consistent with existing `auditLog()` call-site conventions.

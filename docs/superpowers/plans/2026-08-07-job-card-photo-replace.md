# Job Card Photo Replace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let `SUPER_ADMIN`, `ADMIN`, `PARTNER_ADMIN`, and `DETAILING_PARTNER` replace an existing job-card photo (pre-installation angle, post-installation gallery image, or rework photo) with a newly uploaded file, in place.

**Architecture:** Three new JSON `PATCH` endpoints (one per storage shape: fixed column / `job_card_media` row / JSON array element) mirror the existing `PATCH /api/job-cards/:id/details` "safe edit" pattern — role-gated, ownership-checked, audit-logged. The frontend reuses the already-live `POST /api/objects/upload-file` server-proxied upload (no new upload infra) behind a small pencil-icon overlay on each eligible thumbnail in `JobCardsNew.tsx`.

**Tech Stack:** Express + Drizzle ORM (backend, `server/`), React + TanStack Query (frontend, `client/src/`), AWS S3 via `server/objectStorage.ts`.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-07-job-card-photo-replace-design.md` — every requirement in that file must be covered by a task below.
- No delete, no adding extra gallery photos, no status-based lockout — replace only, always allowed regardless of job card status.
- `PARTNER_ADMIN`/`DETAILING_PARTNER` may only replace photos on job cards where `job_cards.partnerId` is in their own scope (`userPartnerIds(req.user)` from `server/middleware.ts:19`); `SUPER_ADMIN`/`ADMIN` have no such restriction.
- Video items in `job_card_media` (`type = 'VIDEO'`) are never replaceable through this feature.
- The old S3 object is never deleted — only the DB pointer changes.
- **This repository has no automated test framework** (no test script in `package.json`, no test files outside `node_modules`). Every task below is verified manually: backend tasks via a PowerShell `Invoke-RestMethod` call against the running dev server, frontend tasks via the browser. This matches existing project practice — do not introduce a new test framework as part of this plan.
- Match existing code style exactly: routes.ts handlers use `const updates: any = {...}` for partial DB updates (see `server/routes.ts:5131`), not typed schema objects — follow this rather than importing `InsertJobCard`.
- Follow the existing local-subcomponent pattern already used in this codebase (e.g. `PhotoUploadBox` inside `PreInstallationModal.tsx:220`) rather than extracting a new shared file, since `JobCardsNew.tsx` already defines page-local subcomponents.

---

### Task 1: Backend — Replace a pre-installation angle photo

**Files:**
- Modify: `server/routes.ts` (insert after the `PATCH /api/job-cards/:id/details` block, which ends at `server/routes.ts:5179`, before the `// Job Card Actions` comment at `server/routes.ts:5181`)

**Interfaces:**
- Consumes: `storage.getJobCard(id): Promise<JobCard | undefined>` (`server/storage.ts:1965`), `storage.updateJobCard(id, updates): Promise<JobCard | undefined>` (`server/storage.ts:1978`), `userPartnerIds(user): string[]` (`server/middleware.ts:19`), `ObjectStorageService.trySetObjectEntityAclPolicy(rawPath, aclPolicy): Promise<string>` (`server/objectStorage.ts:114`, throws `ObjectNotFoundError` if the object doesn't exist in S3), `requireRole`, `auditLog`, `authenticate` (all from `./middleware`, already imported at `server/routes.ts:29`).
- Produces: `PATCH /api/job-cards/:id/pre-installation/:angle` — body `{ url: string }`, returns the updated job card JSON. Consumed by Task 4 (frontend).

- [ ] **Step 1: Add the endpoint**

Insert this block into `server/routes.ts` immediately before line 5181 (`  // Job Card Actions`):

```ts
  // Replace a single pre-installation angle photo after the fact. These photos
  // have no delete/undo — replacing the file in place is the only correction path.
  const PRE_INSTALLATION_ANGLE_FIELDS: Record<string, string> = {
    front: 'preInstallationPhotoFront',
    back: 'preInstallationPhotoBack',
    left: 'preInstallationPhotoLeft',
    right: 'preInstallationPhotoRight',
  };

  app.patch("/api/job-cards/:id/pre-installation/:angle",
    authenticate,
    requireRole(['SUPER_ADMIN', 'ADMIN', 'PARTNER_ADMIN', 'DETAILING_PARTNER']),
    auditLog('job_card_photo', 'replace_pre_installation'),
    async (req, res) => {
      try {
        const angleField = PRE_INSTALLATION_ANGLE_FIELDS[req.params.angle];
        if (!angleField) {
          return res.status(400).json({ error: "Angle must be one of: front, back, left, right" });
        }

        const { url } = req.body;
        if (!url || typeof url !== 'string') {
          return res.status(400).json({ error: "url is required" });
        }

        const jobCard = await storage.getJobCard(req.params.id);
        if (!jobCard) {
          return res.status(404).json({ error: "Job card not found" });
        }

        if (['PARTNER_ADMIN', 'DETAILING_PARTNER'].includes(req.user!.role)) {
          if (!userPartnerIds(req.user!).includes(jobCard.partnerId)) {
            return res.status(403).json({ error: "Access denied - job card belongs to a different partner" });
          }
        }

        const objectStorageService = new ObjectStorageService();
        let normalizedUrl: string;
        try {
          normalizedUrl = await objectStorageService.trySetObjectEntityAclPolicy(
            url,
            { visibility: "public", owner: req.user!.id }
          );
        } catch (e) {
          if (e instanceof ObjectNotFoundError) {
            return res.status(400).json({ error: "Uploaded photo could not be found in storage" });
          }
          throw e;
        }

        const updates: any = { [angleField]: normalizedUrl };
        const updatedJobCard = await storage.updateJobCard(req.params.id, updates);
        if (!updatedJobCard) {
          return res.status(404).json({ error: "Job card not found" });
        }

        res.json(updatedJobCard);
      } catch (error) {
        console.error("Replace pre-installation photo error:", error);
        res.status(500).json({ error: "Failed to replace pre-installation photo" });
      }
    }
  );
```

- [ ] **Step 2: Start the dev server**

Run: `npm run dev` (from `D:\p91\p91\p91web\setuppfportal`, per this repo's existing dev script)
Expected: server listening on port 5000 with no startup errors.

- [ ] **Step 3: Manually verify with a real SUPER_ADMIN or ADMIN account**

```powershell
$token = (Invoke-RestMethod -Method Post -Uri http://localhost:5000/api/auth/login -ContentType "application/json" -Body '{"email":"<real-super-admin-email>","password":"<real-password>"}').token
$jobCardId = "<a real job card id that already has pre-installation photos completed>"
Invoke-RestMethod -Method Patch -Uri "http://localhost:5000/api/job-cards/$jobCardId/pre-installation/front" -Headers @{ Authorization = "Bearer $token" } -ContentType "application/json" -Body '{"url":"/objects/uploads/does-not-exist.jpg"}'
```

Expected: HTTP 400 with `{"error":"Uploaded photo could not be found in storage"}` (proves the object-existence check runs — a nonexistent object is correctly rejected without touching the DB).

Then repeat with a `url` value copied from an object that really exists in the bucket (e.g. the `preInstallationPhotoFront` value already on that job card, fetched via `GET /api/job-cards/$jobCardId`):

```powershell
$jobCard = Invoke-RestMethod -Method Get -Uri "http://localhost:5000/api/job-cards/$jobCardId" -Headers @{ Authorization = "Bearer $token" }
$existingUrl = $jobCard.preInstallationPhotoFront
Invoke-RestMethod -Method Patch -Uri "http://localhost:5000/api/job-cards/$jobCardId/pre-installation/front" -Headers @{ Authorization = "Bearer $token" } -ContentType "application/json" -Body (@{ url = $existingUrl } | ConvertTo-Json)
```

Expected: HTTP 200, response body's `preInstallationPhotoFront` field is present and non-null.

- [ ] **Step 4: Verify role rejection**

Log in as a role NOT in the permitted list (e.g. `SHOWROOM_MANAGER`) and repeat the request. Expected: HTTP 403 `{"error":"Insufficient permissions"}`.

- [ ] **Step 5: Commit**

```bash
git add server/routes.ts
git commit -m "Add PATCH endpoint to replace a pre-installation angle photo"
```

---

### Task 2: Backend — Replace a post-installation gallery photo

**Files:**
- Modify: `server/storage.ts` — add two methods to the `IStorage` interface (after `server/storage.ts:241`) and their implementations (after `server/storage.ts:2007`)
- Modify: `server/routes.ts` — add the endpoint (insert directly after Task 1's endpoint, i.e. still before the `// Job Card Actions` comment)

**Interfaces:**
- Consumes: same as Task 1, plus the new storage methods this task adds.
- Produces:
  - `storage.getJobCardMediaById(id: string): Promise<any | undefined>`
  - `storage.updateJobCardMedia(id: string, updates: { url: string }): Promise<any | undefined>`
  - `PATCH /api/job-cards/:id/media/:mediaId` — body `{ url: string }`, returns the updated media row JSON. Consumed by Task 5 (frontend).

- [ ] **Step 1: Add the two storage interface declarations**

In `server/storage.ts`, immediately after line 241 (`  getJobCardMedia(filters: { jobCardId: string }): Promise<any[]>;`):

```ts
  getJobCardMediaById(id: string): Promise<any | undefined>;
  updateJobCardMedia(id: string, updates: { url: string }): Promise<any | undefined>;
```

- [ ] **Step 2: Add the two storage implementations**

In `server/storage.ts`, immediately after line 2007 (the closing `}` of `getJobCardMedia`), before the `// ====================== Approval Management ======================` comment:

```ts
  async getJobCardMediaById(id: string): Promise<any | undefined> {
    const [media] = await db
      .select()
      .from(jobCardMedia)
      .where(eq(jobCardMedia.id, id));
    return media || undefined;
  }

  async updateJobCardMedia(id: string, updates: { url: string }): Promise<any | undefined> {
    const [media] = await db
      .update(jobCardMedia)
      .set({ url: updates.url })
      .where(eq(jobCardMedia.id, id))
      .returning();
    return media || undefined;
  }
```

- [ ] **Step 3: Add the endpoint**

Insert into `server/routes.ts` directly after Task 1's endpoint:

```ts
  app.patch("/api/job-cards/:id/media/:mediaId",
    authenticate,
    requireRole(['SUPER_ADMIN', 'ADMIN', 'PARTNER_ADMIN', 'DETAILING_PARTNER']),
    auditLog('job_card_media', 'replace'),
    async (req, res) => {
      try {
        const { url } = req.body;
        if (!url || typeof url !== 'string') {
          return res.status(400).json({ error: "url is required" });
        }

        const jobCard = await storage.getJobCard(req.params.id);
        if (!jobCard) {
          return res.status(404).json({ error: "Job card not found" });
        }

        if (['PARTNER_ADMIN', 'DETAILING_PARTNER'].includes(req.user!.role)) {
          if (!userPartnerIds(req.user!).includes(jobCard.partnerId)) {
            return res.status(403).json({ error: "Access denied - job card belongs to a different partner" });
          }
        }

        const media = await storage.getJobCardMediaById(req.params.mediaId);
        if (!media || media.jobCardId !== req.params.id) {
          return res.status(404).json({ error: "Media not found on this job card" });
        }

        if (media.type === 'VIDEO') {
          return res.status(400).json({ error: "Video items cannot be replaced through this endpoint" });
        }

        const objectStorageService = new ObjectStorageService();
        let normalizedUrl: string;
        try {
          normalizedUrl = await objectStorageService.trySetObjectEntityAclPolicy(
            url,
            { visibility: "public", owner: req.user!.id }
          );
        } catch (e) {
          if (e instanceof ObjectNotFoundError) {
            return res.status(400).json({ error: "Uploaded photo could not be found in storage" });
          }
          throw e;
        }

        const updatedMedia = await storage.updateJobCardMedia(req.params.mediaId, { url: normalizedUrl });
        if (!updatedMedia) {
          return res.status(404).json({ error: "Media not found" });
        }

        res.json(updatedMedia);
      } catch (error) {
        console.error("Replace job card media error:", error);
        res.status(500).json({ error: "Failed to replace media" });
      }
    }
  );
```

- [ ] **Step 4: Restart the dev server and verify**

Run: `npm run dev`
Expected: no TypeScript/startup errors (confirms the new storage methods type-check against the `IStorage` interface).

```powershell
$jobCard = Invoke-RestMethod -Method Get -Uri "http://localhost:5000/api/job-cards/$jobCardId" -Headers @{ Authorization = "Bearer $token" }
$mediaId = $jobCard.media[0].id
$existingUrl = $jobCard.media[0].url
Invoke-RestMethod -Method Patch -Uri "http://localhost:5000/api/job-cards/$jobCardId/media/$mediaId" -Headers @{ Authorization = "Bearer $token" } -ContentType "application/json" -Body (@{ url = $existingUrl } | ConvertTo-Json)
```

Expected: HTTP 200, response is the media row with matching `id` and non-null `url`.

- [ ] **Step 5: Verify VIDEO rejection (only if a VIDEO row exists in test data)**

If any `job_card_media` row has `type = 'VIDEO'`, repeat the PATCH against its id. Expected: HTTP 400 `{"error":"Video items cannot be replaced through this endpoint"}`. If no VIDEO row exists in current data, skip this check — it's exercised in Task 6's UI verification instead (the pencil icon simply won't render for VIDEO items).

- [ ] **Step 6: Commit**

```bash
git add server/storage.ts server/routes.ts
git commit -m "Add PATCH endpoint to replace a post-installation gallery photo"
```

---

### Task 3: Backend — Replace a rework photo

**Files:**
- Modify: `server/routes.ts` (insert directly after Task 2's endpoint)

**Interfaces:**
- Consumes: same helpers as Task 1/2.
- Produces: `PATCH /api/job-cards/:id/rework/:photoIndex` — body `{ url: string }`, returns the updated job card JSON. Consumed by Task 6 (frontend).

- [ ] **Step 1: Add the endpoint**

```ts
  app.patch("/api/job-cards/:id/rework/:photoIndex",
    authenticate,
    requireRole(['SUPER_ADMIN', 'ADMIN', 'PARTNER_ADMIN', 'DETAILING_PARTNER']),
    auditLog('job_card_rework_photo', 'replace'),
    async (req, res) => {
      try {
        const photoIndex = Number(req.params.photoIndex);
        if (!Number.isInteger(photoIndex) || photoIndex < 0) {
          return res.status(400).json({ error: "photoIndex must be a non-negative integer" });
        }

        const { url } = req.body;
        if (!url || typeof url !== 'string') {
          return res.status(400).json({ error: "url is required" });
        }

        const jobCard = await storage.getJobCard(req.params.id);
        if (!jobCard) {
          return res.status(404).json({ error: "Job card not found" });
        }

        if (['PARTNER_ADMIN', 'DETAILING_PARTNER'].includes(req.user!.role)) {
          if (!userPartnerIds(req.user!).includes(jobCard.partnerId)) {
            return res.status(403).json({ error: "Access denied - job card belongs to a different partner" });
          }
        }

        const reworkDetails: any = jobCard.reworkDetailsJson || {};
        const photos: string[] = Array.isArray(reworkDetails.photos) ? reworkDetails.photos : [];
        if (photoIndex >= photos.length) {
          return res.status(404).json({ error: "Rework photo not found at that index" });
        }

        const objectStorageService = new ObjectStorageService();
        let normalizedUrl: string;
        try {
          normalizedUrl = await objectStorageService.trySetObjectEntityAclPolicy(
            url,
            { visibility: "public", owner: req.user!.id }
          );
        } catch (e) {
          if (e instanceof ObjectNotFoundError) {
            return res.status(400).json({ error: "Uploaded photo could not be found in storage" });
          }
          throw e;
        }

        const updatedPhotos = [...photos];
        updatedPhotos[photoIndex] = normalizedUrl;

        const updates: any = { reworkDetailsJson: { ...reworkDetails, photos: updatedPhotos } };
        const updatedJobCard = await storage.updateJobCard(req.params.id, updates);
        if (!updatedJobCard) {
          return res.status(404).json({ error: "Job card not found" });
        }

        res.json(updatedJobCard);
      } catch (error) {
        console.error("Replace rework photo error:", error);
        res.status(500).json({ error: "Failed to replace rework photo" });
      }
    }
  );
```

- [ ] **Step 2: Restart the dev server and verify**

Find a job card with `reworkDetailsJson.photos` non-empty (one that has gone through a rework request — check via `GET /api/job-cards/:id` and inspect `reworkDetailsJson`), then:

```powershell
$reworkJobCardId = "<job card id with reworkDetailsJson.photos non-empty>"
$rjc = Invoke-RestMethod -Method Get -Uri "http://localhost:5000/api/job-cards/$reworkJobCardId" -Headers @{ Authorization = "Bearer $token" }
$existingReworkUrl = $rjc.reworkDetailsJson.photos[0]
Invoke-RestMethod -Method Patch -Uri "http://localhost:5000/api/job-cards/$reworkJobCardId/rework/0" -Headers @{ Authorization = "Bearer $token" } -ContentType "application/json" -Body (@{ url = $existingReworkUrl } | ConvertTo-Json)
```

Expected: HTTP 200, response's `reworkDetailsJson.photos[0]` is non-null.

Then verify the out-of-range case:

```powershell
Invoke-RestMethod -Method Patch -Uri "http://localhost:5000/api/job-cards/$reworkJobCardId/rework/99" -Headers @{ Authorization = "Bearer $token" } -ContentType "application/json" -Body (@{ url = $existingReworkUrl } | ConvertTo-Json)
```

Expected: HTTP 404 `{"error":"Rework photo not found at that index"}`.

- [ ] **Step 3: Commit**

```bash
git add server/routes.ts
git commit -m "Add PATCH endpoint to replace a rework photo"
```

---

### Task 4: Frontend — Shared replace mutation + pencil icon on pre-installation photos

**Files:**
- Modify: `client/src/pages/JobCardsNew.tsx`

**Interfaces:**
- Consumes: `PATCH /api/job-cards/:id/pre-installation/:angle` (Task 1), `POST /api/objects/upload-file` (existing, `server/routes.ts:8691`), `apiRequest` (`@/lib/queryClient`, already imported), `useAuth()` → `user.role`, `user.partnerId` (already imported/used in this file), `detailedJobCard` (existing query at `client/src/pages/JobCardsNew.tsx:600`).
- Produces: `canEditJobCardPhotos: boolean`, `replacePhotoMutation` (TanStack `useMutation`), `handlePhotoReplaceSelect(patchPath: string, key: string): (event) => void`, `<PhotoReplaceButton patchPath={string} photoKey={string} />` — all consumed by Task 5 and Task 6.

- [ ] **Step 1: Add the shared helpers**

In `client/src/pages/JobCardsNew.tsx`, insert immediately after line 1389 (`  const isAdmin = ...`):

```tsx
  // Photo replace: SUPER_ADMIN/ADMIN can replace on any job card; PARTNER_ADMIN/
  // DETAILING_PARTNER only on their own partner's job card. The server re-checks
  // this independently (userPartnerIds) — this flag only controls whether the
  // pencil icon renders.
  const canEditJobCardPhotos = !!detailedJobCard && !!user && (
    user.role === 'SUPER_ADMIN' ||
    user.role === 'ADMIN' ||
    ((user.role === 'PARTNER_ADMIN' || user.role === 'DETAILING_PARTNER') && detailedJobCard.partnerId === user.partnerId)
  );

  const [replacingPhotoKey, setReplacingPhotoKey] = useState<string | null>(null);

  const replacePhotoMutation = useMutation({
    mutationFn: async ({ file, patchPath }: { file: File; patchPath: string }) => {
      const formData = new FormData();
      formData.append('file', file);
      const uploadResponse = await apiRequest('POST', '/api/objects/upload-file', formData);
      const { url } = await uploadResponse.json();
      if (!url) throw new Error('Upload did not return a URL');
      const patchResponse = await apiRequest('PATCH', patchPath, { url });
      return patchResponse.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/job-cards', selectedJobCardId] });
      queryClient.invalidateQueries({ queryKey: ['/api/job-cards'] });
      toast({ title: "Photo Replaced", description: "The photo was updated successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Replace Failed", description: error.message || "Failed to replace photo. Please try again.", variant: "destructive" });
    },
    onSettled: () => {
      setReplacingPhotoKey(null);
    }
  });

  const handlePhotoReplaceSelect = (patchPath: string, key: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setReplacingPhotoKey(key);
    replacePhotoMutation.mutate({ file, patchPath });
  };

  const PhotoReplaceButton = ({ patchPath, photoKey }: { patchPath: string; photoKey: string }) => (
    <>
      <input
        type="file"
        accept="image/*"
        className="hidden"
        id={`replace-input-${photoKey}`}
        onChange={handlePhotoReplaceSelect(patchPath, photoKey)}
        data-testid={`input-replace-${photoKey}`}
      />
      <button
        type="button"
        className="absolute top-1 right-1 bg-black/70 hover:bg-black/90 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          document.getElementById(`replace-input-${photoKey}`)?.click();
        }}
        disabled={replacePhotoMutation.isPending && replacingPhotoKey === photoKey}
        data-testid={`button-replace-${photoKey}`}
      >
        {replacePhotoMutation.isPending && replacingPhotoKey === photoKey ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Pencil className="h-3.5 w-3.5" />
        )}
      </button>
    </>
  );
```

`Loader2` and `Pencil` are already imported in this file (`client/src/pages/JobCardsNew.tsx:23` and `:61`).

- [ ] **Step 2: Wire the pencil icon into the pre-installation photos grid**

In `client/src/pages/JobCardsNew.tsx`, replace the map body at lines 3138-3163:

```tsx
                        {detailedJobCard.preInstallationPhotos.map((mediaItem: any, index: number) => {
                          const imageUrl = mediaItem.url;
                          const imageName = mediaItem.caption || ['Front', 'Back', 'Left Side', 'Right Side'][index] || `Image ${index + 1}`;
                          return (
                            <div key={index} className="relative group">
                              <img
                                src={imageUrl}
                                alt={imageName}
                                className="w-full h-24 object-cover rounded-lg border cursor-pointer hover:opacity-75 transition-opacity"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setSelectedImageUrl(imageUrl);
                                  setSelectedImageIndex(index);
                                }}
                                data-testid={`thumbnail-preinstall-${imageName.toLowerCase().replace(/\s+/g, '-')}`}
                              />
                              <div className="absolute bottom-1 left-1 bg-black/70 text-white text-xs px-1 rounded">
                                {imageName}
                              </div>
                              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                <Eye className="h-6 w-6 text-white drop-shadow-lg" />
                              </div>
                            </div>
                          );
                        })}
```

with:

```tsx
                        {detailedJobCard.preInstallationPhotos.map((mediaItem: any, index: number) => {
                          const imageUrl = mediaItem.url;
                          const imageName = mediaItem.caption || ['Front', 'Back', 'Left Side', 'Right Side'][index] || `Image ${index + 1}`;
                          const angle = ['front', 'back', 'left', 'right'][index];
                          return (
                            <div key={index} className="relative group">
                              <img
                                src={imageUrl}
                                alt={imageName}
                                className="w-full h-24 object-cover rounded-lg border cursor-pointer hover:opacity-75 transition-opacity"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setSelectedImageUrl(imageUrl);
                                  setSelectedImageIndex(index);
                                }}
                                data-testid={`thumbnail-preinstall-${imageName.toLowerCase().replace(/\s+/g, '-')}`}
                              />
                              <div className="absolute bottom-1 left-1 bg-black/70 text-white text-xs px-1 rounded">
                                {imageName}
                              </div>
                              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                <Eye className="h-6 w-6 text-white drop-shadow-lg" />
                              </div>
                              {canEditJobCardPhotos && angle && (
                                <PhotoReplaceButton
                                  patchPath={`/api/job-cards/${detailedJobCard.id}/pre-installation/${angle}`}
                                  photoKey={`preinstall-${index}`}
                                />
                              )}
                            </div>
                          );
                        })}
```

- [ ] **Step 3: Manually verify in the browser**

Run: `npm run dev`, open `http://localhost:5000`, log in as a `SUPER_ADMIN` or `ADMIN`, open a job card that has completed pre-installation photos.
Expected: hovering a pre-installation thumbnail shows both the existing Eye icon (center) and a new pencil icon (top-right corner). Click the pencil, pick an image file — expected: a "Photo Replaced" toast appears and the thumbnail updates to the new image without a full page reload.

Then log in as a `PARTNER_ADMIN`/`DETAILING_PARTNER` whose partner does NOT own that job card (or simulate by checking a job card belonging to a different partner) — expected: no pencil icon renders on that job card's photos, only the Eye icon.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/JobCardsNew.tsx
git commit -m "Add photo replace UI for pre-installation photos"
```

---

### Task 5: Frontend — Pencil icon on post-installation gallery photos

**Files:**
- Modify: `client/src/pages/JobCardsNew.tsx`

**Interfaces:**
- Consumes: `canEditJobCardPhotos`, `PhotoReplaceButton` (both from Task 4), `PATCH /api/job-cards/:id/media/:mediaId` (Task 2).

- [ ] **Step 1: Wire the pencil icon into the post-installation photos grid**

Replace the map body at lines 3183-3208:

```tsx
                        {detailedJobCard.media.map((mediaItem: any, index: number) => {
                          const imageUrl = mediaItem.url;
                          const imageName = mediaItem.caption || `Image ${index + 1}`;
                          return (
                            <div key={index} className="relative group">
                              <img
                                src={imageUrl}
                                alt={imageName}
                                className="w-full h-24 object-cover rounded-lg border cursor-pointer hover:opacity-75 transition-opacity"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setSelectedImageUrl(imageUrl);
                                  setSelectedImageIndex(index);
                                }}
                                data-testid={`thumbnail-postinstall-${index}`}
                              />
                              <div className="absolute bottom-1 left-1 bg-black/70 text-white text-xs px-1 rounded">
                                {imageName}
                              </div>
                              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                <Eye className="h-6 w-6 text-white drop-shadow-lg" />
                              </div>
                            </div>
                          );
                        })}
```

with:

```tsx
                        {detailedJobCard.media.map((mediaItem: any, index: number) => {
                          const imageUrl = mediaItem.url;
                          const imageName = mediaItem.caption || `Image ${index + 1}`;
                          return (
                            <div key={index} className="relative group">
                              <img
                                src={imageUrl}
                                alt={imageName}
                                className="w-full h-24 object-cover rounded-lg border cursor-pointer hover:opacity-75 transition-opacity"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setSelectedImageUrl(imageUrl);
                                  setSelectedImageIndex(index);
                                }}
                                data-testid={`thumbnail-postinstall-${index}`}
                              />
                              <div className="absolute bottom-1 left-1 bg-black/70 text-white text-xs px-1 rounded">
                                {imageName}
                              </div>
                              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                <Eye className="h-6 w-6 text-white drop-shadow-lg" />
                              </div>
                              {canEditJobCardPhotos && mediaItem.type !== 'VIDEO' && (
                                <PhotoReplaceButton
                                  patchPath={`/api/job-cards/${detailedJobCard.id}/media/${mediaItem.id}`}
                                  photoKey={`media-${mediaItem.id}`}
                                />
                              )}
                            </div>
                          );
                        })}
```

- [ ] **Step 2: Manually verify in the browser**

Open a job card that has post-installation photos, as `SUPER_ADMIN`. Expected: pencil icon on hover; clicking it and picking a file replaces that specific gallery image and shows the success toast. If any media item has `type === 'VIDEO'`, confirm no pencil icon appears on it.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/JobCardsNew.tsx
git commit -m "Add photo replace UI for post-installation gallery photos"
```

---

### Task 6: Frontend — Pencil icon on rework photos

**Files:**
- Modify: `client/src/pages/JobCardsNew.tsx`

**Interfaces:**
- Consumes: `canEditJobCardPhotos`, `PhotoReplaceButton` (both from Task 4), `PATCH /api/job-cards/:id/rework/:photoIndex` (Task 3).

**Note:** This photo list only renders today when `isSuperAdmin && detailedJobCard.status === 'REWORK_PERMISSION_REQUESTED'` (`client/src/pages/JobCardsNew.tsx:2599`), and `isSuperAdmin` in this file means `SUPER_ADMIN || ADMIN` (`client/src/pages/JobCardsNew.tsx:1365`). `PARTNER_ADMIN`/`DETAILING_PARTNER` cannot see this block at all today, so in practice the pencil icon added here is only reachable by `SUPER_ADMIN`/`ADMIN` — this is a pre-existing visibility constraint of the rework-approval UI, not something this task changes.

- [ ] **Step 1: Wire the pencil icon into the rework photos list**

Replace lines 2617-2623:

```tsx
                      {detailedJobCard.reworkDetailsJson.photos?.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-1">
                          {detailedJobCard.reworkDetailsJson.photos.map((url: string, i: number) => (
                            <img key={i} src={url} alt={`rework ${i + 1}`} className="h-16 w-16 object-cover rounded border cursor-pointer" onClick={() => window.open(url, '_blank')} />
                          ))}
                        </div>
                      )}
```

with:

```tsx
                      {detailedJobCard.reworkDetailsJson.photos?.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-1">
                          {detailedJobCard.reworkDetailsJson.photos.map((url: string, i: number) => (
                            <div key={i} className="relative group">
                              <img src={url} alt={`rework ${i + 1}`} className="h-16 w-16 object-cover rounded border cursor-pointer" onClick={() => window.open(url, '_blank')} />
                              {canEditJobCardPhotos && (
                                <PhotoReplaceButton
                                  patchPath={`/api/job-cards/${detailedJobCard.id}/rework/${i}`}
                                  photoKey={`rework-${i}`}
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      )}
```

- [ ] **Step 2: Manually verify in the browser**

As `SUPER_ADMIN`, open a job card in `REWORK_PERMISSION_REQUESTED` status that has rework photos attached. Expected: pencil icon appears on each rework photo thumbnail; replacing one shows the success toast and the thumbnail updates.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/JobCardsNew.tsx
git commit -m "Add photo replace UI for rework photos"
```

---

### Task 7: End-to-end verification across all four roles

**Files:** none (verification only)

- [ ] **Step 1: SUPER_ADMIN** — replace one photo from each of the three sets (pre-install, post-install, rework) on any job card. Expected: all three succeed with a success toast and the thumbnail visibly updates.

- [ ] **Step 2: ADMIN** — same as Step 1. Expected: same result (ADMIN has the same unrestricted access as SUPER_ADMIN for this feature).

- [ ] **Step 3: PARTNER_ADMIN** — on a job card belonging to their own partner, replace a pre-install and a post-install photo. Expected: succeeds. Then attempt (via the API directly, since the UI won't show the icon) a `PATCH` against a job card belonging to a *different* partner:

```powershell
$partnerToken = (Invoke-RestMethod -Method Post -Uri http://localhost:5000/api/auth/login -ContentType "application/json" -Body '{"email":"<real-partner-admin-email>","password":"<real-password>"}').token
Invoke-RestMethod -Method Patch -Uri "http://localhost:5000/api/job-cards/<other-partners-job-card-id>/pre-installation/front" -Headers @{ Authorization = "Bearer $partnerToken" } -ContentType "application/json" -Body '{"url":"/objects/uploads/whatever.jpg"}'
```

Expected: HTTP 403 `{"error":"Access denied - job card belongs to a different partner"}`.

- [ ] **Step 4: DETAILING_PARTNER** — repeat Step 3's pattern for this role.

- [ ] **Step 5: Confirm the audit trail** — there is no admin page or API route that reads audit logs back today, so verify directly against the table with Drizzle Studio (uses the same `drizzle.config.ts` as `npm run db:push`):

```bash
npx drizzle-kit studio
```

Expected: a local Drizzle Studio URL is printed; open it in a browser, open the `audit_logs` table, and confirm one row per successful replace from Steps 1-4 above, each with `entity` in (`job_card_photo`, `job_card_media`, `job_card_rework_photo`), the matching `action` (`replace_pre_installation`, `replace`, `replace`), and `actorUserId` matching the user who performed that replace.

- [ ] **Step 6: Confirm old S3 objects are untouched** — for one of the replacements above, note the old URL before replacing (from the `GET /api/job-cards/:id` response), then after replacing, fetch that old URL directly (`GET /objects/uploads/<old-id>`). Expected: HTTP 200 — the old object is still retrievable in S3, confirming nothing was deleted.

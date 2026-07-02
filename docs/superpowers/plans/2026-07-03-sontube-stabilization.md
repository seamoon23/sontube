# SonTube Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the existing MVP with small, parent-useful stabilization features without adding external APIs or complex child tracking.

**Architecture:** Keep behavior in small testable helpers, then wire helpers into App Router pages and server actions. Avoid new subsystems; defer profiles, time limits, history, AI API integration, and Android wrapping.

**Tech Stack:** Next.js App Router, TypeScript, Prisma SQLite, Tailwind CSS, Vitest.

---

### Scope List

**Proceed now**
- Add `7일 / 30일 / 전체` period filtering to parent interest summaries.
- Make the AI prompt mention the selected period.
- Extract admin video list filtering into a tested helper and add simple filters for parent recommendation and thumbnail type.
- Add safe custom thumbnail cleanup when a video switches away from a custom thumbnail or replaces it.
- Apply small accessibility/mobile text fixes where the touched UI already exposes obvious issues.
- Update README/TODO decisions after implementation.

**Keep deferred**
- Child profiles and multi-child statistics.
- Watch-time limits and watch history.
- AI API direct integration.
- Android WebView wrapper.
- Full visual redesign or broad mobile redesign.

### Task 1: Parent Insight Period Filter

**Files:**
- Modify: `lib/kids-insights.ts`
- Modify: `tests/lib/kids-insights.test.ts`
- Modify: `app/admin/insights/page.tsx`

- [x] Add failing tests for period labels and prompt wording.
- [x] Implement a small period parser that supports `7d`, `30d`, and `all`.
- [x] Query `kidsVideoSignal` with `updatedAt >= since` for bounded periods.
- [x] Add a compact segmented link row in `/admin/insights`.

### Task 2: Admin Video List Filters

**Files:**
- Create: `lib/admin-video-filters.ts`
- Create: `tests/lib/admin-video-filters.test.ts`
- Modify: `app/admin/videos/page.tsx`

- [x] Add failing tests for query, tag, status, parent recommended, and thumbnail type filters.
- [x] Move existing `where` construction into `buildAdminVideoWhere`.
- [x] Add `recommended=1` and `thumbnail=CUSTOM|YOUTUBE|PLACEHOLDER` query support.
- [x] Add compact filter controls to the existing admin video list form.

### Task 3: Custom Thumbnail Cleanup

**Files:**
- Modify: `lib/custom-thumbnail.ts`
- Modify: `tests/lib/custom-thumbnail.test.ts`
- Modify: `app/admin/actions.ts`
- Modify: `components/admin/video-form.tsx`

- [x] Add failing tests for safe managed thumbnail path resolution.
- [x] Implement a helper that only resolves paths under `/uploads/thumbnails/`.
- [x] When updating a video, delete the old custom thumbnail after DB update if it is no longer referenced.
- [x] Keep deletion best-effort so DB changes are not rolled back because a file is already missing.
- [x] Make the edit form text clarify that choosing YouTube or placeholder removes the custom thumbnail from the record.

### Task 4: Docs And Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/TODO.md`
- Modify: `docs/DECISIONS.md`

- [x] Update implemented and deferred feature lists.
- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Run `npx tsc --noEmit`.
- [x] Run `npm run build`.
- [ ] Commit and push.

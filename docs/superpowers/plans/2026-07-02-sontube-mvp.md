# SonTube MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first commit-ready SonTube MVP with admin video/tag management and a child-only approved video drawer.

**Architecture:** Use a single Next.js App Router project. Store data in SQLite through Prisma. Keep all external-video behavior limited to URL parsing, thumbnail URL patterns, and YouTube iframe playback.

**Tech Stack:** Next.js, TypeScript, Prisma, SQLite, Tailwind CSS, Zod, React Hook Form, Vitest.

---

### Task 1: Project Foundation

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `tailwind.config.ts`
- Create: `postcss.config.mjs`
- Create: `app/layout.tsx`
- Create: `app/globals.css`

- [x] Add Next.js, Prisma, Tailwind, Zod, React Hook Form, and Vitest scripts and dependencies.
- [x] Configure TypeScript path alias `@/*`.
- [x] Configure Tailwind content paths.

### Task 2: Core Logic Tests

**Files:**
- Create: `tests/lib/youtube.test.ts`
- Create: `tests/lib/tag-recommendations.test.ts`

- [x] Write failing tests for YouTube URL parsing and URL builders.
- [x] Write failing tests for tag recommendation ranking.
- [x] Run `npm test` and verify missing module failures.

### Task 3: Core Logic Implementation

**Files:**
- Create: `lib/youtube.ts`
- Create: `lib/tag-recommendations.ts`
- Create: `lib/tags.ts`
- Create: `lib/thumbnails.ts`

- [x] Implement `parseYouTubeVideoId`.
- [x] Implement embed and thumbnail URL builders.
- [x] Implement local recommendation scoring.
- [x] Run `npm test` and verify 5 passing tests.

### Task 4: Persistence

**Files:**
- Create: `prisma/schema.prisma`
- Create: `prisma/seed.ts`
- Create: `lib/db.ts`
- Create: `.env.example`

- [x] Model videos, tags, video-tag links, and settings.
- [x] Seed starter tags.
- [x] Apply the SQLite schema. In this sandbox, `prisma db push` failed at schema-engine RPC, so the Prisma-generated SQL was applied with `sqlite3`.
- [x] Run `npm run db:seed`.

### Task 5: Admin Workflows

**Files:**
- Create: `app/admin/actions.ts`
- Create: `app/admin/layout.tsx`
- Create: `app/admin/page.tsx`
- Create: `app/admin/videos/page.tsx`
- Create: `app/admin/videos/new/page.tsx`
- Create: `app/admin/videos/[id]/edit/page.tsx`
- Create: `app/admin/tags/page.tsx`
- Create: `components/admin/admin-nav.tsx`
- Create: `components/admin/video-form.tsx`
- Create: `components/admin/tag-manager.tsx`

- [x] Implement video create/update server actions.
- [x] Implement tag create/update server actions.
- [x] Implement admin dashboard, video list, video form, and tag manager.

### Task 6: Kids Workflows

**Files:**
- Create: `app/kids/page.tsx`
- Create: `app/kids/watch/[id]/page.tsx`
- Create: `components/kids/video-card.tsx`

- [x] Query only published and parent-checked videos.
- [x] Add internal search and tag filters.
- [x] Add iframe playback page without admin controls.

### Task 7: Docs and Verification

**Files:**
- Create: `README.md`
- Update: `AGENTS.md`
- Update: `docs/PRODUCT_BRIEF.md`
- Update: `docs/DECISIONS.md`
- Update: `docs/TODO.md`

- [x] Document run commands and access paths.
- [x] Run `npm test`.
- [x] Run `npm run build`.
- [ ] Commit the first MVP scaffold.

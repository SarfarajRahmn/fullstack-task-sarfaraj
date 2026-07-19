# Fullstack Task — Social Feed (Next.js 16 + Better Auth)

A full-stack social feed application built on top of an existing converted HTML
template. The UI (Login, Register, Feed) is already implemented and **must not
be redesigned** — this project is about connecting that UI to a real backend:
authentication, a database, state management, and business logic.

> **Golden rules:** Do NOT rewrite pages from scratch. Do NOT modify the UI. Do
> NOT change CSS classes. Only connect the existing UI with real functionality.

---

## Tech Stack

### Frontend
- **Next.js 16** (App Router, Turbopack)
- **React 19**
- **TypeScript**
- **Zustand** — client state (auth + feed)
- **Next.js 16 native forms** — `<form>` with **Server Actions** + `useActionState` (no React Hook Form)
- **Zod** — schema validation

### Authentication
- **Better Auth** (session-based, cookie sessions)
- Protected routes enforced by **proxy.ts** (Next.js 16)

### Backend
- **Route Handlers** (`app/api/**`)
- **Server Actions** where appropriate (create/like/comment/reply)

### Database
- **PostgreSQL** via **Neon Database** (serverless)
- **Drizzle ORM**

### Image Upload
- Local upload to `public/uploads` **or** UploadThing (either acceptable)

### Package manager
- **npm**

---

## Getting Started

### Prerequisites
- Node.js 18.18+ (Node 20+ recommended)
- A Neon PostgreSQL database (or any Postgres instance)
- `npm`

### Install dependencies
```bash
npm install
```

### Environment variables
Create `.env.local` (gitignored) and fill in the values:

```dotenv
# Better Auth
BETTER_AUTH_SECRET=          # generate: openssl rand -hex 32
BETTER_AUTH_URL=http://localhost:3000

# Neon / Postgres (Drizzle)
DATABASE_URL=postgresql://<user>:<password>@<host>/<db>?sslmode=require

# Image upload (UploadThing — only if used instead of local)
UPLOADTHING_TOKEN=

# Optional: public base URL for the auth client
NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:3000
```

### Database setup (Drizzle + Neon)
```bash
# Generate SQL migrations from schema.ts
npx drizzle-kit generate

# Push schema to Neon (or run the generated migration)
npx drizzle-kit migrate
```

### Run the app
```bash
npm run dev      # development (Turbopack)
npm run build    # production build
npm run start    # serve production build
npm run lint     # eslint
```

---

## Project Structure

```
app/
  (auth)/
    login/page.tsx
    register/page.tsx
  feed/
    page.tsx            # protected feed UI (already converted)
    layout.tsx          # server-side auth gate + UserProvider
    user-context.tsx    # React context for current user
  api/
    auth/[...all]/route.ts
    feed/route.ts       # feed API (eager loading, visibility filter)
  actions/
    auth.ts             # signUpAction, signInAction
    posts.ts            # create/delete post, like/comment/reply actions
  layout.tsx
  page.tsx              # root — redirects to /feed (auth) or /login
  globals.css

proxy.ts                # Next.js 16 route proxy (auth guards)

components/             # UI pieces wired to real data

db/
  schema.ts             # Drizzle table definitions
  index.ts              # Drizzle client (pool + drizzle())

lib/
  auth.ts               # Better Auth server instance
  auth-client.ts        # Better Auth client (browser)
  validations.ts        # Zod schemas (register, login, post, comment, reply, upload)
  upload.ts             # image upload helper (local | UploadThing)

store/
  auth-store.ts         # Zustand: current user, session, loading
  feed-store.ts         # Zustand: posts, likes, comments, loading

hooks/                  # reusable data hooks

types/                  # shared TS types

drizzle/                # generated migrations

public/uploads/         # local image uploads
```

---

## Authentication

Implemented with **Better Auth** using session-based (cookie) auth.

### Registration
Required fields:
- `firstName`
- `lastName`
- `email`
- `password` (min length enforced, validated with Zod)

On success the user is created and a session cookie is issued
(`nextCookies()` plugin), then redirected to `/feed`.

### Login / Logout
- `signIn.email` issues a session cookie.
- `signOut` clears the session and redirects to `/login`.

### Route protection
- `proxy.ts` protects `/feed` (and any authed route).
- Unauthenticated users are **automatically redirected to `/login`**.
- Authenticated users **cannot** reach `/login` or `/register` (redirected to
  `/feed`).
- The root `/` is a server-side auth gate: authed → `/feed`, anon → `/login`.
- The `/feed` layout also performs a server-side session check as a defense-in-depth measure.

```ts
// app/(auth)/login — guarded by proxy.ts
// app/(auth)/register — guarded by proxy.ts
// app/feed — guarded by proxy.ts + server session check in layout
```

---

## Database Design (Drizzle)

Tables (primary keys are `uuid`/`cuid`, timestamps default `now()`):

### `users`
Managed by Better Auth (`id`, `email`, `emailVerified`, `name`, `image`,
`createdAt`, `updatedAt`) **plus additional fields**:
- `firstName` — `text`, required
- `lastName` — `text`, required

### `sessions`, `accounts`, `verification`
Managed entirely by Better Auth.

### `posts`
| field       | type                                  |
|-------------|---------------------------------------|
| `id`        | `uuid` / `cuid` (PK)                  |
| `userId`    | FK → `users.id`                       |
| `content`   | `text`                                |
| `imageUrl`  | `text` (nullable)                     |
| `visibility`| `enum('PUBLIC','PRIVATE')` (default `PUBLIC`) |
| `createdAt` | `timestamp`                           |
| `updatedAt` | `timestamp`                           |

Indexes: `userId`, `createdAt` (feed ordering), `visibility`.

### `comments`
| field       | type                  |
|-------------|-----------------------|
| `id`        | PK                    |
| `postId`    | FK → `posts.id`       |
| `userId`    | FK → `users.id`       |
| `content`   | `text`                |
| `createdAt` | `timestamp`           |

Indexes: `postId`.

### `replies`
| field       | type                  |
|-------------|-----------------------|
| `id`        | PK                    |
| `commentId` | FK → `comments.id`    |
| `userId`    | FK → `users.id`       |
| `content`   | `text`                |
| `createdAt` | `timestamp`           |

Indexes: `commentId`.

### `likes` (single table)
| field       | type                                  |
|-------------|---------------------------------------|
| `id`        | PK                                    |
| `userId`    | FK → `users.id`                       |
| `postId`    | FK → `posts.id` (nullable)            |
| `commentId`| FK → `comments.id` (nullable)         |
| `replyId`  | FK → `replies.id` (nullable)         |
| `createdAt` | `timestamp`                           |

Exactly **one** of `postId` / `commentId` / `replyId` is set per row.
Unique constraint `(userId, postId)` / `(userId, commentId)` / `(userId, replyId)`
enforces **one like per user** per target.

---

## Feed Logic

- **Protected** — only authenticated users can view the feed.
- Visible posts = **PUBLIC** posts **+** the current user's own **PRIVATE** posts.
  Only the owner can see their private posts.
- **Order:** newest first (`ORDER BY createdAt DESC`).
- **Eager loading** (avoid N+1): each post includes
  `author`, `likes`, `comments` → `replies`, like counts, comment counts, and
  author display names, resolved in a single query (Drizzle relational query /
  batch fetches).
- **Performance:** proper indexes, pagination-ready (`limit`/`offset` or cursor),
  select only needed columns, transactions for multi-row writes (e.g. create
  post + like).

---

## Features & Server Actions

| Feature            | Server Action        | Notes |
|--------------------|----------------------|-------|
| Create post        | `createPost`         | text + optional image + visibility |
| Delete post        | `deletePost`         | owner only |
| Like / Unlike      | `likePost`           | one like per user, optimistic |
| Comment            | `commentPost`        | on a post |
| Reply              | `replyPost`          | nested under a comment, likeable |
| Like comment/reply | `likeComment`/`likeReply` | one like per user |

All actions:
- Validate input with **Zod** on the server (never trust the client).
- Run inside **transactions** where multiple rows change.
- Return typed results / errors suitable for toasts.

---

## State Management (Zustand)

### `store/auth-store.ts`
- `user` — current user (id, firstName, lastName, email, image)
- `session` — active session
- `loading` — auth state loading

### `store/feed-store.ts`
- `posts` — feed posts
- `likeState` — per-target like status + counts
- `commentState` — comments/replies per post
- `loading` — feed/infinite loading
- **Optimistic updates** for likes (toggle immediately, reconcile on response).

---

## Validation (Zod)

All inputs validated server-side in `lib/validations.ts`:
- `registerSchema` — firstName, lastName, email, password (+ confirm)
- `loginSchema` — email, password
- `createPostSchema` — content, imageUrl?, visibility
- `commentSchema` / `replySchema` — content
- `uploadSchema` — file type / size

### Forms (native Next.js 16)
Forms use the **built-in Next.js 16 form model**, not React Hook Form:
- A Server Action is passed to the native `<form action={...}>` element.
- `useActionState(action, initialState)` drives submission and surfaces
  server-returned errors (e.g. `AuthState { error }`).
- Client feedback (required fields, `minLength`, `disabled` while
  `isPending`) comes from native HTML constraints + the `useActionState`
  pending flag — no extra form library.

Client-side validation is for UX only; **the server is the source of truth.**

---

## Image Upload

- **Local:** stream to `public/uploads`, return a public path.
- **UploadThing:** use the provided token for direct uploads.
- Validated (type + size) and never trusted from the client.

---

## Security

- Sanitize / validate **all** input with Zod on the server.
- Route protection via **proxy.ts** + server session check.
- Private posts visible **only to their owner**.
- Only authenticated users can create posts / like / comment / reply.
- One like per user enforced by a unique DB constraint.
- Internal errors are **never** exposed to the client (generic, toast-friendly
  messages only).

---

## Error Handling

- Server actions and route handlers return typed errors
  (`{ error: string }` / `ActionState`).
- Friendly, toast-ready messages.
- Never leak stack traces or internal details to the client.

---

## Implementation Strategy

Worked incrementally, one feature at a time:

1. Install dependencies
2. Configure Better Auth
3. Configure Neon
4. Configure Drizzle
5. Generate schema
6. Run migrations
7. Authentication
8. Protected routes (proxy.ts)
9. Registration
10. Login
11. Zustand auth store
12. Feed query
13. Create Post
14. Like system
15. Comment system
16. Reply system
17. Visibility filtering
18. Optimistic updates
19. Final cleanup

### Status
| Area                | State        |
|---------------------|--------------|
| Better Auth config  | ✅ Done      |
| Session-based auth  | ✅ Done      |
| Protected `/feed`   | ✅ Done      |
| Root `/` auth gate  | ✅ Done      |
| Registration/Login UI wired | ✅ Done |
| Neon + Drizzle      | ✅ Done      |
| Posts / Comments / Replies / Likes | ✅ Done |
| Zustand stores      | ✅ Done      |
| Optimistic updates  | ✅ Done      |
| Route proxy (`proxy.ts`) | ✅ Done |

---

## Scripts

```bash
npm run dev      # dev server (Turbopack)
npm run build    # production build (+ type check)
npm run start    # serve production build
npm run lint     # eslint
```

---

## Notes for Code Review

- UI is preserved exactly; only behavior is connected.
- Every server action validates with Zod and uses transactions where needed.
- Feed queries are written to avoid N+1 and are pagination-ready.
- Folder layout follows the required `app/`, `lib/`, `db/`, `store/`, `actions/`
  convention for scalability.

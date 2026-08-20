# Client Guide

## Overview

The Next.js client is a separate frontend that talks to the NestJS API. It uses the App Router, TypeScript, Tailwind CSS, Axios, react-hook-form, and Zod.

| Setting | Value |
| --- | --- |
| Dev port | `3000` |
| API base URL | `http://localhost:5000` |
| Env prefix | `NEXT_PUBLIC_` for browser-safe variables |

## Folder structure

```
next-client/
├── public/                 # Static assets
├── src/
│   ├── app/                # Routes (App Router)
│   │   ├── layout.tsx      # Root layout, fonts, Toaster
│   │   ├── page.tsx        # /
│   │   └── users/
│   │       └── page.tsx    # /users
│   ├── components/
│   │   └── users/          # UserTable, UserForm, UsersPage
│   ├── services/
│   │   ├── api.ts          # Axios instance
│   │   └── userService.ts  # User API calls
│   ├── types/
│   │   └── user.types.ts
│   ├── utils/
│   │   └── errors.ts       # API error message helper
│   └── middleware.ts       # Next.js middleware
├── .env.example
└── next.config.ts
```

Add new features by creating a route under `app/`, components under `components/<feature>/`, and a service under `services/`.

## Environment variables

Copy `.env.example` to `.env` or `.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000
NEXT_PUBLIC_APP_NAME=My App
NEXT_PUBLIC_APP_VERSION=1.0.0
```

Never put secrets in `NEXT_PUBLIC_*` variables — they are bundled into the browser.

## Services layer

All HTTP calls go through `src/services/`. Pages and components should not import Axios directly.

### `api.ts`

Creates an Axios instance with `baseURL` from `NEXT_PUBLIC_API_BASE_URL`.

### `userService.ts`

| Method | API call |
| --- | --- |
| `getAll()` | `GET /users` |
| `getById(id)` | `GET /users/:id` |
| `create(data)` | `POST /users` |
| `update(id, data)` | `PATCH /users/:id` |
| `delete(id)` | `DELETE /users/:id` |

When auth is added, extend `api.ts` with request interceptors (Bearer token) and response interceptors (401 refresh).

## Users page

Route: `/users` (`src/app/users/page.tsx`)

The page renders `UsersPage`, a client component that:

1. Loads users on mount via `userService.getAll()`
2. Shows a table with edit and delete actions
3. Opens an inline form for create and edit
4. Displays success and error toasts via `sonner`

### Components

| Component | Purpose |
| --- | --- |
| `UsersPage` | State, data fetching, CRUD handlers |
| `UserTable` | Tabular list with actions |
| `UserForm` | react-hook-form + Zod validation |

### Form fields

Matches the NestJS `CreateUserDto`: firstname, lastname, username, email, phoneno, dob, nic, age, profile (optional).

## Middleware

`src/middleware.ts` currently passes all requests through. When authentication is added, use it for coarse route protection (e.g. redirect unauthenticated users to `/login`).

```typescript
export function middleware(request: NextRequest) {
  return NextResponse.next();
}
```

Fine-grained UI permissions can be handled client-side later with a `PermissionGate` component or `usePermission` hook.

## App Router conventions

| File | Purpose |
| --- | --- |
| `page.tsx` | Route UI — defines the URL |
| `layout.tsx` | Shared wrapper for a segment |
| `loading.tsx` | Loading fallback (not added yet) |
| `error.tsx` | Error boundary (not added yet) |

Add `'use client'` at the top of files that use hooks, event handlers, or browser APIs.

## Adding a new feature

Example: a `products` module.

1. Add types in `src/types/product.types.ts`
2. Add `src/services/productService.ts`
3. Add components in `src/components/products/`
4. Add route `src/app/products/page.tsx`
5. Link from the home page or a future navigation shell

## Styling

Tailwind CSS v4 is configured via `src/app/globals.css` with `@import "tailwindcss"`. Use utility classes directly in components. shadcn/ui is not set up yet — add it when you need a component library.

## Planned structure (not implemented)

These folders from the template design can be added as the app grows:

```
src/
├── components/layout/    # AppShell, Sidebar, Navbar
├── components/common/    # SearchBar, Pagination, ConfirmDialog
├── store/                # Zustand stores (auth, UI)
├── hooks/                # useAuth, useDebounce
├── constants/            # routes, permissions
└── app/(auth)/           # Login, register
└── app/(dashboard)/      # Protected app shell
```

## Troubleshooting

### Network error / cannot reach API

- Confirm the Nest server is running on port 5000
- Check `NEXT_PUBLIC_API_BASE_URL` in `.env` or `.env.local`
- Restart `npm run dev` after changing env variables

### CORS error

Ensure `nest-server/.env` has `ALLOWED_ORIGINS=http://localhost:3000`.

### Middleware export error

`middleware.ts` must export a function named `middleware`. An empty file will crash the dev server.

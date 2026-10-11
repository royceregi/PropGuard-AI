# PropGuard AI — Web Client (Next.js)

Role-based web application for PropGuard AI, built with Next.js 16 (App Router), React 19, TypeScript, and Tailwind CSS 4. It talks to the FastAPI backend in [`../server`](../server/).

For the full project overview, architecture, and usage guide, see the [root README](../README.md).

## Prerequisites

- Node.js 20 or newer
- The backend running on http://localhost:8000 (see [server/README.md](../server/README.md))

## Setup and run

```bash
cd client
npm install
cp .env.example .env
npm run dev          # http://localhost:3000
```

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Development server on port 3000 |
| `npm run build` | Production build |
| `npm run start` | Serve the production build on port 3000 |
| `npm run lint` | ESLint |
| `npm run type-check` | TypeScript check (`tsc --noEmit`) |
| `npm run format` | Prettier (writes changes) |

## Environment variables

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Backend base URL used by the browser (default `http://localhost:8000`) |
| `API_URL` | Backend base URL used by the server-side auth routes in `src/app/api/auth/` |

Variables starting with `NEXT_PUBLIC_` are exposed to the browser, so never put secrets in them.

## Authentication flow

1. The login form posts to the Next.js route `/api/auth/login`, which calls the backend and stores the JWT in the HttpOnly `propguard_access_token` cookie.
2. [`src/proxy.ts`](src/proxy.ts) reads that cookie on every page request, redirects signed-out users to `/login`, and blocks pages the user's access level may not open (rules in [`src/lib/auth/roles.ts`](src/lib/auth/roles.ts)).
3. API calls go through the Axios client in [`src/lib/api/client.ts`](src/lib/api/client.ts).

These checks only control navigation; the backend enforces all permissions.

## Main routes

| Route | Description | Access levels |
| --- | --- | --- |
| `/` | Public landing page | Everyone |
| `/login`, `/forgot-password` | Sign-in pages | Signed-out users |
| `/dashboard/admin`, `/dashboard/registry`, `/dashboard/company`, `/dashboard/my-properties` | Home dashboard per access level | Matching level (and Super Admin) |
| `/property-search` | Property search and Evidence Retrieval | All signed-in |
| `/transactions` | Transaction list and details | SYSTEM, REGISTRY, COMPANY |
| `/blockchain-verification` | Ledger verification | All signed-in |
| `/ai-investigation` | Run AI investigations | SYSTEM, REGISTRY, COMPANY |
| `/investigation-reports` | Stored investigation reports | All signed-in |
| `/risk-analysis` | Risk-assessment requests and registry review | All signed-in |
| `/shared-properties` | Properties shared with or by the user | All signed-in |
| `/users`, `/audit-trail`, `/settings` | User management, agent audit trail, admin settings | Restricted (see `roles.ts`) |

The AI Property Assistant opens from the button at the bottom-right of every signed-in page.

## Project structure

```text
src/
├── app/
│   ├── page.tsx          # Landing page
│   ├── (auth)/           # Login and forgot-password
│   ├── (app)/            # Signed-in pages (layout with navigation)
│   └── api/auth/         # login / logout / me route handlers (auth cookie)
├── components/           # UI components grouped by feature area
├── hooks/                # useAuth, useNotifications
├── lib/                  # API client, auth and roles, per-feature types and stores
└── proxy.ts              # Route protection
```

Code style: strict TypeScript, Prettier config in [`.prettierrc`](.prettierrc), components in `src/components/<area>/`. See [contributing.md](../contributing.md).

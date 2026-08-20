# Next.js Client

Frontend for the template project. Built with Next.js 16 (App Router), React 19, TypeScript, and Tailwind CSS.

**Dev URL:** http://localhost:3000  
**API URL:** http://localhost:5000 (via `NEXT_PUBLIC_API_BASE_URL`)

## Prerequisites

- Node.js 20+
- NestJS server running locally (see `../nest-server`)

## Setup

```bash
cp .env.example .env
npm install
npm run dev
```

Open http://localhost:3000.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start dev server on port 3000 |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | ESLint |
| `npm run type-check` | TypeScript check |

## Environment variables

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | NestJS API base URL (`http://localhost:5000`) |
| `NEXT_PUBLIC_APP_NAME` | App display name |
| `NEXT_PUBLIC_APP_VERSION` | App version string |

Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser. Do not put secrets in them.

## Routes

| Path | Description |
| --- | --- |
| `/` | Home page |
| `/users` | User list, create, edit, and delete |

## Project structure

```
src/
├── app/               # App Router pages
│   ├── page.tsx       # /
│   └── users/page.tsx # /users
├── components/users/  # UserTable, UserForm, UsersPage
├── services/          # api.ts, userService.ts
├── types/             # user.types.ts
├── utils/             # errors.ts
└── middleware.ts      # Route middleware (passthrough for now)
```

## Documentation

See [docs/](./docs/) for architecture, conventions, and how to add new features.

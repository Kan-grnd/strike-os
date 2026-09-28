# Strike OS

**Adaptive AI Workforce Operating System**

One intelligence, many workers.

## Getting Started

Strike OS stores its data in **PostgreSQL** on every platform, including local
development, so the database provider cannot drift between environments.

The easiest way to get a matching database is the devcontainer, which starts
PostgreSQL alongside the app:

```bash
# Open the folder in a devcontainer, then:
npm run db:migrate:dev   # apply migrations
npm run db:seed          # load the demo dataset
npm run dev
```

To run against your own PostgreSQL instead, point `DATABASE_URL` at it in `.env`
(see `.env.example`) and run:

```bash
npm install
npm run db:generate      # generate Prisma Client
npm run db:migrate       # apply migrations
npm run db:seed          # optional: load the demo dataset
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Database scripts

| Script | Purpose |
| --- | --- |
| `npm run db:migrate` | Apply pending migrations (`prisma migrate deploy`) |
| `npm run db:migrate:dev` | Create a new migration from schema changes |
| `npm run db:seed` | Load the demo dataset |
| `npm run db:generate` | Regenerate Prisma Client |
| `npm run db:studio` | Open Prisma Studio |

`npm run build` runs `prisma generate` and `prisma migrate deploy` before
`next build`, so a deploy applies migrations as part of the build.

## Project Structure

```
strike-os/
├── src/
│   ├── app/                    # Next.js App Router
│   ├── components/
│   │   ├── ui/                 # Primitive components
│   │   └── layout/             # Layout components
│   ├── design-system/
│   │   ├── tokens/             # Design tokens
│   │   └── components/         # DS components
│   ├── lib/                    # Utilities
│   ├── store/                  # State management
│   └── styles/                 # Global styles
├── prisma/                     # Database schema
└── public/                     # Static assets
```

## Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Database:** PostgreSQL + Prisma
- **State:** Zustand
- **UI:** Radix UI + shadcn/ui
- **Icons:** Lucide React

## Phase 1 — Foundation ✓

- [x] Repository setup
- [x] Design token system (monochrome + 4 themes)
- [x] Component library
- [x] Global layout
- [x] Command Center shell

## License

MIT

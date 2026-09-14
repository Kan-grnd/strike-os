# Strike OS

**Adaptive AI Workforce Operating System**

One intelligence, many workers.

## Getting Started

```bash
# Install dependencies
npm install

# Set up database
npm run db:generate
npm run db:push

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

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

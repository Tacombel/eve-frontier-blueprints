# EVE Frontier Industry Calculator

A tool to manage blueprints, calculate required materials, and track stock in EVE Frontier.

## Features

- **Items** — Catalogue of raw materials, intermediates, and final products
- **Blueprints** — Crafting recipes with direct material calculation
- **Packs** — Group multiple blueprints to calculate and execute in batch
- **Stock** — Inventory tracking with inline editing
- **Factories** — Production factory management
- **Decompositions** — Ore decomposition rules
- **Asteroids** — Asteroid type locations per ore

---

## Requirements

- [Node.js](https://nodejs.org/) v18 or higher
- npm (included with Node.js)
- Git

---

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/Tacombel/eve-frontier-blueprints.git
cd eve-frontier-blueprints
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up the database

Create a `.env` file in the project root with the following content:

```env
DATABASE_URL="file:./prisma/dev.db"
```

Apply the migrations to create the database structure, then load the shared game data:

```bash
npx prisma migrate deploy
npx prisma generate
npm run db:seed
```

### 4. Start the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Collaborative data

Game data (items, blueprints, decompositions, factories, asteroid types) is stored in [`prisma/seed.json`](prisma/seed.json) and shared via this repository. Stock and packs are personal and stay local only.

### Sync the latest data from GitHub

When someone pushes new data to `seed.json`, pull the changes and import them via the app:

```bash
git pull
```

Then open the app, go to **Admin → Merge import**. A preview will show what's new before anything is applied. Your stock is never affected.

> If you prefer the terminal: `npm run db:seed` (full reset, also preserves stock).

### Contribute data

1. Fork the repository (or ask to be added as a collaborator)
2. Pull the latest changes: `git pull`
3. Make your changes in the app (add items, blueprints, etc.)
4. Go to **Admin → Export to seed.json** (or run `npm run db:export`)
5. Commit and open a Pull Request:
   ```bash
   git add prisma/seed.json
   git commit -m "feat: add blueprints for XYZ"
   git push
   ```

---

## Tech stack

- [Next.js 14](https://nextjs.org/) — React framework with App Router
- [Prisma](https://www.prisma.io/) — ORM with SQLite
- [Tailwind CSS](https://tailwindcss.com/) — Styling

---

## License

© tacombel@gmail.com

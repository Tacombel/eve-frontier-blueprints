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

Apply the migrations to create the database structure:

```bash
npx prisma migrate deploy
npx prisma generate
```

Then load the shared game data:

```bash
npm run db:seed
```

> **Note:** `npm run db:seed` does a **full reset** of all game data (items, blueprints, decompositions, factories, asteroid types) and replaces it with the contents of `prisma/seed.json`. Your personal stock and packs are **never affected**.

### 4. Start the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Collaborative data

Game data (items, blueprints, decompositions, factories, asteroid types) is stored in [`prisma/seed.json`](prisma/seed.json) and shared via this repository. Stock and packs are personal and stay local only.

### Sync the latest data from GitHub

When someone pushes new data to `seed.json`, pull the changes:

```bash
git pull
```

Then open the app and go to **Admin**. You have two import options:

| Option | What it does |
|--------|-------------|
| **Merge import** | Adds or updates records from `seed.json`. Existing data not in the file is left untouched. Safe for day-to-day updates. |
| **Reset import** | Deletes **all** game data and replaces it with `seed.json`. Use this to fix inconsistencies or start clean. |

> Your stock and packs are never affected by either import.

If you prefer the terminal, `npm run db:seed` is equivalent to a full reset import.

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

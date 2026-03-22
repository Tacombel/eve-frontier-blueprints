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

## Installation

### Option A — Local (Node.js)

**Requirements:** [Node.js](https://nodejs.org/) v18 or higher, npm, Git

#### 1. Clone the repository

```bash
git clone https://github.com/Tacombel/eve-frontier-blueprints.git
cd eve-frontier-blueprints
```

#### 2. Install dependencies

```bash
npm install
```

#### 3. Set up the database

Create a `.env` file in the project root:

```env
DATABASE_URL="file:./prisma/dev.db"
JWT_SECRET="change-this-to-a-random-secret"
```

Apply the migrations:

```bash
npx prisma migrate deploy
npx prisma generate
```

#### 4. Build and start the app

```bash
npm run build
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

### Option B — Docker *(Soon)*

> Docker support is coming. A pre-built image for `linux/amd64` and `linux/arm64` will be available on Docker Hub.

---

## Tech stack

- [Next.js 14](https://nextjs.org/) — React framework with App Router
- [Prisma](https://www.prisma.io/) — ORM with SQLite
- [Tailwind CSS](https://tailwindcss.com/) — Styling

---

## License

© tacombel@gmail.com

-- CreateTable User
CREATE TABLE "User" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "username" TEXT NOT NULL,
  "password" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- Delete existing stock and pack data (no owner to assign to)
DELETE FROM "Stock";
DELETE FROM "Pack";

-- Recreate Stock with userId (SQLite requires table recreation for NOT NULL columns)
PRAGMA foreign_keys=OFF;

CREATE TABLE "Stock_new" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "itemId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Stock_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Stock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

DROP TABLE "Stock";
ALTER TABLE "Stock_new" RENAME TO "Stock";
CREATE UNIQUE INDEX "Stock_itemId_userId_key" ON "Stock"("itemId", "userId");

-- Recreate Pack with userId
CREATE TABLE "Pack_new" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "userId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Pack_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

DROP TABLE "Pack";
ALTER TABLE "Pack_new" RENAME TO "Pack";

PRAGMA foreign_keys=ON;

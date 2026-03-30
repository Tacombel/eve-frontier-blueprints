-- SQLite does not support DROP INDEX on inline UNIQUE constraints defined in CREATE TABLE.
-- Recreate the Decomposition table without the old inline constraint, then add the new index.

PRAGMA foreign_keys=OFF;

CREATE TABLE "Decomposition_new" (
    "id"           TEXT NOT NULL PRIMARY KEY,
    "sourceItemId" TEXT NOT NULL,
    "refinery"     TEXT NOT NULL DEFAULT '',
    "inputQty"     INTEGER NOT NULL DEFAULT 1,
    "isDefault"    BOOLEAN NOT NULL DEFAULT 1,
    "blueprintId"  INTEGER,
    "createdAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    DATETIME NOT NULL,
    CONSTRAINT "Decomposition_sourceItemId_fkey" FOREIGN KEY ("sourceItemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "Decomposition_new" ("id", "sourceItemId", "refinery", "inputQty", "isDefault", "blueprintId", "createdAt", "updatedAt")
SELECT "id", "sourceItemId", "refinery", "inputQty", "isDefault", "blueprintId", "createdAt", "updatedAt"
FROM "Decomposition";

DROP TABLE "Decomposition";
ALTER TABLE "Decomposition_new" RENAME TO "Decomposition";

CREATE UNIQUE INDEX "Decomposition_sourceItemId_refinery_blueprintId_key" ON "Decomposition"("sourceItemId", "refinery", "blueprintId");

PRAGMA foreign_keys=ON;

-- Recreate Decomposition table: add refinery + isDefault, replace @unique(sourceItemId) with @@unique([sourceItemId, refinery])

PRAGMA foreign_keys=OFF;

CREATE TABLE "Decomposition_new" (
    "id"           TEXT NOT NULL PRIMARY KEY,
    "sourceItemId" TEXT NOT NULL,
    "refinery"     TEXT NOT NULL DEFAULT '',
    "inputQty"     INTEGER NOT NULL DEFAULT 1,
    "isDefault"    BOOLEAN NOT NULL DEFAULT 1,
    "createdAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    DATETIME NOT NULL,
    CONSTRAINT "Decomposition_sourceItemId_fkey" FOREIGN KEY ("sourceItemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Decomposition_sourceItemId_refinery_key" UNIQUE ("sourceItemId", "refinery")
);

INSERT INTO "Decomposition_new" ("id", "sourceItemId", "refinery", "inputQty", "isDefault", "createdAt", "updatedAt")
SELECT "id", "sourceItemId", '', "inputQty", 1, "createdAt", "updatedAt"
FROM "Decomposition";

DROP TABLE "Decomposition";
ALTER TABLE "Decomposition_new" RENAME TO "Decomposition";

PRAGMA foreign_keys=ON;

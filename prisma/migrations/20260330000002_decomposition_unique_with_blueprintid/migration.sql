-- DropIndex
DROP INDEX "Decomposition_sourceItemId_refinery_key";

-- CreateIndex
CREATE UNIQUE INDEX "Decomposition_sourceItemId_refinery_blueprintId_key" ON "Decomposition"("sourceItemId", "refinery", "blueprintId");

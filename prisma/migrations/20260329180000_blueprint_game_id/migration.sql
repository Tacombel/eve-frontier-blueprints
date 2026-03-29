-- AlterTable
ALTER TABLE "Blueprint" ADD COLUMN "gameId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Blueprint_gameId_key" ON "Blueprint"("gameId");

-- AlterTable
ALTER TABLE "Factory" ADD COLUMN "typeId" INTEGER;

-- AlterTable
ALTER TABLE "Refinery" ADD COLUMN "typeId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Factory_typeId_key" ON "Factory"("typeId");

-- CreateIndex
CREATE UNIQUE INDEX "Refinery_typeId_key" ON "Refinery"("typeId");

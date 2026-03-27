-- DropIndex
DROP INDEX "Item_name_key";

-- AlterTable
ALTER TABLE "Item" ADD COLUMN "categoryId" INTEGER;
ALTER TABLE "Item" ADD COLUMN "categoryName" TEXT;
ALTER TABLE "Item" ADD COLUMN "description" TEXT;
ALTER TABLE "Item" ADD COLUMN "groupId" INTEGER;
ALTER TABLE "Item" ADD COLUMN "groupName" TEXT;
ALTER TABLE "Item" ADD COLUMN "iconUrl" TEXT;
ALTER TABLE "Item" ADD COLUMN "mass" REAL;
ALTER TABLE "Item" ADD COLUMN "portionSize" INTEGER;
ALTER TABLE "Item" ADD COLUMN "radius" REAL;

-- CreateIndex
CREATE UNIQUE INDEX "Item_typeId_key" ON "Item"("typeId");

import type { ImportPreview } from "@/app/api/admin/import/preview/route";

export function hasPreviewChanges(preview: ImportPreview): boolean {
  return (
    preview.factories.new.length > 0 ||
    preview.locations.new.length > 0 ||
    preview.items.new.length > 0 ||
    preview.items.updated.length > 0 ||
    preview.asteroidTypes.new.length > 0 ||
    preview.decompositions.new.length > 0 ||
    preview.blueprints.new.length > 0 ||
    preview.blueprints.updated.length > 0
  );
}

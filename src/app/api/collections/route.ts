import { catalog } from "@/lib/catalog";

export async function GET() {
  return Response.json({
    collections: catalog.collections.map((c) => ({ ...c, trackCount: c.trackIds.length })),
  });
}

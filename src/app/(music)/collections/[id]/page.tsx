import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CollectionView } from "@/components/discovery/CollectionView";
import { catalog, getCollection } from "@/lib/catalog";

export function generateStaticParams() {
  return catalog.collections.map((c) => ({ id: c.id }));
}

export async function generateMetadata({ params }: PageProps<"/collections/[id]">): Promise<Metadata> {
  const { id } = await params;
  const c = getCollection(id);
  return c ? { title: c.title, description: c.description } : { title: "Collection not found" };
}

export default async function CollectionPage({ params }: PageProps<"/collections/[id]">) {
  const { id } = await params;
  if (!getCollection(id)) notFound();
  return <CollectionView id={id} />;
}

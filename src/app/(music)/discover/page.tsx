import type { Metadata } from "next";

import { DiscoverView } from "@/components/discovery/DiscoverView";

export const metadata: Metadata = {
  title: "Discover",
  description: "Browse Sonora's collections and search the library by mood, energy and genre.",
};

export default function DiscoverPage() {
  return <DiscoverView />;
}

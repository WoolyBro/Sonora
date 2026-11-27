import type { Metadata } from "next";

import { OriginalsView } from "@/components/music/OriginalsView";

export const metadata: Metadata = {
  title: "Sonora Originals",
  description: "Original music created or commissioned for Sonora.",
};

export default function OriginalsPage() {
  return <OriginalsView />;
}

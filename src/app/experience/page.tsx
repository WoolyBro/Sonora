import type { Metadata } from "next";

import { ExperienceFlow } from "@/components/emotion/ExperienceFlow";

export const metadata: Metadata = {
  title: "Check in",
  description: "Describe how you feel and Sonora will find music that fits.",
};

export default function ExperiencePage() {
  return <ExperienceFlow />;
}

import type { Metadata } from "next";

import { ProfileView } from "@/components/profile/ProfileView";

export const metadata: Metadata = {
  title: "Your library",
  description: "Favourites, playlists, listening history and preferences.",
};

export default function ProfilePage() {
  return <ProfileView />;
}

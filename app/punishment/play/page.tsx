"use client";

import { PunishmentPlayer } from "@/components/punishment/PunishmentPlayer";
import { usePreferences } from "@/components/punishment/usePreferences";
import { challenges as normalChallenges } from "@/content/punishment/challenges";
import { challenges as coupleChallenges } from "@/content/punishment/couple";
import { challenges as oneManyChallenges } from "@/content/punishment/oneMany";
import { SESSION_KEY } from "@/lib/punishment/session";

export default function PunishmentPlay() {
  const { preferences } = usePreferences();
  const cards = preferences.bank === "couple" ? coupleChallenges : preferences.bank === "oneMany" ? oneManyChallenges : normalChallenges;
  return <PunishmentPlayer cards={cards} sessionKey={SESSION_KEY} swap={{ label: "切换到真心话", href: "/truth/play" }} />;
}

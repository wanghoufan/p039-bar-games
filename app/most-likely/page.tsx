"use client";

import { PunishmentPlayer } from "@/components/punishment/PunishmentPlayer";
import { challenges as mostLikelyChallenges } from "@/content/punishment/mostLikely";

export default function MostLikelyPlay() {
  return <PunishmentPlayer cards={mostLikelyChallenges} sessionKey="party-night-mostlikely-session-v1" backHref="/" swap={{ label: "切换到我从来没有", href: "/never-have" }} />;
}

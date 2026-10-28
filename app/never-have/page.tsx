"use client";

import { PunishmentPlayer } from "@/components/punishment/PunishmentPlayer";
import { challenges as neverHaveChallenges } from "@/content/punishment/neverHave";

export default function NeverHavePlay() {
  return <PunishmentPlayer cards={neverHaveChallenges} sessionKey="party-night-neverhave-session-v1" backHref="/" swap={{ label: "切换到谁最可能", href: "/most-likely" }} />;
}

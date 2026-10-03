"use client";

import { useEffect, useState } from "react";
import { truthDefaults, readTruthPreferences, saveTruthPreferences, type TruthPreferences } from "@/lib/truth/storage";

export function useTruthPreferences() {
  const [preferences, setPreferences] = useState(truthDefaults);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.resolve().then(() => {
      setPreferences(readTruthPreferences());
      setReady(true);
    });
  }, []);

  function update(value: TruthPreferences) {
    setPreferences(value);
    saveTruthPreferences(value);
  }

  return { preferences, update, ready };
}
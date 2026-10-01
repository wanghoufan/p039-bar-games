"use client";

import { useEffect, useState } from "react";
import { defaults, readPreferences, savePreferences } from "@/lib/punishment/preferences";
import type { Preferences } from "@/lib/punishment/schema";

export function usePreferences() {
  const [preferences, setPreferences] = useState(defaults);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.resolve().then(() => {
      setPreferences(readPreferences());
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (!ready) return;
    const previous = document.documentElement.dataset.theme;
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const apply = () => {
      document.documentElement.dataset.theme = preferences.theme === "system"
        ? (media.matches ? "light" : "dark") : preferences.theme;
    };
    apply();
    media.addEventListener("change", apply);
    return () => {
      media.removeEventListener("change", apply);
      document.documentElement.dataset.theme = previous;
    };
  }, [preferences.theme, ready]);

  function update(value: Preferences) {
    setPreferences(value);
    savePreferences(value);
  }

  return { preferences, update, ready };
}

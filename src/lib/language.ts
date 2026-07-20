import { useEffect, useState } from "react";

export const SUPPORTED_LANGUAGES = [
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "it", label: "Italiano", flag: "🇮🇹" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "pt", label: "Português", flag: "🇵🇹" },
  { code: "nl", label: "Nederlands", flag: "🇳🇱" },
  { code: "tr", label: "Türkçe", flag: "🇹🇷" },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]["code"];

const STORAGE_KEY = "flatch:lang";
const EVENT = "flatch:lang-change";

function isSupported(code: string): code is LanguageCode {
  return SUPPORTED_LANGUAGES.some((l) => l.code === code);
}

/** Detects language: explicit override → device (navigator.language, from iOS/Android settings) → 'en'. */
export function detectLanguage(): LanguageCode {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored && isSupported(stored)) return stored;
  const nav = (navigator.language || "en").toLowerCase().split("-")[0];
  return isSupported(nav) ? nav : "en";
}

export function setLanguage(code: LanguageCode) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, code);
  window.dispatchEvent(new CustomEvent(EVENT, { detail: code }));
}

/** True when the user has explicitly chosen a language (vs. device default). */
export function hasExplicitLanguage(): boolean {
  if (typeof window === "undefined") return false;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return !!stored && isSupported(stored);
}

export function useLanguage(): [LanguageCode, (c: LanguageCode) => void] {
  const [lang, setLang] = useState<LanguageCode>("en");
  useEffect(() => {
    setLang(detectLanguage());
    const onChange = () => setLang(detectLanguage());
    window.addEventListener(EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);
  return [lang, (c) => setLanguage(c)];
}
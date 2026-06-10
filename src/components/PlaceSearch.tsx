import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { autocompletePlace, getPlaceDetails } from "@/lib/places.functions";
import { Loader2, MapPin, Search } from "lucide-react";

export type ResolvedPlace = {
  name: string;
  formattedAddress: string;
  city: string;
  country: string;
  lat: number | null;
  lng: number | null;
  photoName: string | null;
};

export function PlaceSearch({
  onSelect,
  placeholder = "Restaurant, Café, Ort suchen...",
}: {
  onSelect: (p: ResolvedPlace) => void;
  placeholder?: string;
}) {
  const ac = useServerFn(autocompletePlace);
  const det = useServerFn(getPlaceDetails);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Array<{ placeId: string; mainText: string; secondaryText: string }>>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const v = q.trim();
    if (v.length < 2) { setItems([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await ac({ data: { input: v } });
        setItems(r);
        setOpen(true);
      } catch { setItems([]); }
      finally { setLoading(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [q, ac]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const pick = async (placeId: string, label: string) => {
    setOpen(false);
    setQ(label);
    setLoading(true);
    try {
      const d = await det({ data: { placeId } });
      onSelect({
        name: d.name || label,
        formattedAddress: d.formattedAddress,
        city: d.city,
        country: d.country,
        lat: d.lat,
        lng: d.lng,
        photoName: d.photoName ?? null,
      });
    } catch {
      // ignore
    } finally { setLoading(false); }
  };

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => items.length && setOpen(true)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 pl-9 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          placeholder={placeholder}
          autoComplete="off"
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
      </div>
      {open && items.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-border bg-popover shadow-lg">
          {items.map((it) => (
            <li key={it.placeId}>
              <button
                type="button"
                onClick={() => pick(it.placeId, it.mainText)}
                className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-secondary"
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <div className="truncate font-medium">{it.mainText}</div>
                  {it.secondaryText && <div className="truncate text-xs text-muted-foreground">{it.secondaryText}</div>}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { autocompleteAddress, getPlaceDetails } from "@/lib/places.functions";
import { Loader2, MapPin } from "lucide-react";

export type ResolvedAddress = {
  formattedAddress: string;
  street: string;
  houseNumber: string;
  zipCode: string;
  city: string;
  country: string;
  lat: number | null;
  lng: number | null;
};

export function AddressAutocomplete({ onSelect }: { onSelect: (a: ResolvedAddress) => void }) {
  const ac = useServerFn(autocompleteAddress);
  const det = useServerFn(getPlaceDetails);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Array<{ placeId: string; description: string }>>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const v = q.trim();
    if (v.length < 3) { setItems([]); return; }
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

  const pick = async (placeId: string, description: string) => {
    setOpen(false);
    setQ(description);
    setLoading(true);
    try {
      const d = await det({ data: { placeId } });
      onSelect(d);
    } catch {
      // ignore
    } finally { setLoading(false); }
  };

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => items.length && setOpen(true)}
          className="input pl-9"
          placeholder="Search address..."
          autoComplete="off"
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
      </div>
      {open && items.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-border bg-popover shadow-lg">
          {items.map((it) => (
            <li key={it.placeId}>
              <button
                type="button"
                onClick={() => pick(it.placeId, it.description)}
                className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-secondary"
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span>{it.description}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
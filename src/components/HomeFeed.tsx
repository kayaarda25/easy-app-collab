import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createRecommendation,
  listRecommendations,
  getMyMatches,
  getAllPropertyLocations,
} from "@/lib/flatch.functions";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Heart,
  ImagePlus,
  Landmark,
  Lightbulb,
  MessageCircle,
  Plus,
  Search,
  Star,
  Trees,
  Utensils,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { PlaceSearch } from "@/components/PlaceSearch";

type RecCategory = "destination" | "bar" | "restaurant" | "sightseeing" | "other";
type FilterKey = "all" | "essen" | "kultur" | "natur" | "insider";

const FILTERS: { key: FilterKey; label: string; match: (c: RecCategory) => boolean }[] = [
  { key: "all", label: "Alle", match: () => true },
  { key: "essen", label: "Essen", match: (c) => c === "restaurant" },
  { key: "kultur", label: "Kultur", match: (c) => c === "sightseeing" },
  { key: "natur", label: "Natur", match: (c) => c === "destination" },
  { key: "insider", label: "Insider", match: (c) => c === "bar" || c === "other" },
];

const CATS: {
  key: Exclude<FilterKey, "all">;
  category: RecCategory;
  label: string;
  Icon: typeof Utensils;
  ring: string;
  bubble: string;
  plus: string;
}[] = [
  {
    key: "essen",
    category: "restaurant",
    label: "Essen",
    Icon: Utensils,
    ring: "bg-orange-50",
    bubble: "text-orange-600",
    plus: "bg-orange-500",
  },
  {
    key: "kultur",
    category: "sightseeing",
    label: "Kultur",
    Icon: Landmark,
    ring: "bg-violet-50",
    bubble: "text-violet-600",
    plus: "bg-violet-500",
  },
  {
    key: "natur",
    category: "destination",
    label: "Natur",
    Icon: Trees,
    ring: "bg-emerald-50",
    bubble: "text-emerald-600",
    plus: "bg-emerald-500",
  },
  {
    key: "insider",
    category: "other",
    label: "Insider",
    Icon: Lightbulb,
    ring: "bg-rose-50",
    bubble: "text-rose-600",
    plus: "bg-rose-500",
  },
];

function categoryToFilter(c: RecCategory): FilterKey {
  if (c === "restaurant") return "essen";
  if (c === "sightseeing") return "kultur";
  if (c === "destination") return "natur";
  return "insider";
}

function catMeta(c: RecCategory) {
  return CATS.find((x) => x.category === c) ?? CATS[3];
}

export function HomeFeed({ city }: { city?: string | null }) {
  const listFn = useServerFn(listRecommendations);
  const matchesFn = useServerFn(getMyMatches);
  const createFn = useServerFn(createRecommendation);
  const propsFn = useServerFn(getAllPropertyLocations);
  const qc = useQueryClient();

  const recs = useQuery({ queryKey: ["recommendations"], queryFn: () => listFn() });
  const matches = useQuery({ queryKey: ["matches"], queryFn: () => matchesFn() });
  const properties = useQuery({ queryKey: ["all-properties"], queryFn: () => propsFn() });

  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState(city ?? "");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draftCat, setDraftCat] = useState<RecCategory>("restaurant");
  const [form, setForm] = useState({
    title: "",
    description: "",
    city: "",
    country: "",
    image_url: "",
  });
  const [uploading, setUploading] = useState(false);

  const openCreate = (c: RecCategory) => {
    setDraftCat(c);
    setForm({ title: "", description: "", city: search, country: "", image_url: "" });
    setDialogOpen(true);
  };

  const create = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          category: draftCat,
          title: form.title,
          description: form.description || null,
          city: form.city || null,
          country: form.country || null,
          image_url: form.image_url || null,
          link_url: null,
          video_url: null,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recommendations"] });
      toast.success("Tipp geteilt");
      setDialogOpen(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Fehler"),
  });

  const uploadImage = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Bild max. 10 MB");
      return;
    }
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Nicht eingeloggt");
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${u.user.id}/image-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("recommendation-media")
        .upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      const { data: signed } = await supabase.storage
        .from("recommendation-media")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      if (signed) setForm((f) => ({ ...f, image_url: signed.signedUrl }));
    } catch (e: any) {
      toast.error(e?.message ?? "Upload fehlgeschlagen");
    } finally {
      setUploading(false);
    }
  };

  const list = recs.data ?? [];
  const filteredAll = useMemo(() => {
    const q = search.trim().toLowerCase();
    return list.filter((r: any) => {
      const match = FILTERS.find((f) => f.key === filter)!.match(r.category);
      if (!match) return false;
      if (!q) return true;
      return (
        (r.city ?? "").toLowerCase().includes(q) ||
        (r.country ?? "").toLowerCase().includes(q) ||
        (r.title ?? "").toLowerCase().includes(q)
      );
    });
  }, [list, filter, search]);

  const recDestinations = list
    .filter((r: any) => r.category === "destination" && r.image_url)
    .map((r: any) => ({
      id: `rec-${r.id}`,
      image_url: r.image_url,
      title: r.title,
      city: r.city,
      country: r.country,
    }));
  const propDestinations = (properties.data ?? [])
    .map((p: any) => {
      const img = [...(p.property_images ?? [])].sort(
        (a: any, b: any) => (a.position ?? 0) - (b.position ?? 0),
      )[0]?.url;
      if (!img) return null;
      return {
        id: `prop-${p.id}`,
        image_url: img,
        title: p.title,
        city: p.city,
        country: p.country,
      };
    })
    .filter(Boolean) as any[];
  const destinations = [...recDestinations, ...propDestinations].slice(0, 12);
  const headerCity = city ?? "your city";

  return (
    <div className="space-y-8 pb-4">
      {/* Matches strip */}
      <section className="px-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Deine Matches</h3>
          <Link to="/matches" className="text-sm font-semibold text-primary">
            Alle ›
          </Link>
        </div>
        {(matches.data ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Noch keine Matches – starte mit Swipen!</p>
        ) : (
          <div className="mt-3 -mx-6 flex gap-4 overflow-x-auto px-6 pb-1">
            {(matches.data ?? []).slice(0, 12).map((m: any) => (
              <Link
                key={m.id}
                to="/chat/$matchId"
                params={{ matchId: m.id }}
                className="flex w-20 flex-shrink-0 flex-col items-center"
              >
                <div className="relative">
                  <div className="h-[72px] w-[72px] overflow-hidden rounded-full bg-gradient-to-br from-primary/20 to-accent ring-2 ring-primary/60 ring-offset-2 ring-offset-background">
                    {m.other_user?.avatar_url && (
                      <img
                        src={m.other_user.avatar_url}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    )}
                  </div>
                  {m.ready_to_switch && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow">
                      Ready
                    </span>
                  )}
                </div>
                <p className="mt-2 truncate text-sm font-semibold leading-tight">
                  {m.other_user?.display_name ?? "User"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {m.their_property?.city ?? ""}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Things to do */}
      <section className="px-6">
        <h3 className="text-xl font-bold">Things to do in {headerCity}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Entdecke Lieblingsorte von anderen Reisenden.
        </p>
        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Stadt eingeben..."
            className="h-12 w-full rounded-full border border-border bg-background pl-11 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {/* Share tips card */}
        <div className="mt-4 rounded-3xl border border-border bg-gradient-to-br from-muted/40 to-background p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary to-orange-400 text-primary-foreground shadow">
              <Plus className="h-6 w-6" />
            </div>
            <div>
              <p className="text-base font-semibold">Teile deine Geheimtipps</p>
              <p className="text-xs text-muted-foreground">Wähle eine Kategorie aus</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-3">
            {CATS.map((c) => (
              <button
                key={c.key}
                onClick={() => openCreate(c.category)}
                className="group relative flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-card p-3 transition active:scale-95"
              >
                <span
                  className={`absolute -top-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full text-white shadow ${c.plus}`}
                >
                  <Plus className="h-3.5 w-3.5" />
                </span>
                <span className={`flex h-10 w-10 items-center justify-center rounded-full ${c.ring} ${c.bubble}`}>
                  <c.Icon className="h-5 w-5" />
                </span>
                <span className="text-xs font-semibold">{c.label}</span>
              </button>
            ))}
          </div>
          <button
            onClick={() => openCreate("restaurant")}
            className="mt-4 flex w-full items-center gap-2 rounded-2xl bg-orange-50 px-4 py-3 text-left text-sm font-semibold text-orange-700"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-500 text-white">
              <Plus className="h-4 w-4" />
            </span>
            Klicke auf eine Kategorie um deinen Tipp hinzuzufügen
          </button>
        </div>

        {/* Filter pills */}
        <div className="mt-5 -mx-6 flex gap-2 overflow-x-auto px-6 pb-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`shrink-0 rounded-full px-5 py-2 text-sm font-semibold transition ${
                filter === f.key
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-background text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Tips grid */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          {filteredAll.slice(0, 8).map((r: any) => {
            const meta = catMeta(r.category);
            return (
              <article key={r.id} className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="relative aspect-[4/3] w-full bg-muted">
                  {r.image_url ? (
                    <img src={r.image_url} alt={r.title} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className={`flex h-full w-full items-center justify-center ${meta.ring} ${meta.bubble}`}>
                      <meta.Icon className="h-10 w-10" />
                    </div>
                  )}
                  <span className={`absolute left-2 top-2 flex h-8 w-8 items-center justify-center rounded-full text-white shadow ${meta.plus}`}>
                    <meta.Icon className="h-4 w-4" />
                  </span>
                  <button className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-foreground shadow">
                    <Heart className="h-4 w-4" />
                  </button>
                  <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-xs font-bold text-foreground shadow">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    4.9
                  </span>
                </div>
                <div className="p-3">
                  <p className="line-clamp-1 text-sm font-bold">{r.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {r.description ?? "—"}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
        {filteredAll.length === 0 && (
          <p className="mt-4 rounded-2xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
            Keine Tipps gefunden.
          </p>
        )}
      </section>

      {/* Community feed */}
      <section className="px-6">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-xl font-bold leading-tight">Community-<br />Empfehlungen</h3>
          <button
            onClick={() => openCreate("restaurant")}
            className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow"
          >
            <Plus className="h-4 w-4" /> Tipp hinzufügen
          </button>
        </div>
        <div className="mt-4 space-y-4">
          {filteredAll.slice(0, 6).map((r: any) => {
            const meta = catMeta(r.category);
            const fromMatch = (matches.data ?? []).some((m: any) => m.other_user?.id === r.user_id);
            return (
              <article key={`feed-${r.id}`} className="overflow-hidden rounded-3xl border border-border bg-card">
                <div className="flex items-center justify-between px-4 pt-4">
                  <div className="flex items-center gap-3">
                    {r.author?.avatar_url ? (
                      <img src={r.author.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/30 to-accent" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-bold">{r.author?.display_name ?? "Traveler"}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {r.author?.display_name ?? "Traveler"}'s Tipp: {r.title}
                      </p>
                    </div>
                  </div>
                  <span className={`flex h-9 w-9 items-center justify-center rounded-full ${meta.ring} ${meta.bubble}`}>
                    <meta.Icon className="h-4 w-4" />
                  </span>
                </div>
                {r.image_url && (
                  <div className="relative mt-3">
                    <img src={r.image_url} alt={r.title} className="aspect-[16/10] w-full object-cover" loading="lazy" />
                    {fromMatch && (
                      <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground shadow">
                        <MessageCircle className="h-3 w-3" /> Von Match
                      </span>
                    )}
                  </div>
                )}
                <div className="px-4 py-4">
                  <p className="text-base font-bold">{r.title}</p>
                  {r.description && (
                    <p className="mt-1 text-sm text-muted-foreground">{r.description}</p>
                  )}
                  <div className="mt-3 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-sm font-semibold">
                      <Star className="h-4 w-4 fill-amber-400 text-amber-400" /> 4.9
                    </span>
                    <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
                      #{categoryToFilter(r.category)}
                    </span>
                    {r.city && (
                      <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">#{r.city}</span>
                    )}
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                      <Heart className="h-4 w-4" /> 0
                    </span>
                    {r.link_url ? (
                      <a
                        href={r.link_url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full border border-primary px-4 py-2 text-sm font-semibold text-primary"
                      >
                        Mehr erfahren
                      </a>
                    ) : (
                      <button className="rounded-full border border-primary px-4 py-2 text-sm font-semibold text-primary">
                        Mehr erfahren
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
          {filteredAll.length === 0 && (
            <p className="rounded-2xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
              Noch keine Empfehlungen.
            </p>
          )}
        </div>
      </section>

      {/* Recommended destinations */}
      <section className="px-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold">Empfohlene Ziele</h3>
            <button className="text-sm font-semibold text-primary">Alle ›</button>
          </div>
        {destinations.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
            Noch keine Ziele verfügbar.
          </p>
        ) : (
          <div className="mt-3 -mx-6 flex gap-4 overflow-x-auto px-6 pb-2">
            {destinations.map((d: any) => (
              <div
                key={`dest-${d.id}`}
                className="relative h-56 w-64 flex-shrink-0 overflow-hidden rounded-3xl bg-muted"
              >
                <img src={d.image_url} alt={d.title} className="h-full w-full object-cover" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <div className="absolute bottom-4 left-4 text-white">
                  <p className="text-xl font-bold leading-tight">{d.city ?? d.title}</p>
                  {d.country && <p className="text-sm opacity-90">{d.country}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Add Tip Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tipp teilen · {catMeta(draftCat).label}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!form.title.trim()) {
                toast.error("Titel erforderlich");
                return;
              }
              create.mutate();
            }}
            className="space-y-3"
          >
            <div>
              <Label>Ort suchen (Google Maps)</Label>
              <div className="mt-1">
                <PlaceSearch
                  onSelect={(p) => {
                    setForm((f) => ({
                      ...f,
                      title: f.title || p.name,
                      city: p.city || f.city,
                      country: p.country || f.country,
                    }));
                  }}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Restaurant, Bar oder Ort eingeben — Titel & Ort werden automatisch ausgefüllt.</p>
            </div>
            <div>
              <Label>Titel</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                maxLength={120}
                placeholder="z. B. Sonnenuntergang-Rooftop"
              />
            </div>
            <div>
              <Label>Beschreibung</Label>
              <Textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                maxLength={1000}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Stadt</Label>
                <Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
              </div>
              <div>
                <Label>Land</Label>
                <Input value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Foto</Label>
              {form.image_url ? (
                <div className="relative mt-1 overflow-hidden rounded-xl border border-border">
                  <img src={form.image_url} alt="" className="h-40 w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, image_url: "" }))}
                    className="absolute right-2 top-2 rounded-full bg-background/90 p-1 shadow"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <label className="mt-1 flex h-24 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-sm text-muted-foreground">
                  <ImagePlus className="h-5 w-5" />
                  {uploading ? "Lädt..." : "Foto auswählen"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (f) uploadImage(f);
                    }}
                  />
                </label>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={create.isPending || uploading}>
              {create.isPending ? "Teilen..." : "Teilen"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
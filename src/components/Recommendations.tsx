import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createRecommendation, deleteRecommendation, listRecommendations } from "@/lib/flatch.functions";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Beer, Camera, ImagePlus, MapPin, Plus, Star, Trash2, Utensils, Video, X } from "lucide-react";
import { toast } from "sonner";

type Category = "destination" | "bar" | "restaurant" | "sightseeing" | "other";

const categoryMeta: Record<Category, { label: string; icon: typeof Star; color: string }> = {
  destination: { label: "Destination", icon: MapPin, color: "bg-primary/10 text-primary" },
  bar: { label: "Bar", icon: Beer, color: "bg-amber-500/10 text-amber-600" },
  restaurant: { label: "Restaurant", icon: Utensils, color: "bg-rose-500/10 text-rose-600" },
  sightseeing: { label: "Sightseeing", icon: Camera, color: "bg-emerald-500/10 text-emerald-600" },
  other: { label: "Other", icon: Star, color: "bg-muted text-muted-foreground" },
};

export function Recommendations({ currentUserId }: { currentUserId?: string | null }) {
  const fetchList = useServerFn(listRecommendations);
  const createFn = useServerFn(createRecommendation);
  const deleteFn = useServerFn(deleteRecommendation);
  const qc = useQueryClient();

  const list = useQuery({ queryKey: ["recommendations"], queryFn: () => fetchList() });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    category: "destination" as Category,
    title: "",
    description: "",
    city: "",
    country: "",
    image_url: "",
    link_url: "",
    video_url: "",
  });
  const [uploading, setUploading] = useState<"image" | "video" | null>(null);

  const resetForm = () =>
    setForm({
      category: "destination",
      title: "",
      description: "",
      city: "",
      country: "",
      image_url: "",
      link_url: "",
      video_url: "",
    });

  const uploadMedia = async (
    file: File,
    kind: "image" | "video",
  ): Promise<string | null> => {
    const limits = { image: 10, video: 50 };
    if (file.size > limits[kind] * 1024 * 1024) {
      toast.error(`${kind === "image" ? "Image" : "Video"} must be under ${limits[kind]} MB`);
      return null;
    }
    setUploading(kind);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const ext = file.name.split(".").pop()?.toLowerCase() || (kind === "image" ? "jpg" : "mp4");
      const path = `${u.user.id}/${kind}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("recommendation-media")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (upErr) throw upErr;
      const { data: signed, error: sErr } = await supabase.storage
        .from("recommendation-media")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      if (sErr || !signed) throw sErr ?? new Error("Failed to sign URL");
      return signed.signedUrl;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
      return null;
    } finally {
      setUploading(null);
    }
  };

  const create = useMutation({
    mutationFn: (input: typeof form) =>
      createFn({
        data: {
          category: input.category,
          title: input.title,
          description: input.description || null,
          city: input.city || null,
          country: input.country || null,
          image_url: input.image_url || null,
          link_url: input.link_url || null,
          video_url: input.video_url || null,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recommendations"] });
      toast.success("Recommendation shared");
      setOpen(false);
      resetForm();
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not create"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recommendations"] }),
  });

  return (
    <section className="mt-8 px-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Community recommendations</h3>
          <p className="text-xs text-muted-foreground">Tips from other travelers</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <button className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold">
              <Plus className="h-3.5 w-3.5" /> Share
            </button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Share a recommendation</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!form.title.trim()) {
                  toast.error("Title is required");
                  return;
                }
                create.mutate(form);
              }}
              className="space-y-3"
            >
              <div>
                <Label>Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm((f) => ({ ...f, category: v as Category }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(categoryMeta) as Category[]).map((c) => (
                      <SelectItem key={c} value={c}>
                        {categoryMeta[c].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Title</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Sunset rooftop in Lisbon"
                  maxLength={120}
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Why do you love it?"
                  maxLength={1000}
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>City</Label>
                  <Input
                    value={form.city}
                    onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Country</Label>
                  <Input
                    value={form.country}
                    onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <Label>Photo (optional)</Label>
                {form.image_url ? (
                  <div className="relative mt-1 overflow-hidden rounded-xl border border-border">
                    <img src={form.image_url} alt="" className="h-40 w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, image_url: "" }))}
                      className="absolute right-2 top-2 rounded-full bg-background/90 p-1 shadow"
                      aria-label="Remove photo"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <label className="mt-1 flex h-24 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-sm text-muted-foreground hover:bg-muted/50">
                    <ImagePlus className="h-5 w-5" />
                    {uploading === "image" ? "Uploading..." : "Choose from gallery"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploading !== null}
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (!f) return;
                        const url = await uploadMedia(f, "image");
                        if (url) setForm((s) => ({ ...s, image_url: url }));
                      }}
                    />
                  </label>
                )}
              </div>
              <div>
                <Label>Video (optional)</Label>
                {form.video_url ? (
                  <div className="relative mt-1 overflow-hidden rounded-xl border border-border">
                    <video src={form.video_url} controls className="h-40 w-full bg-black object-cover" />
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, video_url: "" }))}
                      className="absolute right-2 top-2 rounded-full bg-background/90 p-1 shadow"
                      aria-label="Remove video"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <label className="mt-1 flex h-24 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-sm text-muted-foreground hover:bg-muted/50">
                    <Video className="h-5 w-5" />
                    {uploading === "video" ? "Uploading..." : "Choose video from gallery"}
                    <input
                      type="file"
                      accept="video/*"
                      className="hidden"
                      disabled={uploading !== null}
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (!f) return;
                        const url = await uploadMedia(f, "video");
                        if (url) setForm((s) => ({ ...s, video_url: url }));
                      }}
                    />
                  </label>
                )}
              </div>
              <div>
                <Label>Link (optional)</Label>
                <Input
                  type="url"
                  value={form.link_url}
                  onChange={(e) => setForm((f) => ({ ...f, link_url: e.target.value }))}
                  placeholder="https://..."
                />
              </div>
              <Button type="submit" className="w-full" disabled={create.isPending || uploading !== null}>
                {create.isPending ? "Sharing..." : uploading ? "Uploading media..." : "Share"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {list.isLoading ? (
        <div className="mt-3 h-32 animate-pulse rounded-2xl bg-muted" />
      ) : (list.data ?? []).length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No recommendations yet. Be the first to share one!
        </p>
      ) : (
        <div className="mt-3 flex gap-3 overflow-x-auto pb-2 -mx-6 px-6 snap-x">
          {(list.data ?? []).map((r: any) => {
            const meta = categoryMeta[r.category as Category] ?? categoryMeta.other;
            const Icon = meta.icon;
            const isMine = currentUserId && r.user_id === currentUserId;
            return (
              <article
                key={r.id}
                className="w-64 flex-shrink-0 snap-start overflow-hidden rounded-2xl border border-border bg-card"
              >
                {r.video_url ? (
                  <video
                    src={r.video_url}
                    className="h-32 w-full bg-black object-cover"
                    controls
                    playsInline
                    preload="metadata"
                    poster={r.image_url ?? undefined}
                  />
                ) : r.image_url ? (
                  <div className="h-32 w-full overflow-hidden bg-muted">
                    <img
                      src={r.image_url}
                      alt={r.title}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <div className={`flex h-32 w-full items-center justify-center ${meta.color}`}>
                    <Icon className="h-10 w-10" />
                  </div>
                )}
                <div className="p-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.color}`}
                    >
                      <Icon className="h-3 w-3" /> {meta.label}
                    </span>
                    {(r.city || r.country) && (
                      <span className="truncate text-[10px] text-muted-foreground">
                        {[r.city, r.country].filter(Boolean).join(", ")}
                      </span>
                    )}
                  </div>
                  <h4 className="mt-1.5 truncate text-sm font-semibold">{r.title}</h4>
                  {r.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {r.description}
                    </p>
                  )}
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {r.author?.avatar_url ? (
                        <img
                          src={r.author.avatar_url}
                          alt=""
                          className="h-5 w-5 rounded-full object-cover"
                        />
                      ) : (
                        <div className="h-5 w-5 rounded-full bg-muted" />
                      )}
                      <span className="truncate text-[11px] text-muted-foreground">
                        {r.author?.display_name ?? "Traveler"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {r.link_url && (
                        <a
                          href={r.link_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] font-semibold text-primary"
                        >
                          Visit
                        </a>
                      )}
                      {isMine && (
                        <button
                          onClick={() => remove.mutate(r.id)}
                          className="text-muted-foreground hover:text-destructive"
                          aria-label="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
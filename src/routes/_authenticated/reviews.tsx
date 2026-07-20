import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Home, Star, User } from "lucide-react";
import { toast } from "sonner";
import { createReview, getReviewableProposals } from "@/lib/flatch.functions";

export const Route = createFileRoute("/_authenticated/reviews")({
  head: () => ({ meta: [{ title: "Bewertungen — flatch." }] }),
  component: ReviewsPage,
});

function ReviewsPage() {
  const listFn = useServerFn(getReviewableProposals);
  const q = useQuery({ queryKey: ["reviewable"], queryFn: () => listFn() });
  const items = (q.data ?? []) as any[];

  const pending = items.filter((p) => !p.already_reviewed || (p.stayed_at && !p.property_reviewed));
  const done = items.filter((p) => p.already_reviewed && (!p.stayed_at || p.property_reviewed));

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <Link to="/home" className="rounded-full p-1.5 hover:bg-secondary"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="text-lg font-bold">Bewertungen</h1>
      </header>

      <div className="px-4 pt-4">
        <p className="text-sm text-muted-foreground">
          Bewerte nach dem Check-out die Person und die Liegenschaft, in der du gewohnt hast.
        </p>
      </div>

      {q.isLoading ? (
        <p className="mt-8 text-center text-sm text-muted-foreground">Lädt…</p>
      ) : pending.length === 0 ? (
        <p className="mt-8 px-4 text-center text-sm text-muted-foreground">
          Zurzeit gibt es nichts zu bewerten.
        </p>
      ) : (
        <div className="space-y-4 px-4 pt-4">
          {pending.map((p) => (
            <ProposalReviewBlock key={p.id} proposal={p} onDone={() => q.refetch()} />
          ))}
        </div>
      )}

      {done.length > 0 && (
        <div className="mt-8 px-4">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Erledigt</h2>
          <div className="space-y-2">
            {done.map((p) => (
              <div key={p.id} className="rounded-xl border border-border bg-background/50 p-3 text-sm">
                <p className="font-medium">{p.other_user?.display_name ?? "User"}</p>
                <p className="text-xs text-muted-foreground">{p.start_date} → {p.end_date}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ProposalReviewBlock({ proposal, onDone }: { proposal: any; onDone: () => void }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-1 text-xs text-muted-foreground">
        {proposal.start_date} → {proposal.end_date}
      </div>
      {!proposal.already_reviewed && (
        <ReviewForm
          proposalId={proposal.id}
          kind="person"
          title={`Person bewerten: ${proposal.other_user?.display_name ?? "User"}`}
          avatarUrl={proposal.other_user?.avatar_url}
          onDone={onDone}
        />
      )}
      {proposal.stayed_at && !proposal.property_reviewed && (
        <ReviewForm
          proposalId={proposal.id}
          kind="property"
          propertyId={proposal.stayed_at.id}
          title={`Liegenschaft bewerten: ${proposal.stayed_at.title ?? "Home"}`}
          subtitle={[proposal.stayed_at.city, proposal.stayed_at.country].filter(Boolean).join(", ")}
          imageUrl={proposal.stayed_at.image_url}
          onDone={onDone}
        />
      )}
    </div>
  );
}

function ReviewForm({
  proposalId,
  propertyId,
  kind,
  title,
  subtitle,
  avatarUrl,
  imageUrl,
  onDone,
}: {
  proposalId: string;
  propertyId?: string;
  kind: "person" | "property";
  title: string;
  subtitle?: string;
  avatarUrl?: string | null;
  imageUrl?: string | null;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const createFn = useServerFn(createReview);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [priv, setPriv] = useState("");

  const submit = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          proposal_id: proposalId,
          property_id: propertyId,
          rating,
          comment: comment.trim() || null,
          private_feedback: priv.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success("Bewertung gespeichert");
      qc.invalidateQueries({ queryKey: ["reviewable"] });
      onDone();
    },
    onError: (e: any) => toast.error(String(e?.message ?? e)),
  });

  return (
    <div className="mt-3 rounded-xl border border-border/60 bg-background/40 p-3">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-primary/20 to-accent">
          {kind === "person" && avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : kind === "property" && imageUrl ? (
            <img src={imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              {kind === "person" ? <User className="h-4 w-4" /> : <Home className="h-4 w-4" />}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{title}</p>
          {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            className="rounded-full p-1"
            aria-label={`${n} Sterne`}
          >
            <Star
              className={`h-6 w-6 ${n <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`}
            />
          </button>
        ))}
      </div>

      <textarea
        rows={3}
        maxLength={1000}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder={kind === "person" ? "Wie war es mit dieser Person?" : "Wie war die Liegenschaft?"}
        className="input mt-3 resize-none"
      />
      <textarea
        rows={2}
        maxLength={1000}
        value={priv}
        onChange={(e) => setPriv(e.target.value)}
        placeholder="Privates Feedback (nur intern sichtbar, optional)"
        className="input mt-2 resize-none text-xs"
      />

      <button
        disabled={rating === 0 || submit.isPending}
        onClick={() => submit.mutate()}
        className="mt-3 w-full rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {submit.isPending ? "Speichere…" : "Bewertung senden"}
      </button>
    </div>
  );
}
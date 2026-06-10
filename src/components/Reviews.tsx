import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createReview,
  getMyPrivateFeedback,
  getReviewableProposals,
  getReviewsForUser,
} from "@/lib/flatch.functions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Lock, Star } from "lucide-react";
import { toast } from "sonner";

function StarRow({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          style={{ width: size, height: size }}
          className={i <= Math.round(value) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}
        />
      ))}
    </div>
  );
}

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button key={i} type="button" onClick={() => onChange(i)} aria-label={`${i} stars`}>
          <Star
            className={`h-7 w-7 ${i <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`}
          />
        </button>
      ))}
    </div>
  );
}

export function ReviewsSection({ userId }: { userId: string }) {
  const fetchReviewable = useServerFn(getReviewableProposals);
  const fetchReviews = useServerFn(getReviewsForUser);
  const fetchPrivate = useServerFn(getMyPrivateFeedback);
  const submitFn = useServerFn(createReview);
  const qc = useQueryClient();

  const pending = useQuery({
    queryKey: ["reviewable-proposals"],
    queryFn: () => fetchReviewable(),
  });
  const received = useQuery({
    queryKey: ["reviews", userId],
    queryFn: () => fetchReviews({ data: { user_id: userId } }),
  });
  const privateFb = useQuery({
    queryKey: ["private-feedback"],
    queryFn: () => fetchPrivate(),
  });

  const [target, setTarget] = useState<any | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [privateText, setPrivateText] = useState("");

  const submit = useMutation({
    mutationFn: () =>
      submitFn({
        data: {
          proposal_id: target.id,
          rating,
          comment: comment.trim() || null,
          private_feedback: privateText.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success("Review submitted");
      qc.invalidateQueries({ queryKey: ["reviewable-proposals"] });
      qc.invalidateQueries({ queryKey: ["reviews"] });
      setTarget(null);
      setRating(5);
      setComment("");
      setPrivateText("");
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not submit"),
  });

  const pendingList = (pending.data ?? []).filter((p: any) => !p.already_reviewed);

  return (
    <>
      {pendingList.length > 0 && (
        <section className="mt-8 px-6">
          <h2 className="text-lg font-semibold">Rate your recent stays</h2>
          <div className="mt-3 space-y-2">
            {pendingList.map((p: any) => (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
              >
                <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-full bg-muted">
                  {p.other_user?.avatar_url && (
                    <img src={p.other_user.avatar_url} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {p.other_user?.display_name ?? "Host"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {p.start_date} → {p.end_date}
                  </p>
                </div>
                <Button size="sm" onClick={() => setTarget(p)}>
                  Review
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8 px-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Reviews</h2>
          {received.data && received.data.count > 0 && (
            <div className="flex items-center gap-1.5">
              <StarRow value={received.data.average} />
              <span className="text-sm font-semibold">{received.data.average.toFixed(1)}</span>
              <span className="text-xs text-muted-foreground">({received.data.count})</span>
            </div>
          )}
        </div>
        {received.isLoading ? (
          <div className="mt-3 h-20 animate-pulse rounded-2xl bg-muted" />
        ) : (received.data?.reviews ?? []).length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No reviews yet.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {received.data!.reviews.map((r: any) => (
              <article key={r.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 overflow-hidden rounded-full bg-muted">
                    {r.reviewer?.avatar_url && (
                      <img src={r.reviewer.avatar_url} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <p className="text-sm font-semibold">
                    {r.reviewer?.display_name ?? "Guest"}
                  </p>
                  <span className="ml-auto">
                    <StarRow value={r.rating} />
                  </span>
                </div>
                {r.comment && <p className="mt-2 text-sm text-muted-foreground">{r.comment}</p>}
              </article>
            ))}
          </div>
        )}
      </section>

      {(privateFb.data ?? []).length > 0 && (
        <section className="mt-8 px-6">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Private feedback</h2>
          </div>
          <p className="text-xs text-muted-foreground">Only visible to you</p>
          <div className="mt-3 space-y-3">
            {privateFb.data!.map((r: any) => (
              <article key={r.id} className="rounded-2xl border border-dashed border-border bg-muted/30 p-4">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold">{r.reviewer?.display_name ?? "Guest"}</p>
                  <span className="ml-auto">
                    <StarRow value={r.rating} />
                  </span>
                </div>
                <p className="mt-2 text-sm">{r.private_feedback}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Review {target?.other_user?.display_name ?? "your host"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Rating</Label>
              <div className="mt-1">
                <StarPicker value={rating} onChange={setRating} />
              </div>
            </div>
            <div>
              <Label>Public comment (optional)</Label>
              <Textarea
                rows={3}
                maxLength={1000}
                placeholder="Share your experience..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>
            <div>
              <Label className="flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" /> Private feedback (optional)
              </Label>
              <p className="text-xs text-muted-foreground">
                Only visible to {target?.other_user?.display_name ?? "the host"}.
              </p>
              <Textarea
                rows={3}
                maxLength={1000}
                placeholder="Anything they should know privately?"
                value={privateText}
                onChange={(e) => setPrivateText(e.target.value)}
              />
            </div>
            <Button
              className="w-full"
              disabled={submit.isPending}
              onClick={() => submit.mutate()}
            >
              {submit.isPending ? "Submitting..." : "Submit review"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createRecommendationComment,
  deleteRecommendationComment,
  listRecommendationComments,
  toggleRecommendationLike,
} from "@/lib/flatch.functions";
import { Heart, MessageCircle, Send, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";

export function RecommendationSocial({
  recommendationId,
  likeCount,
  commentCount,
  likedByMe,
  currentUserId,
}: {
  recommendationId: string;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  currentUserId?: string | null;
}) {
  const { t } = useT();
  const qc = useQueryClient();
  const likeFn = useServerFn(toggleRecommendationLike);
  const listFn = useServerFn(listRecommendationComments);
  const createFn = useServerFn(createRecommendationComment);
  const deleteFn = useServerFn(deleteRecommendationComment);

  const [open, setOpen] = useState(false);
  const [liked, setLiked] = useState(likedByMe);
  const [likes, setLikes] = useState(likeCount);
  const [text, setText] = useState("");

  const comments = useQuery({
    queryKey: ["recommendation-comments", recommendationId],
    queryFn: () => listFn({ data: { recommendation_id: recommendationId } }),
    enabled: open,
  });

  const toggleLike = useMutation({
    mutationFn: () => likeFn({ data: { recommendation_id: recommendationId } }),
    onMutate: () => {
      setLiked((v) => !v);
      setLikes((n) => (liked ? Math.max(0, n - 1) : n + 1));
    },
    onError: () => {
      setLiked(likedByMe);
      setLikes(likeCount);
      toast.error(t("Could not save"));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recommendations"] }),
  });

  const addComment = useMutation({
    mutationFn: (body: string) => createFn({ data: { recommendation_id: recommendationId, body } }),
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["recommendation-comments", recommendationId] });
      qc.invalidateQueries({ queryKey: ["recommendations"] });
    },
    onError: (e: any) => toast.error(e?.message ?? t("Could not save")),
  });

  const removeComment = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recommendation-comments", recommendationId] });
      qc.invalidateQueries({ queryKey: ["recommendations"] });
    },
  });

  const totalComments = comments.data ? comments.data.length : commentCount;

  return (
    <div className="mt-2">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => toggleLike.mutate()}
          className="flex items-center gap-1.5 text-sm"
          aria-label={t("Like")}
        >
          <Heart
            className={`h-5 w-5 transition-transform active:scale-90 ${
              liked ? "fill-rose-500 text-rose-500" : "text-foreground"
            }`}
          />
          <span className="font-medium">{likes}</span>
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 text-sm"
          aria-label={t("Comment")}
        >
          <MessageCircle className="h-5 w-5" />
          <span className="font-medium">{totalComments}</span>
        </button>
      </div>

      {open && (
        <div className="mt-3 space-y-3">
          {comments.isLoading ? (
            <div className="h-10 animate-pulse rounded-lg bg-muted" />
          ) : (comments.data ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("No comments yet")}</p>
          ) : (
            (comments.data ?? []).map((c: any) => (
              <div key={c.id} className="flex items-start gap-2">
                {c.author?.avatar_url ? (
                  <img src={c.author.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" />
                ) : (
                  <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary/30 to-accent" />
                )}
                <p className="min-w-0 flex-1 text-sm">
                  <span className="font-semibold">{c.author?.display_name ?? t("Traveler")}</span>{" "}
                  <span className="text-muted-foreground">{c.body}</span>
                </p>
                {currentUserId === c.user_id && (
                  <button
                    type="button"
                    onClick={() => removeComment.mutate(c.id)}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label={t("Delete")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const body = text.trim();
              if (!body) return;
              addComment.mutate(body);
            }}
            className="flex items-center gap-2"
          >
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t("Add a comment…")}
              maxLength={1000}
              className="h-9"
            />
            <button
              type="submit"
              disabled={addComment.isPending || !text.trim()}
              className="shrink-0 rounded-full bg-primary p-2 text-primary-foreground disabled:opacity-40"
              aria-label={t("Send")}
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

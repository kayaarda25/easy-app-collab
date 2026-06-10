import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ImagePlus, Mic, Paperclip, Send, Square, X, Video } from "lucide-react";
import { toast } from "sonner";

export type ChatAttachment = {
  url: string;
  kind: "image" | "video" | "audio";
  mime: string;
};

const MAX_SIZE = 25 * 1024 * 1024;

export function ChatComposer({
  onSend,
  disabled,
}: {
  onSend: (args: { body: string; attachment?: ChatAttachment }) => Promise<void> | void;
  disabled?: boolean;
}) {
  const [text, setText] = useState("");
  const [attachment, setAttachment] = useState<ChatAttachment | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  // recording
  const [recording, setRecording] = useState(false);
  const [recordSec, setRecordSec] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
  }, []);

  const uploadBlob = async (blob: Blob, ext: string, mime: string, kind: ChatAttachment["kind"]) => {
    if (blob.size > MAX_SIZE) {
      toast.error("File too large (max 25 MB)");
      return;
    }
    setUploading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Not signed in");
      const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("chat-attachments").upload(path, blob, { contentType: mime, upsert: false });
      if (upErr) throw upErr;
      const { data: signed, error: signErr } = await supabase.storage.from("chat-attachments").createSignedUrl(path, 60 * 60 * 24 * 365);
      if (signErr || !signed) throw signErr ?? new Error("Sign failed");
      setAttachment({ url: signed.signedUrl, kind, mime });
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>, kind: "image" | "video") => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const ext = f.name.split(".").pop() || (kind === "image" ? "jpg" : "mp4");
    await uploadBlob(f, ext, f.type || (kind === "image" ? "image/jpeg" : "video/mp4"), kind);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const mr = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      mr.ondataavailable = (ev) => { if (ev.data.size > 0) chunksRef.current.push(ev.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mime });
        const ext = mime.includes("webm") ? "webm" : "m4a";
        await uploadBlob(blob, ext, mime, "audio");
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
      setRecordSec(0);
      timerRef.current = window.setInterval(() => setRecordSec((s) => s + 1), 1000);
    } catch (e: any) {
      toast.error(e?.message ?? "Microphone access denied");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() && !attachment) return;
    await onSend({ body: text.trim(), attachment: attachment ?? undefined });
    setText("");
    setAttachment(null);
  };

  return (
    <form onSubmit={submit} className="border-t border-border bg-background px-3 py-2 pb-[env(safe-area-inset-bottom)]">
      {attachment && (
        <div className="mb-2 flex items-center gap-2 rounded-xl border border-border bg-card p-2">
          {attachment.kind === "image" && <img src={attachment.url} alt="" className="h-12 w-12 rounded object-cover" />}
          {attachment.kind === "video" && <video src={attachment.url} className="h-12 w-12 rounded object-cover" />}
          {attachment.kind === "audio" && <div className="flex h-12 w-12 items-center justify-center rounded bg-secondary"><Mic className="h-5 w-5" /></div>}
          <span className="flex-1 truncate text-xs text-muted-foreground">{attachment.kind} attached</span>
          <button type="button" onClick={() => setAttachment(null)} className="rounded-full p-1 hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>
      )}
      <div className="flex items-end gap-1.5">
        {!recording ? (
          <>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e, "image")} />
            <input ref={videoRef} type="file" accept="video/*" className="hidden" onChange={(e) => onFile(e, "video")} />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-secondary disabled:opacity-40" aria-label="Add photo">
              <ImagePlus className="h-5 w-5" />
            </button>
            <button type="button" onClick={() => videoRef.current?.click()} disabled={uploading} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-secondary disabled:opacity-40" aria-label="Add video">
              <Video className="h-5 w-5" />
            </button>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={uploading ? "Uploading…" : "Message…"}
              maxLength={2000}
              className="min-w-0 flex-1 rounded-full border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
            {text.trim() || attachment ? (
              <button type="submit" disabled={disabled || uploading} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40">
                <Send className="h-4 w-4" />
              </button>
            ) : (
              <button type="button" onClick={startRecording} disabled={uploading} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40" aria-label="Record voice">
                <Mic className="h-4 w-4" />
              </button>
            )}
          </>
        ) : (
          <div className="flex w-full items-center gap-3 rounded-full bg-destructive/10 px-4 py-2.5">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-destructive" />
            <span className="flex-1 text-sm font-medium text-destructive">Recording… {Math.floor(recordSec / 60)}:{String(recordSec % 60).padStart(2, "0")}</span>
            <button type="button" onClick={stopRecording} className="flex h-9 w-9 items-center justify-center rounded-full bg-destructive text-destructive-foreground" aria-label="Stop">
              <Square className="h-4 w-4 fill-current" />
            </button>
          </div>
        )}
      </div>
    </form>
  );
}
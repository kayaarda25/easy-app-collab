import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Users, X } from "lucide-react";
import {
  addBookingGuest,
  deleteBookingGuest,
  listBookingGuests,
} from "@/lib/booking-guests.functions";
import { useT } from "@/lib/i18n";

type Guest = {
  id: string;
  first_name: string;
  last_name: string;
  birthdate: string;
  id_number: string;
  id_type: string;
  note: string | null;
};

const ID_TYPES = [
  { value: "passport", label: "Reisepass" },
  { value: "id_card", label: "Personalausweis" },
  { value: "drivers_license", label: "Führerausweis" },
  { value: "other", label: "Andere" },
];

export function BookingGuestsDialog({
  proposalId,
  maxGuests,
  onClose,
}: {
  proposalId: string;
  maxGuests?: number;
  onClose: () => void;
}) {
  const { t } = useT();
  const qc = useQueryClient();
  const listFn = useServerFn(listBookingGuests);
  const addFn = useServerFn(addBookingGuest);
  const delFn = useServerFn(deleteBookingGuest);

  const key = ["booking-guests", proposalId];
  const q = useQuery({ queryKey: key, queryFn: () => listFn({ data: { proposal_id: proposalId } }) });
  const guests = (q.data ?? []) as Guest[];

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    birthdate: "",
    id_number: "",
    id_type: "passport" as Guest["id_type"],
    note: "",
  });

  const add = useMutation({
    mutationFn: () =>
      addFn({
        data: {
          proposal_id: proposalId,
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          birthdate: form.birthdate,
          id_number: form.id_number.trim(),
          id_type: form.id_type,
          note: form.note.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success(t("Gast hinzugefügt"));
      setForm({ first_name: "", last_name: "", birthdate: "", id_number: "", id_type: "passport", note: "" });
      setShowForm(false);
      qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: any) => toast.error(String(e?.message ?? e)),
  });

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success(t("Gast entfernt"));
      qc.invalidateQueries({ queryKey: key });
    },
  });

  const canSubmit =
    form.first_name.trim() &&
    form.last_name.trim() &&
    /^\d{4}-\d{2}-\d{2}$/.test(form.birthdate) &&
    form.id_number.trim().length >= 3;

  const atMax = typeof maxGuests === "number" && guests.length >= maxGuests;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-card p-6 sm:rounded-3xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold">
               <Users className="h-5 w-5" /> {t("Gäste erfassen")}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
               {t("Zusätzliche Personen für diese Buchung")} {typeof maxGuests === "number" ? `(${t("max.")} ${maxGuests})` : ""}
            </p>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-secondary"><X className="h-5 w-5" /></button>
        </div>

        {q.isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-2">
            {guests.length === 0 && !showForm && (
              <p className="rounded-xl bg-muted/50 px-3 py-4 text-center text-xs text-muted-foreground">
                 {t("Noch keine zusätzlichen Gäste erfasst.")}
              </p>
            )}
            {guests.map((g) => (
              <div key={g.id} className="flex items-start justify-between gap-3 rounded-xl border border-border bg-background/50 p-3">
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-semibold">{g.first_name} {g.last_name}</p>
                  <p className="text-xs text-muted-foreground">
                     * {g.birthdate} · {t(ID_TYPES.find((type) => type.value === g.id_type)?.label ?? g.id_type)}: {g.id_number}
                  </p>
                  {g.note && <p className="mt-1 text-xs text-muted-foreground">{g.note}</p>}
                </div>
                <button
                   onClick={() => { if (confirm(t("Gast entfernen?"))) del.mutate(g.id); }}
                  className="rounded-full p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                   aria-label={t("Entfernen")}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {showForm ? (
          <div className="mt-4 space-y-3 rounded-2xl border border-border bg-background/50 p-4">
            <div className="grid grid-cols-2 gap-3">
               <label className="block"><span className="text-xs text-muted-foreground">{t("Vorname")}</span>
                <input className="input mt-1" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} maxLength={80} />
              </label>
               <label className="block"><span className="text-xs text-muted-foreground">{t("Nachname")}</span>
                <input className="input mt-1" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} maxLength={80} />
              </label>
            </div>
             <label className="block"><span className="text-xs text-muted-foreground">{t("Geburtsdatum")}</span>
              <input type="date" className="input mt-1" value={form.birthdate} onChange={(e) => setForm({ ...form, birthdate: e.target.value })} />
            </label>
            <div className="grid grid-cols-2 gap-3">
               <label className="block"><span className="text-xs text-muted-foreground">{t("Dokument")}</span>
                <select className="input mt-1" value={form.id_type} onChange={(e) => setForm({ ...form, id_type: e.target.value as Guest["id_type"] })}>
                   {ID_TYPES.map((type) => <option key={type.value} value={type.value}>{t(type.label)}</option>)}
                </select>
              </label>
               <label className="block"><span className="text-xs text-muted-foreground">{t("Dokument-Nr.")}</span>
                <input className="input mt-1" value={form.id_number} onChange={(e) => setForm({ ...form, id_number: e.target.value })} maxLength={60} />
              </label>
            </div>
             <label className="block"><span className="text-xs text-muted-foreground">{t("Notiz (optional)")}</span>
              <input className="input mt-1" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} maxLength={300} />
            </label>
            <div className="flex gap-2 pt-1">
               <button onClick={() => setShowForm(false)} className="flex-1 rounded-full border border-border px-4 py-2.5 text-sm font-semibold">{t("Abbrechen")}</button>
              <button
                disabled={!canSubmit || add.isPending}
                onClick={() => add.mutate()}
                className="flex-1 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              >
                 {add.isPending ? t("Speichern…") : t("Speichern")}
              </button>
            </div>
          </div>
        ) : (
          <button
            disabled={atMax}
            onClick={() => setShowForm(true)}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
             {atMax ? t("Max. Gäste erreicht") : t("Gast hinzufügen")}
          </button>
        )}
      </div>
    </div>
  );
}
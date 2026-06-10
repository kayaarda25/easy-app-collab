import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { createProperty } from "@/lib/flatch.functions";
import { supabase } from "@/integrations/supabase/client";
import { COUNTRIES, LOCATIONS } from "@/lib/locations";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Upload, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/property/new")({
  head: () => ({ meta: [{ title: "New home — flatch." }] }),
  component: NewPropertyPage,
});

const PROPERTY_TYPES = [
  { value: "apartment", label: "Apartment" },
  { value: "house", label: "House" },
  { value: "villa", label: "Villa" },
  { value: "cabin", label: "Cabin" },
  { value: "loft", label: "Loft" },
  { value: "other", label: "Other" },
] as const;

const AMENITIES = ["Wifi", "Kitchen", "Washer", "Parking", "Pool", "AC", "Heating", "TV", "Workspace", "Garden"];

function NewPropertyPage() {
  const navigate = useNavigate();
  const createFn = useServerFn(createProperty);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<typeof PROPERTY_TYPES[number]["value"]>("apartment");
  const [bedrooms, setBedrooms] = useState(1);
  const [beds, setBeds] = useState(1);
  const [bathrooms, setBathrooms] = useState(1);
  const [maxGuests, setMaxGuests] = useState(2);
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [street, setStreet] = useState("");
  const [houseNumber, setHouseNumber] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [amenities, setAmenities] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [houseRules, setHouseRules] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [loading, setLoading] = useState(false);

  const toggleAmenity = (a: string) => {
    setAmenities((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  };

  const onFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files ?? []).slice(0, 8);
    setFiles(list);
    setPreviews(list.map((f) => URL.createObjectURL(f)));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const created = await createFn({
        data: {
          title, description: description || null, property_type: type,
          bedrooms, beds, bathrooms, max_guests: maxGuests,
          amenities, city, country,
          street: street || null, house_number: houseNumber || null, zip_code: zipCode || null,
          house_rules: houseRules || null,
          check_in_instructions: checkIn || null,
          check_out_instructions: checkOut || null,
        },
      });

      // Upload images
      if (files.length > 0) {
        const { data: userData } = await supabase.auth.getUser();
        const uid = userData.user?.id;
        if (uid) {
          for (let i = 0; i < files.length; i++) {
            const f = files[i];
            const path = `${uid}/${created.id}/${Date.now()}-${i}-${f.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
            const { error: upErr } = await supabase.storage.from("property-images").upload(path, f, { upsert: false });
            if (upErr) { toast.error(`Image ${i + 1}: ${upErr.message}`); continue; }
            const { data: signed } = await supabase.storage.from("property-images").createSignedUrl(path, 60 * 60 * 24 * 365);
            if (signed?.signedUrl) {
              await supabase.from("property_images").insert({ property_id: created.id, url: signed.signedUrl, position: i });
            }
          }
        }
      }

      toast.success("Home listed!");
      navigate({ to: "/home" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-12">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <button onClick={() => navigate({ to: "/home" })} className="rounded-full p-1.5 hover:bg-secondary"><ArrowLeft className="h-5 w-5" /></button>
        <h1 className="text-lg font-bold">List your home</h1>
      </header>

      <form onSubmit={submit} className="mx-auto max-w-md space-y-5 px-6 py-6">
        <Field label="Title" required><input required maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} className="input" placeholder="Cozy loft near the river" /></Field>
        <Field label="Description"><textarea rows={4} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} className="input resize-none" placeholder="What makes your home special?" /></Field>

        <Field label="Property type">
          <div className="flex flex-wrap gap-2">
            {PROPERTY_TYPES.map((t) => (
              <button type="button" key={t.value} onClick={() => setType(t.value)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${type === t.value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}>{t.label}</button>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Country" required>
            <select
              required
              value={country}
              onChange={(e) => { setCountry(e.target.value); setCity(""); }}
              className="input"
            >
              <option value="">Select country</option>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="City / Region" required>
            <select
              required
              value={city}
              onChange={(e) => setCity(e.target.value)}
              disabled={!country}
              className="input disabled:opacity-50"
            >
              <option value="">{country ? "Select city" : "Select country first"}</option>
              {(LOCATIONS[country] ?? []).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="ZIP / Postal code">
          <input maxLength={20} value={zipCode} onChange={(e) => setZipCode(e.target.value)} className="input" placeholder="1000" />
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Field label="Street">
              <input maxLength={200} value={street} onChange={(e) => setStreet(e.target.value)} className="input" placeholder="Main Street" />
            </Field>
          </div>
          <div>
            <Field label="No.">
              <input maxLength={20} value={houseNumber} onChange={(e) => setHouseNumber(e.target.value)} className="input" placeholder="42" />
            </Field>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Bedrooms"><input type="number" min={0} max={20} value={bedrooms} onChange={(e) => setBedrooms(+e.target.value)} className="input" /></Field>
          <Field label="Beds"><input type="number" min={1} max={40} value={beds} onChange={(e) => setBeds(+e.target.value)} className="input" /></Field>
          <Field label="Bathrooms"><input type="number" min={0} max={20} step={0.5} value={bathrooms} onChange={(e) => setBathrooms(+e.target.value)} className="input" /></Field>
          <Field label="Max guests"><input type="number" min={1} max={40} value={maxGuests} onChange={(e) => setMaxGuests(+e.target.value)} className="input" /></Field>
        </div>

        <Field label="Amenities">
          <div className="flex flex-wrap gap-2">
            {AMENITIES.map((a) => (
              <button type="button" key={a} onClick={() => toggleAmenity(a)} className={`rounded-full border px-3 py-1.5 text-xs ${amenities.includes(a) ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}>{a}</button>
            ))}
          </div>
        </Field>

        <Field label="House rules">
          <textarea rows={3} maxLength={2000} value={houseRules} onChange={(e) => setHouseRules(e.target.value)} className="input resize-none" placeholder="No smoking, quiet hours after 22:00, pets welcome..." />
        </Field>
        <Field label="Check-in instructions">
          <textarea rows={3} maxLength={2000} value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className="input resize-none" placeholder="Lockbox code 1234 by the front door. Wifi password on the fridge." />
        </Field>
        <Field label="Check-out instructions">
          <textarea rows={3} maxLength={2000} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className="input resize-none" placeholder="Strip the bed, take trash out, leave keys on the table." />
        </Field>

        <Field label="Photos">
          <label className="flex h-32 cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-border text-sm text-muted-foreground hover:border-primary/40">
            <Upload className="mr-2 h-4 w-4" /> Choose photos
            <input type="file" accept="image/*" multiple onChange={onFiles} className="hidden" />
          </label>
          {previews.length > 0 && (
            <div className="mt-3 grid grid-cols-4 gap-2">
              {previews.map((src, i) => (
                <div key={i} className="relative aspect-square overflow-hidden rounded-lg">
                  <img src={src} className="h-full w-full object-cover" alt="" />
                  <button type="button" onClick={() => { setFiles(files.filter((_, j) => j !== i)); setPreviews(previews.filter((_, j) => j !== i)); }} className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Field>

        <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
          {loading && <Loader2 className="h-4 w-4 animate-spin" />} Publish home
        </button>
      </form>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-muted-foreground">{label}{required && <span className="text-primary"> *</span>}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
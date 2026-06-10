import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

function headers() {
  const lovable = process.env.LOVABLE_API_KEY;
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!lovable || !key) throw new Error("Google Maps connector not configured");
  return {
    Authorization: `Bearer ${lovable}`,
    "X-Connection-Api-Key": key,
    "Content-Type": "application/json",
  };
}

export const autocompleteAddress = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ input: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const res = await fetch(`${GATEWAY_URL}/places/v1/places:autocomplete`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ input: data.input, includedPrimaryTypes: ["street_address", "premise", "subpremise", "route"] }),
    });
    if (!res.ok) throw new Error(`Autocomplete failed: ${res.status}`);
    const json = await res.json() as { suggestions?: Array<{ placePrediction?: { placeId: string; text: { text: string } } }> };
    return (json.suggestions ?? [])
      .map((s) => s.placePrediction)
      .filter((p): p is { placeId: string; text: { text: string } } => !!p)
      .map((p) => ({ placeId: p.placeId, description: p.text.text }));
  });

export const getPlaceDetails = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ placeId: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const res = await fetch(`${GATEWAY_URL}/places/v1/places/${encodeURIComponent(data.placeId)}`, {
      method: "GET",
      headers: { ...headers(), "X-Goog-FieldMask": "id,formattedAddress,addressComponents,location" },
    });
    if (!res.ok) throw new Error(`Place details failed: ${res.status}`);
    const json = await res.json() as {
      formattedAddress?: string;
      addressComponents?: Array<{ longText: string; shortText: string; types: string[] }>;
      location?: { latitude: number; longitude: number };
    };
    const comps = json.addressComponents ?? [];
    const find = (t: string) => comps.find((c) => c.types.includes(t));
    return {
      formattedAddress: json.formattedAddress ?? "",
      street: find("route")?.longText ?? "",
      houseNumber: find("street_number")?.longText ?? "",
      zipCode: find("postal_code")?.longText ?? "",
      city: find("locality")?.longText ?? find("postal_town")?.longText ?? find("administrative_area_level_2")?.longText ?? "",
      country: find("country")?.longText ?? "",
      lat: json.location?.latitude ?? null,
      lng: json.location?.longitude ?? null,
    };
  });
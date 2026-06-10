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

export const autocompletePlace = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ input: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const res = await fetch(`${GATEWAY_URL}/places/v1/places:autocomplete`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ input: data.input }),
    });
    if (!res.ok) throw new Error(`Autocomplete failed: ${res.status}`);
    const json = await res.json() as {
      suggestions?: Array<{
        placePrediction?: {
          placeId: string;
          text: { text: string };
          structuredFormat?: { mainText?: { text: string }; secondaryText?: { text: string } };
        };
      }>;
    };
    return (json.suggestions ?? [])
      .map((s) => s.placePrediction)
      .filter((p): p is NonNullable<typeof p> => !!p)
      .map((p) => ({
        placeId: p.placeId,
        description: p.text.text,
        mainText: p.structuredFormat?.mainText?.text ?? p.text.text,
        secondaryText: p.structuredFormat?.secondaryText?.text ?? "",
      }));
  });

export const getPlaceDetails = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ placeId: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const res = await fetch(`${GATEWAY_URL}/places/v1/places/${encodeURIComponent(data.placeId)}`, {
      method: "GET",
      headers: { ...headers(), "X-Goog-FieldMask": "id,displayName,formattedAddress,addressComponents,location,photos" },
    });
    if (!res.ok) throw new Error(`Place details failed: ${res.status}`);
    const json = await res.json() as {
      displayName?: { text: string };
      formattedAddress?: string;
      addressComponents?: Array<{ longText: string; shortText: string; types: string[] }>;
      location?: { latitude: number; longitude: number };
      photos?: Array<{ name: string; widthPx?: number; heightPx?: number }>;
    };
    const comps = json.addressComponents ?? [];
    const find = (t: string) => comps.find((c) => c.types.includes(t));
    return {
      name: json.displayName?.text ?? "",
      formattedAddress: json.formattedAddress ?? "",
      street: find("route")?.longText ?? "",
      houseNumber: find("street_number")?.longText ?? "",
      zipCode: find("postal_code")?.longText ?? "",
      city: find("locality")?.longText ?? find("postal_town")?.longText ?? find("administrative_area_level_2")?.longText ?? "",
      country: find("country")?.longText ?? "",
      lat: json.location?.latitude ?? null,
      lng: json.location?.longitude ?? null,
      photoName: json.photos?.[0]?.name ?? null,
    };
  });

export const getPlacePhotoUrl = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ photoName: z.string().min(1).max(500), maxWidthPx: z.number().min(100).max(4800).optional() }).parse(d))
  .handler(async ({ data }) => {
    const w = data.maxWidthPx ?? 1200;
    const res = await fetch(`${GATEWAY_URL}/places/v1/${data.photoName}/media?maxWidthPx=${w}&skipHttpRedirect=true`, {
      headers: headers(),
    });
    if (!res.ok) throw new Error(`Photo failed: ${res.status}`);
    const json = await res.json() as { photoUri?: string; name?: string };
    return { photoUri: json.photoUri ?? null };
  });
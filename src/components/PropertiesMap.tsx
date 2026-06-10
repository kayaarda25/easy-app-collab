import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

type PropertyPoint = {
  id: string;
  title: string;
  city: string;
  country: string;
  street?: string | null;
  house_number?: string | null;
  zip_code?: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  property_images?: { url: string; position: number }[];
};

declare global {
  interface Window {
    google?: any;
    __flatchInitMap?: () => void;
  }
}

let mapsLoader: Promise<void> | null = null;
function loadGoogleMaps(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.maps) return Promise.resolve();
  if (mapsLoader) return mapsLoader;
  const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
  const channel = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;
  mapsLoader = new Promise<void>((resolve, reject) => {
    window.__flatchInitMap = () => resolve();
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=__flatchInitMap${channel ? `&channel=${channel}` : ""}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });
  return mapsLoader;
}

export function PropertiesMap({
  points,
  style,
}: {
  points: PropertyPoint[];
  style?: CSSProperties;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = points
    .map((p) => ({
      ...p,
      lat: typeof p.latitude === "string" ? parseFloat(p.latitude) : p.latitude,
      lng: typeof p.longitude === "string" ? parseFloat(p.longitude) : p.longitude,
    }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)) as Array<
      PropertyPoint & { lat: number; lng: number }
    >;

  useEffect(() => {
    loadGoogleMaps()
      .then(() => setReady(true))
      .catch((e) => setError(e.message ?? "Failed to load map"));
  }, []);

  useEffect(() => {
    if (!ready || !containerRef.current || !window.google?.maps) return;
    const google = window.google;
    const center =
      valid.length > 0 ? { lat: valid[0].lat, lng: valid[0].lng } : { lat: 48.137, lng: 11.575 };

    if (!mapRef.current) {
      mapRef.current = new google.maps.Map(containerRef.current, {
        center,
        zoom: valid.length > 0 ? 12 : 2,
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: "greedy",
      });
    }

    // Clear previous markers
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const bounds = new google.maps.LatLngBounds();
    valid.forEach((p) => {
      const pos = { lat: p.lat, lng: p.lng };
      const marker = new google.maps.Marker({
        position: pos,
        map: mapRef.current,
        title: p.title,
      });
      const addr = [
        [p.street, p.house_number].filter(Boolean).join(" "),
        [p.zip_code, p.city].filter(Boolean).join(" "),
        p.country,
      ]
        .filter(Boolean)
        .join(", ");
      const info = new google.maps.InfoWindow({
        content: `<div style="font-family:inherit"><strong>${escapeHtml(p.title)}</strong><br/><span style="font-size:12px;color:#666">${escapeHtml(addr || `${p.city}, ${p.country}`)}</span></div>`,
      });
      marker.addListener("click", () => info.open({ anchor: marker, map: mapRef.current }));
      markersRef.current.push(marker);
      bounds.extend(pos);
    });

    if (valid.length > 1) {
      mapRef.current.fitBounds(bounds, 48);
    } else if (valid.length === 1) {
      mapRef.current.setCenter({ lat: valid[0].lat, lng: valid[0].lng });
      mapRef.current.setZoom(13);
    }
  }, [ready, valid]);

  if (error) {
    return (
      <div
        className="flex h-full w-full items-center justify-center rounded-2xl bg-muted text-xs text-muted-foreground"
        style={style}
      >
        {error}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border" style={style}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
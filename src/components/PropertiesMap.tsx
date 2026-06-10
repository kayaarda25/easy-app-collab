import { useEffect, useState } from "react";
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

export function PropertiesMap({
  points,
  style,
}: {
  points: PropertyPoint[];
  style?: CSSProperties;
}) {
  const [mod, setMod] = useState<null | {
    MapContainer: any;
    TileLayer: any;
    Marker: any;
    Popup: any;
    icon: any;
  }>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const [rl, L] = await Promise.all([
        import("react-leaflet"),
        import("leaflet"),
      ]);
      await import("leaflet/dist/leaflet.css");
      const icon = L.icon({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      });
      if (active) {
        setMod({
          MapContainer: rl.MapContainer,
          TileLayer: rl.TileLayer,
          Marker: rl.Marker,
          Popup: rl.Popup,
          icon,
        });
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const valid = points
    .map((p) => ({
      ...p,
      lat: typeof p.latitude === "string" ? parseFloat(p.latitude) : p.latitude,
      lng: typeof p.longitude === "string" ? parseFloat(p.longitude) : p.longitude,
    }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)) as Array<
      PropertyPoint & { lat: number; lng: number }
    >;

  if (!mod) {
    return (
      <div
        className="flex h-full w-full items-center justify-center rounded-2xl bg-muted text-xs text-muted-foreground"
        style={style}
      >
        Loading map…
      </div>
    );
  }

  const { MapContainer, TileLayer, Marker, Popup, icon } = mod;
  const center: [number, number] =
    valid.length > 0 ? [valid[0].lat, valid[0].lng] : [48.137, 11.575]; // fallback: Munich

  return (
    <div className="overflow-hidden rounded-2xl border border-border" style={style}>
      <MapContainer
        center={center}
        zoom={valid.length > 0 ? 4 : 2}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {valid.map((p) => {
          const addr = [
            [p.street, p.house_number].filter(Boolean).join(" "),
            [p.zip_code, p.city].filter(Boolean).join(" "),
            p.country,
          ]
            .filter(Boolean)
            .join(", ");
          return (
            <Marker key={p.id} position={[p.lat, p.lng]} icon={icon}>
              <Popup>
                <div className="space-y-1">
                  <p className="font-semibold">{p.title}</p>
                  <p className="text-xs text-muted-foreground">{addr || `${p.city}, ${p.country}`}</p>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
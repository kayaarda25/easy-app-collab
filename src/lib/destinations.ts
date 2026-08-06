export type Destination = {
  id: string;
  city: string;
  country: string;
  image: string;
};

const u = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&q=70`;

// Hauptstädte & beliebte Ferienorte
export const FEATURED_DESTINATIONS: Destination[] = [
  { id: "paris", city: "Paris", country: "Frankreich", image: u("photo-1502602898657-3e91760cbb34") },
  { id: "barcelona", city: "Barcelona", country: "Spanien", image: u("photo-1523906834658-6e24ef2386f9") },
  { id: "rom", city: "Rom", country: "Italien", image: u("photo-1552832230-c0197dd311b5") },
  { id: "london", city: "London", country: "Vereinigtes Königreich", image: u("photo-1513635269975-59663e0ac1ad") },
  { id: "amsterdam", city: "Amsterdam", country: "Niederlande", image: u("photo-1512453979798-5ea266f8880c") },
  { id: "lissabon", city: "Lissabon", country: "Portugal", image: u("photo-1526481280693-3bfa7568e0f3") },
  { id: "wien", city: "Wien", country: "Österreich", image: u("photo-1516483638261-f4dbaf036963") },
  { id: "berlin", city: "Berlin", country: "Deutschland", image: u("photo-1467269204594-9661b134dd2b") },
  { id: "zuerich", city: "Zürich", country: "Schweiz", image: u("photo-1541849546-216549ae216d") },
  { id: "kopenhagen", city: "Kopenhagen", country: "Dänemark", image: u("photo-1533929736458-ca588d08c8be") },
  { id: "athen", city: "Athen", country: "Griechenland", image: u("photo-1503152394-c571994fd383") },
  { id: "prag", city: "Prag", country: "Tschechien", image: u("photo-1519677100203-a0e668c92439") },
  { id: "mallorca", city: "Palma de Mallorca", country: "Spanien", image: u("photo-1518684079-3c830dcef090") },
  { id: "nizza", city: "Nizza", country: "Frankreich", image: u("photo-1505993597083-3bd19fb75e57") },
  { id: "santorin", city: "Santorin", country: "Griechenland", image: u("photo-1499856871958-5b9627545d1a") },
  { id: "newyork", city: "New York", country: "USA", image: u("photo-1538332576228-eb5b4c4de6f5") },
];

// Countries with their cities/regions for property listing
export const LOCATIONS: Record<string, string[]> = {
  "Schweiz": [
    "Aargau", "Appenzell Ausserrhoden", "Appenzell Innerrhoden", "Basel-Landschaft",
    "Basel-Stadt", "Bern", "Freiburg", "Genf", "Glarus", "Graubünden", "Jura",
    "Luzern", "Neuenburg", "Nidwalden", "Obwalden", "Schaffhausen", "Schwyz",
    "Solothurn", "St. Gallen", "Tessin", "Thurgau", "Uri", "Waadt", "Wallis",
    "Zug", "Zürich",
  ],
  "Deutschland": [
    "Berlin", "Hamburg", "München", "Köln", "Frankfurt am Main", "Stuttgart",
    "Düsseldorf", "Leipzig", "Dortmund", "Essen", "Bremen", "Dresden", "Hannover",
    "Nürnberg", "Duisburg", "Bochum", "Wuppertal", "Bielefeld", "Bonn", "Münster",
    "Karlsruhe", "Mannheim", "Augsburg", "Wiesbaden", "Mönchengladbach", "Gelsenkirchen",
    "Braunschweig", "Kiel", "Aachen", "Chemnitz", "Halle", "Magdeburg", "Freiburg im Breisgau",
    "Krefeld", "Mainz", "Lübeck", "Erfurt", "Oberhausen", "Rostock", "Kassel",
    "Potsdam", "Saarbrücken", "Heidelberg", "Regensburg", "Ingolstadt", "Würzburg",
    "Ulm", "Heilbronn", "Pforzheim", "Göttingen", "Bottrop", "Trier", "Recklinghausen",
    "Reutlingen", "Bremerhaven", "Koblenz", "Bergisch Gladbach", "Jena", "Remscheid",
    "Erlangen", "Moers", "Siegen", "Hildesheim", "Salzgitter", "Garmisch-Partenkirchen",
  ],
  "Österreich": [
    "Wien", "Graz", "Linz", "Salzburg", "Innsbruck", "Klagenfurt", "Villach",
    "Wels", "Sankt Pölten", "Dornbirn", "Steyr", "Wiener Neustadt", "Feldkirch",
    "Bregenz", "Leonding", "Klosterneuburg", "Baden", "Wolfsberg", "Leoben", "Krems",
  ],
  "Italien": [
    "Rom", "Mailand", "Neapel", "Turin", "Palermo", "Genua", "Bologna", "Florenz",
    "Bari", "Catania", "Venedig", "Verona", "Messina", "Padua", "Triest", "Brescia",
    "Parma", "Modena", "Reggio Calabria", "Perugia", "Livorno", "Ravenna", "Cagliari",
    "Rimini", "Salerno", "Ferrara", "Sassari", "Bergamo", "Pescara", "Pisa", "Como",
    "Lecce", "Bozen", "Siena", "Amalfi", "Sorrento", "Portofino", "Capri",
  ],
  "Frankreich": [
    "Paris", "Marseille", "Lyon", "Toulouse", "Nizza", "Nantes", "Montpellier",
    "Straßburg", "Bordeaux", "Lille", "Rennes", "Reims", "Le Havre", "Saint-Étienne",
    "Toulon", "Grenoble", "Dijon", "Angers", "Nîmes", "Villeurbanne", "Le Mans",
    "Aix-en-Provence", "Clermont-Ferrand", "Brest", "Tours", "Limoges", "Amiens",
    "Annecy", "Cannes", "Antibes", "Avignon", "La Rochelle", "Biarritz", "Chamonix",
    "Deauville", "Saint-Tropez",
  ],
  "Spanien": [
    "Madrid", "Barcelona", "Valencia", "Sevilla", "Saragossa", "Málaga", "Murcia",
    "Palma de Mallorca", "Las Palmas", "Bilbao", "Alicante", "Córdoba", "Valladolid",
    "Vigo", "Gijón", "Granada", "A Coruña", "Vitoria-Gasteiz", "Elche", "Oviedo",
    "Santa Cruz de Tenerife", "Pamplona", "Almería", "San Sebastián", "Marbella",
    "Ibiza", "Toledo", "Salamanca", "Santiago de Compostela", "Cádiz", "Tarragona",
  ],
  "Niederlande": [
    "Amsterdam", "Rotterdam", "Den Haag", "Utrecht", "Eindhoven", "Groningen",
    "Tilburg", "Almere", "Breda", "Nijmegen", "Haarlem", "Arnhem", "Enschede",
    "Apeldoorn", "Maastricht", "Leiden", "Dordrecht", "Delft", "Zwolle",
  ],
  "Belgien": [
    "Brüssel", "Antwerpen", "Gent", "Charleroi", "Lüttich", "Brügge", "Namur",
    "Löwen", "Mons", "Aalst", "Mechelen", "Ostende", "Hasselt", "Tournai",
  ],
  "Vereinigtes Königreich": [
    "London", "Birmingham", "Manchester", "Glasgow", "Liverpool", "Leeds", "Newcastle",
    "Sheffield", "Bristol", "Edinburgh", "Cardiff", "Belfast", "Nottingham", "Leicester",
    "Oxford", "Cambridge", "Brighton", "Bath", "York", "Aberdeen", "Inverness",
  ],
  "Irland": [
    "Dublin", "Cork", "Limerick", "Galway", "Waterford", "Drogheda", "Kilkenny",
    "Killarney", "Sligo", "Wexford",
  ],
  "Portugal": [
    "Lissabon", "Porto", "Vila Nova de Gaia", "Amadora", "Braga", "Coimbra",
    "Funchal", "Faro", "Évora", "Aveiro", "Cascais", "Sintra", "Albufeira", "Lagos",
  ],
  "Griechenland": [
    "Athen", "Thessaloniki", "Patras", "Heraklion", "Larisa", "Volos", "Rhodos",
    "Chania", "Kerkyra", "Mykonos", "Santorin", "Kos",
  ],
  "Schweden": [
    "Stockholm", "Göteborg", "Malmö", "Uppsala", "Västerås", "Örebro", "Linköping",
    "Helsingborg", "Jönköping", "Norrköping", "Lund", "Umeå", "Gävle", "Borås", "Kiruna",
  ],
  "Norwegen": [
    "Oslo", "Bergen", "Trondheim", "Stavanger", "Drammen", "Fredrikstad", "Kristiansand",
    "Tromsø", "Sandnes", "Ålesund", "Bodø", "Lillehammer",
  ],
  "Dänemark": [
    "Kopenhagen", "Aarhus", "Odense", "Aalborg", "Esbjerg", "Randers", "Kolding",
    "Horsens", "Vejle", "Roskilde",
  ],
  "Finnland": [
    "Helsinki", "Espoo", "Tampere", "Vantaa", "Oulu", "Turku", "Jyväskylä", "Lahti",
    "Kuopio", "Rovaniemi",
  ],
  "Polen": [
    "Warschau", "Krakau", "Łódź", "Breslau", "Posen", "Danzig", "Stettin", "Bydgoszcz",
    "Lublin", "Białystok", "Katowice", "Gdynia", "Częstochowa", "Sopot", "Zakopane",
  ],
  "Tschechien": [
    "Prag", "Brünn", "Ostrava", "Pilsen", "Liberec", "Olomouc", "České Budějovice",
    "Hradec Králové", "Karlsbad", "Český Krumlov",
  ],
  "Ungarn": [
    "Budapest", "Debrecen", "Szeged", "Miskolc", "Pécs", "Győr", "Nyíregyháza",
    "Kecskemét", "Székesfehérvár", "Eger",
  ],
  "Kroatien": [
    "Zagreb", "Split", "Rijeka", "Osijek", "Zadar", "Dubrovnik", "Pula", "Šibenik",
    "Rovinj", "Hvar",
  ],
  "Slowenien": [
    "Ljubljana", "Maribor", "Celje", "Kranj", "Koper", "Bled", "Piran", "Portorož",
  ],
  "USA": [
    "New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "Philadelphia",
    "San Antonio", "San Diego", "Dallas", "San Jose", "Austin", "Jacksonville",
    "San Francisco", "Seattle", "Denver", "Boston", "Las Vegas", "Miami", "Atlanta",
    "Washington", "Portland", "New Orleans", "Nashville", "Honolulu", "Aspen", "Malibu",
  ],
  "Kanada": [
    "Toronto", "Montreal", "Vancouver", "Calgary", "Edmonton", "Ottawa", "Winnipeg",
    "Quebec City", "Hamilton", "Halifax", "Victoria", "Banff", "Whistler",
  ],
};

export const COUNTRIES = Object.keys(LOCATIONS).sort((a, b) => a.localeCompare(b, "de"));
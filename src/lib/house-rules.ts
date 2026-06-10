export interface HouseRule {
  id: string;
  text: string;
  category: string;
}

export const HOUSE_RULE_CATEGORIES = [
  "Rauchen & Drogen",
  "Haustiere",
  "Partys & Events",
  "Kinder & Babys",
  "Check-in & Check-out",
  "Sauberkeit & Pflege",
  "Sicherheit",
  "Nachbarn & Ruhe",
  "Küche & Essen",
  "Schlafzimmer & Betten",
  "Badezimmer",
  "Allgemein",
] as const;

export const PRE_MADE_HOUSE_RULES: HouseRule[] = [
  // Rauchen & Drogen
  { id: "no-smoking", text: "Rauchen in der Wohnung und auf dem Balkon ist strengstens untersagt.", category: "Rauchen & Drogen" },
  { id: "no-smoking-inside", text: "Rauchen ist nur draußen im Garten erlaubt.", category: "Rauchen & Drogen" },
  { id: "smoking-balcony-ok", text: "Rauchen ist auf dem Balkon gestattet, bitte Aschenbecher benutzen.", category: "Rauchen & Drogen" },
  { id: "no-cannabis", text: "Der Konsum von Cannabis oder anderen Drogen ist nicht erlaubt.", category: "Rauchen & Drogen" },
  { id: "no-vaping-indoor", text: "E-Zigaretten und Dampfen sind nur im Freien erlaubt.", category: "Rauchen & Drogen" },
  { id: "no-hookah", text: "Shisha oder Wasserpfeife ist nicht gestattet.", category: "Rauchen & Drogen" },
  { id: "smoke-detector", text: "Bitte die Rauchmelder nicht abkleben oder deaktivieren.", category: "Rauchen & Drogen" },
  { id: "no-cigarette-butts", text: "Zigarettenstummel bitte nicht in den Garten oder auf den Balkon werfen.", category: "Rauchen & Drogen" },

  // Haustiere
  { id: "no-pets", text: "Haustiere jeglicher Art sind nicht erlaubt.", category: "Haustiere" },
  { id: "pets-ok-small", text: "Kleine Haustiere sind nach Absprache willkommen.", category: "Haustiere" },
  { id: "pets-dog-ok", text: "Ein Hund ist erlaubt, bitte vorher ankündigen.", category: "Haustiere" },
  { id: "pets-cat-ok", text: "Eine Katze ist erlaubt, bitte vorher ankündigen.", category: "Haustiere" },
  { id: "no-pets-on-furniture", text: "Haustiere dürfen nicht auf Betten oder Sofas.", category: "Haustiere" },
  { id: "pets-clean-after", text: "Bitte hinter deinem Haustier aufräumen und Pfoten abwischen.", category: "Haustiere" },
  { id: "no-exotic-pets", text: "Exotische Tiere wie Reptilien oder Vögel sind nicht gestattet.", category: "Haustiere" },
  { id: "service-dogs", text: "Assistenz- und Blindenhunde sind selbstverständlich willkommen.", category: "Haustiere" },
  { id: "pets-leash", text: "Hunde müssen in den Gemeinschaftsbereichen an der Leine geführt werden.", category: "Haustiere" },

  // Partys & Events
  { id: "no-parties", text: "Partys und laute Feiern sind nicht erlaubt.", category: "Partys & Events" },
  { id: "no-events", text: "Private Events oder Filmaufnahmen sind ohne Genehmigung untersagt.", category: "Partys & Events" },
  { id: "small-gatherings-ok", text: "Kleine Abendessen mit bis zu 4 Gästen sind erlaubt.", category: "Partys & Events" },
  { id: "no-overnight-guests", text: "Übernachtende Gäste, die nicht gebucht haben, sind nicht erlaubt.", category: "Partys & Events" },
  { id: "guests-announce", text: "Bitte melde Besucher, die länger als 2 Stunden bleiben.", category: "Partys & Events" },
  { id: "no-commercial-use", text: "Die Unterkunft darf nicht für kommerzielle Zwecke genutzt werden.", category: "Partys & Events" },
  { id: "bachelor-parties-no", text: "Junggesellenabschiede und ähnliche Events sind nicht gestattet.", category: "Partys & Events" },
  { id: "quiet-celebrations", text: "Geburtstage oder kleine Feiern nur nach vorheriger Absprache.", category: "Partys & Events" },

  // Kinder & Babys
  { id: "kids-friendly", text: "Kinder jeden Alters sind herzlich willkommen.", category: "Kinder & Babys" },
  { id: "no-kids-under-2", text: "Kinder unter 2 Jahren sind aus Sicherheitsgründen nicht geeignet.", category: "Kinder & Babys" },
  { id: "kids-supervision", text: "Kinder müssen von Erwachsenen beaufsichtigt werden.", category: "Kinder & Babys" },
  { id: "no-baby-proof", text: "Die Wohnung ist nicht kindersicher eingerichtet.", category: "Kinder & Babys" },
  { id: "no-stairs-gate", text: "Es gibt keine Treppenschutzgitter – Vorsicht bei Kleinkindern.", category: "Kinder & Babys" },
  { id: "high-chair-available", text: "Ein Hochstuhl ist auf Anfrage verfügbar.", category: "Kinder & Babys" },
  { id: "cot-available", text: "Ein Kinderbett/Reisebett ist auf Anfrage verfügbar.", category: "Kinder & Babys" },
  { id: "toys-provided", text: "Spielzeug und Bücher für Kinder stehen bereit.", category: "Kinder & Babys" },
  { id: "no-sharp-corners", text: "Möbel haben scharfe Kanten – bitte aufpassen mit Kleinkindern.", category: "Kinder & Babys" },

  // Check-in & Check-out
  { id: "check-in-14h", text: "Check-in ab 14:00 Uhr.", category: "Check-in & Check-out" },
  { id: "check-in-15h", text: "Check-in ab 15:00 Uhr.", category: "Check-in & Check-out" },
  { id: "check-in-16h", text: "Check-in ab 16:00 Uhr.", category: "Check-in & Check-out" },
  { id: "check-in-flexible", text: "Flexibler Check-in nach Absprache.", category: "Check-in & Check-out" },
  { id: "check-out-10h", text: "Check-out bis 10:00 Uhr.", category: "Check-in & Check-out" },
  { id: "check-out-11h", text: "Check-out bis 11:00 Uhr.", category: "Check-in & Check-out" },
  { id: "check-out-12h", text: "Check-out bis 12:00 Uhr.", category: "Check-in & Check-out" },
  { id: "late-check-out", text: "Late Check-out nur nach Absprache und Verfügbarkeit.", category: "Check-in & Check-out" },
  { id: "self-check-in", text: "Self Check-in per Schlüsselsafe.", category: "Check-in & Check-out" },
  { id: "meet-greet", text: "Persönliche Übergabe bei Ankunft.", category: "Check-in & Check-out" },
  { id: "id-required", text: "Bitte bring einen gültigen Personalausweis oder Reisepass mit.", category: "Check-in & Check-out" },
  { id: "deposit-required", text: "Eine Kaution von 200 CHF wird bei Ankunft hinterlegt.", category: "Check-in & Check-out" },

  // Sauberkeit & Pflege
  { id: "shoes-off", text: "Bitte Schuhe ausziehen beim Betreten der Wohnung.", category: "Sauberkeit & Pflege" },
  { id: "no-food-in-bedroom", text: "Essen und Getränke außer Wasser nicht im Schlafzimmer.", category: "Sauberkeit & Pflege" },
  { id: "clean-kitchen", text: "Bitte die Küche nach dem Kochen reinigen und Geschirr spülen.", category: "Sauberkeit & Pflege" },
  { id: "take-trash-out", text: "Müll bitte regelmäßig entsorgen und beim Check-out mitnehmen.", category: "Sauberkeit & Pflege" },
  { id: "no-red-wine", text: "Rotwein und andere fleckige Getränke nur in der Küche.", category: "Sauberkeit & Pflege" },
  { id: "no-stains", text: "Bitte vorsichtig mit Kosmetika und Farben auf Handtücher und Bettwäsche.", category: "Sauberkeit & Pflege" },
  { id: "report-spills", text: "Verschüttetes bitte sofort aufwischen und melden.", category: "Sauberkeit & Pflege" },
  { id: "no-candles", text: "Kerzen und offenes Feuer sind aus Brandschutzgründen untersagt.", category: "Sauberkeit & Pflege" },
  { id: "no-incense", text: "Räucherstäbchen sind nicht erlaubt.", category: "Sauberkeit & Pflege" },
  { id: "strip-beds", text: "Bitte Bettwäsche beim Check-out abziehen und vor dem Waschbecken ablegen.", category: "Sauberkeit & Pflege" },
  { id: "no-dye-hair", text: "Bitte nicht in der Wohnung Haare färben oder bleichen.", category: "Sauberkeit & Pflege" },
  { id: "no-nail-polish", text: "Nagellack bitte nur im Badezimmer auftragen und gut lüften.", category: "Sauberkeit & Pflege" },

  // Sicherheit
  { id: "lock-doors", text: "Bitte Türen und Fenster beim Verlassen abschließen.", category: "Sicherheit" },
  { id: "alarm-system", text: "Alarmanlage bitte bei Abwesenheit aktivieren.", category: "Sicherheit" },
  { id: "no-spare-key", text: "Ersatzschlüssel dürfen nicht an Dritte weitergegeben werden.", category: "Sicherheit" },
  { id: "emergency-exits", text: "Notausgänge und Fluchtwege müssen jederzeit frei bleiben.", category: "Sicherheit" },
  { id: "fire-extinguisher", text: "Feuerlöscher befindet sich im Flurschrank – bitte nicht blockieren.", category: "Sicherheit" },
  { id: "first-aid", text: "Erste-Hilfe-Kasten ist im Badezimmerschrank.", category: "Sicherheit" },
  { id: "emergency-number", text: "Notfallnummern: Feuerwehr 118, Polizei 117, Ambulanz 144.", category: "Sicherheit" },
  { id: "no-balcony-climbing", text: "Bitte nicht über Balkone oder Geländer klettern.", category: "Sicherheit" },
  { id: "safe-valuables", text: "Wertsachen bitte im Safe aufbewahren oder mitnehmen.", category: "Sicherheit" },
  { id: "no-fireworks", text: "Feuerwerk und Böller sind auf dem Grundstück verboten.", category: "Sicherheit" },

  // Nachbarn & Ruhe
  { id: "quiet-22h-7h", text: "Ruhezeit von 22:00 bis 07:00 Uhr – bitte leise sein.", category: "Nachbarn & Ruhe" },
  { id: "quiet-21h-8h", text: "Ruhezeit von 21:00 bis 08:00 Uhr.", category: "Nachbarn & Ruhe" },
  { id: "no-loud-music", text: "Bitte keine laute Musik abspielen, besonders nach 20 Uhr.", category: "Nachbarn & Ruhe" },
  { id: "no-tv-loud", text: "TV und Streaming bitte auf moderate Lautstärke.", category: "Nachbarn & Ruhe" },
  { id: "no-laundry-night", text: "Waschmaschine und Trockner bitte nicht zwischen 22:00 und 07:00 Uhr benutzen.", category: "Nachbarn & Ruhe" },
  { id: "shoes-off-upstairs", text: "In Wohnungen über dem Erdgeschoss bitte barfuß oder mit Hausschuhen laufen.", category: "Nachbarn & Ruhe" },
  { id: "no-door-slam", text: "Türen bitte nicht zuknallen, sondern sanft schließen.", category: "Nachbarn & Ruhe" },
  { id: "elevator-quiet", text: "Im Aufzug und Treppenhaus bitte Rücksicht auf Nachbarn nehmen.", category: "Nachbarn & Ruhe" },
  { id: "no-smoking-stairs", text: "Rauchen im Treppenhaus oder Aufzug ist verboten.", category: "Nachbarn & Ruhe" },
  { id: "common-areas-clean", text: "Gemeinschaftsräume und Treppenhaus bitt sauber hinterlassen.", category: "Nachbarn & Ruhe" },

  // Küche & Essen
  { id: "no-grease-pan", text: "Bratpfannen nicht leer erhitzen und Fett nicht in die Spüle gießen.", category: "Küche & Essen" },
  { id: "fridge-label", text: "Eigene Lebensmittel bitte klar beschriften.", category: "Küche & Essen" },
  { id: "no-strong-smells", text: "Bitte keine stark riechenden Speisen wie Surströmming oder Durian zubereiten.", category: "Küche & Essen" },
  { id: "dishwasher-rules", text: "Geschirrspüler bitte nur voll beladen starten.", category: "Küche & Essen" },
  { id: "no-microwave-metal", text: "Kein Metall oder Alufolie in die Mikrowelle.", category: "Küche & Essen" },
  { id: "coffee-machine", text: "Kaffeemaschine bitte nach Gebrauch reinigen und entkalken.", category: "Küche & Essen" },
  { id: "induction-care", text: "Induktionskochfeld erst nach Abkühlen mit weichem Tuch reinigen.", category: "Küche & Essen" },
  { id: "no-food-waste-disposal", text: "Essensreste nicht im Abfluss entsorgen.", category: "Küche & Essen" },
  { id: "compost-bin", text: "Biomüll bitte im grünen Container entsorgen.", category: "Küche & Essen" },
  { id: "recycling-rules", text: "Recycling: PET, Glas, Papier und Aluminium bitte trennen.", category: "Küche & Essen" },
  { id: "no-eating-couch", text: "Bitte nicht auf dem Sofa oder im Bett essen.", category: "Küche & Essen" },

  // Schlafzimmer & Betten
  { id: "no-jumping-beds", text: "Bitte nicht auf Betten springen.", category: "Schlafzimmer & Betten" },
  { id: "linen-provided", text: "Bettwäsche und Handtücher werden gestellt.", category: "Schlafzimmer & Betten" },
  { id: "no-extra-guests-bed", text: "Nur die gebuchte Anzahl Gäste in den Betten.", category: "Schlafzimmer & Betten" },
  { id: "pillows-dont-remove", text: "Kissen und Decken bitte in den Zimmern lassen.", category: "Schlafzimmer & Betten" },
  { id: "mattress-protector", text: "Matratzenschoner bitte nicht entfernen.", category: "Schlafzimmer & Betten" },
  { id: "curtains-day", text: "Vorhänge tagsüber bitte öffnen, damit das Zimmer lüften kann.", category: "Schlafzimmer & Betten" },
  { id: "no-sleeping-sofa", text: "Das Schlafsofa ist nicht für Gäste gedacht – nur das gebuchte Zimmer nutzen.", category: "Schlafzimmer & Betten" },
  { id: "wardrobe-space", text: "Kleiderschrank links ist für Gäste reserviert.", category: "Schlafzimmer & Betten" },
  { id: "no-hangers-take", text: "Kleiderbügel bitte nicht mitnehmen.", category: "Schlafzimmer & Betten" },

  // Badezimmer
  { id: "hair-dryer", text: "Föhn ist im Badezimmerschrank – bitte nach Gebrauch zurücklegen.", category: "Badezimmer" },
  { id: "towels-not-sand", text: "Handtücher nicht für den Strand oder Garten benutzen.", category: "Badezimmer" },
  { id: "shower-curtain", text: "Duschvorhang bitte während des Duschens innen lassen.", category: "Badezimmer" },
  { id: "toilet-paper-flush", text: "Toilettenpapier bitte nur in kleinen Mengen herunterspülen.", category: "Badezimmer" },
  { id: "no-wipes-toilet", text: "Feuchttücher und Hygieneartikel nicht in die Toilette werfen.", category: "Badezimmer" },
  { id: "ventilation-after-shower", text: "Bitte nach dem Duschen lüften, um Schimmel zu vermeiden.", category: "Badezimmer" },
  { id: "hot-water-limited", text: "Warmwasser ist begrenzt – bitte nicht zu lange duschen.", category: "Badezimmer" },
  { id: "no-bath-dyes", text: "Badeöle und Farben, die Flecken hinterlassen, bitte vermeiden.", category: "Badezimmer" },
  { id: "toiletries-own", text: "Bitte eigene Toilettenartikel mitbringen – einige Basics sind vorhanden.", category: "Badezimmer" },

  // Allgemein
  { id: "wifi-password", text: "WLAN-Passwort steht auf dem Kühlschrank.", category: "Allgemein" },
  { id: "no-moving-furniture", text: "Möbel bitte nicht umstellen ohne Absprache.", category: "Allgemein" },
  { id: "plants-water", text: "Zimmerpflanzen bitte alle 3 Tage gießen.", category: "Allgemein" },
  { id: "lights-off", text: "Lichter und Elektrogeräte bitte beim Verlassen ausschalten.", category: "Allgemein" },
  { id: "heating-instructions", text: "Heizung bitte nicht über 22°C stellen und beim Lüften ausschalten.", category: "Allgemein" },
  { id: "no-aircon-waste", text: "Klimaanlage bitte nur bei geschlossenen Fenstern und Türen nutzen.", category: "Allgemein" },
  { id: "balcony-door-wind", text: "Balkontür bei Wind bitte nicht offenstehen lassen.", category: "Allgemein" },
  { id: "garage-access", text: "Garagenplatz Nummer 3 steht zur Verfügung – bitte nur diesen nutzen.", category: "Allgemein" },
  { id: "bike-storage", text: "Fahrräder bitte im Keller abstellen, nicht im Treppenhaus.", category: "Allgemein" },
  { id: "post-mail", text: "Eigene Post bitte nicht im Briefkasten des Gastgebers hinterlassen.", category: "Allgemein" },
  { id: "no-packages", text: "Paketlieferungen an diese Adresse bitte nicht bestellen.", category: "Allgemein" },
  { id: "damages-report", text: "Beschädigungen bitte sofort melden.", category: "Allgemein" },
  { id: "emergency-contact", text: "Bei Notfällen: Gastgeber erreichbar unter der hinterlegten Nummer.", category: "Allgemein" },
  { id: "lost-found", text: "Vergessene Gegenstände werden 14 Tage aufbewahrt und dann gespendet.", category: "Allgemein" },
  { id: "no-rearrange-decor", text: "Dekoration und Kunstgegenstände bitte nicht verschieben oder anfassen.", category: "Allgemein" },
  { id: "no-photos-listing", text: "Fotos der Wohnung für Social Media oder Reviews nur mit Erlaubnis.", category: "Allgemein" },
  { id: "checkout-inspection", text: "Bei Check-out findet eine kurze Besichtigung statt.", category: "Allgemein" },
  { id: "feedback-welcome", text: "Feedback und Verbesserungsvorschläge sind jederzeit willkommen!", category: "Allgemein" },
  { id: "enjoy-stay", text: "Fühle dich wie zu Hause und genieße deinen Aufenthalt!", category: "Allgemein" },
];

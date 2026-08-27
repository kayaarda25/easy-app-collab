import { createFileRoute } from "@tanstack/react-router";
import { AppWelcome } from "@/components/AppWelcome";

export const Route = createFileRoute("/welcome")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "flatch. App — Zuhause tauschen statt Hotel buchen" },
      {
        name: "description",
        content:
          "Starte mit flatch.: Zuhause listen, weltweit swipen, matchen und sicher tauschen. Jetzt kostenlos anmelden.",
      },
      { property: "og:title", content: "flatch. App — Zuhause tauschen statt Hotel buchen" },
      {
        property: "og:description",
        content: "Zuhause listen, weltweit swipen, matchen und sicher tauschen.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AppWelcome,
});

import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { HelpChat } from "@/components/HelpChat";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth", search: { mode: "login" } });
    const email = data.user.email?.toLowerCase() ?? "";
    if (email === "info@flatch.ch" && !location.pathname.startsWith("/admin")) {
      throw redirect({ to: "/admin" });
    }
    return { user: data.user };
  },
  component: () => (
    <>
      <Outlet />
      <HelpChat />
    </>
  ),
});

REVOKE EXECUTE ON FUNCTION public.post_system_message(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_match_created() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_proposal_created() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_proposal_status_changed() FROM PUBLIC, anon, authenticated;

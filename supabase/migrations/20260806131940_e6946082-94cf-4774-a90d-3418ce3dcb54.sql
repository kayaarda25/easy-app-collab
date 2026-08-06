CREATE OR REPLACE FUNCTION public.record_swipe(_property_id uuid, _direction text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _dir swipe_direction;
  _owner uuid;
  _my_prop uuid;
  _match_id uuid;
  _a uuid; _b uuid; _pa uuid; _pb uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _direction NOT IN ('like','pass') THEN
    RAISE EXCEPTION 'Invalid direction: %', _direction;
  END IF;
  _dir := _direction::swipe_direction;

  SELECT owner_id INTO _owner FROM public.properties WHERE id = _property_id;
  IF _owner IS NULL THEN
    RAISE EXCEPTION 'Property not found';
  END IF;

  DELETE FROM public.swipes WHERE user_id = _uid AND property_id = _property_id;
  INSERT INTO public.swipes (user_id, property_id, direction)
  VALUES (_uid, _property_id, _dir);

  IF _dir <> 'like' OR _owner = _uid THEN
    RETURN jsonb_build_object('matched', false);
  END IF;

  -- Did the property owner already like one of my properties?
  SELECT s.property_id INTO _my_prop
  FROM public.swipes s
  JOIN public.properties p ON p.id = s.property_id
  WHERE s.user_id = _owner
    AND s.direction = 'like'
    AND p.owner_id = _uid
  ORDER BY s.created_at ASC
  LIMIT 1;

  IF _my_prop IS NULL THEN
    RETURN jsonb_build_object('matched', false);
  END IF;

  IF _uid < _owner THEN
    _a := _uid; _b := _owner; _pa := _my_prop; _pb := _property_id;
  ELSE
    _a := _owner; _b := _uid; _pa := _property_id; _pb := _my_prop;
  END IF;

  SELECT id INTO _match_id FROM public.matches
   WHERE property_a = _pa AND property_b = _pb;

  IF _match_id IS NULL THEN
    INSERT INTO public.matches (user_a, user_b, property_a, property_b)
    VALUES (_a, _b, _pa, _pb)
    RETURNING id INTO _match_id;
  END IF;

  RETURN jsonb_build_object('matched', true, 'match_id', _match_id);
END;
$$;

REVOKE ALL ON FUNCTION public.record_swipe(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_swipe(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_swipe(uuid, text) TO service_role;
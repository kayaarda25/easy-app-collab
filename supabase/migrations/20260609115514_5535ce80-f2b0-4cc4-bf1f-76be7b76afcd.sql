ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS street text,
  ADD COLUMN IF NOT EXISTS house_number text;

-- Migrate existing address data (best-effort: split on first space)
UPDATE public.properties
SET street = CASE 
  WHEN position(' ' in address) > 0 THEN substring(address from 1 for position(' ' in address) - 1)
  ELSE address
END,
house_number = CASE
  WHEN position(' ' in address) > 0 THEN substring(address from position(' ' in address) + 1)
  ELSE NULL
END
WHERE address IS NOT NULL AND street IS NULL;

ALTER TABLE public.properties DROP COLUMN IF EXISTS address;
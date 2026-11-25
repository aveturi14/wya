-- Receipt scans: a daily cap across all users (issue #86).
--
-- Each scan sends a photo to OpenAI, which costs money. begin_receipt_scan already
-- allows 10 scans an hour per user, but sign-up needs no email confirmation, so
-- new accounts each bring a fresh 10. This adds one shared bucket for the whole
-- project, so the bill has a ceiling. Change 500 if real use needs more.
--
-- The per-user check runs first. A refused call rolls back, so being over the
-- shared cap never costs someone one of their own 10.

create or replace function public.begin_receipt_scan(p_receipt_id uuid)
returns text
language plpgsql security definer set search_path = '' as $$
declare v_receipt public.receipts%rowtype;
begin
  v_receipt := private.receipt_for_payer(p_receipt_id, array['draft']);
  if v_receipt.image_path is null then
    raise exception 'There''s no photo to read' using errcode = 'P0001', hint = 'receipt_no_photo';
  end if;
  perform private.hit_rate_limit('scan:' || (select auth.uid()), 10, interval '1 hour');
  -- hit_rate_limit's own message says "you're doing that a lot", which would blame the person
  begin
    perform private.hit_rate_limit('scan:all', 500, interval '1 day');
  exception when sqlstate 'P0001' then
    raise exception 'Scanning is busy today. Try again tomorrow, or type the lines in.'
      using errcode = 'P0001', hint = 'rate_limited';
  end;
  return v_receipt.image_path;
end;
$$;

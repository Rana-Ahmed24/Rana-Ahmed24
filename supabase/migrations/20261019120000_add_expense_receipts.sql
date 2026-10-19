begin;

alter table public.expenses
  add column receipt_key text,
  add constraint expenses_receipt_key_matches_id check (
    receipt_key is null or receipt_key ~ (
      '^receipts/' || id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.]jpg$'
    )
  );

commit;

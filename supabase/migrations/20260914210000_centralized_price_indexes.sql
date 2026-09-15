create index if not exists snowaz_price_settings_updated_by_idx
  on public.snowaz_price_settings (updated_by);

create index if not exists snowaz_price_history_price_key_idx
  on public.snowaz_price_history (price_key);

create index if not exists snowaz_price_history_changed_by_idx
  on public.snowaz_price_history (changed_by);

create index if not exists snowaz_price_history_changed_at_idx
  on public.snowaz_price_history (changed_at desc);

drop function public.get_snowaz_schedule(date,date);
create function public.get_snowaz_schedule(range_start date, range_end date)
returns table(check_in date,check_out date,display_status text,public_label text)
language sql stable security definer set search_path='' as $$
  select r.check_in,r.check_out,r.display_status,null::text
  from public.snowaz_calendar_ranges r
  where r.check_in<range_end and r.check_out>range_start
  union all
  select x.check_in,x.check_out,'unavailable'::text,
    coalesce(nullif(array_to_string((regexp_split_to_array(trim(regexp_replace(x.reason,'[^[:alnum:] -]+','','g')),'\\s+'))[1:2],' '),''),'Unavailable')
  from public.property_date_blocks x
  where x.status='active' and x.check_in<range_end and x.check_out>range_start
$$;
revoke all on function public.get_snowaz_schedule(date,date) from public;
grant execute on function public.get_snowaz_schedule(date,date) to anon,authenticated;

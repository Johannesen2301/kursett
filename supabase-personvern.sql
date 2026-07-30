-- Kursett — Personvern: brukeren velger selv om aksjene vises
-- Kjør i Supabase → SQL Editor → lim inn → Run.

-- Ny kolonne: vis individuelle beholdninger? Standard = av (mest privat).
alter table profiler add column if not exists vis_beholdninger boolean not null default false;

-- Beholdninger returneres KUN hvis brukeren selv har slått det på.
-- (Sektorbåndet er alltid synlig — det avslører ikke hvilke selskaper man eier.)
create or replace function offentlige_beholdninger(bruker uuid)
returns table (navn text, sektor text, vekt numeric)
language sql
security definer
set search_path = public
as $$
  with total as (
    select coalesce(sum(markedsverdi), 0) as sum_verdi
    from posisjoner where bruker_id = bruker
  )
  select p.navn, p.sektor,
         round((p.markedsverdi / nullif((select sum_verdi from total), 0) * 100)::numeric, 1) as vekt
  from posisjoner p
  where p.bruker_id = bruker
    and exists (
      select 1 from profiler pr
      where pr.id = bruker
        and (pr.vis_beholdninger = true or pr.id = auth.uid())  -- egen profil ser alltid seg selv
    )
  order by vekt desc nulls last;
$$;

grant execute on function offentlige_beholdninger(uuid) to authenticated, anon;

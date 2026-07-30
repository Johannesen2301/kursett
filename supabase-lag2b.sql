-- Kursett — Lag 2b: vennskap + direktemeldinger
-- Kjør i Supabase → SQL Editor → lim inn → Run.

-- ---------- Vennskap ----------
create table if not exists vennskap (
  id uuid primary key default gen_random_uuid(),
  avsender_id uuid not null references auth.users(id) on delete cascade,
  mottaker_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'ventende',   -- 'ventende' | 'godtatt'
  opprettet timestamptz default now(),
  unique (avsender_id, mottaker_id)
);

alter table vennskap enable row level security;

-- Man ser rader der man selv er en av partene.
drop policy if exists "les egne vennskap" on vennskap;
create policy "les egne vennskap" on vennskap for select
  using (auth.uid() = avsender_id or auth.uid() = mottaker_id);

-- Man kan sende forespørsler (som avsender).
drop policy if exists "send foresporsel" on vennskap;
create policy "send foresporsel" on vennskap for insert
  with check (auth.uid() = avsender_id);

-- Mottaker kan godta (oppdatere status).
drop policy if exists "godta foresporsel" on vennskap;
create policy "godta foresporsel" on vennskap for update
  using (auth.uid() = mottaker_id) with check (auth.uid() = mottaker_id);

-- Begge parter kan slette (avslå / fjerne venn).
drop policy if exists "slett vennskap" on vennskap;
create policy "slett vennskap" on vennskap for delete
  using (auth.uid() = avsender_id or auth.uid() = mottaker_id);

-- ---------- Meldinger ----------
create table if not exists meldinger (
  id uuid primary key default gen_random_uuid(),
  avsender_id uuid not null references auth.users(id) on delete cascade,
  mottaker_id uuid not null references auth.users(id) on delete cascade,
  tekst text not null,
  opprettet timestamptz default now()
);

alter table meldinger enable row level security;

-- Man ser meldinger man selv har sendt eller mottatt.
drop policy if exists "les egne meldinger" on meldinger;
create policy "les egne meldinger" on meldinger for select
  using (auth.uid() = avsender_id or auth.uid() = mottaker_id);

-- Man kan KUN sende til noen man er godtatt venn med (hindrer spam/uønsket DM).
drop policy if exists "send til venner" on meldinger;
create policy "send til venner" on meldinger for insert
  with check (
    auth.uid() = avsender_id
    and exists (
      select 1 from vennskap v
      where v.status = 'godtatt'
        and ((v.avsender_id = auth.uid() and v.mottaker_id = meldinger.mottaker_id)
          or (v.mottaker_id = auth.uid() and v.avsender_id = meldinger.mottaker_id))
    )
  );

-- ---------- Funksjoner: venner og forespørsler med profil ----------
create or replace function mine_venner()
returns table (vennskap_id uuid, venn_id uuid, brukernavn text, avatar_farge text, bio text)
language sql security definer set search_path = public as $$
  select v.id,
         case when v.avsender_id = auth.uid() then v.mottaker_id else v.avsender_id end,
         pr.brukernavn, pr.avatar_farge, pr.bio
  from vennskap v
  join profiler pr on pr.id = (case when v.avsender_id = auth.uid() then v.mottaker_id else v.avsender_id end)
  where v.status = 'godtatt' and (v.avsender_id = auth.uid() or v.mottaker_id = auth.uid())
  order by pr.brukernavn;
$$;
grant execute on function mine_venner() to authenticated;

create or replace function innkommende_foresporsler()
returns table (vennskap_id uuid, fra_id uuid, brukernavn text, avatar_farge text)
language sql security definer set search_path = public as $$
  select v.id, v.avsender_id, pr.brukernavn, pr.avatar_farge
  from vennskap v join profiler pr on pr.id = v.avsender_id
  where v.mottaker_id = auth.uid() and v.status = 'ventende'
  order by v.opprettet desc;
$$;
grant execute on function innkommende_foresporsler() to authenticated;

create or replace function utgaaende_foresporsler()
returns table (vennskap_id uuid, til_id uuid, brukernavn text, avatar_farge text)
language sql security definer set search_path = public as $$
  select v.id, v.mottaker_id, pr.brukernavn, pr.avatar_farge
  from vennskap v join profiler pr on pr.id = v.mottaker_id
  where v.avsender_id = auth.uid() and v.status = 'ventende'
  order by v.opprettet desc;
$$;
grant execute on function utgaaende_foresporsler() to authenticated;

-- ---------- Realtime for live meldinger ----------
-- (Kan gi «already member of publication» hvis kjørt to ganger — helt ufarlig.)
alter publication supabase_realtime add table meldinger;

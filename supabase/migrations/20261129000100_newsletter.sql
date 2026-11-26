-- =============================================================================
-- Newsletter do site: quem assina entra no CRM com consentimento de novidades
-- (marketing) registrado à parte, com fonte "newsletter". O público só usa esta
-- função validada; não lê nem grava tabelas.
-- =============================================================================

create or replace function public.newsletter_subscribe(p_email text, p_name text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_nome text := nullif(btrim(coalesce(p_name, '')), '');
  v_pessoa uuid;
  v_aviso uuid;
begin
  if length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Informe um e-mail válido.' using errcode = '22023';
  end if;
  if v_nome is not null and length(v_nome) > 200 then
    raise exception 'Nome muito longo.' using errcode = '22023';
  end if;

  -- Limites contra abuso: por e-mail e no total.
  if (select count(*) from public.consent_records c join public.participants p on p.id = c.participant_id
       where lower(p.email) = v_email and c.source = 'newsletter' and c.recorded_at > now() - interval '24 hours') >= 3 then
    raise exception 'Este e-mail já foi cadastrado hoje.' using errcode = '54000';
  end if;
  if (select count(*) from public.consent_records c
       where c.source = 'newsletter' and c.recorded_at > now() - interval '1 hour') >= 300 then
    raise exception 'Muitos cadastros neste momento. Tente novamente em alguns minutos.' using errcode = '54000';
  end if;

  select id into v_aviso from public.privacy_notice_versions
   where published_at is not null order by published_at desc limit 1;
  if v_aviso is null then
    raise exception 'O cadastro está temporariamente indisponível.' using errcode = '55000';
  end if;

  select id into v_pessoa from public.participants where lower(email) = v_email;
  if v_pessoa is null then
    v_pessoa := gen_random_uuid();
    insert into public.participants (id, full_name, email, declared_role, owner_id, created_by)
    values (v_pessoa, coalesce(v_nome, split_part(v_email, '@', 1)), v_email, 'other', null, null);
  end if;

  insert into public.consent_records (participant_id, purpose, granted, notice_version_id, source, recorded_by)
  values (v_pessoa, 'marketing', true, v_aviso, 'newsletter', null);

  insert into public.activities (participant_id, kind, summary, occurred_at, completed_at, assignee_id, created_by)
  values (v_pessoa, 'other', 'Assinou a newsletter do site.', now(), now(), null, null);

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.newsletter_subscribe(text, text) from public;
grant execute on function public.newsletter_subscribe(text, text) to anon, authenticated;

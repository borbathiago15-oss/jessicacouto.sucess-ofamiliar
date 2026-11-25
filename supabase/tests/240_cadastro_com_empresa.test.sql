-- Cadastro do site com empresa: a empresa nasce ligada à pessoa e à oportunidade;
-- sem empresa, segue só a pessoa; um segundo cadastro não duplica a empresa.
begin;
select no_plan();

create temp table r (k text primary key, v jsonb) on commit drop;
grant select, insert on r to anon, authenticated;

select tests.as_postgres();
insert into public.privacy_notice_versions (version, summary, published_at) values ('teste-emp', 'Aviso fictício', now());
insert into public.materials (slug, title, storage_path, file_name, is_active)
values ('guia-empresa', 'Guia fictício', '22222222-2222-4222-8222-222222222222.pdf', 'guia.pdf', true);

select tests.as_anon();
insert into r select 'com', public.material_request('guia-empresa', 'Pessoa Com Empresa', 'com@exemplo.test', 'founder', false, 'Empresa Fictícia Ltda');
insert into r select 'sem', public.material_request('guia-empresa', 'Pessoa Sem Empresa', 'sem@exemplo.test', 'founder', false, null);
insert into r select 'de-novo', public.material_request('guia-empresa', 'Pessoa Com Empresa', 'com@exemplo.test', 'founder', false, 'Outro Nome');

select tests.as_postgres();
select is((select count(*)::int from public.organizations where trade_name = 'Empresa Fictícia Ltda'), 1,
          'a empresa informada é criada');
select ok(exists (select 1 from public.organization_participants op join public.participants p on p.id = op.participant_id
                   join public.organizations o on o.id = op.organization_id
                   where p.email = 'com@exemplo.test' and o.trade_name = 'Empresa Fictícia Ltda'),
          'a pessoa fica ligada à empresa');
select ok(exists (select 1 from public.opportunities op join public.participants p on p.id = op.participant_id
                   join public.organizations o on o.id = op.organization_id
                   where p.email = 'com@exemplo.test' and o.trade_name = 'Empresa Fictícia Ltda'),
          'a oportunidade do funil já nasce com a empresa');
select is((select count(*)::int from public.organizations where trade_name = 'Outro Nome'), 0,
          'segundo cadastro da mesma pessoa não cria outra empresa');
select ok(exists (select 1 from public.opportunities op join public.participants p on p.id = op.participant_id
                   where p.email = 'sem@exemplo.test' and op.organization_id is null),
          'sem empresa informada, a oportunidade fica só com a pessoa');

select * from finish();
rollback;

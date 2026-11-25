-- Newsletter: cadastro valida o e-mail, entra no CRM com consentimento de
-- novidades separado e respeita o limite por e-mail. Dados fictícios.
begin;
select no_plan();

select tests.as_postgres();
insert into public.privacy_notice_versions (version, summary, published_at) values ('teste-nl', 'Aviso fictício', now());

select tests.as_anon();
select throws_ok($$ select public.newsletter_subscribe('sem-arroba') $$, '22023', 'Informe um e-mail válido.',
                 'e-mail inválido é recusado');
select lives_ok($$ select public.newsletter_subscribe('Leitora@Exemplo.test') $$, 'cadastro aceito');
select public.newsletter_subscribe('leitora@exemplo.test') from generate_series(1, 2);
select throws_ok($$ select public.newsletter_subscribe('leitora@exemplo.test') $$, '54000', null,
                 'limite por e-mail');
select throws_ok($$ select * from public.participants $$, '42501', null, 'anon não lê o CRM');

select tests.as_postgres();
select is((select count(*)::int from public.participants where email = 'leitora@exemplo.test'), 1,
          'uma pessoa só no CRM');
select ok(exists (select 1 from public.consent_records c join public.participants p on p.id = c.participant_id
                   where p.email = 'leitora@exemplo.test' and c.purpose = 'marketing' and c.granted
                     and c.source = 'newsletter'),
          'consentimento de novidades registrado com a fonte newsletter');

select * from finish();
rollback;

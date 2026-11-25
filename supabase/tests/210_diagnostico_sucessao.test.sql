-- M16: Diagnóstico de Sucessão (versões, formulário público sem regras, envio
-- validado, triagem, CRM, limites e permissões). Conteúdo 100% fictício.
begin;
select no_plan();

create temp table u (k text primary key, id uuid) on commit drop;
create temp table r (k text primary key, v jsonb) on commit drop;
grant select, insert on u, r to authenticated, anon;

insert into u values
  ('admin', tests.create_user('admin')),
  ('editora', tests.create_user('editora'));
select tests.grant_role((select id from u where k = 'admin'), 'admin');

select tests.as_postgres();
insert into public.roles (key, name, description) values ('editora_teste', 'Editora (teste)', 'Somente teste');
insert into public.role_permissions (role_key, module, action) values
  ('editora_teste', 'questionnaires', 'read'), ('editora_teste', 'questionnaires', 'create'),
  ('editora_teste', 'questionnaires', 'update');
select tests.grant_role((select id from u where k = 'editora'), 'editora_teste');
insert into public.privacy_notice_versions (version, summary, published_at) values ('teste-diag', 'Aviso fictício', now());

insert into r values ('config', $j${
  "titulo": "Diagnóstico fictício",
  "perguntas": [
    {"chave": "papel", "texto": "Papel fictício?", "tipo": "escolha",
     "opcoes": [{"valor": "a", "rotulo": "Papel A", "papel_crm": "founder"}, {"valor": "b", "rotulo": "Papel B"}]},
    {"chave": "prazo", "texto": "Prazo fictício?", "tipo": "escolha",
     "opcoes": [{"valor": "curto", "rotulo": "Curto"}, {"valor": "medio", "rotulo": "Médio"}, {"valor": "longo", "rotulo": "Longo"}]},
    {"chave": "riscos", "texto": "Riscos fictícios?", "tipo": "multipla", "max": 2,
     "opcoes": [{"valor": "r1", "rotulo": "Risco 1"}, {"valor": "r2", "rotulo": "Risco 2"}, {"valor": "r3", "rotulo": "Risco 3"}]},
    {"chave": "tema", "texto": "Tema fictício?", "tipo": "aberta", "opcional": true}
  ],
  "regras": [
    {"nivel": "imediata", "motivo": "Motivo: prazo curto.", "quando": [{"pergunta": "prazo", "valores": ["curto"]}]},
    {"nivel": "trinta_dias", "quando": [{"pergunta": "prazo", "valores": ["medio"]}]},
    {"motivo": "Motivo: papel A com risco 1.", "quando": [{"pergunta": "papel", "valores": ["a"]}, {"pergunta": "riscos", "valores": ["r1"]}]}
  ],
  "mensagens": {
    "abertura": {"pergunta": "papel", "textos": {"a": "Abertura A."}, "padrao": "Abertura padrão."},
    "riscos": {"pergunta": "riscos", "textos": {"r1": "Faria algo sobre o risco 1."}},
    "dor": {"pergunta": "papel", "textos": {"a": "Dor A."}},
    "motivo_nutricao": "Motivo de nutrição.",
    "proximo_passo": {"imediata": "Passo imediato.", "trinta_dias": "Passo 30 dias.", "nutricao": "Passo conteúdo."}
  }
}$j$::jsonb);

-- Sem versão publicada, o formulário público não existe.
select tests.as_anon();
select is(public.triage_public_form(), null, 'sem versão publicada não há formulário');

-- Versões: conteúdo validado no banco; publicar exige permissão própria.
select tests.authenticate_as((select id from u where k = 'editora'));
select throws_ok($$ insert into public.triage_versions (version_number, config) values (1, '{"perguntas": []}') $$,
                 '23514', null, 'conteúdo sem perguntas é recusado');
select lives_ok($$ insert into public.triage_versions (version_number, config) select 1, v from r where k = 'config' $$,
                'editora cria rascunho');
select throws_ok($$ update public.triage_versions set status = 'published' where version_number = 1 $$,
                 '42501', null, 'sem permissão de publicar, não publica');

select tests.authenticate_as((select id from u where k = 'admin'));
select lives_ok($$ update public.triage_versions set status = 'published' where version_number = 1 $$, 'administradora publica');
select throws_ok($$ update public.triage_versions set config = config || '{"titulo": "Outro"}' where version_number = 1 $$,
                 '55000', null, 'versão publicada não muda');

-- Formulário público: perguntas sim, regras e mensagens não.
select tests.as_anon();
insert into r select 'form', public.triage_public_form();
select is(jsonb_array_length((select v from r where k = 'form') -> 'perguntas'), 4, 'formulário traz as 4 perguntas');
select ok(not ((select v from r where k = 'form') ? 'regras') and not ((select v from r where k = 'form') ? 'mensagens'),
          'regras e mensagens internas não saem para o público');
select ok(not ((select v from r where k = 'form') #> '{perguntas,0,opcoes,0}' ? 'papel_crm'), 'marcação de CRM não sai para o público');
select throws_ok($$ select count(*) from public.triage_versions $$, '42501', null, 'anon não lê versões');
select throws_ok($$ select count(*) from public.triage_submissions $$, '42501', null, 'anon não lê respostas');

-- Envio válido.
insert into r select 'res1', public.triage_submit(
  ((select v from r where k = 'form') ->> 'versao')::uuid,
  '{"papel": ["a"], "prazo": ["curto"], "riscos": ["r1", "r3"]}', 'Tema fictício', 'Pessoa Fictícia Um',
  'pessoa.diag@exemplo.test', null, true, false);
select is((select v ->> 'abertura' from r where k = 'res1'), 'Abertura A.', 'abertura conforme o papel');
select is((select v ->> 'proximo_passo' from r where k = 'res1'), 'Passo imediato.', 'próximo passo conforme a triagem');
select is((select jsonb_array_length(v -> 'riscos') from r where k = 'res1'), 1, 'só riscos com texto configurado');
select is((select v ->> 'nome' from r where k = 'res1'), 'Pessoa', 'trata pelo primeiro nome');
select ok(not ((select v from r where k = 'res1') ? 'nivel') and not ((select v from r where k = 'res1') ? 'motivos'),
          'a pessoa não recebe a classificação nem os motivos');
select is((select jsonb_array_length(v -> 'retrato') from r where k = 'res1'), 3, 'retrato das respostas de escolha');

-- CRM.
select tests.as_postgres();
select is((select level from public.triage_submissions s join public.participants p on p.id = s.participant_id
            where p.email = 'pessoa.diag@exemplo.test'), 'imediata', 'classificação: conversa imediata');
select is((select reasons from public.triage_submissions s join public.participants p on p.id = s.participant_id
            where p.email = 'pessoa.diag@exemplo.test'),
          array['Motivo: prazo curto.', 'Motivo: papel A com risco 1.'], 'motivos das regras atendidas');
select is((select probable_pain from public.triage_submissions s join public.participants p on p.id = s.participant_id
            where p.email = 'pessoa.diag@exemplo.test'), 'Dor A.', 'provável dor');
select is((select declared_role from public.participants where email = 'pessoa.diag@exemplo.test'), 'founder', 'papel no CRM');
select is((select count(*)::int from public.consent_records c join public.participants p on p.id = c.participant_id
            where p.email = 'pessoa.diag@exemplo.test'), 3, 'consentimentos por finalidade');
select is((select granted from public.consent_records c join public.participants p on p.id = c.participant_id
            where p.email = 'pessoa.diag@exemplo.test' and c.purpose = 'marketing'), false, 'marketing só com escolha explícita');
select is((select s.name from public.opportunities o join public.pipeline_stages s on s.id = o.stage_id
            join public.participants p on p.id = o.participant_id where p.email = 'pessoa.diag@exemplo.test'),
          'Novo contato', 'oportunidade aberta na primeira etapa do funil');

-- Mesma pessoa de novo: reaproveita a pessoa e a oportunidade.
select tests.as_anon();
select lives_ok(format($$ select public.triage_submit(%L, '{"papel": "b", "prazo": "medio", "riscos": ["r2"]}', null,
                          'Outro Nome', 'PESSOA.diag@exemplo.test') $$, (select v ->> 'versao' from r where k = 'form')),
                'segunda resposta do mesmo e-mail');
select tests.as_postgres();
select is((select count(*)::int from public.participants where lower(email) = 'pessoa.diag@exemplo.test'), 1, 'sem pessoa duplicada');
select is((select full_name from public.participants where lower(email) = 'pessoa.diag@exemplo.test'), 'Pessoa Fictícia Um',
          'não sobrescreve o nome já registrado');
select is((select count(*)::int from public.opportunities o join public.participants p on p.id = o.participant_id
            where p.email = 'pessoa.diag@exemplo.test'), 1, 'sem oportunidade duplicada');
select is((select count(*)::int from public.triage_submissions where level = 'trinta_dias'), 1, 'prazo médio: em até 30 dias');

-- Validações.
select tests.as_anon();
select throws_ok(format($$ select public.triage_submit(%L, '{"papel": ["z"], "prazo": ["curto"], "riscos": ["r1"]}', null, 'Nome', 'x@exemplo.test') $$,
                        (select v ->> 'versao' from r where k = 'form')), '22023', null, 'opção inexistente');
select throws_ok(format($$ select public.triage_submit(%L, '{"papel": ["a", "b"], "prazo": ["curto"], "riscos": ["r1"]}', null, 'Nome', 'x@exemplo.test') $$,
                        (select v ->> 'versao' from r where k = 'form')), '22023', null, 'escolha única com duas respostas');
select throws_ok(format($$ select public.triage_submit(%L, '{"papel": ["a"], "prazo": ["curto"], "riscos": ["r1", "r2", "r3"]}', null, 'Nome', 'x@exemplo.test') $$,
                        (select v ->> 'versao' from r where k = 'form')), '22023', null, 'acima do máximo da múltipla escolha');
select throws_ok(format($$ select public.triage_submit(%L, '{"papel": ["a"], "prazo": ["curto"]}', null, 'Nome', 'x@exemplo.test') $$,
                        (select v ->> 'versao' from r where k = 'form')), '22023', null, 'pergunta sem resposta');
select throws_ok(format($$ select public.triage_submit(%L, '{"papel": ["a"], "prazo": ["curto"], "riscos": ["r1"]}', null, 'Nome', 'nao-e-email') $$,
                        (select v ->> 'versao' from r where k = 'form')), '22023', null, 'e-mail inválido');
select throws_ok($$ select public.triage_submit(gen_random_uuid(), '{}', null, 'Nome', 'x@exemplo.test') $$,
                 '55000', null, 'versão que não está publicada');

-- Nutrição: nenhuma regra de nível atendida.
insert into r select 'res3', public.triage_submit(((select v from r where k = 'form') ->> 'versao')::uuid,
  '{"papel": ["b"], "prazo": ["longo"], "riscos": ["r2"]}', null, 'Pessoa Três', 'tres.diag@exemplo.test');
select is((select v ->> 'abertura' from r where k = 'res3'), 'Abertura padrão.', 'abertura padrão quando não há texto do valor');
select is((select v ->> 'proximo_passo' from r where k = 'res3'), 'Passo conteúdo.', 'nutrição por conteúdo');
select tests.as_postgres();
select is((select reasons from public.triage_submissions s join public.participants p on p.id = s.participant_id
            where p.email = 'tres.diag@exemplo.test'), array['Motivo de nutrição.'], 'motivo de nutrição registrado');

-- Limite por e-mail: 3 respostas em 24 horas.
select tests.as_anon();
select lives_ok(format($$ select public.triage_submit(%L, '{"papel": ["a"], "prazo": ["longo"], "riscos": ["r2"]}', null, 'Nome', 'pessoa.diag@exemplo.test') $$,
                       (select v ->> 'versao' from r where k = 'form')), 'terceira resposta do dia');
select throws_ok(format($$ select public.triage_submit(%L, '{"papel": ["a"], "prazo": ["longo"], "riscos": ["r2"]}', null, 'Nome', 'pessoa.diag@exemplo.test') $$,
                        (select v ->> 'versao' from r where k = 'form')), '54000', null, 'quarta resposta do dia é recusada');

-- Equipe: lê as respostas com permissão; editora de conteúdo não.
select tests.authenticate_as((select id from u where k = 'admin'));
select is((select count(*)::int from public.triage_submissions), 4, 'administradora vê as respostas');
select tests.authenticate_as((select id from u where k = 'editora'));
select is((select count(*)::int from public.triage_submissions), 0, 'quem só edita conteúdo não vê respostas');

-- Nova versão publicada arquiva a anterior; as respostas continuam ligadas à versão respondida.
select tests.authenticate_as((select id from u where k = 'admin'));
select lives_ok($$ insert into public.triage_versions (version_number, config) select 2, v from r where k = 'config' $$, 'nova versão');
select lives_ok($$ update public.triage_versions set status = 'published' where version_number = 2 $$, 'publica a nova versão');
select is((select status from public.triage_versions where version_number = 1), 'archived', 'a anterior é arquivada');
select tests.as_anon();
select throws_ok(format($$ select public.triage_submit(%L, '{"papel": ["a"], "prazo": ["curto"], "riscos": ["r1"]}', null, 'Nome', 'novo@exemplo.test') $$,
                        (select v ->> 'versao' from r where k = 'form')), '55000', null, 'formulário antigo pede para recarregar');

select * from finish();
rollback;

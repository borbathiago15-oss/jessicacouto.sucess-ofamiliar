-- M16b: leitura completa do Diagnóstico (tema, nível, por que importa e o que fazer
-- por resposta). Conteúdo 100% fictício.
begin;
select no_plan();

create temp table r (k text primary key, v jsonb) on commit drop;
grant select, insert on r to anon, authenticated;

select tests.as_postgres();
insert into public.privacy_notice_versions (version, summary, published_at) values ('teste-leitura', 'Aviso fictício', now());

insert into r values ('config', $j${
  "perguntas": [
    {"chave": "prazo", "texto": "Prazo fictício?", "dimensao": "Tempo fictício", "tipo": "escolha",
     "opcoes": [
       {"valor": "curto", "rotulo": "Curto", "leitura": {"nivel": "atencao", "porque": "Porque curto.", "fazer": "Fazer curto."}},
       {"valor": "longo", "rotulo": "Longo"}]},
    {"chave": "riscos", "texto": "Riscos fictícios?", "tipo": "multipla", "max": 2,
     "opcoes": [
       {"valor": "r1", "rotulo": "Risco 1", "leitura": {"nivel": "construcao", "porque": "Porque r1.", "fazer": "Fazer r1."}},
       {"valor": "r2", "rotulo": "Risco 2", "leitura": {"nivel": "estruturado", "porque": "Porque r2.", "fazer": "Fazer r2."}},
       {"valor": "r3", "rotulo": "Risco 3"}]}
  ],
  "mensagens": {"proximo_passo": {"imediata": "A.", "trinta_dias": "B.", "nutricao": "C."}}
}$j$::jsonb);

-- Validação no banco.
select ok(private.triage_config_ok((select v from r where k = 'config')), 'aceita leituras e temas');
select ok(not private.triage_config_ok(jsonb_set((select v from r where k = 'config'),
            '{perguntas,0,opcoes,0,leitura,nivel}', '"otimo"')), 'recusa nível de leitura desconhecido');
select ok(not private.triage_config_ok(jsonb_set((select v from r where k = 'config'),
            '{perguntas,0,opcoes,0,leitura,fazer}', '""')), 'recusa leitura sem o que fazer');
select ok(not private.triage_config_ok(jsonb_set((select v from r where k = 'config'),
            '{perguntas,0,dimensao}', to_jsonb(repeat('x', 61)))), 'recusa tema longo demais');

insert into public.triage_versions (version_number, config) select 900, v from r where k = 'config';
update public.triage_versions set status = 'published' where version_number = 900;

select tests.as_anon();
insert into r select 'res', public.triage_submit(
  (select (public.triage_public_form() ->> 'versao')::uuid),
  '{"prazo": ["curto"], "riscos": ["r1", "r3"]}', null, 'Pessoa Leitura', 'leitura@exemplo.test');
select tests.as_postgres();

select is(jsonb_array_length((select v -> 'leituras' from r where k = 'res')), 2,
          'uma leitura por opção escolhida que tem leitura');
select is((select v #>> '{leituras,0,dimensao}' from r where k = 'res'), 'Tempo fictício', 'usa o tema da pergunta');
select is((select v #>> '{leituras,0,nivel}' from r where k = 'res'), 'atencao', 'traz o nível');
select is((select v #>> '{leituras,0,porque}' from r where k = 'res'), 'Porque curto.', 'traz por que importa');
select is((select v #>> '{leituras,0,fazer}' from r where k = 'res'), 'Fazer curto.', 'traz o que fazer');
select is((select v #>> '{leituras,1,dimensao}' from r where k = 'res'), 'Riscos fictícios?',
          'sem tema, usa o texto da pergunta');
select ok(not ((select v from r where k = 'res') ? 'nivel'), 'a classificação interna continua fora da resposta');

select * from finish();
rollback;

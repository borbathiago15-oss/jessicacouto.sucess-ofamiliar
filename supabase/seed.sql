-- =============================================================================
-- Seed de desenvolvimento local — SOMENTE DADOS FICTÍCIOS.
-- Não contém metodologia, perguntas reais, textos institucionais ou pessoas reais.
-- Usado no desenvolvimento local e no teste de backup/restauração do CI.
-- Os testes pgTAP rodam com `supabase db reset --no-seed`.
-- =============================================================================

-- Usuária fictícia sem senha (não consegue entrar; serve de referência de autoria).
-- Os campos de token precisam ser texto vazio (não nulo) para o Supabase Auth listar usuários.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, recovery_token, email_change_token_new, email_change,
                        email_change_token_current, phone_change, phone_change_token, reauthentication_token)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'admin.ficticia@exemplo.test', '', now(),
        '{"provider":"email","providers":["email"]}', '{}', now(), now(),
        '', '', '', '', '', '', '', '');

update public.profiles set display_name = 'Administradora Fictícia'
where id = '00000000-0000-4000-8000-000000000001';
insert into public.user_roles (user_id, role_key) values ('00000000-0000-4000-8000-000000000001', 'admin');

-- As etapas do funil vêm da migration (etapas padrão).

insert into public.organizations (id, trade_name, segment, size_band, owner_id) values
  ('00000000-0000-4000-8000-000000000201', 'Empresa Exemplo Alfa', 'Segmento fictício', 'faixa-1', '00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000202', 'Empresa Exemplo Beta', 'Segmento fictício', 'faixa-2', '00000000-0000-4000-8000-000000000001');

insert into public.participants (id, full_name, email, declared_role, owner_id) values
  ('00000000-0000-4000-8000-000000000301', 'Pessoa Exemplo Um', 'pessoa.um@exemplo.test', 'founder', '00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000302', 'Pessoa Exemplo Dois', 'pessoa.dois@exemplo.test', 'successor', '00000000-0000-4000-8000-000000000001');

insert into public.organization_participants (organization_id, participant_id, role_in_org) values
  ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000301', 'papel fictício'),
  ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000302', 'papel fictício');

insert into public.privacy_notice_versions (id, version, summary, published_at) values
  ('00000000-0000-4000-8000-000000000401', 'ficticio-1', 'Aviso fictício para desenvolvimento', now());

insert into public.consent_records (participant_id, purpose, granted, notice_version_id, source) values
  ('00000000-0000-4000-8000-000000000301', 'service_delivery', true, '00000000-0000-4000-8000-000000000401', 'seed'),
  ('00000000-0000-4000-8000-000000000301', 'contact', true, '00000000-0000-4000-8000-000000000401', 'seed'),
  ('00000000-0000-4000-8000-000000000301', 'marketing', false, '00000000-0000-4000-8000-000000000401', 'seed');

insert into public.opportunities (id, organization_id, stage_id, title, owner_id) values
  ('00000000-0000-4000-8000-000000000501', '00000000-0000-4000-8000-000000000201',
   (select id from public.pipeline_stages where position = 10), 'Oportunidade fictícia', '00000000-0000-4000-8000-000000000001');

-- Questionário fictício genérico (sem conteúdo metodológico real).
insert into public.instruments (id, key, name) values
  ('00000000-0000-4000-8000-000000000601', 'instrumento_exemplo', 'Instrumento de exemplo');
insert into public.questionnaires (id, instrument_id, title) values
  ('00000000-0000-4000-8000-000000000602', '00000000-0000-4000-8000-000000000601', 'Questionário de exemplo');
insert into public.questionnaire_versions (id, questionnaire_id, version_number) values
  ('00000000-0000-4000-8000-000000000603', '00000000-0000-4000-8000-000000000602', 1);
insert into public.dimensions (id, version_id, key, title) values
  ('00000000-0000-4000-8000-000000000604', '00000000-0000-4000-8000-000000000603', 'dimensao_a', 'Dimensão A');
insert into public.questions (id, version_id, dimension_id, key, prompt, kind) values
  ('00000000-0000-4000-8000-000000000605', '00000000-0000-4000-8000-000000000603',
   '00000000-0000-4000-8000-000000000604', 'pergunta_1', 'Pergunta 1', 'scale');
insert into public.question_options (id, question_id, label, value) values
  ('00000000-0000-4000-8000-000000000606', '00000000-0000-4000-8000-000000000605', 'Opção 1', 1),
  ('00000000-0000-4000-8000-000000000607', '00000000-0000-4000-8000-000000000605', 'Opção 2', 2);
update public.questionnaire_versions
   set status = 'published', approved_by = '00000000-0000-4000-8000-000000000001'
 where id = '00000000-0000-4000-8000-000000000603';

insert into public.diagnostic_sessions (id, version_id, participant_id, organization_id) values
  ('00000000-0000-4000-8000-000000000701', '00000000-0000-4000-8000-000000000603',
   '00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000201');
insert into public.answers (session_id, version_id, question_id, option_id, value_numeric) values
  ('00000000-0000-4000-8000-000000000701', '00000000-0000-4000-8000-000000000603',
   '00000000-0000-4000-8000-000000000605', '00000000-0000-4000-8000-000000000607', 2);
update public.diagnostic_sessions set status = 'completed' where id = '00000000-0000-4000-8000-000000000701';
insert into public.diagnostic_results (session_id, version_id, engine_version, result) values
  ('00000000-0000-4000-8000-000000000701', '00000000-0000-4000-8000-000000000603', 'exemplo-0', '{"dimensao_a": 2}');

-- CMS fictício.
insert into public.cms_pages (id, slug, title) values
  ('00000000-0000-4000-8000-000000000801', 'pagina-exemplo', 'Página de exemplo');
insert into public.cms_page_versions (id, page_id, version_number, content) values
  ('00000000-0000-4000-8000-000000000802', '00000000-0000-4000-8000-000000000801', 1, '{"blocos":[{"tipo":"texto","paragrafos":["Texto fictício"]}]}');
update public.cms_page_versions set status = 'in_review' where id = '00000000-0000-4000-8000-000000000802';
update public.cms_page_versions set status = 'published' where id = '00000000-0000-4000-8000-000000000802';

-- -----------------------------------------------------------------------------
-- Páginas do site (M3): conteúdo GENÉRICO de exemplo, publicado para o ambiente
-- local. Os textos reais são escritos pela Jéssica no CMS, nunca no repositório.
-- -----------------------------------------------------------------------------
insert into public.cms_pages (id, slug, title) values
  ('00000000-0000-4000-8000-000000000901', 'inicio', 'Início'),
  ('00000000-0000-4000-8000-000000000902', 'conheca-jessica', 'Conheça Jéssica'),
  ('00000000-0000-4000-8000-000000000903', 'metodologia', 'Metodologia'),
  ('00000000-0000-4000-8000-000000000904', 'diagnosticos', 'Diagnósticos'),
  ('00000000-0000-4000-8000-000000000905', 'guias', 'Guias'),
  ('00000000-0000-4000-8000-000000000906', 'contato', 'Vamos conversar'),
  ('00000000-0000-4000-8000-000000000907', 'privacidade', 'Política de Privacidade');

insert into public.cms_page_versions (page_id, version_number, content) values
  ('00000000-0000-4000-8000-000000000901', 1, $json${"blocos":[
    {"tipo":"hero","chamada":"Chamada de exemplo","titulo":"Título de exemplo da página inicial","texto":"Texto de apoio de exemplo. O conteúdo definitivo é escrito no CMS.","ctaPrimario":{"rotulo":"Fazer o diagnóstico","href":"/diagnosticos"},"ctaSecundario":{"rotulo":"Receber o guia","href":"/guias"}},
    {"tipo":"texto","titulo":"Seção de exemplo","paragrafos":["Parágrafo de exemplo um.","Parágrafo de exemplo dois."]},
    {"tipo":"movimentos","titulo":"Movimentos de exemplo","itens":[{"nome":"Primeiro","descricao":"Descrição de exemplo"},{"nome":"Segundo","descricao":"Descrição de exemplo"},{"nome":"Terceiro","descricao":"Descrição de exemplo"}]},
    {"tipo":"caminhos","titulo":"Caminhos de exemplo","itens":[{"titulo":"Caminho A","descricao":"Descrição de exemplo","href":"/diagnosticos"},{"titulo":"Caminho B","descricao":"Descrição de exemplo","href":"/diagnosticos"}]},
    {"tipo":"destaque","chamada":"Destaque de exemplo","titulo":"Título do destaque","texto":"Texto do destaque de exemplo.","cta":{"rotulo":"Saiba mais","href":"/guias"}}
  ]}$json$),
  ('00000000-0000-4000-8000-000000000902', 1, '{"blocos":[{"tipo":"texto","titulo":"Página de exemplo","paragrafos":["Conteúdo de exemplo."]}]}'),
  ('00000000-0000-4000-8000-000000000903', 1, '{"blocos":[{"tipo":"texto","titulo":"Página de exemplo","paragrafos":["Conteúdo de exemplo."]}]}'),
  ('00000000-0000-4000-8000-000000000904', 1, '{"blocos":[{"tipo":"texto","titulo":"Página de exemplo","paragrafos":["Conteúdo de exemplo."]}]}'),
  ('00000000-0000-4000-8000-000000000905', 1, '{"blocos":[{"tipo":"texto","titulo":"Página de exemplo","paragrafos":["Conteúdo de exemplo."]}]}'),
  ('00000000-0000-4000-8000-000000000906', 1, '{"blocos":[{"tipo":"texto","titulo":"Página de exemplo","paragrafos":["Conteúdo de exemplo."]}]}'),
  ('00000000-0000-4000-8000-000000000907', 1, '{"blocos":[{"tipo":"texto","titulo":"Política de exemplo","paragrafos":["Texto fictício. A política real depende de revisão jurídica."]}]}');

update public.cms_page_versions set status = 'in_review'
 where page_id between '00000000-0000-4000-8000-000000000901' and '00000000-0000-4000-8000-000000000907';
update public.cms_page_versions set status = 'published'
 where page_id between '00000000-0000-4000-8000-000000000901' and '00000000-0000-4000-8000-000000000907';

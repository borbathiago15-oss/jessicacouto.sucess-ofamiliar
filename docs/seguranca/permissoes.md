# Matriz de permissões (M1)

Fonte da verdade: tabelas `public.roles`, `public.permissions` e `public.role_permissions`, a migration `20261123000300_identity_access.sql` e o teste `supabase/tests/060_role_permission_matrix.test.sql`. Qualquer mudança na matriz exige atualizar o teste e este documento.

## Regras gerais (valem para todos os papéis)

1. **MFA obrigatório no banco.** Toda permissão exige uma sessão **AAL2** (TOTP verificado), uma **sessão viva** em `auth.sessions` (revogação imediata) e um **perfil ativo**. Em AAL1, nenhum papel tem qualquer permissão.
2. **Público anônimo** (`anon`): nenhum acesso a tabelas. Lê apenas o conteúdo publicado do CMS, via `cms_get_published_page()`.
3. **Isolamento por carteira:** sem `crm.access_all`, cada pessoa acessa só as empresas e pessoas pelas quais é responsável (`owner_id`) ou às quais foi atribuída (`organization_assignments`). Vínculos, oportunidades, atividades, notas e consentimentos exigem acesso a **todos** os alvos referenciados.
4. **A administradora** tem todas as permissões. Essas permissões não podem ser removidas, e o sistema impede remover ou desativar a última administradora ativa.
5. **Toda mudança de papel ou de matriz é auditada** com valores.

## Matriz inicial

✅ = concedido · — = negado

| Permissão                                                             | Admin | Relacionamento | Analista metodológico | Leitura executiva |
| --------------------------------------------------------------------- | :---: | :------------: | :-------------------: | :---------------: |
| users.read / users.manage                                             |  ✅   |       —        |           —           |         —         |
| audit.read                                                            |  ✅   |       —        |           —           |         —         |
| crm.access_all (todas as carteiras)                                   |  ✅   |       —        |           —           |        ✅         |
| organizations.read / create / update                                  |  ✅   |       ✅       |           —           |         —         |
| organizations.delete                                                  |  ✅   |       —        |           —           |         —         |
| participants.read / create / update                                   |  ✅   |       ✅       |           —           |         —         |
| participants.delete                                                   |  ✅   |       —        |           —           |         —         |
| consents.read / create                                                |  ✅   |       ✅       |           —           |         —         |
| consents.manage (avisos de privacidade)                               |  ✅   |       —        |           —           |         —         |
| campaigns.read                                                        |  ✅   |       ✅       |           —           |        ✅         |
| campaigns.manage                                                      |  ✅   |       —        |           —           |         —         |
| pipeline.read                                                         |  ✅   |       ✅       |           —           |        ✅         |
| pipeline.manage                                                       |  ✅   |       —        |           —           |         —         |
| opportunities.read                                                    |  ✅   |       ✅       |           —           |        ✅         |
| opportunities.create / update                                         |  ✅   |       ✅       |           —           |         —         |
| opportunities.delete                                                  |  ✅   |       —        |           —           |         —         |
| activities.read / create / update                                     |  ✅   |       ✅       |           —           |         —         |
| activities.delete                                                     |  ✅   |       —        |           —           |         —         |
| internal_notes.read / create (edita as próprias)                      |  ✅   |       ✅       |           —           |         —         |
| internal_notes.manage (edita as de terceiros)                         |  ✅   |       —        |           —           |         —         |
| questionnaires.read / create / update                                 |  ✅   |       —        |          ✅           |         —         |
| questionnaires.delete (rascunhos)                                     |  ✅   |       —        |           —           |         —         |
| questionnaires.publish (aprovar piloto e publicação)                  |  ✅   |       —        |           —           |         —         |
| analyses.read / manage (Raio-X Financeiro)                            |  ✅   |       —        |           —           |         —         |
| vault.read / upload / download / delete (cofre)                       |  ✅   |       —        |           —           |         —         |
| diagnostics.read (sessões e resultados da carteira)                   |  ✅   |       ✅       |           —           |         —         |
| diagnostics.read_answers (respostas individuais)                      |  ✅   |       —        |           —           |         —         |
| diagnostics.manage                                                    |  ✅   |       —        |           —           |         —         |
| reports.read                                                          |  ✅   |       ✅       |           —           |         —         |
| proposals.read / manage (propostas comerciais)                        |  ✅   |       ✅       |           —           |         —         |
| proposals.catalog (etapas, valor-hora, condições)                     |  ✅   |       —        |           —           |         —         |
| reports.manage (assinatura e metodologia dos relatórios)              |  ✅   |       —        |           —           |         —         |
| portal.manage (acesso de clientes ao portal, publicar para o cliente) |  ✅   |       ✅       |           —           |         —         |
| cms.read / create / update                                            |  ✅   |       —        |          ✅           |         —         |
| cms.publish                                                           |  ✅   |       —        |           —           |         —         |
| exports.create                                                        |  ✅   |       —        |           —           |         —         |

## Decisões pendentes da Jéssica

- O analista metodológico deve ver resultados agregados ou pseudonimizados dos diagnósticos?
- A equipe de relacionamento deve ver respostas individuais (`diagnostics.read_answers`)?
- A leitura executiva deve ver as fichas de empresas, ou só os indicadores?
- A equipe de relacionamento deve ter carteira restrita (padrão atual) ou acesso a todas as empresas?

Todas essas mudanças são configuráveis por uma administradora, sem alterar código, e ficam auditadas.

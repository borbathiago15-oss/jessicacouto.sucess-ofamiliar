# 0007: CI como ambiente oficial dos testes de banco

**Status:** aceita · **Data:** 2026-11-22 · **Módulo:** M0

## Contexto

Os testes de banco (migrations, RLS, MFA/AAL2, isolamento, imutabilidade, backup e
restauração) exigem uma instância do Supabase, que localmente depende de Docker. O Docker
Desktop não iniciou na máquina de desenvolvimento, e sua licença é paga para empresas acima
de determinado porte. A cliente final opera apenas pelo navegador; nenhuma ferramenta local é
necessária para ela.

## Decisão

- O job `database` do GitHub Actions é o **ambiente oficial** dos testes de banco: sobe o
  Supabase em containers efêmeros, executa `db reset`, `db lint` e `test db`, e descarta tudo.
- Nenhum projeto remoto do Supabase é criado ou utilizado para testes.
- Docker local é **opcional**: quem o tiver pode rodar `npx supabase start` e
  `npx supabase test db` com os mesmos comandos do CI.

## Consequências

- Os testes são reproduzíveis por qualquer pessoa que assuma o projeto, sem depender de uma máquina.
- O ciclo de feedback dos testes de banco passa pelo PR (alguns minutos por execução).
- Nenhum valor de credencial é impresso nos logs do CI: as senhas da instância efêmera são mascaradas.

# 0019: Artigos e página de serviços no site

**Status:** aceita · **Data:** 2026-11-23 · **Módulo:** M11

## Decisão

- **Artigos são páginas do CMS** com endereço `artigos/<nome>`. Reaproveitam o mesmo fluxo de rascunho → revisão → publicação, a imutabilidade das versões publicadas e a política de mídias. Resumo, tema e capa ficam dentro do conteúdo da versão, então mudam junto com o texto.
- **Lista pública por função do banco** (`cms_list_published_articles`): só o que está publicado, com a data da primeira publicação (revisões não mudam a data do artigo).
- **Página do artigo pensada para converter:** tema, data, tempo de leitura, autora, chamada para o diagnóstico e para conversar com a Jéssica, "leia também" do mesmo tema e dados estruturados (schema.org) para buscadores.
- **Temas iniciais:** planejar a sucessão, riscos de não planejar, o que uma boa sucessão traz, família e empresa, governança, sucessores e herdeiros, patrimônio e finanças, casos e aprendizados. A lista é código (estrutura); os textos são da Jéssica, no CMS.
- **Página "Serviços"** no menu, com um bloco próprio do CMS: para cada serviço, para quem é, o que entrega, formato e um link. O portfólio é editado pela Jéssica, sem mexer no código.
- **Editor único:** o mesmo editor de blocos edita páginas e artigos; as ações do servidor ficam num núcleo comum.

## Consequências e pendências

- O endereço do artigo é definido pelo título na criação e não muda depois (para não quebrar links compartilhados); o título exibido pode ser ajustado.
- Comentários, newsletter e compartilhamento em redes ficam para depois.

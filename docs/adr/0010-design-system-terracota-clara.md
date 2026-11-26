# 0010: Design system "terracota clara"

**Status:** aceita · **Data:** 2026-11-23 · **Módulo:** M2

## Contexto

O Documento Mestre (§3.2) previa bordô, dourado, bege, grafite e verde profundo. Na apresentação do protótipo, o proprietário decidiu trocar as "cores pesadas" por uma paleta terracota clara, mais leve e próxima do que a Jéssica comunica. A decisão ainda será validada com a Jéssica.

## Decisão

- **Cores:** porcelana, papel, blush, linho e sálvia clara (superfícies); terracota, terracota-texto, champanhe e sálvia (marca); cacau e mudo (texto); ok, atenção e crítico (estados).
- **Fonte da verdade:** `src/styles/tokens.css` (tema do Tailwind 4). O espelho `src/styles/tokens.ts` é usado em gráficos SVG. Um teste exige paridade entre os dois e contraste **WCAG AA (≥ 4,5:1)** em todos os pares de texto declarados.
- **Tipografia:** Newsreader (títulos) e Figtree (texto), via `next/font`. A Bodoni Moda original foi trocada em 2026-11-29: o contraste extremo entre traços dificultava a leitura em tamanhos médios. As fontes são baixadas no build e servidas pelo próprio site: nenhuma chamada a terceiros em tempo de execução, e a CSP continua com `font-src 'self'`.
- **Elemento de marca:** o "fio da continuidade", uma linha contínua com um ponto em terracota (`FioContinuidade`), e o monograma JC.
- **Componentes base:** em `src/components/ui`; gráficos (radar, medidor, barras) em `src/components/charts`, em SVG puro, para uso no site, no PDF e no CRM. "Dados insuficientes" nunca é desenhado como zero.
- **Referência visual:** `/design`, indisponível em produção.
- **Acessibilidade:** testes axe (WCAG 2.1 A/AA) no CI para as telas existentes, em desktop e mobile.

## Consequências

- Trocar a paleta ou as fontes (por exemplo, Playfair Display e Montserrat, como no quadro de marca anterior) é uma mudança localizada em tokens e no `layout.tsx`.
- As faixas de leitura dos gráficos são **exemplos** até a aprovação metodológica (§7.2).
- Fotografias da Jéssica só entram com autorização e a partir dos arquivos originais.

## Revisão de 2026-11-24: creme, marrom e mostarda

A pedido do proprietário, a paleta passou a ser **creme, marrom e mostarda**, por trazer mais sofisticação à marca.

- **Cremes** nas superfícies (`porcelana`, `papel`, `blush`, `linho`), **marrons** no texto e na marca (`cacau`, `terra-texto`, `terra-escuro`) e **mostarda** nos destaques (`terra`): linhas, marcadores, barras e gráficos. `champanhe` virou areia, para séries secundárias.
- Os **nomes dos tokens foram mantidos** para a troca valer na plataforma inteira sem mexer em cada tela; o significado de cada um está no cabeçalho de `src/styles/tokens.css`.
- **Mostarda nunca é usada em texto:** sobre o creme ela não atinge o contraste de leitura. Como elemento gráfico, atinge 3:1 (WCAG 1.4.11), verificado em `tests/unit/design-tokens.test.ts`. Todos os pares de texto seguem com WCAG AA (≥ 4,5:1).

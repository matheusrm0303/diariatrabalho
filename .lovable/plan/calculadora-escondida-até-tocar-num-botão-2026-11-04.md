## Calculadora escondida até tocar num botão

- Na linha "Novo lançamento" (ao lado de "Cobrar" e "Diária rápida") entra um botão **"Simular"** com ícone de calculadora.
- O quadro "Simular dias futuros" some da tela principal por padrão.
- Ao tocar em "Simular", a calculadora abre numa janela (no celular sobe de baixo, ocupando a tela com rolagem), com os mesmos campos e cálculos de hoje e um botão de fechar.
- Os números simulados continuam salvos: ao reabrir, aparecem como estavam.

### Detalhes técnicos
- `diarias-tab.tsx`: estado `simuladorAberto`; remover `<SimuladorCard>` inline; botão no header; renderizar dentro de um `Dialog` (max-h com overflow-y-auto) só quando aberto.
- `simulador-card.tsx`: aceitar prop `embutido` para ocultar o cabeçalho colapsável/margem e mostrar o conteúdo sempre aberto.
- Lógica em `simulador.ts` e testes inalterados.

# Scalipus — Clube de Setúbal

## Novidades

- Logótipo do clube aplicado ao site e aos ícones.
- Visão geral com relatório de participação por jogador: presenças confirmadas / total de jogos passados × 100. Confirmações de jogos futuros não contam e não é inventada uma percentagem quando não há jogos passados.
- Fusão de jogadores reservada ao Master por defeito. O Master pode autorizar e revogar a operação individualmente para cada administrador, em Perfil → Permissões do grupo → Permitir fusão. Um administrador não pode atribuir essa permissão.

![Relatório e logótipo](preview.png)

## Níveis de acesso

| Nível | Operações |
| --- | --- |
| Master | Todas as operações e gestão de permissões. |
| Administrador | Jogos, jogadores, presenças, parcelas e anulações; fusões só com autorização explícita do Master. |
| Utilizador | Adicionar o próprio nome e marcar a própria presença. Não acede a valores pagos. |

As parcelas, datas, observações, autoria e anulações são mantidas no histórico. A fusão reúne as presenças sem duplicar a mesma data, conserva as parcelas e arquiva a ficha absorvida.

![Histórico de pagamentos](payments-preview.png)

## Descarregar

Abre Scalitpus-demo.zip e escolhe Download raw file. Extrai o ZIP e abre scalitpus-demo.html. O seletor Testar nível permite explorar os três perfis nesta demonstração. Dados fictícios e locais, sem sincronização entre dispositivos. A versão real requer Supabase e alojamento.

Validado com compilação, 11 testes de domínio, 12 testes de navegador e verificações SQL de privacidade financeira, delegação e revogação de fusão, migração e integridade do histórico.

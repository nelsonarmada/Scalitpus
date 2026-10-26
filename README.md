# Scalitpus — permissões, pagamentos e fusões

| Nível | Permissões |
| --- | --- |
| Master | Todas as operações e atribuição/remoção de administradores. |
| Administrador | Jogos, jogadores, presenças, parcelas, anulações e fusão de duplicados. |
| Utilizador | Adicionar o próprio nome e marcar apenas a própria presença. Sem acesso a pagamentos. |

## Parcelas transferidas

A tab Valores pagos é exclusiva da administração. O histórico apresenta valor, data da transferência, observação e autor do registo. O total soma as parcelas válidas. Uma anulação exige motivo e conserva o registo.

![Histórico de pagamentos](payments-preview.png)

## Fusão de fichas

O administrador escolhe a ficha absorvida e a ficha que fica. Presenças coincidentes contam uma vez. Todas as parcelas, incluindo anuladas, mantêm o histórico. A ficha absorvida é arquivada e o seu acesso é invalidado; o acesso da ficha que fica é mantido. As parcelas válidas são somadas: caso exista uma transferência duplicada, anula-a explicitamente no histórico.

![Mapa de participações](preview.png)

## Descarregar

Abre Scalitpus-demo.zip e escolhe Download raw file. Extrai o ZIP e abre scalitpus-demo.html no navegador. O seletor Testar nível permite experimentar os três níveis, apenas nesta demonstração. Os dados são fictícios, locais e não partilhados entre dispositivos.

Versão validada com compilação, 7 testes de domínio, 11 testes de navegador e testes PostgreSQL de permissões, privacidade financeira, anulações, fusão num jogo cheio, migração e revogação de acessos. Na versão real, o servidor omite montantes e histórico para utilizadores normais. A demonstração não substitui autenticação e base de dados reais.

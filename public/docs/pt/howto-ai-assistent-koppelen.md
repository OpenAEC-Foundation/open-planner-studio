# Ligar um assistente de IA (MCP)

Objetivo: permitir que um assistente de IA acompanhe e trabalhe no seu planeamento, com visibilidade sobre o que faz e com limites que o utilizador define.

## Quando precisa disto

Quer que um assistente de IA leia, analise ou altere o seu planeamento. Por exemplo, para que elabore um primeiro WBS, corrija tarefas ou explique o caminho crítico. Isto funciona através do **Model Context Protocol** (MCP): uma norma que permite a um assistente de IA usar ferramentas de um programa. Para isso, o Open Planner Studio executa um pequeno servidor no seu próprio computador, a **ponte**. Oferece um conjunto de ferramentas, todas com um nome que começa por `planner_`: ler e alterar tarefas, relações, recursos, calendários, linhas de base, documentos e ficheiros. Quais existem e o que não permitem está em [Ferramentas de IA](docs://ref-ai-tools); porque é que a ligação funciona assim está em [Como funciona a ligação à IA](docs://uitleg-ai-koppeling).

A ponte só funciona na aplicação desktop. Se ativar o modo IA no navegador, vê o separador *IA*, mas o botão *Iniciar ponte* fica cinzento com o texto *A ponte só funciona na aplicação desktop.* O resto deste artigo trata da aplicação desktop. No navegador, *Criar cópia de segurança agora* e *Abrir pasta de cópias de segurança* também ficam cinzentos.

## Passos

### 1. Ativar o modo IA

1. Escolha *Definições › Projeto › Definições da app*. Também pode escolher *Ficheiro › Definições da app*, ou o ícone de engrenagem no topo.
2. Escolha o separador *Avançado* e ative *Ativar modo IA*. Aparece o separador *IA* no friso.
3. Se quiser que a ponte fique ativa logo que a aplicação arranque, ative também *Iniciar a ponte automaticamente*. Isto só se aplica quando o modo IA está ativo, e só funciona na aplicação de ambiente de trabalho. Por padrão, está desativada, porque abrir uma porta é uma escolha deliberada.

Se desativar o modo IA, a ponte para e o separador *IA* desaparece.

### 2. Iniciar a ponte

1. Vá ao separador *IA* e clique em *Iniciar ponte* em *Servidor*.
2. Veja o estado ao lado do botão. Mostra *Desligada*, *Ativa na porta 3877*, *Porta 3877 ocupada* ou *Erro*. Se o arranque tiver êxito, mostra *Ativa na porta 3877* e o botão chama-se *Parar ponte*. Com *Porta 3877 ocupada* ou *Erro*, o botão continua a chamar-se *Iniciar ponte*; veja os problemas comuns.

A ponte só escuta no seu próprio computador, numa única porta. Por padrão, é a 3877. No grupo *Ligação* pode escolher outra em *Porta*, mas só com a ponte parada.

### 3. Ligar o assistente

1. Clique em *Conectar* em *Ligação*. Abre-se a janela *Detalhes de ligação*.
2. Escolha o que o seu cliente precisa, veja abaixo.
3. O token fica oculto. Com o ícone de olho, mostra-o. Os botões de cópia copiam sempre o valor real, mesmo quando o ecrã oculta o token.
4. Peça ao assistente a lista de ferramentas. Essa verificação também faz parte do prompt de ligação: deve ver as ferramentas com o prefixo `planner_`; o número esperado está no prompt de ligação.

A janela oferece três formas de ligação:

- *Excerto de configuração*: um excerto de configuração que cola nas definições MCP do seu cliente.
- *Prompt de ligação*: um texto que cola no seu assistente de IA, depois do qual ele se liga sozinho.
- *Ponto final* e *Autenticação*: os detalhes separados. O ponto final é `http://localhost:3877/mcp` com transporte *HTTP em fluxo*. Cada pedido precisa de um cabeçalho `Authorization: Bearer` seguido do seu token. O seu cliente também tem de ser compatível com sessões MCP: ao ligar-se, a ponte entrega um código de sessão no cabeçalho `Mcp-Session-Id`, e recusa todos os pedidos seguintes sem esse código. O Claude Code e o `mcp-remote` fazem isto sozinhos.

**Volte a ligar depois de uma atualização da aplicação.** Se o seu cliente de IA já estava ligado a uma versão mais antiga da aplicação, ainda não envia um código de sessão, e a ponte recusa todos os pedidos. Por isso, volte a ligar depois da atualização: inicie uma nova sessão no Claude Code e feche o Claude Desktop por completo e inicie-o de novo.

**Claude Code.** O excerto de configuração funciona diretamente com o Claude Code. Dê este comando num terminal, com o seu token no lugar de `<token>`:

```
claude mcp add --transport http open-planner-studio http://localhost:3877/mcp --header "Authorization: Bearer <token>"
```

Também pode pôr o excerto no ficheiro `.mcp.json` na pasta do projeto. Nesse caso, não coloque esse ficheiro no git, porque o token dá acesso ao seu plano. Um servidor de `.mcp.json` tem de ser aprovado na primeira vez no Claude Code.

**Claude Desktop.** O excerto de configuração não funciona diretamente no Claude Desktop. No ficheiro `claude_desktop_config.json` indica-se um programa que o Claude Desktop inicia por si, e não um endereço. Por isso, use a ferramenta externa `mcp-remote` como intermediária; ela precisa do Node.js. No Claude Desktop, escolha *Definições › Programador › Editar configuração*, coloque isto no ficheiro (com o seu token) e inicie o Claude Desktop de novo:

```
{
  "mcpServers": {
    "open-planner-studio": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://localhost:3877/mcp", "--header", "Authorization:${AUTH_HEADER}"],
      "env": { "AUTH_HEADER": "Bearer <token>" }
    }
  }
}
```

O token está em `env` e não em `args` de propósito: no Windows, o Claude Desktop quebra um argumento que contém um espaço. Um *conector personalizado* no Claude (*Personalizar › Conectores*) não funciona com a ponte. O Claude liga-se então a partir da nuvem da Anthropic, e essa nuvem não consegue chegar à ponte no seu computador.

No grupo *Ligação* está também o campo *Token*. É um código longo e aleatório que a aplicação cria para o utilizador e guarda neste computador. Na janela aparece *Este token dá acesso ao plano aberto. Não o partilhe com outras pessoas.* Com o ícone *Novo token* cria um novo token. A aplicação pergunta primeiro *Gerar um novo token quebra todas as ligações existentes. Continuar?* Se a ponte estiver em execução, reinicia com o novo token, e o antigo deixa de funcionar.

### 4. Ver o que a IA faz

1. Clique em *Painel de atividade* em *Atividade*. Na lateral abre-se o painel *Atividade de IA*.
2. Cada chamada da ponte fica numa linha, a mais recente no topo: a hora, o que aconteceu, quanto tempo demorou e se teve êxito ou falhou. Clique numa linha para expandir *Argumentos* e *Resposta*.
3. Com *Limpar* esvazia a lista. O painel guarda as últimas 500 chamadas. Enquanto nada tiver acontecido, mostra *Ainda sem atividade de IA. As chamadas da ponte aparecerão aqui.*

Com o modo IA ativo, aparece um ponto com *IA* no canto inferior direito da barra de estado. A cor mostra o estado da ponte, e um clique nele leva-o ao separador *IA*.

### 5. Definir limites

Em *Segurança* estão os botões com que limita a IA:

- *Pausar*: a IA não pode alterar nada durante algum tempo, mas a leitura continua permitida. A ponte continua ativa. O botão passa a *Retomar*.
- *Só leitura*: enquanto estiver ativo, todas as ferramentas que alteram algo são recusadas.
- *Cópia de segurança automática: ativada*: antes da primeira alteração da IA num documento, a aplicação escreve uma cópia de segurança IFC. Está ativada por padrão. Com o botão, desative-a; então mostra *Cópia de segurança automática: desativada*. Isto acontece uma vez por documento, sempre que inicia a ponte.
- *Criar cópia de segurança agora*: cria de imediato uma cópia de segurança do documento ativo. Depois mostra *Cópia de segurança criada:* com o nome do ficheiro.
- *Abrir pasta de cópias de segurança*: abre a pasta com as cópias de segurança.

As cópias de segurança estão na pasta `ai-backups`, na pasta de dados da aplicação. A aplicação guarda as cópias recentes e reduz as mais antigas; a forma exata está em [Ferramentas de IA](docs://ref-ai-tools).

### 6. Fazer com que o assistente planeie bem

O assistente só planeia bem se conhecer as regras de planeamento. Porque é que isso importa e o que lá está, pode ler em [Como funciona a ligação à IA](docs://uitleg-ai-koppeling). Isto cabe a si:

1. **Não faça nada quanto às regras principais.** Chegam com a ligação. Se o seu cliente as coloca no prompt de sistema, isso depende do cliente.
2. **Peça que o guia seja lido.** O prompt de ligação da janela *Detalhes de ligação* pede ao assistente que leia o guia com a ferramenta `planner_get_planning_guide`. Se não usar o prompt, peça ao assistente: *Leia primeiro o guia de planeamento com planner_get_planning_guide, antes de alterar qualquer coisa.* Também pode ler o guia em `https://open-planner-studio.open-aec.com/agent/planning-guide.md`.
3. **Opcional: instale as skills.** Isto só funciona com um assistente que seja compatível com skills. Coloque o `SKILL.md` de *goed-plannen* e de *progress-update* em `.claude/skills/goed-plannen/SKILL.md` e `.claude/skills/progress-update/SKILL.md` na pasta do projeto em que o assistente trabalha, ou em `~/.claude/skills/` para todos os projetos.

Pode obter os ficheiros de duas formas. Peça ao assistente que chame a ferramenta `planner_get_planning_guide` com `part` definido como `skill`: a resposta contém os dois textos e, para cada skill, os locais onde deve ficar. Ou descarregue-os de `https://open-planner-studio.open-aec.com/skills/goed-plannen/SKILL.md` e `https://open-planner-studio.open-aec.com/skills/progress-update/SKILL.md`. Se *goed-plannen* ainda estiver lá de uma versão anterior da aplicação, substitua-a: esse texto antigo está em neerlandês e remete para o artigo de Ajuda, em vez do guia para assistentes.

Pode ver se o assistente leu mesmo o guia no *Painel de atividade*: aparece então uma chamada de `planner_get_planning_guide`. A resposta final deve conter uma lista de pressupostos: durações estimadas, a decomposição escolhida, as relações que criou por si e cada restrição que definiu. Se esta lista faltar, peça-a. Depois de uma atualização de progresso segundo *progress-update*, a resposta deve indicar a data de estado, a nova data de fim e o desvio em relação à linha de base.

## Problemas comuns e o que a aplicação faz então

**A IA altera algo que o utilizador quer desfazer.** Cada alteração da IA é um passo que pode desfazer com *Desfazer* (Ctrl+Z). Uma série de alterações que a IA transmite como um todo é um só passo. Depois, o projeto aparece como não guardado. Após uma alteração, o planeamento volta a ser calculado, por isso não tem de premir F5.

**A aplicação recusa uma chamada da IA.** Com *Pausar* e *Só leitura*, a aplicação recusa todas as alterações, e a leitura continua possível, incluindo recalcular um planeamento desatualizado. Se estiver a meio de uma edição, como arrastar uma barra ou escrever num campo, a IA recebe as datas de antes da sua edição, com um aviso de que estão desatualizadas. Se tiver uma caixa de diálogo aberta, por exemplo as definições, a caixa de diálogo de uma tarefa ou a janela de boas-vindas, ou se o modo de apresentação estiver ativo, a aplicação recusa todas as chamadas, incluindo a leitura, até fechar a caixa de diálogo. A IA recebe então uma mensagem de erro com o nome interno do que está aberto, por exemplo `showTaskDialog`. Só `planner_get_planning_guide` continua a funcionar, porque não lê o seu planeamento.

**Muda de separador enquanto a IA trabalha.** A IA trabalha no documento onde fez a sua primeira alteração. Se mudar de separador entretanto, a aplicação recusa a alteração seguinte, até que a IA confirme que quer trabalhar no outro separador. Assim, nada acaba no projeto errado.

**A IA escreve ou abre um ficheiro.** A IA pode escrever um planeamento como ficheiro IFC e abrir um ficheiro de planeamento num novo separador. Só pode fazer isso dentro da pasta do seu utilizador. Só substitui um ficheiro existente se pedir explicitamente para o fazer.

**O estado é *Porta 3877 ocupada*.** Outro programa está a usar a porta. A mensagem da aplicação aparece por baixo. O campo da porta fica então bloqueado (*Só é editável com o servidor parado.*), mesmo não estando a ponte em execução, e não há botão para parar. Trata-se de uma limitação conhecida. Enquanto não for corrigida, desative e volte a ativar *Ativar modo IA*. Depois, o estado volta a *Desligada* e pode escolher outra porta. Em seguida, copie de novo os detalhes de ligação, porque o ponto final contém a porta.

**O cliente não consegue ligar-se depois de um novo token.** Um novo token quebra todas as ligações existentes. Dê ao cliente o novo token, ou cole de novo o excerto de configuração.

**Parou a ponte e ela não arranca sozinha.** *Iniciar a ponte automaticamente* funciona uma vez em cada arranque da aplicação. Se parar a ponte, a aplicação não a volta a ativar em silêncio.

**O separador *IA* desapareceu.** O modo IA está desativado. Ative-o no passo 1.

**Uma página web no seu navegador não consegue falar com a ponte.** A ponte recusa todos os pedidos que venham de um navegador, e todos os pedidos sem o token correto.

## Ver também

- [Dar feedback](docs://howto-feedback-geven): se a ligação funcionar de forma diferente da descrita aqui, comunique-o.
- [Como funciona a ligação à IA](docs://uitleg-ai-koppeling): o que é a ligação, porque é que o assistente trabalha no seu projeto aberto e o que não pode fazer.
- [Ferramentas de IA](docs://ref-ai-tools): todas as ferramentas `planner_*` por grupo, os códigos de erro e durante quanto tempo se guardam as cópias de segurança.
- [Planear bem](docs://gids-goed-plannen): os princípios de planeamento; o assistente recebe-os numa versão em inglês, com as ferramentas acrescentadas.
- [Definições](docs://ref-instellingen): as definições de IA.

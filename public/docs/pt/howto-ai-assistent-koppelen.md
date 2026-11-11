# Ligar um cliente MCP

Objetivo: deixar um cliente MCP acompanhar o seu planeamento e trabalhar nele, com transparência sobre o que faz e com limites que define a si mesmo.

## Rápido: deixe o Claude fazê-lo

Trabalha com o Claude Desktop ou com o Claude Code? Então o Claude pode instalar a ligação sozinho:

1. Clique em *Copiar prompt* abaixo.
2. Cole o prompt numa nova conversa com o Claude e envie-o.

Depois, o Claude instala a extensão para o Open Planner Studio e explica, pelo caminho, o que ela faz. Se tiver de fazer algo sozinho, como clicar em *Instalar* no Claude Desktop, o Claude indica-lhe exatamente qual é o clique. Não precisa de nenhum token para isso.

```prompt
Instale para mim a extensão Open Planner Studio, para que possa ler e alterar os meus planeamentos de obra no Open Planner Studio. Faça o máximo que puder sozinho. Antes de cada passo, diga numa só frase simples o que vai fazer e porquê. Se precisar de mim, pergunte uma coisa de cada vez e espere pela minha resposta. Se eu tiver de fazer algo sozinho, diga-me exatamente qual é o clique ou a ação, e onde.

O que precisa de saber:
- A extensão é um único ficheiro, open-planner-studio-<version>.mcpb, na versão mais recente: https://github.com/OpenAEC-Foundation/open-planner-studio/releases/latest. O link direto encontra-se em https://api.github.com/repos/OpenAEC-Foundation/open-planner-studio/releases/latest (o ficheiro cujo nome termina em .mcpb). O ficheiro é do tipo ZIP.
- A extensão funciona com a aplicação desktop do Open Planner Studio e sem a aplicação. Quando a aplicação estiver aberta e a ponte MCP da aplicação estiver em execução, trabalha no planeamento que está aberto na aplicação. Quando a aplicação estiver fechada, trabalha em ficheiros de planeamento numa pasta de trabalho que eu escolho.
- A instalação não precisa de token nem de palavra-passe. Não me peça nenhum, e não leia nem mostre nenhum.

Se estiver no Claude Desktop:
1. Se conseguir transferir um ficheiro e abri-lo no meu computador, faça isso com o ficheiro .mcpb. Se não conseguir, dê-me o link direto de transferência e diga-me para clicar duas vezes no ficheiro quando a transferência estiver concluída.
2. O Claude Desktop mostra depois a extensão Open Planner Studio. Diga-me para clicar em Instalar. Depois, diga-me para escolher, em Working folder, a pasta com os meus ficheiros de planeamento.
3. Diga-me para iniciar uma nova conversa e para lhe perguntar aí quais são as ferramentas do Open Planner Studio que vê.

Se estiver no Claude Code:
1. Verifique se o Node.js 22 ou mais recente está instalado. Se não estiver, diga-me como o instalar, e pare.
2. Pergunte-me qual é a pasta que contém os meus ficheiros de planeamento. Essa é a pasta de trabalho.
3. Transfira o ficheiro .mcpb e descompacte-o numa nova pasta própria, dentro da minha pasta de utilizador. Leia lá o manifest.json: server.mcp_config indica como o servidor arranca. Substitua ${__dirname} pela pasta descompactada e ${user_config.workdir} pela pasta de trabalho.
4. Execute claude mcp list. Se já existir um servidor com o nome open-planner-studio, pergunte-me se pode substituí-lo. Não mostre as definições desse servidor, porque podem conter um token.
5. Adicione o servidor para a minha conta de utilizador, por exemplo: claude mcp add open-planner-studio --scope user -e OPS_MCP_ROOT=<pasta de trabalho> -- node <pasta descompactada>/server/index.mjs
6. Diga-me para iniciar uma nova sessão do Claude Code, e que /mcp aí mostra se o open-planner-studio está ligado.

Se estiver a funcionar noutro sítio, como o claude.ai no navegador, diga-me que isto precisa do Claude Desktop ou do Claude Code. Se não souber em que ambiente está, pergunte-me.

Quando a instalação estiver concluída, explique em poucas frases:
- como eu lhe permito trabalhar na aplicação aberta: no Open Planner Studio, escolha Definições › Projeto › Definições da aplicação, separador Avançado, e ative Permitir ligação MCP. Depois clique em Iniciar ponte no separador MCP.
- que, sem a aplicação, uma alteração só fica no ficheiro depois de o guardar, e que não substitui um ficheiro existente enquanto a aplicação estiver aberta.
Se um passo falhar, diga-me numa frase o que correu mal e o que posso fazer. Não adivinhe.
```

Prefere fazê-lo sozinho, ou usa outro cliente MCP? Então siga os passos abaixo.

## Quando precisa disto

Quer que um cliente MCP leia, analise ou altere o seu planeamento. Por exemplo, para que elabore um primeiro WBS, corrija tarefas ou explique o caminho crítico. Isto funciona através do **Model Context Protocol** (MCP): uma norma que permite a um programa de IA, o **cliente MCP**, usar ferramentas de outro programa. Para isso, o Open Planner Studio executa um pequeno servidor no seu próprio computador, a **ponte**. Oferece um conjunto de ferramentas, todas com um nome que começa por `planner_`: ler e alterar tarefas, relações, recursos, calendários, linhas de base, documentos e ficheiros. Quais são e o que recusam está em [Ferramentas MCP](docs://ref-ai-tools). O cliente MCP trabalha no projeto que tem aberto, não numa cópia: uma tarefa que ele acrescenta aparece logo no Gantt. Usa o mesmo cálculo e o mesmo histórico de *Desfazer* que o utilizador.

A ponte só funciona na aplicação desktop. Se permitir a ligação MCP no navegador, vê o separador *MCP*, mas o botão *Iniciar ponte* está a cinzento, com o texto *A ponte só funciona na aplicação desktop.* O resto deste artigo trata da aplicação desktop. No navegador, *Criar cópia de segurança agora* e *Abrir pasta de cópias de segurança* também estão a cinzento.

## Passos

### 1. Permita a ligação MCP

1. Escolha *Definições › Projeto › Definições da aplicação*. Também pode escolher *Ficheiro › Definições da aplicação*, ou a engrenagem no topo.
2. Escolha o separador *Avançado* e ative *Permitir ligação MCP*. O separador *MCP* aparece no friso.
3. Se quiser que a ponte fique ativa logo que a aplicação arranque, ative também *Iniciar a ponte automaticamente*. Isso só se ativa quando a ligação MCP está ativa, e só funciona na aplicação para computador. Está desligada por padrão, porque abrir uma porta é uma escolha deliberada.

Se desligar a ligação MCP, a ponte para e o separador *MCP* desaparece.

### 2. Inicie a ponte

1. Vá ao separador *MCP* e clique em *Iniciar ponte* em *Servidor*.
2. Veja o estado ao lado do botão. Mostra *Desligada*, *Ativa na porta 3877*, *Porta 3877 ocupada* ou *Erro*. Se o arranque tiver êxito, mostra *Ativa na porta 3877* e o botão chama-se *Parar ponte*. Com *Porta 3877 ocupada* ou *Erro*, o botão continua a chamar-se *Iniciar ponte*; veja os problemas frequentes.

A ponte só escuta no seu próprio computador, numa única porta. Por padrão, essa porta é a 3877. No grupo *Ligação*, pode escolher outra em *Porta*, mas só enquanto a ponte estiver parada. A ligação é HTTP simples no seu próprio computador. A própria aplicação não envia nada para fora. O que o cliente MCP faz com o seu planeamento, por exemplo o que o respetivo fornecedor faz com ele, fica fora da aplicação.

### 3. Ligue o cliente MCP

1. Clique em *Conectar* em *Ligação*. Abre-se a janela *Detalhes de ligação*.
2. Escolha o que o seu cliente precisa; veja abaixo.
3. O token está oculto. Com o ícone do olho, mostra-o. Os botões de cópia copiam sempre o valor real, mesmo que o ecrã oculte o token.
4. Faça o cliente MCP pedir a lista de ferramentas. Esta verificação também está no prompt de ligação: deve ver as ferramentas com o prefixo `planner_`; o número esperado está no prompt de ligação.

A janela oferece quatro formas de ligação:

- *Deixe o Claude fazer isso*: o mesmo prompt que está no início deste artigo, com o botão *Copiar prompt*. Serve para o Claude Desktop e para o Claude Code. Para isso, não precisa de token.
- *Excerto de configuração*: um excerto de configuração que deve colar nas definições MCP do seu cliente.
- *Prompt de ligação*: um texto que deve colar no seu cliente MCP, depois do qual se liga sozinho.
- *Ponto final* e *Autenticação*: os detalhes separados. O ponto final é `http://localhost:3877/mcp`, com transporte *streamable HTTP*. Cada pedido precisa de um cabeçalho `Authorization: Bearer`, seguido do seu token. O cliente também tem de ser compatível com sessões MCP: quando se liga, a ponte dá um código de sessão no cabeçalho `Mcp-Session-Id`, e recusa todos os pedidos seguintes sem esse código. O Claude Code e o `mcp-remote` fazem isto sozinhos.

**Ligue de novo depois de uma atualização da aplicação.** Se o seu cliente MCP já estava ligado a uma versão mais antiga da aplicação, ainda não envia código de sessão, e a ponte recusa todos os pedidos. Por isso, ligue de novo depois da atualização: inicie uma nova sessão no Claude Code, e feche completamente o Claude Desktop e volte a iniciá-lo.

**Claude Code.** O excerto de configuração serve diretamente no Claude Code. Dê este comando num terminal, com o seu próprio token em vez de `<token>`:

```
claude mcp add --transport http open-planner-studio http://localhost:3877/mcp --header "Authorization: Bearer <token>"
```

Também pode colocar o excerto no ficheiro `.mcp.json` na pasta do seu projeto. Nesse caso, não coloque esse ficheiro no git, porque o token dá acesso ao seu planeamento. Um servidor de `.mcp.json` tem de ser aprovado na primeira vez no Claude Code.

**Claude Desktop.** Para o Claude Desktop há uma extensão: o ficheiro `open-planner-studio-<version>.mcpb`. O Claude Desktop instala-a com duplo clique. Não precisa de Node.js para isso. A extensão funciona com a aplicação e sem a aplicação. É mais rápido com o prompt no início deste artigo; abaixo estão os passos feitos à mão.

1. Transfira o ficheiro `.mcpb` da versão mais recente: `https://github.com/OpenAEC-Foundation/open-planner-studio/releases/latest`.
2. Faça duplo clique no ficheiro. O Claude Desktop abre e mostra a extensão *Open Planner Studio*. Instale-a. Se o duplo clique não funcionar, abra *Definições › Extensões* no Claude Desktop e instale o ficheiro aí.
3. Em *Working folder*, escolha a pasta com os seus ficheiros de planeamento. O Claude usa esta pasta só quando a aplicação está fechada. Depois, o Claude lê e escreve apenas nessa pasta.
4. Ative a extensão e inicie uma nova conversa. Pergunte ao Claude que ferramentas do Open Planner Studio ele vê.

Não tem de introduzir um token nem uma porta: enquanto a ponte estiver a correr, a extensão encontra a aplicação sozinha. Em cada pedido do Claude, a extensão escolhe de novo:

- *A aplicação está aberta e a ponte está a correr*: o Claude trabalha no planeamento que está aberto na aplicação. Vê cada alteração na aplicação de imediato.
- *A aplicação está fechada, ou a ponte está desligada*: o Claude trabalha num ficheiro de planeamento na pasta *Working folder*. Uma alteração só fica no ficheiro quando o Claude o guarda. Não existe gravação automática. Enquanto a aplicação está aberta, o Claude não substitui um ficheiro existente, mas guarda com um novo nome.

Se a aplicação abrir ou fechar enquanto o Claude trabalha, a extensão muda e avisa o Claude. O Claude então primeiro escolhe ou abre de novo o planeamento, e só depois altera alguma coisa. Se o Claude ainda tiver alterações sem a aplicação que não estão guardadas, a extensão continua a trabalhar sem a aplicação até o Claude as ter guardado. Assim, nenhum trabalho se perde. Se a extensão não conseguir chegar à aplicação e não houver uma pasta *Working folder* utilizável, o Claude vê apenas a ferramenta `open_planner_studio_status`, com uma mensagem que indica o que fazer.

**Claude Desktop sem a extensão.** Se não puder usar a extensão, ligue o Claude Desktop com a ferramenta externa `mcp-remote`. O excerto de configuração não serve diretamente no Claude Desktop: no ficheiro `claude_desktop_config.json` indica um programa que o Claude Desktop inicia sozinho, e não um endereço. O `mcp-remote` precisa de Node.js. No Claude Desktop, escolha *Definições › Developer › Edit Config*, coloque isto no ficheiro (com o seu próprio token) e inicie o Claude Desktop de novo:

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

O token está em `env` e não em `args` de propósito: no Windows, o Claude Desktop parte um argumento que contém um espaço. Um *conector personalizado* no Claude (*Customize › Connectors*) não funciona com a ponte. O Claude liga-se então a partir da nuvem da Anthropic, e essa nuvem não consegue chegar à ponte no seu próprio computador.

No grupo *Ligação* há também o campo *Token*. É um código longo e aleatório que a aplicação cria para si e guarda neste computador. Na janela, aparece *Este token dá acesso ao plano aberto. Não o partilhe com outras pessoas.* Com o ícone *Novo token*, cria um novo token. A aplicação pergunta primeiro *Gerar um novo token quebra todas as ligações existentes. Continuar?* Se a ponte estiver a correr, reinicia com o novo token, e o antigo deixa de funcionar.

**Como a extensão encontra a aplicação.** Enquanto a ponte está a correr, a aplicação para computador grava a porta e o token no ficheiro `mcp/runtime.json` na pasta de dados da aplicação. A extensão do Claude Desktop lê esse ficheiro em cada pedido. Em Linux e macOS, só a sua conta de utilizador pode ler o ficheiro. No Windows, a ACL padrão da sua pasta de perfil protege o ficheiro; a aplicação não verifica isto separadamente. Quando parar a ponte ou desligar a ligação MCP, a aplicação remove o ficheiro. A aplicação também mantém uma lista de ficheiros abertos em `mcp/open-files.json`, mesmo quando a ligação MCP está desligada. Enquanto esse ficheiro existir, a extensão e o servidor MCP sem interface não substituem nenhum ficheiro existente, nem um ficheiro que acabou de abrir e que ainda não está na lista. Um ficheiro novo é permitido. A leitura também é permitida: o Claude vê então a versão no disco, sem as suas alterações que ainda não estão guardadas.

### 4. Veja o que o cliente MCP faz

1. Clique em *Painel de atividade* em *Atividade*. Na coluna lateral abre-se o painel *Atividade MCP*.
2. Cada chamada à ponte fica numa linha, a mais recente no topo: hora, o que aconteceu, quanto tempo demorou e se teve êxito ou não. Clique numa linha para expandir *Argumentos* e *Resposta*.
3. Com *Limpar* esvazia a lista. O painel guarda as últimas 500 chamadas. Enquanto nada tiver acontecido, mostra *Ainda sem atividade MCP. As chamadas à ponte aparecerão aqui.*

Com a ligação MCP ativa, há um ponto com *MCP* no canto inferior direito da barra de estado. A cor mostra o estado da ponte, e um clique nele leva ao separador *MCP*.

### 5. Defina limites

Em *Segurança* estão os botões com os quais limita o cliente MCP:

- *Pausar*: o cliente MCP não pode alterar nada temporariamente, mas a leitura continua permitida. A ponte continua ativa. O botão passa a mostrar *Retomar*.
- *Só leitura*: todas as ferramentas que alteram alguma coisa são recusadas enquanto esta opção estiver ativa.
- *Cópia de segurança automática: ativada*: antes da primeira alteração do cliente MCP num documento, a aplicação grava uma cópia de segurança IFC. Está ativada por padrão. Com o botão, desativa-a, e então mostra *Cópia de segurança automática: desativada*. Isto acontece uma vez por documento, sempre que inicia a ponte.
- *Criar cópia de segurança agora*: faz uma cópia de segurança do documento ativo de imediato. Depois mostra *Cópia de segurança criada:* com o nome do ficheiro.
- *Abrir pasta de cópias de segurança*: abre a pasta com as cópias de segurança.

As cópias de segurança estão na pasta `ai-backups` na pasta de dados da aplicação. A aplicação guarda as cópias recentes e apaga parte das mais antigas; o modo exato está em [Ferramentas MCP](docs://ref-ai-tools).

### 6. Faça o cliente MCP planear bem

Um cliente MCP só planeia bem se conhecer as regras de planeamento. Isto é o que deve fazer pessoalmente:

1. **Não precisa de fazer nada para as regras principais.** Elas chegam ao ligar: a ponte envia-as no campo `instructions` do handshake MCP. Depende do cliente se as coloca no seu prompt de sistema.
2. **Peça a leitura do guia.** O prompt de ligação da janela *Detalhes de ligação* pede ao cliente MCP que leia o guia com a ferramenta `planner_get_planning_guide`. Se não usar o prompt, peça ao cliente, com estas palavras: *Leia primeiro o guia de planeamento com planner_get_planning_guide, antes de alterar seja o que for.* Também pode ler o guia diretamente em `https://open-planner-studio.open-aec.com/agent/planning-guide.md`.
3. **Opcional: instale as skills.** Isto só funciona com um cliente MCP que seja compatível com skills. Coloque o `SKILL.md` de *goed-plannen* e de *progress-update* em `.claude/skills/goed-plannen/SKILL.md` e `.claude/skills/progress-update/SKILL.md` na pasta do projeto onde o cliente MCP trabalha, ou em `~/.claude/skills/` para todos os projetos.

Pode obter os ficheiros de duas formas. Peça ao cliente MCP que chame a ferramenta `planner_get_planning_guide` com `part` definido como `skill`: a resposta contém os dois textos e, para cada skill, os locais onde devem ficar. Ou transfira-os de `https://open-planner-studio.open-aec.com/skills/goed-plannen/SKILL.md` e `https://open-planner-studio.open-aec.com/skills/progress-update/SKILL.md`. Se *goed-plannen* ainda estiver lá de uma versão mais antiga da aplicação, substitua-o: esse texto antigo está em neerlandês e aponta para o artigo de ajuda em vez do guia para clientes MCP.

Pode verificar no *Painel de atividade* se o cliente MCP leu mesmo o guia: aparece então uma chamada de `planner_get_planning_guide`. A resposta final deve conter uma lista de pressupostos: durações estimadas, a decomposição escolhida, as relações que o cliente criou por si próprio e todas as restrições que definiu. Se essa lista faltar, peça-a. Depois de uma atualização de progresso segundo *progress-update*, a resposta deve indicar a data de estado, a nova data de fim e o desvio em relação à linha de base.

## Problemas frequentes e o que a aplicação faz então

**O cliente MCP altera algo que pretende reverter.** Cada alteração do cliente MCP é um passo que pode anular com *Desfazer* (Ctrl+Z). Uma série de alterações que o cliente MCP envia como um todo é um só passo. Depois, o projeto aparece como não guardado. Após uma alteração, o planeamento volta a ser calculado, por isso não precisa de premir F5 manualmente.

**A aplicação recusa uma chamada do cliente MCP.** Com *Pausar* e *Só leitura*, a aplicação recusa todas as alterações, e a leitura continua possível, incluindo recalcular um planeamento desatualizado. Se estiver a meio de uma edição, como arrastar uma barra ou escrever num campo, o cliente MCP recebe as datas de antes da sua edição, com um aviso de que estão desatualizadas. Se tiver uma caixa de diálogo aberta, por exemplo as definições, uma caixa de diálogo de tarefa ou a janela de boas-vindas, ou se o modo de apresentação estiver ativo, a aplicação recusa todas as chamadas, incluindo a leitura, até fechar a caixa de diálogo. O cliente MCP recebe então uma mensagem de erro com o nome interno do que está aberto, por exemplo `showTaskDialog`. Só `planner_get_planning_guide` continua a funcionar, porque não lê o seu planeamento.

**Muda de separador enquanto o cliente MCP trabalha.** O cliente MCP trabalha no documento onde ficou a sua primeira alteração. Se mudar de separador entretanto, a aplicação recusa a alteração seguinte até o cliente confirmar que quer trabalhar no outro separador. Assim, nada acaba no projeto errado. Se o cliente MCP abrir ou duplicar um documento por si, trabalha depois nesse novo documento.

**O cliente MCP grava ou abre um ficheiro.** O cliente MCP pode gravar um planeamento como ficheiro IFC e abrir um ficheiro de planeamento como novo separador. Só pode fazê-lo dentro da pasta do seu utilizador. Só substitui um ficheiro existente se o pedir expressamente.

**O estado é *Porta 3877 ocupada*.** Outro programa usa a porta. A mensagem da aplicação aparece por baixo dele. O campo da porta fica então bloqueado (*Só editável com o servidor parado.*), mesmo que a ponte não esteja a correr, e não há botão de parar. Trata-se de uma limitação conhecida. Enquanto isto não for corrigido: desligue e volte a ligar *Permitir ligação MCP*. O estado volta então a *Desligada*, e pode escolher outra porta. Depois, copie de novo os detalhes de ligação, porque o ponto final contém a porta.

**O cliente não consegue ligar depois de um novo token.** Um novo token quebra todas as ligações existentes. Dê ao cliente o novo token, ou cole de novo o excerto de configuração. A extensão no Claude Desktop lê o novo token sozinha; não precisa de fazer nada aí.

**Parou a ponte por si e ela não arranca sozinha.** *Iniciar a ponte automaticamente* funciona uma vez em cada arranque da aplicação. Se parar a ponte por si, a aplicação não a volta a ativar em silêncio.

**O separador *MCP* desapareceu.** A ligação MCP está desligada. Ative-a no passo 1.

**Uma página web no seu navegador não consegue falar com a ponte.** A ponte recusa todos os pedidos que vêm de um navegador, e todos os pedidos sem o token correto.

## Sem a aplicação

Existe também um servidor MCP que funciona sem a aplicação de secretária: o **servidor MCP sem interface gráfica**. Oferece as mesmas ferramentas `planner_*`, mas trabalha com um ficheiro de planeamento no disco, em vez do projeto que tem aberto. Por isso, não vê as alterações no gráfico de Gantt, e *Desfazer* na aplicação não se aplica a elas. Utilize-o quando não quiser ter a aplicação aberta, ou num computador sem ecrã.

A extensão para o Claude Desktop inicia este servidor automaticamente quando a aplicação está fechada (consulte o passo 3). Os passos seguintes são para outro cliente MCP, como o Claude Code.

A versão não inclui um servidor já pronto para transferir. Compila-o a partir do código-fonte com `npm run build:mcp-server`; para isso, precisa do Node.js 22 ou de uma versão mais recente. O resultado é um único ficheiro, `server.mjs`.

1. Escolha uma pasta de trabalho com os seus ficheiros de planeamento. O servidor lê e escreve apenas nessa pasta.
2. Ligue o seu cliente MCP. Para o Claude Code, o comando está abaixo destes passos.
3. Peça ao cliente MCP que abra um planeamento, por exemplo `~/plan.ifc`. Neste servidor, `~` significa a pasta de trabalho.
4. Peça ao cliente MCP que guarde o resultado. Não há gravação automática: o cliente MCP escreve o ficheiro com `planner_export_ifc`. O que não for guardado perde-se quando o servidor parar.

Para o passo 2 no Claude Code, dê este comando num terminal, com os seus próprios caminhos:

```
claude mcp add open-planner -- node /path/to/server.mjs --root /path/to/working-folder
```

Antes da primeira alteração por documento, o servidor faz uma cópia de segurança MCP, tal como a aplicação. Um cliente MCP que escolha um caminho fora da pasta de trabalho, também através de um atalho (ligação simbólica), recebe uma recusa. Enquanto a aplicação estiver aberta, o servidor não substitui um ficheiro existente.

## Ver também

- [Dar feedback](docs://howto-feedback-geven): se a ligação funcionar de forma diferente do que está descrito aqui, comunique-o.
- [Ferramentas MCP](docs://ref-ai-tools): todas as ferramentas `planner_*` por grupo, os códigos de erro e o tempo de conservação das cópias de segurança.
- [Definições da aplicação](docs://ref-instellingen): as definições MCP.

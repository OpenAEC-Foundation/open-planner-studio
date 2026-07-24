# Importação/exportação

O Open Planner Studio guarda um projeto como IFC por predefinição — sem um ficheiro de projeto separado ao lado. Mas
por vezes um cronograma também precisa de existir fora da aplicação: no Primavera P6, no Microsoft Project, ou como
uma tabela plana para uma folha de cálculo. Este guia explica o que significa realmente o formato IFC nativo, o que
cada formato de exportação transporta e não transporta, e onde vivem a importação/exportação na aplicação.

## O que vai aprender aqui

- O que significa precisamente "o IFC é o formato nativo" para abrir e guardar.
- O que acompanha e o que não acompanha ao exportar para MS Project (MSPDI) e Primavera P6 XML.
- O que contém a exportação CSV — e o que é deliberadamente deixado de fora.
- Onde importar e exportar: **Backstage → Exportar** e **Backstage → Importar**.
- Como as extensões podem adicionar formatos de importação extra.

## IFC: o formato nativo

Um projeto do Open Planner Studio *é* um ficheiro IFC 4x3 (a norma buildingSMART). Não existe um
ficheiro JSON ou de projeto separado ao lado: **Guardar** e **Abrir** (Backstage, ou **Ctrl+S**/**Ctrl+O**)
leem e escrevem IFC diretamente. Isso significa que tudo o que faz na aplicação — tarefas, WBS, relações com
restrições, recursos e atribuições, calendários (tanto o calendário do projeto como os calendários de
recursos), baselines, progresso, notas, códigos de atividade e campos personalizados, ligações externas entre
projetos — acaba no mesmo ficheiro e volta na íntegra da próxima vez que **Abre** esse ficheiro. Se encontrar
um novo tipo de dado de projeto na aplicação, pode assumir que passa pelo ciclo completo através do IFC; se algo
*não* fizer esse ciclo completo, isso é mencionado explicitamente abaixo.

O IFC é também a forma como esta aplicação se liga ao resto do conjunto de ferramentas OpenAEC: o mesmo ficheiro pode
ser lido por software BIM para a ligação 4D (cronograma junto ao modelo do edifício).

## Exportar para outros formatos

Abra **Backstage → Exportar** para quatro formatos:

- **CSV (separado por ponto e vírgula)** — exportação de tabela universal. Todas as tarefas com datas e durações.
- **MS Project XML** — abre no Microsoft Project. Estrutura WBS completa.
- **Primavera P6 XML** — para o Oracle Primavera P6.
- **IFC 4x3** — a norma buildingSMART, igual ao formato nativo (útil como um "guardar como" para um
  ficheiro separado, ou para partilhar uma cópia sem tocar no resto dos seus documentos abertos).

Cada formato tem as suas próprias limitações: quanto mais rico o formato de destino, mais coisas acompanham, mas
nenhum dos três formatos externos é um espelho completo do IFC.

### CSV

A exportação CSV contém **apenas a tabela de tarefas**: código WBS, nome, duração (dias), início, fim,
predecessoras (como um código de texto, por exemplo `2.1FS+3d`), tipo de tarefa, estado, progresso (%), início/fim
reais, crítica (sim/não), folga total e descrição. **Os recursos, as atribuições, os calendários
e as baselines são deliberadamente deixados de fora** — o CSV é puramente uma tabela de tarefas para quem quer ver
ou editar o cronograma numa folha de cálculo, não uma troca de projeto de fidelidade total. Quando **importa**
um ficheiro CSV de volta, as baselines ficam, por isso, vazias (não havia nada de onde as ler).

### MS Project XML (MSPDI)

O MSPDI é consideravelmente mais rico do que o CSV: recursos, atribuições (incluindo a sua curva de
carregamento), calendários e baselines acompanham. Ainda assim, nem tudo é expressável em MSPDI. Na exportação,
a aplicação avisa na consola de programador (`console.warn`) sempre que algo se perde, com o número exato
de itens afetados:

- As **ligações externas** entre projetos são descartadas (a referência "fantasma" da outra tarefa fica
  apenas dentro da aplicação).
- As **restrições flexíveis Start On/Finish On** (MSO/MFO flexíveis) são degradadas para SNET/FNET — os códigos
  MSPDI 2/3 são *rígidos* (Must), pelo que o limite superior da variante flexível se perde. O MSO/MFO rígido é
  exportado com exatidão.
- As **restrições secundárias** perdem-se — o MSPDI só tem um campo de restrição por tarefa.
- As **tarefas hammock** (duração derivada) são exportadas como uma tarefa simples com as datas calculadas — o MSPDI
  não tem um tipo hammock/LOE nativo.
- As **notas de tarefa** são deliberadamente **não** exportadas, ainda que o MSPDI tenha um campo `<Notes>`:
  as nossas notas são uma forma de lista de verificação com caixas de verificação que não se traduz de forma limpa para texto simples.
- A **definição do caminho crítico** (modo/limiar de quase crítico) e outras opções de agendamento não são
  expressáveis de forma nativa no MSPDI e por isso perdem-se — essas só são preservadas via IFC.

### Primavera P6 XML

O mesmo tipo de compromisso do MSPDI, com algumas particularidades específicas do P6:

- As **ligações externas** e as **tarefas hammock** são descartadas/simplificadas da mesma forma que com o
  MSPDI, cada uma com um aviso.
- As **notas de tarefa** também são deixadas de fora aqui — o P6 XML não tem um campo adequado para elas.
- O **atraso percentual** numa relação (por exemplo 40% da duração da predecessora) é "incorporado" num número
  fixo de dias, porque o P6 não tem o conceito de atraso percentual.
- O **atraso em dias de calendário** (atraso em dias decorridos em vez de dias úteis) é exportado como um
  atraso simples baseado em horas — o P6 não tem uma unidade de atraso separada por relação.
- A curva de carregamento **LATE_PEAK** não tem equivalente no P6 e é exportada como a aproximação mais
  próxima ("Early Peak").
- As opções de agendamento (tal como no MSPDI) não são exportadas.

Estes avisos não são descuido — são uma escolha deliberada e explícita: um aviso visível por item
descartado é melhor do que uma perda silenciosa de dados. Abra, por exemplo, o exemplo
[Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) (tem notas de tarefa e
uma relação com um atraso percentual) e exporte para P6 ou MS Project XML: a consola de programador
mostra então exatamente quais os itens que foram descartados ou simplificados, e quantos.

## Importar

**Ficheiro → Abrir** (ou **Backstage → Abrir**) aceita ficheiros `.ifc`, `.csv` e `.xml`. Para um ficheiro
`.xml`, a aplicação deteta por si própria se é um ficheiro Primavera P6 ou MS Project, com base no
conteúdo. Como descrito acima: uma importação CSV ou P6 produz um projeto **sem baselines** (não havia
nenhuma na origem), enquanto o IFC e o MSPDI trazem as baselines consigo.

## Importadores de extensões

Além dos formatos fixos acima, as extensões instaladas podem adicionar os seus próprios importadores — por exemplo para um
formato que não é suportado por predefinição. Esses aparecem em **Backstage → Importar**, cada um com o seu próprio
nome, descrição e extensões de ficheiro correspondentes; sem extensões de importação instaladas, essa
secção fica vazia. Verifique **Backstage → Extensões** para ver o que está disponível.

## Leitura adicional

- As baselines só acompanham via IFC e MS Project XML, não via CSV ou P6 — leia o guia
  [Baselines & progresso](docs://gids-baselines-voortgang) para saber como registar uma baseline.
- Recursos, atribuições e curvas de carregamento — leia o guia
  [Recursos, histograma & nivelamento](docs://gids-resources-histogram) para saber como se constroem antes
  de exportar.

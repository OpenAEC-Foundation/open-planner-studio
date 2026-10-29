# Ouvrir un fichier Primavera P6 (.xer)

Objectif : ouvrir un planning de Primavera P6 directement dans l'application, sans l'exporter d'abord en XML.

## Quand vous en avez besoin

Un client ou un entrepreneur principal travaille dans Primavera et vous livre son planning sous forme de fichier `.xer`. Vous voulez le consulter, le calculer ou y ajouter des éléments. L'application lit seulement les fichiers `.xer` : elle n'écrit pas de `.xer` et ne modifie jamais votre fichier. À partir du fichier, elle reprend la structure WBS et les tâches avec durée, dates, contraintes et avancement, les relations avec décalage, les calendriers et les ressources avec leurs affectations, ainsi que les codes d'activité, les champs personnalisés (UDF), les notes et les paramètres de planification de P6. Une tâche de type *Niveau d'effort* devient un hamac.

## Étapes

1. Choisissez *Accueil › Fichier › Ouvrir* ou appuyez sur Ctrl+O. Choisissez le fichier `.xer`.
2. L'application ouvre un onglet pour chaque projet qui contient des tâches. Le projet qui compte le plus de tâches est l'onglet actif. Un onglet s'appelle *Nom du projet (ID du projet)* si l'ID du projet P6 diffère du nom. *Paramètres du projet* n'affiche que le nom. Si vous renommez le projet, l'ID du projet reste affiché après le nom. Une fenêtre explique ensuite brièvement ce que l'application a repris du fichier et comment l'enregistrement fonctionne ; voir [Ouvrir et enregistrer un fichier](docs://howto-bestand-openen-en-opslaan).
3. Lisez le message en bas. Pour un fichier avec trois projets, il peut ressembler à ceci : *Fichier XER ouvert : 3 documents de projet.* En dessous se trouvent des lignes qui expliquent ce que l'application a fait. Voir le titre ci-dessous.
4. Vérifiez s'il y a une barre d'informations sous le ruban : *Vous consultez le planning tel qu'enregistré par Primavera ; un recalcul déplacerait 1 tâche.* Primavera enregistre ses propres dates calculées dans le fichier. Si le calcul de l'application diffère de ces dates, l'application affiche les dates de Primavera tant que vous ne modifiez rien. Une tâche qui a commencé ou qui est terminée reste toujours sur ses dates réelles, comme dans Primavera. Ce que cela signifie et comment passer au calcul propre à l'application est expliqué dans [Dates telles qu'enregistrées](docs://uitleg-datums-zoals-opgeslagen). Le message *Ce fichier contient une planification horaire.* peut aussi apparaître, avec le bouton *Activer la planification horaire*. Voir [Activer la planification horaire](docs://howto-urenplanning-aanzetten).
5. Enregistrez votre projet avec Ctrl+S. Comme un `.xer` n'est jamais écrasé, l'application demande où enregistrer le nouveau fichier IFC. Elle propose *Nom du projet (ID du projet)* comme nom de fichier.

### Les lignes sous le message

La première ligne du message indique le nombre d'onglets ouverts. Sous celle-ci, il n'y a que les lignes qui s'appliquent. Ces lignes méritent votre attention :

- *Ce projet calcule comme Primavera P6. Modifiable via Fichier → Informations du projet → Profil de calcul et options.* L'application calcule ce projet avec les règles de calcul de Primavera. Avec *Ouvrir le profil de calcul*, vous accédez au paramètre.
- *1 projet de référence exclu.* et *1 référence matérialisée.* Si un projet dans P6 désigne un autre projet comme sa référence, cet autre projet ne s'ouvre pas dans un onglet propre. Il devient la référence active du projet qui le désigne.
- *Une solution de repli protectrice a été utilisée.* Si la désignation des références empêcherait l'ouverture de tout projet, si un projet se réfère à lui-même ou si des projets se réfèrent les uns aux autres en boucle, l'application ouvre simplement tous les projets et ne crée aucune référence.
- *1 relation externe conservée.* Une relation entre deux projets. L'application la conserve comme donnée source, mais ne la transforme pas en relation dans votre planning.
- *12 tâches affichent les dates telles qu'enregistrées par Primavera (non recalculées).* Le nombre de tâches pour lesquelles la vue *Dates telles qu'enregistrées* affiche les dates de Primavera : toutes les tâches pour lesquelles le fichier a enregistré des dates, pas seulement celles qui diffèrent.

Les autres lignes sont des diagnostics de la lecture elle-même. Elles ne demandent rien de votre part :

- le nombre de projets trouvés ;
- un projet vide ignoré ;
- un renvoi ignoré vers un projet de référence absent ;
- un encodage de texte autre que l'UTF-8 standard (le message indique lequel : pour un texte en arabe, cyrillique ou grec, l'application choisit la page de codes Windows correspondante, sinon Windows-1252) ;
- des tâches sans début planifié (elles commencent à la date d'état ou au début du projet tel qu'indiqué dans le fichier) ;
- des compteurs pour les constats dans les tables, les calendriers et les nombres, pour les valeurs de champ inconnues et pour les paramètres de planification P6 que l'application a remplacés par un choix sûr.

*En savoir plus* ouvre l'aide sur l'ouverture de fichiers Primavera.

## Pièges et ce que fait alors l'application

**Tout ne devient pas un onglet ou une relation.** Un projet sans tâches ne s'ouvre pas, un projet de référence ne s'ouvre pas dans un onglet propre, et une relation entre deux projets ne devient pas une relation de votre planning. L'application le signale dans les lignes sous le message.

**Chaque onglet est un projet à part entière.** Si vous en enregistrez un, le fichier IFC conserve aussi le `.xer` original complet. Si vous rouvrez plus tard ce fichier IFC, l'application connaît toujours les dates de Primavera. Si cette archive source est endommagée, ou si un autre programme IFC a réécrit le fichier, l'application signale : *L'archive source XER de ce fichier est inutilisable et a été omise ; le projet lui-même s'est ouvert en entier.* Le planning, le profil de calcul et toutes les données du projet sont complets. Il manque : les dates telles que Primavera les a stockées et la provenance source pour l'IA et les extensions. Ouvrez à nouveau le `.xer` original pour récupérer l'archive.

**Le fichier IFC devient plus volumineux.** Comme le fichier IFC contient le `.xer` original complet, il est plus volumineux qu'un fichier IFC sans archive. Avec un grand `.xer`, vous le remarquez à la taille du fichier et à la durée de l'enregistrement. Si un `.xer` ouvre plusieurs projets, chaque onglet que vous enregistrez contient le `.xer` complet, et pas seulement son propre projet.

**Un export vers CSV, MS Project XML ou P6 XML fait perdre des données.** L'application avertit : *L’export vers CSV entraîne la perte d’informations source XER.* L'IFC ne perd rien.

**Un samedi ou un dimanche libre absent du fichier.** L'application peut elle-même rendre ce jour de week-end libre. Le jour s'appelle alors *Exception de calendrier (reconstruction du week-end)* dans le calendrier. Le modèle est décrit dans [Formats d'import et d'export](docs://ref-import-exportformaten).

**Marge jusqu'à la fin du projet, sans date de fin.** Si le fichier n'a pas de date de fin, l'application désactive l'option *Calculer la marge jusqu’à la date de fin du projet*. Cela apparaît dans la ligne *N paramètres de planification P6 ont utilisé des replis sûrs.* Les détails se trouvent dans [Formats d'import et d'export](docs://ref-import-exportformaten).

**Tâches terminées à la date d'état.** Une tâche terminée peut apparaître comme une barre étroite à la date d'état, dans la vue *Dates telles qu'enregistrées*. Ce n'est pas un défaut de votre fichier. L'explication et la convention associée se trouvent dans [Formats d'import et d'export](docs://ref-import-exportformaten).

**Nombres avec une virgule comme séparateur décimal.** Si l'application ne peut pas déterminer le séparateur décimal de façon fiable, elle n'ouvre pas le fichier. Ainsi, un planning avec des nombres mal lus ne s'ouvre jamais. Demandez à l'expéditeur un nouvel export.

**Un fichier que l'application ne peut pas lire.** Vous obtenez un message d'erreur, avec la raison. Quelques exemples :

- *Ce fichier XER n’est pas valide ou pris en charge.*
- *Des colonnes obligatoires manquent dans une table XER.*
- *Le projet P6 de ce fichier XER ne contient aucune activité.*
- *La notation décimale de ce fichier XER ne peut pas être déterminée de façon fiable.*

Rien ne s'ouvre alors. Vérifiez le fichier dans P6, ou demandez à l'expéditeur un nouvel export.

## Voir aussi

- [Fichiers et formats](docs://uitleg-bestanden) : pourquoi un `.xer` est seulement lu et ce qu'un export perd.
- [Dates telles qu'enregistrées](docs://uitleg-datums-zoals-opgeslagen) : la vue des dates propres à Primavera.
- [Ouvrir un fichier MS Project (.mpp)](docs://howto-mpp-openen) : idem pour MS Project.
- [Activer la planification horaire](docs://howto-urenplanning-aanzetten) : si le fichier contient des données en heures.
- [Formats d'import et d'export](docs://ref-import-exportformaten) : par format, ce qui est repris et ce qui ne l'est pas.
- [Profils de calcul et conventions](docs://uitleg-rekenprofielen) : pourquoi un fichier P6 s'ouvre avec son propre profil de calcul.

# Fichiers et formats

Qu'est-ce qui se trouve réellement dans le fichier que vous enregistrez ? Et que devient votre planning quand vous l'exportez vers un autre logiciel ? Dans cet article, vous lisez comment l'application gère les fichiers : IFC comme format propre, les autres formats comme traducteurs, ce qu'un export laisse de côté, et en quoi l'enregistrement, l'enregistrement automatique et la récupération après un plantage diffèrent. L'exemple à la fin montre avec des chiffres ce que fait un export.

## Le concept

Open Planner Studio a un seul format de fichier qui lui est propre : **IFC**, un format d'échange ouvert pour les informations de construction de buildingSMART. L'application écrit le schéma IFC du projet, par défaut IFC 4.3 ADD2 (voir [Choisir le schéma IFC](docs://howto-ifc-schema-kiezen)) ; dans la liste d'export, il s'appelle *IFC*. Il n'existe pas de second fichier de projet propriétaire. *Enregistrer* écrit tout votre projet dans un fichier IFC (`.ifc`), et *Ouvrir* relit ce type de fichier. Vous voulez voir ce qui entre dans le fichier ? L'onglet *IFC* est un éditeur qui affiche le texte IFC de votre projet ; *Générer IFC* actualise ce texte, et *Copier* le place dans le presse-papiers. Si vous modifiez le texte, *Appliquer* le charge comme votre projet. Cela remplace complètement le projet dans cet onglet.

Tous les autres formats sont des **adaptateurs** : des traducteurs entre le modèle d'un autre programme et celui de l'application. L'application lit CSV, MS Project XML, Primavera P6 XML, les fichiers MS Project (`.mpp`) et les fichiers Primavera (`.xer`). Elle écrit CSV, MS Project XML, Primavera P6 XML et deux fiches d'avancement. Vous ne pouvez pas exporter vers `.mpp` ou `.xer`.

Pourquoi cette distinction compte-t-elle ? Un traducteur ne peut transporter que ce que les deux côtés connaissent. Le fichier IFC de l'application conserve tout ce qui appartient à votre projet. Chaque autre format ne couvre pas une partie de ce projet, et cette partie est laissée de côté.

## Comment l'application gère les fichiers

### Ce que fait l'ouverture

L'application choisit le lecteur d'après l'extension : `.ifc`, `.csv`, `.xml`, `.mpp` ou `.xer`. Avec un fichier `.xml`, elle regarde à l'intérieur pour voir s'il s'agit de MS Project XML ou de Primavera P6 XML. Une extension inconnue est traitée comme IFC. Si le fichier n'est pas IFC, l'application affiche *Échec de l'ouverture du fichier*, avec la raison.

Chaque fichier s'ouvre dans son propre onglet. Exception : un onglet encore vide et non modifié reprend le fichier. Un seul fichier Primavera peut produire plusieurs onglets, un pour chaque projet qui contient des tâches.

Après l'ouverture, l'application recalcule toujours. Si le fichier vient d'un autre logiciel, les dates peuvent différer de ce que disait le fichier. Cela est décrit dans [Dates telles qu'enregistrées](docs://uitleg-datums-zoals-opgeslagen).

Seul un fichier IFC devient la **cible d'enregistrement** : le fichier dans lequel *Enregistrer* écrit. Un fichier CSV, XML, `.mpp` ou `.xer` ne le devient pas. Un tel projet n'a pas de fichier après l'ouverture ; *Enregistrer* demande alors où doit aller le nouveau fichier IFC. Ainsi, Ctrl+S n'écrase jamais votre fichier d'origine avec du texte IFC.

### Ce qu'écrit l'enregistrement

*Enregistrer* écrit toujours le projet entier. Voici ce qui y entre :

- les tâches avec structure, durée, dates et avancement ;
- les relations avec décalage, contraintes et échéances ;
- les calendriers, les ressources et les affectations, y compris les courbes ;
- les références, les codes d'activité, les champs personnalisés et les notes ;
- les relations externes vers d'autres projets ;
- les paramètres du projet, comme la date d'état, le profil de calcul et les options de calcul ;
- la liaison avec une bibliothèque de ressources.

Ce que vous réglez à l'écran n'appartient pas au projet et n'est pas enregistré avec lui : le zoom, la position de défilement, la tâche sélectionnée et les phases repliées. Les paramètres de l'application, comme la langue et le thème, ne figurent pas non plus dans le fichier. L'application les conserve elle-même, dans l'application ou dans votre navigateur.

Un export vers un autre format ne modifie pas votre projet. Après un export, le projet garde la même cible d'enregistrement, et il porte toujours la mention *Non enregistré* s'il la portait avant.

### Ce qu'un export perd

Chaque adaptateur transporte ce que son format connaît.

**MS Project XML** transporte les tâches, les relations, les calendriers, les ressources, les affectations, les contraintes, les échéances et la date d'état. Parmi vos références, seule la référence active est transmise. Les codes d'activité, les champs personnalisés, les notes et les relations externes ne sont pas transmis. Une deuxième contrainte sur une tâche n'est pas transmise. Une contrainte *Doit commencer le (MSO)* ou *Doit finir le (MFO)* sans le choix *Obligatoire (logique de verrouillage)* revient comme *Début au plus tôt le (SNET)* ou *Fin au plus tôt le (FNET)*. *Planifiée manuellement* et le *Retard de nivellement* d'une tâche ne reviennent pas. Un hamac devient une tâche ordinaire avec des dates calculées.

**Primavera P6 XML** transporte les tâches, les relations, les calendriers, les ressources, les affectations, les contraintes et la date d'état. Les références et les échéances ne sont pas transmises, pas plus que les codes d'activité, les champs personnalisés, les notes et les relations externes. Un hamac devient ici aussi une tâche ordinaire. P6 ne connaît pas de décalage en pourcentage : l'application convertit ce décalage en un nombre fixe de jours. Un décalage en jours calendaires devient un décalage en jours ouvrés.

**CSV** est une liste de tâches. Le fichier a ces colonnes pour chaque tâche : task id, WBS, level, name, duration, start, finish, predecessors, work category, l'identifiant d'une catégorie de travaux personnalisée (`OPS Custom Task Type ID`), status, completion, actual start and finish, critical, total float et description. Les ressources, les affectations, les calendriers, les contraintes, les échéances, les références et la date d'état n'y figurent pas. Les en-têtes de colonnes restent toujours en anglais.

**Seul IFC transporte le profil de calcul et les options de calcul.** Si vous exportez vers CSV, MS Project XML ou Primavera P6 XML, le profil ne figure pas dans le fichier. Parmi les options de calcul, MS Project XML écrit au plus le seuil critique. Un tel fichier se rouvre comme *Open Planner Studio*. Si votre projet a été calculé avec *Primavera P6* ou *Microsoft Project*, par exemple parce qu'il vient d'un `.xer` ou d'un `.mpp`, les dates peuvent se décaler pour cette raison. Ce qu'est un profil de calcul est expliqué dans [Profils de calcul et conventions](docs://uitleg-rekenprofielen).

Si votre projet vient d'un fichier Primavera (`.xer`), même si vous l'avez entre-temps enregistré en IFC, l'application affiche après un export vers CSV, MS Project XML ou P6 XML : *L’export vers CSV entraîne la perte d’informations source XER.* Pour MS Project XML, le message dit *MSPDI* au lieu de *CSV* ; pour P6 XML, il dit *P6*. Vous ne recevez pas ce message pour IFC : le fichier IFC transporte aussi le fichier source de Primavera. Voir [Ouvrir un fichier Primavera P6 (.xer)](docs://howto-xer-openen).

Deux autres points concernent l'export. Si le planning n'est plus à jour, l'application le recalcule d'abord, puis exporte. Elle n'exporte pas non plus un planning contenant une dépendance circulaire : vous recevez un message qui contient la boucle, par exemple *Dépendance circulaire entre les tâches : Set up site → Demolish existing extension → Set up site*.

### Enregistrer, enregistrement automatique et récupération après un plantage

Ce sont trois choses différentes. Elles se ressemblent, mais elles écrivent à un autre endroit.

**Enregistrer** est une action que vous effectuez. L'application écrit votre projet dans votre fichier et retire la mention *Non enregistré*.

**L'enregistrement automatique** est désactivé par défaut, et vous l'activez vous-même pour chaque projet. L'application écrit alors, sans fenêtre, dans le même fichier dès qu'il y a des modifications, au plus une fois toutes les dix secondes. Cela ne fonctionne que si le projet a déjà un fichier. Voir [Activer l'enregistrement automatique](docs://howto-automatisch-opslaan).

**La récupération après un plantage** est toujours active. Dès qu'une modification a lieu quelque part, l'application conserve aussi, au plus une fois toutes les dix secondes, une copie de récupération de tous les projets ouverts, y compris ceux que vous n'avez pas modifiés vous-même. Cette copie ne se trouve pas dans votre fichier de projet : dans l'application de bureau, elle est dans le dossier de données de l'application ; dans le navigateur, elle est dans le stockage du navigateur. Au prochain démarrage, l'application vous propose cette copie. Vous en lirez davantage dans [Récupérer après un plantage](docs://howto-herstellen-na-een-crash). La récupération après un plantage n'écrit jamais dans votre fichier de projet.

Comme une copie n'est conservée qu'au plus une fois toutes les dix secondes, vous pouvez perdre les dernières secondes de travail lors d'un plantage.

### Bureau et navigateur

L'application de bureau et la version navigateur font la même chose avec votre projet, mais elles écrivent les fichiers d'une autre manière.

Sur le bureau, l'application utilise de vrais chemins d'accès. *Enregistrer* écrit directement dans votre fichier. En général, l'application écrit d'abord dans un fichier temporaire à côté (`.ops-save.tmp`), et seulement ensuite remplace votre fichier. Ainsi, un plantage au milieu de l'écriture n'efface pas votre ancien fichier. Si vous fermez l'application avec des modifications, elle demande pour chaque projet si vous voulez enregistrer. En cas de fermeture normale, elle supprime ses copies de récupération.

Dans un navigateur qui peut enregistrer des fichiers où vous voulez (comme Chrome et Edge), vous obtenez une fenêtre d'ouverture et d'enregistrement ordinaire. Ensuite, *Enregistrer* écrit directement dans le fichier ; pour un fichier que vous avez ouvert, le navigateur demande une fois l'autorisation. La liste *Récents* fonctionne, avec les noms de fichiers seulement.

Dans un navigateur qui ne le permet pas (comme Firefox), l'application ouvre un fichier avec le sélecteur de fichiers et enregistre par un téléchargement. Avec *Enregistrer*, le message *Enregistré sous forme de téléchargement : 'name.ifc' se trouve dans votre dossier de téléchargements. …* explique cela une fois par session ; avec *Enregistrer sous* et les exports, vous voyez *Enregistré sous forme de téléchargement : 'name.ifc' se trouve maintenant dans votre dossier de téléchargements. Cet environnement ne permet pas à l'application d'écrire directement à l'emplacement choisi.* Si le navigateur peut afficher une fenêtre d'enregistrement, mais ne peut pas réécrire dans le fichier du projet, *Enregistrer* demande à chaque fois un emplacement. Un message l'explique aussi une fois par session. *Fichier › Récents* est présent, mais ouvre une page vide, et l'enregistrement automatique n'est pas disponible. Vous recevez le même message dans tout environnement qui ne laisse pas l'application écrire à l'emplacement choisi.

## Exemple : exporter le projet d'exemple

Prenez l'exemple *Refurbishment & Extension of a Family Home* (*Fichier › Exemples*). Il compte 20 tâches, dont 4 phases et 2 jalons, et 16 relations. Il y a 6 ressources avec 8 affectations, 1 référence et une liaison avec la *Demo resource library*. La tâche *Demolish existing extension* a la contrainte *Début au plus tôt le (SNET)* au 14 mai 2027, et *Handover inspection* a une échéance le 29 juillet 2027. Le planning se termine le 7 juillet 2027.

Voici ce que le projet redevient pour chaque format, mesuré après avoir rouvert le fichier d'export :

- Le fichier IFC restitue tout : 20 tâches, 16 relations, 6 ressources, 8 affectations, la référence, la contrainte, l'échéance et la liaison avec la bibliothèque. Le planning se termine de nouveau le 7 juillet 2027.
- Le fichier MS Project XML restitue aussi tout, sauf la liaison avec la bibliothèque. Le planning se termine le 7 juillet 2027.
- Le fichier P6 XML restitue les tâches, les relations, les ressources, les affectations et la contrainte. La référence et l'échéance manquent. Le planning se termine quand même le 7 juillet 2027, car la contrainte y figure encore.
- Le fichier CSV restitue 20 tâches et 16 relations. Les ressources, les affectations, la référence, la contrainte et l'échéance manquent, et le projet s'appelle *CSV Import*. Sans la contrainte, les tâches se déplacent plus tôt : le planning se termine le 2 juillet 2027, cinq jours calendaires plus tôt.

Sans cette contrainte, l'exemple lui-même se termine aussi le 2 juillet 2027. La différence vient donc de la contrainte que le fichier CSV ne transporte pas.

## Conséquences et malentendus

**Un export n'est pas une sauvegarde.** Seul IFC conserve tout. Si vous voulez garder votre projet, enregistrez-le en IFC. Exportez seulement pour une personne qui a besoin de l'autre format.

**Rouvrir un export ne donne pas toujours le même planning.** L'application recalcule toujours à l'ouverture, avec le profil de calcul qui appartient au format. Si une logique manque, comme la contrainte dans l'exemple CSV, ou si le profil calcule autrement, le résultat change.

**Un export figure aussi dans *Récents*.** Sur le bureau et dans les navigateurs avec accès aux fichiers, un export se retrouve dans *Récents*, comme un projet enregistré (les fiches d'avancement non). Si vous l'ouvrez à partir de là, il s'ouvre comme un import de ce format.

**Enregistrer n'est pas la même chose que la récupération après un plantage.** La récupération aide après un plantage, mais ne remplace pas l'enregistrement. Enregistrez donc avant de fermer un onglet ou l'application.

## Voir aussi

- [Ouvrir et enregistrer un fichier](docs://howto-bestand-openen-en-opslaan) : les étapes pour ouvrir, enregistrer et enregistrer sous.
- [Exporter](docs://howto-exporteren) : choisir un format et ce que vous obtenez.
- [Dates telles qu'enregistrées](docs://uitleg-datums-zoals-opgeslagen) : pourquoi un planning importé peut afficher d'autres dates.
- [Contraintes et échéances](docs://uitleg-constraints) : ce que fait une contrainte, et donc ce qui disparaît si elle manque.
- [Relations et décalage](docs://uitleg-relaties) : ce qu'est un décalage et comment l'application le calcule.
- [Créer un hamac](docs://howto-hammock) : ce qu'est un hamac, qu'un export écrit comme une tâche ordinaire.
- [Codes et champs personnalisés](docs://howto-codes-en-velden) : les codes d'activité et les champs personnalisés, que seul IFC conserve.
- [Relations externes vers un autre projet](docs://howto-externe-relaties) : les relations externes que MS Project XML et P6 XML ne transportent pas.
- [Enregistrer et gérer une référence](docs://howto-baseline-opslaan-en-beheren) : les références, dont MS Project XML ne transporte que la référence active.
- [Formats d'import et d'export](docs://ref-import-exportformaten) : par format, ce qui est transporté et ce qui ne l'est pas.

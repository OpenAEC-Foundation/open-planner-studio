# Comment fonctionne la liaison IA

Que se passe-t-il réellement quand un assistant IA travaille dans votre planning ? Dans cet article, vous lisez ce qu'est la liaison, pourquoi elle diffère d'un échange de fichier, quelles limites l'application s'impose et comment l'assistant apprend à construire un planning. L'exemple à la fin montre avec des chiffres ce qu'un assistant peut faire en une fois et ce que vous en retenez.

## Le concept

Un assistant IA, comme un programme de discussion ou un assistant de programmation, peut piloter un autre programme grâce au **Model Context Protocol** (MCP). Open Planner Studio joue le rôle de serveur dans cet échange. L'application de bureau lance un petit serveur sur votre propre ordinateur, le **pont**. L'assistant s'y connecte et reçoit une liste d'**outils** : des instruments dont le nom commence par `planner_`, comme la lecture de tâches, l'ajout d'une relation ou l'enregistrement d'une référence. La liste complète se trouve dans [Outils IA](docs://ref-ai-tools).

Le point remarquable : l'assistant travaille dans le projet que vous avez ouvert à ce moment-là, pas dans une copie. Vous n'exportez rien et vous n'importez rien. Il n'existe aucun moment où vous et l'assistant regardez deux versions différentes. Une tâche ajoutée par l'assistant apparaît tout de suite dans le Gantt. L'application veille à cela : l'assistant utilise le même calcul, le même historique d'annulation et les mêmes règles que vous.

Vous activez la liaison dans [Connecter un assistant IA (MCP)](docs://howto-ai-assistent-koppelen). Ci-dessous, vous lisez comment elle fonctionne.

## Comment l'application gère cela

### Un serveur que seul votre ordinateur entend

Le pont n'écoute que sur votre propre ordinateur (`127.0.0.1`), sur un seul port, 3877 par défaut. Il n'accepte des requêtes qu'à l'adresse `/mcp`, et seulement avec votre **jeton** dans l'en-tête `Authorization: Bearer`. Il refuse une requête sans le bon jeton. Une requête qui provient d'un navigateur reconnu à son en-tête `Origin` est refusée aussi, afin qu'une page web ouverte par hasard ne puisse pas parler à votre planning. Il traite les requêtes strictement une à une.

La connexion est un HTTP simple sur votre propre ordinateur ; rien ne quitte l'application par ce chemin. Ce qu'un assistant fait du planning qu'il lit, par exemple ce que son fournisseur en fait, dépend de l'assistant et sort du cadre de l'application.

### L'assistant travaille sur un seul document

À sa première modification, le pont lie la connexion au document actif à ce moment-là. Si vous changez vous-même d'onglet, l'application refuse la modification suivante de l'assistant (code `DOC_DRIFT`), jusqu'à ce qu'il confirme avec `planner_switch_document` le document sur lequel il veut travailler. Ainsi, rien n'atterrit dans le mauvais projet. Un assistant qui ouvre ou duplique un document lui-même travaille ensuite dans ce nouveau document.

### Chaque modification recalcule

Dans l'application, vous planifiez à la main : vous changez quelque chose, puis vous appuyez sur *Calculer* (F5), sauf si *Calculer automatiquement* est activé. Cela ne s'applique pas à une modification de l'assistant. Chaque action d'écriture de l'assistant passe par une seule transaction. Si des données du projet changent, l'application recalcule à la fin, de sa propre initiative, une fois pour un script. Un outil de lecture donne toujours des dates à jour : si le planning est obsolète, par exemple parce que vous avez changé quelque chose vous-même et n'avez pas encore appuyé sur *Calculer*, l'outil de lecture recalcule d'abord. Il y a une exception : si le projet est dans la vue *Dates telles qu'enregistrées* (après un import), un outil de lecture ne recalcule pas en silence, car cela remplacerait ces dates. L'assistant reçoit alors les dates enregistrées, avec un avertissement qu'elles n'ont pas été recalculées. Une modification faite par l'assistant lui-même recalcule toujours, même dans ce cas. Vous n'avez pas à appuyer sur *Calculer* après une modification de l'assistant. Il relit alors le résultat, comme la fin du projet et le chemin critique, avec les outils de lecture. Voir aussi [Dates telles qu'enregistrées](docs://uitleg-datums-zoals-opgeslagen).

### Un script compte pour une seule étape

Un assistant peut soumettre une série d'étapes d'un seul bloc avec `planner_batch`, un script d'au plus 100 étapes. Cela donne une seule étape d'annulation, un seul recalcul et une seule sauvegarde. Si une étape échoue de façon structurelle, par exemple un outil inconnu ou une relation circulaire, l'application annule tout le script. Vous ne gardez jamais un planning à moitié terminé. Le refus d'un élément dans une étape groupée, comme une ligne d'avancement invalide sur vingt, est plus léger : cet élément reste à l'écart et le reste est exécuté. Les refus se trouvent en haut de la réponse.

### Vos limites

Vous réglez quatre éléments vous-même, dans l'onglet *IA* :

- *Mettre en pause* et *Lecture seule* laissent l'assistant connecté, mais refusent toute modification. La lecture reste possible, y compris le recalcul d'un planning obsolète lors d'une lecture : ce sont des champs calculés, pas des données du projet, donc aucune étape d'annulation n'est ajoutée et le projet ne compte pas comme modifié. Si vous êtes au milieu d'une modification vous-même, par exemple en faisant glisser une barre ou en tapant dans un champ, un outil de lecture ne recalcule pas : l'assistant reçoit alors les dates d'avant votre modification, avec un avertissement qu'elles sont obsolètes.
- Une boîte de dialogue ouverte bloque tout. Avec la boîte de dialogue d'une tâche, les paramètres, le mode présentation ou la fenêtre d'accueil ouverte, par exemple, l'application refuse aussi la lecture, car vous êtes au milieu d'une action manuelle. L'assistant reçoit le code d'erreur `DIALOG_OPEN`. Le message nomme le nom interne de ce qui est ouvert, par exemple `showTaskDialog` pour la boîte de dialogue de tâche.
- *Sauvegarde automatique* écrit une copie IFC avant la première modification par document. Si cette sauvegarde échoue, l'application n'exécute pas la modification.
- Le *Panneau d'activité* affiche chaque appel, avec ses arguments et sa réponse.

En plus, il y a votre commande *Annuler* habituelle (Ctrl+Z). L'assistant partage cet historique avec vous et dispose lui-même de `planner_undo` et `planner_redo`.

### Ce que l'assistant ne peut pas faire

Le pont est volontairement plus restreint que l'application. Ce que l'assistant ne peut pas faire a en général l'une de trois raisons.

**Il va au-delà du projet.** Un assistant ne peut pas modifier la bibliothèque de ressources. Une bibliothèque de ressources est partagée par tous vos projets et se situe hors de l'historique d'annulation ; un seul changement de tarif agirait alors sur des projets qui ne sont même pas ouverts. Pour une ressource issue d'une bibliothèque, le nom, le type, la description, le tarif horaire et l'unité sont fixes, comme dans le panneau des ressources. Ce que le projet décide reste à l'assistant : unités max., disponibilité dans le temps, calendrier et équipe. Il ne peut pas non plus choisir quel calendrier est le calendrier du projet. Il peut lire le profil de calcul et les options de calcul, mais ne peut pas les modifier ; il peut seulement définir le mode d'avancement et la valeur par défaut du projet pour le type de tâche. Il n'existe pas d'outils pour les paramètres, le thème, la langue, les extensions ou les mises à jour.

**Il se prête mal à une validation fiable.** Un assistant ne peut pas définir un hamac, planifier une tâche manuellement, poser une deuxième contrainte, renseigner des notes, des couleurs, des codes d'activité, des champs personnalisés ou des relations externes, et il ne peut pas définir à la main un retard de nivellement. Il ne choisit pas non plus de code WBS ; l'application le déduit elle-même.

**Il touche à ce que vous devez décider vous-même.** Il n'enregistre l'avancement que s'il existe une date d'état. Il ne la choisit pas lui-même : c'est votre date d'état. Si une tâche non commencée a un début planifié postérieur à la date d'état, il doit fournir le début réel. Il lit et écrit des fichiers uniquement dans votre dossier utilisateur, et il n'écrase un fichier existant que s'il le demande explicitement. Une exportation n'est pas une action *Enregistrer* : le projet reste non enregistré dans l'application.

### Comment l'assistant sait planifier

Un assistant qui connaît les outils peut tout de même construire un planning dont aucun planificateur ne tire profit : des tâches sans relations, une date fixe sur chaque tâche, ou un découpage beaucoup trop fin. L'application lui donne donc trois éléments.

**Les règles essentielles dans la poignée de main MCP.** À la connexion, le pont envoie un court texte dans le champ `instructions` de la poignée de main MCP. Beaucoup de clients placent ce texte dans leur invite système ; cela dépend de votre client. Les règles : commencer par les jalons et la date de livraison, créer des tâches d'environ un jour à deux semaines, piloter le planning avec des relations plutôt qu'avec des dates fixes, utiliser des contraintes seulement pour des dates externes imposées, corriger d'abord un calcul en échec, utiliser `planner_batch` pour une série cohérente, enregistrer l'avancement seulement avec votre date d'état et les dates réelles que vous donnez, et dire à la fin ce que vous avez supposé et ce que vous avez volontairement laissé de côté.

**Le guide pour assistants.** L'outil `planner_get_planning_guide` renvoie un guide écrit spécialement pour les assistants. Il suit les mêmes principes que [Bien planifier](docs://gids-goed-plannen), mais un assistant travaille autrement que vous : il n'appuie pas sur F5 et ne clique pas dans le ruban, il appelle des outils et l'application recalcule pour lui. Le guide nomme donc, pour chaque principe, les outils que l'assistant utilise, et explique ce que l'assistant fait avec *Dates telles qu'enregistrées* ou un calcul en échec. Le guide est en anglais, comme tout ce que l'assistant lit par la liaison ; l'outil accepte encore un choix de langue pour les anciens assistants, mais cela ne change pas le texte. Vous pouvez le lire vous-même à l'adresse `https://open-planner-studio.open-aec.com/agent/planning-guide.md`. L'invite de connexion de la fenêtre *Détails de connexion* demande à l'assistant de lire d'abord le guide. L'outil fonctionne aussi pendant qu'une boîte de dialogue est ouverte, en pause et en mode lecture seule, car il ne lit pas votre planning.

**Deux compétences.** Une compétence est un petit fichier d'instructions qu'un assistant lit à chaque session. Il y en a deux, car il s'agit de deux types de travail. Mettre en place un planning concerne la logique ; mettre à jour l'avancement concerne des faits que vous seul connaissez. La compétence *goed-plannen* sert à créer ou restructurer un planning : l'ordre d'utilisation des outils, la règle de recalcul, `planner_batch` et l'obligation de signaler les hypothèses. La compétence *progress-update* sert à la mise à jour hebdomadaire de l'avancement : d'abord votre date d'état, puis les dates de début et de fin réelles et le pourcentage d'avancement, et ensuite un rapport de l'écart par rapport à la référence, du chemin critique et de la nouvelle date de fin. Les principes de planification sont dans le guide. Les deux compétences sont en anglais. L'outil les renvoie toutes les deux, avec l'endroit où elles doivent être placées. Vous installez les compétences comme indiqué dans [Connecter un assistant IA (MCP)](docs://howto-ai-assistent-koppelen).

## Un exemple

Vous demandez à un assistant : construisez un agrandissement avec foundation, brickwork et roof, dans cet ordre. Votre projet commence le lundi 2 mars 2026. L'assistant lit d'abord le guide, puis soumet un seul script :

1. le début du projet le 2 mars 2026 ;
2. trois tâches : Foundation de 5 jours ouvrés, Brickwork de 10 et Roof de 4 ;
3. deux relations fin-début : Foundation vers Brickwork, Brickwork vers Roof.

L'application exécute les trois étapes et recalcule. Si l'assistant relit ensuite, il trouve : fin du projet le jeudi 26 mars 2026, durée du projet de 19 jours ouvrés, et les trois tâches critiques. Cela correspond à la somme : 5 + 10 + 4 font 19 jours ouvrés, et 19 jours ouvrés après le lundi 2 mars se terminent le jeudi 26 mars. Tout le script ne compte que pour une étape dans votre historique. Une seule commande *Annuler* supprime les trois tâches, les deux relations et le nouveau début du projet.

Passons maintenant au cas « et si ». Vous demandez ensuite à l'assistant de mettre l'avancement à jour, et pour cela il fixe la date d'état au lundi 16 mars. Une date d'état n'est pas une étiquette : une tâche qui n'a pas commencé ne peut pas se situer avant cette date et est repoussée jusqu'à elle. Sans une seule ligne d'avancement, tout le planning se décale donc : Foundation va du 16 au 20 mars, Brickwork du 23 mars au 7 avril et Roof du 8 au 13 avril. La fin du projet passe du 26 mars au 13 avril. Le planning se décale de deux semaines ouvrées, et le calendrier de cet exemple, *Bouwkalender NL*, comporte le Vendredi saint (3 avril) et Pâques (5 et 6 avril). Ces deux jours chômés en semaine repoussent la fin de deux jours de plus. C'est pourquoi l'assistant ne fixe la date d'état que si vous le demandez, et seulement s'il existe un réel avancement à enregistrer.

## Conséquences pour votre planning et idées reçues courantes

**L'assistant n'a pas de copie propre.** Ce qu'il modifie change votre projet. Avec *Sauvegarde automatique* activée, vous disposez d'une sauvegarde IFC avant sa première modification. Avec *Lecture seule*, il peut analyser sans rien modifier.

**Un nouveau jeton coupe toutes les connexions.** Le jeton est le mot de passe du pont. Un nouveau jeton invalide l'ancien, même pendant que le pont tourne, et il faut donner le nouveau à l'assistant.

**Le fait qu'un assistant dise avoir réussi n'est pas une preuve.** Le *Panneau d'activité* montre quel outil il a réellement appelé et ce qui est revenu. Un refus nomme presque toujours le champ incorrect et la voie qui fonctionne.

**L'assistant ne peut pas faire un cas « et si » avec annulation.** Il partage l'annulation avec vous ; pour des variantes, il duplique donc le document avec `planner_duplicate_document`. La copie est détachée, n'a pas de chemin de fichier et apparaît comme non enregistrée. L'assistant ne ferme pas les variantes ; c'est vous qui décidez.

**Une exportation par l'assistant n'est pas un enregistrement.** Il écrit un fichier IFC vers un chemin qu'il choisit lui-même, dans votre dossier utilisateur, et il n'écrase un fichier existant que s'il le demande explicitement. Votre projet reste non enregistré dans l'application et conserve sa propre cible d'enregistrement. S'il importe un fichier, celui-ci s'ouvre dans un nouvel onglet ou dans un onglet vide et inchangé.

## Voir aussi

- [Connecter un assistant IA (MCP)](docs://howto-ai-assistent-koppelen) : les étapes pour démarrer le pont, connecter un assistant et installer la compétence.
- [Outils IA](docs://ref-ai-tools) : tous les outils par groupe, ce qu'ils refusent et pendant combien de temps les sauvegardes sont conservées.
- [Bien planifier](docs://gids-goed-plannen) : les principes de planification ; l'assistant les reçoit dans une version anglaise, avec les outils ajoutés.
- [Avancement, date d'état et référence](docs://uitleg-voortgang) : ce que la date d'état fait à votre planning.

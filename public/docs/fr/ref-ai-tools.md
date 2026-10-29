# Outils IA (planner_*)

Tous les outils qu'un assistant IA peut appeler via le pont, par groupe, avec ce qu'ils font et ce qu'ils refusent. Ils commencent tous par `planner_`. L'invite de connexion dans la fenêtre *Détails de connexion* indique le numéro actuel. L'assistant reçoit la liste complète, avec les descriptions, du pont lui-même (`tools/list`). Le fonctionnement de la liaison est expliqué dans [Comment fonctionne la liaison IA](docs://uitleg-ai-koppeling). La façon de l'activer est expliquée dans [Connecter un assistant IA (MCP)](docs://howto-ai-assistent-koppelen).

## Comment lire cette liste

**Lecture** signifie que l'outil ne modifie rien. Cela fonctionne aussi quand *Mettre en pause* ou *Lecture seule* est activé. Une boîte de dialogue ouverte bloque toutefois l'outil (voir *Quand un outil est refusé* ci-dessous). Un outil de lecture donne toujours les dates actuelles. Si le planning n'est plus à jour, il recalcule d'abord, même quand *Mettre en pause* ou *Lecture seule* est activé : ces modes bloquent les modifications, pas le recalcul pendant la lecture. Si vous êtes en train de modifier quelque chose (faire glisser une barre, saisir dans un champ), l'outil ne recalcule pas. L'assistant reçoit alors les dates d'avant votre modification, avec un avertissement indiquant qu'elles ne sont plus à jour. Si le projet est dans la vue *Dates enregistrées*, l'outil ne recalcule pas. L'assistant reçoit alors les dates enregistrées, avec un avertissement indiquant qu'elles n'ont pas été recalculées.

**Modification** signifie que l'outil modifie votre projet. Il est refusé quand *Mettre en pause* ou *Lecture seule* est activé, et quand une boîte de dialogue est ouverte. Cela vaut aussi pour les outils sans mention de modification ci-dessous (`planner_undo`, `planner_redo`, les outils de fichiers et les outils de documents, sauf `planner_list_documents`). Chaque modification est une étape de votre historique d'annulation. Si des données du projet changent, l'application recalcule ensuite le planning toute seule. Vous n'avez pas besoin d'appuyer sur *Calculer*. Avant la première modification par document, l'application crée une sauvegarde, si *Sauvegarde automatique* est activée.

**Lot** signifie qu'un seul appel peut contenir plusieurs éléments. Un élément non valide est alors refusé, avec une raison, et les éléments valides restent. La réponse indique les éléments refusés.

## Lecture : planning

- `planner_get_project_info` (lecture) — détails du projet et chiffres clés : le nombre de tâches, de relations, de ressources et de jalons, la date d'état, la fin et la durée du projet, si le planning n'est plus à jour, le profil de calcul et un résumé des calendriers. Un bon premier appel.
- `planner_get_project_overview` (lecture) — toute l'arborescence WBS en une seule réponse : par identifiant de tâche, WBS, nom, durée, dates au plus tôt, avancement, critique, et les relations sortantes avec leur identifiant de relation.
- `planner_list_tasks` (lecture) — tâches avec des filtres (critiques, statut, fenêtre de dates, tâches sans relations) et une pagination.
- `planner_get_task` (lecture) — une tâche en détail : dates, marge, avancement, contraintes, échéance, calendrier, affectations, prédécesseurs et successeurs, interruptions.
- `planner_get_critical_path` (lecture) — les tâches critiques avec leur marge totale, et les relations qui déterminent le chemin critique.
- `planner_list_resources` (lecture) — ressources avec capacité, tarif, calendrier, groupe, disponibilité et résumé de leurs affectations. Si une ressource provient d'une bibliothèque de ressources, l'outil indique quels champs sont figés.
- `planner_get_resource_histogram` (lecture) — charge comparée à la capacité par ressource, par jour, par semaine ou par mois (par semaine par défaut). Sans fenêtre ni ressources, il donne un résumé par ressource. Avec une fenêtre ou des ressources, il donne la série complète et les tâches qui causent une surallocation.
- `planner_get_calendars` (lecture) — tous les calendriers avec leur définition complète et le nombre de tâches et de ressources qui les utilisent.

## Lecture : références et écarts

- `planner_list_baselines` (lecture) — les références enregistrées et celle qui est active.
- `planner_compare_baseline` (lecture) — le plan actuel comparé à la référence active : seulement les tâches qui diffèrent et l'écart de fin du projet, en jours ouvrés selon le calendrier de projet actuel. Sans référence active, il refuse.
- `planner_analyze_delay` (lecture) — analyse du retard par rapport à la référence active : l'écart de livraison et les tâches critiques qui ont bougé. Sans référence active, il refuse.

## Tâches et structure

- `planner_add_tasks` (modification, lot) — créer des tâches, y compris une WBS imbriquée, en un seul appel. Chaque tâche reçoit son propre nom temporaire (`tmp-…`), pour qu'un enfant puisse faire référence à son parent. Sans durée, une tâche reçoit 5 jours ouvrés. Un jalon a une durée de 0. Toutes les tâches d'un appel réussissent ensemble ou échouent ensemble.
- `planner_update_tasks` (modification, lot) — modifier les champs de tâches existantes : nom, description, durée avec unité (jours ou heures), type de durée, catégorie de travaux, jalon, obligatoire, priorité, contrainte, échéance, calendrier et type de tâche. Il permet aussi de mettre à jour l'avancement : pourcentage d'avancement, début réel et fin réelle. Toute autre clé est refusée, avec une raison.
- `planner_delete_tasks` (modification) — supprimer des tâches, y compris toute leur sous-arborescence, leurs relations et leurs affectations. La réponse indique exactement ce qui a été supprimé avec elles.
- `planner_move_task` (modification) — placer une tâche sous un autre parent, à une position donnée. Une référence circulaire, ou le fait de placer une tâche sous elle-même, est refusé.
- `planner_set_task_splits` (modification) — définir les interruptions d'une tâche : après combien de jours ouvrés (ou d'heures ouvrées) de travail, et combien de jours ouvrés (ou d'heures ouvrées) d'interruption. Une liste vide supprime toutes les interruptions. Voir [Scinder une tâche](docs://howto-taak-splitsen).

## Relations

- `planner_add_dependencies` (modification, lot) — créer des relations avec un type (`FS`, `SS`, `FF`, `SF` ou la forme longue) et un décalage, par exemple `+2d`.
- `planner_update_dependencies` (modification, lot) — modifier le type, le décalage, le prédécesseur ou le successeur d'une relation existante, par identifiant de relation. C'est une seule étape, au lieu de supprimer puis de recréer.
- `planner_remove_dependencies` (modification, lot) — supprimer des relations par identifiant de relation.

## Projet et calendriers

- `planner_update_project` (modification) — nom, description, auteur, entreprise, date de début, date de fin, date d'état, mode d'avancement et le type de tâche par défaut du projet. La date de début est le point d'ancrage des nouvelles tâches. Si l'assistant la modifie plus tard, seules les tâches isolées bougent avec elle (sans prédécesseur et sans contrainte qui fixe une borne inférieure, comme *Début au plus tôt*). La réponse indique leur nombre dans `anchorsClamped`. Le reste du planning reste en place. Voir [Nouveau projet et Info projet](docs://ref-projectinfo). La date d'état n'est pas une étiquette, mais la date de référence du calcul : sur un planning sans avancement, tout bouge avec elle. La date de fin n'est qu'une métadonnée.
- `planner_move_project` (modification) — déplacer tout le planning existant à une nouvelle date de début. Les calendriers ne bougent pas avec lui. La fin peut donc décaler d'un nombre de jours différent de celui du début. Les références restent en place, sauf si l'assistant demande explicitement qu'elles bougent aussi. Voir [Déplacer un projet](docs://howto-project-verplaatsen).
- `planner_update_calendar` (modification, lot) — modifier ou créer des calendriers : jours ouvrés, horaires de travail, pause, plages horaires, jours fériés (générer pour un pays et une région, ou les indiquer un par un) et exceptions de travail. Il ne peut pas changer quel calendrier est le calendrier de projet.

## Ressources et unités

- `planner_manage_resources` (modification, lot) — créer, modifier ou supprimer des ressources : nom, type (main-d'œuvre, équipement, matériau, sous-traitant ou groupe), description, unités max., coût par heure, unité, calendrier, groupe et disponibilité dans le temps. Il refuse de supprimer une ressource qui a des affectations, tant que l'assistant ne le confirme pas explicitement. Pour une ressource issue d'une bibliothèque de ressources, le nom, le type, la description, le tarif horaire et l'unité sont figés.
- `planner_manage_assignments` (modification, lot) — ajouter, modifier, déplacer ou supprimer des affectations : unités par jour ouvré, courbe et travail restant. Seulement sur une tâche sans sous-tâches. La même ressource n'apparaît qu'une fois par tâche. Ce qu'une modification des unités fait à la durée dépend du type de tâche de cette tâche, comme dans [Types de tâche : durée, unités et travail](docs://uitleg-werkregels).
- `planner_level_resources` (modification) — nivelle les surallocations. Par défaut, il reste dans la marge, ce qui garde la date de fin. Avec `constrainToFloat: false`, la fin peut bouger. Avec un essai à blanc, l'assistant reçoit d'abord un aperçu, sans que rien ne soit modifié. Il ignore les matériaux. Voir [Nivellement des ressources](docs://uitleg-nivelleren).
- `planner_clear_leveling` (modification) — supprimer tous les retards de nivellement.

## Gérer les références

- `planner_save_baseline` (modification) — enregistrer le planning actuel comme référence et la rendre active tout de suite. Il recalcule d'abord les dates qui ne sont plus à jour. Ne peut pas être utilisé dans un script.
- `planner_activate_baseline` (modification) — rendre une référence active, ou aucune.
- `planner_rename_baseline` (modification) — renommer une référence.
- `planner_delete_baseline` (modification) — supprimer une référence. Si c'était la référence active, la dernière référence restante devient active, ou aucune s'il n'en reste pas.

## Annuler

- `planner_undo` et `planner_redo` — annuler ou rétablir une étape dans le document actif. L'historique est le même que le vôtre. La réponse indique si une modification a réellement été annulée.

## Documents et fichiers

- `planner_list_documents` (lecture) — tous les documents ouverts, avec le titre, s'ils sont actifs et modifiés, le nombre de tâches, la date de début du projet et la fin calculée.
- `planner_new_document` — un document nouveau et vide, dans son propre onglet, sans la fenêtre *Nouveau projet*.
- `planner_duplicate_document` — copier le document actif dans un nouvel onglet, pour une simulation ou une variante d'appel d'offres. La copie est détachée et n'a pas de chemin de fichier.
- `planner_switch_document` — rendre un autre document actif. C'est aussi le moyen de vérifier, après un changement d'onglet, sur quel document l'assistant travaille.
- `planner_import_schedule` — ouvrir un fichier de planning depuis le disque comme document : `.ifc`, `.xml` (Primavera P6 ou MS Project, reconnu par son contenu), `.csv`, `.xer` et `.mpp` (MS Project 2010 à 2021). Rien n'est fusionné avec le planning actuel. Un CSV n'a pas de calendrier, donc les dates peuvent décaler. Seulement dans votre dossier utilisateur. Après un import CSV, XML ou `.mpp`, le document n'a pas de cible d'enregistrement. Seul un fichier IFC reçoit ce chemin.
- `planner_export_ifc` — écrire le document actif comme fichier IFC, dans le schéma IFC du projet (IFC 4.3 ADD2 par défaut). Seulement dans votre dossier utilisateur, et un fichier existant n'est écrasé que sur demande explicite. Si le document a été ouvert dans un schéma que l'application ne peut pas écrire (comme IFC2X3), l'outil refuse d'écrire sur ce fichier lui-même. Le projet reste non enregistré.

## Guide et provenance des sources

- `planner_get_planning_guide` (lecture) — le guide anglais pour les assistants (les principes de [Bien planifier](docs://gids-goed-plannen), avec les outils pour chaque principe), les deux skills *goed-plannen* (mettre en place un planning) et *progress-update* (mettre à jour l'avancement), ou les deux ensemble. Choisissez avec `part` : `guide`, `skill` (les deux skills) ou `both`. `both` est la valeur par défaut. Pour chaque skill, la réponse renvoie les endroits où il doit être placé et les adresses de téléchargement. Le paramètre `language` est encore accepté pour les anciens assistants, mais le texte est toujours en anglais. Cet outil ne touche pas au planning.
- `planner_inspect_xer_provenance` (lecture) — inspecter la sémantique source conservée d'un fichier Primavera P6 (`.xer`) ouvert : ce que le fichier contenait, avec les compteurs de l'import et des diagnostics. Les champs texte libres du fichier restent invisibles par défaut. L'assistant doit les demander explicitement. Les noms de ressources restent aussi cachés par défaut, car une ressource P6 est souvent une personne ; les codes de ressource restent visibles. L'assistant doit vous demander la permission avant de demander les noms, car ils sont alors envoyés au fournisseur d'IA. Ne peut pas être utilisé dans un script.

## Le script

- `planner_batch` — exécuter un script d'au plus 100 étapes comme une seule modification : une étape d'annulation, un recalcul, une sauvegarde. Si une étape échoue de façon structurelle, tout le script est annulé. La réponse indique, par étape, ce qui a été fait, ce qui a échoué ou ce qui n'a pas été atteint. Les noms temporaires (`tmp-…`) de `planner_add_tasks` s'appliquent dans les étapes suivantes. Ne sont pas autorisés comme étape : `planner_batch` lui-même, annuler et rétablir, les outils de documents et de fichiers, `planner_save_baseline`, `planner_get_planning_guide` et `planner_inspect_xer_provenance`. Un script n'est pas un langage de programmation : il n'y a ni variables, ni conditions, ni boucles.

## Quand un outil est refusé

L'assistant reçoit alors une réponse avec un code d'erreur et une explication.

- `PAUSED` — *Mettre en pause* est activé.
- `READ_ONLY` — *Lecture seule* est activé.
- `DIALOG_OPEN` — une boîte de dialogue est ouverte. Cela vaut aussi pour la lecture, sauf pour `planner_get_planning_guide`. La réponse indique ce qui est ouvert, par son nom interne, par exemple `showTaskDialog`.
- `DOC_DRIFT` — vous avez changé d'onglet pendant que l'assistant travaillait. Il doit confirmer avec `planner_switch_document` sur quel document il travaille.
- `VALIDATION` — les arguments ne correspondent pas au schéma, ou la modification demandée n'est pas autorisée. La réponse indique le champ concerné.
- `NOT_FOUND` — un identifiant ou un document n'existe pas.
- `CYCLE` — la modification créerait une référence circulaire. Tout ce qui se trouve dans cet appel est annulé.
- `SCOPE` — le chemin du fichier se trouve en dehors de votre dossier utilisateur.
- `BACKUP_FAILED` — la sauvegarde avant la modification a échoué. La modification n'a pas été effectuée.
- `INTERNAL` — une erreur inattendue pendant l'exécution d'un outil, par exemple une opération de fichier qui a échoué. La réponse donne le message d'erreur d'origine.
- `STALE_PRECONDITION` — fait partie du contrat du pont, mais aucun des outils actuels ne renvoie ce code.

Une demande restée plus de 110 secondes dans la file n'est plus exécutée par l'application. Le client a déjà reçu un délai dépassé, et l'exécuter modifierait les choses deux fois en cas de nouvelle tentative. Un appel qui dure plus de 120 secondes reçoit un délai dépassé du pont.

## Ce que l'assistant ne peut pas définir

Par tâche, l'assistant ne peut pas définir : un hamac, une tâche planifiée manuellement, une deuxième contrainte, des notes, une couleur, des codes d'activité, des champs personnalisés, des relations externes ni un retard de nivellement à la main. L'application calcule elle-même le code WBS. Au niveau du projet, il ne peut pas modifier le profil de calcul ni les options de calcul. Les paramètres, le thème, la langue, les extensions et les mises à jour sont hors de portée, tout comme la bibliothèque de ressources. Il n'a pas non plus accès aux rapports, aux dispositions, aux filtres ou à la vue. Le pourquoi est expliqué dans [Comment fonctionne la liaison IA](docs://uitleg-ai-koppeling).

## Ce que l'application stocke

- **Le jeton** se trouve sur cet ordinateur, dans les paramètres enregistrés de l'application. Il fait 64 caractères et il est aléatoire. *Nouveau jeton* remplace le jeton.
- **Le port** est 3877 par défaut. Il ne peut être modifié que lorsque le pont est arrêté.
- **Le panneau d'activité** garde les 500 derniers appels, uniquement pendant que l'application est ouverte. Les arguments et les réponses sont coupés après 20 ko par champ. *Effacer* vide la liste.
- **Les sauvegardes** se trouvent dans le dossier `ai-backups` du dossier de données de l'application. *Ouvrir le dossier de sauvegarde* vous y mène. Elles sont nommées `<nom du projet>-<horodatage>.ifc`. Un fichier de projet enregistré a un seul dossier pour toutes les sessions. Un document jamais enregistré reçoit un dossier par session. Une sauvegarde par document est créée à chaque démarrage du pont, plus les sauvegardes que vous créez vous-même avec *Sauvegarder maintenant*.
- **Le nettoyage** se fait tout seul, par dossier. Pour les 7 derniers jours, elles sont toutes conservées, jusqu'à 20. Ce que la session en cours a créé est toujours conservé. Ensuite, une par semaine reste jusqu'à 30 jours, une par mois jusqu'à un an, puis une par an. Les sauvegardes d'un document jamais enregistré disparaissent complètement après un an. Les fichiers du dossier qui n'appartiennent pas à l'application ne sont pas touchés.

## Voir aussi

- [Comment fonctionne la liaison IA](docs://uitleg-ai-koppeling) : pourquoi le pont est configuré ainsi, et ce que l'assistant peut ou ne peut pas faire.
- [Connecter un assistant IA (MCP)](docs://howto-ai-assistent-koppelen) : démarrer le pont, se connecter, installer le skill.
- [Paramètres](docs://ref-instellingen) : les deux interrupteurs IA.
- [Notifications et avertissements](docs://ref-meldingen) : le point IA dans la barre d'état.

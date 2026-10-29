# Récupération après un plantage

Objectif : récupérer votre travail après un arrêt inattendu de l'application ou de votre navigateur, alors que vous n'aviez pas enregistré.

## Quand vous en avez besoin

Votre ordinateur portable est tombé en panne, l'application s'est figée ou l'onglet du navigateur a planté, et vous n'aviez pas encore enregistré les dernières modifications. Dès qu'il y a une modification, l'application conserve en arrière-plan des copies de récupération de tous vos projets ouverts, au plus une fois toutes les dix secondes. Cette copie est séparée de votre fichier de projet. Pour la différence avec l'enregistrement et l'enregistrement automatique, lisez [Fichiers et formats](docs://uitleg-bestanden).

## Étapes

1. Relancez l'application. Dans le navigateur, vous rechargez le même onglet : la copie de récupération appartient à cet onglet seul.
2. Si l'application a trouvé des copies, la fenêtre *Restaurer le travail non enregistré* s'affiche : *Open Planner Studio ne s'est pas fermé normalement. Les documents suivants comportaient des modifications non enregistrées qui peuvent être restaurées :* Pour chaque projet, elle affiche le nom, le chemin du fichier si le projet en a un (dans le navigateur, seul le nom du fichier), le nombre de tâches et l'heure de la copie, par exemple *21 tâches* et *Enregistré : Sep 29, 2026 9:41 AM*. L'heure suit le réglage *Format de l'heure*. La fenêtre peut aussi afficher des projets que vous n'avez pas modifiés.
3. Choisissez *Restaurer*. L'application ouvre tous les projets de la liste, chacun dans un onglet, avec l'état de la dernière copie. La touche Entrée a le même effet.
4. Vérifiez vos projets et enregistrez-les immédiatement avec Ctrl+S.

Si vous ne voulez pas restaurer, vous avez deux possibilités. *Ne pas restaurer* supprime les copies, et vous ne pouvez pas annuler cette action. Si vous fermez la fenêtre avec Échap, avec la croix ou en cliquant à côté, les copies restent et l'application vous le demande à nouveau au prochain démarrage.

Le point d'interrogation en haut à droite de la fenêtre ouvre cet article sans faire de choix. Pendant que vous lisez l'aide, la fenêtre attend. Quand vous revenez, elle est de nouveau là et vous pouvez toujours restaurer.

## Pièges et ce que fait l'application dans ce cas

**Vous récupérez l'état de la dernière copie.** Ce que vous avez fait dans les dernières secondes avant le plantage peut manquer. Un projet qui comportait des modifications est de nouveau marqué *Non enregistré*. L'historique *Annuler* est vide : vous ne pouvez pas annuler les actions d'avant le plantage. Le zoom, la position de défilement et la sélection sont reconstitués.

**Dans l'application de bureau, un projet récupéré garde son fichier ; dans le navigateur, non.** Dans l'application de bureau, *Enregistrer* écrit dans le fichier d'origine, avec l'état récupéré. Dans le navigateur, un projet récupéré n'est plus lié à son fichier : *Enregistrer* demande où le fichier doit être enregistré. L'interrupteur *Enregistrement automatique* est alors aussi grisé, tant que vous n'avez pas enregistré le projet une fois.

**Un projet dans la vue *Dates telles qu'enregistrées* reste dans cette vue.** Voir [Dates telles qu'enregistrées](docs://uitleg-datums-zoals-opgeslagen).

**Dans l'application de bureau, la fenêtre n'apparaît pas à chaque démarrage.** Les copies de récupération se trouvent dans le dossier de données de l'application, sous forme de fichiers IFC dont le nom commence par *recovery*. Si vous fermez l'application de façon normale, elle supprime ses propres copies. La fenêtre apparaît donc après une fin inattendue, après un redémarrage pour une mise à jour de l'application, ou si vous avez reporté la récupération au démarrage précédent.

**Dans le navigateur, la copie est conservée par onglet.** La copie se trouve dans le stockage du navigateur. Un nouvel onglet ou une nouvelle fenêtre ne propose pas les copies d'un autre onglet. Les copies d'onglets qui n'existent plus sont supprimées après sept jours, dès que l'application écrit à nouveau des copies.

**Dans le navigateur, la fenêtre apparaît aussi après un simple rechargement.** Cela arrive même si vous aviez tout enregistré. Si vous avez enregistré juste avant de recharger et que vous n'avez rien modifié après, vous pouvez sans risque choisir *Ne pas restaurer* : votre fichier est à jour.

**La fenêtre n'apparaît pas.** Dans ce cas, l'application n'a trouvé aucune copie. Cela arrive si vous n'aviez encore rien modifié, si vous utilisez un nouvel onglet dans le navigateur, si vous avez déjà supprimé la récupération avec *Ne pas restaurer*, ou si le plantage est survenu avant que l'application ait conservé la première copie : cela peut prendre jusqu'à environ dix secondes après votre première modification.

**Une copie est endommagée.** L'application affiche *Le fichier récupéré n'a pas pu être lu*, avec la raison, et propose les autres projets. Si vous choisissez *Restaurer*, l'application supprime ensuite toutes les copies, y compris celle qui ne peut pas être lue. Si aucune copie n'est lisible, la fenêtre n'apparaît pas et les copies sont conservées.

**La restauration échoue.** L'application affiche *Échec de la restauration* avec la raison. Les copies restent et la question revient au prochain démarrage.

**Certains projets ne peuvent pas être chargés.** L'application affiche : *2 fichiers de récupération n'ont pas pu être chargés et ont été ignorés.* Pour un seul fichier, elle affiche *1 fichier de récupération n'a pas pu être chargé et a été ignoré.* Les autres projets sont restaurés. Comme un élément a été ignoré, toutes les copies restent et la fenêtre revient au prochain démarrage avec la même liste. Choisissez alors *Ne pas restaurer* si vous avez déjà récupéré tout ce qui pouvait l'être.

## Voir aussi

- [Fichiers et formats](docs://uitleg-bestanden) : enregistrement, enregistrement automatique et récupération après un plantage, côte à côte.
- [Activer l'enregistrement automatique](docs://howto-automatisch-opslaan) : laisser l'application mettre à jour votre fichier elle-même.
- [Ouvrir et enregistrer un fichier](docs://howto-bestand-openen-en-opslaan) : enregistrer après la récupération.
- [Dates telles qu'enregistrées](docs://uitleg-datums-zoals-opgeslagen) : ce qui arrive à un projet dans cette vue.

# Menus du clic droit

Les menus que le bouton droit de la souris ouvre dans le Gantt et dans le tableau des tâches, ce que fait chaque élément et les tâches auxquelles il s'applique. Les éléments qui existent aussi sous forme de bouton ou de raccourci se trouvent dans [Le ruban, onglet par onglet](docs://ref-lint) et [Raccourcis clavier](docs://ref-sneltoetsen).

## Quel menu où

Il existe quatre menus. Lequel s'affiche dépend de l'endroit où vous cliquez :

- **Sur une barre dans le Gantt** — le menu de tâche, avec *Démarrer une relation à partir d'ici* en haut.
- **Sur une tâche dans le tableau des tâches** — le même menu de tâche, sans cet élément en haut. Cela vaut pour le tableau des tâches à gauche du Gantt et pour l'onglet *Tableau*.
- **Sur un en-tête de groupe dans le tableau des tâches** — un petit menu pour développer et réduire les groupes. Les en-têtes de groupe n'apparaissent que si vous groupez, par exemple avec la disposition *Diagramme des ressources*.
- **Sur un espace vide** — dans le Gantt, à côté ou sous les barres, et dans le tableau des tâches sous la dernière tâche ou sur la ligne grise *Nouvelle tâche*. Le menu contient *Nouvelle tâche*, *Ajouter un jalon* et *Coller* ; dans le Gantt, il contient aussi *Réinitialiser le zoom* et *Ajuster au projet*. Une nouvelle tâche ou un nouveau jalon est ajouté en bas de la liste. Dans le Gantt, il commence à la date où vous avez cliqué ; dans le tableau des tâches, la cellule du nom s'ouvre tout de suite pour que vous puissiez écrire.

Sur la bande d'un en-tête de groupe dans le Gantt, le bouton droit de la souris ouvre le menu de l'espace vide ; l'en-tête de groupe lui-même n'a un menu que dans le tableau des tâches. Un clic droit sur l'en-tête de la frise chronologique ne fait rien. Les en-têtes de colonnes du tableau des tâches ont leur propre menu, décrit dans [Adapter les colonnes du tableau](docs://howto-tabelkolommen-aanpassen).

**À quelles tâches un élément s'applique-t-il ?** Vous cliquez sur une tâche, mais la sélection détermine le périmètre. Si la tâche sur laquelle vous cliquez fait partie de la sélection, l'élément s'applique à toute la sélection. Sinon, il s'applique à cette seule tâche. Avec un clic droit sur une barre dans le Gantt ou sur une ligne dans le tableau des tâches, cette tâche remplace la sélection si elle n'en faisait pas partie. Chaque élément qui modifie quelque chose correspond à une seule étape de la commande *Annuler*, y compris pour une sélection entière.

## Le menu de tâche

Les éléments sont dans cet ordre. Une ligne entre des groupes est un séparateur dans le menu.

**Démarrer une relation à partir d'ici** — uniquement dans le Gantt, sur une barre. Active le mode relation avec cette tâche sélectionnée ; vous faites ensuite glisser jusqu'au successeur. Voir [Ajouter des relations](docs://howto-relaties-leggen).

**Supprimer l'interruption** et **Supprimer toutes les interruptions** — uniquement dans le Gantt, sur une barre avec des interruptions. *Supprimer l'interruption* n'apparaît que si vous cliquez sur une interruption ou sur le morceau qui la suit, et si l'interruption est modifiable ; elle supprime cette seule interruption. *Supprimer toutes les interruptions* supprime toutes les interruptions, y compris celles provenant d'un fichier source que vous ne pouvez pas modifier. Voir [Fractionner une tâche](docs://howto-taak-splitsen).

**Modifier...** — ouvre la fenêtre *Modifier la tâche* pour cette tâche. Voir [Fenêtre de tâche et panneau des propriétés](docs://ref-taak-eigenschappen).

**Insérer au-dessus** et **Insérer en dessous** — insère une nouvelle tâche au-dessus de la tâche la plus haute ou en dessous de la tâche la plus basse du périmètre, au même niveau. Cela ne fonctionne que dans la vue arborescente pure, sans filtre, groupement ni tri ; sinon, l'application refuse avec un message. Voir [Ajouter des tâches et des jalons](docs://howto-taken-en-mijlpalen-toevoegen).

**Ajouter une sous-tâche** — ajoute une nouvelle tâche comme sous-tâche de la tâche sur laquelle vous avez cliqué, en bas de ses sous-tâches. Pour cette seule tâche, pas pour la sélection entière.

**Ajouter un jalon** — ajoute un jalon comme sous-tâche de la tâche sur laquelle vous avez cliqué. Pour cette seule tâche.

**Ajouter une relation** — fait la même chose que *Démarrer une relation à partir d'ici* : active le mode relation avec cette tâche sélectionnée. Dans le tableau des tâches, cet élément est désactivé si le Gantt n'est pas visible, avec l'info-bulle *Disponible uniquement lorsque le diagramme de Gantt est visible*.

**Mettre en retrait** et **Réduire le retrait** — déplace les tâches du périmètre d'un niveau plus bas ou d'un niveau plus haut dans le WBS. Ces deux éléments ne sont disponibles que dans la vue arborescente pure. Voir [Adapter la structure](docs://howto-structuur-aanpassen).

**Basculer en jalon** — transforme la tâche en jalon, ou l'inverse. Le nouvel état découle de la tâche sur laquelle vous avez cliqué et s'applique à tout le périmètre : si celle-ci est une tâche, toutes les tâches du périmètre deviennent des jalons. Une tâche récapitulative et une tâche avec des affectations ne deviennent pas des jalons ; les autres tâches du périmètre, elles, deviennent des jalons. Vous recevez un message par raison.

**Affecter un calendrier ▸** — un sous-menu avec *Calendrier du projet* (la tâche n'a alors pas de calendrier propre) et, en dessous, les calendriers disponibles. Le choix actuel porte une coche. Une tâche qui est déjà sur ce calendrier ne compte pas et ne crée pas d'étape supplémentaire pour la commande *Annuler*. Voir [Créer et affecter un calendrier](docs://howto-kalender-maken-en-toewijzen).

**Avancement ▸** — un sous-menu avec 0 %, 25 %, 50 %, 75 % et 100 %. La valeur actuelle porte une coche. Une tâche récapitulative n'a pas d'avancement propre : si elle fait partie du périmètre, ses tâches sans sous-tâches reçoivent le pourcentage. Sans date d'état, l'application la fixe à aujourd'hui, avec un message. Une tâche dont le début est planifié seulement après la date d'état et qui n'a pas encore de début réel pose d'abord une question sur le début réel ; si vous annulez, rien ne change. Voir [Mettre à jour l'avancement](docs://howto-voortgang-bijwerken).

**Priorité ▸** — un sous-menu avec *Basse* (100), *Normale* (500) et *Haute* (900), la priorité de nivellement de la tâche. La valeur actuelle porte une coche. Voir [Nivellement des ressources](docs://uitleg-nivelleren).

**Tracer le chemin** — affiche les prédécesseurs et les successeurs de cette tâche. Si le traçage est déjà actif, l'élément s'appelle *Arrêter le traçage du chemin*. Voir [Tracer un chemin](docs://howto-pad-traceren).

**Réduire**, **Développer** et **Enregistrer la branche comme modèle** — uniquement pour une tâche récapitulative. *Réduire* et *Développer* sont toujours tous deux présents, même si la tâche est déjà réduite ou développée, et s'appliquent à tout le périmètre. *Enregistrer la branche comme modèle* enregistre la tâche avec ses sous-tâches et les relations entre elles comme modèle WBS. Voir [Enregistrer et insérer des modèles WBS](docs://howto-wbs-sjablonen).

**Supprimer** — supprime les tâches du périmètre, avec leurs sous-tâches. Il n'y a pas de confirmation ; vous les récupérez avec Ctrl+Z, en une seule étape pour tout le périmètre. Voir [Sélectionner, supprimer et annuler des tâches](docs://howto-taken-selecteren-verwijderen).

## Le menu d'un en-tête de groupe

Ce menu n'existe que dans le tableau des tâches, sur un en-tête de groupe :

**Réduire le groupe** ou **Développer le groupe** — réduit ou développe uniquement ce groupe. L'élément indique ce que vous pouvez faire.

**Tout développer** et **Tout réduire** — développe ou réduit tous les groupes en une fois.

Vous configurez le groupement avec une disposition, voir [Créer et utiliser une disposition](docs://howto-layouts-gebruiken).

## Voir aussi

- [Faire glisser, déplacer et zoomer dans le Gantt](docs://howto-gantt-bedienen): ce que fait le glissement avec les boutons gauche et central de la souris.
- [Le ruban, onglet par onglet](docs://ref-lint): les boutons qui ont les mêmes actions.
- [Raccourcis clavier](docs://ref-sneltoetsen): les touches associées.

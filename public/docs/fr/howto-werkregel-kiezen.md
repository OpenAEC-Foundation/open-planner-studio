# Choisir un type de tâche

Objectif : définir, pour chaque tâche, ce que l'application ajuste quand vous modifiez la durée, les unités ou le travail : la durée, les unités ou le travail lui-même.

## Quand vous en avez besoin

Vous avez affecté des ressources à une tâche et vous voulez que l'application calcule comme vous le faites. Par exemple : la grue est louée pour un jour et ce jour est fixe. Autre exemple : vous savez qu'il y a 160 heures de maçonnerie et vous voulez voir combien de temps cela prend avec trois personnes au lieu de deux. Ces deux situations demandent un autre type de tâche.

Le type de tâche décide laquelle des trois grandeurs (durée, unités et travail) suit quand vous modifiez une autre grandeur. Le contexte et des exemples détaillés se trouvent dans [Types de tâche : durée, unités et travail](docs://uitleg-werkregels).

## Étapes

### Afficher le type de tâche

Le type de tâche n'est pas affiché par défaut. Activez-le une fois :

1. Choisissez *Paramètres › Projet › Paramètres de l'app*, onglet *Planification*.
2. Sous le titre *Calcul*, cochez *Utiliser les types de tâche*.
3. Fermez la fenêtre avec *Fermer*.

Il s'agit d'un réglage de l'application, et non du fichier de projet. Si un fichier contient déjà des types de tâche ou du travail enregistré, par exemple un fichier de MS Project ou de Primavera P6, l'application affiche le type de tâche de ce fichier même sans ce réglage. C'est aussi le cas dès que vous choisissez vous-même un type de tâche dans un fichier : l'affichage reste alors activé pour ce fichier, même si vous désactivez ensuite le réglage. Il reste activé tant que le fichier est ouvert, et après une réouverture tant que le fichier contient un type de tâche ou du travail enregistré.

### Choisir le type de tâche d'une tâche

1. Sélectionnez la tâche. Le panneau *Propriétés* se trouve à droite ; s'il n'est pas visible, activez-le avec *Affichage › Panneaux › Propriétés*.
2. Au champ *Type de tâche*, choisissez l'une des cinq options : *Valeur par défaut du projet (Durée et unités fixes)*, *Durée et unités fixes*, *Durée et travail fixes*, *Travail fixe* ou *Unités fixes*. Avec *Valeur par défaut du projet*, la tâche suit la valeur par défaut du projet.
3. Vous voulez savoir ce que fait une option ? Dans la liste déroulante ouverte, chaque option a une icône i. Pointez-la, puis cliquez ou appuyez dessus pour lire l'explication. Cliquer sur l'icône i ne choisit pas encore ce type de tâche.
4. À côté du champ fermé se trouve aussi une icône i. Elle explique le type de tâche qui s'applique maintenant, par exemple *La durée découle du travail et des unités.* Avec *Valeur par défaut du projet*, c'est le type de tâche entre parenthèses.

*Valeur par défaut du projet* est le premier choix et le type qu'une tâche a par défaut. Le type de tâche entre parenthèses est celui que le projet a actuellement par défaut. L'application n'a pas de bouton pour modifier cette valeur par défaut du projet : elle vient d'un import (par exemple de MS Project ou de Primavera P6) ou de la connexion MCP. Si vous voulez un autre type de tâche pour une seule tâche, choisissez-le ici.

Vous pouvez aussi choisir le type de tâche dans le tableau. Cliquez sur le **+** à droite de l'en-tête du tableau des tâches (*Ajouter une colonne*) et, sous *Planification*, choisissez la colonne *Type de tâche*.

Une tâche sans affectation n'a rien à relier, donc le type de tâche n'a aucun effet. Affectez d'abord une ressource (voir [Affecter des ressources avec une courbe](docs://howto-resource-toewijzen)).

### Voir et modifier le travail

Pour une tâche avec des affectations, une colonne *Travail (h)* apparaît dans le bloc *Affectations* du panneau *Propriétés*, à côté de *Unités*. C'est le travail restant de cette ressource, en heures. Un petit cadenas au-dessus d'une colonne indique ce que le type de tâche maintient : *Unités* avec *Durée et unités fixes* et avec *Unités fixes*, *Travail (h)* avec *Durée et travail fixes* et avec *Travail fixe*.

Si vous voulez modifier le travail vous-même, saisissez les heures dans le champ et appuyez sur Entrée. L'application n'accepte pas une valeur de 0 ou moins : le champ revient à la valeur précédente.

### Voir ce qui se passe

Si vous choisissez un type de tâche, aucun nombre ne change encore. Avec un type de tâche qui protège le travail, l'application fixe seulement le travail actuel, donc *Travail (h)* a une valeur enregistrée. C'est seulement au changement suivant que le type de tâche décide ce qui suit. Modifiez par exemple *Unités* et regardez ce qui arrive à la durée et au travail.

Si cela modifie la durée de la tâche, la barre d'état affiche *Obsolète — recalculer (F5)*. Appuyez sur **Calculer** (F5), par exemple via *Accueil › Planification › Calculer*, pour voir les nouvelles dates. Si *Calculer automatiquement* est activé (même onglet *Planification*, titre *Calcul*), l'application le fait elle-même.

## Quel type de tâche convient

- **Durée et unités fixes** convient quand la durée est convenue et que les unités sont votre donnée. Le travail découle des deux. C'est la valeur par défaut. La grue louée pour un jour relève de ce cas : le jour est fixe et vous décidez du nombre de grues ce jour-là.
- **Durée et travail fixes** convient quand la tâche doit se terminer dans un délai fixe et que vous connaissez le travail qu'elle contient. Si la durée change, l'application ajuste les unités.
- **Travail fixe** convient quand vous connaissez le nombre d'heures de travail et voulez voir comment la durée évolue avec le nombre de personnes. Les 160 heures de maçonnerie avec trois personnes au lieu de deux relèvent de ce cas. Le plastering dans le practice project reçoit ce type de tâche.
- **Unités fixes** convient quand les unités sont fixes, par exemple une seule grue, et que le travail détermine la durée.

## Pièges et ce que fait alors l'application

**Le champ *Type de tâche* est absent.** Dans ce cas, le réglage *Utiliser les types de tâche* est désactivé et le fichier ne contient pas encore de type de tâche, ou vous avez sélectionné un jalon, une phase, un hamac ou une tâche dont le type de durée est *temps écoulé*. Il n'y a pas de type de tâche à cet endroit. Sélectionnez une tâche ordinaire.

**La durée change alors que vous ne la modifiez pas.** Avec *Travail fixe* et *Unités fixes*, la durée découle des unités et du travail. Si vous modifiez l'un de ceux-ci ou le nombre de ressources, l'application ajuste la durée, arrondie au jour ouvré entier supérieur. Pour une tâche exprimée en heures, l'application arrondit à la minute entière supérieure.

**Le travail ne correspond pas exactement à unités × durée.** L'arrondi peut en être la cause. Dans le champ *Travail (h)*, un signe d'avertissement apparaît alors, *Diffère de unités × durée*. L'histogramme suit le travail enregistré.

**Le matériau ne compte pas.** Pour une ressource de type matériau, *Travail (h)* affiche un tiret. Un matériau ne détermine jamais la durée.

**Une tâche avec avancement.** Le type de tâche agit sur la partie restante. Donc *Travail (h)* n'affiche que ce qui reste à faire.

**Annulation.** Choisir un type de tâche, ainsi que chaque modification que le type de tâche calcule, compte comme une seule étape pour *Annuler* (Ctrl+Z). Le type de tâche choisi disparaît alors à nouveau, mais le champ *Type de tâche* reste visible.

## Voir aussi

- [Types de tâche : durée, unités et travail](docs://uitleg-werkregels) : comment l'application relie la durée, les unités et le travail, avec des exemples détaillés.
- [Affecter des ressources avec une courbe](docs://howto-resource-toewijzen) : affecter une ressource à une tâche.

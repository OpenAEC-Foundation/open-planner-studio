# Ajouter des relations

Objectif : lier des tâches entre elles, pour qu'une tâche ne démarre que lorsque le travail qui la précède est terminé. Ajoutez si nécessaire un temps d'attente (décalage) entre deux tâches.

## Quand vous en avez besoin

Sans relations, l'application ne sait pas que le maçon ne peut commencer qu'une fois la fondation coulée. Toutes les tâches démarrent alors à la date de début du projet, et la date de fin n'a plus aucun sens. Une **relation** enregistre cet ordre. La première tâche est le **prédécesseur**, la seconde le **successeur**.

Vous ajoutez des relations lorsque vous établissez un planning, lorsqu'une tâche est ajoutée, ou lorsque deux travaux se révèlent finalement dépendants l'un de l'autre. Un **décalage** est un temps d'attente entre deux tâches, comme du béton qui doit durcir ou une chape qui doit sécher.

La relation par défaut est **FS** (fin-début) : le successeur ne peut démarrer qu'une fois le prédécesseur terminé. L'application connaît aussi SS, FF et SF, qui relient un début ou une fin à un début ou une fin. Avec SS (début-début), par exemple, le plâtrage ne peut commencer qu'une fois que les installations techniques ont démarré.

Vous ne savez pas quel type choisir ? Sous le choix du type, une phrase avec les noms réels des tâches explique le type, par exemple *Metselwerk ne commence qu'après la fin de Fundering.* Choisissez un autre type et la phrase change avec lui. Vous la voyez dans la fenêtre *Type de relation*, dans le bloc *Dépendances* et dans la colonne *Prédécesseurs* ou *Successeurs*.

## Étapes

Il existe quatre façons d'ajouter une relation. Elles créent la même relation ; choisissez celle qui convient le mieux à votre situation.

### Lier deux tâches sélectionnées

Utile lorsque vous travaillez dans le tableau des tâches.

1. Dans le tableau des tâches, cliquez sur la tâche qui vient en premier : le prédécesseur.
2. Maintenez Ctrl (⌘ sur un Mac) et cliquez sur la tâche qui vient ensuite : le successeur.
3. Choisissez *Accueil › Tâches › Lien ▾ › Lier les tâches sélectionnées*. Le même bouton se trouve aussi dans *Planification › Relations*.

L'application crée une relation fin-début sans décalage. Vous la voyez comme une flèche dans le Gantt et dans la colonne *Prédécesseurs* ; une notification n'apparaît que si l'application refuse la relation. Le bouton ne fonctionne qu'avec exactement deux tâches sélectionnées.

### Tracer une relation dans le Gantt

Utile lorsque vous ajoutez plusieurs relations à la suite.

1. Choisissez *Accueil › Tâches › Lien ▾ › Tracer une relation*. Au-dessus du planning, l'avis *Mode relation : faites glisser d'une barre à l'autre dans le Gantt pour créer une relation. Échap pour arrêter.* apparaît.
2. Appuyez sur la barre du prédécesseur et faites-la glisser vers la barre du successeur. Une ligne en pointillés avec une flèche vous suit.
3. Relâchez. Une petite fenêtre *Type de relation* apparaît, avec le type (FS par défaut) et une case pour le décalage.
4. Modifiez le type ou le décalage si nécessaire, puis appuyez sur Entrée ou cliquez en dehors de la fenêtre. La relation est créée.
5. Ajoutez tout de suite la suivante : le mode reste actif. Vous l'arrêtez avec Échap, avec le bouton *Arrêter* dans l'avis, ou en choisissant de nouveau *Tracer une relation*.

Si vous appuyez sur Échap dans la fenêtre *Type de relation*, rien n'est enregistré. Pour une seule relation, vous n'avez pas besoin d'activer le mode : maintenez Maj pendant que vous faites glisser d'une barre à l'autre. *Démarrer une relation à partir d'ici* dans le menu contextuel (clic droit) d'une barre active le mode relation ; le glissement, vous le faites vous-même. Dans l'onglet *Tableau*, sans Gantt, *Tracer une relation* est désactivé.

### Ajouter une relation dans le panneau des propriétés

Utile lorsque vous regardez une seule tâche et voulez ajouter ses prédécesseurs ou successeurs.

1. Sélectionnez la tâche. Le panneau *Propriétés* se trouve à droite ; si vous ne le voyez pas, activez-le avec *Affichage › Panneaux › Propriétés*.
2. Dans le bloc *Dépendances*, cliquez sur *Ajouter une relation*.
3. Laissez la direction sur *Prédécesseur* si l'autre tâche vient en premier, ou choisissez *Successeur*.
4. Tapez une partie du nom de l'autre tâche. Choisissez la bonne avec les flèches et Entrée, ou cliquez dessus.
5. Choisissez le type (FS par défaut) et indiquez un décalage si nécessaire.
6. Appuyez sur Entrée ou cliquez sur la coche (*Créer la relation*).

Les relations de la tâche figurent alors dans *Dépendances*, chacune avec le numéro WBS de l'autre tâche, le type et le décalage.

### Saisir des relations dans la colonne Prédécesseurs

Utile lorsque vous travaillez vite au clavier et que vous connaissez les numéros WBS.

1. Cliquez sur le **+** à droite de l'en-tête du tableau des tâches (*Ajouter une colonne*), puis choisissez, sous *Relations*, la colonne *Prédécesseurs*. La colonne *Successeurs* fonctionne de la même manière.
2. Dans la colonne *Prédécesseurs*, cliquez dans la cellule du successeur.
3. Tapez le numéro WBS du prédécesseur, un espace et le type, par exemple `2.6 FS`. Ajoutez un décalage juste après : `2.6 FS+1d`. Séparez plusieurs prédécesseurs par un point-virgule ou une virgule : `3.1 FS; 3.2 SS+2d`.
4. Appuyez sur Entrée.

Ce que vous tapez remplace toute la cellule. Si la cellule contient déjà des prédécesseurs, tapez-les aussi (voir les pièges). Si vous appuyez sur Entrée ou F2 dans la cellule au lieu de taper, un champ de saisie s'ouvre qui conserve les relations existantes : vous recherchez une tâche par numéro WBS ou par nom, puis choisissez le type et le décalage pour chaque relation.

### Définir ou modifier un décalage

Vous tapez un décalage dans la case à côté du type, avec chacune des façons décrites ci-dessus. Vous modifiez un décalage existant dans *Dépendances* : cliquez dans la case du décalage, tapez la nouvelle valeur et appuyez sur Entrée.

- `3` ou `3d` : 3 jours ouvrés. Un week-end ne compte pas. L'application affiche `+3d`.
- `3ed` : 3 jours calendaires. Le week-end compte, comme pour du béton qui durcit aussi le samedi et le dimanche.
- `-1` : un décalage négatif (avance). Le successeur peut démarrer un jour plus tôt, de sorte que les tâches se chevauchent.
- `4h` : 4 heures ouvrées ; l'application l'affiche comme `+4h`. Si le prédécesseur est une tâche en jours sur un calendrier sans plages horaires propres, comme le calendrier standard, l'application convertit ceci en jours ouvrés entiers, arrondis au jour le plus proche : `4h` agit alors comme 1 jour, `2h` comme 0. Sur un calendrier avec ses propres plages horaires, ou après une tâche en heures, le décalage compte exactement en heures.
- `50%` : la moitié de la durée du prédécesseur.

Exemple : le béton de la fondation doit durcir avant que le maçon puisse travailler dessus. *Pour foundation → Foundation brickwork* reçoit donc une relation FS avec le décalage `3`. Si le coulage a lieu le vendredi 18 juin 2027, la maçonnerie démarre après **Calculer** le jeudi 24 juin : du lundi au mercredi, c'est du temps d'attente. Avec `3ed`, le week-end compte et la maçonnerie démarre le mardi 22 juin.

### Enfin : recalculer

Une nouvelle relation ne déplace pas encore de barres ; la barre d'état affiche *Obsolète — recalculer (F5)*. Appuyez sur **Calculer** (F5), par exemple via *Accueil › Planification › Calculer*. Ce n'est qu'alors que les successeurs reçoivent leurs nouvelles dates. Si vous voulez que l'application le fasse pour vous, activez *Calculer automatiquement* dans *Paramètres › Projet › Paramètres de l'app*, onglet *Planification*.

## Pièges et comportement de l'application

**Ordre inversé.** Avec *Lier les tâches sélectionnées*, l'ordre dans lequel vous cliquez compte, et non l'ordre dans la liste. Si vous cliquez d'abord sur la tâche la plus tardive, la relation est dans le mauvais sens. Supprimez-la dans *Dépendances* avec l'icône de corbeille et ajoutez-la de nouveau.

**Taper dans la colonne efface ce qui s'y trouvait.** Si la cellule contient `3.4 FS; 3.2 FS` et que vous ne tapez que `3.2 FS`, la relation avec 3.4 disparaît, sans message. Tapez tous les prédécesseurs, utilisez Entrée ou F2 pour en ajouter, ou annulez avec Ctrl+Z.

**Un cycle.** Si vous ajoutez une relation qui revient vers une tâche située plus tôt dans la chaîne, le planning ne pourrait jamais démarrer. L'application refuse une telle relation : *Cette relation créerait un cycle dans la planification (…) et n'a pas été créée*, avec entre parenthèses les tâches du cycle. Supprimez d'abord la relation qui ferme le cycle.

**Une tâche et sa tâche récapitulative.** Une relation entre une tâche et la tâche récapitulative dans laquelle elle se trouve n'est pas possible. L'application affiche : *Une relation entre une tâche et sa propre tâche récapitulative parente (ou ancêtre) n'est pas autorisée.*

**Doublon.** Si la relation existe déjà, l'application affiche *Cette relation existe déjà* et rien ne change.

**Messages plus courts dans la colonne.** La colonne *Prédécesseurs* donne les mêmes refus, avec un texte plus court sous la cellule : *Cette modification créerait un cycle dans la planification.*, *Cette relation existe déjà.* ou *Une tâche ne peut pas avoir de relation avec sa propre tâche récapitulative.* Si vous tapez seulement un numéro WBS, comme `3.1`, le type manque et la cellule affiche *Utilisez par exemple 1.2 FS+2d.* La cellule reste ouverte ; corrigez la saisie ou appuyez sur Échap pour annuler.

**Pas de demi-jours de décalage.** Un décalage en jours est toujours un nombre entier : `1.5` devient `+2d`, et un décalage en heures après une tâche en jours, sur un calendrier sans plages horaires propres, est arrondi en jours ouvrés entiers. Une saisie illisible, comme un mot, n'est pas enregistrée : la case revient à la valeur précédente.

## Voir aussi

- [Chemin critique et marge](docs://uitleg-kritiek-pad) : ce que l'application calcule à partir de vos relations, et pourquoi une tâche devient critique.
- [Relations et décalage](docs://uitleg-relaties) : ce que les quatre types de relation et un décalage font aux dates.
- [Tracer un chemin](docs://howto-pad-traceren) : faire apparaître la chaîne des prédécesseurs et des successeurs.
- [Boîte de dialogue de la tâche et panneau des propriétés](docs://ref-taak-eigenschappen) : les champs pour les relations et le décalage dans le panneau et dans la boîte de dialogue.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc) : une chaîne de relations fin-début avec une relation début-début (murs et toiture, décalage de 2 jours) et une relation fin-fin (carrelage et peinture, décalage de 1 jour).

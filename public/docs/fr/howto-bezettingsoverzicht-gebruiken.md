# Utiliser l'aperçu de l'occupation

Objectif : voir les jours où deux projets ouverts ou plus demandent ensemble davantage d'une ressource que ce que la bibliothèque de ressources en prévoit.

## Quand vous en avez besoin

Votre équipe de maçons travaille sur les façades dans un projet et sur les garages dans un autre. Chaque projet affiche une équipe bien planifiée, car l'histogramme et la surallocation d'un projet ne regardent que ce seul projet. Ce n'est qu'en mettant les projets côte à côte que l'on voit qu'aux mêmes jours ils demandent ensemble plus de maçons que vous n'en avez. L'aperçu de l'occupation fait cette comparaison à votre place.

L'aperçu ne compte que les ressources qui viennent de la bibliothèque de ressources, dans des projets liés à cette même bibliothèque de ressources. Vous trouverez dans [La bibliothèque de ressources](docs://uitleg-resourcebibliotheek) comment cela se calcule.

## Étapes

### 1. Préparer les projets

1. Ouvrez les projets que vous voulez comparer, chacun dans son propre onglet, voir [Travailler sur plusieurs projets à la fois](docs://howto-meerdere-projecten). L'aperçu ne voit que les projets ouverts dans cette application.
2. Liez chaque projet à la même bibliothèque de ressources, et utilisez dans chaque projet la ressource qui vient de cette bibliothèque de ressources. Sans liaison à une bibliothèque de ressources, le panneau des ressources n'affiche pas l'aperçu. Voir [Utiliser la bibliothèque de ressources](docs://howto-resourcebibliotheek-gebruiken).
3. Calculez les projets avec *Calculer* (F5), ou activez *Calculer automatiquement*. Ce que fait l'aperçu avec les projets obsolètes est décrit dans les pièges ci-dessous.

### 2. Ouvrir l'aperçu

1. Allez dans l'un des projets et choisissez *Ressources › Gérer › Ressources*.
2. En haut à droite, choisissez *Occupation*. L'aperçu appartient à la bibliothèque de ressources du projet dans lequel vous vous trouvez. Vous ne pouvez rien modifier dans ce panneau : c'est une fenêtre en lecture seule.

### 3. Lire le tableau

Chaque ressource de la bibliothèque de ressources qui est réservée dans au moins un projet ouvert reçoit une ligne. Les ressources sans réservation ne figurent pas dans la liste. Les lignes avec le plus de jours en surallocation sont en haut, puis l'ordre alphabétique.

- *Documents* indique dans combien de projets la ressource est réservée, par exemple *2 documents*.
- *Période* va du premier au dernier jour avec charge, écrit au format aaaa-mm-jj, par exemple *2027-06-07 – 2027-06-14*.
- *Pic / Capacité* indique la charge journalière la plus haute de tous les projets ensemble, comparée à la capacité de la ressource dans la bibliothèque de ressources, par exemple *4,0 / 3,0*. S'il y a au moins un jour en surallocation, il est affiché en rouge.
- Un repère rouge après la ligne, par exemple *3 jours réservés en double*, compte les jours où la somme est supérieure à la capacité. Si vous survolez le repère, vous voyez les dates.

### 4. Regarder par projet

1. Cliquez sur la petite flèche devant le nom d'une ressource. La ligne s'ouvre.
2. En haut figurent les dates en surallocation, les cinq premières, puis *… et 3 de plus* s'il y en a davantage. En dessous figure, par projet, le nom avec la période et le pic de ce seul projet, par exemple *Houses North 2027-06-07 – 2027-06-11 Pic : 2,0*.
3. Cliquez sur la ligne elle-même pour voir un histogramme en bas. Chaque projet a sa propre couleur et les barres sont empilées. La ligne pointillée est la capacité de la bibliothèque de ressources. Si elle change dans le temps, vous voyez des paliers. Les jours en surallocation reçoivent une bande rouge derrière les barres. Cliquez encore une fois sur la ligne pour refermer l'histogramme. Sans ligne choisie, il est écrit *Sélectionnez une ressource pour voir l'histogramme.*

### 5. Résoudre le problème

L'aperçu montre le problème, mais ne le résout pas. Vous avez deux options :

- Déplacez une tâche dans l'un des projets, ou donnez-lui moins d'unités par jour. Recalculez ensuite ce projet avec F5.
- Si quelqu'un vient réellement en renfort, augmentez *Unités max* de la ressource dans la bibliothèque de ressources. Vous le faites dans *Ressources › Gérer › Ressources*, vue *Bibliothèque*.

*Niveler…* dans le ruban n'aide pas ici : cette commande regarde les ressources de l'unique projet dans lequel vous vous trouvez, voir [Nivellement des ressources](docs://uitleg-nivelleren).

## Pièges et ce que fait l'application alors

**L'aperçu est vide.** Il affiche *Aucune ressource de la bibliothèque n'est réservée dans les documents ouverts*. Dans ce cas, aucun projet ouvert n'a de ressource de la bibliothèque de ressources sur une tâche.

**Vous ne voyez pas le bouton *Occupation*.** Le projet dans lequel vous êtes n'est lié à aucune bibliothèque de ressources.

**Un projet ne compte pas.** Il n'est pas ouvert dans cette application, il est lié à une autre bibliothèque de ressources, ou la ressource qu'il contient est une ressource propre à ce projet. Au bas de l'aperçu, il est toujours écrit *Cet aperçu ne voit que les documents ouverts dans cette application.* Une copie d'une ressource qui a depuis été retirée de la bibliothèque de ressources ne compte pas non plus.

**Une copie ou une variante compte pleinement.** Chaque projet ouvert lié à la bibliothèque de ressources compte, même s'il s'agit d'une copie ou d'une variante d'un autre projet ouvert, par exemple une variante qu'un assistant IA a créée avec `planner_duplicate_document`. L'original et la variante ensemble peuvent alors montrer une surallocation qui n'existe en réalité qu'une fois. L'aperçu ne filtre pas cela en silence : fermez la variante un instant, ou tenez-en compte.

**Un projet est obsolète.** Un projet est obsolète si vous avez modifié quelque chose dans le planning sans le recalculer. L'aperçu traite alors ce projet comme suit :

- Pour un projet qui n'est pas l'onglet actif, l'aperçu calcule lui-même à l'avance, sans modifier le projet. Au-dessus du tableau, il est alors écrit *Les documents modifiés ont été calculés à l'avance pour cet aperçu ; appuyez sur F5 dans le document, ou activez « Calculer automatiquement » pour le faire en permanence.* Après le projet, il est écrit *Calculé à l'avance pour cet aperçu — le document lui-même affiche encore d'anciennes dates jusqu'à ce que vous appuyiez sur F5 ou activiez « Calculer automatiquement »*. Si *Calculer automatiquement* est activé (*Paramètres › Projet › Paramètres de l'app*, onglet *Planification*), l'application recalcule vraiment ces projets dès que vous regardez l'aperçu, et le message disparaît. Si le projet actif est lui aussi obsolète, le message du point suivant s'affiche au-dessus du tableau à la place.
- L'aperçu ne calcule pas lui-même le projet dans lequel vous êtes. Si ce projet est obsolète, il est écrit *Un document modifié n'a pas encore été recalculé ; il est pris en compte ici avec ses derniers chiffres calculés. Appuyez sur F5 dans ce document, ou activez « Calculer automatiquement ».* et, après le projet, *Obsolète : ce sont les derniers chiffres calculés — appuyez sur F5 dans ce document.* Attention : *derniers chiffres calculés* n'est pas tout à fait exact. L'aperçu prend les anciennes dates de début, mais déjà une durée ou une affectation modifiée. Les chiffres peuvent donc différer à la fois de l'ancien et du nouveau planning, et des barres dans le Gantt. Ne vous y fiez qu'après F5.
- Si l'aperçu ne peut pas calculer un projet, par exemple à cause d'une boucle dans ses relations, ce projet ne compte pas. Il reste listé, avec *Non compté : planification non calculée — activez ce document et appuyez sur F5.* et, au-dessus du tableau, *Au moins un document n'a pas été calculé et n'est pas pris en compte dans l'occupation.*

**L'aperçu ne correspond pas à ce que vous attendez.** La capacité vient de la bibliothèque de ressources (*Unités max.* de l'élément de la bibliothèque de ressources, ou sa *Capacité échelonnée dans le temps* ce jour-là), et non des *Unités max.* de la copie dans le projet. Une somme égale à la capacité n'est pas un conflit.

## Voir aussi

- [La bibliothèque de ressources](docs://uitleg-resourcebibliotheek) : comment l'occupation est comptée, avec un exemple travaillé.
- [Utiliser la bibliothèque de ressources](docs://howto-resourcebibliotheek-gebruiken) : lier des projets et affecter des ressources.
- [Résoudre une surallocation](docs://howto-overbezetting-oplossen) : surallocation dans un seul projet.

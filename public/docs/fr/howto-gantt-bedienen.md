# Glisser, déplacer et zoomer dans le Gantt

Objectif : utiliser la ligne de temps avec la souris. Déplacer une barre ou ajuster sa durée, décaler la ligne de temps, sélectionner des tâches avec un cadre et zoomer ou dézoomer.

## Quand vous en avez besoin

Vous voyez dans le Gantt que la maçonnerie doit commencer deux jours plus tard, ou que le coulage prend un jour de plus. Vous voulez alors agir directement sur la barre. Ou vous avez un projet de plusieurs mois et vous voulez faire défiler rapidement jusqu'au jour férié du bâtiment. La souris offre quelques gestes pour cela. Le geste obtenu dépend de l'endroit où vous commencez à glisser et de votre réglage de défilement.

## Étapes

### Déplacer une barre

1. Appuyez au milieu d'une barre et glissez horizontalement. Le début et la fin se déplacent ensemble, par jours entiers. La durée ne change pas.
2. Relâchez. La barre reste à sa nouvelle place. Le planning n'est alors plus à jour. Appuyez sur *Calculer* (F5), ou laissez l'application le faire seule si *Calculer automatiquement* est activé.

Si la tâche a un prédécesseur, l'application enregistre le nouveau début comme la contrainte *Début au plus tôt le (SNET)*. Elle l'indique après que vous avez relâché. Le pourquoi, et ce qui se passe avec une autre contrainte, est expliqué dans [Contraintes et échéances](docs://uitleg-constraints). Si vous glissez de nouveau jusqu'au début d'origine, la contrainte d'origine revient aussi.

Si vous glissez surtout vers le haut ou vers le bas au lieu de côté, vous déplacez la tâche vers une autre ligne, et les dates restent. La direction choisie dans les premiers pixels s'applique à tout le glissement. Ainsi, un seul geste ne modifie jamais les dates et la structure en même temps. Voir [Modifier la structure](docs://howto-structuur-aanpassen).

### Ajuster la durée

1. Placez la souris sur le bord droit de la barre. Le curseur devient une flèche orientée à gauche et à droite.
2. Glissez le bord. Pendant le glissement, une petite pastille dans la couleur d'accent du thème (orange par défaut) affiche la durée que la tâche recevrait maintenant, par exemple *4j*. Elle suit en direct. Vous voyez donc la nouvelle durée avant de relâcher. Sur le bord droit, la pastille est à l'intérieur de la barre. Sur le bord gauche, elle est juste à gauche de la barre. La pastille affiche la durée comme la colonne de durée l'affiche.
3. Relâchez. La durée est celle que la pastille affichait.

Le bord gauche déplace le début et laisse la fin. La tâche devient plus courte ou plus longue à l'avant. La même règle SNET s'applique comme lors du déplacement. Quand vous glissez le milieu de la barre, la pastille n'apparaît pas : la durée ne change pas.

La durée compte les jours ouvrés du calendrier de la tâche. Les week-ends et les jours de congé ne comptent pas. Une tâche en jours ne peut pas être plus courte qu'un jour ouvré. Pour une tâche en heures, l'application arrondit au pas de l'échelle de temps sous votre souris : au moins une heure, ou un quart d'heure si vous zoomez assez et que *Afficher les quarts d'heure au zoom maximal* est activé.

Un glissement correspond à une étape dans *Annuler*, quelle que soit sa longueur. Sur une barre fractionnée, les bords fonctionnent autrement. Voir [Fractionner une tâche](docs://howto-taak-splitsen).

### Décaler la ligne de temps

Ce que fait un glissement sur le fond vide dépend de votre mode de défilement. Vous le choisissez dans *Paramètres de l'app*, onglet *Apparence*, sous *Gantt › Défilement & zoom*, à *Mode* :

- **Zoom + glisser** (par défaut) : si vous glissez sur le fond vide avec le bouton gauche de la souris, la ligne de temps suit la souris, comme une carte. Le curseur est une main. Sur une barre, un glissement démarre simplement un geste sur la barre.
- **Position** et **Touches** : le même glissement crée un cadre de sélection. Vous décalez la ligne de temps avec la molette (voir [Paramètres de l'app](docs://ref-instellingen)) ou avec le bouton central de la souris.

**Le bouton central de la souris** (la molette enfoncée) décale la ligne de temps dans tous les modes. Il le fait aussi si vous commencez sur une barre. Il ne fonctionne pas pendant un autre geste, comme le glissement d'une barre.

### Sélectionner des tâches avec un cadre

Un cadre sélectionne toutes les tâches des lignes qu'il touche. Seule la hauteur du cadre compte, pas l'axe du temps.

1. Commencez sur le fond vide. Avec *Zoom + glisser*, maintenez Ctrl (⌘ sur Mac) pendant que vous le faites. Avec *Position* et *Touches*, ce n'est pas nécessaire.
2. Glissez sur les lignes que vous voulez sélectionner. La sélection reçoit un cadre.
3. Relâchez. Si vous appuyez sur Échap pendant le glissement, vous annulez le cadre, et la sélection reste telle qu'elle était.

Plus d'informations sur la sélection : [Sélectionner, supprimer et annuler des tâches](docs://howto-taken-selecteren-verwijderen). Sur l'espace vide du tableau des tâches lui-même, le glissement ne fait rien.

### Zoomer et dézoomer

1. Utilisez *Zoom +* et *Zoom -* (*Début › Zoom*), ou les touches + et -. La molette zoome aussi. Quand cela se produit dépend de votre mode de défilement (voir [Paramètres de l'app](docs://ref-instellingen)).
2. Si vous voulez voir tout le projet, choisissez *Affichage › Échelle de temps › Ajuster au projet*, ou appuyez sur Ctrl+0. *Réinitialiser* (dans l'onglet *Affichage*) ou la touche 0 remet le zoom à sa valeur par défaut.
3. En bas à droite de la barre d'état se trouve le zoom, en pixels par jour, par exemple *Zoom : 15px/jour*.

Plus vous dézoomez, moins il y a de lignes de grille. À partir de 8 pixels par jour ou plus, il y a une ligne par jour, avec une ligne plus épaisse à la limite de semaine. Entre 2 et 8 pixels par jour, seule la limite de semaine reste. En dessous de 2 pixels par jour, au niveau de l'année, seules les limites de mois restent. Sinon, le canevas deviendrait une bande rayée uniforme dans laquelle les barres disparaissent. Les week-ends et les jours de congé en gris, ainsi que les bandes de semaine teintées en alternance, restent à chaque niveau. Ils montrent la structure des semaines quand les lignes disparaissent. Dans l'en-tête de l'échelle de temps, les numéros de semaine et les numéros de jour n'apparaissent que s'il y a assez de place. À partir de 40 pixels par jour, le jour de la semaine s'affiche aussi, avant le numéro du jour.

Le nom de la tâche s'affiche dans la barre s'il y tient entièrement. S'il n'y tient pas, par exemple quand vous dézoomez, le nom complet s'affiche à droite de la barre.

### Voir les détails d'une tâche

Maintenez la souris immobile sur une barre. Une petite carte apparaît avec le nom de la tâche, *WBS*, *Durée*, *Début*, *Fin*, *Statut*, *Critique* et *Marge totale*. Pendant un glissement, un défilement de la ligne de temps, un cadre de sélection ou un menu contextuel, la carte disparaît.

## Pièges et ce que fait alors l'application

**Le début ne bouge pas.** Si la tâche a un prédécesseur et une contrainte autre que SNET, par exemple *Le plus tard possible (ALAP)*, l'application n'applique pas le début glissé. Après que vous avez relâché, l'application indique quelle contrainte retient le début. Modifiez cette contrainte pour déplacer le début. Le bord droit fonctionne, parce qu'il ne change que la durée.

**Le geste fait autre chose.** En mode relation et en mode fractionnement, les gestes sur les barres font autre chose. *Échap* arrête ces modes. Si vous maintenez Maj pendant un glissement depuis une barre, vous créez une relation au lieu de déplacer une barre. Voir [Ajouter des relations](docs://howto-relaties-leggen).

**En mode Position ou Touches, le bouton gauche de la souris ne déplace pas la vue.** Vous voyez alors un curseur normal au lieu d'une main. Utilisez la molette ou le bouton central, ou réglez le mode sur *Zoom + glisser*.

**Un clic dans une pause d'une barre fractionnée** sélectionne la tâche et ne démarre ni glissement ni cadre.

## Voir aussi

- [Menus contextuels](docs://ref-contextmenus) : les menus d'une barre, d'une ligne et d'un en-tête de groupe.
- [Raccourcis clavier](docs://ref-sneltoetsen) : les touches pour zoomer et pour annuler un geste.
- [Paramètres de l'app](docs://ref-instellingen) : le mode de défilement et l'axe du temps.
- [Contraintes et échéances](docs://uitleg-constraints) : pourquoi un début déplacé devient une contrainte.

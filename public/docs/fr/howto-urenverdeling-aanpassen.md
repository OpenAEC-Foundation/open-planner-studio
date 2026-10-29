# Adapter la répartition des heures

Objectif : pour une affectation, décidez vous-même combien la ressource travaille sur chaque jour ouvré de la tâche, au lieu d'utiliser une courbe standard.

## Quand vous en avez besoin

Une courbe comme *En cloche* a une forme fixe. Parfois, vous en savez plus. Le bricklayer commence à mi-régime sur l'outer cavity leaf, parce que les échafaudages sont encore en cours de montage, puis travaille à plein temps. Ou vous voulez garder un pic juste sous la capacité. Vous ajustez alors la **répartition des heures**.

Vous travaillez avec des **phases** : des jours ouvrés consécutifs pendant lesquels la ressource travaille avec les mêmes unités. La répartition change seulement les heures par jour de cette seule affectation. Les dates de la tâche ne changent pas.

## Étapes

L'exemple est l'outer cavity leaf : 6 jours ouvrés, un bricklayer, 48 heures.

1. Sélectionnez la tâche. Le panneau *Propriétés* se trouve à droite ; si vous ne le voyez pas, activez-le avec *Affichage › Panneaux › Propriétés*.
2. Dans le bloc *Affectations*, cliquez sur le nom du bricklayer. *Courbe* et le bouton *Répartition des heures…* apparaissent sous celui-ci. Cliquez sur *Répartition des heures…*. La fenêtre *Répartition des heures par phases* s'ouvre. Vous partez de ce que l'application réserve actuellement : pour cet outer cavity leaf, une phase de 6 jours avec des unités de 1.
3. Si besoin, choisissez un point de départ à *Appliquer une forme :*. Avec *En cloche*, l'application crée cinq phases : 0,18 unité le premier et le dernier jour, 0,84 le deuxième et le cinquième jour, et 1,98 les deux jours du milieu. Le total reste de 48 heures.

### Ajuster les phases

Vous pouvez travailler dans le tableau ou dans la bande située au-dessus.

- Saisissez un autre *Effort (unités/jour)* dans une phase. Les colonnes *Heures/jour* et *Heures* se calculent en même temps.
- Modifiez le nombre de *Jours* d'une phase. La dernière phase va toujours jusqu'à la fin de la tâche et reçoit les jours qui restent.
- Choisissez *Scinder* pour diviser une phase en deux, par exemple 6 jours en 3 et 3. Choisissez *Fusionner* pour fusionner une phase avec la suivante.
- Dans la bande, vous faites glisser une limite pour allonger ou raccourcir une phase. Vous faites glisser le bord supérieur pour régler l'effort. Vous double-cliquez sur un jour pour scinder une phase.

### Appliquer

Choisissez *Appliquer*. Avec *Annuler*, la fenêtre se ferme sans modification.

Un exemple. Vous choisissez *Scinder*, vous réglez les *Jours* de la première phase à 2 et l'effort de cette phase à 0,5. La deuxième phase dure alors 4 jours avec un effort de 1. Le total est 2 × 0,5 × 8 + 4 × 1 × 8 = 40 heures.

Après *Appliquer*, la courbe de l'affectation est réglée sur *Contour*, et ce champ est désactivé. *Unités* reste inchangé. Une icône en forme de graphique à barres apparaît maintenant à côté du nom, aussi lorsque l'affectation est repliée. L'histogramme et la surallocation suivent immédiatement la nouvelle répartition. Recalculer n'est pas nécessaire, car aucune date ne change.

### Libérer la répartition

Si l'affectation a sa propre répartition, la fenêtre contient aussi *Libérer la répartition*. Cette action supprime votre répartition propre, et l'application revient à *Unités* et à la courbe. Choisissez-la aussi si vous voulez changer la courbe, car la liste déroulante *Courbe* reste désactivée tant qu'il existe une répartition propre.

## Pièges et ce que fait alors l'application

**Le total change avec elle.** Vous ne divisez pas les heures, vous les fixez. Si vous réglez une phase à 0,5 au lieu de 0,18, le total augmente. Le total en heures se trouve en bas de la fenêtre. Vérifiez-le avant de cliquer sur *Appliquer*.

**Ce que font ensuite les unités dépend du type de tâche.** Avec *Durée et unités fixes*, d'autres *Unités* ne changent rien à la répartition. Avec *Durée et travail fixes*, l'application adapte les heures par jour aux nouvelles unités : avec des unités de 2 au lieu de 1, chaque jour double, et le total aussi (de 32 à 64 heures), et la durée reste la même. Avec *Travail fixe*, les unités modifient la durée de la tâche : la répartition est alors compressée ou étirée sur la nouvelle durée, avec le même total. Avec *Unités fixes*, les unités modifient aussi la durée ; vérifiez ensuite le total en bas de la fenêtre.

**Si vous modifiez la durée de la tâche, la répartition s'étire avec elle.** La forme reste la même. Avec *Durée et unités fixes* et avec *Unités fixes*, le total augmente proportionnellement à la durée : si la durée d'une tâche avec sa propre répartition double, de 4 à 8 jours ouvrés, le total double aussi, de 32 à 64 heures. Avec *Durée et travail fixes* et avec *Travail fixe*, le total reste le même (32 heures restent 32 heures) et les unités baissent.

**Le travail suit la répartition.** *Travail (h)* devient la somme de vos phases, aussi avec *Travail fixe*. La durée de la tâche ne change pas pour autant.

**Unités non valides.** Un effort vide ou négatif reçoit une bordure rouge, et *Appliquer* est alors désactivé. Une phase avec un effort de 0 est autorisée. Cette phase reste dans la durée de la tâche.

**Tout s'applique à cette seule affectation.** L'application le dit elle-même : *La répartition ne modifie que les heures par jour de cette affectation ; les dates et les scissions de la tâche restent telles quelles.* Les autres ressources de la même tâche gardent leur propre répartition.

**Le nivellement suit la répartition.** Le nivellement compte les mêmes heures par jour que l'histogramme.

**Annulation.** *Appliquer* et *Libérer la répartition* peuvent chacun être annulés en une seule étape avec *Annuler* (Ctrl+Z).

## Voir aussi

- [Affecter des ressources avec une courbe](docs://howto-resource-toewijzen): placer une ressource sur une tâche et choisir une courbe.
- [Résoudre la surallocation](docs://howto-overbezetting-oplossen): que faire quand une ressource a trop à faire un jour.

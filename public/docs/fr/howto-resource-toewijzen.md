# Affecter des ressources avec une courbe

Objectif : affecter une ressource à une tâche, avec des unités par jour et une courbe qui décide de la répartition de ces unités sur les jours de la tâche.

## Quand vous en avez besoin

Dès que vous voulez voir qui travaille où et quand : le maçon sur le parement extérieur de la lame d'air, la grue sur les dalles alvéolées. Sans affectation, il n'y a pas de charge, donc pas d'histogramme ni de surallocation.

Deux termes. Les **unités** (dans le panneau, la colonne *Unités*, dans la fenêtre *Affecter*, le champ *Unités/j*) indiquent la part de la ressource qui travaille sur la tâche par jour ouvré : 1 correspond à un maçon, 2 à deux maçons, 0,5 à une demi-journée. La **courbe** décide de la façon dont le total, unités fois durée, est réparti sur les jours ouvrés de la tâche. Le travail est rarement réparti également : sur un mur, le début est calme, le milieu chargé et la fin à nouveau calme.

Le parement extérieur de la lame d'air prend 6 jours ouvrés. Avec un maçon et la courbe *Uniforme*, cela fait 1 unité sur chacun des 6 jours, soit 6 au total. Avec la courbe *En cloche*, il reste 6 unités au total, mais la répartition devient 0, 1, 2, 2, 1 et 0.

## Étapes

Vous pouvez affecter une ressource de deux façons. La ressource doit déjà exister (voir [Gérer les ressources](docs://howto-resources-beheren)).

### Par le ruban

1. Sélectionnez une tâche dans le tableau des tâches. Elle doit être une tâche ordinaire, pas un jalon et pas une phase.
2. Choisissez *Ressources › Affectation › Affecter ▾*.
3. Dans la fenêtre, renseignez *Unités/j* (par défaut 1) et choisissez la *Courbe* (par défaut *Uniforme*). Elles s'appliquent à la ressource que vous choisissez maintenant.
4. Cliquez sur la ressource. La fenêtre se ferme et l'affectation apparaît.

Pour une deuxième ressource, ouvrez de nouveau la fenêtre. Les ressources déjà présentes sur la tâche ne figurent plus dans la liste.

### Par le panneau des propriétés

1. Sélectionnez la tâche. Le panneau *Propriétés* se trouve à droite ; si vous ne le voyez pas, activez-le avec *Affichage › Panneaux › Propriétés*.
2. Dans le bloc *Affectations*, tout en bas, choisissez la ressource sous *Affecter une ressource*. L'affectation démarre avec 1 unité et la courbe *Uniforme*.
3. Pour chaque affectation, modifiez *Unités*. Cliquez sur le nom de la ressource pour afficher *Courbe*, puis choisissez une autre courbe.

C'est aussi ainsi que vous modifiez une affectation existante. Avec la corbeille (*Supprimer*) au bout de la ligne, vous retirez l'affectation de la tâche. La ressource elle-même reste. Avec *Déplacer vers…* (affiché après un clic sur le nom), vous déplacez l'affectation vers une autre tâche.

### Les courbes

- *Uniforme* : la même chaque jour. C'est la valeur par défaut. Elle convient à un travail aussi lourd chaque jour.
- *Chargé en début* : le début est plus lourd que la fin. Convient à un travail qui commence par un gros effort, comme l'implantation.
- *Chargé en fin* : la fin est plus lourde que le début. Convient à un travail qui s'intensifie vers la fin.
- *En cloche* : un pic au milieu, avec un début et une fin calmes. Convient à un mur qui commence calmement, bat son plein au milieu et s'estompe.
- *Pic précoce* : un pic avant le milieu. Convient à un travail qui monte vite en régime.
- *Pic tardif* : un pic après le milieu. Convient à un travail dont l'activité intense n'arrive que tard.
- *Double pic* : deux pics. Convient à un travail avec deux moments chargés.
- *Tortue* : un début et une fin calmes, avec un large pic au milieu. Convient à un long travail qui monte et redescend progressivement.

La courbe modifie seulement la répartition. La durée, les dates et le total restent les mêmes. Vous n'avez pas besoin de recalculer ensuite. L'histogramme s'adapte tout de suite. Choisissez *Ressources › Histogramme › Histogramme* pour le voir. Si vous sélectionnez une tâche, l'histogramme n'affiche que la charge de cette tâche.

## Pièges et ce que fait l'application alors

**Une courbe peut faire monter le pic au-dessus de vos unités.** Avec un nombre entier comme unités, l'application arrondit la valeur par jour à des unités entières, et le total reste le même. Un maçon avec 1 unité sur le parement extérieur de la lame d'air et la courbe *En cloche* donne 0, 1, 2, 2, 1, 0. Sur les deux jours du milieu, cela fait 2 unités contre *Unités max* de 1. L'histogramme colore ces jours en rouge et la ressource est en surallocation. Choisissez une autre courbe, ou répartissez les heures vous-même (voir [Adapter la répartition des heures](docs://howto-urenverdeling-aanpassen)). Avec des unités comme 0,5, l'application arrondit aux centièmes. Sur une tâche courte avec des unités entières, la forme devient donc grossière : sur 10 jours, *Tortue* avec 1 unité donne la répartition 0, 1, 1, 2, 2, 1, 1, 1, 1, 0, exactement comme *Pic précoce*.

**Pas de jalon ni de phase.** Le bouton *Affecter* est alors désactivé, et *Propriétés* affiche *Les affectations ne sont pas possibles sur les jalons* ou *Les affectations ne sont pas possibles sur les tâches récapitulatives*.

**Une ressource seulement une fois par tâche.** Si la ressource est déjà sur la tâche, elle ne figure plus dans la liste. Si toutes les ressources sont déjà sur la tâche, l'application affiche *Toutes les ressources sont déjà affectées.* S'il n'y a pas encore de ressource, elle affiche *Créez d'abord des ressources (onglet Ressources).*

**Les unités doivent être supérieures à 0.** L'application n'accepte pas une valeur de 0 ou moins.

**Matériel.** Pour une ressource matérielle, les unités sont la quantité par jour, dans l'unité de la ressource, par exemple m³. Le matériel ne compte pas dans la durée de la tâche.

**Un type de tâche peut ajuster la durée.** Si la tâche est de type *Travail fixe* ou *Unités fixes*, une deuxième ressource modifie la durée de la tâche. Le planning n'est alors plus à jour ; appuyez sur **Calculer** (F5). Voir [Types de tâche : durée, unités et travail](docs://uitleg-werkregels).

**Une répartition qui lui est propre.** Si l'affectation a déjà sa propre répartition des heures, la courbe est désactivée et affiche *Contour*. Libérez d'abord cette répartition via *Répartition des heures…*.

**Annulation.** Vous pouvez annuler la création, la modification ou la suppression d'une affectation avec *Annuler* (Ctrl+Z).

## Voir aussi

- [Adapter la répartition des heures](docs://howto-urenverdeling-aanpassen) : régler vous-même les heures par jour.
- [Résoudre la surallocation](docs://howto-overbezetting-oplossen) : quoi faire quand une ressource a trop de travail un même jour.
- [Types de tâche : durée, unités et travail](docs://uitleg-werkregels) : ce qui se passe pour la durée quand vous modifiez les unités.
- [Panneau des ressources](docs://ref-resourcepaneel) : tous les champs et boutons du panneau des ressources.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc) : les cinq types de ressources, six des huit courbes et une grue à tour avec un palier de capacité à partir du 30 août 2027.

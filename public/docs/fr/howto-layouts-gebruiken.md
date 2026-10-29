# Créer et utiliser une disposition

Objectif : passer d'une vue de votre planning à l'autre d'un clic, par exemple uniquement les tâches critiques, les tâches par équipe ou un autre ordre de tri.

## Quand vous en avez besoin

Lors de la réunion de chantier, le client veut voir seulement les tâches critiques. Ensuite, le conducteur de travaux veut voir par équipe qui est nécessaire et quand. Puis vous voulez de nouveau le planning complet. Régler sans cesse les filtres, les groupements et les ordres de tri est fastidieux. Une **disposition** mémorise une telle vue sous forme de bouton dans le ruban.

Une **disposition** peut mémoriser six choses : le filtre, le groupement, le tri, les colonnes du tableau des tâches à côté du Gantt, l'échelle de temps, et les lignes de liaison et superpositions (référence, ligne d'avancement, ligne de la date d'état, accent des ressources, bande de marge et couleurs des barres). Seules les parties que vous cochez changent quand vous cliquez sur le bouton. Le reste de votre vue reste tel quel.

Vous filtrez, groupez et triez avec une disposition. Les boutons séparés *Filtre…*, *Grouper…* et *Trier…* existent maintenant seulement derrière un paramètre masqué (voir les pièges).

## Étapes

### Utiliser une disposition existante

1. Choisissez l'onglet *Affichage*. Dans le groupe *Disposition*, il y a un bouton par disposition. Par défaut, c'est *Diagramme des ressources*.
2. Cliquez dessus. *Diagramme des ressources* groupe les tâches par ressource, trie chaque groupe selon le début et désactive les lignes de liaison. Une tâche avec deux ressources apparaît sous les deux.
3. Cliquez encore une fois pour désactiver la disposition. La vue revient à ce qu'elle était avant votre clic.

Chaque clic correspond à une étape pour *Annuler* (Ctrl+Z), que ce soit pour activer ou désactiver.

### Créer votre propre disposition

1. Dans le groupe *Disposition*, cliquez sur *Nouvelle disposition*. La fenêtre *Nouvelle disposition* s'ouvre.
2. Saisissez un *Nom* et choisissez une *Icône*.
3. Sous *Que mémorise cette disposition ?* se trouvent les six parties, chacune avec une case à cocher. Une nouvelle fenêtre commence avec toutes les parties cochées et remplies avec ce qui est affiché à l'écran. Décochez tout ce que la disposition ne doit pas modifier. Si vous voulez seulement un filtre, laissez seul *Filtre* coché. *Reprendre la vue actuelle* remplit de nouveau toutes les parties avec votre écran.
4. Réglez les parties.
5. Cliquez sur *Enregistrer*.

La disposition est maintenant un bouton dans le ruban, mais elle n'est pas encore appliquée. Cliquez sur le bouton pour l'activer.

### Régler le filtre

Sous *Filtre*, vous créez des règles. Cliquez sur *+ règle*, choisissez un *Champ*, un *Opérateur* et une valeur. Si vous voulez seulement les tâches critiques : champ *Critique*, opérateur *égal à*, valeur *Oui*. Les champs comprennent *Nom de la tâche*, *Début*, *Fin*, *Marge totale*, *Avancement* et *Jalon*, ainsi que vos propres codes d'activité et champs, et *Ressources*. Les opérateurs dépendent du type de champ : pour du texte, vous pouvez choisir *contient*, pour des nombres et des dates *entre*.

Les opérateurs proposés dépendent du type de champ :

- Texte (*Nom de la tâche*, *WBS*) : *égal à*, *différent de*, *contient*, *commence par* et *est vide*.
- Nombre et date (*Marge totale*, *Début*, *Avancement*) : *égal à*, *différent de*, *inférieur à*, *inférieur ou égal à*, *supérieur à*, *supérieur ou égal à*, *entre* et *est vide*. Avec *entre*, il y a deux champs : pour un nombre, avec *À partir de* et *À* comme indication ; pour une date, sans indication (la première date est le début, la seconde la fin).
- Oui/non (*Critique*, *Jalon*, *Quasi critique*) : *égal à* et *différent de*, avec la valeur *Oui* ou *Non*.
- Choix (*Catégorie de travaux*, un code d'activité) : *égal à*, *différent de*, *est l'un des* (avec des valeurs à cocher) et *est vide*.
- *Ressources* : *est l'un des* et *est vide*.
- *En cours* : seulement *entre*, avec deux dates (début et fin).

Avec le champ *En cours*, l'opérateur *entre* et deux dates, vous obtenez toutes les tâches qui sont actives à un moment de cette période, par exemple tout ce qui est actif en juin.

Vous combinez plusieurs règles avec la liste en haut : *Toutes les conditions suivantes (AND)* affiche les tâches qui respectent toutes les règles, *Une des conditions suivantes (OR)* les tâches qui respectent au moins une règle. Avec *+ groupe*, vous ajoutez un sous-groupe avec ses propres règles.

Le filtre examine les tâches elles-mêmes. Les phases (tâches récapitulatives) dont fait partie cette tâche restent visibles en gris, pour que vous voyiez où se situe la tâche. Si vous groupez aussi, ces phases grises disparaissent.

### Grouper et trier

Sous *Grouper*, vous ajoutez un champ avec *+ niveau*. Il y a au maximum deux niveaux de groupement. Sans groupement, vous voyez l'arborescence WBS. Sous *Trier*, vous ajoutez un champ avec *+ niveau* et choisissez *Croissant* ou *Décroissant*. Avec deux niveaux, le second décide quand les valeurs du premier sont égales.

### Essayer rapidement sans bouton

Dans la fenêtre, cliquez sur *Appliquer sans enregistrer*. Les parties cochées sont appliquées à l'écran, mais aucun bouton n'est ajouté. C'est pratique pour un filtre dont vous n'avez besoin qu'une fois. Ctrl+Z l'annule.

### Modifier, copier ou supprimer une disposition

Faites un clic droit sur le bouton de la disposition. Vous choisissez *Modifier…*, *Dupliquer* ou *Supprimer*. *Supprimer* demande d'abord une confirmation. Une copie s'appelle *nom (copie)*. Une disposition intégrée, comme *Diagramme des ressources*, ne peut pas être modifiée ni supprimée ; vous la dupliquez pour créer votre propre version.

### Plusieurs dispositions à la fois

Des dispositions qui ne mémorisent pas les mêmes parties peuvent être actives en même temps. Si vous avez une disposition qui mémorise seulement le filtre *Critique égal à Oui* (appelez-la par exemple *Uniquement critiques*) et que vous l'activez avec *Diagramme des ressources* (groupement, tri, lignes de liaison), vous obtenez les tâches critiques par ressource. Si deux dispositions mémorisent la même partie, par exemple toutes deux un filtre, la seconde prend le relais et la première se désactive. Si vous désactivez ensuite cette seconde disposition, vous revenez à la vue d'avant votre premier clic, et non à la première disposition.

## Pièges et ce que fait l'application

**Vous oubliez de décocher des parties.** Une disposition qui mémorise aussi les colonnes, l'échelle de temps et les superpositions remet celles-ci dans l'état enregistré à chaque clic. Votre zoom saute alors ailleurs, alors que vous vouliez seulement un filtre. Vérifiez dans la fenêtre que seules les parties prévues sont cochées.

**Une règle incomplète n'affiche rien.** Si vous ne choisissez aucune valeur pour un champ oui/non (il affiche encore *—*) ou si vous laissez vides les dates de *En cours*, aucune tâche ne correspond et la liste reste vide. Complétez la règle.

**Une modification manuelle désactive la disposition.** Si vous modifiez vous-même une partie que la disposition mémorise, par exemple *Lignes de liaison* pendant que *Diagramme des ressources* est actif, cette disposition se désactive et les autres parties reviennent à la vue d'avant la disposition. Un zoom désactive une disposition qui mémorise l'échelle de temps, et élargir une colonne désactive une disposition qui mémorise les colonnes. Le reste de la vue reste alors tel quel. Le *Diagramme des ressources* ne mémorise pas l'échelle de temps ; le zoom ne l'affecte donc pas.

**Les colonnes s'appliquent au tableau des tâches à côté du Gantt.** La partie *Colonnes* mémorise les colonnes du tableau à gauche de la ligne de temps. Le tableau de l'onglet *Tableau* garde ses propres colonnes. Comment choisir les colonnes est expliqué dans [Adapter les colonnes du tableau](docs://howto-tabelkolommen-aanpassen).

**Mettre en retrait et réduire le retrait sont désactivés.** Tant qu'un filtre, un groupement ou un tri est actif, l'ordre affiché n'est pas l'ordre du planning. *Mettre en retrait* et *Réduire le retrait* sont alors désactivés, avec l'info-bulle *Non disponible pendant le filtrage/regroupement/tri*. Désactivez la disposition pour modifier de nouveau la structure, comme décrit dans [Adapter la structure](docs://howto-structuur-aanpassen).

**La barre d'état ne suit pas.** *Tâches :* dans la barre d'état indique le nombre de tâches de tout le projet, même si un filtre n'en affiche qu'une partie.

**Les dispositions se trouvent sur votre appareil, pas dans le projet.** L'application garde vos dispositions et les colonnes de tous vos projets sur cet appareil. Les superpositions d'une disposition (référence, ligne d'avancement et le reste) s'appliquent à tous vos projets. Le filtre, le groupement et le tri actifs appartiennent au projet ouvert, mais ne sont pas enregistrés dans le fichier du projet : après l'enregistrement et la réouverture, la vue est de nouveau propre. Ils ne rendent pas non plus le projet « modifié ».

**Les boutons séparés sont masqués.** *Colonnes…*, *Filtre…*, *Grouper…* et *Trier…* en tant que boutons séparés de l'onglet *Affichage* correspondent à l'ancienne méthode. Vous les réaffichez avec *Afficher les boutons d’affichage classiques* sous *Fonctions héritées*, dans l'onglet *Avancé* de la fenêtre *Paramètres de l'application* (⚙ dans la barre de titre). Préférez les dispositions.

## Voir aussi

- [Adapter les colonnes du tableau](docs://howto-tabelkolommen-aanpassen) : choisir, déplacer et épingler les colonnes elles-mêmes.
- [Créer et imprimer un rapport](docs://howto-rapport-maken-en-afdrukken) : mettre la vue sur papier avec *Suivre la vue*.
- [Adapter la structure](docs://howto-structuur-aanpassen) : pourquoi vous ne pouvez pas mettre en retrait pendant un filtrage.

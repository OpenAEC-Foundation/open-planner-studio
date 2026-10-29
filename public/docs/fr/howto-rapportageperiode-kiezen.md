# Choisir la période de rapport

Objectif : déterminer quelle période un rapport couvre, par exemple les quatre prochaines semaines ou le mois de juin.

## Quand vous en avez besoin

La réunion hebdomadaire veut savoir ce qui se passe dans les quatre semaines à venir. Le rapport mensuel couvre juin. Sans période, vous obtenez tout le planning sur papier. Cinq rapports utilisent donc le champ *Période de rapport* : *Prévision (look-ahead)*, *Rapport d'avancement*, *Charge des ressources*, *Affectations des ressources* et *Diagramme des ressources*. Les autres rapports n'ont pas de période.

La période n'est pas liée à un mois calendaire, mais à un **jour de référence** : la date d'état de votre projet (le jour où vous mesurez l'avancement, voir [Avancement, date d'état et référence](docs://uitleg-voortgang)), ou aujourd'hui si le projet n'a pas de date d'état. *4 prochaines semaines* part de ce jour. Si vous changez la date d'état, la fenêtre se déplace avec elle.

## Étapes

### 1. Définir la date d'état

Si vous utilisez un choix relatif, comme *4 prochaines semaines* ou *Mois dernier*, définissez d'abord la date d'état. Choisissez *Planification › Références et avancement* et remplissez le champ *Date d'état*. Avec la croix à côté (*Effacer la date d'état*), vous supprimez de nouveau la date. Si vous utilisez une période fixe (étape 4), vous n'en avez pas besoin.

### 2. Choisir un rapport avec une période

Ouvrez l'onglet *Rapport* et choisissez un des cinq rapports dans *Type de rapport*. La liste *Période de rapport* se trouve sous *Options du rapport*. Pour le diagramme des ressources, elle se trouve sous *Paramètres*, sous les quatre cases à cocher de ce rapport.

Chaque rapport garde sa propre période. Ce sont les valeurs initiales :

- *Prévision (look-ahead)* : *Mois prochain*.
- *Rapport d'avancement* : *Mois dernier*.
- *Charge des ressources*, *Affectations des ressources* et *Diagramme des ressources* : *Tout le projet*.

### 3. Choisir une période dans la liste

La liste contient *Semaine prochaine*, *2 prochaines semaines*, *4 prochaines semaines*, *6 prochaines semaines*, *8 prochaines semaines*, *12 prochaines semaines*, *Mois prochain*, les mêmes sept pour la période passée, *Tout le projet* et *Personnalisé*. Sous la liste se trouvent *À partir de* et *Au*, avec les dates que le choix produit. Ici, vous pouvez seulement les lire.

Les deux jours extrêmes sont inclus. Si la date d'état est le jeudi 20 mai, *Semaine prochaine* va du 20 au 26 mai inclus et *4 prochaines semaines* du 20 mai au 16 juin inclus (28 jours). *Mois prochain* va jusqu'à la veille de la même date le mois suivant, ici jusqu'au 19 juin inclus. *2 dernières semaines* va du 7 au 20 mai inclus.

*Tout le projet* prend le planning du premier début jusqu'à la dernière fin.

### 4. Ou choisir Personnalisé

Avec *Personnalisé*, *À partir de* et *Au* deviennent deux champs de date. Ils commencent avec les dates du choix que vous veniez de faire. Remplissez les deux, par exemple le 1er et le 14 juin. Si la saisie n'est pas correcte, le rapport reste sur la dernière période valide et affiche en rouge :

- *La date de fin est antérieure à la date de début.* si *Au* est antérieur à *À partir de*.
- *Renseignez les deux dates.* si l'une des deux est vide.

### 5. Lire la période dans le rapport

Pour la prévision (look-ahead), la charge des ressources et les affectations des ressources, la période se trouve sous le titre, par exemple *Période : 20-05-2027 – 19-06-2027*. Si vous choisissez *Tout le projet*, *Tout le projet* s'ajoute après les dates. Le rapport d'avancement affiche la période dans le résumé, à *Période*. Le diagramme des ressources fait correspondre son axe du temps exactement à la période.

### Ce que fait la période dans chaque rapport

La période ne fonctionne pas de la même façon dans chaque rapport.

- **Prévision (look-ahead)** prend les tâches non terminées qui touchent la période, aussi si elles couvrent toute la période. Les tâches en retard d'avant le jour de référence sont aussi incluses, tant que la fin de la période n'est pas antérieure au jour de référence. Une période personnalisée entièrement dans le passé est un regard en arrière : elle montre seulement ce qui était en cours à ce moment et qui n'est pas encore terminé, sans l'arriéré d'aujourd'hui.
- **Rapport d'avancement** utilise la période pour *Terminé pendant la période écoulée*. La section *Démarre pendant la prochaine période* regarde vers l'avant à partir de la date d'état, jusqu'à la date de *Anticipation jusqu'au* dans le résumé. Si vous choisissez une période passée, le rapport regarde vers l'avant aussi loin qu'il regarde vers l'arrière : avec *2 dernières semaines* et une date d'état du 20 mai, il affiche *Anticipation jusqu'au* 3 juin. Une période personnalisée ou *Tout le projet* entièrement dans le passé n'est pas reflétée.
- **Charge des ressources** affiche chaque semaine ou mois qui touche la période, en entier. Si votre période va du mercredi au mercredi, vous voyez donc des semaines complètes, si bien qu'une ligne affiche toujours le même nombre que l'histogramme.
- **Affectations des ressources** affiche les affectations des tâches qui touchent la période. Avec *Tout le projet*, il n'y a pas de filtre sur la date.
- **Diagramme des ressources** affiche seulement les tâches qui touchent la période. Dans le résumé, *Hors période :* compte combien de tâches ont été omises.

## Pièges et ce que fait l'application

**Il n'y a pas de date d'état.** L'application utilise alors aujourd'hui. Pour les quatre rapports de tableau avec une période (*Prévision (look-ahead)*, *Rapport d'avancement*, *Charge des ressources* et *Affectations des ressources*), elle l'indique en haut, avec une période relative : *Aucune date d'état définie — le rapport utilise aujourd'hui (29-09-2026).*, avec votre date du jour. Le diagramme des ressources ne l'affiche pas. Regardez donc *À partir de* et *Au* : elles sont alors autour d'aujourd'hui, et non autour de votre planning.

**La période se situe en dehors de votre planning.** Le rapport est alors vide. Le diagramme des ressources l'indique avec *Aucune tâche dans la période de rapport — choisissez une autre période ou Projet entier.* (dans la liste, ce choix s'appelle *Tout le projet*). Dans les autres rapports, vous voyez zéro tâche ou aucune ligne.

**Les dates sont dans votre propre notation.** *À partir de* et *Au* suivent la notation de date de vos paramètres, sauf dans les champs de date de *Personnalisé* : ceux-ci affichent la notation de votre navigateur.

**La période se déplace avec le temps.** Un choix relatif, comme *Mois prochain*, est recalculé à chaque fois : si la date d'état change, ou si vous n'avez pas de date d'état et qu'un jour s'est écoulé, la période se déplace aussitôt. Si vous voulez une période fixe, choisissez *Personnalisé*.

**Le choix vaut pour tous vos projets.** Une période personnalisée vaut aussi pour tous vos projets sur cet appareil, et pas seulement pour le projet ouvert.

## Voir aussi

- [Créer et imprimer un rapport](docs://howto-rapport-maken-en-afdrukken) : tout le parcours, du type de rapport au PDF.
- [Avancement, date d'état et référence](docs://uitleg-voortgang) : ce qu'est la date d'état et pourquoi l'application calcule avec elle.
- [Résoudre une surallocation](docs://howto-overbezetting-oplossen) : que faire des semaines en surallocation de la charge des ressources.
- [Types de rapport](docs://ref-rapporttypes) : tous les types de rapport et leurs options.

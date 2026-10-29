# Nivellement des ressources

Vous avez un maçon et deux murs à construire les mêmes jours. Sur le papier, le planning fonctionne. En pratique, il ne peut être qu'à un seul endroit. Le nivellement résout ces conflits : il décale des tâches plus tard, jusqu'à ce que la ressource puisse suivre. Dans cet article, vous lisez exactement ce que le nivellement décale, quand la date de fin cède et ce qu'il ne résout pas à votre place.

## Le concept

Une ressource est **en surallocation** un jour ouvré si le planning lui demande ce jour-là plus qu'elle ne peut fournir. Ce qu'elle peut fournir, c'est sa capacité : *Unités max* les jours ouvrés de son calendrier. Si elle ne travaille pas ce jour-là selon son calendrier, sa capacité est de 0.

**Le nivellement** résout ce problème en faisant commencer les tâches plus tard. Il ne fait rien de plus. Il ne raccourcit pas une tâche, ne la découpe pas, ne modifie pas les unités ni les relations et n'ajoute pas de ressource supplémentaire. Pour chaque tâche, l'application cherche le premier moment où les ressources sont libres, et y décale la tâche.

Il existe deux façons, dans la fenêtre *Niveler les ressources* :

- Par défaut, la date de fin du projet peut aussi être repoussée. C'est le nivellement au sens strict.
- Avec la case *Niveler uniquement dans la marge (lissage) — la date de fin de projet reste fixe*, l'application ne décale les tâches que dans leur marge. La date de fin reste alors en place. Si cela ne suffit pas, la tâche reste à sa place et l'application signale un conflit. Ce qu'est la marge, vous le lisez dans [Chemin critique et marge](docs://uitleg-kritiek-pad).

## Comment l'application calcule

### Ce qu'une tâche demande

Par jour ouvré, l'application compte combien d'unités chaque tâche demande à une ressource. Ce sont les unités selon la courbe ou votre propre répartition des heures, exactement les mêmes heures par jour que celles de l'histogramme. La capacité de la ressource est *Unités max*, ou la valeur du palier de la capacité échelonnée dans le temps qui s'applique ce jour-là. Un jour est en surallocation si la demande est supérieure à la capacité.

### Dans quel ordre

L'application place les tâches une à une, dans cet ordre : d'abord la priorité la plus haute, puis la tâche avec la marge totale la plus faible, puis la tâche qui commence le plus tôt, et ensuite l'ordre du tableau des tâches. Une tâche n'est traitée qu'une fois que ses prédécesseurs ont leur place.

La priorité est un nombre de 0 à 1000 que vous définissez par tâche. La valeur par défaut est 500. Dans le menu contextuel d'une barre de tâche, elle s'appelle *Priorité*, avec les choix *Basse* (100), *Normale* (500) et *Haute* (900). Une tâche qui passe plus tôt obtient la place qu'elle veut. Les tâches suivantes doivent s'adapter autour d'elle. Ainsi, la priorité décide quelle tâche garde sa place et laquelle cède. La valeur 1000 est spéciale : une telle tâche ne se décale jamais pour la capacité. C'est le « Do Not Level » de MS Project.

### Où une tâche se décale

Pour chaque tâche, l'application commence au début au plus tôt que les relations permettent. Elle tient compte du fait que des prédécesseurs ont pu déjà être décalés eux-mêmes. Si la tâche y trouve sa place, elle reste. Sinon, l'application essaie le jour ouvré suivant de la tâche, et ainsi de suite. Une tâche trouve sa place si, chaque jour de la tâche, chaque ressource dispose d'assez de capacité libre. Si une tâche a plusieurs ressources, toutes doivent être libres ces jours-là. Une tâche se décale donc toujours vers plus tard, jamais vers plus tôt.

L'application enregistre le décalage comme un **retard de nivellement** : un nombre de jours ouvrés, dans le calendrier de la tâche, dont la tâche commence plus tard que ne l'exigent ses relations. Vous le voyez dans la colonne *Retard de nivellement*, sous le groupe *Calculé*. Le retard est enregistré avec le fichier du projet. *Calculer* (F5) en tient compte comme attente supplémentaire avant le début. Les tâches qui suivent se décalent avec elle par leurs relations.

### Dans la marge ou au-delà

Sans *lissage*, l'application continue de chercher jusqu'à ce que la tâche trouve sa place. La date de fin du projet peut donc être décalée.

Avec *lissage*, une tâche ne peut pas commencer plus tard que son début au plus tard, c'est-à-dire le dernier jour où elle pourrait commencer sans que la date de fin se décale. Si la tâche n'y trouve pas sa place, elle reste à son emplacement au plus tôt. La tâche apparaît alors sous le groupe *Conflits restants*.

### Ce que l'application ne décale pas

- Les tâches déjà commencées ou terminées. Leur charge compte bien, mais elles ne reçoivent jamais de retard de nivellement.
- Les tâches de priorité 1000. Elles suivent leurs prédécesseurs, mais ne se décalent pas pour la capacité.
- Les tâches sans affectation aux ressources sélectionnées, les jalons et les phases. Elles se décalent seulement si un prédécesseur se décale.
- Le matériel. Il n'est jamais nivelé.

### Proposition et application

*Calculer* fait une proposition : les tâches qui se décalent, avec l'ancien et le nouveau début, et la date de fin avant et après. Rien ne change dans votre planning tant que vous ne choisissez pas *Appliquer*. Ensuite, l'application écrit les retards dans les tâches et recalcule aussitôt le planning.

## Exemple détaillé : le maçon sur deux murs

L'exemple est le projet d'exercice des tutoriels, *House extension*, tel qu'il est juste avant le nivellement du tutoriel 5. Dans le tutoriel 5, vous faites cela vous-même et vérifiez les chiffres. Dans cet exemple, le plâtrage a le type de tâche *Travail fixe* et le plâtrier travaille avec 2 unités, comme dans [Types de tâche : durée, unités et travail](docs://uitleg-werkregels).

Après la dalle alvéolaire, terminée le lundi 28 juin, la paroi intérieure de la cavité (5 jours ouvrés) et la paroi extérieure de la cavité (6 jours ouvrés) commencent toutes deux le mardi 29 juin. Toutes deux sont affectées au maçon, avec 1 unité et une valeur *Unités max* de 1. Après la paroi intérieure viennent les éléments de toiture (un travail à la grue de 6 heures) et la couverture (2 jours ouvrés). Les châssis attendent la couverture et la paroi extérieure. La livraison a lieu le lundi 30 août.

### La surallocation

La paroi intérieure court du 29 juin au 5 juillet inclus, la paroi extérieure du 29 juin au 6 juillet inclus. Du 29 juin au 5 juillet inclus, soit 5 jours ouvrés, le planning demande 2 unités à un maçon dont la capacité est de 1. Le maçon est donc en surallocation pendant ces 5 jours.

### L'ordre

Les deux tâches ont la priorité 500. Les châssis de fenêtres ne sont livrés que le 14 juillet (dans le tutoriel 3, vous avez défini une contrainte *Début au plus tôt le (SNET)* pour cela). Par conséquent, la paroi intérieure a 3 jours ouvrés de marge et la paroi extérieure 5. La paroi intérieure a la marge la plus faible et passe donc en premier. Elle reste du 29 juin au 5 juillet inclus.

### Le déplacement

La paroi extérieure ne peut pas commencer le 29 juin. Le premier jour où le maçon est de nouveau libre est le mardi 6 juillet. C'est 5 jours ouvrés après le début au plus tôt, donc le retard de nivellement est de 5. La paroi extérieure court maintenant du 6 juillet au 13 juillet inclus. Les châssis ne commencent de toute façon que le 14 juillet, donc la livraison reste le lundi 30 août. La fenêtre signale *Date de fin de projet : inchangée (30-08-2027)* et affiche une ligne : *Build outer cavity leaf*, ancien début 29-06-2027, nouveau début 06-07-2027, *5 d*.

Les 5 jours ouvrés de déplacement correspondent exactement à la marge de la paroi extérieure. C'est pourquoi *nivellement* donne ici le même résultat. La paroi extérieure n'a plus de marge et est maintenant critique.

### Et si les châssis n'arrivent pas le 14 juillet

Sans cette contrainte, les châssis peuvent commencer le vendredi 9 juillet et la livraison a lieu le mercredi 25 août. La paroi extérieure n'a alors plus que 2 jours ouvrés de marge.

- Sans *nivellement*, la paroi extérieure se décale quand même de 5 jours ouvrés. Maintenant, les châssis doivent attendre : ils commencent le 14 juillet, 3 jours ouvrés plus tard. Tout ce qui suit se décale avec eux, et la livraison passe du 25 août au 30 août, également 3 jours ouvrés plus tard.
- Avec *nivellement*, rien ne se décale. La paroi extérieure ne tient pas dans ses 2 jours ouvrés de marge. La fenêtre affiche le conflit *Build outer cavity leaf*, 5 jour(s), avec la raison *Capacité libre insuffisante dans la marge pour résoudre ce conflit.*

### Et si la paroi extérieure reçoit la priorité

Si vous donnez à la paroi extérieure la priorité *Haute* (900), elle passe en premier. Elle reste le 29 juin, et c'est maintenant la paroi intérieure qui cède : elle se décale de 6 jours ouvrés, du 7 juillet au 13 juillet inclus. La paroi intérieure n'a que 3 jours ouvrés de marge, donc décaler de 6 jours ouvrés, c'est 3 de trop. Les éléments de toiture, les châssis et tout ce qui suit se décalent avec eux. La livraison passe du lundi 30 août au jeudi 2 septembre. Une même surallocation donne donc une autre date de fin, selon la tâche qui reste à sa place.

### Et si un deuxième maçon arrive

Si vous réglez *Unités max* du maçon sur 2, il n'y a plus de surallocation. *Calculer* signale : *Aucune tâche ne doit être déplacée — la planification est déjà sans conflit.*

## Conséquences et idées fausses

**« Le nivellement trouve le planning le plus court. »** Non. L'application travaille tâche par tâche, dans un ordre fixe, et ne cherche pas la meilleure solution globale. Voyez l'exemple avec la priorité : une autre priorité donne une autre date de fin.

**« Une tâche nivelée est sûre. »** Le nivellement utilise la marge. La tâche décalée a alors moins de marge, voire plus du tout, et peut devenir critique, comme la paroi extérieure ci-dessus. Si elle prend du retard, la livraison se décale.

**« Le nivellement suit mes modifications ultérieures. »** Non. Le retard est un nombre fixe de jours ouvrés. Si la paroi intérieure devient plus courte après le nivellement, la paroi extérieure commence quand même 5 jours ouvrés plus tard, alors que ce n'est plus nécessaire. Relancez alors le nivellement. L'application repart de zéro.

**Tout ne se résout pas par un décalage.** Si la ressource ne travaille pas les jours dont la tâche a besoin, ou si la courbe de la tâche demande, un jour donné, plus que ce que la ressource peut fournir, la surallocation subsiste. L'application indique alors pourquoi, à la tâche.

**Le matériel n'est pas nivelé.** Si le matériel demande plus que sa capacité un jour, l'application le signale comme surallocation, mais le nivellement ne le modifie pas.

**Tâches figées.** Si toutes les tâches en conflit ont la priorité 1000, la fenêtre signale *Aucune tâche ne doit être déplacée — la planification est déjà sans conflit.*, alors que la surallocation subsiste. Après l'application, regardez donc le message *Surallocation* dans le ruban.

## Voir aussi

- [Résoudre la surallocation](docs://howto-overbezetting-oplossen) : les étapes pour trouver une surallocation et la niveler.
- [Chemin critique et marge](docs://uitleg-kritiek-pad) : ce qu'est la marge et pourquoi une tâche devient critique.
- [Types de tâche : durée, unités et travail](docs://uitleg-werkregels) : comment la durée d'une tâche évolue avec les unités.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc) : trois tours qui ont besoin des mêmes équipes de chantier et de la grue à tour, et ce que le nivellement fait de cela.

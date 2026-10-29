# Calendriers et jours ouvrés

Combien de jours ouvrés une tâche prend-elle, et à quelle date se termine-t-elle ? Cela dépend du calendrier dans lequel l'application compte. Dans cet article, vous lisez ce qu'est un calendrier, comment l'application compte les jours ouvrés avec lui et quel calendrier l'emporte quand plusieurs entrent en jeu. L'exemple détaillé vous aide à suivre les chiffres.

## Le concept

Un planning compte en **jours ouvrés**, et non en jours calendaires. « Cinq jours de maçonnerie » signifie cinq jours pendant lesquels le travail a lieu. Un week-end ou un jour férié ne compte pas. Une telle tâche s'étend donc sur plus de cinq jours dans l'agenda.

Les jours ouvrés sont enregistrés dans un **calendrier**. Un calendrier fixe trois éléments :

- La **semaine de travail** : les jours de la semaine pendant lesquels le travail a lieu. Par défaut, il s'agit du lundi au vendredi.
- Les **horaires de travail** : le début, la fin et la pause. Ils donnent la **journée de travail standard**. Par défaut, il s'agit de 07:00 à 16:00 avec une heure de pause, soit 8 heures.
- Les **jours fériés** : des jours isolés ou des périodes entières sans travail, comme le jour du Roi, Noël ou les **congés du bâtiment**.

Un projet a une seule bibliothèque de ressources, qui contient ses calendriers. L'un d'eux est le **calendrier du projet**. Il s'applique à chaque tâche qui n'a pas de calendrier propre. Vous attribuez un autre calendrier à une tâche donnée, par exemple une semaine de travail de six jours pour un sous-traitant qui travaille aussi le samedi. Une ressource peut aussi avoir son propre calendrier, mais cela a un autre effet (voir ci-dessous).

## Comment l'application calcule

Cet article décrit le calcul standard : le profil de calcul *Open Planner Studio*, avec lequel un nouveau projet effectue ses calculs.

### Calcul des jours ouvrés

Le premier jour ouvré d'une tâche compte comme jour 1. Une tâche de 5 jours se termine donc le cinquième jour ouvré. Si le début tombe un jour non ouvré, la tâche commence le jour ouvré suivant. Un jour férié ou des congés du bâtiment au milieu d'une tâche ne comptent pas : la tâche traverse simplement ce jour et s'allonge dans l'agenda.

Les heures par jour n'ont aucune influence sur les dates d'une tâche en jours. Seuls la semaine de travail et les jours fériés comptent. Les horaires de travail n'entrent en jeu que pour une tâche en heures ; c'est expliqué dans [Jours et heures](docs://uitleg-dagen-en-uren).

### Quel calendrier l'emporte

L'application choisit un calendrier par tâche :

1. Si la tâche a son propre calendrier, l'application calcule cette tâche entièrement dans ce calendrier : durée, date de fin et marge.
2. Sinon, le calendrier du projet s'applique. Si une tâche renvoie à un calendrier qui n'existe plus, elle revient aussi au calendrier du projet.

Une tâche récapitulative (une phase) n'a pas de travail propre, donc pas de calendrier propre. Sa durée découle des dates de ses tâches, et l'application la compte sur le calendrier du projet.

Le calendrier d'une **ressource** n'intervient pas dans les dates. Dans un planning que vous construisez vous-même dans l'application, il détermine seulement quand la ressource est disponible : dans l'histogramme, pour la surallocation et lors du nivellement.

### Tâches sur des calendriers différents

Quand deux tâches avec des calendriers différents sont liées, cela s'applique :

- Avec une relation fin-début, le successeur commence le premier jour ouvré après la fin du prédécesseur, compté dans le calendrier du **successeur**. Si une tâche se termine un vendredi, un successeur avec une semaine de travail de six jours commence le samedi.
- Un **décalage** se compte par défaut dans le calendrier du **prédécesseur**. Vous pouvez le modifier dans *Paramètres › Projet › Paramètres du projet*, dans le bloc *Profil de calcul et options*, sous *Options de calcul de ce projet*, avec le choix *Calendrier de décalage* : *Prédécesseur* (par défaut), *Successeur*, *24 heures* ou *Calendrier du projet*.
- La **marge totale** se compte en jours ouvrés du calendrier de la tâche elle-même. Dans ce profil, la **marge libre** se compte dans le calendrier du successeur.

Ce qu'est exactement un décalage est expliqué dans [Ajouter des relations](docs://howto-relaties-leggen) ; ce qu'est une marge, dans [Chemin critique et marges](docs://uitleg-kritiek-pad).

### Dans le Gantt

Le fond gris dans le Gantt montre toujours les jours non ouvrés du **calendrier du projet**. Une tâche sur un calendrier propre peut donc traverser un jour gris, par exemple une tâche de six jours qui traverse le samedi. Un bloc de jours fériés de trois jours ou plus affiche son nom, par exemple *Bouwvak (Noord)*. Ce n'est pas le cas quand *Afficher uniquement les jours ouvrables* est activé. Si vous ne voulez pas voir du tout les jours gris, activez *Afficher uniquement les jours ouvrables* sous *Paramètres › Projet › Paramètres de l'app*, onglet *Apparence*, titre *Axe temporel*.

## Exemple détaillé : le planning du bâtiment

L'exemple utilise le calendrier standard *Bouwkalender NL* : du lundi au vendredi, avec les jours fériés néerlandais. Toutes les tâches durent un nombre entier de jours. Dans le tutoriel sur les calendriers (tutoriel 3), vous construisez vous-même un tel calendrier.

### Week-end, jour férié et congés du bâtiment

*Brickwork* dure 5 jours ouvrés et commence le jeudi 13 mai 2027. Le jeudi 13 et le vendredi 14 mai sont les jours 1 et 2. Le week-end et le lundi de Pentecôte, 17 mai, ne comptent pas. Les mardi 18, mercredi 19 et jeudi 20 mai sont les jours 3, 4 et 5. La tâche se termine le **jeudi 20 mai** : huit jours calendaires pour cinq jours ouvrés.

Les congés du bâtiment rendent la différence plus grande. Supposons *Bouwvak (Noord)*, du 26 juillet au 13 août 2027 inclus, et la même tâche de 5 jours ouvrés à partir du vendredi 23 juillet. Le vendredi 23 juillet est le jour 1. Ensuite, le calendrier reste à l'arrêt pendant trois semaines. Du lundi 16 au jeudi 19 août, ce sont les jours 2 à 5. La fin est le **jeudi 19 août**, 28 jours calendaires après le début. Sans les congés du bâtiment, ce serait le jeudi 29 juillet.

### Une tâche le samedi

Trois tâches se suivent, toutes avec une relation fin-début sans décalage : *Groundwork* (4 jours), *Pour foundation* (3 jours) et *Brickwork* (5 jours). Le projet commence le lundi 24 mai 2027.

Si les trois tâches sont toutes sur le calendrier du projet, *Groundwork* va du lundi 24 au jeudi 27 mai. *Pour foundation* va du vendredi 28 mai au mardi 1er juin (vendredi, lundi, mardi). *Brickwork* va du mercredi 2 juin au mardi 8 juin. Le projet se termine le **mardi 8 juin**.

Attribuez à *Pour foundation* le calendrier *Six-day week* (du lundi au samedi) et le samedi compte. La tâche va du vendredi 28 mai au **lundi 31 mai** (vendredi, samedi, lundi). *Brickwork* reste sur le calendrier du projet, commence le mardi 1er juin et se termine le **lundi 7 juin**. Tout le projet est d'un jour plus court, car une tâche travaille le samedi.

### Un décalage entre deux calendriers

*Pour floor* (six-day week, 4 jours) commence le lundi 31 mai et se termine le jeudi 3 juin. *Pointing* (calendrier du projet, 3 jours) suit avec un décalage de 2 jours ouvrés. Sans le décalage, *Pointing* commencerait le vendredi 4 juin.

- Par défaut, le décalage se compte dans le calendrier du prédécesseur, le calendrier six-day week. À partir du vendredi 4 juin, le samedi 5 juin est le premier jour ouvré et le lundi 7 juin le deuxième. *Pointing* commence le **lundi 7 juin** et se termine le mercredi 9 juin.
- Si vous réglez *Calendrier de décalage* sur *Successeur*, le calendrier du projet compte. Le samedi ne compte alors pas : le lundi 7 juin est le premier jour ouvré et le mardi 8 juin le deuxième. *Pointing* commence le **mardi 8 juin** et se termine le jeudi 10 juin.

### La marge dans son propre calendrier

*Brickwork* (5 jours, calendrier du projet) et *Crane hire* (3 jours, six-day week) commencent tous deux le lundi 24 mai. Tous deux sont des prédécesseurs de *Fit window frames* (2 jours, calendrier du projet).

*Brickwork* se termine le vendredi 28 mai, donc *Fit window frames* commence le lundi 31 mai. *Crane hire* est déjà terminée le mercredi 26 mai. La marge totale de *Crane hire* se compte dans son propre calendrier : le jeudi 27, le vendredi 28 et le samedi 29 mai, soit **3 jours ouvrés**. Si *Crane hire* était sur le calendrier du projet, ce serait 2 jours ouvrés. La marge libre est de 2 jours ouvrés (jeudi et vendredi), car l'application la compte dans le calendrier du successeur.

### Le calendrier d'une ressource

Dans un autre projet d'exemple, la ressource *Bricklaying crew* a le calendrier *Crew Mon–Thu* (du lundi au jeudi). Elle est attribuée à raison de 1 unité par jour à *Brickwork* (5 jours, calendrier du projet, du lundi 31 mai au vendredi 4 juin).

Les dates de *Brickwork* ne changent pas. Mais le vendredi 4 juin est rouge dans l'histogramme, avec le message *Ne travaille pas ce jour selon le calendrier « Crew Mon–Thu »*, et le ruban signale une ressource sous *Surallocation*. Le nivellement ne résout pas ce problème. Le décalage n'aide pas, car cinq jours ouvrés d'affilée contiennent toujours un vendredi. Dans la fenêtre *Niveler les ressources*, la tâche figure donc sous *Conflits restants*, avec la raison *La ressource ne travaille pas tous les jours nécessaires à cette tâche — le décalage ne résout pas ce problème.*

## Conséquences et idées fausses

**« Le calendrier de la ressource décale mes tâches. »** Non. Un calendrier de ressource ne modifie aucune date ; il rend seulement la surallocation visible. Si vous voulez que la tâche elle-même s'exécute d'autres jours, attribuez-lui un calendrier propre.

**« Si je change de calendrier du projet, tout se décale. »** Seules les tâches sans calendrier propre suivent. Une tâche à laquelle vous avez vous-même attribué un calendrier de la liste le conserve, même si c'est l'ancien calendrier du projet. Si vous supprimez un calendrier, les tâches et les ressources qui l'utilisaient reviennent au calendrier du projet.

**« Les jours fériés sont bien là, non ? »** Les jours fériés n'existent que pour les années pour lesquelles ils ont été créés. Un jour en dehors de ces années est simplement un jour ouvré. Dans la boîte de dialogue du calendrier, l'application le signale par *Les jours fériés couvrent 2025–2028 ; régénérer jusqu'à 2030 inclus ?*

**« Plus d'heures par jour rendent ma tâche plus courte. »** Pas pour une tâche en jours : elle compte des jours ouvrés entiers, que la journée ait 6 ou 8 heures. Seule une tâche avec des ressources et le type de tâche *Travail fixe* ou *Unités fixes* voit sa durée changer en conséquence.

**Un calendrier sans jours ouvrés** ne peut pas être calculé par l'application. Le calcul signale *Aucun jour ouvré n'est défini dans le calendrier*.

## Voir aussi

- [Jours et heures](docs://uitleg-dagen-en-uren) : comment l'application compte les horaires de travail et ce qui se passe quand des tâches en jours et des tâches en heures se rencontrent.
- [Créer et attribuer un calendrier](docs://howto-kalender-maken-en-toewijzen) : les étapes pour créer votre propre calendrier et l'attribuer à des tâches.
- [Générer les jours fériés et les congés du bâtiment](docs://howto-feestdagen-genereren) : remplir les jours fériés d'un pays et le congé du bâtiment.
- [Configurer le calendrier d'une ressource](docs://howto-resourcekalender-instellen) : enregistrer la disponibilité d'une ressource.
- [Fenêtres de calendrier](docs://ref-kalenders) : tous les champs des fenêtres de calendrier.

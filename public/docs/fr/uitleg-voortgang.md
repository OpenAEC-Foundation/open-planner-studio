# Avancement, date d'état et référence

Un planning est une prévision. Une fois le travail lancé, vous voulez savoir ce qui est terminé, ce qui reste à faire et ce que cela signifie pour la remise. Cet article explique comment l'application traite l'avancement : ce que fait la date d'état, comment l'application calcule le travail restant, pourquoi une tâche déjà commencée attend parfois encore son prédécesseur, et comment vous comparez l'état actuel avec l'accord d'origine. Un exemple détaillé montre les chiffres.

## Le concept

**L'avancement** est ce qui s'est réellement passé. Pour chaque tâche, l'application enregistre trois éléments : un pourcentage, un **début réel** et une **fin réelle**. Ce que le planning prévoyait reste à côté ; le réel est ce qui s'est vraiment produit.

La **date d'état** est le jour où vous faites le point. Tout ce qui s'est passé avant ce jour est un fait. Tout ce qui doit encore se passer, l'application le planifie à partir du début de ce jour. Une date réelle peut tomber le jour de la date d'état, mais jamais après.

Le **travail restant** est ce qui reste à faire sur une tâche. Une tâche de 4 jours ouvrés avancée à 25 % a 3 jours ouvrés de travail restant.

Une **référence** est une copie du planning à un moment donné, en général au moment où l'accord a été approuvé. Plus tard, vous placez le planning réel à côté et vous voyez de combien l'exécution s'écarte.

## Comment l'application calcule

L'exemple ci-dessous utilise le profil de calcul *Open Planner Studio*, avec lequel un nouveau projet est calculé. Plus loin, vous pouvez lire ce qui diffère dans les profils de calcul Primavera P6 et Microsoft Project.

L'application ne recalcule pas d'elle-même. Après chaque modification de l'avancement ou de la date d'état, la barre d'état affiche *Obsolète — recalculer (F5)*. Appuyez sur **Calculer** (F5), par exemple via *Planification › Planification › Calculer*. Si *Calculer automatiquement* est activé (sous *Paramètres › Projet › Paramètres de l'app*, onglet *Planification*, titre *Calcul*), l'application le fait elle-même.

### La date d'état

La date d'état fait trois choses.

Premièrement, l'application refuse une date réelle postérieure à la date d'état. Une date égale à la date d'état est acceptée.

Deuxièmement, un travail qui n'a pas commencé ne peut pas se situer dans le passé. Si une telle tâche est planifiée avant la date d'état, l'application la déplace à la date d'état. Cela vaut aussi pour les tâches qui suivent : elles se déplacent à leur tour, selon leurs relations. Vous pouvez voir l'effet dans l'exemple ci-dessous. Dans le profil de calcul Microsoft Project, l'application ne le fait pas.

Troisièmement, le travail restant d'une tâche déjà en cours commence le jour même de la date d'état. L'application traite la date d'état comme le début de ce jour. Si vous faites le point le vendredi après les horaires de travail, vous réglez donc la date d'état sur le lundi. Si vous la réglez sur le vendredi, l'application planifie quand même le travail restant ce vendredi-là.

Si vous n'avez pas encore de date d'état et que vous saisissez un avancement, l'application règle la date d'état sur aujourd'hui et vous le signale. Vous fixez une autre date sous *Planification › Références et avancement › Date d’état*. Sans date d'état, l'application calcule une tâche en cours en avant avec sa durée restante, mais en arrière avec sa durée complète. La marge devient alors négative, et la tâche semble critique sans raison.

### Pourcentage, dates réelles et durée restante

Les champs dépendent les uns des autres. Si vous en remplissez un, l'application remplit les autres.

- Un pourcentage supérieur à 0 signifie que la tâche a commencé. Si vous ne donnez pas de début réel, l'application prend le début planifié. Si la tâche est planifiée après la date d'état, l'application vous demande d'abord quand elle a réellement commencé.
- Un pourcentage de 100 signifie terminé. Si vous ne donnez pas de fin réelle, celle-ci devient la date d'état, même si le travail a en fait été terminé plus tôt.
- Une fin réelle fait passer la tâche à 100 %. Si vous ramenez une tâche terminée sous 100 %, la fin réelle est supprimée. Si vous effacez la fin réelle, le pourcentage revient à 0 et la tâche reste *En cours* tant que vous n'effacez pas aussi le début réel.
- La **durée restante** est la durée multipliée par ce qui reste à faire, arrondie à des jours ouvrés entiers. Pour une tâche de 2 jours ouvrés, 0 % et 25 % donnent tous deux 2 jours ouvrés de travail restant, et 50 % et 75 % donnent tous deux 1. À 90 %, l'application arrondit à 0 : le travail restant est alors terminé à la date d'état. Une tâche exprimée en heures se compte en minutes entières : une tâche de 5 heures à 40 % a 3 heures de travail restant.
- Un jalon n'a qu'une seule date réelle.
- Une phase (tâche récapitulative) n'a pas d'avancement propre. Après le calcul, son pourcentage découle des tâches situées en dessous : la moyenne pondérée de leurs pourcentages, la durée en jours ouvrés servant de poids. Un jalon a un poids de 0.

Si vous modifiez la durée d'une tâche déjà en cours, le travail déjà effectué reste acquis. Le pourcentage s'ajuste : une tâche de 5 jours ouvrés à 60 % que vous réglez sur 10 jours ouvrés passe à 30 %. L'application refuse une durée plus courte que le travail déjà effectué.

### Tâches terminées et en cours

Une tâche terminée est fixée à ses dates réelles. Elle ne bouge plus, et avec une date d'état elle n'est jamais critique. Sans date d'état, une tâche terminée peut encore être critique.

Une tâche en cours conserve son début réel. Seul le travail restant se déplace. Le point de départ du travail restant dépend du mode d'avancement.

### Retained Logic et Progress Override

Que fait l'application si une tâche a déjà commencé alors que son prédécesseur est encore en cours ? Une telle relation s'appelle **hors séquence** : l'avancement contredit l'ordre. Pensez au peintre qui commence déjà dans une pièce qui a été plâtrée, alors que le plâtrier est encore occupé ailleurs.

Deux modes d'avancement déterminent la manière dont l'application calcule cela :

- **Retained Logic** (par défaut) : la relation reste en vigueur. Le travail restant du successeur suit la relation : avec fin-début, il ne commence qu'une fois le prédécesseur terminé, et jamais avant la date d'état.
- **Progress Override** : la réalité l'emporte. Le travail restant du successeur commence à la date d'état, sans attendre le prédécesseur.

Dans ce profil, la différence se trouve uniquement dans le travail restant des tâches déjà commencées alors que leur prédécesseur n'est pas encore terminé. Les autres tâches se calculent de la même façon dans les deux modes. L'application signale une telle relation dans les deux modes : dans la barre d'état sous la forme *1 relation(s) hors séquence*, et dans le panneau *Avertissements*.

### Références et écarts

Lorsque vous enregistrez, l'application note pour chaque tâche sans sous-tâches le début au plus tôt, la fin au plus tôt, la durée et le type de jalon. Les phases n'y figurent pas. Ce que vous modifiez ensuite ne touche pas la référence. Vous pouvez conserver plusieurs références ; une seule est **active**. Le Gantt, le rapport de variance et le rapport d'avancement utilisent la référence active.

L'**écart** est la différence en jours ouvrés entre la référence et le planning actuel. Un signe plus signifie plus tard, un signe moins plus tôt. L'application compte selon le calendrier du projet. Le rapport de variance donne l'écart de début et de fin par tâche. Le statut dépend uniquement de la fin : *Plus tard* pour un signe plus, *Plus tôt* pour un signe moins, sinon *Dans les délais*. Une tâche ajoutée après la référence s'appelle *Nouvelle* ; une tâche qui n'existe plus est *Supprimée*.

Deux remarques. L'écart de durée se trouve dans le tableau des tâches (colonne *Écart de durée*), et non dans le rapport de variance. Il compare la durée planifiée actuelle de la tâche à celle de la référence. L'avancement ne modifie pas cette durée planifiée : une tâche planifiée sur deux jours qui en a pris trois a donc un écart de fin de +1, mais un écart de durée de 0. Et si vous enregistrez une référence après avoir saisi l'avancement, elle enregistre l'état avec ces dates réelles ; l'écart est alors égal à zéro.

Le rapport d'avancement place l'avancement planifié à côté de l'avancement réel. Les deux sont pondérés en jours ouvrés. *Planifié* est la part de chaque tâche qui aurait dû être terminée à la date d'état selon la référence ; *Réel* est le pourcentage qui a été saisi.

### Où vous le voyez

Dans le Gantt, une ligne en pointillés marque la date d'état, avec la date dans l'en-tête. À chaque tâche en cours, la ligne se courbe vers le point de la barre que le pourcentage indique. C'est la **ligne d'avancement**. Si vous désactivez la ligne d'avancement et laissez la ligne de date d’état activée, une ligne droite subsiste ; si vous désactivez les deux, la ligne et l'étiquette disparaissent. Les boutons *Superposition de la référence*, *Ligne d’avancement* et *Ligne de date d’état* se trouvent sous *Affichage › Références et avancement* et ne modifient rien au calcul. La référence apparaît sous forme de barre fine sous chaque barre de tâche. Le tableau des tâches comporte des colonnes pour l'avancement et, par référence, pour l'écart. Sous l'onglet *Rapport*, vous trouvez les types de rapport *Variance* et *Rapport d'avancement*.

## Exemple détaillé : l'agrandissement après trois semaines

L'exemple est le projet d'entraînement *House extension* des tutoriels, dans l'état après l'ajout de toutes les relations : sans congés du bâtiment, sans ressources ni horaires. Dans le tutoriel 6, vous faites cela vous-même dans le projet d'entraînement. Ce projet contient alors davantage d'éléments, donc les chiffres y diffèrent. Ici, vous lisez pourquoi les chiffres sont ce qu'ils sont.

L'agrandissement commence le lundi 7 juin 2027. Sur le planning calculé, l'application enregistre une référence nommée *Référence* : remise le vendredi 6 août 2027, 45 jours ouvrés.

### L'état le lundi 28 juin

La date d'état est le lundi 28 juin 2027. Voici ce qui s'est passé :

- Les tâches *Start of construction*, *Set up site*, *Clear garden and paving* et *Set out the extension* sont terminées selon le planning, du 7 au 10 juin.
- *Excavate foundation trench* était planifiée sur 2 jours ouvrés (vendredi 11 et lundi 14 juin) et a pris 3 jours ouvrés : du 11 au 15 juin.
- *Foundation formwork and reinforcement* va du 16 au 18 juin. *Reinforcement inspection* a lieu le 18 juin, *Pour foundation* le lundi 21 juin.
- *Foundation brickwork* (2 jours ouvrés) a commencé le vendredi 25 juin et est à 50 %.

Après **Calculer**, l'application calcule ceci :

- Le travail restant de Foundation brickwork est 2 × (1 − 0,5) = 1 jour ouvré. Il commence à la date d'état, donc il se termine le lundi 28 juin.
- *Lay hollow-core floor* vient ensuite, le mardi 29 juin. Par conséquent, *Build inner cavity leaf* commence le mercredi 30 juin au lieu du mardi 29 juin. La remise tombe le lundi 9 août : un jour ouvré plus tard que la référence. Le jour supplémentaire de l'excavation est donc le retard de tout le projet, parce que cette tâche se trouvait sur le chemin critique.
- La barre d'état affiche *Chemin critique : 13 tâches, 46 jours ouvrés*, contre 21 tâches et 45 jours ouvrés avant l'avancement. Les huit tâches terminées qui se trouvaient sur le chemin critique ne comptent plus.
- La phase *Foundations* est à 77,8 %. Les tâches qu'elle contient pèsent 2 + 3 + 1 + 2 + 1 = 9 jours ouvrés. Le travail terminé représente 2 + 3 + 1 jours ouvrés, plus la moitié de 2 : 7 au total. Et 7 sur 9 font 77,8 %. Le jalon *Reinforcement inspection* pèse 0.

Le rapport de variance place cela à côté de la référence :

- *Excavate foundation trench* : début 0, fin +1 (fin dans la référence 14 juin, à présent 15 juin).
- *Foundation brickwork* : début +1 (le 24 juin devient le 25 juin), fin +1.
- *Build outer cavity leaf* : +1, +1. Cette tâche n'est toujours pas critique : elle avait 2 jours ouvrés de marge et la conserve.
- *Handover* : +1. La fin du projet s'écarte de 1 jour ouvré.
- Au total, 19 tâches ont le statut *Plus tard*, 4 ont le statut *Dans les délais*, et aucune n'a le statut *Plus tôt*.

Le rapport d'avancement affiche *Prévu* 28,3 % et *Réel* 23,9 %. Les tâches pèsent ensemble 46 jours ouvrés. Selon la référence, 13 jours ouvrés auraient dû être terminés : 4 jours ouvrés pour la préparation, 2 pour l'excavation, 3 pour le renforcement, 1 pour le coulage, 2 pour Foundation brickwork et 1 pour hollow-core floor. En réalité, 11 sont terminés : 4 + 2 + 3 + 1, plus la demi-journée de la maçonnerie des fondations.

### Et si vous déplacez la date d'état ?

Le même avancement, une autre date d'état. Le travail restant de Foundation brickwork commence toujours à la date d'état, donc la remise se déplace avec elle :

- Date d'état le vendredi 25 juin : le travail restant tombe le vendredi 25 juin, la remise reste le vendredi 6 août.
- Le lundi 28 juin : remise le lundi 9 août.
- Le mardi 29 juin : remise le mardi 10 août, 2 jours ouvrés plus tard que la référence.

### Et si vous modifiez le pourcentage ?

Foundation brickwork dure 2 jours ouvrés. À 0 % ou 25 %, le travail restant est de 2 jours ouvrés : il se termine le mardi 29 juin et la remise devient le mardi 10 août. À 50 % ou 75 %, il est de 1 jour ouvré : le lundi 28 juin, remise le lundi 9 août. À 90 %, le travail restant est de 0 et la tâche se termine à la date d'état.

### Et si vous réglez une date d'état sans saisir d'avancement ?

Si vous réglez seulement la date d'état sur le lundi 28 juin et ne saisissez rien, alors, selon le planning, rien ne s'est encore passé. Un travail qui n'a pas commencé ne peut pas se situer dans le passé. L'application déplace donc tout au 28 juin : *Start of construction* tombe alors ce jour-là, et la remise tombe le vendredi 27 août, 15 jours ouvrés après la référence. Saisissez d'abord l'avancement qui existe.

## Exemple détaillé : plâtrier et peintre

Voici maintenant un exemple pour le mode d'avancement. Le même agrandissement, dans un autre état : nous sommes le mercredi 21 juillet 2027. Tout jusqu'à *Install building services* inclus est terminé selon le plan. *Plastering* (4 jours ouvrés) a commencé le mardi 20 juillet et est à 25 %. *Painting* (3 jours ouvrés) suit le plâtrage, mais le peintre a déjà commencé aujourd'hui et est à 33 %.

Sans avancement, le plâtrage était planifié du mardi 20 au vendredi 23 juillet, et la peinture du lundi 26 au mercredi 28 juillet. La barre d'état affiche maintenant *1 relation(s) hors séquence* : la peinture a commencé alors que le plâtrage n'est pas terminé. Dans le panneau *Avertissements*, il est écrit : *Hors séquence : l'avancement du successeur contredit la relation*.

Le plâtrage a 4 × (1 − 0,25) = 3 jours ouvrés de travail restant : les 21, 22 et 23 juillet. La peinture a 3 × (1 − 0,33) = 2 jours ouvrés de travail restant.

- Avec **Retained Logic**, ce travail restant ne peut commencer qu'une fois le plâtrage terminé. C'est le vendredi 23 juillet, donc la peinture commence le lundi 26 juillet et se termine le mardi 27 juillet. La barre va du début réel le 21 juillet au 27 juillet. La marge totale est de 7 jours ouvrés.
- Avec **Progress Override**, le travail restant commence à la date d'état. La peinture se termine le jeudi 22 juillet, avant que le plâtrage ne soit terminé. La marge totale est de 10 jours ouvrés.

La livraison reste le vendredi 6 août dans les deux cas : la peinture avait de toute façon de la marge.

### Autres profils de calcul

Dans les profils Primavera P6 et Microsoft Project, la peinture de cet exemple se termine aux mêmes dates (27 et 22 juillet). Ils diffèrent sur les points suivants. Ce sont des conventions du profil : vous les trouvez sous *Paramètres › Projet › Paramètres du projet*, dans le bloc *Profil de calcul et options*.

- Dans le profil Microsoft Project, le travail qui n'a pas encore commencé ne se déplace pas vers la date d'état (convention *Ne pas déplacer les tâches non commencées à la date d’état*). Si dans l'exemple ci-dessus vous ne définissez qu'une date d'état et ne saisissez rien d'autre, la livraison reste dans ce profil le vendredi 6 août.
- Dans le profil Microsoft Project, le travail restant ne commence pas non plus avant le début réel plus le temps déjà écoulé (convention *Le travail restant reprend après la durée écoulée*). C'est une limite inférieure supplémentaire, à côté de la date d'état : la plus tardive des deux compte. Prenez la tâche *Build inner cavity leaf* (5 jours ouvrés), commencée le mardi 29 juin et à 40 % le mercredi 30 juin, date d'état (deux équipes de maçons travaillent en même temps, donc 40 % est déjà fait après un jour). Tout ce qui précède est terminé selon le plan. Open Planner Studio et Primavera P6 laissent la tâche se terminer le vendredi 2 juillet ; Microsoft Project le fait le lundi 5 juillet, parce que le mardi 29 juin plus 2 jours ouvrés écoulés donne le jeudi 1 juillet, après la date d'état.
- Primavera P6 affiche comme début au plus tôt d'une tâche en cours le début du travail restant, et non le début réel (dans l'exemple de Build inner cavity leaf, le mercredi 30 juin). La colonne *Début* et la barre affichent le début réel dans tous les profils.
- Dans le profil Primavera P6, sous Progress Override, la relation vers un successeur déjà commencé ne compte pas non plus pour le prédécesseur : elle ne limite plus ses dates au plus tard ni sa marge libre (convention *Progress Override ignore aussi en arrière un successeur commencé*). Dans l'exemple du plâtrier et du peintre, vous ne le voyez pas, parce que le plâtrage est de toute façon critique à cause de la chape : ses dates au plus tard et sa marge libre sont les mêmes avec Retained Logic et avec Progress Override.
- Quand vous ouvrez un fichier .xer, l'application reprend le mode d'avancement du fichier. Actual Dates, le troisième mode de P6, n'est pas connu de l'application ; un tel fichier se calcule comme Retained Logic.

## Conséquences et malentendus

**« Je décale simplement la date d'état. »** Si vous la déplacez, le travail restant des tâches en cours commence à la nouvelle date, et le travail qui n'a pas encore commencé ne peut jamais se situer avant cette date. Déplacez donc la date d'état seulement avec une mise à jour de l'avancement.

**« Saisir 100 % enregistre la fin réelle. »** Seulement si vous saisissez aussi la fin réelle. Si vous mettez une tâche à 100 % sans fin réelle, sa fin devient la date d'état. Si elle était en fait terminée plus tôt, saisissez la fin réelle.

**« 0 % veut dire non commencé. »** Si une tâche a un début réel, elle compte comme commencée, même à 0 %. Le travail restant est alors la durée complète et commence à la date d'état. Effacez le début réel pour qu'elle compte de nouveau comme non commencée.

**« Progress Override résout l'avertissement. »** Le message hors séquence reste. Le mode décide seulement de la manière dont l'application calcule. Si la relation n'est plus juste, modifiez la relation.

**« La pause dans une tâche avec fractionnement disparaît. »** Non : une pause dans la partie qui reste à faire reste dans le travail restant. Prenez une tâche de 5 jours ouvrés avec une pause de 1 jour après 2 jours de travail, commencée le mardi 29 juin et, avec la date d'état le mercredi 30 juin, à 40 %. Le travail restant, soit 3 jours ouvrés, commence à la date d'état et couvre la pause : la fin est le lundi 5 juillet. Sans la pause, c'était le vendredi 2 juillet.

**Heures et date d'état.** Vous ne pouvez pas saisir une heure dans le ruban : vous saisissez la date d'état sous forme de date. Si vous faites le point après vos horaires de travail, réglez la date d'état sur le prochain jour ouvré. Une tâche exprimée en heures calcule le travail restant à partir du début de la date d'état. Prenez *Lay hollow-core floor* dans le projet d'entraînement, après le tutoriel 4, à ce moment-là tout ce qui précède est terminé : 5 heures, le lundi 28 juin, jour ouvré à partir de 07:00. Avec la date d'état le lundi 28 juin et la tâche à 40 %, il reste 3 heures de travail restant, de 07:00 à 10:00, même si du travail a déjà été fait ce matin-là. Comment l'application compte les heures est expliqué dans [Jours et heures](docs://uitleg-dagen-en-uren).

**Mettre à jour une référence.** Ce n'est pas possible. Vous enregistrez une nouvelle référence et supprimez l'ancienne. Si vous déplacez le projet, les dates réelles et la date d'état suivent, mais les références ne suivent pas par défaut : ainsi, le déplacement reste visible comme écart. Voir [Déplacer un projet](docs://howto-project-verplaatsen).

## Voir aussi

- [Mettre à jour l'avancement](docs://howto-voortgang-bijwerken) : définir la date d'état et saisir l'avancement.
- [Importer l'avancement depuis un tableur](docs://howto-voortgang-importeren) : récupérer en une fois l'avancement transmis par le personnel de chantier.
- [Choisir le mode d'avancement](docs://howto-voortgangsmodus-kiezen) : définir Retained Logic ou Progress Override.
- [Enregistrer et gérer une référence](docs://howto-baseline-opslaan-en-beheren) : enregistrer une référence et l'utiliser.
- [Déplacer un projet](docs://howto-project-verplaatsen) : ce qui arrive aux dates réelles, à la date d'état et aux références.
- [Chemin critique et marge](docs://uitleg-kritiek-pad) : pourquoi une tâche est critique et ce que signifie la marge.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) : l'avancement et une date d'état en cours de projet (20 mai 2027).

# Relations et décalage

Pourquoi la maçonnerie ne commence-t-elle qu'une fois la fondation en place ? Et pourquoi la pose de la toiture glisse-t-elle d'une semaine quand les éléments de toiture sont livrés en retard ? Cela tient aux relations entre vos tâches. Dans cet article, vous lisez quels quatre types de relations l'application connaît, ce que font le décalage et l'avance, dans quel calendrier un décalage compte, ce qui se passe pour une relation sur une phase, et comment l'application décide quelle relation détermine la date de début d'une tâche.

Les règles et les exemples s'appliquent à un nouveau projet, avec le profil de calcul *Open Planner Studio* et une semaine de travail du lundi au vendredi.

## Le concept

Une **relation** enregistre que deux tâches dépendent l'une de l'autre. La première tâche est le **prédécesseur**, la seconde le **successeur**. Une relation est une limite inférieure : le successeur ne peut jamais commencer ou finir plus tôt que ce que la relation permet, mais il peut commencer ou finir plus tard. Si une tâche a plusieurs prédécesseurs, elle attend la date la plus tardive qui résulte de toutes ces relations.

Il existe quatre types. Ils diffèrent par le moment du prédécesseur (début ou fin) qui est lié au moment du successeur :

- **FS (Fin-Début).** Le successeur ne commence qu'une fois le prédécesseur terminé. Les éléments de toiture ne sont posés qu'une fois les murs montés. C'est de loin le type de relation le plus utilisé.
- **SS (Début-Début).** Le successeur ne commence qu'une fois le prédécesseur commencé. Les tâches peuvent se chevaucher : la tuyauterie peut commencer dès que la maçonnerie est en cours.
- **FF (Fin-Fin).** Le successeur ne finit qu'une fois le prédécesseur terminé. Le jointoiement ne peut pas se faire avant la fin de la maçonnerie, mais il peut commencer plus tôt.
- **SF (Début-Fin).** Le successeur ne finit qu'une fois le prédécesseur commencé. Ce type est rare. Exemple : le rabattement de nappe temporaire ne peut s'arrêter qu'une fois la maçonnerie de la fondation commencée.

Une relation peut aussi avoir un **décalage** : un temps d'attente entre les deux tâches, par exemple du béton qui doit durcir. Un décalage négatif s'appelle une **avance** : le successeur commence alors avant la fin du prédécesseur, si bien que les tâches se chevauchent.

## Comment l'application calcule

### Les quatre types

Pour chaque relation, l'application calcule la date au plus tôt à laquelle le successeur peut commencer, et retient la plus tardive de toutes les relations d'une tâche. Sans décalage, cela fonctionne ainsi :

- Avec FS, le successeur commence le premier jour ouvré après la fin du prédécesseur.
- Avec SS, le successeur commence le même jour que le prédécesseur.
- Avec FF, le successeur finit le même jour que le prédécesseur. Pour trouver le début, l'application compte à rebours sur la durée du successeur. Un successeur de 3 jours ouvrés commence donc 2 jours ouvrés avant la fin du prédécesseur.
- Avec SF, le successeur finit le jour où le prédécesseur commence. Là aussi, l'application compte à rebours sur la durée du successeur.

Ce sont des limites inférieures. Un successeur commence plus tard si une autre relation ou une contrainte l'exige. Toutes les dates n'apparaissent qu'après **Calculer** (F5). Tant que la barre d'état affiche *Obsolète — recalculer (F5)*, les barres appartiennent au calcul précédent.

### Décalage et avance

Un décalage peut s'exprimer de quatre façons :

- En **jours ouvrés** (`3` ou `3d`) : l'application saute les jours de repos et les week-ends. C'est la valeur par défaut.
- En **jours calendaires** (`3ed`, le e signifie *écoulé*) : chaque jour compte, samedi et dimanche compris. C'est l'unité pour ce qui se poursuit sans que personne travaille, comme le durcissement.
- Sous forme de **pourcentage** de la durée du prédécesseur (`40%`) : l'application le recalcule à chaque calcul et arrondit à des jours entiers (2,5 jours deviennent 3).
- En **horaires de travail** (`4h`) : l'application compte le décalage dans le calendrier de décalage, par défaut celui du prédécesseur. Si le prédécesseur est une tâche en jours sur un calendrier sans plages horaires propres, comme le calendrier standard, l'application convertit les heures en jours ouvrés entiers, arrondis au jour le plus proche (une demi-journée est arrondie à la hausse). Avec un jour ouvré de 8 heures, `2h` et `3h` donnent donc 0 jour, `4h` jusqu'à `11h` compris donnent 1 jour et `12h` donne 2 jours. Si ce calendrier a ses propres plages horaires, ou si le prédécesseur est une tâche en heures, le décalage compte exactement en horaires de travail.

La règle pour un décalage de N jours ouvrés avec FS : les N jours ouvrés après la fin du prédécesseur sont du temps d'attente, et le successeur commence le jour ouvré suivant. Avec SS et FF, le décalage s'ajoute respectivement au début et à la fin du prédécesseur. Un décalage négatif se compte en arrière : une avance de 1 jour ouvré avec FS permet au successeur de commencer le jour où le prédécesseur finit.

Une avance ne peut pas placer une tâche avant le début du projet. Si cela devait arriver, l'application garde le successeur au début du projet et signale dans le panneau *Avertissements* : *Avance tronquée par le début du projet — la relation n'est pas pleinement respectée*.

### Dans quel calendrier le décalage compte

Chaque tâche peut avoir son propre calendrier. Avec un décalage en jours ouvrés, il importe de savoir quel calendrier compte les jours ouvrés. Le réglage *Calendrier de décalage* décide cela, avec quatre choix : *Prédécesseur*, *Successeur*, *24 heures* et *Calendrier du projet*. Par défaut, le décalage compte dans le calendrier du **prédécesseur**. Vous trouvez ce réglage sous *Paramètres › Projet › Paramètres du projet*, dans le bloc *Profil de calcul et options*, à *Options de calcul de ce projet*. Le choix fait partie du fichier de projet et ne compte qu'après un clic sur *Appliquer* ; le planning est alors recalculé.

Un décalage en jours calendaires (`3ed`) compte toujours tous les jours, quel que soit le *Calendrier de décalage* choisi.

### Relations sur les tâches récapitulatives

Vous pouvez placer une relation sur une phase (une tâche récapitulative) au lieu de la placer sur une tâche qu'elle contient. En interne, l'application place cette relation sur chaque tâche de la phase :

- Une phase comme **prédécesseur** avec FS ou FF : le successeur attend que la tâche de la phase qui finit en dernier soit terminée.
- Une phase comme **successeur** avec FS ou SS : chaque tâche de la phase attend le prédécesseur, indépendamment des autres tâches de la phase.
- Une phase comme **prédécesseur** avec SS ou SF : le successeur attend le début de la tâche de la phase qui commence **en dernier**, et non le début de la phase elle-même. C'est plus prudent que vous ne le pensez : le successeur ne commence jamais trop tôt, mais peut-être plus tard que vous ne le voulez. Si vous voulez que le successeur suive le début de la phase, placez la relation sur la première tâche de la phase.
- Une phase comme **successeur** avec FF ou SF : chaque tâche de la phase doit elle-même respecter l'exigence de fin (avec FF, la fin doit être égale ou postérieure à la fin du prédécesseur ; avec SF, égale ou postérieure au début du prédécesseur), même une tâche qui aurait pu être faite beaucoup plus tôt. Placez plutôt une telle relation sur la dernière tâche de la phase.

Une relation entre une tâche et la phase dans laquelle elle se trouve n'est pas autorisée.

### Relations déterminantes

Si un successeur a plusieurs prédécesseurs, une seule relation détermine en général sa date de début : la relation qui empêche le successeur de commencer un seul jour plus tôt qu'il ne le fait aujourd'hui. Une telle relation s'appelle **déterminante**. En cas d'égalité, il y a plusieurs relations déterminantes. Vous reconnaissez une relation déterminante au symbole de l'éclair dans les colonnes *Prédécesseurs* et *Successeurs* du tableau, à la colonne *Déterminante* (le **+** à droite de l'en-tête du tableau, sous *Relations*) et à la teinte plus forte quand vous tracez un chemin. Comment ouvrir ce chemin est expliqué dans [Tracer un chemin](docs://howto-pad-traceren).

Le caractère déterminant concerne les dates, pas la durée. Un prédécesseur court peut aussi être déterminant, par exemple à cause d'un long décalage ; vous le voyez dans l'exemple ci-dessous.

## Exemple détaillé

Les exemples utilisent des mini-projets distincts, tous commençant le lundi 7 juin 2027 sauf indication contraire. Des termes comme chemin critique et marge sont expliqués dans [Chemin critique et marge](docs://uitleg-kritiek-pad). Construire vous-même un réseau de relations et le vérifier, c'est ce que vous faites dans le tutoriel 2, « Relations et chemin critique ».

### Les quatre types côte à côte

*Pour foundation* dure 5 jours ouvrés : du lundi 7 au vendredi 11 juin. *Build walls* (5 jours ouvrés) suit avec FS et se déroule du lundi 14 au vendredi 18 juin. Quatre tâches de 3 jours ouvrés chacune dépendent de *Build walls*, chacune avec un type différent :

- *Place roof elements* (FS) commence le lundi 21 juin, le premier jour ouvré après la maçonnerie, et est terminée le mercredi 23 juin.
- *Pipework* (SS) commence le lundi 14 juin, en même temps que la maçonnerie, et est terminée le mercredi 16 juin.
- *Pointing* (FF) doit être terminé le vendredi 18 juin, en même temps que la maçonnerie. Avec 3 jours ouvrés, il commence donc le mercredi 16 juin.
- *Dewatering* (SF) doit finir le lundi 14 juin, le jour où la maçonnerie commence. En remontant de 3 jours ouvrés (jeudi 10, vendredi 11 et lundi 14 juin), le début tombe le jeudi 10 juin.

Seul *Place roof elements* se trouve sur le chemin critique ; le projet est terminé le mercredi 23 juin. *Pipework*, *Pointing* et *Dewatering* ont respectivement 5, 3 et 7 jours ouvrés de marge.

### Décalage et avance en chiffres

*Pour foundation* est terminé le vendredi 18 juin. *Build walls* (2 jours ouvrés) suit avec FS. Voici l'effet du décalage sur la date de début :

- Sans décalage, la maçonnerie commence le lundi 21 juin.
- Avec un décalage de `3` (trois jours ouvrés), les lundi 21, mardi 22 et mercredi 23 juin sont du temps d'attente ; la maçonnerie commence le jeudi 24 juin.
- Avec un décalage de `3ed` (trois jours calendaires), samedi, dimanche et lundi comptent ; la maçonnerie commence le mardi 22 juin.
- Avec un décalage de `-1` (une avance d'un jour ouvré), la maçonnerie commence le vendredi 18 juin, le jour où le coulage est terminé.
- Avec un décalage de `40%`, le décalage vaut 40% de 5 jours ouvrés, donc 2 jours ouvrés ; la maçonnerie commence le mercredi 23 juin.
- Avec un décalage de `50%`, le décalage vaut 2,5 jours ouvrés, arrondi à 3 jours ouvrés ; la maçonnerie commence le jeudi 24 juin.

### Quel calendrier compte le décalage

*Build walls* (4 jours ouvrés) a pour calendrier le calendrier du projet (du lundi au vendredi) et est terminé le jeudi 10 juin. *Pointing* (2 jours ouvrés) suit avec FS et un décalage de `3`, et a pour calendrier un calendrier où le samedi et le dimanche sont aussi des jours ouvrés. La date de début dépend alors du réglage *Calendrier de décalage* :

- *Prédécesseur* (par défaut) : le décalage compte dans le calendrier de la maçonnerie. Les vendredi 11, lundi 14 et mardi 15 juin sont du temps d'attente ; *Pointing* commence le mercredi 16 juin.
- *Successeur* : le décalage compte dans le calendrier de *Pointing*. Les vendredi 11, samedi 12 et dimanche 13 juin sont du temps d'attente ; *Pointing* commence le lundi 14 juin.
- *24 heures* : chaque jour calendaire compte. Là aussi, vendredi, samedi et dimanche sont du temps d'attente ; *Pointing* commence le lundi 14 juin.
- *Calendrier du projet* : le décalage compte dans le calendrier du projet, comme avec *Prédécesseur* ; *Pointing* commence le mercredi 16 juin.

### Relations sur une phase

*Foundation* est une phase avec deux tâches : *Excavate* (2 jours ouvrés, lundi 7 et mardi 8 juin), puis *Pour* (3 jours ouvrés, du mercredi 9 au vendredi 11 juin). *Build walls* suit la phase *Foundation* avec FS et commence le lundi 14 juin : l'application le fait attendre *Pour*, la dernière tâche qui finit.

Avec une phase comme successeur : *Permit* (3 jours ouvrés, terminé le mercredi 9 juin) a une relation FS avec la phase *Structure*. La phase contient *Build walls* (4 jours ouvrés), puis *Lay floor* (2 jours ouvrés). Chaque tâche de la phase attend le permis : *Build walls* commence le jeudi 10 juin et est terminé le mardi 15 juin. *Lay floor* attend aussi la maçonnerie et se déroule du mercredi 16 au jeudi 17 juin.

Avec SS depuis une phase : la phase *Finishing* contient *Plastering* (2 jours ouvrés, 7 et 8 juin), puis *Painting* (3 jours ouvrés, du 9 au 11 juin) et ensuite *Snagging* (2 jours ouvrés, 14 et 15 juin). *Cleaning* suit la phase avec SS. On attendrait un début le lundi 7 juin, mais l'application fait attendre *Cleaning* le début de *Snagging*, la tâche qui commence en dernier : le lundi 14 juin.

### Ce qui est déterminant

*Pour foundation* (2 jours ouvrés) se déroule du lundi 7 au mardi 8 juin. Deux branches suivent :

- *Build walls* (5 jours ouvrés) : du mercredi 9 au mardi 15 juin.
- *Order roof elements* (2 jours ouvrés) : mercredi 9 et jeudi 10 juin.

*Place roof elements* (3 jours ouvrés) suit les deux : avec FS après la maçonnerie, et avec FS et un décalage de `5` après la commande (le délai de livraison). Depuis la maçonnerie, la pose pourrait commencer le mercredi 16 juin. Depuis la commande, les vendredi 11, lundi 14, mardi 15, mercredi 16 et jeudi 17 juin sont du temps d'attente ; la pose commence le vendredi 18 juin. La relation avec la commande est donc déterminante, bien que la commande soit beaucoup plus courte que la maçonnerie. La maçonnerie a 2 jours ouvrés de marge.

## Conséquences et idées fausses

**« Une relation fixe les tâches. »** Non, une relation est une limite inférieure. Un successeur commence au plus tôt à la date que donne la relation, et plus tard si une autre relation ou une contrainte l'exige. La manière dont les contraintes s'articulent est expliquée dans [Contraintes et échéances](docs://uitleg-constraints).

**« SS signifie que les tâches commencent en même temps. »** SS dit seulement que le successeur ne peut pas commencer avant le prédécesseur. Si le successeur a un autre prédécesseur qui finit plus tard, il commence plus tard.

**« Avec FF, le successeur commence le même jour. »** Non, avec FF ce sont les dates de fin qui coïncident. Un successeur court commence donc plus tard que le prédécesseur, comme *Pointing* dans l'exemple.

**« Un décalage en jours compte des jours calendaires. »** Par défaut, un décalage compte des jours ouvrés, dans le calendrier du prédécesseur. Pour le durcissement ou le séchage, où le week-end compte aussi, vous utilisez des jours calendaires (`ed`).

**« Une tâche sans relation ne pose pas de problème. »** Une tâche sans prédécesseur commence à sa date de début planifiée, et une tâche sans successeur reçoit une marge jusqu'à la fin du projet. Si vous oubliez une relation, une tâche semble donc avoir beaucoup de place ; voyez les idées fausses dans [Chemin critique et marge](docs://uitleg-kritiek-pad).

**« Une relation sur une phase est une seule relation. »** Pour le calcul, c'est une relation par tâche de la phase. Si vous déplacez des tâches dans une phase ou hors d'une phase, les relations qui s'appliquent à ces tâches changent aussi.

## Voir aussi

- [Ajouter des relations](docs://howto-relaties-leggen) : les étapes pour lier des tâches entre elles et définir un décalage.
- [Chemin critique et marge](docs://uitleg-kritiek-pad) : ce que l'application calcule à partir de vos relations, et pourquoi une tâche devient critique.
- [Contraintes et échéances](docs://uitleg-constraints) : les règles de dates, à côté des relations.
- [Tracer un chemin](docs://howto-pad-traceren) : rendre visible la chaîne avant ou après une tâche.
- [Créer un hamac](docs://howto-hammock) : une tâche à durée dérivée, accrochée à des relations de type SS et FF.
- [Relations externes vers un autre projet](docs://howto-externe-relaties) : relations avec une tâche dans un autre fichier de projet.

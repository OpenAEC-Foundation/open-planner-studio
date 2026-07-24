# Relations & contraintes

Les tâches isolées ne se décalent pas lorsque le planning change. Les relations enregistrent cette dépendance ; les contraintes enregistrent une exigence stricte ou souple sur une date. Ce guide approfondit les deux davantage que [Démarrage rapide](docs://quick-start) : quand choisir quel type de relation, que fait exactement un décalage/une avance, que signifie un verrouillage dur et quand ne faut-il justement *pas* l'utiliser, et quel est le rapport entre une échéance et une contrainte ?

## Ce que vous allez apprendre ici

- Les quatre types de relation (FS/SS/FF/SF) et quand utiliser chacun.
- Le décalage et l'avance, y compris le décalage en pourcentage et le décalage en temps écoulé (par exemple pour la cure du béton).
- Ajouter des relations de trois façons : glisser-déposer, sélection, et le tableau des relations.
- Les huit types de contrainte, plus le verrouillage dur (P6 Mandatory) et la contrainte secondaire.
- La différence entre une échéance et une contrainte.

Suivez l'exemple d'entrée de gamme [Verbouwing & Aanbouw Eengezinswoning](examples://showcase-verbouwing-eengezinswoning.ifc) (permis SNET, chevauchement SS, lien FF) et, pour le conflit d'échéance, [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc).

## Les quatre types de relation

Chaque relation a un **Prédécesseur** et un **Successeur**, et l'un des quatre types :

- **FS — Finish-Start** : le successeur ne démarre qu'une fois le prédécesseur terminé. De loin la relation la plus courante en construction : d'abord la fondation, puis le gros œuvre. Utilisez FS lorsqu'une tâche ne peut physiquement pas démarrer avant que l'autre ne soit terminée.
- **SS — Start-Start** : les deux tâches démarrent (à peu près) en même temps. Utilisez ceci lorsque deux tâches peuvent s'exécuter ensemble une fois que la première a démarré — par exemple les travaux de murs et la charpente qui commencent à se chevaucher une fois le gros œuvre engagé, sans que l'un attende la fin de l'autre.
- **FF — Finish-Finish** : les deux tâches se terminent (à peu près) en même temps. Utile lorsque deux tâches peuvent s'exécuter indépendamment mais doivent être achevées ensemble — par exemple la peinture qui doit se terminer peu après le carrelage, afin qu'une pièce puisse être livrée d'un seul coup.
- **SF — Start-Finish** : le prédécesseur doit démarrer avant que le successeur ne soit autorisé à se terminer. De loin le type le moins courant en pratique de construction — réservez-le aux cas particuliers où une tâche de finition ne peut s'arrêter qu'une fois qu'une autre tâche a démarré (par exemple une relève d'équipe).

Vous voulez reconnaître ces trois premiers types dans un exemple réel ? L'exemple « Verbouwing & Aanbouw Eengezinswoning » contient une chaîne FS entre les phases principales, un chevauchement SS entre les travaux de murs et de charpente, et un lien FF entre les travaux de carrelage et de peinture.

## Décalage et avance

Une relation ne doit pas forcément être nulle : un **décalage** (positif) ajoute un temps d'attente entre le prédécesseur et le successeur, une **avance** (négative, saisie sous forme de nombre négatif) permet au successeur de démarrer plus tôt — un chevauchement délibéré. Le champ de décalage (**Décalage**, dans le panneau des propriétés et dans le tableau des relations) accepte une notation courte :

- `2d` — 2 jours ouvrés de décalage (l'unité par défaut : jours du calendrier du projet).
- `3ed` — 3 jours **écoulés** (elapsed) : des jours calendaires qui courent aussi pendant les week-ends ou les jours fériés. C'est l'unité à utiliser, par exemple, pour la **cure du béton** : le béton continue de durcir le samedi et le dimanche aussi, donc un décalage de « 3 jours ouvrés » sous-estimerait le temps de cure si un week-end tombe entre les deux. Dans ce cas, réglez le décalage sur l'unité en temps écoulé.
- `50%` — un décalage en pourcentage : 50 % de la durée du prédécesseur, recalculé à chaque exécution CPM à mesure que la durée du prédécesseur change (la même logique que MS Project). Utile lorsque le temps d'attente évolue naturellement avec la taille de la tâche précédente.
- `-25e%` — un décalage négatif en pourcentage de temps écoulé : une avance de 25 % de la durée du prédécesseur, en jours écoulés.

Un nombre négatif (avance) signifie que le successeur démarre pendant que le prédécesseur est encore en cours — par exemple le carrelage qui démarre déjà pendant les derniers jours de plâtrage dans la même pièce.

## Ajouter des relations

Il existe trois façons de créer une relation, selon l'endroit où vous travaillez déjà :

1. **Glisser-déposer dans le diagramme de Gantt** : maintenez **Maj** enfoncée et faites glisser depuis la barre du prédécesseur jusqu'à la barre du successeur. Dès que vous relâchez, une relation FS avec un décalage de 0 est créée immédiatement, et la fenêtre **Type de relation** apparaît aussitôt — vous pouvez y ajuster le type (FS/SS/FF/SF) et le décalage sans avoir à ouvrir le panneau des propriétés.
2. **Sélection + bouton** : sélectionnez d'abord le prédécesseur, maintenez Ctrl/Cmd et sélectionnez ensuite le successeur (dans cet ordre), puis cliquez sur **Nouvelle relation à partir de la sélection** (le groupe de ruban **Relations** de l'onglet **Planification**, ou l'onglet **Relations** lui-même). Ce bouton ne fonctionne que lorsque exactement deux tâches sont sélectionnées.
3. **Directement dans le tableau des relations** : ouvrez l'onglet **Relations** (via **Gérer** dans le groupe de ruban Relations). Le tableau affiche, par relation, les colonnes **Prédécesseur**, **Type**, **Décalage**, **Successeur**, **Déterminante** et **Marge libre** — le type et le décalage peuvent être modifiés directement ici, y compris pour les relations que vous avez créées précédemment par glisser-déposer ou par sélection.

La colonne **Déterminante** indique, après un calcul, quelle relation détermine réellement la date de début ou de fin du successeur — pour une tâche avec plusieurs prédécesseurs, ce n'est pas nécessairement la relation que vous avez créée le plus récemment, mais celle dont la date (déterminante) est la plus tardive.

## Types de contrainte

Une contrainte impose une limite de date à une tâche, indépendamment de ses relations. Open Planner Studio propose huit types, définis via le champ **Contrainte** du panneau des propriétés :

- **Dès que possible (ASAP)** — aucune limite de date, le type par défaut.
- **Le plus tard possible (ALAP)** — la tâche se décale le plus possible dans sa marge.
- **Début au plus tôt le (SNET)** — une borne inférieure sur la date de début (par exemple : ne pas démarrer avant l'obtention du permis).
- **Début au plus tard le (SNLT)** — une borne supérieure sur la date de début.
- **Fin au plus tôt le (FNET)** — une borne inférieure sur la date de fin.
- **Fin au plus tard le (FNLT)** — une borne supérieure sur la date de fin.
- **Doit commencer le (MSO)** — une date de début fixe.
- **Doit finir le (MFO)** — une date de fin fixe.

SNET/SNLT/FNET/FNLT sont toutes des **limites souples** : le calcul CPM en tient compte, mais une violation entraîne « seulement » une marge négative, pas un plantage ni un blocage. L'exemple « Verbouwing & Aanbouw Eengezinswoning » utilise par exemple une contrainte SNET pour empêcher une tâche de démarrer avant l'obtention du permis.

### Le verrouillage dur (P6 Mandatory)

MSO et MFO peuvent en plus être rendus **stricts** via la case à cocher **Obligatoire (logique de verrouillage)**, qui n'apparaît que pour ces deux types. Il s'agit de la contrainte « P6 Mandatory » de Primavera P6 : la barre est fixée à la date, même si ses prédécesseurs la contredisent logiquement. Lorsque vous activez un verrouillage dur, Open Planner Studio affiche un avertissement ponctuel : **un verrouillage dur outrepasse les relations — la barre est fixée à la date, même avant ses prédécesseurs. Une violation devient une marge négative en amont.**

N'utilisez donc un verrouillage dur que lorsqu'une date n'est vraiment pas négociable et se situe en dehors de la logique du planning — par exemple une date de réception légalement fixée qui s'applique indépendamment de l'avancement. Ne l'utilisez **pas** comme règle empirique pour « je veux que cette tâche soit à cette date » : dans ce cas, une contrainte souple (SNET/FNLT/etc.) ou simplement une chaîne de relations bien planifiée est presque toujours le meilleur choix. Un verrouillage dur peut comprimer tout le réseau en amont : si les tâches précédentes veulent s'étendre au-delà du verrouillage, une marge négative apparaît et se propage dans toute la chaîne avant la tâche verrouillée — un signe que le planning est en conflit, pas que le verrouillage a résolu le problème.

### Contrainte secondaire

Pour une contrainte non stricte (donc ni ASAP/ALAP ni un MSO/MFO strict), vous pouvez ajouter une **contrainte secondaire** : une seconde limite parmi les quatre mêmes types souples (SNET/FNET/SNLT/FNLT), qui ne peut pas borner le même côté que la contrainte primaire. Cela vous permet de définir, par exemple, à la fois une borne inférieure et une borne supérieure sur la date de début en même temps. Open Planner Studio valide la combinaison en temps réel et affiche une erreur dès que la combinaison est invalide — par exemple une contrainte secondaire à côté d'un verrouillage dur, ce qui n'est pas autorisé.

## Échéances contre contraintes

Une **échéance** (un champ distinct, panneau des propriétés) ressemble à une contrainte mais en diffère délibérément : c'est une borne supérieure souple et informative sur la date de fin, affichée dans le diagramme de Gantt sous forme d'un repère en flèche vers le bas — vert tant que la tâche est encore dans les temps, rouge dès que sa fin au plus tôt la dépasse. Une échéance ne force pas le planning (contrairement à une contrainte MFO/FNLT, qui participe activement au calcul), mais elle compte bien comme borne supérieure lors du calcul de la marge : si le planning ne respecte naturellement pas l'échéance, cela produit une **marge négative** sans qu'aucune contrainte ne soit impliquée.

C'est exactement ce qui se produit dans l'exemple [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) : il contient une échéance contractuelle délibérément serrée que la durée naturelle du planning ne respecte pas, ce qui entraîne une marge négative visible — un bon exemple à examiner si vous voulez voir à quoi ressemble un conflit d'échéance en pratique, sans que rien ne soit « cassé » : le planning se calcule simplement jusqu'au bout et montre où il est sous tension.

Règle empirique : utilisez une **échéance** pour une date cible que vous voulez surveiller sans forcer la logique du planning, et utilisez une **contrainte** (souple ou, exceptionnellement, stricte) lorsqu'une date est réellement une limite que le calcul doit respecter.

## Poursuivre la lecture

- Voyez SNET, le chevauchement SS et le lien FF en pratique : [Verbouwing & Aanbouw Eengezinswoning](examples://showcase-verbouwing-eengezinswoning.ifc).
- Voyez le conflit d'échéance en pratique : [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc).
- Structure pas encore en place ? Lisez d'abord [Planification & WBS](docs://gids-plannen-wbs).
- Pour les calendriers et horaires de travail qui affectent la durée des tâches : le guide [Calendriers & planification horaire](docs://gids-kalenders-uren).

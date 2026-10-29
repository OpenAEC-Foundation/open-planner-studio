# Profils de calcul et conventions

Le même planning peut donner des dates différentes, selon les règles de calcul que vous appliquez. Cet article explique pourquoi Primavera P6 et Microsoft Project calculent différemment sur quelques points, comment l'application enregistre cette différence dans un **profil de calcul**, et en quoi un profil se distingue des options de calcul que vous réglez vous-même par projet. Un exemple détaillé avec un petit réseau montre l'effet sur les dates.

## Le concept

Les tâches, les relations et un calendrier déterminent la plupart d'un planning, mais pas tout. Que se passe-t-il pour une tâche qui n'a pas encore commencé quand vous fixez une date d'état ? Où commence le travail restant d'une tâche déjà en cours ? Quelle est la marge libre d'une tâche quand une échéance est manquée ? Le réseau ne dit rien à ce sujet. Un logiciel de planification doit donc choisir une règle pour cela. L'application connaît plusieurs points où la règle de Primavera P6 et celle de Microsoft Project diffèrent.

L'application appelle un tel choix une **convention**. Un **profil de calcul** est l'ensemble des conventions qui appartient à un logiciel. L'application en compte trois :

- *Open Planner Studio* : le profil avec lequel un nouveau projet calcule. Aucune convention n'est activée.
- *Primavera P6* : les conventions que l'application connaît de P6.
- *Microsoft Project* : les conventions que l'application connaît de Microsoft Project.

Le profil indique donc comment un logiciel calcule. Ce que vous voulez pour votre projet ne fait pas partie du profil. Ce sont les **options de calcul** : des choix comme le niveau de marge à partir duquel une tâche est critique, ou dans quel calendrier un décalage compte. Vous les réglez par projet.

## Comment l'application calcule

### Conventions et options de calcul

Une convention est un interrupteur : activé ou désactivé. Le profil décide quels interrupteurs sont activés. Une option de calcul est un choix que vous faites. Vous voyez la différence dans l'application même, dans le bloc *Profil de calcul et options* :

- **Conventions** se trouvent sous *Conventions de ce profil*, regroupées par sujet, par exemple *Avancement et travail terminé*, *Relations et décalage* et *Marge et dates au plus tard*. Cette partie est d'abord repliée. Son titre indique le nombre de conventions et, si le profil diffère, une étiquette *modifié : 1*. Cliquez sur le titre pour la déplier. Avec un profil intégré, chaque ligne affiche *activé* ou *désactivé*. Ces valeurs sont informatives et ne peuvent pas être modifiées. Avec un profil personnalisé, chaque ligne a une case à cocher, suivie de la valeur de base (*base : activé* ou *base : désactivé*). Si votre choix diffère de cette valeur, la ligne ressort et *revenir à la base* apparaît. L'icône i après une ligne affiche l'explication de cette convention. Placez la souris dessus, allez-y avec Tab ou touchez-la. Lisez cette explication d'abord si vous voulez modifier une convention. Si une convention ne fonctionne qu'avec la planification horaire ou seulement sur les tâches d'un fichier .xer, une étiquette bleue à côté l'indique : *uniquement avec la planification horaire* ou *uniquement pour les tâches .xer*. La planification horaire signifie : un calendrier avec des plages de travail, une tâche dont la durée est en heures, ou le *Calendrier de décalage* réglé sur *24 heures*. Un projet avec seulement un calendrier en jours et des tâches en jours ne remarque rien d'une convention marquée *uniquement avec la planification horaire*, sauf si le *Calendrier de décalage* est réglé sur *24 heures*. Dans ce cas, un décalage se compte en heures, et une convention sur le décalage peut changer quelque chose.
- **Options de calcul** se trouvent sous *Options de calcul de ce projet* : entre autres *Définition du critique*, *Calcul de la marge*, *Tâches à extrémité ouverte critiques*, *Marquer quasi critique* et *Calendrier de décalage*. Elles indiquent ce que vous voulez pour ce projet, pas comment un logiciel calcule. Ce qu'elles font est expliqué dans [Chemin critique et marge](docs://uitleg-kritiek-pad) et [Relations et décalage](docs://uitleg-relaties).

Un exemple de chacun. « Une tâche est critique si sa marge totale est de 0 ou moins » est une option de calcul : vous pouvez fixer le seuil à 4, et alors tout ce qui a 4 jours ouvrés de marge ou moins est critique. « Une tâche non commencée se déplace à la date d’état » est une convention : Open Planner Studio et Primavera P6 le font, Microsoft Project ne le fait pas.

Le profil et les options de calcul font partie du fichier de projet, pas de l'application. Si vous enregistrez le projet, ils le suivent. Deux projets dans la même application peuvent donc calculer avec un profil différent. Un projet sans profil calcule comme Open Planner Studio.

Si votre projet provient d'un fichier .xer, le bloc affiche aussi en bas *Paramètres du fichier source* : des options de calcul que seul Primavera connaît et que le fichier a apportées. Vous ne pouvez pas les modifier ici. Le bouton des paramètres par défaut et un autre profil les laissent aussi inchangés. Un nouveau projet ne les a pas, pas même avec *Primavera P6*.

### Où choisir le profil

Pour un nouveau projet, le profil se trouve dans la fenêtre *Nouveau projet*, que vous ouvrez par *Accueil › Fichier › Nouveau*. Là, *Profil de calcul* est une liste déroulante. Si vous choisissez un profil ici, l'application remplace les options de calcul déjà remplies par les valeurs par défaut de ce profil ; seuls les paramètres d'un fichier source restent. Avec *Primavera P6*, *Calcul de la marge* devient alors *Marge de fin*. Avec *Microsoft Project* et *Open Planner Studio*, chaque option de calcul a sa valeur par défaut, donc *Calcul de la marge* vaut *Automatique (par défaut)*. Avec une date d'état, c'est aussi ainsi que MS Project calcule lui-même : une tâche commencée reçoit la marge de fin, et chaque autre tâche reçoit la plus petite des marges de début et de fin.

Pour un projet existant, vous choisissez le profil sous *Paramètres › Projet › Paramètres du projet*, dans le bloc *Profil de calcul et options*, dans la liste déroulante *Profil de calcul*. Vous pouvez aussi atteindre le même endroit par *Fichier › Paramètres du projet*. Changer de profil ici ne modifie que les conventions. Vos options de calcul restent telles quelles. Si vos options de calcul diffèrent de la valeur par défaut du profil, un bloc orange au-dessus des options l'indique. Cela est souvent voulu, par exemple parce que les options viennent du fichier ouvert. Si vous voulez quand même les valeurs par défaut, choisissez *Utiliser les paramètres par défaut de …* dans ce bloc. La croix masque le bloc pour ce fichier ouvert.

Tant que vous n'appuyez pas sur *Appliquer*, une modification n'existe que dans le formulaire. Avec *Appliquer*, l'application recalcule le planning tout de suite, même si *Calculer automatiquement* est désactivé. Si des tâches sont déplacées, elle indique combien, par exemple *Après application, 4 tâches ont été déplacées.* Tout le changement est une seule étape pour *Annuler*. Si vous appuyez sur *Annuler* ou *Rétablir* pendant que *Paramètres du projet* est ouvert, le bloc suit l'état du projet. Si vous aviez déjà modifié quelque chose dans le bloc vous-même, votre choix reste et un bloc jaune indique qu'*Appliquer* remet ce choix en place.

Les trois profils intégrés ne peuvent pas être modifiés. Pour d'autres conventions, vous créez un profil personnalisé ; vous pouvez aussi le garder comme modèle pour d'autres projets de cette application. Le projet garde toujours sa propre copie : si vous modifiez le modèle plus tard, le projet ne change pas avec lui. Les étapes sont décrites dans [Choisir ou créer un profil de calcul](docs://howto-rekenprofiel-kiezen).

### Quand l'application choisit elle-même un profil

Quand vous ouvrez un fichier, l'application propose un profil selon le format :

- Un fichier .mpp (Microsoft Project) s'ouvre avec le profil *Microsoft Project*.
- Un fichier .xer (Primavera P6) s'ouvre avec le profil *Primavera P6*.
- Un fichier au format *MS Project XML*, *Primavera P6 XML* ou *CSV (séparé par des points-virgules)* s'ouvre avec *Open Planner Studio*, sans message de profil.
- Votre propre projet (.ifc) s'ouvre avec le profil qui y est enregistré.

Pour un fichier .mpp ou .xer, l'application signale le profil : *Ce projet calcule comme Microsoft Project. Modifiable via Fichier → Informations du projet → Profil de calcul et options.* Le bouton *Ouvrir le profil de calcul* dans le message vous mène directement à *Paramètres du projet*. Pour un fichier .xer, cette ligne est la première ligne de détail du message d'ouverture du fichier. Plus d'informations sur ce message se trouvent dans [Ouvrir un fichier Primavera P6 (.xer)](docs://howto-xer-openen) et [Ouvrir un fichier Microsoft Project (.mpp)](docs://howto-mpp-openen).

Pour un fichier .mpp, l'application définit seulement le profil. Les options de calcul restent vides, comme dans un nouveau projet avec le profil *Microsoft Project* : *Calcul de la marge* vaut *Automatique (par défaut)*. Un fichier .mpp ouvert et un nouveau projet avec *Microsoft Project* calculent donc la marge de la même façon.

## Exemple détaillé : un réseau, trois profils

L'exemple est un petit réseau. Le calendrier a une semaine ouvrée du lundi au vendredi et aucun jour de congé pendant ces semaines. Le mode d'avancement est Retained Logic (la valeur par défaut). Le début du projet est le lundi 7 juin 2027. Toutes les tâches sont exprimées en jours ouvrés.

- *Pour foundation* : 5 jours ouvrés, planifiée à partir du lundi 7 juin.
- *Lay walls* : 5 jours ouvrés, après *Pour foundation* (fin-début).
- *Order window frames* : 3 jours ouvrés, sans prédécesseur, planifiée à partir du lundi 7 juin.
- *Fit roof* : 2 jours ouvrés, après *Lay walls* et après *Order window frames*. La fin de cette tâche est la remise.

Les chiffres ont été calculés avec le moteur de calcul de l'application. Vous les lisez dans le panneau *Propriétés*, sous *Résultat CPM*.

**Sans date d'état et sans avancement, les trois profils calculent ce réseau de la même façon.** *Pour foundation* va du lundi 7 au vendredi 11 juin, *Lay walls* du lundi 14 au vendredi 18 juin et *Fit roof* les lundi 21 et mardi 22 juin. La remise est le mardi 22 juin. *Order window frames* (du lundi 7 au mercredi 9 juin) a 7 jours ouvrés de marge totale.

Vous saisissez maintenant l'avancement. La date d'état est le mercredi 9 juin. *Pour foundation* a commencé le lundi 7 juin et est avancée à 60 %. Le travail restant est donc de 2 jours ouvrés (5 × 40 %). *Order window frames* n'a pas commencé. Le fonctionnement de [l'avancement et de la date d'état](docs://uitleg-voortgang) est expliqué dans cet autre article. Ici, la question est ce que le profil en fait.

### Open Planner Studio

Le travail restant de *Pour foundation* commence à la date d'état : le mercredi 9 et le jeudi 10 juin. Le début au plus tôt reste le début réel, le lundi 7 juin. La fin au plus tôt est le jeudi 10 juin. *Lay walls* va du vendredi 11 au jeudi 17 juin, et *Fit roof* les vendredi 18 et lundi 21 juin.

*Order window frames* était planifiée pour le lundi 7 juin, mais n'a pas commencé. Une tâche non commencée ne peut pas se trouver dans le passé. L'application la déplace donc à la date d'état : du mercredi 9 au vendredi 11 juin, avec 4 jours ouvrés de marge totale. La remise est le lundi 21 juin.

### Primavera P6

Tout est identique à Open Planner Studio, sauf un point : le début au plus tôt de *Pour foundation* est le mercredi 9 juin. C'est le début du travail restant, pas le début réel. Cela se fait par la convention *Tâche en cours : début au plus tôt = début du travail restant*, dans le groupe *Avancement et travail terminé*. La fin et la marge ne changent pas à cause de cela. La remise est le lundi 21 juin.

### Microsoft Project

Ici, les dates diffèrent. Deux conventions du groupe *Avancement comme dans Microsoft Project* en sont la cause.

*Ne pas déplacer les tâches non commencées à la date d’état* : *Order window frames* reste du lundi 7 au mercredi 9 juin, bien que cela se situe en partie avant la date d'état. La marge totale est de 7 jours ouvrés.

*Le travail restant reprend après la durée écoulée* : le travail restant commence au plus tôt à la date d'état, et au plus tôt au début réel plus la durée déjà écoulée. À 60 % de 5 jours ouvrés, 3 jours ouvrés sont faits. Le lundi 7 juin plus 3 jours ouvrés donne le jeudi 10 juin. C'est après la date d'état, donc le travail restant va les jeudi 10 et vendredi 11 juin. *Lay walls* va du lundi 14 au vendredi 18 juin, et *Fit roof* les lundi 21 et mardi 22 juin. La remise est le mardi 22 juin : un jour ouvré plus tard que dans les deux autres profils.

### Et si

**Pour foundation est à 20 % au lieu de 60 %.** Le travail restant est alors de 4 jours ouvrés. Avec les trois profils, *Pour foundation* finit le lundi 14 juin et la remise est le mercredi 23 juin. La convention de Microsoft Project pour le travail restant ne change rien ici : le lundi 7 juin plus 1 jour ouvré écoulé donne le mardi 8 juin, soit avant la date d'état. Une telle convention est une limite inférieure, qui ne peut que rendre le travail restant plus tardif. *Order window frames* et le début au plus tôt sous Primavera P6 diffèrent encore, comme ci-dessus. Sous Microsoft Project, *Order window frames* a alors 8 jours ouvrés de marge totale.

**Vous ne réglez qu'une date d'état et ne saisissez aucun avancement.** Avec Open Planner Studio et Primavera P6, tout le réseau passe au mercredi 9 juin. *Pour foundation* va alors du mercredi 9 au mardi 15 juin et la remise devient le jeudi 24 juin : deux jours ouvrés plus tard que sans date d'état. Avec Microsoft Project, tout reste en place et la remise est le mardi 22 juin.

**Vous composez vous-même un profil.** Sous Open Planner Studio, créez un profil personnalisé avec *Nouveau profil*, *Copie de Open Planner Studio*, et activez-y seulement *Ne pas déplacer les tâches non commencées à la date d’état*. Avec un avancement de 60 %, *Pour foundation* garde alors les dates d'Open Planner Studio (fin le jeudi 10 juin, remise le lundi 21 juin). *Order window frames* reste bien du lundi 7 au mercredi 9 juin, avec 6 jours ouvrés de marge totale. Un profil est donc un ensemble d'interrupteurs séparés, que vous pouvez modifier un par un.

**Une option de calcul à la place d'une convention.** Si vous réglez *Définition du critique* (*Marge totale ≤ seuil*) à un *Seuil (jours ouvrés)* de 4 sous Open Planner Studio, *Order window frames* devient critique, car sa marge totale vaut exactement 4. Aucune date ne change. Une option de calcul est votre choix pour le projet et est indépendante du profil.

**Une échéance manquée.** Donnez à *Fit roof* une échéance le vendredi 18 juin. Sous Open Planner Studio, la marge totale de *Fit roof* est alors de −1 jour ouvré et la marge libre aussi, −1. Sous Primavera P6, la marge totale reste −1, mais la marge libre devient 0. C'est ce que fait la convention *Marge libre jamais négative*, dans le groupe *Marge et dates au plus tard*. Sous Microsoft Project, les deux valent −2, parce que la remise tombe là-bas un jour plus tard. Le fonctionnement d'une échéance est décrit dans [Contraintes et échéances](docs://uitleg-constraints).

## Conséquences et malentendus

**« Le profil est un réglage de l'application. »** Non. Le profil et les options de calcul appartiennent au projet et voyagent avec le fichier. Seuls les modèles que vous conservez appartiennent à l'application, et un projet garde toujours sa propre copie.

**« Si j'exporte, mon profil part avec. »** Seulement avec votre propre format de projet (.ifc). Si vous exportez vers *MS Project XML*, *Primavera P6 XML* ou *CSV (séparé par des points-virgules)*, le profil ne figure pas dans le fichier. Parmi les options de calcul, l'export *MS Project XML* écrit au plus le seuil critique. L'application ne signale cela que pour un projet issu d'un fichier .xer. Pour un projet que vous avez créé vous-même, vous ne recevez aucun message. Le fichier s'ouvre alors comme Open Planner Studio, sans message sur le profil. Prenons l'exemple du profil Microsoft Project avec 60 % d'avancement. Si vous l'exportez vers *MS Project XML* puis le rouvrez, l'application affiche d'abord les dates du fichier, avec la date de remise le mardi 22 juin. Si vous laissez l'application recalculer elle-même, la date devient le lundi 21 juin. Ce qu'un export perd d'autre figure dans [Fichiers et formats](docs://uitleg-bestanden).

**« Le profil Primavera P6 donne le même résultat que P6. »** L'application ne peut pas le garantir. Le profil active les conventions que l'application connaît de P6, et celles-ci ne couvrent pas tous les réglages de P6. Outre Retained Logic et Progress Override, P6 possède un troisième mode d'avancement, Actual Dates. L'application ne le connaît pas : un fichier .xer de ce type se calcule comme Retained Logic, et le message d'ouverture le signale, par exemple avec *1 paramètre de planification P6 a utilisé un repli sûr.* Certaines conventions du profil Primavera P6 ne fonctionnent aussi que sur des tâches issues d'un fichier .xer, comme *LOE non commencée prend la fenêtre cible* et *Reprendre les dates réelles exactement*. Pour certaines d'entre elles, l'explication le précise : « uniquement les tâches avec provenance P6 ». Sur les tâches que vous créez vous-même, ces conventions ne font rien.

**« Le mode d'avancement fait partie du profil. »** Non. Retained Logic ou Progress Override est un choix distinct pour chaque projet. Vous le réglez séparément du profil, voir [Choisir le mode d'avancement](docs://howto-voortgangsmodus-kiezen). Une convention du profil Primavera P6, *Progress Override ignore aussi en arrière un successeur commencé*, n'agit que sous Progress Override.

**« Je change simplement de profil pour voir ce qui se passe. »** Vous pouvez le faire : *Annuler* défait *Appliquer* en une seule étape, et le profil et les dates reviennent ensemble. Mais les dates peuvent réellement bouger. Dans l'exemple, passer de Open Planner Studio à Microsoft Project déplace les 4 tâches. Le message les compte pour vous. Contrôlez ensuite le planning avant de continuer. Si l'application affiche encore les dates du fichier après l'ouverture d'un .xer ou d'un .mpp, un changement de profil quitte cette vue et l'application calcule elle-même. Le fonctionnement est décrit dans [Dates telles qu'enregistrées](docs://uitleg-datums-zoals-opgeslagen).

**L'exemple montre quatre conventions, et la liste de l'application est plus longue.** Chaque ligne du bloc a sa propre explication. Lisez-la d'abord. Regardez aussi le groupe *Profils personnalisés uniquement* : ces conventions sont désactivées dans chaque profil intégré, y compris Primavera P6. Seul un profil personnalisé peut les activer : créez-en un avec *Nouveau profil*.

## Voir aussi

- [Choisir ou construire un profil de calcul](docs://howto-rekenprofiel-kiezen) : choisir, changer ou construire un profil.
- [Avancement, date d'état et référence](docs://uitleg-voortgang) : ce que font la date d'état et le travail restant, avec les différences par profil.
- [Choisir le mode d'avancement](docs://howto-voortgangsmodus-kiezen) : choisir entre Retained Logic et Progress Override.
- [Chemin critique et marge](docs://uitleg-kritiek-pad) : les options de calcul liées au critique et à la marge.
- [Relations et décalage](docs://uitleg-relaties) : l'option de calcul *Calendrier de décalage*.
- [Fichiers et formats](docs://uitleg-bestanden) : ce qu'un export contient et ce qu'il ne contient pas.
- [Exporter](docs://howto-exporteren) : exporter un projet.
- [Mettre à jour l'avancement](docs://howto-voortgang-bijwerken) : saisir le pourcentage, le début réel et la date d'état.
- [Dates telles qu'enregistrées](docs://uitleg-datums-zoals-opgeslagen) : pourquoi les dates importées peuvent différer de ce que l'application calcule elle-même.
- [Options de calcul et conventions](docs://ref-rekenopties-en-conventies) : toutes les conventions et options de calcul dans une seule liste.

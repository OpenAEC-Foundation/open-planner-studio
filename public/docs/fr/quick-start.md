# Votre premier planning en 10 minutes

Ce guide vous emmène, en environ 10 minutes, d'un projet vide à un planning de construction entièrement calculé : ajouter des tâches, construire une structure de tâches, ajouter des relations, calculer et enregistrer. Pas de théorie préalable — vous le faites directement, étape par étape, avec les boutons et menus exacts que vous trouverez dans Open Planner Studio.

## Ce que vous allez faire

1. Créer un nouveau projet.
2. Ajouter des tâches — via le ruban, le tableau des tâches et le diagramme de Gantt.
3. Organiser les tâches en structure (WBS) en les mettant en retrait.
4. Ajouter des relations entre les tâches.
5. Calculer le planning.
6. Lire le résultat : chemin critique et marge.
7. Enregistrer.

Vous préférez d'abord voir où vous allez ? Ouvrez le projet d'exemple [Verbouwing & Aanbouw Eengezinswoning](examples://showcase-verbouwing-eengezinswoning.ifc) via **Fichier → Exemples**. (Les noms d'exemple sont affichés en néerlandais, tels que fournis avec le projet.) C'est un petit planning facile à lire qui illustre déjà presque toutes les étapes ci-dessous — pratique à garder ouvert à côté de cet article pour comparer.

Tout ce qui suit fonctionne à l'identique dans l'application de bureau et dans la version navigateur : mêmes boutons, mêmes menus, mêmes raccourcis.

## Étape 1 — Créer un nouveau projet

1. Cliquez sur l'onglet du ruban **Fichier**. Cela ouvre l'écran des fichiers.
2. Cliquez sur **Nouveau** (ou utilisez le raccourci **Ctrl+N** si vous travaillez déjà dans un autre projet). La boîte de dialogue **Nouveau projet** apparaît.
3. Saisissez un **Nom du projet**, par exemple « Mon premier planning », et vérifiez la **Date de début** — elle est définie par défaut sur aujourd'hui.
4. Pour **Modèle de phasage**, choisissez **Vide**. Les modèles **Construction résidentielle** et **Tertiaire / rénovation** préconfigurent déjà quelques tâches de phase, mais pour cet exercice vous allez tout construire vous-même afin de reconnaître chaque étape.
5. Laissez les options de calendrier à leurs valeurs par défaut et cliquez sur **Créer**.

Vous disposez maintenant d'un projet vide : un tableau des tâches vide à gauche, un diagramme de Gantt vide à droite, et un calendrier de travail déjà configuré à partir des paramètres par défaut.

## Étape 2 — Ajouter des tâches

Assurez-vous d'être sur l'onglet du ruban **Accueil**. Cet onglet affiche le tableau des tâches (gauche) et le diagramme de Gantt (droite) côte à côte — deux vues du même planning, de sorte qu'une tâche que vous ajoutez apparaît aux deux endroits en même temps.

### Via le ruban

1. Dans le groupe de ruban **Tâches**, cliquez sur le bouton **Tâche**. Une nouvelle tâche nommée « Nouvelle tâche » apparaît, avec une durée de 5 jours ouvrés, en bas du tableau des tâches et du diagramme de Gantt.
2. Répétez cette opération plusieurs fois jusqu'à avoir une tâche pour chaque phase principale de votre projet. Si vous suivez le projet d'exemple, utilisez les mêmes phases principales que lui : « 1. Voorbereiding » (Préparation), « 2. Fundering & ruwbouw » (Fondation & gros œuvre), « 3. Afbouw » (Finitions) et « 4. Oplevering » (Réception).
3. Double-cliquez sur une tâche — dans le tableau ou sur sa barre dans le diagramme de Gantt — pour ouvrir la fenêtre **Modifier la tâche**. Ajustez le **Nom**, le **Type** et la **Durée (jours ouvrés)** pour correspondre à votre phase.

### Via le tableau des tâches et le diagramme de Gantt

Vous n'êtes pas obligé de revenir sans cesse au ruban. Cliquez avec le bouton droit sur une **ligne vide** du tableau des tâches, ou sur un emplacement vide du diagramme de Gantt (là où il n'y a pas encore de tâche), et choisissez **Nouvelle tâche** dans le menu contextuel.

Cliquez avec le bouton droit sur une tâche **existante** à la place, et vous obtenez un menu contextuel différent, comprenant entre autres :

- **Insérer au-dessus** / **Insérer en dessous** — ajoute une tâche avant ou après la tâche sur laquelle vous avez cliqué avec le bouton droit.
- **Ajouter une sous-tâche** — crée une nouvelle tâche en tant qu'enfant de cette tâche en une seule étape (voir l'étape 3 pour ce que cela signifie).

Vous avez tapé quelque chose de travers, ou ajouté une tâche au mauvais endroit ? **Ctrl+Z** annule la dernière action, **Ctrl+Y** (ou **Ctrl+Shift+Z**) la rétablit — les deux fonctionnent dans tout le planning, pas seulement dans les champs de texte.

### Ajouter un jalon

Chaque planning a besoin d'au moins un jalon, par exemple pour la réception. Dans le groupe de ruban **Tâches**, cliquez sur la flèche à côté de **Jalon** et choisissez **Jalon de fin**, **Jalon de début** ou **Point d'inspection (obligatoire)** — ou utilisez le raccourci **Ctrl+M** pour un jalon générique rapide (« Nouveau jalon ») que vous renommez ensuite.

## Étape 3 — Construire une structure de tâches (WBS)

Une liste plate de tâches devient rapidement confuse. En mettant des tâches en retrait, vous construisez une structure de tâches (WBS) : la tâche du dessus devient alors automatiquement une **tâche récapitulative** qui couvre toute la période de ses sous-tâches.

1. Sélectionnez une tâche qui doit se trouver sous une autre tâche — par exemple « Fundering aanbouw » (Fondation de l'extension) sous la tâche de phase « 2. Fundering & ruwbouw » (Fondation & gros œuvre).
2. Appuyez sur **Alt+→** pour mettre en retrait, ou cliquez avec le bouton droit et choisissez **Mettre en retrait** dans le menu contextuel. La tâche du dessus devient immédiatement visible comme tâche récapitulative.
3. Vous êtes allé trop loin, ou souhaitez ramener une tâche au niveau supérieur ? Utilisez **Alt+←**, ou cliquez avec le bouton droit et choisissez **Réduire le retrait**.
4. Plus rapide pour une toute nouvelle sous-tâche : cliquez avec le bouton droit sur la tâche parente et choisissez **Ajouter une sous-tâche** — cela évite les étapes séparées d'ajout puis de mise en retrait.

Répétez cette opération jusqu'à obtenir quelques niveaux de profondeur. Dans le projet d'exemple, la phase « 2. Fundering & ruwbouw » se décompose par exemple en sous-tâches « Grondwerk aanbouw » (Terrassement de l'extension), « Fundering aanbouw » (Fondation de l'extension), « Begane grondvloer storten » (Coulage du rez-de-chaussée), « Wanden opmetselen » (Maçonnerie des murs) et « Dakconstructie plaatsen » (Pose de la charpente).

Cet article ne couvre la construction de la WBS qu'à un niveau pratique, pour vous lancer. Pour apprendre comment les types de jalons, les tâches récapitulatives et les codes d'activité fonctionnent ensemble en détail, lisez le guide [Planning & WBS](docs://gids-plannen-wbs).

## Étape 4 — Ajouter des relations

Les tâches sans relation sont indépendantes les unes des autres et ne se décalent pas lorsque vous modifiez une tâche antérieure. Une relation (dépendance) lie deux tâches entre elles.

1. Assurez-vous que les barres des deux tâches que vous voulez lier sont visibles dans le diagramme de Gantt.
2. Maintenez **Maj** enfoncée et faites glisser depuis la barre du prédécesseur jusqu'à la barre du successeur. Dès que vous relâchez, une relation **Finish-Start (FS)** avec un décalage de 0 jour ouvré est créée immédiatement — la relation la plus courante : le successeur ne démarre qu'une fois le prédécesseur terminé.
3. Juste après avoir relâché, la fenêtre **Type de relation** apparaît. Vous pouvez y modifier le type de relation (**FS**, **SS**, **FF** ou **SF**) et saisir un **décalage**, par exemple `2d` pour deux jours ouvrés d'attente entre les tâches. En bref : avec **FS** (Finish-Start), le successeur démarre après la fin du prédécesseur ; avec **SS** (Start-Start), les deux tâches démarrent (à peu près) en même temps ; avec **FF** (Finish-Finish), elles se terminent (à peu près) en même temps ; et avec **SF** (Start-Finish), le prédécesseur doit démarrer avant que le successeur ne soit autorisé à se terminer — ce dernier cas est le moins courant en pratique de construction.
4. Vous préférez lier deux tâches sans glisser-déposer ? Allez sur l'onglet du ruban **Relations** (ou cliquez sur **Gérer** dans le groupe de ruban **Relations** de l'onglet Planification), sélectionnez d'abord le prédécesseur, puis (en maintenant Ctrl/Cmd) le successeur, et utilisez le bouton **Nouvelle relation à partir de la sélection** — ce bouton ne fonctionne que lorsque exactement deux tâches sont sélectionnées, dans cet ordre.

Pour l'exercice, ajoutez au moins deux relations : par exemple « 1. Voorbereiding » → « 2. Fundering & ruwbouw » et « 2. Fundering & ruwbouw » → « 3. Afbouw ».

## Étape 5 — Calculer

Maintenant que vous avez des tâches et des relations, vous pouvez faire calculer le planning (CPM — méthode du chemin critique).

1. Appuyez sur **F5**, ou cliquez sur le bouton **Calculer** dans le groupe de ruban **Planification**.
2. Open Planner Studio calcule maintenant, pour chaque tâche, les dates de début et de fin au plus tôt et au plus tard, la marge, et quelles tâches se trouvent sur le chemin critique.
3. Vous ne voulez plus penser à F5 ? Activez **Calculer automatiquement** dans **Paramètres**. Le planning se recalcule alors lui-même dès qu'il devient obsolète, au lieu d'attendre un appui manuel sur F5.

## Étape 6 — Lire le résultat

- En bas de l'écran, la barre d'état affiche par exemple « Chemin critique : 4 tâches, 62 jours ouvrés » une fois le planning calculé. Si vous avez modifié quelque chose depuis le dernier calcul, elle affiche à la place « Obsolète — recalculer (F5) ».
- Dans le diagramme de Gantt, les tâches critiques — les tâches sans marge, qui déterminent donc directement la date de fin du projet — reçoivent une couleur de barre différente des tâches qui disposent encore d'une marge. Si une tâche critique prend du retard, la date de fin du projet tout entier se décale avec elle ; une tâche avec de la marge peut prendre du retard sans conséquence, tant que la marge n'est pas épuisée.
- Double-cliquez sur une tâche pour rouvrir la fenêtre **Modifier la tâche**. Sous la section **Résultat CPM**, vous trouverez, par tâche : **Début au plus tôt**, **Fin au plus tôt**, **Début au plus tard**, **Fin au plus tard**, **Marge totale**, **Marge libre**, et si la tâche se trouve sur le **Chemin critique**.
- Vous voulez aussi ces données comme colonnes dans le tableau des tâches, au lieu de devoir ouvrir chaque tâche ? Allez sur l'onglet du ruban **Affichage**, cliquez sur **Colonnes…** dans le groupe **Affichage**, et cochez **Critique** et **Marge totale**.

## Étape 7 — Enregistrer

1. Appuyez sur **Ctrl+S**, ou cliquez sur **Enregistrer** dans l'onglet **Fichier**. La première fois, Open Planner Studio demande un nom de fichier et un emplacement ; le projet est enregistré comme fichier IFC natif.
2. Vous préférez conserver une copie sous un autre nom, par exemple pour garder deux variantes côte à côte ? Utilisez **Fichier → Enregistrer sous** (raccourci **Ctrl+Shift+S**).

## Continuer à s'entraîner

- Rejouez les étapes ci-dessus avec un exemple complet : ouvrez [Verbouwing & Aanbouw Eengezinswoning](examples://showcase-verbouwing-eengezinswoning.ifc) via **Fichier → Exemples** et repérez la chaîne FS entre les phases, le chevauchement SS entre les travaux de murs et de charpente, le lien FF entre le carrelage et la peinture, et la contrainte de permis (SNET) avant le démarrage.
- Vous voulez en savoir plus sur la structure des tâches, les tâches récapitulatives, les types de jalons et les codes d'activité ? Lisez le guide [Planning & WBS](docs://gids-plannen-wbs).
- Vous préférez faire une visite visuelle des principales zones de l'écran ? Relancez la visite via l'onglet **Affichage** → bouton **Visite guidée**, ou via **Fichier** → **Démarrer la visite guidée**.

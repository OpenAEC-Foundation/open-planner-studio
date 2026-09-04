# Planification & WBS

Un planning commence par une structure de tâches : quelles tâches existent, comment sont-elles décomposées en phases, et quels moments sont assez importants pour mériter un jalon ? Ce guide approfondit ce fondement davantage que le guide [Démarrage rapide](docs://quick-start) — vous y apprendrez non seulement *comment* mettre en retrait, mais aussi ce que fait réellement une tâche récapitulative, en quoi les trois types de jalons diffèrent, comment donner à vos tâches leurs propres codes et champs, et comment tenir des notes par tâche.

## Ce que vous allez apprendre ici

- Construire une structure de tâches (WBS) à l'aide de la mise en retrait et des tâches récapitulatives.
- Déplacer des tâches au sein d'un même niveau, sans les remettre en retrait — avec le clavier, à la
  souris, ou sur l'onglet **Tableau** façon tableur.
- Les trois types de jalons et l'indicateur obligatoire distinct pour les moments contractuels.
- Gérer les codes d'activité et les champs personnalisés via la fenêtre **Codes et champs**, et grouper par leur biais.
- Utiliser les notes (une liste de contrôle par tâche) pour suivre les points en suspens.

Vous préférez suivre un exemple complet ? Ouvrez [Verbouwing & Aanbouw Eengezinswoning](examples://showcase-verbouwing-eengezinswoning.ifc) via **Fichier → Exemples** — le phasage « 1. Voorbereiding » (Préparation) / « 2. Fundering & ruwbouw » (Fondation & gros œuvre) / « 3. Afbouw » (Finitions) / « 4. Oplevering » (Réception) avec ses sous-tâches est exactement la structure expliquée ci-dessous.

## Construire une structure de tâches

Une liste plate de tâches ne dit rien de leurs relations. En mettant une tâche en retrait sous une autre tâche, vous construisez une structure arborescente (WBS — Work Breakdown Structure) : la tâche parente devient alors automatiquement une **tâche récapitulative**.

1. Sélectionnez la tâche que vous voulez placer plus profondément dans la structure.
2. Appuyez sur **Alt+→** pour mettre en retrait. Il existe un second raccourci pour la même action : **Alt+Maj+→** — pratique si votre disposition de clavier utilise déjà Alt+→ pour autre chose. Les deux font exactement la même chose.
3. Vous préférez travailler à la souris ? Cliquez avec le bouton droit sur la tâche et choisissez **Mettre en retrait** dans le menu contextuel.
4. Vous êtes allé un niveau trop loin ? **Alt+←** (ou clic droit → **Réduire le retrait**) ramène la tâche d'un niveau en arrière.
5. Pour une toute nouvelle sous-tâche, il existe un raccourci plus rapide : cliquez avec le bouton droit sur la tâche parente et choisissez **Ajouter une sous-tâche**. Cela crée une nouvelle tâche déjà mise en retrait en une seule étape, au lieu d'ajouter d'abord une tâche puis de la mettre en retrait séparément.

Dès qu'une tâche a au moins une sous-tâche, elle devient automatiquement une tâche récapitulative : sa barre dans le diagramme de Gantt couvre alors toute la période, du début le plus tôt à la fin la plus tardive de toutes les sous-tâches qu'elle contient, et sa propre durée et ses propres dates ne peuvent plus être définies indépendamment. Une tâche récapitulative est donc toujours une valeur dérivée, jamais un planning que vous saisissez directement — supprimez ou décalez les sous-tâches, et la barre de la tâche récapitulative s'ajuste automatiquement.

**Réduire et développer.** Avec une grande WBS, vous voudrez parfois compacter temporairement l'arborescence. L'onglet du ruban **Affichage**, groupe **Plan**, propose pour cela deux boutons distincts — **Réduire** et **Développer** — délibérément pas un seul bouton à bascule, car avec une sélection mixte (certaines branches ouvertes, d'autres fermées) une bascule ne pourrait jamais tout mettre dans le même sens.

- **Avec une sélection**, les boutons agissent sur les tâches sélectionnées ; seules les tâches ayant des sous-tâches sont concernées, les tâches isolées sont ignorées.
- **Sans sélection**, ils agissent sur tout le planning. Désélectionnez avec **Échap**, ou cliquez sur une zone vide de la vue Gantt.
- Dans une vue groupée (voir *Grouper par codes et champs* plus bas), les boutons réduisent/développent les bandeaux de groupe à la place — y compris les bandeaux imbriqués — plutôt que les tâches.

La flèche devant une tâche récapitulative continue par ailleurs de fonctionner comme avant, pour ouvrir ou fermer uniquement cette branche-là.

### Insérer une nouvelle tâche au bon endroit

Les nouvelles tâches ne sont plus forcément ajoutées à la fin. Tous les boutons et toutes les touches qui créent une tâche suivent la même règle :

- **Si une tâche est sélectionnée**, la nouvelle tâche se place directement **en dessous** de celle-ci, et non en bas de la liste. Elle hérite du niveau et de la tâche parente de votre sélection : une nouvelle tâche dans une phase reste donc dans cette phase.
- **Si rien n'est sélectionné**, elle est ajoutée à la fin, comme auparavant.
- **Si plusieurs tâches sont sélectionnées**, elle se place sous la tâche la **plus basse** de votre sélection telle qu'elle apparaît à l'écran — jamais au milieu de la sélection, et l'ordre dans lequel vous les avez cliquées n'a aucune importance.

Cela vaut pour le bouton **Tâche** et le menu **Jalon** du groupe de ruban **Tâches**, ainsi que pour **Nouvelle tâche** dans le menu contextuel. Ce groupe figure aussi bien sur l'onglet **Accueil** que sur l'onglet **Tableau**, avec les trois mêmes boutons (**Tâche**, **Jalon**, **Lien**) : vous n'avez donc plus à changer d'onglet pour saisir des tâches.

Au clavier, c'est encore plus rapide :

- **Inser** insère une tâche **au-dessus** de la sélection.
- **Ctrl+I** (**Cmd+I** sur macOS) insère une tâche **en dessous** de la sélection — l'endroit voulu la plupart du temps lorsqu'on déroule une liste.

Les deux figurent aussi dans l'aperçu des raccourcis (**Ctrl+/**), catégorie **Structure**.

**Uniquement en vue arborescente.** Insérer au-dessus ou en dessous est une intervention structurelle, qui n'a de sens que tant que l'ordre affiché correspond à l'ordre réel. Avec un filtre, un tri ou un regroupement actif, la nouvelle tâche apparaîtrait ailleurs que là où vous l'avez placée. L'application refuse alors l'insertion au-dessus/en dessous et affiche un bandeau qui explique pourquoi, avec un bouton pour effacer filtre, tri et regroupement en un clic. Les boutons **Tâche** et **Jalon** continuent de fonctionner, mais placent la tâche à la fin — avec la même explication.

### Déplacer des tâches sans les remettre en retrait

Outre le changement de niveau d'une tâche (retrait/réduction du retrait), vous pouvez aussi permuter la position d'une tâche au sein du même niveau, sans changer la structure elle-même :

- **Alt+↑** déplace la tâche sélectionnée vers le haut, au-dessus de la tâche actuellement au-dessus d'elle.
- **Alt+↓** déplace la tâche vers le bas.

Cela fonctionne à n'importe quel niveau de l'arborescence : déplacez une tâche de phase, et toutes ses sous-tâches se déplacent automatiquement avec elle.

Vous préférez la souris ? Attrapez une tâche par sa ligne dans le tableau des tâches (la colonne de
gauche de la vue Gantt, avec le même comportement de glisser-déposer sur l'onglet du ruban
**Tableau**) et faites-la glisser vers le haut ou vers le bas. Déposez-la entre deux lignes pour la
réordonner parmi ses tâches sœurs, comme avec Alt+↑/↓. Déposez-la plutôt sur la partie inférieure de
la ligne d'une tâche récapitulative, et elle s'imbrique : la tâche devient la nouvelle dernière
sous-tâche de cette tâche récapitulative, la mettant en retrait en un seul geste — c'est l'équivalent
souris d'Alt+→. Sélectionnez d'abord plusieurs tâches (Ctrl/Cmd-clic, ou une sélection par
rectangle) et toute la sélection se glisse et se dépose ensemble.

L'onglet du ruban **Tableau** affiche cette même structure sous forme de grille simple et modifiable,
utile lorsque vous saisissez ou corrigez beaucoup de tâches à la fois : un simple clic sur une cellule
modifiable démarre immédiatement l'édition avec la valeur existante sélectionnée, les touches
fléchées déplacent un curseur de cellule sans l'ouvrir, **F2**/**Entrée** ouvre la cellule actuelle
pour édition, et **Tab**/**Maj+Tab** passe à la cellule suivante/précédente, puis à la ligne de tâche
suivante/précédente. L'indentation reste sur **Alt+→**/**Alt+←**. Atteindre **Entrée** ou **↓** sur la toute dernière ligne crée une nouvelle tâche sœur
directement à cet endroit, avec le curseur déjà dans sa cellule de nom, pour que vous puissiez
continuer toute une liste sans toucher la souris — cela ne fonctionne qu'en vue arborescente normale,
car avec un filtre, un tri ou un regroupement actif, la nouvelle tâche pourrait tomber directement
hors de vue ; l'application vous le demande donc d'abord au lieu de placer silencieusement une tâche
que vous ne voyez pas.

## Types de jalons

Un jalon est une tâche sans durée qui marque un moment — un début, une réception, une inspection. Open Planner Studio propose trois façons d'ajouter un jalon, toutes via le groupe de ruban **Tâches**, en utilisant la flèche à côté du bouton **Jalon** :

- **Jalon de début** — marque le début d'une phase ou du projet.
- **Jalon de fin** — marque un achèvement, par exemple une réception.
- **Point d'inspection (obligatoire)** — en pratique, un jalon de fin avec la case **Obligatoire (contractuel)** déjà cochée et son Type directement défini sur **Inspection**, de sorte qu'un moment d'inspection soit reconnaissable dès le départ comme à la fois obligatoire contractuellement et comme inspection.

Vous préférez le raccourci **Ctrl+M** ? Il vous donne un jalon générique (« Nouveau jalon ») que vous renommez et typez ensuite vous-même.

Vous retrouverez cette même répartition dans le panneau des propriétés une fois que vous sélectionnez un jalon avec la case à cocher **Jalon** activée : le champ **Type de jalon** propose **Automatique**, **Jalon de début** ou **Jalon de fin**. « Automatique » laisse le moteur de planification décider du comportement du jalon en fonction de ses relations — choisissez cette option si le jalon n'a pas de caractère de début ou de fin marqué. Séparément, il y a la case à cocher **Obligatoire (contractuel)** : elle marque un jalon comme contractuellement contraignant, indépendamment du fait qu'il s'agisse d'un jalon de début ou de fin. Cela vous permet, par exemple, de rendre aussi un jalon de début obligatoire, ou — comme avec **Point d'inspection** — de configurer en un clic un jalon de fin obligatoire.

## Codes et champs : codes d'activité et champs personnalisés

Les plannings de plus grande taille ont rapidement besoin de dimensions supplémentaires qui ne rentrent pas dans la WBS : quelle unité, quelle discipline, quel entrepreneur. C'est à cela que servent les **codes d'activité** et les **champs personnalisés**, tous deux gérés via la fenêtre **Codes et champs** (le groupe de ruban **Structure** de l'onglet **Planification**, bouton intitulé **Codes et champs**).

- Les **codes d'activité** sont des dimensions librement définissables (par exemple « Localisation » ou « Discipline ») avec une liste de valeurs — chaque valeur a un **Code**, une **Description** et une **Couleur**. Une tâche peut avoir au plus une valeur par type de code. Utilisez **Ajouter un type de code** pour démarrer une nouvelle dimension, et **Ajouter une valeur** pour constituer les valeurs possibles.
- Les **champs personnalisés** sont des champs typés de votre choix — **Texte**, **Nombre**, **Nombre entier**, **Coût**, **Date** ou **Oui/non** — qui apparaissent comme colonne dans le tableau des tâches et peuvent être renseignés par tâche. Pensez à un champ « Entrepreneur » (texte) ou « Permis reçu » (oui/non).

Une fois créés, vous attribuez un code d'activité ou remplissez un champ personnalisé via les colonnes du tableau des tâches (rendez-les d'abord visibles via **Affichage → Colonnes…** si nécessaire) ou via le panneau des propriétés de la tâche.

### Grouper par codes et champs

Les codes d'activité et les champs personnalisés deviennent vraiment payants une fois que vous groupez par leur biais : allez sur l'onglet du ruban **Affichage**, ouvrez **Grouper** et choisissez le code d'activité ou le champ personnalisé selon lequel regrouper sous **Champ**. Le tableau des tâches affiche alors des en-têtes de groupe au lieu de l'arborescence WBS — pratique pour voir, par exemple, toutes les tâches par unité ou par discipline regroupées, indépendamment du phasage. Vous pouvez configurer jusqu'à deux niveaux de regroupement à la fois (par exemple d'abord par unité, puis par discipline).

## Notes : une liste de contrôle par tâche

Chaque tâche dispose d'une section **Notes** dans le panneau des propriétés — essentiellement une petite liste de contrôle qui reste attachée à la tâche. Elle est destinée au type d'éléments d'action ponctuels qui ne rentrent pas dans une date de planning : « encore à vérifier avec l'entrepreneur », « encore à commander comme matériau », « en attente du plan v2 ».

1. Cliquez sur **+ Ajouter une note**. Une nouvelle ligne vide apparaît avec le focus dans le champ de texte.
2. Tapez le texte de la note.
3. Cochez la case une fois l'élément traité — le texte est alors barré, mais la note reste visible (marquée comme terminée plutôt que supprimée) afin que l'historique d'une tâche reste lisible.
4. Utilisez l'icône de corbeille pour supprimer définitivement une note.

Les notes sont purement informatives : elles n'affectent ni le planning ni le calcul, elles constituent donc l'outil adapté pour les remarques qui ne peuvent pas s'exprimer sous forme de date ou de durée. Voyez un mélange de notes ouvertes et terminées en pratique dans l'exemple de taille moyenne « Nieuwbouw 6 Rijwoningen De Akkers » (étiquette *aantekeningen*/notes dans **Fichier → Exemples**).

## Poursuivre la lecture

- Voyez cette structure — phasage, tâches récapitulatives, jalons — en pratique dans [Verbouwing & Aanbouw Eengezinswoning](examples://showcase-verbouwing-eengezinswoning.ifc).
- Maintenant que la structure est en place, l'étape suivante consiste à lier les tâches entre elles : lisez le guide [Relations & contraintes](docs://gids-relaties-constraints).
- Encore nouveau sur Open Planner Studio ? Commencez par le guide [Démarrage rapide](docs://quick-start) pour un exercice continu depuis un projet vide jusqu'à un planning calculé.

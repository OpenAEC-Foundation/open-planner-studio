# Ressources, histogramme & nivellement

Une tâche vous dit quand quelque chose doit se produire ; une ressource vous dit qui ou quoi va le faire — et combien en est disponible un jour donné. Dès que vous affectez des ressources à des tâches, un jour peut demander plus qu'il n'y a de capacité disponible : une surallocation. Ce guide montre comment gérer et affecter des ressources, comment lire la charge dans l'histogramme, et comment (et quand *ne pas*) le nivellement résout une surallocation.

## Ce que vous allez apprendre ici

- Les cinq types de ressources et quand utiliser chacun.
- Affecter des ressources à des tâches — via le panneau des propriétés, la boîte de dialogue de tâche ou le ruban.
- Unités par jour et les six courbes de répartition : quand choisir laquelle.
- Déplacer une affectation vers une autre tâche.
- Calendriers de ressources et capacité échelonnée dans le temps (par exemple une deuxième grue ajoutée plus tard).
- Lire l'histogramme : le sélecteur de ressource, l'exploration par ressource, repérer la surallocation.
- Le panneau de ressources ancré à côté du Gantt.
- Le nivellement : les options de la fenêtre **Niveler les ressources**, la différence entre rester dans la marge et laisser la date de fin se décaler, et les priorités (y compris la priorité 1000 = « ne pas niveler »).
- La leçon honnête : quand le nivellement ne résout *pas* une surallocation.

Suivez [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) (taille moyenne, une surallocation délibérée et résoluble par nivellement chez les plâtriers) et [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc) (grand, presque toutes les ressources surchargées car trois tours ont besoin des mêmes équipes et de la même grue à tour en même temps — le cas d'usage où le nivellement atteint ses limites).

## Les cinq types de ressources

Chaque ressource a un **Type** (une colonne dans le panneau des ressources) :

- **Main-d'œuvre (LABOR)** — les corps de métier : maçons, plâtriers, installateurs.
- **Matériel (EQUIPMENT)** — machines et équipements : une grue à tour, un monte-charge de chantier.
- **Matériau (MATERIAL)** — des consommables avec une **Unité** (par exemple m³ de béton). Le matériau n'est jamais nivelé et n'est jamais compté dans l'histogramme — c'est un stock, pas une capacité journalière susceptible de déborder.
- **Sous-traitant (SUBCONTRACTOR)** — une entreprise externe avec son propre plafond de capacité, par exemple un façadier qui ne peut mobiliser que deux équipes à la fois.
- **Équipe (CREW)** — un groupe fédérateur. D'autres ressources peuvent rejoindre une équipe via la colonne **Équipe** du panneau pour le regroupement/l'aperçu ; ceci est purement informatif — il n'y a pas de cumul automatique de capacité vers l'équipe.

## Gérer les ressources

Ouvrez le panneau des ressources via le groupe de ruban **Gérer** de l'onglet **Ressources** : le bouton **Ressources** ouvre le panneau complet (une vue plein panneau distincte, comme Tableau ou Relations), **Nouvelle ressource** ajoute directement une ligne. Dans le panneau, vous modifiez, par ressource : **Nom**, **Type**, **Unités max.** (capacité par jour ouvré — 1 = une personne/un élément à temps plein, 2 = deux unités à la fois), **Calendrier**, **Tarif/heure**, **Unité** (matériau uniquement) et **Équipe** (à quelle équipe cette ressource appartient). En bas, la colonne **Total** additionne le coût de chaque ressource (unités chargées × heures/jour × tarif), recalculé à chaque F5.

### Capacité échelonnée dans le temps

À côté de **Unités max.** se trouve une flèche qui déplie une sous-ligne **Capacité échelonnée dans le temps** : vous y ajoutez des étapes (une date **À partir de** + **Unités max.**) pour une capacité qui change au cours du projet. Le grand exemple utilise cela pour la grue à tour : elle est à **Unités max. 1**, avec une étape qui porte la capacité à **2** **à partir du jour 130** — le moment où une deuxième grue est ajoutée. Avant cette date, les trois tours doivent se partager une seule grue ; après, deux tours peuvent lever en même temps.

## Affecter des ressources

Il existe trois endroits où vous gérez une affectation — ils agissent sur les mêmes données sous-jacentes, donc tout ce que vous faites dans l'un apparaît immédiatement dans les autres :

1. **Panneau des propriétés** — la section **Affectations** sous une tâche sélectionnée : une liste déroulante pour **Affecter une ressource** avec les ressources non encore affectées, et pour chaque affectation existante les **unités/j**, la **courbe** et un bouton pour la supprimer.
2. **Boîte de dialogue de tâche** — la même section **Affectations**, dans la fenêtre **Modifier la tâche**.
3. **Ruban** — onglet **Ressources**, groupe de ruban **Affectation**, le bouton **Affecter ▾**. Ce bouton n'est actif que lorsque exactement une tâche non-jalon et non-récapitulative est sélectionnée ; la liste déroulante vous permet de définir d'abord **unités/j** et **courbe**, puis liste en dessous les ressources non encore affectées — cliquez sur un nom pour terminer une affectation en une seule fois.

Les jalons et les tâches récapitulatives ne peuvent pas porter de ressources (ils n'ont pas de durée propre à charger) — les deux emplacements affichent une explication à la place du formulaire d'affectation.

### Déplacer une affectation

Vous avez affecté une ressource à la mauvaise tâche par erreur, ou vous déplacez du travail d'une tâche à une autre ? Dans la section **Affectations** du panneau des propriétés (ou la boîte de dialogue de tâche), chaque affectation dispose d'une liste déroulante **Déplacer vers…** listant les tâches candidates (les tâches feuilles sans cette ressource, à l'exclusion de la tâche actuelle). En choisir une déplace l'affectation en une seule étape, y compris ses unités et sa courbe — pas besoin de la supprimer puis de la recréer.

## Unités et courbes de répartition

Chaque affectation a des **unités/j** (1 = une personne/un élément à temps plein, 0,5 = une demi-journée) et une **courbe** qui détermine comment cette charge est répartie sur la durée de la tâche :

- **Uniforme** — plat, la même quantité chaque jour. La valeur par défaut, et le bon point de départ pour la plupart des tâches.
- **Chargé en début (FRONT_LOADED)** — la majeure partie du travail tôt dans la tâche, en diminuant vers la fin.
- **Chargé en fin (BACK_LOADED)** — l'image miroir : montée en puissance vers la fin, par exemple une tâche qui doit prendre de l'élan.
- **En cloche (BELL)** — faible au début et à la fin, avec un pic au milieu — une tâche qui monte en puissance, tourne à plein régime puis redescend.
- **Pic précoce (EARLY_PEAK)** — le pic se situe tôt dans la tâche, puis la charge diminue.
- **Pic tardif (LATE_PEAK)** — le pic se situe tard dans la tâche.

La variation de courbe se voit le plus clairement dans l'histogramme : la même tâche avec les mêmes unités/j produit une forme de barre très différente avec une courbe en cloche qu'avec une courbe uniforme. Le cas d'usage de taille moyenne mélange délibérément uniforme/chargé en début/chargé en fin sur les tâches de finition par maison, afin que vous puissiez comparer la différence.

## Calendriers de ressources

Une ressource peut se trouver sur le **Calendrier du projet** (par défaut) ou sur son propre calendrier — par exemple pour un sous-traitant disponible seulement quatre jours par semaine. Configurez cela via la colonne **Calendrier** du panneau des ressources, ou le champ **Calendrier** sur la ressource elle-même. Un calendrier de ressource ne touche jamais aux dates CPM d'une tâche (celles-ci continuent de fonctionner sur le calendrier de la tâche/du projet) — il n'affecte que la **charge** et le **nivellement** : si une ressource ne travaille pas un jour dont la tâche a besoin, cela compte comme un déficit dans l'histogramme, et le niveleur avertit qu'un décalage ne résoudra pas ce désaccord de calendrier. Voir le guide [Calendriers & planification horaire](docs://gids-kalenders-uren) pour l'explication complète des calendriers.

## Lire l'histogramme

Activez l'histogramme via le groupe de ruban **Histogramme** de l'onglet **Ressources** (le bouton **Histogramme**). Une bande apparaît sous le Gantt sur le même axe temporel : des barres par jour, avec la partie au-dessus de la ligne de capacité affichée en rouge.

À gauche des barres, au-dessus de la colonne du tableau des tâches, se trouve le **sélecteur de ressource** : une liste avec « Toutes les ressources » en haut et chaque ressource en dessous, chacune avec un point rouge si cette ressource est surallouée quelque part. Cliquez sur un nom pour zoomer sur cette ressource unique — l'histogramme se redimensionne sur sa seule charge et capacité. Cliquez de nouveau sur « Toutes les ressources » pour revoir la somme de toutes les ressources. Outre le clic, vous pouvez aussi parcourir les ressources avec les boutons **Précédente**/**Suivante** du groupe de ruban **Histogramme**, sans toucher au sélecteur lui-même.

Cliquez sur une barre surchargée et une infobulle indique combien de tâches contribuent à la charge ce jour-là, avec les premiers noms de tâches — pratique pour voir rapidement quelle combinaison de tâches cause la surallocation sans vérifier chaque affectation à la main.

Si vous voyez « Recalculer (F5) pour afficher la charge » au lieu de barres, le planning n'a pas été (re)calculé depuis la dernière modification — l'histogramme, comme le chemin critique, est un instantané que vous actualisez vous-même.

## Le panneau de ressources ancré

Outre le panneau de ressources complet (bouton de ruban **Ressources**), il existe une variante compacte que vous pouvez ancrer à droite : le bouton **Ancrer** dans le groupe de ruban **Gérer**. Ce panneau ancré affiche uniquement le nom, les **Unités max.** (modifiables directement) et un point rouge/vert pour la surallocation — un aperçu rapide à côté de votre Gantt sans ouvrir le panneau complet. Le panneau de ressources ancré et le panneau des propriétés d'une tâche s'excluent mutuellement — vous n'en verrez qu'un seul à la fois dans le rail de droite.

## Repérer la surallocation

Une ressource est surchargée un jour dès que la somme des unités de toutes ses affectations ce jour-là dépasse ses **Unités max.**. Vous verrez cela à trois endroits : la portion rouge de la barre dans l'histogramme, le point rouge dans le sélecteur de ressource et le panneau ancré, et le compteur **Surallocation** dans le groupe de ruban de l'onglet Ressources (« N ressources » avec une icône d'avertissement, ou « Aucune »).

Le cas d'usage de taille moyenne rend cela visible délibérément : début juin, les **Stukadoors** (plâtriers, unités max. 2) reçoivent une affectation de 2 unités sur trois maisons à la fois (le plâtrage des maisons 1, 2 et 3 se chevauche là pendant quelques jours) — 6 unités combinées au pic, bien au-delà de la capacité de 2.

## Nivellement

Ouvrez la fenêtre **Niveler les ressources** via le bouton **Niveler…** dans le groupe de ruban **Nivellement** de l'onglet Ressources. La fenêtre nécessite un calcul valide et à jour (recalculez d'abord avec F5 si le planning est obsolète) et fonctionne en deux étapes : **Calculer** d'abord pour une proposition, puis **Appliquer** — rien ne change dans votre planning avant que vous n'ayez vu la proposition.

Dans la fenêtre, vous choisissez :

- **Ressources** — quelles ressources participent au nivellement (toutes par défaut ; le matériau est toujours exclu — il n'est jamais nivelé).
- **Niveler uniquement dans la marge (lissage)** — une case à cocher avec un sous-titre explicite : « la date de fin de projet reste fixe ». Désactivée (**nivellement**), le niveleur peut décaler les tâches autant que nécessaire, même au-delà de leur propre marge, ce qui peut repousser la date de fin de projet. Activée (**lissage**), la date de fin est sacrée — le niveleur ne décale que dans la marge existante de chaque tâche, et un conflit qui n'y tient pas reste signalé comme conflit restant.

Après **Calculer**, la fenêtre affiche un tableau avec chaque tâche dont le début change (ancien début → nouveau début → jours de décalage), une ligne indiquant si la date de fin de projet change, et — s'il reste des conflits — une section **Conflits restants** avec, par tâche, la raison : un désaccord de calendrier (la ressource ne travaille pas les jours dont la tâche a besoin), une capacité libre insuffisante dans la marge, ou un dépassement intrinsèque (une seule affectation demande déjà à son pic plus que ce que la ressource pourrait jamais fournir — aucun décalage ne résout cela). Ce n'est qu'une fois satisfait de la proposition que vous cliquez sur **Appliquer**.

Essayez cela vous-même sur la surallocation des plâtriers dans le cas d'usage de taille moyenne : ouvrez **Nieuwbouw 6 Rijwoningen De Akkers**, allez sur l'onglet **Ressources** et ouvrez **Niveler les ressources**. Laissez toutes les ressources cochées, laissez le lissage désactivé et cliquez sur **Calculer** : les conflits disparaissent complètement (0 conflit restant), mais la date de fin de projet se décale d'environ une semaine. Puis cochez **Niveler uniquement dans la marge** et calculez à nouveau : la date de fin reste maintenant inchangée, mais une tâche (le plâtrage dans l'une des maisons) reste signalée comme conflit — il n'y a tout simplement pas assez de marge pour la faire tenir entièrement dans le planning existant. C'est exactement l'arbitrage que cette case à cocher rend visible : résolvez-vous le problème en laissant filer la date de fin, ou gardez-vous la date de fin fixe et acceptez-vous un conflit restant signalé ?

### Priorités

Chaque tâche a une **priorité de nivellement** de 0 à 1000 (500 par défaut). Cliquez avec le bouton droit sur une tâche et choisissez **Priorité** pour trois préréglages : **Basse** (100), **Normale** (500) et **Haute** (900) — en cas de conflit de capacité entre deux tâches, celle avec la priorité la plus élevée obtient en premier la capacité rare. La valeur **1000** est un cas particulier : « ne pas niveler » (MS Project appelle cela « Do Not Level »). Une telle tâche continue de passer par la boucle de nivellement et suit ses propres prédécesseurs, éventuellement décalés, mais n'est elle-même jamais décalée pour libérer de la capacité. Le grand exemple utilise cela sur « Nutsaansluitingen aanleggen » (installation des raccordements aux réseaux) : une date de raccordement fixe imposée par le fournisseur d'énergie qui ne doit pas bouger, quoi que propose par ailleurs le nivellement.

**Effacer le nivellement** (dans le groupe de ruban **Nivellement**) supprime en une fois tous les décalages précédemment appliqués — pratique pour revenir au planning d'origine, non nivelé, sans réinitialiser chaque tâche à la main.

## La leçon honnête : quand le nivellement n'aide pas

Le nivellement résout une surallocation en réorganisant le travail dans le temps — dans la marge, ou, si nécessaire, avec une date de fin plus tardive. Cela fonctionne bien tant qu'il y a assez de place (marge ou temps) quelque part dans le planning pour redistribuer la demande excédentaire. Cela ne fonctionne fondamentalement *pas* lorsque la demande est structurellement supérieure à ce qui sera jamais disponible, quelle que soit la façon dont vous décalez les choses.

Le grand exemple montre cela sur plusieurs ressources à la fois : parce que les trois tours s'exécutent largement en parallèle et partagent les mêmes équipes (maçons, installateurs, plâtriers, carreleurs, la grue à tour), presque toutes les ressources de main-d'œuvre sont surchargées à un moment ou à un autre. Nivelez avec toutes les ressources sélectionnées et la date de fin libre, et la plupart des conflits disparaissent — mais la date de fin de projet glisse de plusieurs mois, et une poignée de tâches de finition par tour (carrelage, cuisines, sanitaire, peinture) restent comme dépassement intrinsèque : la charge de pic d'une seule affectation y dépasse déjà la capacité, donc aucun décalage n'aide. Activez le lissage pour protéger la date de fin, et une part bien plus grande des conflits reste tout simplement non résolue.

La leçon n'est pas que le nivellement « ne fonctionne pas » — l'algorithme fait exactement ce qu'on lui demande. La leçon est que le nivellement est un outil de **planification**, pas un outil de **capacité** : il réorganise le travail existant dans le temps existant, mais il ne crée pas de corps de métier, d'équipement ou de jours calendaires supplémentaires. Une pénurie structurelle — trop peu de plâtriers pour trois tours à la fois, une seule grue à tour desservant trois chantiers — appelle une solution différente : embaucher plus de capacité, ajuster le phasage (les tours l'une après l'autre au lieu d'en parallèle, ce que l'étape de la deuxième grue à partir du jour 130 fait déjà en partie), ou répartir le travail différemment. Le nivellement est l'outil qui vous montre où ça coince ; il ne résout pas pour vous la question sous-jacente de capacité.

## Poursuivre la lecture

- Rejouez vous-même le nivellement de la surallocation des plâtriers dans [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc).
- Voyez les limites du nivellement en pratique — ainsi que les cinq types de ressources, les six courbes et la capacité échelonnée dans le temps de la grue à tour — dans [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc).
- Les ressources fonctionnent sur des calendriers — lisez le guide [Calendriers & planification horaire](docs://gids-kalenders-uren) pour les calendriers de ressources et la planification horaire.
- Vous voulez définir une baseline avant de commencer le nivellement, pour pouvoir voir la différence ? Lisez le guide [Baselines & avancement](docs://gids-baselines-voortgang).
- Le nivellement peut changer quelles tâches sont critiques — lisez le guide [Chemin critique & analyse avancée](docs://gids-kritiek-pad-analyse) pour savoir comment le repérer.

# Le ruban, onglet par onglet

Le ruban en haut de l'écran comporte des onglets. Chaque onglet contient des groupes de boutons. Cet article indique, pour chaque bouton, ce qu'il fait et où vous voyez le résultat. Comment réaliser une action pas à pas est expliqué dans les guides pratiques ; ici, vous cherchez ce qu'est un bouton. Un bouton qui n'existe ou ne fonctionne que sous une condition affiche cette condition à côté de lui.

## Comportement du ruban

- **Onglets** — *Fichier* est à gauche, puis *Accueil*, *Planification*, *Ressources*, *Affichage*, *Paramètres*, *Tableau*, *IFC*, *Rapport* et, seulement si le mode IA est activé, *IA*.
- **Fenêtre étroite** — quand le ruban ne tient pas, les boutons se réduisent à une icône, de droite à gauche. Le nom s'affiche alors dans l'info-bulle du bouton. Chaque bouton sans info-bulle propre affiche son nom.
- **Réduire le ruban** — la petite flèche en bas à droite du ruban le transforme en bande plate, avec des icônes seulement. Les groupes *Références et avancement* et *Connexion* de l'onglet IA disparaissent alors derrière un seul bouton avec une fenêtre contextuelle. Par défaut : développé. Votre choix est mémorisé.
- **Boutons d'extension** — une extension peut ajouter son propre groupe à la fin d'un onglet. Ce bouton exécute la fonction que l'extension lui a donnée.

## Fichier

Un clic sur *Fichier* ouvre un écran propre (le Backstage) qui remplace l'espace de travail. Cet écran n'a pas de ruban. *Retour* le ferme. Si vous avez modifié quelque chose sous *Paramètres du projet* sans l'appliquer, l'application demande d'abord quoi en faire.

- **Nouveau** — ouvre la fenêtre *Nouveau projet* et ferme le Backstage. Les champs se trouvent dans [Nouveau projet et Paramètres du projet](docs://ref-projectinfo).
- **Ouvrir** — choisit un fichier et l'ouvre comme document. Ferme le Backstage.
- **Récents** — liste des projets récemment ouverts ; un clic en ouvre un. Visible seulement quand l'environnement peut rouvrir des fichiers : dans l'application de bureau et dans les navigateurs qui offrent l'accès aux fichiers, comme Chrome et Edge. Dans les autres navigateurs, le bouton est présent, mais la page reste vide.
- **Exemples** — plannings d'exemple fournis, répartis en *Plannings de démonstration complets* (badge *Toutes les fonctionnalités*) et *Exemples simples*. Un clic en ouvre un dans un nouvel onglet.
- **Enregistrer** — écrit le projet dans le fichier de ce document. Si le document n'a pas encore de fichier, vous choisissez d'abord un nom et un emplacement. Un fichier ouvert dans un autre format qu'IFC n'est jamais écrasé ; *Enregistrer* demande alors un nom et un emplacement pour un fichier IFC.
- **Enregistrer sous** — choisit un nouveau nom ou un nouvel emplacement et enregistre là au format IFC.
- **Exporter** — cartes par format d'export, avec une description. Un clic convertit le projet et l'enregistre, puis vous ramène à *Accueil*. Si le planning contient un cycle, l'erreur s'affiche dans le Backstage et vous restez sur cet écran. Si le projet est lié à une bibliothèque de ressources, la case *Enregistrer aussi le fichier de bibliothèque* apparaît en dessous ; elle ne fonctionne que pour la carte IFC.
- **Importer** — en haut, la carte *Mettre à jour l'avancement depuis une feuille* (inactive sans tâches) ; en dessous, les importateurs que les extensions ajoutent.
- **Imprimer** — le bouton *Ouvrir l'aperçu avant impression* vous mène à l'onglet *Rapport*.
- **Paramètres du projet** — les métadonnées et le profil de calcul de ce projet. Les modifications ne prennent effet qu'après *Appliquer*. Voir [Nouveau projet et Paramètres du projet](docs://ref-projectinfo) et [Profils de calcul et conventions](docs://uitleg-rekenprofielen).
- **Paramètres de l'app** — les mêmes paramètres que dans la fenêtre *Paramètres de l'app*.
- **Extensions** — gestion et installation des extensions ; voir [Installer et gérer une extension](docs://howto-extensie-installeren).
- **Bibliothèque** — gestion des bibliothèques de ressources ; voir [Gérer et partager des bibliothèques de ressources](docs://howto-bibliotheken-beheren).
- **Aide** — la documentation intégrée, aussi avec F1. Le champ de recherche cherche dans les titres, les intertitres et le texte lui-même. Les articles sont répartis en quatre sections : *Tutoriels*, *Guides pratiques*, *Explications* et *Référence*. Sous *Langue de la documentation*, vous choisissez *Suivre la langue de l'application* ou une langue de la liste. Le néerlandais et l'anglais sont les langues sources ; les autres langues ont seulement les articles déjà traduits. Si un article manque dans votre langue, vous lisez la version anglaise, avec un avertissement. Ce choix est conservé sur cet appareil, séparément de la langue de l'application. Vous pouvez aussi ouvrir l'aide depuis une fenêtre ou un panneau : beaucoup de fenêtres et les panneaux *Propriétés*, *Ressources* et *Avertissements* ont un point d'interrogation en haut à droite (*Aide sur ce sujet*), qui ouvre l'aide sur l'article consacré à cette fenêtre ou à ce panneau. Si vous avez saisi quelque chose dans la fenêtre sans l'enregistrer, l'application demande d'abord *Enregistrer*, *Annuler* (abandonner votre saisie) ou *Retour* (rester dans la fenêtre) ; ensuite la fenêtre se ferme et l'aide s'ouvre. Quelques fenêtres, comme *Modifier la tâche* et *Niveler les ressources*, demandent toujours. Sans saisie, l'aide s'ouvre directement.
- **Démarrer la visite guidée** — ferme le Backstage et lance la visite à l'étape 1.
- **Fermer le projet** — ferme le document actif. S'il contient des modifications non enregistrées, l'application demande une confirmation.

## Accueil

### Accueil › Fichier

- **Nouveau**, **Enregistrer**, **Ouvrir** et **Enregistrer sous** — les mêmes actions que dans *Fichier*.
- **Récents** — menu déroulant avec les projets récents ; un clic en ouvre un. Visible seulement dans les mêmes conditions que *Fichier › Récents*. Sans fichier récent, il affiche *Aucun fichier récent*.
- **Exporter** — menu déroulant avec les formats d'export (noms courts). Un clic convertit le projet et l'enregistre.

### Accueil › Édition

- **Annuler** — annule la dernière modification. Inactif quand il n'y a rien à annuler.
- **Rétablir** — rétablit la dernière modification annulée. Inactif quand il n'y a rien à rétablir.
- **Supprimer** — supprime les tâches sélectionnées, avec leurs sous-tâches, en une seule étape. Inactif sans sélection.

### Accueil › Tâches

- **Tâche** — ajoute une tâche nommée *Nouvelle tâche*, d'une durée de 5 jours ouvrés, qui commence au début du projet. (Si *Activer la planification horaire* est activé et que l'*Unité par défaut des nouvelles tâches* dans *Paramètres du projet* est en heures, la durée est de 5 heures.) Si une tâche est sélectionnée et que la vue est l'arborescence simple, la nouvelle tâche se place directement sous la tâche sélectionnée la plus basse (info-bulle *Nouvelle tâche juste en dessous de la sélection*). Sans sélection, elle va en bas (info-bulle *Nouvelle tâche en bas de la liste*). Avec une sélection mais pendant un filtrage, un regroupement ou un tri, elle va aussi en bas. Une notification rouge indique alors que l'application ne peut pas la placer sous votre sélection, avec le bouton *Effacer*. La nouvelle tâche devient la seule sélection, le Gantt se place sur elle, et son nom peut être remplacé directement dans le panneau *Propriétés*.
- **Jalon ▾** — menu déroulant qui place un jalon (durée 0) au même endroit que *Tâche*. *Jalon de début* et *Jalon de fin* définissent le type de jalon ; le nouveau jalon se nomme *Nouveau jalon* et reçoit la catégorie de travaux *Autre*. *Point d’inspection (obligatoire)* crée un jalon de fin avec la catégorie de travaux *Inspection* et l'indicateur *Obligatoire (contractuel)*, nommé *Nouveau point d’inspection*.
- **Lier ▾** — menu déroulant avec quatre actions fixes ; le bouton principal ne change jamais de sens. Voir *Planification › Relations* pour les quatre actions.
- **Fractionner la tâche** — active ou désactive le mode fractionnement. Actif : une bande sous le ruban explique qu'il faut cliquer sur une barre à l'endroit où la coupure commence, puis glisser vers la droite sur sa longueur. Inactif quand le Gantt n'est pas visible (sur les onglets *Tableau*, *IFC* et *Rapport*, et quand le panneau des ressources occupe tout l'espace de travail) ; l'info-bulle affiche alors *Disponible uniquement lorsque le diagramme de Gantt est visible*. Voir [Fractionner une tâche](docs://howto-taak-splitsen).

### Accueil › Planning

- **Calculer** — calcule le planning : dates, marges, chemin critique et charge des ressources. Cela n'arrive jamais seul, sauf si vous activez *Calculer automatiquement* (*Paramètres de l'app*, onglet *Planification*, rubrique *Calcul*). Tant que le planning n'est pas à jour, la barre d'état affiche *Obsolète — recalculer (F5)*.

### Accueil › Zoom

- **Zoom +** — agrandit l'axe du temps de 10 pixels par jour.
- **Zoom -** — réduit l'axe du temps de 10 pixels par jour.

## Planification

### Planification › Planning

Le bouton *Calculer* est le même que dans *Accueil*.

- **Déplacer le projet…** — ouvre la fenêtre *Déplacer le projet*. Inactif sans date de début du projet. Voir [Déplacer un projet](docs://howto-project-verplaatsen).
- **Avertissements** — affiche ou masque le panneau *Avertissements* dans la colonne de droite. Le bouton s'allume tant que vous voyez le panneau. L'activer élargit une colonne réduite. Ce qu'il contient est décrit dans [Notifications et avertissements](docs://ref-meldingen).

### Planification › Relations

Le groupe contient le bouton *Lier ▾* avec quatre actions, et le bouton *Fractionner la tâche* (le même que dans *Accueil*). Les quatre actions :

- **Dessiner une relation** — active ou désactive le mode de création de relation ; une coche apparaît quand il est actif, et le bouton principal s'allume. Actif : vous faites glisser une barre vers une autre dans le Gantt pour créer une relation, et une bande sous le ruban indique comment arrêter (*Arrêter* ou Échap). Inactif quand le Gantt n'est pas visible.
- **Lier les tâches sélectionnées** — crée une relation fin-début sans décalage entre deux tâches ; la tâche sélectionnée en premier devient le prédécesseur. Disponible seulement avec exactement deux tâches sélectionnées (sinon *Sélectionnez exactement deux tâches*). Une relation en double ou un cycle est refusé, avec un message.
- **Ajouter une relation externe…** — ouvre une fenêtre pour ajouter un prédécesseur ou un successeur externe à la tâche sélectionnée. Disponible seulement avec exactement une tâche sélectionnée (sinon *Sélectionnez exactement une tâche*).
- **Actualiser toutes les relations externes** — actualise les points d'ancrage de toutes les relations externes et indique dans le menu combien ont été mises à jour ou sont introuvables. Disponible seulement quand le projet contient des relations externes (sinon *Ce projet ne contient aucune relation externe*).

Pour comprendre les relations, voir [Créer des relations](docs://howto-relaties-leggen) et [Relations et décalage](docs://uitleg-relaties).

### Planification › Traçage du chemin

- **Prédécesseurs** — met en évidence dans le Gantt les prédécesseurs des tâches sélectionnées, chaîne par chaîne.
- **Successeurs** — met en évidence les successeurs des tâches sélectionnées.

Vous pouvez activer les deux à la fois ; un deuxième clic sur un bouton désactive ce côté à nouveau. Les relations déterminantes reçoivent une teinte plus forte. Voir [Tracer un chemin](docs://howto-pad-traceren).

### Planification › Calendrier

- **Calendrier** — ouvre la fenêtre *Calendriers* avec la bibliothèque de calendriers du projet. Voir [Fenêtres des calendriers](docs://ref-kalenders).

### Planification › Structure

- **Codes et champs** — ouvre la fenêtre *Codes et champs* pour les codes d'activité et les champs personnalisés. Voir [Codes et champs personnalisés](docs://howto-codes-en-velden).
- **WBS auto** — active ou désactive la numérotation automatique des codes WBS. Par défaut : activé dans un nouveau projet. Dans un fichier ouvert sans ce réglage : activé si le fichier est vide ou si tous les codes correspondent déjà à la numérotation de l'arborescence, sinon désactivé. Activé : toute l'arborescence est renumérotée d'un coup, les codes suivent ensuite chaque changement de structure, et le champ *Code WBS* dans le panneau et dans la fenêtre est désactivé.
- **Renuméroter le WBS** — renumérote une fois les codes WBS, selon la position dans l'arborescence (1.2.3). Inactif tant que *WBS auto* est activé.
- **Modèles** — menu déroulant avec les modèles WBS enregistrés, chacun avec son nombre de tâches et de relations. Un clic insère le modèle sous la tâche sélectionnée, ou au niveau supérieur sans sélection. L'icône de corbeille supprime un modèle. Sans modèles, il indique comment en enregistrer un (clic droit sur une tâche récapitulative, *Enregistrer la branche comme modèle*). Voir [Enregistrer et insérer des modèles WBS](docs://howto-wbs-sjablonen).
- **Mettre en retrait** — fait des tâches sélectionnées des sous-tâches de la tâche qui les précède. Inactif sans sélection et dès que vous filtrez, regroupez ou triez ; l'info-bulle affiche alors *Non disponible pendant le filtrage/regroupement/tri*.
- **Réduire le retrait** — remonte les tâches sélectionnées d'un niveau, juste après leur tâche parente actuelle. Mêmes conditions que *Mettre en retrait*.

### Planification › Références et avancement

- **Gérer les références…** — ouvre la fenêtre des références. Voir [Enregistrer et gérer une référence](docs://howto-baseline-opslaan-en-beheren).
- **Date d'état** — la date jusqu'à laquelle vous mesurez l'avancement. Saisissez une date ; la croix (*Effacer la date d'état*) la supprime. Si le calendrier du projet contient des plages horaires de travail, l'application calcule en heures et un champ d'heure s'affiche à côté de la date (MS Project enregistre souvent 17:00). L'heure compte alors : 12:00 au lieu de 17:00 change le travail restant d'une demi-journée. Sans plages horaires de travail, l'application calcule en jours entiers et il n'y a pas de champ d'heure. Effet : l'avancement est mesuré jusqu'à cette date, et la ligne de date d'état et la ligne d'avancement du Gantt se placent dessus. Voir [Avancement, date d'état et référence](docs://uitleg-voortgang).
- **Mode d'avancement** — choix entre *Retained Logic* et *Progress Override*. Par défaut : *Retained Logic*. Effet : avec *Retained Logic*, le travail restant d'un successeur commencé suit la relation ; avec *Progress Override*, le travail restant commence à la date d'état, sans attendre le prédécesseur. Voir [Choisir le mode d'avancement](docs://howto-voortgangsmodus-kiezen).

Dans le ruban réduit, ces trois éléments se trouvent derrière un seul bouton drapeau intitulé *Références et avancement*.

### Planification › Avancement

- **Exporter la feuille d'avancement** — crée une feuille `.xlsx` avec les tâches, pour saisir l'avancement hors de l'application. Inactif sans tâches.
- **Mettre à jour l'avancement depuis une feuille** — ouvre la fenêtre d'importation pour une feuille renvoyée. Inactif sans tâches. Voir [Importer l'avancement depuis une feuille de calcul](docs://howto-voortgang-importeren).

Ce groupe se trouve aussi dans *Tableau* et *Rapport*.

## Ressources

### Ressources › Gérer

- **Ressources** — ouvre le panneau complet des ressources ; il prend tout l'espace de travail. S'allume tant que vous voyez ce panneau. Voir [Panneau des ressources](docs://ref-resourcepaneel).
- **Volet des ressources** — ancre le volet compact des ressources dans la colonne de droite, à côté du Gantt. S'allume tant que le volet est visible ; un deuxième clic le ferme. Le volet n'affiche que le nom, la couleur, un avertissement en cas de surallocation et *Unités max*, et, avec une sélection de tâches, seulement les ressources de ces tâches.
- **Nouvelle ressource** — ouvre le panneau complet des ressources avec une ligne de brouillon vide pour une nouvelle ressource. Rien n'est créé tant que vous n'entrez pas de nom ; si vous cliquez ailleurs, rien ne reste. La ressource va dans la bibliothèque de ressources ou dans le projet, selon la vue.

### Ressources › Affectation

- **Affecter ▾** — affecte une ressource à la tâche sélectionnée. Disponible seulement avec exactement une tâche sélectionnée, qui est une tâche feuille et non un jalon ; sinon le bouton est grisé. Dans le menu, vous réglez d'abord *Unités/j* (par défaut 1) et *Courbe* (par défaut *Uniforme*) ; un clic sur une ressource l'affecte avec ces valeurs. Le menu ne liste que les ressources qui ne sont pas encore sur la tâche. Voir [Affecter des ressources avec une courbe](docs://howto-resource-toewijzen).

### Ressources › Histogramme

- **Histogramme** — affiche ou masque la bande d'histogramme sous le Gantt. Par défaut : désactivé. Votre choix est mémorisé.
- **Précédent** et **Suivant** — parcourent les ressources dans le sélecteur de la bande d'histogramme, avec *Toutes les ressources* comme étape supplémentaire dans le cycle. Inactifs quand l'histogramme est désactivé ou que le projet n'a pas de ressources.

### Ressources › Nivellement

- **Niveler…** — ouvre la fenêtre *Niveler les ressources*. Voir [Nivellement](docs://uitleg-nivelleren).
- **Effacer le nivellement** — supprime les retards et les coupures que le nivellement a appliqués. Inactif quand aucune tâche n'a de résultat de nivellement.

### Ressources › Surallocation

- **Surallocation** — pas un bouton mais un compteur : le nombre de ressources avec au moins un jour en surallocation, ou *Aucune*. En rouge avec une icône d'avertissement dès qu'il y en a une. Le nombre se met à jour après *Calculer* et après les modifications des ressources et des affectations ; si vous changez les dates des tâches, il ne se met à jour qu'après *Calculer*.

## Affichage

### Affichage › Échelle de temps

- **Zoom +** et **Zoom -** — font un zoom avant ou arrière sur l'axe du temps, de 10 pixels par jour.
- **Réinitialiser** — remet le zoom à la valeur par défaut de 30 pixels par jour.
- **Ajuster au projet** — règle le zoom et le défilement pour que tout le projet soit visible.
- **Choix de l'échelle** — une liste avec *Année*, *Trimestre*, *Mois*, *Semaine*, *Jour* et, seulement lorsque *Activer la planification horaire* est activé, *Heure*. Un choix règle un zoom fixe ; la valeur affichée suit le zoom actuel, et en dessous ce zoom est affiché en pixels par jour.

### Affichage › Vue classique

- **Colonnes…**, **Filtre…**, **Grouper…** et **Trier…** — visibles uniquement lorsque *Afficher les boutons d’affichage classiques* est activé (*Paramètres de l'app*, onglet *Avancé*, rubrique *Fonctions héritées*). Par défaut : désactivé. *Colonnes…* vous mène à *Tableau* et y ouvre le sélecteur de colonnes. *Filtre…* ouvre tout de suite la fenêtre de filtre tant qu'il n'y a pas de filtre enregistré ; avec des filtres enregistrés, il ouvre un menu avec *Filtre…*, *Effacer* (seulement lorsqu'un filtre est actif) et les filtres enregistrés. *Grouper…* permet deux niveaux. *Trier…* permet davantage de niveaux. Un bouton s'allume lorsque ce réglage d'affichage est actif. Dans le ruban actuel, vous faites cela avec les boutons de disposition ; voir [Créer et utiliser une disposition](docs://howto-layouts-gebruiken).

### Affichage › Structure

- **Replier** — replie les tâches récapitulatives sélectionnées ; sans sélection, toutes. Dans une vue groupée, elle replie tous les groupes et une sélection n'a aucun effet.
- **Développer** — l'inverse.

### Affichage › Disposition

- **Boutons de disposition** — chaque disposition est un interrupteur avec une icône et un nom. *Diagramme des ressources* est inclus. Un clic active la disposition, un autre clic la désactive et rétablit la vue d'avant le clic. Des dispositions avec des parties différentes peuvent être actives ensemble. Cliquez avec le bouton droit sur une disposition : *Modifier…*, *Dupliquer* et *Supprimer* (après confirmation). Une disposition incluse ne peut être que dupliquée.
- **Nouvelle disposition** — ouvre la fenêtre de disposition pour une nouvelle disposition.

### Affichage › Présentation

- **Présentation** — active ou désactive le mode présentation (Échap pour arrêter, et dans l'application de bureau aussi F11) : seul le Gantt remplit l'écran. Voir [Présenter sur un grand écran](docs://howto-presentatie).
- **Vue partagée** — partage le Gantt en deux fenêtres temporelles qui commencent toutes deux avec votre zoom et votre position actuels (partage à 50 %), ou le ramène à une seule fenêtre. Par défaut : désactivé. Voir [Utiliser la vue partagée et la mini-carte](docs://howto-split-view-en-mini-map).
- **Mini-carte** — affiche ou masque la mini-carte. Par défaut : désactivé. Votre choix est mémorisé.

### Affichage › Panneaux

- **Propriétés** — affiche ou masque le panneau *Propriétés* dans la colonne de droite. Par défaut : activé. Voir [Fenêtre de tâche et panneau des propriétés](docs://ref-taak-eigenschappen).

Les boutons *Ressources*, *Dock ressources* et *Histogramme* sont les mêmes que sur *Ressources*, et *Avertissements* est le même que sur *Planification*.

**La colonne de droite.** La colonne à droite du Gantt est présente dès qu'au moins un des panneaux *Propriétés*, *Dock ressources* ou *Avertissements* est activé. Si aucun n'est activé, il n'y a pas de colonne. Si un panneau complet prend l'espace de travail, par exemple le panneau complet des ressources, la colonne disparaît. Seulement sur l'onglet *Tableau*, la colonne reste.

- **Largeur** — faites glisser la séparation entre l'espace de travail et la colonne. Une seule largeur s'applique à tous les panneaux de la colonne.
- **Division** — si deux panneaux sont activés, faites glisser la bordure entre eux. Si un seul est activé, ce panneau remplit toute la colonne.
- **Réduire** — le bouton *Réduire la colonne latérale* dans l'en-tête masque la colonne. Une bande étroite avec le bouton *Développer la colonne latérale* la fait réapparaître, avec les mêmes panneaux qu'avant.
- **Fermer** — chaque panneau a une croix dans son en-tête. C'est le même interrupteur que le bouton du ruban.
- **Panneau complet** — dans le dock ressources, le bouton *Panneau complet* ouvre le panneau complet des ressources.

### Affichage › Références et avancement

Ce groupe porte le même nom que celui de *Planification*, mais contient les options de dessin du Gantt.

- **Superposition de référence** — affiche la référence active sous forme de fine barre sous chaque barre de tâche. Par défaut : activé. Sans référence active, il n'y a rien à voir.
- **Ligne d'avancement** — dessine une ligne sur la date d'état qui s'écarte pour chaque tâche selon son avancement. Par défaut : activé. Sans date d'état, il n'y a rien à voir. Lorsque la ligne d'avancement est activée, cette ligne sert aussi de repère de la date d'état.
- **Ligne de date d'état** — dessine une ligne en pointillés sur la date d'état. Par défaut : activé. Vous ne la voyez que lorsque la ligne d'avancement est désactivée, car sinon la ligne d'avancement prend sa place. L'étiquette avec la date dans l'en-tête reste affichée tant qu'au moins une des deux lignes est activée. L'étiquette suit votre notation de date, par exemple 20-09-2006. Si l'application calcule en heures, la ligne et l'étiquette se trouvent à l'heure exacte, et l'étiquette affiche aussi l'heure, par exemple 20-09-2006 17:00.
- **Couleurs des barres** — choisit la manière de colorer les barres : *Chemin critique* (par défaut), *Par tâche — automatique* ou *Par catégorie*, avec un choix de champ. Si ce champ ne se trouve pas dans ce projet, le menu indique que *Catégorie de travaux* est utilisé provisoirement. Hors *Chemin critique*, un contour rouge marque le chemin critique. Ce choix s'applique aussi au rapport.
- **Accent ressource** — dessine une fine bande dans la couleur de la ressource sous chaque barre de tâche simple, répartie proportionnellement aux unités par jour. Par défaut : désactivé.
- **Bande de marge** — dessine la bande verte après une barre non critique, jusqu'à la fin au plus tard de la tâche. Par défaut : activé.
- **Lignes de relation** — affiche ou masque les lignes de relation entre les tâches. Par défaut : activé. Ce choix appartient au document et à la disposition.

## Paramètres

### Paramètres › Projet

- **Paramètres du projet** — ouvre la fenêtre *Paramètres du projet* : les métadonnées du projet et, dans le bloc *Profil de calcul et options*, la manière dont le projet calcule. Voir [Nouveau projet et Paramètres du projet](docs://ref-projectinfo).
- **Paramètres de l'app** — ouvre la fenêtre *Paramètres de l'app* avec les onglets *Apparence*, *Planification* et *Avancé*. Les mêmes paramètres se trouvent sous *Fichier › Paramètres de l'app*.

### Paramètres › Calendrier

Le bouton *Calendrier* est le même que sur *Planification*.

### Paramètres › Raccourcis clavier

- **Raccourcis clavier** — ouvre la fenêtre *Raccourcis clavier*.

## Tableau

L'onglet *Tableau* affiche les tâches sous forme de tableau complet, au lieu du Gantt. Les groupes *Fichier*, *Édition*, *Tâches*, *Planification* et *Traçage du chemin* sont les mêmes que sur *Accueil* et *Planification* et agissent sur la même sélection. Il n'y a pas de groupe *Zoom*, car le zoom ne change que l'axe du temps du Gantt. Les boutons *Fractionner la tâche* et *Tracer une relation* sont désactivés ici : il n'y a pas de Gantt.

### Tableau › Colonnes

- **Colonnes…** — ouvre le sélecteur de colonnes de ce tableau. Le même sélecteur s'ouvre avec le bouton + dans l'en-tête du tableau. L'info-bulle indique *Choisir les colonnes de la vue Tableau*. Voir [Adapter les colonnes du tableau](docs://howto-tabelkolommen-aanpassen) et [Colonnes du tableau](docs://ref-tabelkolommen).

## IFC

L'onglet affiche le panneau IFC dans l'espace de travail. Le ruban n'a pas de boutons ici, seulement la ligne de texte *IFC - Industry Foundation Classes, dans le schéma du projet (par défaut IFC 4.3 ADD2)*.

## Rapport

### Rapport › Rapport

- **Imprimer** — uniquement sur cet onglet, où il ne fait rien, car *Rapport* est déjà ouvert ; les choix de rapport se trouvent dans l'écran du rapport.

## IA

L'onglet *IA* n'existe que lorsque *Activer le mode IA* est activé (*Paramètres de l'app*, onglet *Avancé*, rubrique *Mode IA*). Par défaut : désactivé. Désactiver le mode IA supprime l'onglet et arrête le pont. Un assistant IA travaille avec votre planning par l'intermédiaire d'un pont MCP que vous démarrez ici. Voir [Connecter un assistant IA (MCP)](docs://howto-ai-assistent-koppelen).

### IA › Serveur

- **Démarrer le pont** et **Arrêter le pont** — démarrent ou arrêtent le pont MCP. À côté se trouve l'état : *Désactivé*, *Actif sur le port …*, *Port … occupé* (avec la raison) ou *Erreur*. Indisponible dans la version web ; l'info-bulle indique *Le pont ne fonctionne que dans l'application de bureau*. Le même état s'affiche sous forme de point avec *IA* dans la barre d'état.

### IA › Connexion

- **Port** — le port du pont. Par défaut : 3877. Modifiable uniquement lorsque l'état est *Désactivé* (info-bulle *Modifiable uniquement lorsque le serveur est arrêté*).
- **Jeton** — le mot de passe du pont, affiché masqué. Petits boutons *Afficher le jeton*/*Masquer le jeton*, *Copier* et *Nouveau jeton*. *Nouveau jeton* demande d'abord une confirmation, car un nouveau jeton coupe toutes les connexions existantes ; si le pont est en marche, il redémarre avec le nouveau jeton.
- **Connecter** — affiche les détails de connexion : le point de terminaison, le jeton, un extrait de configuration et une invite de connexion que vous collez dans votre agent IA.

### IA › Sécurité

- **Pause** / **Reprendre** — refuse temporairement toutes les modifications faites par l'IA ; la lecture reste permise et le pont reste actif. Le bouton s'allume en rouge pendant la pause.
- **Lecture seule** — refuse tous les outils qui modifient le planning tant que cette option est activée.
- **Sauvegarde automatique : activée** / **Sauvegarde automatique : désactivée** — écrit automatiquement une sauvegarde IFC avant la première modification par l'IA dans chaque document. Par défaut : activée.
- **Sauvegarder maintenant** — écrit tout de suite une sauvegarde et affiche le nom du fichier. Uniquement dans l'application de bureau.
- **Ouvrir le dossier des sauvegardes** — ouvre le dossier qui contient les sauvegardes. Uniquement dans l'application de bureau.

### IA › Activité

- **Panneau d'activité** — affiche ou masque le panneau *Activité IA* avec les appels au pont, avec leurs arguments et leur réponse.

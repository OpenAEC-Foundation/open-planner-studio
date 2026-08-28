# Paramètres

La fenêtre **Paramètres** contient les paramètres de l'application : des préférences qui s'appliquent à cet appareil, indépendamment du fichier de projet. Chaque modification est appliquée et enregistrée immédiatement — il n'y a pas de bouton OK. Les options de planification qui modifient le planning calculé vivent quant à elles avec le projet — voir [Informations du projet](docs://ref-projectgegevens).

## Ouverture — trois entrées, même contenu

- L'**engrenage** (⚙) dans la barre de titre.
- **Paramètres** (onglet du ruban) → groupe de ruban **Projet** → **Paramètres**.
- **Fichier** → **Paramètres** (Backstage).

Les trois affichent exactement les mêmes paramètres. Selon votre version, ils sont répartis sur trois
ou quatre onglets — un quatrième, **Application**, s'est récemment détaché de la fin du premier
onglet — mais les paramètres eux-mêmes et ce qu'ils font sont identiques dans les deux cas ; cet
article les regroupe sous **Général**, **Langue** et **Chronologie / Zoom**.

## Onglet Général

**Apparence :**

- **Thème** — **Sombre**, **Clair** ou **Contraste élevé** ; cliquez sur une carte pour changer.
- **Police** — **Par défaut**, **Système**, **Serif** ou **Monospace** ; remplace la police de l'interface. Les applications web ne suivent pas automatiquement le réglage de police du système, donc cette option et la suivante permettent de la choisir vous-même.
- **Taille du texte** — 90%, 100%, 110% ou 125% ; met à l'échelle le texte et la mise en page de l'interface.
- **Style de changement de document** — comment vous basculez entre les documents ouverts : **Onglets horizontaux**, **Onglets verticaux** ou **Pastille**.
- **Format de date** — **jj-mm-aaaa**, **mm-jj-aaaa** ou **aaaa-mm-jj**. Affichage uniquement ; les fichiers et les calculs ne sont pas affectés.
- **Mode construction** — **Activer le mode construction** fait basculer les valeurs par défaut des *nouveaux* projets entre une orientation construction (un calendrier de chantier avec les jours fériés néerlandais, les congés du bâtiment, des modèles de phasage) et une configuration neutre, indépendante de la construction. Les projets existants ne sont affectés dans aucun des deux cas.

**Application :**

- **Version** — le numéro de version de l'application (lecture seule), avec un lien **Rechercher des mises à jour** qui ouvre la fenêtre de mise à jour. L'installation des mises à jour ne fonctionne que dans l'application de bureau ; les installations Snap et AppImage se mettent à jour via leur propre canal. Séparément, la première fois que vous ouvrez l'application après qu'elle s'est mise à jour automatiquement, une boîte de dialogue ponctuelle « Vous venez d'être mis à jour » apparaît d'elle-même — le saut de version, la différence de taille de l'installateur, le nombre de jours depuis la version précédente et les notes de version GitHub, pour celles qu'elle a pu récupérer. C'est un moment différent, automatique, du lien manuel **Rechercher des mises à jour** ci-dessus.
- **Informations du projet...** — raccourci vers la fenêtre [Informations du projet](docs://ref-projectgegevens).
- **Visite guidée** — **Démarrer la visite guidée** relance la visite guidée d'introduction. Le même redémarrage se trouve aussi sur l'onglet de ruban **Affichage** → **Visite guidée** et dans le Backstage (**Fichier** → **Démarrer la visite guidée**).
- **Benchmark** — ouvre l'outil de benchmark intégré, pour mesurer les performances de calcul/rendu de cette machine.
- **Mode IA** — **Activer le mode IA** affiche l'onglet de ruban **IA** avec le pont MCP, permettant à un assistant IA de travailler avec votre planning via le Model Context Protocol ; le désactiver arrête immédiatement un pont en cours d'exécution. **Démarrer la passerelle automatiquement** (disponible uniquement avec le mode IA activé) met le pont en service dès le démarrage de l'application, sans devoir d'abord ouvrir l'onglet IA — application de bureau uniquement. Voir le guide de l'assistant IA intégré à l'application pour le tableau complet.
- **Terminal de débogage** — **Activer le terminal de débogage** affiche le panneau de journal pour le dépannage.

## Onglet Langue

- **Langue** — la langue d'affichage de l'application, appliquée immédiatement.

## Onglet Chronologie / Zoom

- **Planification horaire** — **Activer la planification horaire** active la planification à l'heure/minute près : une échelle en heures, des plages de travail et des barres précises. Désactivée, les nouvelles tâches commencent en jours et les tâches horaires existantes restent exactes. Activée, les tâches en jours et en heures peuvent coexister. Voir [Calendriers & planification horaire](docs://gids-kalenders-uren).
- **Affichage de la durée** — **Automatique (unité propre à chaque tâche)**, **Toujours en jours** ou **Toujours en heures**.
- **Barres de tâche aux interruptions** — **Ne jamais scinder**, **Scinder à la sélection** ou **Toujours scinder** : si une barre se scinde visuellement autour des jours non ouvrés.
- **Axe temporel** — **Afficher uniquement les jours ouvrables** comprime la chronologie : les week-ends et jours fériés du calendrier du projet sont ignorés, de sorte qu'une tâche de 5 jours ouvrés occupe exactement 5 colonnes, quelle que soit l'allure du calendrier entre les deux.
- **La semaine commence le** — **Lundi** ou **Dimanche** (mise en page hebdomadaire de l'échelle de temps).
- **Afficher les quarts d'heure au zoom maximal** — graduation supplémentaire au quart d'heure sur l'échelle de temps horaire.
- **Calcul** — **Calculer automatiquement** recalcule le planning dès qu'il devient obsolète, au lieu d'attendre F5.
- **Défilement & zoom** — **Mode** :
- **Zoom + glisser** (par défaut) — la molette de défilement zoome (ancrée sur le curseur) ; faites glisser l'arrière-plan du diagramme pour déplacer la vue ; Maj+molette fait défiler les lignes ; Ctrl/⌘+glisser trace un rectangle de sélection.
- **Position** — la position du curseur détermine la direction du défilement ; avec **Division de l'écran** (**Gauche/droite**, **Haut/bas** ou **Coin supérieur droit**). Ctrl+molette = zoom, Maj+molette = horizontal.
- **Touches** — attribuez quelle commande (**Défiler**, **Ctrl + molette**, **Maj + molette**) obtient quelle fonction (**Vertical**, **Horizontal**, **Zoom**) en faisant glisser les jetons ; déposer sur un emplacement occupé permute les commandes.

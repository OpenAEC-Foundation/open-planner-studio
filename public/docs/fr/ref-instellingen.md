# Paramètres

La fenêtre **Paramètres** contient les paramètres de l'application : des préférences qui s'appliquent à cet appareil, indépendamment du fichier de projet. Chaque modification est appliquée et enregistrée immédiatement — il n'y a pas de bouton OK. Les options de planification qui modifient le planning calculé vivent quant à elles avec le projet — voir [Informations du projet](docs://ref-projectgegevens).

## Ouverture — trois entrées, même contenu

- L'**engrenage** (⚙) dans la barre de titre.
- **Paramètres** (onglet du ruban) → groupe de ruban **Projet** → **Paramètres**.
- **Fichier** → **Paramètres** (Backstage).

Les trois affichent exactement les mêmes paramètres, répartis sur trois onglets : **Général**, **Langue** et **Chronologie / Zoom**.

## Onglet Général

- **Thème** — **Sombre**, **Clair** ou **Contraste élevé** ; cliquez sur une carte pour changer.
- **Style de changement de document** — comment vous basculez entre les documents ouverts : **Onglets horizontaux**, **Onglets verticaux** ou **Pastille**.
- **Format de date** — **jj-mm-aaaa**, **mm-jj-aaaa** ou **aaaa-mm-jj**. Affichage uniquement ; les fichiers et les calculs ne sont pas affectés.
- **Version** — le numéro de version de l'application (lecture seule).
- **Mises à jour** — **Rechercher des mises à jour** ouvre la fenêtre de mise à jour. L'installation des mises à jour ne fonctionne que dans l'application de bureau ; les installations Snap et AppImage se mettent à jour via leur propre canal.
- **Zoom par défaut** — le niveau de zoom par défaut (lecture seule, 30 px/jour).
- **Terminal de débogage** — **Activer le terminal de débogage** affiche le panneau de journal pour le dépannage.
- **Informations du projet...** — raccourci vers la fenêtre [Informations du projet](docs://ref-projectgegevens).
- **Visite guidée** — **Démarrer la visite guidée** relance la visite guidée d'introduction. Le même redémarrage se trouve aussi sur l'onglet de ruban **Affichage** → **Visite guidée** et dans le Backstage (**Fichier** → **Démarrer la visite guidée**).

## Onglet Langue

- **Langue** — la langue d'affichage de l'application ; quatorze langues, appliquées immédiatement.

## Onglet Chronologie / Zoom

- **Planification horaire** — **Activer la planification horaire** active la planification à l'heure/minute près : une échelle de temps en heures, des équipes avec des plages horaires de travail et des barres de tâche précises à l'heure près. Désactivé ⇒ l'application reste entièrement en granularité journalière. Avec l'interrupteur activé, **Autoriser la planification mixte jour/heure** apparaît (tâches en jours et en heures dans un même projet). Si vous ouvrez un fichier contenant une planification horaire alors que l'interrupteur est désactivé, une barre en haut propose **Activer la planification horaire**. Voir [Calendriers & planification horaire](docs://gids-kalenders-uren).
- **Affichage de la durée** — **Automatique (unité propre à chaque tâche)**, **Toujours en jours** ou **Toujours en heures**.
- **Barres de tâche aux interruptions** — **Ne jamais scinder**, **Scinder à la sélection** ou **Toujours scinder** : si une barre se scinde visuellement autour des jours non ouvrés.
- **La semaine commence le** — **Lundi** ou **Dimanche** (mise en page hebdomadaire de l'échelle de temps).
- **Afficher les quarts d'heure au zoom maximal** — graduation supplémentaire au quart d'heure sur l'échelle de temps horaire.
- **Calcul** — **Calculer automatiquement** recalcule le planning dès qu'il devient obsolète, au lieu d'attendre F5.
- **Défilement & zoom** — **Mode** :
- **Position** — la position du curseur détermine la direction du défilement ; avec **Division de l'écran** (**Gauche/droite**, **Haut/bas** ou **Coin supérieur droit**). Ctrl+molette = zoom, Maj+molette = horizontal.
- **Touches** — attribuez quelle commande (**Défiler**, **Ctrl + molette**, **Maj + molette**) obtient quelle fonction (**Vertical**, **Horizontal**, **Zoom**) en faisant glisser les jetons ; déposer sur un emplacement occupé permute les commandes.
- **Zoom + glisser** — la molette de défilement zoome (ancrée sur le curseur) ; faites glisser l'arrière-plan du diagramme pour déplacer la vue.

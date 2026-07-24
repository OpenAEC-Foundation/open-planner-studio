# Boîte de dialogue de calendrier

La fenêtre **Calendriers** gère la bibliothèque de calendriers du projet : la liste de tous les calendriers à gauche, le formulaire de modification du calendrier sélectionné à droite.

## Ouverture

- **Planification** → groupe de ruban **Calendrier** → le bouton **Calendrier** ou **Congés**.
- **Paramètres** (onglet du ruban) → groupe de ruban **Calendrier** → **Calendrier**.
- Depuis l'assistant de projet : choisir **Personnalisé…** comme calendrier ouvre cette fenêtre après la création.

## Appliquer et annuler

Toutes les modifications — y compris nouveau/dupliquer/supprimer — se font dans une copie de travail. **Appliquer** (ou **Entrée**) écrit tout d'un coup et recalcule le planning ; **Annuler**, **Échap**, la croix de fermeture ou un clic en dehors de la fenêtre abandonne toutes les modifications.

## Bibliothèque (colonne de gauche)

- **Liste** — tous les calendriers ; l'étoile marque le **Calendrier du projet** (celui par défaut pour les tâches sans calendrier propre).
- **+** — **Nouveau calendrier**.
- **Dupliquer** — copie du calendrier sélectionné.
- **Supprimer** — impossible pour le dernier calendrier ; supprimer le calendrier par défaut du projet en fait un autre le nouveau par défaut.
- **Définir comme calendrier par défaut du projet** — fait du calendrier sélectionné le calendrier du projet (bouton au-dessus du formulaire).

## Formulaire (colonne de droite)

- **Nom** — nom libre.
- **Jours ouvrés** — boutons **Lun** à **Dim** ; activé = jour ouvré. Préréglages : **Lun–ven** (semaine standard, 07–16 h, 8 h/jour) et **Continu (24/7)**.
- **Début (heure)** / **Fin (heure)** / **Heures par jour** — l'horaire de travail pour toute la journée. Masqué une fois que le calendrier a des plages horaires de travail et que la planification horaire est activée ; les plages déterminent alors les horaires.

## Horaires de travail (uniquement avec la planification horaire activée)

- **Heures/jour dérivées** — chiffre de contrôle, dérivé des plages.
- Préréglages : **Équipe de jour**, **2 équipes**, **3 équipes**, **Équipe de nuit**, **24/7** — chacun configure les plages horaires de travail en une seule fois.
- **Enregistrer comme préréglage…** — enregistrer les horaires de travail actuels comme votre propre préréglage (sur cet appareil) ; vos propres préréglages apparaissent comme boutons avec une croix de suppression.
- **Définir par jour de la semaine…** / **Afficher/masquer les horaires de travail** — ouvre ou réduit l'éditeur de plages.
- **Éditeur de plages** — par jour de la semaine, une liste de plages horaires (début–fin), chacune avec une case à cocher **jour suivant** (équipe de nuit à travers minuit), **Ajouter une plage** (un intervalle entre deux plages est une pause), **Copier sur tous les jours ouvrés**, le total d'heures par jour et les heures/jour dérivées en bas. Voir [Calendriers & planification horaire](docs://gids-kalenders-uren).

## Générer les jours fériés…

Génère la liste des jours fériés de manière automatisée sur toute la période du projet :

- **Pays** — Pays-Bas, Allemagne, Belgique, France, Royaume-Uni, Autriche, Suisse ou **Aucun jour férié**.
- **Région** — uniquement pour les pays avec des jeux régionaux ; par défaut **National**.
- **Congés du bâtiment** — Pays-Bas uniquement : **Aucun**, **Nord**, **Centre** ou **Sud** ; avec une indication que ce sont des dates indicatives.
- **Aperçu** — ligne de résumé (« n jours fériés, année–année »), extensible à la liste complète.
- **Générer** remplace la liste des jours fériés ; **Annuler** ferme le bloc.
- Si le projet s'étend désormais au-delà des années générées, une indication apparaît en haut avec un bouton **Régénérer**.

## Jours fériés

La liste elle-même : par ligne, **Description**, **Du**, **Au** et un bouton de suppression ; **Ajouter un jour férié** crée une nouvelle ligne. Les périodes de plusieurs jours (congés du bâtiment, arrêt pour gel) sont simplement une ligne avec une plage Du–Au plus longue.

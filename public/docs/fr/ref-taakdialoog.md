# Boîte de dialogue de tâche

La fenêtre **Modifier la tâche** affiche toutes les propriétés d'une tâche — les mêmes champs et sections que le panneau des propriétés à droite, mais dans une fenêtre avec une étape d'enregistrement explicite.

## Ouverture

- **Double-cliquez** sur une tâche dans le Gantt.
- **F2** avec une tâche sélectionnée.
- **Clic droit** sur une tâche → **Éditer...**

## Enregistrer et annuler

- **Enregistrer** applique toutes les modifications de champs à la fois ; le bouton est désactivé tant que le nom est vide. **Entrée** fait la même chose qu'Enregistrer (sauf dans une zone de texte multiligne).
- **Annuler**, **Échap**, la croix de fermeture ou un clic en dehors de la fenêtre ferme sans appliquer les modifications de champs.
- Exception : les sections **Dépendances**, **Affectations** et **Codes et champs** agissent directement sur le planning (identique au panneau) — les modifications y prennent effet immédiatement, même si vous annulez ensuite.

## Champs

- **Nom \*** — obligatoire ; reçoit automatiquement le focus à l'ouverture de la boîte de dialogue.
- **Code WBS** — saisie libre. Avec la numérotation automatique WBS activée (Planification → Structure), le champ est verrouillé : l'application gère les codes.
- **Description** — texte libre.
- **Type** — le type de tâche (par exemple Construction) ; détermine le code couleur de la barre.
- **Calendrier** — **Calendrier du projet** ou un calendrier spécifique de la bibliothèque ; détermine les jours ouvrés de cette tâche.
- **Tâche parente** — déplacer la tâche sous un autre parent, ou **- Aucun (racine) -**. Ce champ n'existe que dans la boîte de dialogue ; dans le panneau, la restructuration se fait par glisser-déposer ou par mise/réduction de retrait.

## Notes

Une liste de contrôle par tâche : chaque ligne a une **case à cocher terminé**, une zone de texte et un bouton de suppression ; **Ajouter une note** crée une nouvelle ligne. Les lignes terminées sont barrées. Voir [Planification & WBS](docs://gids-plannen-wbs).

## Jalon

- **Jalon** — le cocher règle la durée sur 0 et affiche le losange au lieu d'une barre.
- **Type de jalon** — **Automatique**, **Jalon de début** ou **Jalon de fin**.
- **Obligatoire (contractuel)** — marque le jalon comme contractuel.

## Temps

- **Date de début** — affiche le début au plus tôt calculé ; une modification manuelle ancre la nouvelle date comme le début planifié.
- **Durée (jours ouvrés)** — jours ouvrés entiers ; désactivé pour un jalon.
- Avec la **planification horaire activée** et un calendrier horaire sur la tâche, trois champs synchronisés apparaissent : **Jours**, **Heures** et **Heures totales** (nombres entiers uniquement). Sans calendrier horaire, une indication s'affiche : « La saisie en heures nécessite un calendrier horaire (horaires de travail). » Voir [Calendriers & planification horaire](docs://gids-kalenders-uren).

## Hammock (durée dérivée)

Uniquement sur une tâche sans sous-tâches qui n'est pas un jalon. Le cocher rend la durée dérivée : l'intervalle entre le **Driver de début** (relation FS/SS entrante) et le **Driver de fin** (relation FF/SF entrante), tous deux affichés en lecture seule. Si un driver de fin est absent, la boîte de dialogue signale que l'intervalle revient à une longueur nulle. Voir [Chemin critique & analyse avancée](docs://gids-kritiek-pad-analyse).

## Contrainte et échéance

- **Contrainte** — Dès que possible (ASAP), Le plus tard possible (ALAP), Début au plus tôt le (SNET), Début au plus tard le (SNLT), Fin au plus tôt le (FNET), Fin au plus tard le (FNLT), Doit commencer le (MSO) ou Doit finir le (MFO) ; avec une **Date de contrainte** le cas échéant.
- **Obligatoire (logique de verrouillage)** — MSO/MFO uniquement : verrouille la date de force et outrepasse la logique des relations ; une violation devient une marge négative en amont.
- **Contrainte secondaire** — une seconde borne (SNET/FNET/SNLT/FNLT) avec une **Date secondaire** ; impossible avec un verrouillage dur. Les combinaisons interdites apparaissent en rouge avec un motif.
- **Échéance** — une date cible en dehors du calcul ; la manquer donne un avertissement, pas un décalage. Voir [Relations & contraintes](docs://gids-relaties-constraints).

## Avancement

- **Avancement (%)** — curseur de 0 à 100 %.
- **Début réel** / **Fin réelle** — faits enregistrés ; pour un jalon, un seul champ **Date réelle**. Les dates postérieures à la date de statut sont rejetées.
- **Restant (jours ouvrés)** — lecture seule, dérivé de la durée × (1 − avancement). Voir [Baselines & avancement](docs://gids-baselines-voortgang).

## Résultat CPM (lecture seule)

**Début/fin au plus tôt**, **Début/fin au plus tard**, **Marge totale**, **Marge libre**, **Marge interférente** (une fois calculée) et **Chemin critique** (oui/non). Rempli après un calcul (F5).

## Dépendances

Toutes les relations de cette tâche : direction (→ successeur, ← prédécesseur), l'autre tâche, une icône d'éclair sur la **relation déterminante**, le type de relation (FS/SS/FF/SF), le **décalage** (par ex. 2d, 3ed, 50 %) et un bouton de suppression. Les modifications prennent effet immédiatement.

## Affectations

Par ressource affectée : nom, **Unités/j**, **Courbe**, **Déplacer vers…** (déplacer l'affectation vers une autre tâche) et suppression ; en bas **Affecter une ressource**. Impossible sur les jalons ou les tâches récapitulatives. Prend effet immédiatement. Voir [Ressources, histogramme & nivellement](docs://gids-resources-histogram).

## Codes et champs

Visible uniquement lorsque le projet a des types de code d'activité ou des champs personnalisés : un sélecteur de valeur par type de code, une saisie typée par champ personnalisé. Prend effet immédiatement. Les définitions se gèrent dans la boîte de dialogue de structure — voir [Codes et champs](docs://ref-codes-velden).

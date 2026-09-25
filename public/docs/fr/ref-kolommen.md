# Choisir les colonnes

La fenêtre **Colonnes** contrôle quelles colonnes l'onglet Tableau affiche, dans quel ordre et avec quelle largeur. (Le tableau des tâches à gauche du Gantt a des colonnes fixes : WBS, Nom de la tâche et Durée.)

## Ouverture

**Affichage** → groupe de ruban **Affichage** → **Colonnes…**. Chaque modification est appliquée immédiatement — il n'y a pas d'étape OK séparée ; **Fermer**, **Échap**, la croix de fermeture ou un clic en dehors de la fenêtre la ferme.

## Colonnes choisies

Une ligne par colonne, avec :

- **Poignée de glissement** — faites glisser la ligne pour modifier l'ordre des colonnes.
- **Visible** — décocher masque la colonne sans la retirer de la liste.
- **Nom** — le libellé du champ tel que le tableau l'affiche.
- **Largeur** — en pixels (minimum 40).

## Champs disponibles

Sous les colonnes choisies se trouve la liste **Champs disponibles** : tout champ qui n'est pas encore une colonne. Cliquer sur l'un d'eux l'ajoute comme colonne. Outre les champs standard, vous trouverez les champs d'analyse **Jalon**, **Marge libre**, **Marge interférente**, **Quasi critique** et **Chemin de marge**, ainsi que **Ressources** et les codes d'activité et champs personnalisés du projet. Les trois champs de marge et Chemin de marge ne reçoivent des valeurs qu'après un calcul avec les options de planification correspondantes — voir [Chemin critique & analyse avancée](docs://gids-kritiek-pad-analyse).

## Réinitialiser par défaut

**Réinitialiser par défaut** se trouve en bas du sélecteur de colonnes (le plus à droite de l'en-tête du tableau, ou l'onglet **Tableau** → **Colonnes…**). Un clic rétablit la disposition par défaut des colonnes de ce tableau : quelles colonnes sont affichées, leur ordre et leur largeur, et les colonnes épinglées. Les champs ajoutés en plus quittent le tableau et restent disponibles dans la liste. C'est aussi ainsi que vous obtenez la nouvelle disposition par défaut après une mise à jour, par exemple **Début** et **Fin** au lieu de **Début planifié** et **Fin planifiée** : une disposition personnelle enregistrée auparavant ne change pas d'elle-même. C'est une seule action, donc **Ctrl+Z** rétablit votre propre disposition. Si le tableau utilise déjà la disposition par défaut, le bouton est désactivé.

Le jeu de colonnes fait partie d'un layout enregistré — voir [Enregistrer et charger des layouts](docs://ref-layouts).

## Poursuivre la lecture

- [Filtres](docs://ref-filters) — quelles tâches le tableau et le Gantt affichent.

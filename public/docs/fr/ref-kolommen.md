# Choisir les colonnes

Le **Tableau** (onglet **Tableau**) et la liste des tâches à côté du Gantt ont chacun leurs propres colonnes. Vous les modifiez dans le tableau lui-même : le plus dans l'en-tête du tableau ouvre le sélecteur de colonnes, et dans l'en-tête d'une colonne vous déplacez, élargissez, épinglez ou supprimez une colonne. Chaque modification s'applique immédiatement ; il n'y a pas d'étape OK.

Par défaut, la liste des tâches à côté du Gantt affiche **Structure de découpage du projet (SDP)**, **Nom de tâche** et **Durée**. Le Tableau affiche en plus **Début**, **Fin**, **Type de tâche**, **Critique**, **Marge totale** et **Avancement**, ainsi que les codes d'activité et les champs personnalisés du projet.

## Ouvrir le sélecteur de colonnes

- Le plus à droite de l'en-tête du tableau. Le Tableau et la liste des tâches à côté du Gantt ont chacun leur propre plus, qui ne modifie que son propre tableau.
- L'onglet **Tableau** → **Colonnes…** ouvre le sélecteur de colonnes du Tableau.
- Si les boutons d'affichage classiques sont activés (**Paramètres** → onglet **Avancé** → **Fonctions héritées** → **Afficher les boutons d'affichage classiques**), **Affichage** → groupe de ruban **Affichage** → **Colonnes…** fait la même chose : le bouton passe à l'onglet Tableau et y ouvre le sélecteur de colonnes.

**Échap**, un clic en dehors du sélecteur ou un nouveau clic sur le plus ferme le sélecteur.

## Ajouter une colonne

Le sélecteur **Choisir une colonne** contient, de haut en bas :

- **Utilisées récemment** — les champs que vous avez ajoutés récemment avec le sélecteur. Ce bloc apparaît dès que vous avez ajouté une colonne.
- Le champ **Rechercher** — tapez une partie d'un nom de champ ; les **Résultats de recherche** proviennent de tous les groupes.
- Les champs par groupe : **Tâche**, **Planification**, **Contraintes**, **Relations**, **Ressources**, **Avancement**, **Calculé**, **Référence**, **Personnalisé** et **Technique**. Un clic sur un groupe le déplie ; le nombre à côté indique combien de champs il contient.
- En bas, le bouton **Réinitialiser par défaut** (voir plus loin).

Cliquez sur un champ pour l'ajouter comme dernière colonne ; le sélecteur se ferme alors. Un champ qui est déjà une colonne est coché et ne peut pas être choisi une seconde fois. Les codes d'activité et les champs personnalisés du projet se trouvent sous **Personnalisé**, les champs de vos références sous **Référence**.

Sous **Calculé** se trouvent entre autres les champs d'analyse **Marge libre**, **Marge d'interférence**, **Presque critique** et **Chemin de marge**. Ils ne reçoivent des valeurs qu'après un calcul (**F5**), et **Presque critique** et **Chemin de marge** seulement si l'option de planification correspondante est activée — voir [Chemin critique & analyse avancée](docs://gids-kritiek-pad-analyse).

## Modifier les colonnes dans l'en-tête

- **Déplacer** — faites glisser l'en-tête d'une colonne vers un autre emplacement. Les colonnes épinglées restent groupées au début ; une colonne non épinglée ne se déplace que parmi les colonnes non épinglées.
- **Largeur** — faites glisser le bord droit de l'en-tête d'une colonne (de 40 à 480 pixels). Un double-clic sur ce bord ajuste la colonne à son en-tête et à sa valeur la plus longue. Au clavier : placez le focus sur le bord et utilisez les flèches gauche et droite, avec **Shift** pour des pas plus grands.
- **Supprimer** — le signe moins qui apparaît dans l'en-tête de la colonne lorsque vous le survolez. Le champ reste disponible dans le sélecteur de colonnes.
- **Clic droit** sur l'en-tête d'une colonne : **Épingler** (ou **Désépingler**), **Ajuster automatiquement** et **Supprimer**. Une colonne épinglée passe au début, avec les autres colonnes épinglées, et reste visible lorsque vous faites défiler le tableau horizontalement (tant que les colonnes épinglées tiennent ensemble dans le tableau).

## Début, Fin et les dates planifiées

**Début** et **Fin** (dans la disposition par défaut du Tableau) affichent les mêmes dates que la barre dans le Gantt : le planning calculé et, avant le premier calcul, les dates saisies. Si vous tapez une autre date dans Début, elle devient le début planifié. Une autre Fin modifie la durée d'une tâche planifiée automatiquement ; pour une tâche planifiée manuellement, elle devient la fin planifiée. Appuyez ensuite sur **F5** pour recalculer. Si vous retapez la même date, rien ne change.

Les champs **Début planifié** et **Fin planifiée** affichent les dates saisies elles-mêmes, même si le calcul déplace la tâche. Fin planifiée n'est modifiable que pour une tâche planifiée manuellement : pour les autres tâches, le début et la durée déterminent la fin. Le Début et la Fin d'une tâche récapitulative planifiée automatiquement découlent de ses sous-tâches et ne sont pas modifiables.

## Réinitialiser par défaut

**Réinitialiser par défaut** se trouve en bas du sélecteur de colonnes. Un clic rétablit la disposition par défaut des colonnes de ce tableau : quelles colonnes sont affichées, leur ordre et leur largeur, et les colonnes épinglées. Les champs ajoutés en plus quittent le tableau et restent disponibles dans le sélecteur. C'est aussi ainsi que vous obtenez la nouvelle disposition par défaut après une mise à jour, par exemple **Début** et **Fin** au lieu de **Début planifié** et **Fin planifiée** : une disposition personnelle enregistrée auparavant ne change pas d'elle-même. Si le tableau utilise déjà la disposition par défaut, le bouton est désactivé.

## Enregistrement, annulation et layouts

La disposition des colonnes est une préférence personnelle sur cet appareil : elle vaut pour tous vos projets et n'est pas enregistrée dans le fichier du projet. Chaque action sur les colonnes — ajouter, supprimer, déplacer, élargir, épingler ou **Réinitialiser par défaut** — est une étape que **Ctrl+Z** annule.

Un layout peut aussi enregistrer les colonnes. Il reprend la disposition du tableau que vous voyez au moment de créer le layout, et un clic sur le bouton du layout l'applique au tableau alors affiché : sur l'onglet Tableau, le Tableau ; sur les autres onglets, la liste des tâches à côté du Gantt. Voir [Enregistrer et charger des layouts](docs://ref-layouts).

## Poursuivre la lecture

- [Filtres](docs://ref-filters) — quelles tâches le tableau et le Gantt affichent.

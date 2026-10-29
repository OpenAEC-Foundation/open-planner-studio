# Codes et champs personnalisés

Objectif : attacher vos propres classifications (codes d'activité, par exemple *Localisation*) et vos propres champs (par exemple *Entrepreneur*) à vos tâches.

## Quand vous en avez besoin

En plus des données fixes d'une tâche (nom, durée, relations, …), vous pouvez ajouter vos propres données. Si vous voulez classer les tâches par aile nord et aile sud, par discipline, ou suivre quel entrepreneur exécute une tâche, vous l'enregistrez vous-même. Il existe deux façons, et la différence est importante.

Un **code d'activité** est une classification avec une liste de choix fixe. Vous créez un **type de code** (par exemple *Localisation*) avec des **valeurs** (*N* pour l'aile nord, *Z* pour l'aile sud). Une tâche reçoit au plus une valeur par type de code.

Un **champ personnalisé** (sous *Champs personnalisés* dans la fenêtre) est un champ de saisie libre avec un type : *Texte*, *Nombre*, *Nombre entier*, *Coût*, *Date* ou *Oui/non*. Le champ peut avoir une valeur différente sur chaque tâche.

## Étapes

### Définir des codes et des champs

1. Choisissez *Planification › Structure › Codes et champs*.
2. **Créer un type de code.** Sous *Nouveau type de code (p. ex. Localisation)*, saisissez le nom et appuyez sur Entrée, ou cliquez sur *Ajouter un type de code*.
3. **Ajouter des valeurs.** Sous le type de code, cliquez sur *Ajouter une valeur*. L'application y place un code provisoire, par exemple *V1*. Modifiez-le dans la zone *Code* (court, comme vous le taperiez : *N*), remplissez si besoin une *Description* (*aile nord*) et choisissez une *Couleur*. Une modification est prise en compte dès que vous quittez la zone ou appuyez sur Entrée.
4. **Créer un champ personnalisé.** Sous *Nouveau champ (p. ex. Entrepreneur)*, saisissez le nom, choisissez le type et cliquez sur *Ajouter un champ* (ou appuyez sur Entrée).

La fenêtre n'a pas de bouton OK : chaque modification s'applique immédiatement. Vous ne pouvez plus changer le type d'un champ après sa création, seulement son nom. Si vous voulez un autre type, créez un nouveau champ.

### Renseigner un code ou un champ sur une tâche

Vous avez deux endroits.

- **Dans le volet *Propriétés*** (ou dans la fenêtre que vous ouvrez avec F2). En bas se trouve le bloc *Codes et champs* : une liste de choix par type de code, une zone de saisie par champ. Le bloc n'apparaît qu'une fois qu'il existe au moins un type de code ou un champ.
- **Comme colonne dans le tableau des tâches.** Cliquez sur le **+** à droite de l'en-tête du tableau (*Ajouter une colonne*) puis, sous *Personnalisé*, choisissez le type de code ou le champ. Dans la cellule d'un type de code, vous tapez le code, par exemple `N`, ou vous le choisissez dans la liste. Un code qui n'existe pas affiche *Choisissez une valeur de ce code d'activité.*

### Les utiliser

Vous pouvez utiliser un type de code ou un champ personnalisé pour filtrer, grouper et trier. Vous le configurez avec une disposition : *Affichage › Disposition › Nouvelle disposition*. Dans la fenêtre, cochez les parties que vous voulez enregistrer. Avec *Enregistrer*, vous obtenez un bouton dans *Affichage › Disposition* sur lequel vous pouvez cliquer plus tard ; avec *Appliquer sans enregistrer*, vous ne l'affichez qu'à l'écran pour le moment. Lors du regroupement, les tâches sans valeur se trouvent sous *(aucun)*.

Pour la couleur des barres, choisissez *Affichage › Références et avancement › Couleurs des barres*, puis *Par catégorie* et le type de code. Chaque barre prend alors la *Couleur* de sa valeur.

## Pièges et ce que fait l'application

**La suppression efface les valeurs sur les tâches.** Si vous supprimez un type de code, une valeur ou un champ avec la corbeille, l'application ne demande pas de confirmation, et les affectations sur toutes les tâches disparaissent en même temps. Un regroupement ou un tri sur ce type de code ou ce champ n'est plus appliqué non plus. *Annuler* (Ctrl+Z, fermez d'abord la fenêtre) rétablit le type de code, la valeur ou le champ et les valeurs saisies, mais pas le regroupement ni le tri : vous les reconfigurez.

**Deux valeurs avec le même code.** *Ajouter une valeur* numérote à partir du nombre de valeurs existantes. Si vous en supprimez une et en ajoutez une, un code peut donc apparaître deux fois. Si vous tapez ce code dans une cellule de colonne, l'application refuse avec *Cette valeur de code d'activité apparaît plusieurs fois. Choisissez-la dans la liste.* Donnez à chaque valeur son propre code.

**Les modèles n'emportent pas les codes ni les champs.** Voir [Enregistrer et insérer des modèles WBS](docs://howto-wbs-sjablonen). Si vous collez des tâches dans un autre document, l'application efface les codes et les champs qui n'existent pas dans ce document et vous en informe.

**Un champ de date ne suit pas le déplacement.** Si vous déplacez tout le projet, les champs personnalisés de type *Date* renseignés gardent leur date. L'application en avertit dans l'aperçu.

## Voir aussi

- [Adapter la structure](docs://howto-structuur-aanpassen) : l'arborescence WBS, l'autre façon d'organiser les tâches.
- [Déplacer un projet](docs://howto-project-verplaatsen) : ce qui arrive aux dates quand vous déplacez le projet.
- [Créer et utiliser une disposition](docs://howto-layouts-gebruiken) : regroupement et filtrage sur un code ou un champ personnalisé.
- [Adapter les colonnes du tableau](docs://howto-tabelkolommen-aanpassen) : afficher un code ou un champ personnalisé comme colonne.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) : les codes d'activité *House* et *Discipline*, le champ personnalisé *Cost estimate* et des notes (ouvertes et terminées).

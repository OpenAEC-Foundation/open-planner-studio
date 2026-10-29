# Ajuster les colonnes du tableau

Objectif : choisir les colonnes que vous voyez dans le tableau des tâches, leur ordre et leur largeur.

## Quand vous en avez besoin

Pendant la réunion, vous souhaitez voir l'échéance et la marge totale à côté de chaque tâche. Le chef de chantier veut seulement le début et la fin à côté du nom. Ou une colonne est si étroite que son en-tête est coupé. Le tableau des tâches se compose de colonnes que vous choisissez vous-même : il y en a des dizaines, de *Nom de tâche* et *Durée* à *Échéance*, *Marge libre* et *Ressources affectées*.

Il existe deux tableaux des tâches, chacun avec ses propres colonnes :

- Le **tableau des tâches à côté du Gantt** se trouve à gauche de la frise temporelle, entre autres dans les onglets *Accueil*, *Planification* et *Affichage*. Par défaut, il contient *WBS*, *Nom de tâche* et *Durée*, afin de laisser de la place à la frise temporelle.
- Le **tableau de l'onglet *Tableau*** occupe tout l'espace de travail. Par défaut, il contient *WBS*, *Nom de tâche*, *Durée*, *Début*, *Fin*, *Catégorie de travaux*, *Critique*, *Marge totale* et *Avancement*, ainsi qu'une colonne par code d'activité et par champ personnalisé du projet.

Une modification d'un tableau ne change pas l'autre.

## Étapes

### Ajouter une colonne

1. Cliquez sur le plus (**+**) à droite de l'en-tête du tableau. Dans l'onglet *Tableau*, vous pouvez aussi utiliser *Tableau › Colonnes › Colonnes…*. La fenêtre *Choisir une colonne* s'ouvre.
2. Cherchez la colonne. En haut, si vous avez déjà choisi des colonnes, se trouve *Utilisées récemment*. Tapez une partie du nom dans *Rechercher*, par exemple *échéa* pour *Échéance*, ou ouvrez une catégorie : *Tâche*, *Planification*, *Contraintes*, *Relations*, *Ressources*, *Avancement*, *Calculé*, *Référence*, *Personnalisé* ou *Technique*.
3. Cliquez sur la colonne. Elle se place à la fin du tableau et la fenêtre se ferme.

Une colonne déjà présente dans le tableau est grise et ne peut pas être choisie.

### Supprimer une colonne

Cliquez sur le signe moins dans l'en-tête de la colonne (*Supprimer : Échéance*). Ou faites un clic droit sur l'en-tête et choisissez *Supprimer : Échéance*. Avec Ctrl+Z, vous récupérez la colonne. Ou vous la choisissez à nouveau avec le plus.

### Modifier la largeur

Faites glisser le bord à droite de l'en-tête de la colonne vers la gauche ou la droite. Double-cliquez sur ce bord, ou choisissez *Ajuster automatiquement* dans le menu de l'en-tête (bouton droit de la souris), pour rendre la colonne assez large pour son contenu, jusqu'à un maximum de 480 pixels. Si le bord a le focus, les touches fléchées l'élargissent ou le rétrécissent pas à pas.

### Épingler des colonnes

Faites un clic droit sur l'en-tête et choisissez *Épingler*. Les colonnes épinglées passent au début et restent à gauche quand vous faites défiler horizontalement. Cela fonctionne tant qu'elles ne sont pas, ensemble, plus larges que la fenêtre. *Désépingler* remet les colonnes à leur place dans la rangée.

### Changer l'ordre

Faites glisser un en-tête de colonne vers un autre emplacement. Une colonne épinglée se déplace parmi les colonnes épinglées, une colonne ordinaire parmi les colonnes ordinaires.

### Revenir aux valeurs par défaut

Ouvrez la fenêtre *Choisir une colonne* et cliquez sur *Réinitialiser par défaut* en bas. Le bouton est gris si les colonnes sont déjà celles par défaut. Pour le tableau de l'onglet *Tableau*, une colonne pour chaque code d'activité et chaque champ personnalisé du projet est aussi ajoutée, même si vous les aviez supprimées auparavant. Ces colonnes appartiennent au projet dans lequel se trouve le code ou le champ. Vous pouvez en savoir plus sur ces codes et champs dans [Codes et champs personnalisés](docs://howto-codes-en-velden).

## Pièges et ce que fait l'application

**L'en-tête est coupé.** Une colonne étroite coupe son nom, par exemple *Marge totale* devient *Marge t…*. Double-cliquez sur le bord de l'en-tête pour ajuster la colonne.

**Vous modifiez le mauvais tableau.** Les colonnes du tableau des tâches à côté du Gantt et celles de l'onglet *Tableau* sont séparées. Si vous êtes sur *Affichage* ou *Accueil*, vous modifiez le tableau à côté du Gantt. Le plus de l'onglet *Tableau* modifie le grand tableau.

**Une disposition remet des colonnes.** Si une disposition a la partie *Colonnes* cochée, un clic sur le bouton de disposition remet les colonnes du tableau des tâches à côté du Gantt dans l'état enregistré. Le tableau de l'onglet *Tableau* reste intact. Voir [Créer et utiliser une disposition](docs://howto-layouts-gebruiken).

**Les colonnes sont sur votre appareil, pas dans le projet.** L'application garde votre choix de colonnes pour tous vos projets sur cet appareil. Elle ne le stocke pas dans le fichier du projet. Elle ne marque pas non plus le projet comme « modifié ». Vous pouvez annuler chaque modification de colonne avec *Annuler* (Ctrl+Z). Les étapes s'appellent, par exemple, *Ajouter la colonne Échéance* et *Redimensionner la colonne Nom de tâche*.

## Voir aussi

- [Créer et utiliser une disposition](docs://howto-layouts-gebruiken) : placer des colonnes sur un bouton, avec un filtre ou un tri.
- [Codes et champs personnalisés](docs://howto-codes-en-velden) : créer vos propres colonnes que vous pouvez choisir ici.
- [Colonnes du tableau](docs://ref-tabelkolommen) : toutes les colonnes et ce qu'elles affichent.

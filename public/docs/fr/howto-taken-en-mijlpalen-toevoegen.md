# Ajouter des tâches et des jalons

Objectif : ajouter une nouvelle tâche ou un nouveau jalon à votre planning, à l'endroit où il doit se trouver.

## Quand en avez-vous besoin

Vous construisez un planning, du travail est ajouté, ou vous voulez enregistrer un moment, comme une remise ou une inspection.

Une **tâche** est un travail qui prend du temps. Une nouvelle tâche dure 5 jours ouvrés par défaut (avec la planification horaire, la valeur par défaut du projet peut être en heures). Un **jalon** est un moment sans durée : 0 jour. Une tâche avec des sous-tâches s'appelle une **tâche récapitulative**. Dans la construction, c'est souvent une phase. Sa durée et ses dates découlent de ses sous-tâches dès que vous utilisez **Calculer** (F5).

## Étapes

### Ajouter une tâche

1. Choisissez *Accueil › Tâches › Tâche*. Le même bouton se trouve dans l'onglet *Tableau*.
2. Le panneau *Propriétés* s'ouvre et le champ *Nom* est sélectionné. Saisissez le nom et appuyez sur Entrée.

La nouvelle tâche s'appelle d'abord *Nouvelle tâche* et commence au début du projet.

Si une tâche est sélectionnée, la nouvelle tâche va directement en dessous, au même niveau. Si la tâche sélectionnée est une tâche récapitulative, la nouvelle tâche va sous toute cette phase, donc après ses sous-tâches. Si rien n'est sélectionné, elle va en bas de la liste. L'info-bulle du bouton indique laquelle de ces deux actions se produit : *Nouvelle tâche juste en dessous de la sélection* ou *Nouvelle tâche en bas de la liste*. Si vous sélectionnez plusieurs tâches, une seule nouvelle tâche est créée, en dessous de la plus basse de la sélection, telle qu'elle apparaît à l'écran.

### Rapidement les unes après les autres dans le tableau des tâches

Sous la dernière tâche du tableau des tâches se trouve toujours une ligne grise *Nouvelle tâche*. Ce n'est pas encore une tâche : elle n'est ni dans le Gantt ni dans le fichier.

1. Cliquez dans une cellule de cette ligne, ou allez-y avec la flèche vers le bas.
2. Saisissez le nom et appuyez sur Entrée. Maintenant c'est une vraie tâche, au même niveau que la tâche au-dessus. Le curseur se trouve tout de suite sur la nouvelle ligne grise en dessous.
3. Saisissez le nom suivant, et ainsi de suite.

Si vous remplissez seulement une durée ou une date sur la ligne grise, la tâche s'appelle *Nouvelle tâche*. Si vous quittez sans rien remplir, rien ne se passe : pas de tâche et pas d'étape dans *Annuler*. La création de la tâche et de sa première valeur forment ensemble une seule étape dans *Annuler*. La ligne grise n'apparaît que lorsque le tableau des tâches n'est pas filtré, regroupé ni trié.

### Avec le bouton droit de la souris sur un espace vide

Faites un clic droit sur un espace vide : dans le tableau des tâches sous la dernière tâche, ou dans le Gantt à côté ou sous les barres. Choisissez *Nouvelle tâche* ou *Ajouter un jalon*. La tâche va en bas de la liste. Dans le Gantt, elle commence à la date où vous avez cliqué. Dans le tableau des tâches, la cellule du nom s'ouvre tout de suite pour que vous puissiez saisir.

### Au-dessus ou en dessous d'une tâche précise

Faites un clic droit sur la tâche et choisissez *Insérer au-dessus* ou *Insérer en dessous*. Le clavier fonctionne aussi : Insert ajoute au-dessus de la tâche sélectionnée, Ctrl+I (⌘+I sur Mac) en dessous. Dans le tableau des tâches, la cellule du nom s'ouvre tout de suite après Insert, prête pour la saisie.

Si plusieurs tâches sont sélectionnées, une seule nouvelle tâche est créée : *Insérer au-dessus* la place au-dessus de la tâche sélectionnée la plus haute, *Insérer en dessous* en dessous de la plus basse.

### Ajouter une sous-tâche

Faites un clic droit sur la tâche et choisissez *Ajouter une sous-tâche*. La nouvelle tâche va en bas des sous-tâches de cette tâche. Dans le tableau des tâches à côté du Gantt, une tâche récapitulative a aussi un petit **+** après son nom, qui fait la même chose.

### Ajouter un jalon

1. Choisissez *Accueil › Tâches › Jalon ▾*, puis *Jalon de début*, *Jalon de fin* ou *Point d’inspection (obligatoire)*.
2. Saisissez le nom et appuyez sur Entrée. L'emplacement suit la même règle que pour *Tâche*.

Les trois types diffèrent ainsi :

- Un *Jalon de début* se place au début de la journée, un *Jalon de fin* à la fin de la journée. Dans le Gantt, le losange se trouve à gauche ou à droite de la colonne du jour, respectivement. Cela compte aussi pour le successeur. Supposons qu'un jalon tombe le mardi 29 septembre 2026 et qu'une tâche le suive avec une relation fin-début : après un jalon de début, cette tâche commence le même mardi ; après un jalon de fin, elle commence le mercredi 30 septembre.
- Un *Point d’inspection (obligatoire)* est un jalon de fin avec la catégorie de travaux *Inspection* et la case *Obligatoire (contractuel)* cochée.

### Transformer une tâche existante en jalon

Faites un clic droit sur la tâche et choisissez *Basculer en jalon*, ou cochez *Jalon* dans le panneau *Propriétés*. L'élément de menu agit sur toute la sélection. La durée devient 0.

Si vous le désactivez à nouveau, la tâche reste une tâche ordinaire avec une durée de 0 : saisissez vous-même une durée.

### Autres méthodes

- Ctrl+M (⌘+M sur Mac) ajoute un nouveau jalon en bas de la liste, même si une tâche est sélectionnée. Le panneau *Propriétés* ne s'ouvre pas.
- Un jalon créé avec Ctrl+M ou via le menu du clic droit reçoit la catégorie de travaux *Inspection*. Un *Jalon de début* ou un *Jalon de fin* issu de *Jalon ▾* reçoit *Autre*. Modifiez la catégorie de travaux dans *Propriétés* si nécessaire.
- *Ajouter un jalon* dans le menu du clic droit d'une tâche fait du jalon une sous-tâche de cette tâche, et non une tâche du même niveau.

### Copier une tâche ou une branche entière

1. Dans le Gantt, cliquez sur la barre de la tâche. Sélectionnez d'autres tâches avec Ctrl+clic.
2. Appuyez sur Ctrl+C (⌘+C sur Mac). L'application copie la tâche avec toutes ses sous-tâches, les relations entre les tâches copiées et leurs affectations de ressources.
3. Si vous le souhaitez, cliquez sur la barre de la tâche à côté de laquelle la copie doit aller, puis appuyez sur Ctrl+V (⌘+V).

La copie a le même nom, les mêmes dates et le même avancement. Elle entre comme tâche du même niveau que la tâche sélectionnée (avec plusieurs : celle sur laquelle vous avez cliqué en premier), en bas parmi ces tâches du même niveau. Si rien n'est sélectionné, elle va en bas de la liste. Les tâches copiées sont ensuite sélectionnées, les codes WBS (le numéro de chaque tâche dans l'arborescence, par exemple 1.2 ; voir [Ajuster la structure](docs://howto-structuur-aanpassen)) sont de nouveau déterminés et le planning n'est plus à jour.

Le presse-papiers est partagé par toute l'application, vous pouvez donc aussi coller dans un autre document. Ce qui n'existe pas là-bas, comme un calendrier de tâche, une catégorie de travaux personnalisée, un code d'activité ou un champ personnalisé, l'application l'efface et vous le signale.

### Ensuite

Une nouvelle tâche ne modifie pas encore les autres dates. La barre d'état affiche *Obsolète — recalculer (F5)*. Appuyez sur **Calculer** (F5), par exemple via *Accueil › Planification › Calculer*.

## Pièges et ce que fait l'application

**Chaque nouvelle tâche commence au début du projet.** Sans relations, une tâche n'attend rien. Ajoutez des relations, voir [Ajouter des relations](docs://howto-relaties-leggen).

**Le filtrage, le regroupement ou le tri est actif.** L'ordre que vous voyez n'est alors pas l'ordre du planning. Si une tâche est sélectionnée, *Tâche* et *Jalon ▾* ajoutent la nouvelle tâche en bas. Une notification rouge indique alors *La nouvelle tâche a été ajoutée à la fin. Pendant le filtrage, le regroupement ou le tri, l'application ne peut pas la placer sous votre sélection*. *Insérer au-dessus* et *Insérer en dessous* sont refusés, avec la même bande *Non disponible pendant le filtrage/regroupement/tri*. Le bouton *Effacer* dans la notification ou dans la bande supprime d'un coup le filtre, le regroupement et le tri. Cette action n'est pas couverte par *Annuler* : Ctrl+Z ne les rétablit pas.

**Une sous-tâche sous une tâche avec des affectations de ressources.** La tâche devient une tâche récapitulative, et une tâche récapitulative ne porte pas elle-même d'affectations. L'application déplace les affectations vers la nouvelle sous-tâche et vous le signale. Si ce n'est pas possible, par exemple parce que vous avez choisi *Ajouter un jalon* et qu'un jalon ne peut pas porter d'affectations, l'application n'ajoute rien et vous en indique la raison.

**Une sous-tâche sous un jalon.** Le jalon devient une tâche récapitulative et l'application retire l'indicateur de jalon, avec un message.

**Jalon activé pour une tâche récapitulative ou une tâche avec affectations.** L'application refuse et en indique la raison. Avec des affectations : supprimez-les d'abord.

**Copier dans le tableau des tâches.** Dans le tableau des tâches (et dans l'onglet *Tableau*), Ctrl+C copie seulement les valeurs des cellules sélectionnées, comme dans un tableur, et Ctrl+V colle dans les cellules. Copier des tâches ne fonctionne donc que si vous utilisez le Gantt : cliquez d'abord sur une barre.

## Voir aussi

- [Ajuster la structure](docs://howto-structuur-aanpassen) : mettre en retrait et déplacer des tâches, et garder les numéros WBS à jour.
- [Ajouter des relations](docs://howto-relaties-leggen) : lier des tâches entre elles.
- [Sélectionner, supprimer et annuler des tâches](docs://howto-taken-selecteren-verwijderen) : retirer de nouveau une tâche.
- [Chemin critique et marge](docs://uitleg-kritiek-pad) : ce que l'application calcule dès qu'il existe des relations.
- [Boîte de dialogue de tâche et panneau des propriétés](docs://ref-taak-eigenschappen) : tous les champs d'une tâche.
- [Nouveau projet et Info projet](docs://ref-projectinfo) : démarrer avec un modèle de phasage.
- [Menus du clic droit](docs://ref-contextmenus) : tous les éléments du menu d'une tâche.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc) : un petit projet d'exemple (*Fichier › Exemples*) avec quatre phases, un jalon de début et un jalon de remise obligatoire.

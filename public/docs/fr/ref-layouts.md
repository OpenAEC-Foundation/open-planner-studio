# Enregistrer et charger des layouts

Un layout est une configuration de vue enregistrée : les colonnes, le regroupement, le tri, le filtre et l'échelle de temps réunis dans un même ensemble. Les layouts sont globaux à l'application (sur cet appareil) — ils n'appartiennent pas à un seul fichier de projet, vous pouvez donc les utiliser dans n'importe quel document.

## Ouverture

**Affichage** → groupe de ruban **Layout**. Il contient un sélecteur avec vos layouts et trois boutons :

- **Enregistrer sous…** et **Gérer…** — les deux ouvrent la fenêtre **Gérer les layouts** (ci-dessous).
- **Mettre à jour** — écrase le layout choisi dans le sélecteur avec la vue actuelle ; désactivé tant que **(aucun)** est sélectionné.

Choisir un layout dans le sélecteur l'applique immédiatement.

## La fenêtre Gérer les layouts

Sans layout enregistré, la fenêtre affiche « Aucun layout enregistré pour l'instant. » Sinon, une ligne par layout avec :

- **Nom** — modifiable directement dans la ligne (renommer).
- **Appliquer** (coche) — demande d'abord confirmation : « Appliquer le layout … ? Cela remplace les colonnes/regroupement/tri/filtre/échelle actuels. »
- **Mettre à jour** — écrase le layout avec la vue actuelle, sans confirmation.
- **Supprimer** (icône de corbeille) — demande d'abord confirmation.

Les confirmations apparaissent comme une petite boîte de dialogue intégrée à l'application ; **Échap** ou **Annuler** l'interrompt.

## Enregistrer le layout sous…

En bas de la fenêtre : saisissez un **Nom** et cliquez sur **Enregistrer** — la vue actuelle est enregistrée comme un nouveau layout et devient le layout actif. Sans nom, le layout reçoit le nom par défaut « Nom ».

## Ce qu'un layout capture

- Les colonnes (visibilité, ordre, largeur) — voir [Choisir les colonnes](docs://ref-kolommen).
- Le regroupement et le tri (**Affichage** → **Grouper…** / **Trier…**).
- Le filtre — voir [Filtres](docs://ref-filters).
- L'échelle de temps du Gantt.

Non inclus : les détails du niveau de zoom, les largeurs des panneaux et les sélections.

# Enregistrer et gérer une référence

Objectif : enregistrer le planning comme un accord (une référence). Vous pouvez ainsi voir plus tard comment l'exécution s'écarte du planning. Vous pouvez aussi conserver, renommer, choisir et supprimer plusieurs références.

## Quand vous en avez besoin

Vous enregistrez une référence lorsque le planning a été approuvé et que les travaux doivent encore commencer. Si le planning est révisé plus tard de manière formelle, par exemple après un ordre de modification, vous enregistrez une deuxième référence et vous conservez la première. Vous mesurez ainsi l'exécution par rapport au premier accord et au planning révisé. Ce qu'une référence enregistre exactement, et comment l'application calcule l'écart, est expliqué dans [Avancement, date d'état et référence](docs://uitleg-voortgang).

## Étapes

### Enregistrer une référence

1. Appuyez sur **Calculer** (F5), par exemple via *Planification › Planification › Calculer*. La référence enregistre les dates calculées à ce moment-là.
2. Choisissez *Planification › Références et avancement › Gérer les références…*. La fenêtre *Références* s'ouvre.
3. Sous *Enregistrer une nouvelle référence*, un nom est suggéré, par exemple *Référence 1 — (date du jour)*. Tapez un nom de votre choix que vous reconnaîtrez plus tard, par exemple *Référence*.
4. Cliquez sur *Enregistrer*. La référence figure maintenant dans la liste et devient immédiatement la référence active.
5. Cliquez sur *Fermer*.

Sous chaque barre de tâche du Gantt apparaît maintenant une fine barre avec les dates de référence. Un jalon reçoit un petit losange. Vous activez ou désactivez cette superposition via *Affichage › Références et avancement › Superposition de la référence*.

### Choisir la référence active

Ouvrez *Gérer les références…* et choisissez, dans la colonne *Active*, la référence avec laquelle vous voulez comparer. Tant qu'il existe des références, exactement une est active. La superposition du Gantt, le type de rapport *Variance* et le *Rapport d'avancement* utilisent cette référence.

### Renommer une référence

Modifiez le nom dans la liste. La modification s'applique immédiatement. Vous n'avez pas besoin de cliquer sur *Enregistrer*.

### Supprimer une référence

Cliquez sur la petite corbeille à côté de la référence dans la liste. Si vous supprimez la référence active, l'application demande *Supprimer la référence active ?*. Ensuite, la référence la plus récente restante devient la référence active. S'il n'en reste aucune, il n'y a plus de référence active et la superposition disparaît. Vous restaurez une référence supprimée avec Ctrl+Z. Fermez d'abord la fenêtre ; Ctrl+Z ne fonctionne pas dans une fenêtre.

### Écarts dans le tableau des tâches

Chaque référence a six colonnes dans le tableau des tâches. Cliquez sur le **+** à droite de l'en-tête du tableau des tâches (*Ajouter une colonne*) et ouvrez la catégorie *Référence*. Pour chaque référence, il y a *Début planifié*, *Fin planifiée*, *Durée*, *Écart de début*, *Écart de fin* et *Écart de durée*, avec le nom de la référence devant, par exemple *Référence — Écart de fin*. Les écarts sont exprimés en jours ouvrés : un plus signifie plus tard, un moins signifie plus tôt. Une tâche qui ne figure pas dans la référence affiche un tiret (—) dans ces colonnes.

## Pièges et comportement de l'application

**Un planning obsolète.** Si le planning est obsolète, la fenêtre affiche *La planification est obsolète — recalculez d'abord (F5)*. C'est un avertissement. L'enregistrement reste possible. Mais vous enregistrez alors les anciennes dates. Fermez la fenêtre, appuyez sur **Calculer** et enregistrez seulement ensuite.

**Une référence avec avancement.** Si vous enregistrez une référence après avoir saisi l'avancement, elle enregistre l'état avec ces dates réelles. L'écart est alors nul et ne dit plus rien sur l'exécution. Enregistrez la référence avant le début des travaux.

**Une référence ne peut pas être mise à jour.** Si vous voulez réviser l'accord, enregistrez une nouvelle référence et supprimez l'ancienne si nécessaire.

**Un ⚠ à Durée ou Écart de durée.** Pour une tâche exprimée en heures, un jour correspond aux horaires de travail de son calendrier. Si le calendrier a ses propres heures par jour (par exemple 8, avec des plages de 10 heures, provenant de Primavera P6), une version plus ancienne de l'application comptait les jours autrement. Une référence de cette version conserve l'ancien nombre : une tâche de 1870 heures vaut 233,75 jours dans la référence et 187 jours maintenant. L'application ne convertit pas une telle référence. Les colonnes *Durée* et *Écart de durée* de cette référence affichent alors un ⚠ ; survolez-le pour voir l'explication. Les dates de la référence sont correctes. Enregistrez une nouvelle référence et supprimez l'ancienne si nécessaire.

**Uniquement les tâches sans sous-tâches.** Une phase ne figure pas dans la référence. Elle n'a ni barre de référence ni écart. La phase découle des tâches qui se trouvent en dessous.

**Tâches ajoutées et supprimées.** Une tâche que vous ajoutez après l'enregistrement n'a pas de barre de référence. Dans le rapport de variance, elle apparaît comme *Nouvelle*. Une tâche que vous supprimez apparaît comme *Supprimée*.

**Déplacer le projet.** Dans la fenêtre *Déplacer le projet…*, dès qu'il existe des références, figure la case *Décaler aussi les références*. Elle est désactivée par défaut : les références restent en place, si bien que le déplacement apparaît comme un écart. Voir [Déplacer un projet](docs://howto-project-verplaatsen).

**Enregistré dans le fichier du projet.** Les références et le choix de la référence active sont enregistrés avec le projet. Ils reviennent à l'ouverture du fichier.

## Voir aussi

- [Avancement, date d'état et référence](docs://uitleg-voortgang) : ce qu'une référence enregistre et comment l'écart est calculé.
- [Déplacer un projet](docs://howto-project-verplaatsen) : la case *Décaler aussi les références*.
- [Mettre à jour l'avancement](docs://howto-voortgang-bijwerken) : saisir l'état réel que vous comparez avec la référence.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) : une référence (*Baseline at start*) avant le début, avec avancement et une date d'état du 20 mai 2027.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc) : deux références, *Contract* et *Re-baseline (variation order)*, avec avancement et une date d'état du 5 juillet 2027.

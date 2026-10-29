# Créer et attribuer un calendrier

Objectif : créer votre propre calendrier, par exemple une semaine de travail de six jours, et l'attribuer aux tâches qui doivent être calculées selon ce calendrier.

## Quand en avez-vous besoin

Un sous-traitant travaille aussi le samedi. Une équipe ne travaille que du lundi au jeudi. Une tâche tombe dans un laps de temps pendant lequel seule cette tâche reste à l'arrêt. Le calendrier du projet a alors les mauvais jours ouvrés. Avec un calendrier propre, l'application calcule ces tâches aux bons jours, et le reste reste sur le calendrier du projet. Vous pouvez lire ce que l'application fait exactement avec un calendrier dans [Calendriers et jours ouvrés](docs://uitleg-kalenders).

## Étapes

### Créer un calendrier

1. Choisissez *Planification › Calendrier › Calendrier*. Le même bouton se trouve dans *Paramètres › Calendrier › Calendrier*. La fenêtre *Calendriers* s'ouvre. À gauche se trouvent les calendriers du projet ; le calendrier du projet porte une étoile.
2. Sous la liste, cliquez sur le bouton avec le signe plus (*Nouveau calendrier*). Le nouveau calendrier est une copie du calendrier standard : du lundi au vendredi, de 07:00 à 16:00 avec une pause d'une heure et, si *Mode construction* est activé, les jours fériés néerlandais. Si vous voulez prendre un calendrier existant comme base, sélectionnez-le dans la liste et cliquez sur le bouton avec les deux feuilles sous la liste (*Dupliquer*).
3. Donnez un nom au calendrier sous *Nom*, qui indique qui l'utilise, par exemple *Six-day week*.
4. Sous *Jours ouvrés*, cliquez sur les jours de la semaine pour les activer ou les désactiver. *Lun–ven* rétablit la semaine standard, de 07:00 à 16:00. Si le calendrier a des plages, *Lun–ven* active seulement du lundi au vendredi et chaque jour conserve ses plages. *Continu (24/7)* active les sept jours, de 00:00 à 24:00.
5. Ajustez les horaires de travail si nécessaire : *Début (heure)*, *Fin (heure)*, *Début de la pause* et *Durée de la pause (minutes)*. Vous saisissez les heures au format HH:MM ; avec les flèches, vous les augmentez ou diminuez d'un quart d'heure. Si vous réglez la durée de la pause sur 0, le calendrier fonctionne sans pause. *Jour ouvré standard* est déterminé automatiquement par l'application. Si le calendrier a des plages par jour de la semaine (par exemple venant de MS Project), vous ne voyez pas ces champs mais le bloc *Horaires de travail*, aussi lorsque la planification horaire est désactivée ; voir [Définir les horaires de travail](docs://howto-werktijden-instellen).
6. Ajustez les jours fériés si nécessaire. Le fonctionnement est expliqué dans [Générer les jours fériés et les congés du bâtiment](docs://howto-feestdagen-genereren).
7. Cliquez sur *Appliquer*. L'application recalcule le planning immédiatement et ferme la fenêtre. Avec *Annuler*, vous abandonnez les modifications. Appuyer sur Entrée dans un champ de saisie enregistre entre-temps et recalcule aussi, sans fermer la fenêtre ; *Annuler* n'annule alors que ce que vous avez modifié après cela.

### Attribuer un calendrier aux tâches

Un nouveau calendrier ne produit d'effet que lorsqu'une tâche l'utilise. Il existe deux méthodes.

**Via le panneau des propriétés**

1. Sélectionnez la tâche. Si le panneau des propriétés n'est pas visible, activez-le avec *Affichage › Panneaux › Propriétés*.
2. Sous *Tâche*, choisissez le calendrier dans la liste *Calendrier*. Le premier choix, *Calendrier du projet* suivi du nom, signifie que la tâche n'a pas de calendrier propre.

**Via le menu contextuel**

1. Faites un clic droit sur la tâche, dans le tableau des tâches ou sur la barre dans le Gantt.
2. Choisissez *Attribuer un calendrier*, puis le calendrier, ou *Calendrier du projet* pour retirer à nouveau le calendrier propre. Le calendrier qui s'applique a une coche.
3. Si vous voulez attribuer un calendrier à plusieurs tâches à la fois, sélectionnez-les d'abord avec Ctrl (⌘ sur Mac) et faites un clic droit sur l'une des tâches sélectionnées. Le choix s'applique à toutes les tâches sélectionnées. Si vous faites un clic droit sur une tâche non sélectionnée, le choix ne s'applique qu'à cette tâche.

Un nouveau choix de calendrier ne rend pas encore le planning à jour : la barre d'état indique *Obsolète — recalculer (F5)*. Appuyez sur **Calculer** (F5), par exemple via *Accueil › Planification › Calculer*. Si *Calculer automatiquement* est activé (*Paramètres › Projet › Paramètres de l'application*, onglet *Planification*, rubrique *Calcul*), l'application le fait elle-même.

### Changer le calendrier du projet

1. Ouvrez *Planification › Calendrier › Calendrier* et choisissez le calendrier dans la liste.
2. Au-dessus du formulaire, cliquez sur *Définir comme calendrier par défaut du projet*. L'étoile passe à ce calendrier.
3. Cliquez sur *Appliquer*.

Seules les tâches sans calendrier propre suivent le changement.

### Supprimer un calendrier

1. Ouvrez la fenêtre *Calendriers* et choisissez le calendrier dans la liste.
2. Sous la liste, cliquez sur le bouton avec la corbeille (*Supprimer*). Ce bouton est désactivé tant qu'il n'y a qu'un seul calendrier.
3. Cliquez sur *Appliquer*. Les tâches et les ressources qui utilisaient le calendrier reviennent au calendrier du projet. Si vous supprimez le calendrier du projet lui-même, le premier calendrier de la liste devient le calendrier du projet.

## Pièges et ce que fait l'application dans ce cas

**Aucun jour ouvré.** Si vous désactivez tous les jours de la semaine, l'application ne peut pas calculer. Lors du calcul, elle affiche *Aucun jour ouvré n'est défini dans le calendrier*.

**Saisie non valide.** Une pause en dehors des horaires de travail, une heure de début postérieure à l'heure de fin ou un jour férié avec une date incorrecte affiche un message rouge sous le champ, et *Appliquer* est désactivé tant que vous ne corrigez pas l'erreur. Pour une pause ou un jour férié non valide, un signe d'avertissement apparaît aussi à côté du calendrier dans la liste (*Ce calendrier contient une saisie non valide*).

**Un calendrier sur une phase.** Une phase se calcule toujours sur le calendrier du projet, car sa durée découle de ses tâches. Attribuez le calendrier aux tâches elles-mêmes.

**Le même calendrier, deux choix.** Dans la liste, le calendrier du projet apparaît deux fois : sous la forme *Calendrier du projet : nom* et comme calendrier ordinaire portant ce nom. Si vous choisissez le second, c'est un choix distinct pour cette tâche. La tâche ne suit alors pas le changement lorsque vous choisissez plus tard un autre calendrier du projet.

**Heures différentes par jour.** Si vous modifiez les horaires de travail ou la pause de sorte que le *Jour ouvré standard* d'un calendrier change, une tâche dont la durée est exprimée en jours compte toujours le même nombre de jours. Pour une tâche avec des ressources et le type de tâche *Travail fixe* ou *Unités fixes*, la durée change avec elle, car le travail reste le même. Quarante heures de travail font 5 jours à 8 heures par jour et 7 jours à 6 heures par jour. L'application indique combien de tâches ont obtenu une durée différente.

## Voir aussi

- [Calendriers et jours ouvrés](docs://uitleg-kalenders) : comment l'application compte les jours ouvrés et quel calendrier prévaut.
- [Jours et heures](docs://uitleg-dagen-en-uren) : ce que fait le jour ouvré standard.
- [Configurer un calendrier de ressource](docs://howto-resourcekalender-instellen) : un calendrier pour une ressource au lieu d'une tâche.
- [Fenêtres de calendrier](docs://ref-kalenders) : tous les champs des fenêtres de calendrier.

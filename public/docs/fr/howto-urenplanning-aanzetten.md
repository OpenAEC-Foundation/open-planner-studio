# Activer la planification horaire

Objectif : planifier des tâches pendant les horaires de travail, à côté des tâches en jours.

## Quand en avez-vous besoin

Vous louez une grue à l'heure, et non à la journée. Une coulée de six heures ne tient pas dans un jour ouvré entier. Une équipe de nuit travaille à d'autres heures que l'équipe de jour. Pour ce type de travail, vous voulez une durée en heures, avec un début et une fin à une heure précise. Vous activez aussi ce réglage si vous ouvrez un fichier et que l'application affiche *Ce fichier contient une planification horaire.* Pour savoir pourquoi l'application compte les jours et les heures différemment, lisez [Jours et heures](docs://uitleg-dagen-en-uren).

## Étapes

### Activation de la planification horaire

1. Choisissez *Paramètres › Projet › Paramètres de l'app* et ouvrez l'onglet *Planification*.
2. Sous *Planification horaire*, cochez *Activer la planification horaire*. Le réglage prend effet tout de suite. Dans le message *Ce fichier contient une planification horaire.*, le bouton *Activer la planification horaire* fait la même chose.
3. En dessous se trouve *Autoriser la planification mixte jour/heure*, activé par défaut. Avec ce réglage, vous choisissez pour chaque tâche si elle se compte en jours ou en heures. Si vous le désactivez, la liste *Unité de durée* disparaît. Vous pouvez alors encore saisir une durée avec une unité, par exemple `12h`.

Ce réglage change plus que la durée d'une tâche : sous *Affichage › Échelle de temps*, vous pouvez choisir l'échelle *Heure* ; dans la fenêtre *Calendriers*, un calendrier ordinaire peut recevoir des plages horaires (le bloc *Horaires de travail* ; un calendrier qui a déjà des plages affiche toujours ce bloc) ; et la fenêtre *Nouveau projet* reçoit les choix *Équipe* et *Unité par défaut des nouvelles tâches*.

### Planifier une tâche en heures

1. Sélectionnez la tâche et regardez dans le panneau *Propriétés*, sous *Temps*, le champ *Durée*.
2. Saisissez la durée avec une unité, puis appuyez sur Entrée : `12h` (`12u`, l'abréviation néerlandaise, fonctionne aussi) pour douze heures, `1h 30m` pour une heure et demie. `1.5h` convient aussi. Un nombre sans unité est pris dans l'unité déjà utilisée par la tâche.
3. Si vous voulez convertir une tâche existante, choisissez l'unité *Heures* sous *Unité de durée*. L'application convertit la durée immédiatement, par exemple de `2` jours en `16` heures. Pour revenir en arrière, utilisez *Annuler*.
4. Revenir aux jours est possible avec `2d` ou avec l'unité *Jours*.
5. Appuyez sur **Calculer** (F5), par exemple via *Accueil › Planification › Calculer*. La tâche a maintenant un début et une fin avec une heure précise.
6. Si vous voulez voir les heures dans le Gantt, choisissez l'échelle *Heure* dans la liste sous *Affichage › Échelle de temps*.

### Nouvelles tâches en heures par défaut

1. Choisissez *Paramètres › Projet › Paramètres du projet*.
2. Sous *Unité par défaut des nouvelles tâches*, choisissez l'unité *Heures* et cliquez sur *Appliquer*.

Une nouvelle tâche a alors une durée de 5 heures au lieu de 5 jours. Les tâches existantes ne changent pas. Pour un nouveau projet, ce choix se trouve dans la fenêtre *Nouveau projet*. Si vous choisissez *Équipe de jour* sous *Équipe* dans cette fenêtre, *Heures* est désactivé. Choisissez une autre équipe, ou définissez l'unité par défaut après la création dans *Paramètres du projet*.

## Pièges et ce que fait l'application dans ce cas

**Pas d'horaires de travail valides.** Si le calendrier de la tâche n'a pas d'horaires de travail utilisables, l'application affiche *Ce calendrier n'a pas d'horaires de travail valides. Vérifiez ses jours et horaires de travail.* Pendant le calcul, le message *La tâche en heures 'name' n'a pas d'horaires de travail valides dans son calendrier* peut apparaître.

**Pas de décimales avec les jours.** Une durée en jours est un nombre entier. `1.5d` affiche le message *Saisissez un nombre entier de jours ou d’heures, par exemple 2d ou 12h.* Si vous voulez une journée et demie, calculez en heures.

**Une conversion qui ne peut pas être exacte.** Douze heures ne tiennent pas dans des jours entiers de 8 heures. Dans *Propriétés* et dans *Modifier la tâche*, l'application affiche alors un encadré jaune avec *12h ne correspond pas à des jours entiers dans ce calendrier. L’unité n’a pas changé.* et ne change pas l'unité. Le tableau des tâches affiche un message plus court : *Cette durée ne peut pas être convertie exactement dans l'autre unité.*

**Le champ est désactivé.** Pour une phase, un hamac ou un jalon de durée nulle, la durée découle d'autre chose, et vous ne pouvez pas la saisir.

**Désactiver de nouveau la planification horaire.** Les tâches en heures restent et sont toujours calculées. Leur durée ne peut alors plus être modifiée ; le champ affiche *Activez la planification horaire pour modifier cette tâche en heures.*, avec un bouton pour la réactiver.

## Voir aussi

- [Jours et heures](docs://uitleg-dagen-en-uren) : comment l'application compte les heures, ce qui se passe quand les jours et les heures se rencontrent et où elle arrondit.
- [Définir les horaires de travail](docs://howto-werktijden-instellen) : les horaires d'un calendrier par jour de la semaine.
- [Ajouter des relations](docs://howto-relaties-leggen) : un décalage en heures entre deux tâches.
- [Paramètres de l'app](docs://ref-instellingen) : le réglage Activer la planification horaire et ce qu'il change d'autre.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc) : contient des tâches en heures (ferraillage et coulage) avec un calendrier en heures propre, *Hourly calendar, rebar fixing & pouring*.

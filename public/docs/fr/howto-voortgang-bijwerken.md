# Mise à jour de l’avancement

Objectif : saisir l’état réel du travail dans le planning et recalculer le planning : quelles tâches sont terminées, lesquelles sont en cours et quel travail reste à faire.

## Quand vous en avez besoin

Vous mettez à jour l’avancement à des moments fixes, par exemple chaque vendredi, quand le chef de chantier fait le point sur l’état. Ainsi, le planning reflète ce qui s’est réellement passé et calcule le travail restant à partir de la date d’état. La raison de ce fonctionnement est expliquée dans [Avancement, date d’état et référence](docs://uitleg-voortgang).

## Étapes

### 1. Définir la date d’état

La date d’état est le jour où vous faites le point. Définissez-la avant de saisir l’avancement.

1. Allez dans *Planification › Références et avancement › Date d’état*.
2. Saisissez la date dans les trois cases pour le jour, le mois et l’année (dans l’ordre de votre notation de date), par exemple 28, 06 et 2027, puis appuyez sur Entrée. L’application passe seule à la case suivante.
3. Le calendrier du projet a-t-il des plages horaires (le bloc *Horaires de travail* dans la fenêtre *Calendriers*) ? Dans ce cas, l’application calcule en heures et un champ d’heure apparaît à droite, par exemple 17:00. Saisissez une autre heure, par exemple 12:00, puis appuyez sur Entrée. Si vous videz le champ d’heure, seule la date reste. Si vous modifiez seulement la date, l’heure reste. L’heure suit votre notation de l’heure (24 ou 12 heures). Sans plages horaires, l’application calcule en jours entiers : il n’y a alors pas de champ d’heure, et la ligne de la date d’état se trouve au début du jour.
4. Avec la petite croix à côté du champ, vous effacez à nouveau la date d’état.

Si vous faites le point le vendredi après les horaires de travail, définissez la date d’état au jour ouvré suivant, le lundi. L’application planifie le travail restant à partir du début de la date d’état.

Si vous saisissez l’avancement alors qu’il n’y a pas encore de date d’état, l’application la fixe à aujourd’hui et affiche ce message : *Date d’état fixée à aujourd’hui (…).* Faites donc plutôt cette étape vous-même en premier.

### 2. Saisir l’avancement

Choisissez la méthode qui convient à votre situation. Elles donnent le même résultat.

**Une tâche dans le panneau des propriétés.** Utile quand vous mettez à jour une seule tâche.

1. Cliquez sur la tâche. Si vous ne voyez pas le panneau *Propriétés*, activez-le avec *Affichage › Panneaux › Propriétés*.
2. Faites glisser le curseur *Avancement (%)* jusqu’au pourcentage réalisé.
3. Si nécessaire, remplissez *Début réel* et *Fin réelle*, de la même façon que la date d’état. L’application calcule elle-même le champ *Restant* ; vous ne pouvez pas le modifier ici.

Un jalon n’a qu’un seul champ, *Date réelle*.

**Choisir un pourcentage dans le menu.** Utile pour un état rapide.

1. Faites un clic droit sur la barre de la tâche dans le Gantt.
2. Choisissez *Avancement*, puis 0 %, 25 %, 50 %, 75 % ou 100 %.

**Plusieurs tâches dans le tableau.** Utile quand vous mettez à jour une liste complète.

1. Cliquez sur le **+** à droite de l’en-tête du tableau des tâches (*Ajouter une colonne*) et ouvrez la catégorie *Avancement*. Ajoutez les colonnes *Début réel*, *Fin réelle*, *Restant* et *État*. La colonne *Avancement* est déjà présente sur l’onglet *Tableau*.
2. Double-cliquez sur une cellule, saisissez la valeur et appuyez sur Entrée. Vous saisissez un pourcentage sous la forme `50` ou `50%`, une date sous la forme `25-06-2027`, une durée restante sous la forme `1`.
3. Pour *État*, après un double-clic, appuyez sur Entrée et choisissez *Non démarrée*, *En cours* ou *Terminée*.

Si vous saisissez une durée restante, l’application revient au pourcentage : pour une tâche de 2 jours ouvrés, un reste de 1 donne un avancement de 50 %. Un reste de 0 termine la tâche. La colonne *Durée réelle* (également dans la catégorie *Avancement*) fonctionne dans l’autre sens : saisissez la durée déjà effectuée, et l’application calcule le pourcentage. Pour une tâche de 4 jours ouvrés, une durée réelle de 1 donne 25 %. Si vous choisissez *Non démarrée* dans la colonne *État*, l’avancement passe à 0 et les dates réelles disparaissent.

**Tout sur une tâche dans la fenêtre de modification.** Faites un clic droit sur la tâche et choisissez *Modifier...*. Les champs d’avancement y figurent aussi. Ils ne prennent effet qu’après un clic sur *Enregistrer*.

**Beaucoup de tâches en une fois depuis un tableur.** Voir [Importer l’avancement depuis un tableur](docs://howto-voortgang-importeren).

### 3. Recalculer le planning

Chaque modification de l’avancement ou de la date d’état rend le planning obsolète : la barre d’état affiche *Obsolète — recalculer (F5)*. Appuyez sur **Calculer** (F5), par exemple via *Planification › Planification › Calculer*. Si *Calculer automatiquement* est activé (sous *Paramètres › Projet › Paramètres de l'app*, onglet *Planification*), l’application le fait elle-même.

## Vérifier le résultat

- À la date d’état, le Gantt affiche une ligne en tirets avec la date dans l’en-tête. Sur les tâches en cours, la ligne se courbe vers le pourcentage dans la barre. Vous les activez ou désactivez avec *Affichage › Références et avancement › Ligne d’avancement* et *Ligne de date d’état*.
- La partie terminée d’une barre devient grise ; le reste garde sa couleur. Une tâche entièrement terminée est entièrement grise, avec une coche devant le nom et sans bande de marge. La barre d’une phase devient aussi grise jusqu’à son pourcentage dérivé, ce qui montre par phase où en est le travail. Si vous affichez les prédécesseurs ou les successeurs d’une tâche, leurs barres gardent leur couleur de mise en évidence, même lorsqu’elles sont terminées.
- Les tâches terminées ne sont jamais rouges : avec une date d’état, une tâche terminée n’est pas critique.
- Les phases affichent un pourcentage dérivé, et la fin du planning peut avoir changé.
- Si vous avez enregistré une référence, le planning d’origine se trouve sous chaque barre, et le type de rapport *Variance* affiche l’écart.

## Pièges et ce que fait l’application

**Une date après la date d’état.** L’application refuse un début réel ou une fin réelle postérieur à la date d’état. Dans le panneau, il est écrit sous les champs *Les dates réelles ne peuvent pas être postérieures à la date d'état* ; dans le tableau, la cellule affiche *La date réelle est postérieure à la date d'état.* Fixez d’abord une date d’état plus tardive, ou corrigez la date.

**Une tâche qui ne commencerait qu’après la date d’état.** Si vous saisissez l’avancement d’une tâche qui, selon le planning, n’aurait pas encore commencé, la fenêtre *Indiquer le début réel* s’ouvre. Elle demande quand la tâche a réellement commencé ; la proposition est la date d’état. Avec *Appliquer l’avancement*, vous l’enregistrez ; avec *Annuler*, rien ne change.

**100 % sans dates.** Si vous mettez une tâche à 100 % sans fin réelle, la fin réelle devient la date d’état, même si la tâche était terminée plus tôt. Renseignez alors vous-même la fin réelle.

**Un pourcentage inférieur à 100 %.** Si vous remettez une tâche terminée sous 100 %, la fin réelle est supprimée. Si vous effacez seulement la fin réelle, l’avancement passe à 0 et la tâche reste *En cours*. Si vous voulez que la tâche soit de nouveau considérée comme non démarrée, effacez aussi le début réel, ou choisissez *Non démarrée* dans la colonne *État* du tableau.

**Modifier la durée d’une tâche en cours.** Le travail déjà effectué reste acquis et l’avancement s’ajuste. Une tâche de 5 jours ouvrés à 60 % que vous passez à 10 jours ouvrés tombe à 30 %. L’application refuse une durée plus courte que le travail déjà effectué : *« Build inner cavity leaf » est déjà réalisée à 60 % : une durée plus courte que le travail déjà effectué est impossible. La durée n’a pas été modifiée.* Dans le tableau, la cellule affiche *Cette durée est plus courte que le travail déjà effectué.*

**La durée restante est arrondie.** L’application arrondit la durée restante à des jours ouvrés entiers. Pour une tâche de 2 jours ouvrés, 50 % et 75 % donnent tous deux un reste de 1 jour ouvré.

**Une phase.** Une phase n’a pas d’avancement propre. Dans le panneau, il est écrit *Dérivé des sous-tâches : modifiez l'avancement à ce niveau. La tâche récapitulative suit après le calcul (F5).* Dans le tableau, la cellule affiche *L'avancement d'une tâche récapitulative est dérivé de ses sous-tâches et ne peut pas être modifié ici.*

**Déplacer la date d’état plus tard.** Le travail restant des tâches en cours commence à la nouvelle date d’état, et le travail qui n’a pas encore commencé ne peut pas se situer avant cette date. Ne la déplacez donc qu’en même temps qu’une mise à jour de l’avancement. Si vous définissez une date d’état sans saisir également l’avancement, tout le travail qui n’a pas encore commencé est déplacé à cette date (sauf dans le profil Microsoft Project).

**Une erreur.** Chaque modification de l’avancement est une seule étape pour Ctrl+Z.

## Voir aussi

- [Avancement, date d’état et référence](docs://uitleg-voortgang) : comment l’application calcule le travail restant et la date d’état, avec un exemple.
- [Importer l’avancement depuis un tableur](docs://howto-voortgang-importeren) : lire l’avancement de plusieurs tâches en une fois.
- [Choisir le mode d'avancement](docs://howto-voortgangsmodus-kiezen) : ce que fait l’application avec une tâche qui a commencé alors que son prédécesseur est encore en cours.
- [Enregistrer et gérer une référence](docs://howto-baseline-opslaan-en-beheren) : enregistrer le planning d’origine pour y comparer l’avancement.

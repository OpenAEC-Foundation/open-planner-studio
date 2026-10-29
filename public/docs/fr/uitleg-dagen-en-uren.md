# Jours et heures

Une tâche de 2 jours et une tâche de 16 heures semblent identiques, mais l'application les calcule différemment. Pourquoi pouvez-vous choisir entre jours et heures ? Et que se passe-t-il quand une tâche en heures est liée à une tâche en jours ? Dans cet article, vous découvrez comment l'application compte les jours et les heures, et où elle arrondit. L'exemple détaillé montre les chiffres.

## Le concept

Une **tâche en jours** a une durée en jours ouvrés entiers, par exemple `5d`. Elle occupe des jours ouvrés complets. Sur le calendrier standard, elle a une date de début et une date de fin, sans heure.

Une **tâche en heures** a une durée en heures de travail, par exemple `12h` ou `1h 30m`. Elle a un début et une fin avec une heure précise, par exemple mardi 11:00.

L'unité appartient à la tâche, pas au projet. Vous pouvez mélanger, dans un même planning, des tâches en jours et des tâches en heures. On appelle cela une **planification mixte**.

Utilisez les heures pour un travail qui ne tient pas dans des jours entiers : une grue que vous louez pour douze heures, un coulage de six heures, une tâche qui ne peut commencer qu'après la pause. Pour tout le reste, les jours suffisent et sont plus clairs.

La **planification horaire** est désactivée par défaut. Tant qu'elle l'est, l'application travaille en jours. Si un fichier contient une planification horaire, par exemple des tâches en heures, l'application affiche *Ce fichier contient une planification horaire.* Ces tâches sont quand même calculées, mais vous ne pouvez modifier leur durée qu'après avoir activé la planification horaire.

## Comment l'application calcule

### Horaires de travail et jour ouvré standard

Chaque calendrier a des **plages horaires** pour chaque jour ouvré (appelées *plages* dans l'application). Le calendrier standard va de 07:00 à 12:00 et de 13:00 à 16:00. L'intervalle entre les deux est la pause. L'application déduit ces plages du *Début (heure)*, de la *Fin (heure)* et de la pause du calendrier ; vous n'avez rien à régler pour cela. Si vous définissez vos propres plages par jour de la semaine, celles-ci ont la priorité.

Le **jour ouvré standard** est le jour ouvré qui revient le plus souvent ; sa durée est la somme de ses plages. Ce n'est donc pas une moyenne : avec un lundi de 16 heures et du mardi au vendredi de 10 heures, le jour ouvré standard dure 10 heures. Si les jours ouvrés ont des durées différentes, c'est le total journalier le plus fréquent qui s'applique, et en cas d'égalité le plus élevé. Avec quatre jours de 8 heures et un vendredi de 5 heures, le jour ouvré standard dure donc 8 heures. Un calendrier avec ses propres heures par jour (par exemple issu de Primavera P6) calcule aussi avec ce total journalier, et la fenêtre du calendrier l'affiche. Sa propre valeur est conservée pour l'exportation. Si elle diffère, la fenêtre du calendrier affiche un bloc orange sous *Jour ouvré standard*. Une tâche de 1870 heures sur des plages de 10 heures dure donc 187 jours, même si sa propre valeur est de 8 heures par jour.

### Une tâche en heures

L'application compte les minutes de travail à partir du début, à travers les plages horaires. Les pauses, les soirées, les week-ends et les jours fériés ne comptent pas. Une tâche de 12 heures ne tient donc pas dans un seul jour ouvré de 8 heures : elle se poursuit le jour suivant.

### Une tâche en jours

L'application compte des jours ouvrés entiers. Le nombre d'heures par jour n'intervient pas. Une tâche de 5 jours se termine le même jour, que le calendrier ait 6 ou 8 heures par jour.

### Conversion des jours et des heures

Un jour correspond au jour ouvré standard du calendrier de la tâche. L'application l'utilise à trois endroits :

- Pour *Affichage de la durée*. Sous *Paramètres › Projet › Paramètres de l'app*, onglet *Apparence*, vous choisissez *Automatique (unité propre à chaque tâche)*, *Toujours en jours* ou *Toujours en heures*. Une tâche de 18 heures s'affiche sous *Toujours en jours* comme `2.25d(18h)` : l'unité d'origine reste entre parenthèses.
- Pour un décalage en heures après une tâche en jours (voir *Arrondi*).
- Quand vous changez l'unité d'une tâche. L'application compte alors les jours à partir du début de la tâche, chaque jour avec ses propres heures, et convertit la durée immédiatement si le résultat est exact. Deux jours deviennent `16h`. Sur un calendrier où le vendredi compte 5 heures, 5 jours à partir du lundi deviennent `37h`. Douze heures ne peuvent pas être converties en jours entiers sur un calendrier de jours de 8 heures : l'application laisse alors l'unité telle quelle.

### Tâches en jours et tâches en heures ensemble

Les règles ci-dessous s'appliquent à une relation fin-début sur un calendrier sans plages horaires propres, comme le calendrier standard.

- **Heure → heure.** Le successeur commence dès que le prédécesseur est terminé, même si c'est au milieu d'une journée.
- **Heure → jour.** Une tâche en jours ne commence jamais au milieu d'une journée. Elle commence au premier jour ouvré après le jour où la tâche en heures se termine. Le reste de ce jour reste inutilisé et revient comme marge de la tâche en heures.
- **Jour → heure.** Une tâche en jours occupe tout son dernier jour. La tâche en heures commence au premier jour ouvré qui suit, au début de la première plage horaire.

### Arrondi

L'application arrondit, ou refuse, à quatre endroits :

- **Une tâche en jours qui suit une tâche en heures** commence au jour ouvré suivant. La tâche en heures est, pour ainsi dire, arrondie à des jours entiers.
- **Un décalage en heures** se compte dans le calendrier du décalage, par défaut celui du prédécesseur. Si le prédécesseur est une tâche en jours sur un calendrier sans plages horaires propres, comme le calendrier standard, l'application convertit le décalage en jours ouvrés entiers : le décalage divisé par les heures du jour ouvré standard, arrondi à un nombre entier ; une demi-journée s'arrondit vers le haut. À 8 heures par jour, 1 heure compte pour 0 jour, 4 heures pour 1 jour et 12 heures pour 2 jours. Cela vaut aussi si le successeur est une tâche en heures. Si le prédécesseur est une tâche en heures, ou si son calendrier a ses propres plages horaires, le décalage se compte exactement dans les horaires de travail et la pause ne compte pas.
- **Une durée en jours** est toujours un nombre entier. Si vous tapez `1.5d`, l'application affiche *Saisissez un nombre entier de jours ou d’heures, par exemple 2d ou 12h.* Une durée en heures peut être `1.5h` ou `1h 30m`.
- **Changer d'unité** n'a lieu que si le résultat est exact (voir ci-dessus).

## Exemple détaillé : la grue

Le calendrier va du lundi au vendredi de 07:00 à 12:00 et de 13:00 à 16:00 : un jour ouvré standard de 8 heures. Le projet commence le lundi 7 juin 2027.

### Heure, heure et jour

*Place crane* dure 12 heures. Le lundi a des horaires de travail de 8 heures (5 jusqu'à 12:00 et 3 après la pause) et le mardi les 4 dernières heures. La tâche court du lundi 07:00 au **mardi 8 juin 11:00**.

*Adjust elements* dure 8 heures et suit avec une relation fin-début. Elle commence tout de suite le mardi à 11:00 : cela fait 1 heure jusqu'à la pause et 3 heures après. Les 4 dernières heures tombent le mercredi de 07:00 à 11:00. La fin est le **mercredi 9 juin 11:00**.

*Finishing* dure 2 jours et suit *Adjust elements*. Une tâche en jours ne commence pas au milieu d'une journée, donc elle commence le **jeudi 10 juin** et se termine le vendredi 11 juin.

### Arrondi à la transition

Si vous omettez *Adjust elements* et liez *Finishing* directement à *Place crane*, *Finishing* commence le mercredi 9 juin et se termine le jeudi 10 juin. Le reste des horaires de travail du mardi (4 heures) ne peut pas être utilisé. Vous retrouvez ces 4 heures comme marge totale de *Place crane* : un demi-jour ouvré.

Inversez l'ordre et c'est plus simple. *Pour foundation* dure 2 jours, du lundi 7 au mardi 8 juin. *Place crane* dure maintenant 4 heures et suit. Elle commence le **mercredi 9 juin à 07:00** et se termine à 11:00.

### Un décalage en heures

Entre *Place crane* (12 heures) et *Adjust elements* (8 heures), vous ajoutez un décalage de 2 heures. *Adjust elements* ne commence alors pas à 11:00, mais le mardi à **14:00** : 1 heure jusqu'à la pause et 1 heure après. La fin se décale jusqu'au **mercredi 9 juin 14:00**.

Après une tâche en jours, un décalage fonctionne autrement. *Pour foundation* se termine le mardi 8 juin. Sans décalage, *Finishing* commence le mercredi 9 juin. Avec un décalage de 4 heures, cela fait une demi-journée, et l'application arrondit vers le haut : *Finishing* commence le **jeudi 10 juin**. Avec un décalage de 1 heure, l'application arrondit vers le bas, et *Finishing* commence simplement le mercredi.

### Un vendredi après-midi libre

Le vendredi n'a maintenant qu'une seule plage, de 07:00 à 12:00 : 5 heures. Les autres jours restent à 8 heures. Le jour ouvré standard reste de 8 heures, car c'est le total journalier le plus fréquent. Une semaine compte maintenant 37 heures de travail.

Une tâche de 40 heures à partir du lundi 7 juin 07:00 occupe du lundi au jeudi (32 heures) et le vendredi (5 heures). Les 3 dernières heures tombent le lundi suivant, de 07:00 à 10:00. La fin est le **lundi 14 juin 10:00**. Une tâche de 5 jours occuperait 37 heures à partir du lundi, et c'est ce que l'application propose si vous changez l'unité de 5 jours en heures.

Dans le tutoriel 4, sur la planification horaire, vous planifiez vous-même un chantier de grue en heures.

## Conséquences et malentendus

**« 8 heures font 1 jour. »** Seulement si le calendrier a des jours de 8 heures. Sur le calendrier avec le vendredi après-midi libre, 5 jours font 37 heures, et non 40.

**« Si je définis plus d'heures par jour, ma tâche en jours se termine plus tôt. »** Non. Une tâche en jours compte des jours ouvrés entiers. Les heures par jour changent seulement la valeur d'un jour en heures, par exemple dans l'affichage et pour un décalage en heures. Seulement pour une tâche avec des ressources et le type de tâche *Travail fixe* ou *Unités fixes*, la durée change avec elles, car le travail reste le même : 40 heures de travail font 5 jours à 8 heures par jour, et 7 jours à 6 heures par jour.

**« Une tâche de 8 heures dure une journée. »** Seulement si elle commence au début de la journée. Si elle commence plus tard, comme *Adjust elements* le mardi à 11:00, elle se poursuit le jour suivant.

**Un calendrier avec ses propres plages horaires** se comporte autrement que le calendrier standard. Vous obtenez un tel calendrier en réglant des horaires de travail par jour de la semaine ou en choisissant un préréglage d'équipes (*2 équipes*, *3 équipes*, *Équipe de nuit* ou *24/7*). Sur un tel calendrier, un décalage en heures se compte exactement dans les horaires de travail, aussi après une tâche en jours.

**Désactiver la planification horaire** ne supprime rien. Les tâches en heures restent et sont toujours calculées, mais vous ne pouvez pas les modifier tant que vous ne réactivez pas la planification horaire.

## Voir aussi

- [Activer la planification horaire](docs://howto-urenplanning-aanzetten) : les étapes pour planifier une tâche en heures.
- [Régler les horaires de travail](docs://howto-werktijden-instellen) : ajuster les plages horaires d'un calendrier.
- [Calendriers et jours ouvrés](docs://uitleg-kalenders) : comment l'application compte les jours ouvrés et quel calendrier l'emporte.
- [Ajouter des relations](docs://howto-relaties-leggen) : les étapes pour ajouter une relation ou un décalage.

# Gérer les ressources

Objectif : créer, modifier et supprimer des ressources (personnes, machines et matériaux) dans votre projet, pour pouvoir les affecter à des tâches.

## Quand vous en avez besoin

Avant de placer un maçon ou une grue sur une tâche, cette personne ou cette machine doit exister comme ressource. La ressource indique combien il en existe et les jours où elle travaille. Ainsi, l'application calcule si vous en demandez trop un même jour. Vous modifiez une ressource quand l'effectif change, par exemple quand un deuxième maçon rejoint le chantier.

Deux termes. **Unités max** est la capacité par jour ouvré : 1 correspond à une personne ou une machine, 2 à deux d'entre elles. Une **affectation** est une ressource sur une tâche (voir [Affecter des ressources avec une courbe](docs://howto-resource-toewijzen)).

## Étapes

### Créer une ressource

1. Choisissez *Ressources › Gérer › Nouvelle ressource*. Le panneau des ressources prend toute la zone de travail et une ligne vide apparaît en bas du tableau. Vous pouvez aussi ouvrir le panneau avec *Ressources › Gérer › Ressources*, puis choisir *Nouvelle ressource dans le projet*.
2. Tapez le nom, par exemple *Bricklayer*.
3. Choisissez le *Type* : *Main-d'œuvre* (par défaut), *Matériel*, *Matériau*, *Sous-traitant* ou *Équipe*.
4. Remplissez les autres champs si nécessaire. Tout a une valeur par défaut : *Unités max* vaut 1 et *Calendrier* vaut *Calendrier du projet*. *Tarif/heure* est vide. Vous ne pouvez renseigner *Unité* que pour le type *Matériau*, par exemple m³.
5. Appuyez sur Entrée ou cliquez en dehors de la ligne. La ressource apparaît dans le tableau. Avec Entrée, une ligne vide s'ouvre tout de suite sous elle pour la suivante. Appuyez sur Échap quand vous avez terminé.

La ligne ne devient une ressource qu'une fois qu'elle a un nom. Avec Échap, ou si vous cliquez ailleurs sans nom, l'application ne crée rien. L'ordre de saisie n'a pas d'importance : vous pouvez choisir le type d'abord, puis taper le nom.

### Modifier une ressource

Modifiez les champs dans la ligne. L'application enregistre le nom, le tarif et l'unité quand vous quittez le champ, et les autres champs tout de suite.

- L'application n'accepte *Unités max* que si la valeur est supérieure à 0. Avec 0 ou une valeur inférieure, le champ reçoit une bordure rouge et revient à la valeur précédente.
- *Calendrier* détermine les jours où la ressource travaille. Choisissez *Calendrier du projet* ou un calendrier propre. Avec *+ Calendrier de ressource*, vous créez un nouveau calendrier, et le crayon (*Modifier…*) ouvre le calendrier choisi. Si une tâche travaille un jour où la ressource ne travaille pas selon son calendrier, ce jour compte comme surallocation. La création d'un calendrier de ressource est décrite dans [Configurer un calendrier de ressource](docs://howto-resourcekalender-instellen).
- *Tarif/heure* et *Total* : *Total* est le nombre d'heures de charge de cette ressource multiplié par le tarif. Un plâtrier chargé de 32 heures avec un tarif de 50 par heure arrive à 1 600,00. En bas du tableau se trouve la somme de toutes les ressources.
- *Équipe* regroupe une ressource sous une ressource de type *Équipe*. Il s'agit seulement d'un regroupement : l'application n'additionne ni la capacité ni la charge des membres dans l'équipe.
- La pastille colorée à gauche est la couleur de la ressource. Elle sert seulement à l'affichage et n'a aucun effet sur le planning.

### Capacité qui change dans le temps

Votre deuxième maçon n'arrive-t-il que le 19 juillet ? Cliquez sur la flèche à côté de *Unités max*. Sous *Capacité échelonnée dans le temps*, choisissez *Ajouter une étape*. Chaque étape a une date (*À partir de*) et un nombre (*Unités max*). À partir de cette date, ce nombre s'applique. Sans étapes, la valeur fixe s'applique toujours.

Une nouvelle étape commence à la date du jour avec 1 unité. Modifiez les deux, sinon une capacité de 1 s'applique dès aujourd'hui.

### Supprimer une ressource

1. Cliquez sur la corbeille dans la ligne.
2. Si la ressource a des affectations, l'application demande une confirmation, par exemple *« Bricklayer » a 4 affectation(s) — supprimer ?* Cliquez sur la coche pour supprimer ou sur la croix pour annuler. Sans affectations, la ressource disparaît tout de suite.

Les affectations de la ressource disparaissent avec elle. Si une tâche a un type de tâche autre que *Durée et unités fixes*, l'application répartit le travail de la ressource supprimée entre les ressources restantes. Selon le type de tâche, cela modifie leurs unités ou la durée de la tâche. Si la durée change, le planning n'est plus à jour.

Vous pouvez annuler la création, la modification et la suppression avec *Annuler* (Ctrl+Z).

### La petite vue d'ensemble dans la colonne latérale

*Ressources › Gérer › Dock ressources* affiche une vue d'ensemble compacte dans la colonne de droite, à côté de *Propriétés*. Là, vous voyez le nom et la couleur de chaque ressource, et un signe d'avertissement (*Surchargé*) à côté d'une ressource en surallocation. Vous ne pouvez modifier que *Unités max* ici. Si vous sélectionnez une ou plusieurs tâches, la vue d'ensemble n'affiche que les ressources de ces tâches.

## Pièges et ce que fait l'application

**Seul le type *Matériau* change le calcul.** Main-d'œuvre, Matériel, Sous-traitant et Équipe sont traités de la même façon. Le matériau ne compte pas dans la durée d'une tâche et n'est pas nivelé. Dans l'histogramme, la ligne *Toutes les ressources* ne compte pas non plus le matériau.

**Pas de nom, pas de ressource.** Une ligne vide disparaît sans laisser de trace.

**Une nouvelle étape de capacité.** Si vous oubliez de changer la date et le nombre, la capacité vaut 1 à partir d'aujourd'hui.

**Supprimer une ressource encore nécessaire.** Si vous la supprimez par erreur, appuyez tout de suite sur Ctrl+Z. Les affectations reviennent aussi.

## Voir aussi

- [Affecter des ressources avec une courbe](docs://howto-resource-toewijzen) : placer une ressource sur une tâche.
- [Configurer un calendrier de ressource](docs://howto-resourcekalender-instellen) : fixer les jours de travail d'une ressource.
- [Résoudre la surallocation](docs://howto-overbezetting-oplossen) : que faire quand une ressource a trop à faire sur un jour.
- [Panneau des ressources](docs://ref-resourcepaneel) : tous les champs et boutons du panneau des ressources.

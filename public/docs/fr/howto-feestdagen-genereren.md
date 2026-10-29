# Générer les jours fériés et le congé du bâtiment

Objectif : remplir un calendrier avec les jours fériés d'un pays et, si besoin, le congé du bâtiment. Ajoutez aussi, si nécessaire, un jour ou une durée de congé de votre choix.

## Quand vous en avez besoin

Sans jours fériés, l'application planifie simplement du travail à Noël ou au Jour du Roi. Un nouveau projet reçoit déjà les jours fériés néerlandais, à condition que *Mode construction* soit activé. Vous générez de nouveau les jours fériés si vous avez besoin d'un autre pays ou d'une autre région, si vous voulez inclure le congé du bâtiment, ou si votre projet sort des années pour lesquelles des jours fériés ont été créés. Ces années comptent : pour l'application, un jour en dehors de ces années est simplement un jour ouvré. Comment l'application tient compte d'un jour férié lors du calcul, vous pouvez le lire dans [Calendriers et jours ouvrés](docs://uitleg-kalenders).

Le **congé du bâtiment** (*bouwvak*) est le congé collectif du secteur néerlandais de la construction, trois semaines en été. Dans l'application, il est désactivé par défaut.

## Étapes

### Générer les jours fériés

1. Choisissez *Planification › Calendrier › Calendrier* et sélectionnez à gauche le calendrier dans lequel les jours fériés doivent entrer.
2. Cliquez sur *Générer les jours fériés…*. Sous le bouton, un bloc avec les choix s'ouvre.
3. Choisissez le *Pays* : Pays-Bas, Allemagne, Belgique, France, Royaume-Uni, Autriche, Suisse, ou *Aucun jour férié*. Pour certains pays, une liste *Région* apparaît aussi, par exemple un Land en Allemagne. *National* ne garde que les jours fériés valables partout.
4. Pour les Pays-Bas, choisissez *Congés du bâtiment* : *Aucun* (par défaut), *Nord*, *Centre* ou *Sud*. Le congé du bâtiment apparaît comme une seule ligne dans la liste, par exemple *Congés du bâtiment (Nord)*, trois semaines du lundi au vendredi. Vous ne voyez ce choix que si *Mode construction* est activé.
5. Sous les choix, un résumé s'affiche, par exemple *21 jours fériés, 2026–2028*. Cliquez dessus pour voir les dates.
6. Cliquez sur *Générer*. La liste *Jours fériés* est maintenant remplie.
7. Cliquez sur *Appliquer*. L'application recalcule le planning tout de suite.

Pour les Pays-Bas, l'application ajoute chaque année à la liste le Nouvel An, le Vendredi saint, Pâques (deux jours), le Jour du Roi, l'Ascension, la Pentecôte (deux jours) et Noël (25 et 26 décembre). Si le Jour du Roi tombe un dimanche, il a lieu le 26 avril. Le Jour de la Libération n'est dans la liste que les années multiples de cinq, comme 2025 et 2030.

Les années suivent les dates du projet : de l'année précédant la date de début à l'année suivant la date de fin. Si le projet n'a pas de date de fin, jusqu'à trois ans après l'année de début. Vous adaptez le début et la fin sous *Paramètres › Projet › Paramètres du projet*.

### Régénérer après un changement des dates du projet

Si votre projet se décale, ou reçoit une date de fin plus tardive, les jours fériés ne couvrent plus les nouvelles années. L'application l'indique dans la fenêtre *Calendriers*, par exemple *Les jours fériés couvrent 2025–2028 ; régénérer jusqu'à 2030 inclus ?* Cliquez ensuite sur *Régénérer*. L'application reprend les mêmes choix que la fois précédente (pays, région, congés du bâtiment) pour les années du projet. Cliquez ensuite sur *Appliquer*. Vous ne voyez ce message que pour un calendrier dont les jours fériés ont été générés auparavant.

### Ajouter votre propre jour ou durée de congé

1. Dans la fenêtre *Calendriers*, cliquez sur *Ajouter un jour férié*. En bas de la liste apparaît une nouvelle ligne, avec la date du jour sous *À partir de*.
2. Remplissez le champ *Description*, par exemple *Sortie d'entreprise*.
3. Ajustez *À partir de*. Laissez *Au* vide pour un seul jour, ou indiquez le dernier jour de la durée de congé, par exemple pour des vacances d'hiver.
4. Cliquez sur *Appliquer*.

Avec la corbeille à la fin d'une ligne, vous supprimez un jour férié.

### Supprimer tous les jours fériés

Choisissez *Aucun jour férié* sous *Pays*, puis cliquez sur *Générer*. La liste est alors vide.

## Pièges et ce que fait l'application dans ce cas

**Générer remplace toute la liste.** Les jours que vous avez ajoutés vous-même disparaissent aussi. Ajoutez-les de nouveau ensuite.

**Le Vendredi saint est inclus.** Si votre entreprise travaille le Vendredi saint, ou le Jour de la Libération une année multiple de cinq, supprimez cette ligne avec la corbeille.

**Les dates des congés du bâtiment sont indicatives.** L'application les connaît pour 2025 jusqu'à 2028 inclus ; pour les autres années, elle fait une estimation approximative. Si vous choisissez un congé du bâtiment, elle affiche donc *Dates indicatives — à vérifier auprès de Bouwend Nederland*. Ajustez les dates de la ligne dans la liste si nécessaire.

**Une ligne non valide.** Une ligne sans *À partir de* valide, un *Au* antérieur à *À partir de* ou une date illisible affiche un message rouge, par exemple *La date de fin est antérieure à la date de début.* *Appliquer* reste désactivé tant que vous n'avez pas corrigé la ligne.

**Pour un nouveau projet.** La fenêtre *Nouveau projet* propose les mêmes choix sous *Jeu de jours fériés*. Avec *Personnalisé…*, vous commencez sans jours fériés ; après la création, la fenêtre *Calendriers* s'ouvre pour que vous les saisissiez vous-même.

## Voir aussi

- [Calendriers et jours ouvrés](docs://uitleg-kalenders) : comment l'application tient compte des jours fériés et du congé du bâtiment lors du calcul des jours ouvrés.
- [Créer et attribuer un calendrier](docs://howto-kalender-maken-en-toewijzen) : créer votre propre calendrier pour y ajouter des jours fériés.
- [Fenêtres des calendriers](docs://ref-kalenders) : tous les champs des fenêtres de calendrier.
- [Nouveau projet et Paramètres du projet](docs://ref-projectinfo) : le jeu de jours fériés pour un nouveau projet.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) : à côté des jours fériés, le calendrier du projet comporte une durée de congé *Frost delay, foundations*.

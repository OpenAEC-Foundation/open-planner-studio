# Filtres

La fenêtre **Filtre** contrôle quelles tâches sont visibles — dans le Gantt et sur l'onglet Tableau. Un filtre se compose de règles (champ + opérateur + valeur), éventuellement regroupées en groupes.

## Ouverture

**Affichage** → groupe de ruban **Affichage** → **Filtre…**. Le bouton reste en surbrillance tant qu'un filtre est actif. **Échap**, la croix de fermeture ou un clic en dehors de la fenêtre ferme sans appliquer.

## Groupes : toutes ou une

En haut de chaque groupe, vous choisissez comment ses règles se combinent :

- **Toutes les conditions suivantes (AND)** — une tâche doit correspondre à chaque règle.
- **Une des conditions suivantes (OR)** — correspondre à une seule règle suffit.

**+ règle** ajoute une règle ; **+ groupe** (niveau supérieur uniquement) ajoute un groupe imbriqué, ce qui vous permet de combiner AND et OR — par exemple « Critique est oui ET (Type est Construction OU Type est Installation) ». Sans règles, la fenêtre affiche : « Aucune règle pour l'instant — ce filtre correspond à tout. »

## Une règle : champ, opérateur, valeur

- **Champ** — tous les champs de tâche : WBS, Nom de la tâche, Durée, Début, Fin, Type, Critique, Marge totale, Avancement, Jalon, Marge libre, Marge interférente, Quasi critique, Chemin de marge et Ressources, ainsi que les codes d'activité et champs personnalisés du projet.
- **Opérateur** — s'adapte au type de champ :
- texte : **égal à**, **différent de**, **contient**, **commence par**, **est vide** ;
- nombre et date : en plus **inférieur à**, **inférieur ou égal à**, **supérieur à**, **supérieur ou égal à** et **entre** (avec **De**/**À**) ;
- champs oui/non (comme Critique et Jalon) : un choix **Oui**/**Non** ;
- champs à choix (comme Type ou un code d'activité) : **est l'un des**, avec des valeurs cochables.
- **Valeur** — la saisie suit le type de champ (zone de texte, nombre, date ou sélecteur) ; **est vide** n'a pas de saisie de valeur.

L'icône de corbeille derrière une règle supprime cette règle ; la croix en haut à droite d'un groupe imbriqué supprime le groupe entier.

## Appliquer, annuler et effacer

- **Appliquer** active le filtre et ferme la fenêtre. Un filtre sans règles compte comme « aucun filtre ».
- **Annuler** ferme sans appliquer les modifications.
- **Effacer** désactive immédiatement le filtre actif et vide l'éditeur.

Un filtre actif fait partie d'un layout enregistré — voir [Enregistrer et charger des layouts](docs://ref-layouts).

## Poursuivre la lecture

- [Choisir les colonnes](docs://ref-kolommen) — quelles colonnes le tableau affiche.

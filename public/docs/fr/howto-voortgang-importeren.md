# Importer l'avancement depuis une feuille

Objectif : mettre en une seule fois dans le planning l'avancement que le personnel de chantier saisit dans une feuille, sans cliquer vous-même sur chaque tâche.

## Quand vous en avez besoin

Un sous-traitant ou un chef de chantier n'a pas l'application, mais il signale son état chaque semaine : quel pourcentage est fait, quand il a commencé et quand il a fini. Vous lui envoyez une feuille avec vos tâches. Il remplit trois colonnes et vous la renvoie. L'application ne lit alors que trois valeurs par tâche : l'avancement, le début réel et la fin réelle. Le reste de votre planning reste intact. Ce que l'application fait de cet avancement est expliqué dans [Avancement, date d'état et référence](docs://uitleg-voortgang).

## Étapes

### 1. Définissez la date d'état et calculez le planning

Définissez la date d'état comme décrit dans [Mise à jour de l'avancement](docs://howto-voortgang-bijwerken). Le chef de chantier saisit les dates réelles jusqu'à ce jour inclus. Si le planning n'est pas à jour, l'application le recalcule avant de créer la feuille.

### 2. Créez la feuille

Choisissez *Planification › Avancement › Exporter la feuille d’avancement*. Le même bouton se trouve sur les onglets *Tableau* et *Rapport*. L'application crée un fichier Excel et propose le nom *(nom du projet)-voortgang.xlsx*. Dans le navigateur, le fichier arrive dans vos téléchargements. Vous préférez un CSV ? Choisissez *Fichier › Exporter › Feuille d’avancement (CSV)*. La feuille Excel est là aussi, sous le nom *Feuille d’avancement (Excel)*.

La feuille contient huit colonnes. Les noms de colonnes restent en anglais, suivis d'une courte instruction dans la langue de l'application :

- `OPS Task ID`, `WBS` et `Name` servent seulement à reconnaître la tâche. Ne les modifiez pas.
- `Start` et `Finish` sont les dates planifiées, à titre indicatif. L'application ne les réécrit jamais.
- `Completion (%)`, `Actual Start` et `Actual Finish` sont les colonnes que vous remplissez.

La feuille Excel est protégée, sans mot de passe : seules les trois colonnes à remplir peuvent être modifiées. Excel vérifie qu'un pourcentage se situe entre 0 et 100 et qu'une date réelle est bien une date. Une phase (tâche récapitulative) est marquée en gris avec *— tâche récapitulative : ne pas remplir*.

### 3. Faites remplir la feuille

Pour chaque tâche, le chef de chantier remplit :

- `Completion (%)` : de 0 à 100 inclus. L'application lit aussi les décimales, avec une virgule ou un point (par exemple 33,3 ou 33.3). L'instruction du CSV demande toutefois des nombres entiers : un tableur avec un autre réglage régional peut lire 8,38 comme 838.
- `Actual Start` et `Actual Finish` : dans Excel, sous forme de date selon vos paramètres régionaux ; dans le CSV, au format dd-mm-yyyy ou yyyy-mm-dd.

Ce qui reste vide ne change rien. Une cellule vide n'efface donc pas non plus l'avancement existant ; cela ne se fait que dans l'application. Pour une tâche qui n'a pas commencé, laissez les cellules entièrement vides.

### 4. Importez la feuille

1. Choisissez *Planification › Avancement › Mettre à jour l'avancement depuis une feuille* (aussi sur les onglets *Tableau* et *Rapport*), ou *Fichier › Importer › Mettre à jour l'avancement depuis une feuille*. La fenêtre *Mettre à jour l'avancement depuis une feuille* s'ouvre.
2. Cliquez sur *Choisir un fichier…* et choisissez le fichier `.xlsx` ou `.csv` rempli.
3. Si les dates d'un CSV sont ambiguës, l'application demande *Jour d'abord ou mois d'abord ?*, avec la date de votre fichier lue de deux façons. Cliquez sur la date correcte.
4. Vous voyez maintenant un aperçu. En haut, il y a quatre compteurs : *Appliqué*, *Inchangé*, *En attente de liaison* et *Refusé*. Plus bas, par tâche, ce qui change, par exemple *Avancement : 0% → 100%*.
5. Vérifiez l'aperçu et cliquez sur *Appliquer*. La fenêtre affiche *Résultat*, avec les compteurs, les lignes refusées et la raison de chaque refus. Terminez par *Fermer*.

Vous ne pouvez pas sauter l'aperçu. Le bouton *Appliquer* est désactivé tant qu'il n'y a rien à appliquer.

### 5. Recalculez le planning

L'importation ne recalcule pas le planning d'elle-même. Appuyez sur **Calculer** (F5), par exemple via *Planification › Planification › Calculer*, sauf si *Calculer automatiquement* est activé.

## Lignes qui ne correspondent pas directement

L'application lie chaque ligne à une tâche : d'abord sur `OPS Task ID`, sinon sur le numéro WBS.

**Liaison incertaine.** Si l'application a trouvé la tâche seulement par numéro WBS, la ligne se trouve sous *Liaison incertaine*, avec *Confirmer* et *Modifier*. La ligne est aussi appliquée si vous ne faites rien ; vérifiez donc que la tâche est la bonne. *Confirmer* retire la ligne de cette liste ; cela ne change rien à ce qui est appliqué. *Modifier* vous permet de choisir une autre tâche. Avec *Effacer la liaison*, vous supprimez une liaison que vous avez faite vous-même. Remarque : une feuille d'un autre projet avec les mêmes numéros WBS est tout de même liée, sous *Liaison incertaine*, et appliquée quand vous cliquez sur *Appliquer*.

**En attente de liaison.** Si l'application n'a trouvé aucune tâche, ou plusieurs tâches avec le même numéro WBS, la ligne se trouve sous *En attente de liaison*. Sous *Choisir une tâche…*, choisissez la bonne tâche ; vous cherchez par numéro WBS ou par nom. Si vous ne la liez pas, la ligne est refusée.

## Pièges et ce que fait l'application

Une ligne qui ne convient pas est refusée, avec une raison. Le reste de la feuille continue. Voici les principaux messages :

- *La date réelle est postérieure à la date d'état.* Définissez une date d'état plus tardive ou corrigez la feuille.
- *Cette tâche est planifiée pour commencer après la date d'état : saisissez d'abord son début réel dans la feuille.* L'application n'invente pas de début ; fournissez-le dans la feuille.
- *Pourcentage hors de 0–100. Vérifiez le séparateur décimal : dans un tableur avec une autre langue, « 8,38 » peut être lu comme 838.*
- *Les tâches récapitulatives ne peuvent pas recevoir d'avancement d'une feuille.* L'avancement d'une phase découle des tâches situées en dessous.
- *La fin réelle précède le début réel.*
- *Date illisible.* et *Pourcentage illisible.*
- *Les valeurs saisies se contredisent.* Par exemple une fin réelle avec un pourcentage inférieur à 100.
- *Aucune tâche trouvée pour cette ligne.* La feuille mentionne un identifiant de tâche et un numéro WBS qui n'existent pas dans ce projet.
- *Ce code WBS apparaît sur plusieurs tâches — liez la ligne manuellement.*
- *Une autre ligne a déjà revendiqué cette tâche.* Deux lignes pointent vers la même tâche.
- *Refusé par le planificateur.* Un autre refus venant du planning lui-même, sans message propre.

Si tout le fichier est refusé, l'un de ces messages apparaît dans la fenêtre : *Ce fichier n'a pas de colonne « OPS Task ID » ni « WBS » pour lier les lignes aux tâches.*, *Ce fichier n'a aucune des colonnes Avancement, Début réel ou Fin réelle.*, *Ce fichier est trop volumineux pour être lu comme feuille d'avancement.* (plus de 16 Mo), *Ce fichier contient trop de lignes pour être lu comme feuille d'avancement.* (plus de 50 000 lignes), *Ce fichier est protégé par mot de passe et ne peut pas être lu.* ou *Ce fichier n'a pas pu être lu comme feuille d'avancement.*

**Pas de date d'état.** S'il n'y a pas encore de date d'état et que l'import applique de l'avancement, l'application la fixe à aujourd'hui et vous le signale. Définissez-la donc vous-même au préalable.

**Tout annuler d'un seul coup.** La feuille entière correspond à une seule étape pour Ctrl+Z.

**Seulement ce que vous remplissez.** Une ligne sans différence avec le planning apparaît comme *Inchangé*. Une tâche sans ligne dans la feuille reste telle qu'elle était.

## Voir aussi

- [Avancement, date d'état et référence](docs://uitleg-voortgang) : ce que l'application calcule avec les dates réelles et les pourcentages.
- [Mise à jour de l'avancement](docs://howto-voortgang-bijwerken) : saisir l'avancement directement dans l'application.

# Exporter

But : transmettre votre planning sous forme de fichier dans un autre format, à quelqu'un qui ne lit pas IFC ou pour un autre logiciel.

## Quand en avez-vous besoin

Le consultant travaille dans MS Project, le client dans Primavera, le sous-traitant veut les tâches dans Excel, ou vous envoyez un planning à un logiciel qui ne sait pas lire IFC. Un export est une copie dans un autre format. Si vous voulez garder votre projet lui-même, enregistrez-le : cela écrit du IFC et conserve tout. Ce que chaque format transporte, et ce qu'il ne transporte pas, se trouve dans [Fichiers et formats](docs://uitleg-bestanden).

## Étapes

1. Choisissez *Accueil › Fichier › Exporter* et sélectionnez un format dans la liste, ou choisissez *Fichier › Exporter*. Là, chaque format est une carte avec une courte description.
2. Dans la fenêtre, choisissez un nom et un emplacement. L'application propose le nom du projet, avec l'extension du format. Les feuilles d'avancement s'appellent *nomduprojet-voortgang* et sont enregistrées dans votre dossier de téléchargements si c'est possible.
3. Confirmez. Aucun message n'apparaît si l'export réussit, sauf les messages ci-dessous. Depuis *Fichier › Exporter*, vous revenez ensuite à l'onglet *Accueil*, même si vous annulez la fenêtre. Si vous annulez la fenêtre pour un export depuis la liste de l'onglet *Accueil*, il ne se passe rien.

Si votre navigateur n'enregistre que par un téléchargement (comme Firefox), le fichier se trouve dans votre dossier de téléchargements juste après l'étape 1. Vous voyez le message *Enregistré sous forme de téléchargement : 'name.xml' se trouve maintenant dans votre dossier de téléchargements. Cet environnement ne permet pas à l'application d'écrire directement à l'emplacement choisi.*

### Quel format choisissez-vous ?

La liste de l'onglet *Accueil* et les cartes de *Fichier › Exporter* proposent les mêmes formats :

- *Avancement (Excel)* et *Avancement (CSV)*, sur les cartes *Feuille d’avancement (Excel)* et *Feuille d’avancement (CSV)* : une feuille simplifiée avec id, WBS, nom, dates et avancement, à faire circuler auprès de la personne qui renseigne l'avancement.
- *CSV (;)*, sur la carte *CSV (séparé par des points-virgules)* : une liste de tâches que vous ouvrez dans un tableur.
- *MS Project XML* : peut s'ouvrir dans Microsoft Project.
- *Primavera P6 XML* : pour Oracle Primavera P6.
- *IFC* : le format propre à l'application, qui contient tout, dans le schéma IFC du projet (par défaut IFC 4.3 ADD2).

### Un export IFC avec un fichier de bibliothèque

Si votre projet est lié à une bibliothèque de ressources, la case *Enregistrer aussi le fichier de bibliothèque* se trouve sous les cartes de *Fichier › Exporter*. Si vous la cochez et choisissez *IFC*, l'application demande un emplacement deux fois : d'abord pour le projet, puis pour *nomduprojet-bibliotheek.ifc*. Cette case n'est que dans *Fichier › Exporter*, pas dans la liste de l'onglet *Accueil*.

### Relire une feuille d'avancement

Vous relisez une feuille d'avancement remplie via *Fichier › Importer*. Voir [Importer l'avancement depuis un tableur](docs://howto-voortgang-importeren).

## Pièges et ce que fait alors l'application

**Votre projet ne change pas.** Le fichier de votre projet reste le même, et le marqueur *Non enregistré* reste s'il était là.

**Un planning non à jour est d'abord recalculé.** Vous obtenez donc les dates actuelles, même si vous avez oublié d'appuyer sur *Calculer*.

**Un export figure aussi dans Récents.** Cela ne s'applique pas aux feuilles d'avancement. Si vous ouvrez un export depuis là, il s'ouvre comme un import de ce format.

**Un export ne contient pas tout.** Un fichier CSV ne contient ni ressources ni contraintes, et P6 XML ne contient ni références ni échéances. Le profil de calcul ne suit pas non plus : un export rouvert se calcule comme *Open Planner Studio*. Seul IFC contient tout. Vous trouvez un exemple avec des chiffres dans [Fichiers et formats](docs://uitleg-bestanden).

**Deux formats avec la même extension.** MS Project XML et Primavera P6 XML reçoivent tous deux le nom *nomduprojet.xml*. Donnez-leur vous-même des noms différents, sinon vous ne saurez pas plus tard quel fichier correspond à quel format.

**Un planning avec une relation circulaire n'est pas exporté.** L'application calcule d'abord et s'arrête s'il y a une boucle. Dans l'onglet *Accueil*, vous voyez le message *Le planning n'a pas pu être calculé*, avec en dessous par exemple *Dépendance circulaire entre les tâches : Set up site → Demolish existing extension → Set up site*. Dans *Fichier › Exporter*, seul ce second texte figure sur la page. Supprimez la boucle et exportez de nouveau.

**Un projet venant de Primavera perd des informations source.** Si vous exportez un tel projet en CSV, MS Project XML ou P6 XML, l'application affiche : *L’export vers CSV entraîne la perte d’informations source XER.* Pour MS Project XML, il affiche *MSPDI*, pour P6 XML *P6*. Voir [Ouvrir un fichier Primavera P6 (.xer)](docs://howto-xer-openen).

**Les tâches fractionnées perdent leurs fractionnements.** MS Project et Primavera ne connaissent un fractionnement que comme répartition des heures. Si votre projet contient des tâches fractionnées sans répartition des heures, l'application affiche après un export vers MS Project XML ou P6 XML : *2 tâches avec interruptions ont été exportées sans leurs interruptions : MS Project/P6 ne les connaissent que comme répartition du travail.* Pour une seule tâche, il affiche *1 tâche avec interruptions a été exportée sans ses interruptions : MS Project/P6 ne les connaissent que comme répartition du travail.* Voir [Fractionner une tâche](docs://howto-taak-splitsen).

**Un planning dans la vue *Dates telles qu'enregistrées*.** Si vous exportez en CSV pendant que vous voyez les dates du fichier source, l'application laisse vides `Critical` et `Total Float` pour les tâches pour lesquelles le fichier source ne l'a pas enregistré. Voir [Dates telles qu'enregistrées](docs://uitleg-datums-zoals-opgeslagen).

## Voir aussi

- [Fichiers et formats](docs://uitleg-bestanden) : ce que chaque format contient et ne contient pas.
- [Ouvrir et enregistrer un fichier](docs://howto-bestand-openen-en-opslaan) : garder votre projet lui-même en IFC.
- [Importer l'avancement depuis un tableur](docs://howto-voortgang-importeren) : relire une feuille d'avancement remplie.
- [Formats d'import et d'export](docs://ref-import-exportformaten) : pour chaque format, ce qui est transporté et ce qui ne l'est pas.

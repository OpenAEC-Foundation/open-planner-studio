# Rapports & impression

Un planning n'est terminé que lorsque vous pouvez le partager — sur papier pour une réunion de chantier, en image dans une présentation, ou comme aperçu de ce qui arrive et de ce qui a déjà glissé. C'est à cela que sert l'onglet **Rapport**, avec trois types de rapport et un aperçu avant impression.

## Ce que vous allez apprendre ici

- Les trois types de rapport de l'onglet **Rapport** : impression du Gantt, aperçu des jalons, variance.
- Comment fonctionne l'aperçu avant impression : format de papier, orientation et quels éléments vous activez/désactivez.
- Comment imprimer effectivement un rapport ou l'enregistrer comme fichier.
- Ce que fait **Ctrl+P** dans cette application.

## Accéder à l'écran de rapport

Il existe trois façons d'accéder au même écran : cliquez sur l'onglet de ruban **Rapport**, allez sur **Backstage → Imprimer** (qui ouvre directement l'écran de rapport), ou appuyez sur **Ctrl+P**. Les trois mènent au même endroit — il n'y a pas de boîte de dialogue « impression » séparée ; l'écran de rapport *est* l'aperçu avant impression.

L'écran est divisé en deux colonnes : un panneau de paramètres à gauche avec le sélecteur de **Type de rapport** en haut, et un aperçu en direct à droite qui se met à jour immédiatement lorsque vous modifiez les paramètres à gauche.

## Les trois types de rapport

### Impression du Gantt

Une impression complète et formatée des barres du Gantt — c'est le seul type de rapport avec un bloc de paramètres :

- **Papier** : A4, A3 ou A1.
- **Orientation** : paysage ou portrait.
- **Ajustement automatique au papier** (activé = le planning se redimensionne automatiquement à la taille choisie) ou un curseur de **zoom** manuel si vous désactivez l'ajustement automatique.
- Des interrupteurs pour **noms des tâches sur les barres**, **afficher l'avancement**, **chemin critique**, **afficher la marge**, **dépendances**, **week-ends** et **légende**.
- Un champ **entreprise** (rempli automatiquement à partir du paramètre du projet, mais modifiable séparément ici) et l'**auteur** (lecture seule, à partir des informations du projet).

Le bloc de résumé au-dessus affiche le décompte en direct des tâches, tâches feuilles, tâches critiques et relations dans le projet.

### Aperçu des jalons

Un tableau de chaque jalon du projet : WBS, nom, type (automatique/début/fin), date, la contrainte ou l'échéance sous-jacente, marge, si le jalon est obligatoire, et statut (dans les délais / critique / en retard). Le bloc de résumé affiche le nombre total de jalons, combien sont obligatoires et combien sont en retard. Ce rapport n'a pas de paramètres de format de papier/orientation — il imprime le tableau exactement tel qu'affiché.

### Variance

Compare le planning actuel à la baseline active : début/fin de la baseline par rapport au début/fin actuel, la différence en jours ouvrés pour le début et la fin, et un statut par tâche (dans les délais / en retard / en avance / nouvelle / supprimée). S'il n'y a pas de baseline active, l'écran le mentionne explicitement au lieu d'afficher un rapport vide. Le bloc de résumé affiche aussi le décalage de la date de fin du projet en jours ouvrés, s'il y en a un. Voir le guide [Baselines & avancement](docs://gids-baselines-voortgang) pour savoir comment enregistrer une baseline avant que ce rapport puisse vous apprendre quelque chose d'utile.

## Imprimer et exporter

Le panneau de paramètres a toujours un bouton **Imprimer...** en bas — il ouvre une fenêtre d'impression séparée contenant le rapport et déclenche immédiatement la boîte de dialogue d'impression du navigateur/système d'exploitation. Pour le rapport Gantt, cette fenêtre utilise le format de papier et l'orientation choisis ; les rapports de jalons et de variance impriment le tableau tel qu'affiché.

Seul le rapport Gantt dispose aussi d'un bouton **Exporter en PDF**. Celui-ci enregistre l'aperçu actuel comme un véritable fichier PDF (nom de fichier se terminant par `-planning.pdf`) — une page dimensionnée aux dimensions physiques du format de papier et de l'orientation choisis. Le fichier PDF est **vectoriel** : les barres, les lignes et le texte sont stockés comme instructions de dessin PDF plutôt que comme une seule image intégrée, il reste donc net à n'importe quel niveau de zoom et le texte est sélectionnable et consultable dans n'importe quelle visionneuse PDF. Cela s'applique au texte latin, cyrillique et grec ; si le projet contient du texte chinois, japonais, coréen, arabe ou perse, l'export bascule automatiquement vers une image matricielle pour ce texte — toujours affiché correctement, mais non sélectionnable ni consultable. Pratique pour l'e-mail ou l'archivage sans passer par la boîte de dialogue d'impression du système. Si vous préférez imprimer directement (ou enregistrer en PDF via la boîte de dialogue système, par ex. pour choisir un format de papier différent de celui configuré ci-dessus), utilisez **Imprimer...**.

## Les rapports en pratique

Chaque type de rapport sert une conversation différente :

- Le **rapport Gantt** est le document classique à distribuer en réunion de chantier : le chemin critique mis en évidence, la marge visible sur les barres non critiques, et la légende expliquant ce que signifie chaque couleur. Activez **noms des tâches sur les barres** et **afficher l'avancement** si l'audience ne connaît pas déjà le planning ; désactivez-les pour un aperçu épuré sur A1 si une liste de tâches séparée est distribuée en complément.
- L'**aperçu des jalons** est destiné à quiconque ne veut que les dates importantes sans parcourir des dizaines de lignes de tâches — par exemple un client qui veut surtout savoir si les dates de réception obligatoires sont respectées. Le symbole ◆ devant un nom de jalon dans le tableau marque un jalon **obligatoire**.
- Le **rapport de variance** est la conversation sur la correction de trajectoire : quelles tâches glissent par rapport à la baseline, et de combien de jours ouvrés. Voyez ce rapport en pratique dans le cas d'usage [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc), qui comporte deux baselines (une baseline contractuelle et une re-baseline après un avenant) avec leur propre avancement et date de statut — un bon exemple de la façon dont les colonnes Δ se remplissent dès qu'il y a une différence réelle entre la baseline et le planning actuel.

L'aperçu en direct à droite s'actualise à chaque modification des paramètres à gauche — il n'y a pas de bouton « actualiser » séparé, et rien n'est calculé uniquement au moment de l'impression.

## Poursuivre la lecture

- Un rapport de variance n'a rien à comparer tant qu'une baseline n'a pas été enregistrée — lisez le guide [Baselines & avancement](docs://gids-baselines-voortgang).
- Le chemin critique et la marge affichés sur le rapport Gantt proviennent du même calcul que la vue Gantt elle-même — lisez le guide [Chemin critique & analyse avancée](docs://gids-kritiek-pad-analyse) pour savoir comment l'interpréter.

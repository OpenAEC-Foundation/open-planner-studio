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
- **Taille de police** — 90, 100, 110 ou 125% ; met à l'échelle le texte du rapport, la hauteur des lignes et l'en-tête/pied de page, indépendamment du niveau de zoom ci-dessus.
- **Répéter l'en-tête sur chaque page** — activé par défaut ; garde l'en-tête du rapport visible sur chaque page imprimée au lieu de la première uniquement.
- **Chronologie sur** — répartit la chronologie du Gantt sur 1 à 8 pages côte à côte ; disponible uniquement avec l'ajustement automatique activé.
- Des interrupteurs pour **noms des tâches sur les barres**, **afficher l'avancement**, **chemin critique**, **afficher la marge**, **dépendances**, **week-ends** et **légende**.
- Un champ **entreprise** (rempli automatiquement à partir du paramètre du projet, mais modifiable séparément ici) et l'**auteur** (lecture seule, à partir des informations du projet).

Les lignes de relation dans le rapport utilisent le même langage visuel que la vue Gantt : une ligne **pleine** est une relation motrice, une ligne **pointillée** une relation non motrice, et une relation motrice entre deux tâches critiques est **rouge**. Désactivez *chemin critique* et ces lignes deviennent également neutres. La légende en bas résume la différence. Avant le premier calcul, chaque ligne est dessinée neutre et pleine — appuyez d'abord sur *Calculer* (F5).

Le bloc de résumé au-dessus affiche le décompte en direct des tâches, tâches feuilles, tâches critiques et relations dans le projet. Le panneau de paramètres retient vos choix d'une session à l'autre — rouvrez l'onglet Rapport plus tard et le format de papier, les interrupteurs, la taille de police et le reste reviennent exactement comme vous les aviez laissés. Seul le champ entreprise est réinitialisé : il part toujours du paramètre propre au projet, de sorte qu'un rapport ne reprend jamais le nom d'entreprise d'un autre projet.

### Aperçu des jalons

Un tableau de chaque jalon du projet : WBS, nom, type (automatique/début/fin), date, la contrainte ou l'échéance sous-jacente, marge, si le jalon est obligatoire, et statut (dans les délais / critique / en retard). Le bloc de résumé affiche le nombre total de jalons, combien sont obligatoires et combien sont en retard. Ce rapport n'a pas de paramètres de format de papier/orientation — il imprime le tableau exactement tel qu'affiché.

### Variance

Compare le planning actuel à la baseline active : début/fin de la baseline par rapport au début/fin actuel, la différence en jours ouvrés pour le début et la fin, et un statut par tâche (dans les délais / en retard / en avance / nouvelle / supprimée). S'il n'y a pas de baseline active, l'écran le mentionne explicitement au lieu d'afficher un rapport vide. Le bloc de résumé affiche aussi le décalage de la date de fin du projet en jours ouvrés, s'il y en a un. Voir le guide [Baselines & avancement](docs://gids-baselines-voortgang) pour savoir comment enregistrer une baseline avant que ce rapport puisse vous apprendre quelque chose d'utile.

## Les sept rapports tabulaires

Les autres types de rapport sont des tableaux tirés directement du dernier calcul. Ils partagent
quelques règles : seules les **tâches feuilles** comptent comme activités (les tâches récapitulatives
n'apparaissent que dans la synthèse WBS, les tâches hamac pas du tout) ; le **jour de référence** est
la date d'état du projet — sans date d'état, le rapport utilise aujourd'hui et le dit ; les dates et
marges viennent du dernier **calcul** (F5), une note signale un planning modifié depuis, et l'export
PDF recalcule toujours d'abord ; chaque rapport a un petit bloc **Options du rapport**, mémorisé
entre les sessions. Les jours ouvrés sont abrégés en *jo*.

### Prévision (look-ahead)

La liste de la réunion de chantier hebdomadaire : toutes les activités des *N* prochaines semaines
(quatre par défaut) — ce qui démarre, continue ou se termine — plus ce qui aurait déjà dû se faire.
Par ligne : WBS, nom, début et fin, durée restante, avancement, marge totale, critique ou quasi
critique, ressources affectées et un statut : **Démarre**, **En cours**, **Aurait dû démarrer** ou
**En retard**. Une activité qui couvre toute la fenêtre y figure aussi.

### Critique & quasi critique

Quelles activités déterminent la fin du projet, et lesquelles sont sur le point de le faire.
Critique vient du calcul ; *quasi critique* est une marge totale de 0 jusqu'au seuil des options
(5 jours ouvrés par défaut) ou le marquage des options de planification. Les tâches terminées sont
exclues. Tri par chemin de marge, puis marge, puis début ; avec la marge libre et le numéro de
chemin.

### Rapport d'avancement

Le point périodique « où en sommes-nous » à la date d'état. La synthèse donne la fin de référence
et la fin prévue avec l'écart en jours ouvrés, l'avancement **prévu** contre **réel** (tous deux
pondérés par la durée des tâches feuilles ; prévu sur les dates de la référence active, sinon sur
le planning actuel) et les comptages par état. Dessous, cinq sections : terminé pendant la période
écoulée, en cours, démarre pendant la prochaine période, en retard, et activités critiques ouvertes.
La période (deux semaines par défaut) regarde autant en arrière qu'en avant.

### Santé du planning

Une revue de planning automatisée dans l'esprit des 14 points DCMA. Chaque contrôle reçoit une
gravité et un nombre, avec les constats par tâche ou lien : **erreurs** (marge négative, échéance
manquée, contrainte violée, avancement incohérent), **avertissements** (début ou fin ouverts, longue
durée, avances, contraintes dures, avancement hors séquence) et **informations** (quasi critique,
marge élevée, décalages longs). Les seuils sont dans les options ; par défaut selon DCMA : 44 jours
ouvrés pour la marge élevée et la longue durée, 10 pour les décalages. Un planning propre a zéro
erreur.

### Charge des ressources par semaine

Par ressource et par semaine, le besoin face à la capacité disponible (en unités-jours), l'écart,
le pic journalier et si la semaine est surchargée — le même calcul que l'histogramme de l'onglet
**Ressources**, sous forme de tableau. Seules les semaines avec un besoin figurent ; *Semaines
surchargées uniquement* ne garde que les goulots.

### Affectations des ressources

Par ressource, les activités qui lui sont affectées : WBS, nom, début et fin, durée restante, unités
par jour, avancement, critique et statut. Les tâches terminées sont exclues par défaut. Avec une
fenêtre en semaines, cela devient la *prévision par ressource*. La synthèse compte aussi les tâches
sans ressource.

### Synthèse WBS

Le planning agrégé par élément WBS jusqu'à un niveau au choix — la vue de direction. Par élément :
début et fin, début et fin de référence, durée, avancement pondéré par la durée, écart de fin par
rapport à la référence, plus petite marge totale et nombre d'activités, dont critiques, en cours et
terminées. Choisissez un niveau (2 par défaut) ou le WBS complet, avec les activités si vous le
souhaitez.

## Imprimer et exporter

Le panneau de paramètres a toujours un bouton **Imprimer...** en bas — il ouvre une fenêtre d'impression séparée contenant le rapport et déclenche immédiatement la boîte de dialogue d'impression du navigateur/système d'exploitation. Pour le rapport Gantt, cette fenêtre utilise le format de papier et l'orientation choisis ; les rapports de jalons et de variance impriment le tableau tel qu'affiché.

Seul le rapport Gantt dispose aussi d'un bouton **Exporter en PDF**. Celui-ci enregistre l'aperçu actuel comme un véritable fichier PDF (nom de fichier se terminant par `-planning.pdf`) — une page dimensionnée aux dimensions physiques du format de papier et de l'orientation choisis. Le fichier PDF est **vectoriel** : les barres, les lignes et le texte sont stockés comme instructions de dessin PDF plutôt que comme une seule image intégrée, il reste donc net à n'importe quel niveau de zoom et le texte est sélectionnable et consultable dans n'importe quelle visionneuse PDF. Cela s'applique au texte latin, cyrillique, grec, arabe et perse — l'arabe et le perse sont également mis en forme et intégrés comme texte vectoriel. Le texte chinois, japonais et coréen est optionnel : installez une extension de police qui fournit ces glyphes et il est lui aussi intégré comme vecteur (sélectionnable et consultable) ; sans une telle extension, ce texte est exporté sous forme d'image matricielle — toujours affiché correctement, mais non sélectionnable ni consultable. Pratique pour l'e-mail ou l'archivage sans passer par la boîte de dialogue d'impression du système. Si vous préférez imprimer directement (ou enregistrer en PDF via la boîte de dialogue système, par ex. pour choisir un format de papier différent de celui configuré ci-dessus), utilisez **Imprimer...**.

## Les rapports en pratique

Chaque type de rapport sert une conversation différente :

- Le **rapport Gantt** est le document classique à distribuer en réunion de chantier : le chemin critique mis en évidence, la marge visible sur les barres non critiques, et la légende expliquant ce que signifie chaque couleur. Activez **noms des tâches sur les barres** et **afficher l'avancement** si l'audience ne connaît pas déjà le planning ; désactivez-les pour un aperçu épuré sur A1 si une liste de tâches séparée est distribuée en complément.
- L'**aperçu des jalons** est destiné à quiconque ne veut que les dates importantes sans parcourir des dizaines de lignes de tâches — par exemple un client qui veut surtout savoir si les dates de réception obligatoires sont respectées. Le symbole ◆ devant un nom de jalon dans le tableau marque un jalon **obligatoire**.
- Le **rapport de variance** est la conversation sur la correction de trajectoire : quelles tâches glissent par rapport à la baseline, et de combien de jours ouvrés. Voyez ce rapport en pratique dans le cas d'usage [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc), qui comporte deux baselines (une baseline contractuelle et une re-baseline après un avenant) avec leur propre avancement et date de statut — un bon exemple de la façon dont les colonnes Δ se remplissent dès qu'il y a une différence réelle entre la baseline et le planning actuel.

L'aperçu en direct à droite s'actualise à chaque modification des paramètres à gauche — il n'y a pas de bouton « actualiser » séparé, et rien n'est calculé uniquement au moment de l'impression.

## Poursuivre la lecture

- Un rapport de variance n'a rien à comparer tant qu'une baseline n'a pas été enregistrée — lisez le guide [Baselines & avancement](docs://gids-baselines-voortgang).
- Le chemin critique et la marge affichés sur le rapport Gantt proviennent du même calcul que la vue Gantt elle-même — lisez le guide [Chemin critique & analyse avancée](docs://gids-kritiek-pad-analyse) pour savoir comment l'interpréter.

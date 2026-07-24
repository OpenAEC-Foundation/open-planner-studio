# Baselines & avancement

Un planning que vous ne mettez jamais à jour est une prévision. Une fois le travail commencé, vous voulez voir deux choses à la fois : ce qui a été initialement convenu, et ce qui se passe réellement maintenant. Une **baseline** fige la première ; l'**avancement** et la **date de statut** suivent la seconde. Ce guide montre comment enregistrer et gérer une baseline, comment rendre l'écart visible, comment saisir l'avancement, et exactement ce que fait la date de statut à votre planning.

## Ce que vous allez apprendre ici

- Enregistrer et gérer une baseline, et quelle baseline est active.
- Voir l'écart : la superposition de la baseline dans le Gantt et le rapport de variance.
- Saisir l'avancement — pourcentage, dates réelles — via le panneau, la boîte de dialogue de tâche et le menu contextuel.
- La date de statut : ce qu'elle fait aux tâches pas encore démarrées et aux jalons non marqués.
- Les avertissements hors séquence : ce qu'ils signifient et comment les résoudre.
- Lire la ligne d'avancement.

Suivez [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) (une baseline avant le démarrage, plus un avancement et une date de statut à mi-parcours du projet) et [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc) (deux baselines — une baseline contractuelle et une re-baseline après un avenant — avec leur propre avancement et date de statut).

## Enregistrer et gérer une baseline

Ouvrez la fenêtre **Baselines** via le groupe de ruban **Baselines et avancement** de l'onglet **Planification** : **Enregistrer une baseline…** enregistre immédiatement une nouvelle baseline avec un nom suggéré (« Baseline 1 — [date] »), **Gérer les baselines…** ouvre la même fenêtre pour consulter, renommer ou supprimer.

La fenêtre affiche un tableau avec chaque baseline enregistrée : un bouton radio **Active**, le **Nom** (modifiable directement), la date **Créée le**, et un bouton de suppression. Une seule baseline peut être active à la fois — c'est celle par rapport à laquelle la superposition du Gantt et le rapport de variance comparent. Supprimer la baseline active demande confirmation (aucune baseline ne reste active ensuite jusqu'à ce que vous en choisissiez une autre ou en enregistriez une nouvelle). Si le planning est obsolète depuis le dernier calcul, la fenêtre affiche une indication à côté de « Enregistrer une nouvelle baseline » pour recalculer d'abord — une baseline enregistrée sur un planning obsolète figerait les mauvaises dates.

Une baseline est un instantané : le début, la fin et (pour les jalons) la date de chaque tâche au moment où vous l'avez enregistrée. Modifiez encore le planning par la suite, la baseline reste inchangée jusqu'à ce que vous en enregistriez vous-même une nouvelle.

## Voir l'écart

### Dans le Gantt : la superposition de la baseline

Activez la superposition via **Affichage → groupe de ruban Baselines et avancement → Superposition de la baseline**. Une fine sous-barre (ou un losange pour un jalon) apparaît sous chaque barre de tâche, dans la couleur de la baseline, aux dates originales de la baseline. Si la barre principale dépasse sa sous-barre, vous voyez d'un coup d'œil de combien une tâche a glissé par rapport à la baseline — sans avoir à ouvrir un rapport distinct.

### En tant que rapport : le rapport de variance

Allez sur l'onglet **Rapport**, choisissez **Variance** pour **Type de rapport**. Le rapport affiche, par tâche : **Début de la baseline**, **Fin de la baseline**, **Début actuel**, **Fin actuelle**, **Δ début (jo)**, **Δ fin (jo)** et un **Statut** (**Dans les délais**, **Plus tard**, **Plus tôt**, **Nouvelle** pour les tâches ajoutées depuis la baseline, ou **Supprimée** pour les tâches retirées depuis). En haut, le rapport totalise le nombre de tâches, combien sont plus tardives et combien plus précoces, et — si la date de fin de projet a bougé — une ligne avec le nombre de jours ouvrés d'écart par rapport à la baseline. S'il n'y a pas de baseline active, le rapport le mentionne explicitement au lieu d'afficher un tableau vide.

## Saisir l'avancement

Vous définissez l'avancement à trois endroits, tous avec le même effet :

1. **Panneau des propriétés** — la section **Avancement** sous une tâche sélectionnée : un curseur pour le **pourcentage d'achèvement**, et (pour une tâche normale) les champs **Début réel**/**Fin réelle**, ou (pour un jalon) un seul champ **Date réelle**. Faites passer le pourcentage au-dessus de 0 % sans date de début réelle, et elle est automatiquement renseignée avec le début au plus tôt planifié ; ramenez-le en dessous de 100 % et toute fin réelle que vous aviez saisie est de nouveau effacée.
2. **Boîte de dialogue de tâche** — la même section **Avancement**, dans la fenêtre **Modifier la tâche**.
3. **Menu contextuel** — cliquez avec le bouton droit sur une tâche, sous-menu **Avancement**, avec les paliers fixes **0 %**, **25 %**, **50 %**, **75 %** et **100 %**. Pratique pour une mise à jour rapide sans ouvrir un panneau ; pour un pourcentage intermédiaire ou une date réelle précise, utilisez le panneau ou la boîte de dialogue de tâche.

Les dates réelles ne peuvent jamais être postérieures à la date de statut — essayez d'en saisir une plus tardive et l'application la rejette avec une erreur. Il s'agit d'une limite délibérée : un « fait » (quelque chose qui s'est réellement produit) ne peut, par définition, pas se situer dans le futur par rapport au moment où vous enregistrez l'avancement.

## La date de statut

La **date de statut** (groupe de ruban **Baselines et avancement** de l'onglet Planification, champ **Date de statut**) marque « aujourd'hui » au sein du planning — le moment auquel vous avez enregistré l'avancement. Une fois définie, elle fait deux choses à la fois :

- Toute tâche ou tout jalon qui n'a pas encore démarré (0 % d'achèvement, aucun début réel) ne peut pas commencer avant la date de statut, même si la logique (prédécesseurs, relations) permettrait autrement un démarrage plus précoce. Son début au plus tôt calculé est « plafonné » à la date de statut.
- Les tâches déjà démarrées ou terminées conservent leurs dates réelles — celles-ci ne sont jamais écrasées par la date de statut.

Vous pouvez voir cela exactement dans le cas d'usage de taille moyenne : avec la date de statut réglée au 20 mai 2027, plusieurs tâches pas encore démarrées (par exemple la maçonnerie et la plomberie sur différentes maisons) ont leur début au plus tôt fixé exactement à cette date, alors qu'elles s'exécutent dans des maisons différentes et auraient, sans ce plafond de date de statut, démarré à des dates diverses et plus précoces.

### Pourquoi un jalon non marqué « se décale vers la droite »

Dans le calcul, un jalon n'est rien de plus qu'une tâche de durée nulle, donc la même règle s'applique : s'il n'a pas encore été marqué comme terminé (pas de 100 %, pas de date réelle), sa date calculée ne peut pas se situer avant la date de statut. Continuez à avancer la date de statut sans marquer le jalon comme terminé, et sa date affichée dans le Gantt continue de se décaler vers la droite en même temps, même si rien n'a changé au sujet des tâches sous-jacentes — le planning dit en effet « ce moment ne peut pas se situer dans le passé si vous ne l'avez pas encore coché ». Dès que vous marquez le jalon comme terminé avec une date réelle, il revient exactement à cette date fixe et cesse de se décaler.

## Avertissements hors séquence

Une fois qu'il y a une date de statut, le calcul vérifie également que les faits enregistrés (dates de début/fin réelles) ne contredisent pas la logique des relations — par exemple un successeur qui a déjà démarré alors que son prédécesseur, selon le planning, n'aurait pas dû être terminé. De tels cas sont appelés **hors séquence** et apparaissent comme un avertissement dans la barre d'état en bas de l'écran (« N relation(s) hors séquence »), avec une infobulle pour le décompte. C'est un avertissement, pas une erreur bloquante — le calcul se poursuit malgré tout.

Résolvez un avertissement hors séquence en enregistrant fidèlement la situation réelle : renseignez la date de début/fin réelle manquante ou incorrecte sur les tâches concernées (via le panneau, la boîte de dialogue de tâche ou le menu contextuel, comme ci-dessus), afin que les faits enregistrés s'alignent de nouveau avec ce qui devait logiquement précéder. Souvent, cela signifie simplement : une tâche qui, en réalité, est déjà terminée n'avait pas encore été marquée comme telle dans le planning.

## La ligne d'avancement

Activez la ligne d'avancement via **Affichage → groupe de ruban Baselines et avancement → Ligne d'avancement**. Elle trace une ligne orange en pointillés (motif 4/4, même style que la ligne de date de statut) qui place, pour chaque tâche, un point à la position correspondant à son pourcentage d'achèvement, et le relie à la date de statut — le motif classique en zigzag. Un coude à gauche de la date de statut signifie qu'une tâche est en retard par rapport à ce qu'on attendrait compte tenu du temps écoulé ; un coude à droite signifie qu'elle est en avance. La ligne d'avancement trace déjà elle-même la verticale de la date de statut comme colonne vertébrale du zigzag, de sorte que le bouton séparé **Ligne de la date de statut** (même groupe de ruban) s'efface tant que la ligne d'avancement est active — il ne redevient visible qu'une fois que vous désactivez la ligne d'avancement et voulez quand même voir la date de statut affichée comme simple ligne verticale.

## Poursuivre la lecture

- Voyez une baseline avant le démarrage et un avancement à mi-parcours en pratique : [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc).
- Voyez deux baselines (Contrat → re-baseline après un avenant) en pratique : [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc).
- Les ressources et leur charge sont également recalculées à chaque F5 — lisez le guide [Ressources, histogramme & nivellement](docs://gids-resources-histogram) pour la surallocation et le nivellement.
- L'avancement et une date de statut peuvent produire une marge négative sur une tâche déjà fixée — lisez le guide [Chemin critique & analyse avancée](docs://gids-kritiek-pad-analyse) pour savoir comment l'interpréter.

# Présenter sur grand écran

But : montrer le Gantt en plein écran, sans ruban ni panneaux, par exemple sur un projecteur ou une télévision lors de la réunion de chantier.

## Quand vous en avez besoin

Dix personnes regardent un seul écran dans la baraque de chantier. Le ruban, la barre d'état et le panneau des propriétés occupent alors la place dont le planning a besoin, et ils distraient. En **mode présentation**, l'application ne garde que le tableau des tâches et le Gantt, sur tout l'écran.

## Étapes

### Préparer l'affichage

En mode présentation, le ruban n'est plus affiché. Préparez donc à l'avance ce que vous voulez montrer.

1. Appuyez sur **Calculer** (F5), pour que les dates affichées soient correctes.
2. Réglez l'affichage que vous voulez montrer, par exemple une disposition qui n'affiche que les tâches critiques (voir [Créer et utiliser une disposition](docs://howto-layouts-gebruiken)).
3. Choisissez une échelle de temps et un zoom où les noms des tâches sont lisibles à distance. Réduisez ou développez les phases avec *Réduire* et *Développer* dans le groupe *Plan* de l'onglet *Affichage*.
4. Si vous le souhaitez, activez *Vue partagée* et *Mini-carte* (voir [Utiliser la vue partagée et la mini-carte](docs://howto-split-view-en-mini-map)).

### Démarrer la présentation

Choisissez *Affichage › Présentation › Présentation*. Dans l'application de bureau, vous pouvez aussi appuyer sur F11. Dans le navigateur, F11 appartient au navigateur lui-même : il met la fenêtre du navigateur en plein écran et laisse l'application telle quelle. Le ruban, les onglets, la barre d'état et le panneau de droite disparaissent. Vous voyez le tableau des tâches, le Gantt et, si vous les avez activés, l'histogramme et la mini-carte. Pendant quelques secondes, un message en bas indique *Appuyez sur Échap ou F11 pour quitter le plein écran.*

Dans l'application de bureau, vous démarrez la présentation depuis n'importe quel onglet avec F11, aussi depuis *Tableau* ou *Rapport*. Dans le navigateur, vous la démarrez uniquement avec *Affichage › Présentation › Présentation*. Vous voyez toujours le Gantt du projet ouvert, et quand vous arrêtez, vous revenez à l'onglet où vous étiez au départ. Dans le navigateur, c'est donc *Affichage*.

### Arrêter la présentation

Appuyez sur Échap ou F11. Le ruban et les panneaux reviennent sur l'onglet où vous étiez au départ.

## Pièges et ce que fait l'application

**Vous pouvez encore modifier en mode présentation.** Cliquer, glisser, modifier des cellules et Suppr fonctionnent toujours. Si vous faites glisser une barre par erreur, elle se déplace et le planning n'est plus à jour. Une tâche supprimée par erreur se récupère avec Ctrl+Z, également en mode présentation. Cliquez donc avec précaution quand vous travaillez avec un groupe.

**Les notifications restent visibles.** Un message de l'application, par exemple une erreur de sauvegarde, apparaît aussi en mode présentation. Sans ruban ni barre d'état, ce message est le seul signe qu'un problème existe.

**Préparez la vue partagée, la mini-carte et les dispositions à l'avance.** Vous avez besoin du ruban pour cela, et il n'est plus affiché dans ce mode. Le zoom fonctionne, avec la molette de la souris ou avec Ctrl+= et Ctrl+-. + et - fonctionnent aussi, mais seulement quand le Gantt est actif. Après le démarrage, c'est souvent le tableau des tâches qui est actif. Cliquez donc d'abord dans le Gantt.

**Le plein écran ne fonctionne pas.** En plus de masquer le ruban, l'application demande aussi réellement le plein écran. Si votre navigateur ou votre fenêtre refuse cela, seuls le ruban et les panneaux disparaissent. La présentation fonctionne quand même. Si vous quittez le plein écran autrement qu'avec Échap ou F11, par exemple avec une touche de votre système d'exploitation, le mode présentation s'arrête aussi.

**Le mode présentation n'est pas mémorisé.** Après avoir fermé et rouvert l'application, il est désactivé.

## Voir aussi

- [Utiliser la vue partagée et la mini-carte](docs://howto-split-view-en-mini-map) : deux fenêtres temporelles ou une bande d'aperçu pendant la présentation.
- [Créer et utiliser une disposition](docs://howto-layouts-gebruiken) : configurer l'affichage que vous voulez montrer en un clic.
- [Raccourcis clavier](docs://ref-sneltoetsen) : F11 et les autres touches.

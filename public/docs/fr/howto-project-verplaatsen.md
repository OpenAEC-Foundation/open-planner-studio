# Déplacer un projet

Objectif : décaler tout le planning à une nouvelle date de début, et voir à l’avance ce que cela change pour la fin.

## Quand en avez-vous besoin

Le début des travaux change : le permis arrive plus tard, ou vous réutilisez le planning d’une maison précédente pour la suivante. Déplacer chaque tâche une à une demande beaucoup de travail. Avec **Déplacer le projet**, vous saisissez une seule nouvelle date de début, et l’application décale tout en conséquence.

La fin du projet ne se décale pas toujours du même nombre de jours que le début. Le **calendrier** ne suit pas : les jours fériés, les congés du bâtiment et l’arrêt hivernal restent à des dates fixes. Par exemple : avec *Accueil › Fichier › Nouveau*, vous créez un projet avec *Date de début* 29-09-2026, *Pays* sur *Pays-Bas* et *Congés du bâtiment* sur *Aucun*, et vous y placez un planning de 30 jours ouvrés qui se termine le 9 novembre 2026. Si vous le déplacez au 14 décembre 2026, soit 76 jours calendaires plus tard, il se termine le 26 janvier 2027. C’est 78 jours plus tard, parce que le 25 décembre et le 1er janvier sont maintenant des jours non travaillés dans votre planning. La durée reste de 30 jours ouvrés. L’aperçu dans la fenêtre montre cela avant que vous ne changiez quoi que ce soit.

## Étapes

1. Choisissez *Planification › Planification › Déplacer le projet…*. Le bouton est désactivé tant que le projet n’a pas de date de début.
2. Sous *Début actuel du projet*, regardez où le projet commence maintenant, et sous *Nouveau début du projet*, choisissez la nouvelle date.
3. Si le projet a des références, la case *Décaler aussi les références* apparaît. Laissez-la décochée si vous voulez continuer à voir le décalage comme écart (voir les pièges).
4. Cliquez sur *Calculer l’aperçu*. L’application calcule le planning décalé en entier, sans rien modifier dans votre projet.
5. Regardez l’aperçu (voir ci-dessous). Si l’aperçu est correct, cliquez sur *Déplacer*.

Dans l’aperçu, vous voyez :

- le décalage en jours calendaires (*Décalage : 76 jours calendaires plus tard*) ;
- *Début du projet* et *Fin du projet*, avant et après ;
- un avertissement rouge si le calendrier interfère, ou le message indiquant que la durée du projet reste la même ;
- le nombre de tâches décalées et ce qui se décale aussi ;
- les avertissements à lire (voir les pièges).

L’application calcule le nouveau planning tout de suite, donc vous n’avez pas besoin d’utiliser **Calculer** (F5), et elle adapte la vue à l’ensemble du projet. L’ensemble forme une seule étape pour *Annuler* (Ctrl+Z).

Le bouton *Déplacer* ne fonctionne qu’après un aperçu sans erreur, et seulement si la nouvelle date diffère du début actuel du projet. Si vous modifiez la date ou la case, l’aperçu disparaît et vous devez à nouveau calculer.

### Ce qui se décale, et ce qui ne se décale pas

Ce qui se décale : le début et la fin de chaque tâche, le début réel et la fin réelle, les dates des contraintes (y compris celles d’une fixation Mandatory stricte, voir [Contraintes et échéances](docs://uitleg-constraints)), les échéances, la date d’état, les points d’ancrage des relations externes et les étapes de disponibilité des ressources. Le début du projet et, si vous l’avez renseignée, la fin du projet se décalent aussi.

Ce qui ne se décale pas :

- les calendriers, donc les jours fériés, les congés du bâtiment et l’arrêt hivernal ;
- les références, sauf si vous activez *Décaler aussi les références* ;
- un champ personnalisé renseigné de type *Date*.

## Pièges et comportement de l’application

**La fin se décale d’un nombre de jours différent.** Si l’aperçu constate que la fin se décale de plus ou de moins de jours calendaires que le début, ou que la durée du projet en jours ouvrés change, il affiche un avertissement rouge avec les chiffres. Vous pouvez alors toujours annuler.

**Les références ne bougent pas.** Une référence sert à mesurer les écarts. Si vous déplacez le projet sans cocher la case, vous voyez le changement de date comme écart par rapport à la référence. Si vous cochez la case, les références se décalent avec le planning. Seules leurs dates se décalent ; la date à laquelle la référence a été enregistrée ne se décale pas.

**Un projet en cours.** Les dates réelles se décalent aussi. Dans un projet où vous avez déjà saisi un avancement, ce n’est pas toujours ce que vous voulez. L’application vous avertit : *Vérifiez si c’est correct pour un projet en cours.*

**Relations externes.** L’ancrage dans votre propre projet se décale, mais le projet source, lui, ne se décale pas. Actualisez les relations après le déplacement avec *Accueil › Tâches › Lier ▾ › Actualiser toutes les relations externes*. Voir [Relations externes vers un autre projet](docs://howto-externe-relaties).

**Des jours fériés qui ne couvrent pas assez loin.** Un calendrier avec des jours fériés générés couvre un certain nombre d’années. Si le planning déplacé dépasse cette période, l’application calcule cette année-là sans jours fériés. L’aperçu vous en avertit, par exemple : *Les jours fériés générés du calendrier « Bouwkalender NL » couvrent 2025–2029 ; le planning décalé va jusqu’à 2030. Régénérez les jours fériés.* Déplacez d’abord le projet. Ouvrez ensuite *Planification › Calendrier › Calendrier* : à côté des jours fériés, il affiche maintenant *Régénérer*. Confirmez avec *Appliquer* et l’application recalcule. La période des nouveaux jours fériés suit les dates du projet, donc régénérer avant le déplacement n’aide pas.

**La date est dans le passé.** C’est autorisé, mais l’aperçu le signale : *La nouvelle date de début est dans le passé.*

**Modifier le début du projet dans Paramètres du projet est autre chose.** Si vous modifiez la date de début dans *Paramètres › Projet › Paramètres du projet* et choisissez *Appliquer*, le planning ne se déplace pas. Seules les tâches sans prédécesseur ni contrainte qui tomberaient alors avant le nouveau début sont déplacées jusqu’à cette date, et l’application vous indique combien. Si vous voulez tout décaler, utilisez *Déplacer le projet…*.

## Voir aussi

- [Chemin critique et marge](docs://uitleg-kritiek-pad) : comment le planning calcule et pourquoi la fin se décale.
- [Ajouter des relations](docs://howto-relaties-leggen) : les relations restent telles quelles quand vous déplacez le projet.
- [Nouveau projet et Paramètres du projet](docs://ref-projectinfo) : ce que fait la date de début dans *Paramètres du projet*.

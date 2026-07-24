# Options de nivellement

La fenêtre **Niveler les ressources** résout la surallocation en décalant les tâches. Elle fonctionne en deux étapes : **Calculer** construit une proposition (rien ne change encore), **Appliquer** l'exécute.

## Ouverture

**Ressources** → groupe de ruban **Nivellement** → **Niveler…**. **Échap**, la croix de fermeture ou un clic en dehors de la fenêtre ferme sans appliquer.

## Options

- **Niveler uniquement dans la marge (lissage) — la date de fin de projet reste fixe** — lorsque cochée, le nivellement ne décale les tâches que dans leur marge totale : la date de fin ne peut pas bouger, mais tous les conflits ne peuvent alors pas être résolus. Non cochée (par défaut), la date de fin de projet peut s'étendre pour résoudre tous les conflits.
- **Ressources** — une case à cocher par ressource : quelles ressources participent. Les ressources matériau sont absentes ici (le matériau n'est pas nivelé). Toutes les ressources sont cochées par défaut.

## Calculer

Nécessite un calcul à jour ; sinon la fenêtre affiche « Calculez d'abord la planification (F5) avant de niveler. » Le bouton est aussi désactivé tant qu'aucune ressource n'est cochée. Tout changement d'option invalide une proposition antérieure — calculez à nouveau.

## Proposition (aperçu)

- **Ligne de la date de fin de projet** — « inchangée (date) » ou « ancienne date → nouvelle date » (rouge) si le projet s'étend.
- **Tableau** — par tâche décalée : **Tâche**, **Ancien début**, **Nouveau début** et **Jours de décalage**. Les successeurs sans ressource qui se décalent aussi via la logique sont également inclus.
- S'il n'y a rien à faire, la fenêtre indique « Aucune tâche ne doit être déplacée — la planification est déjà sans conflit. »

## Conflits restants

Les tâches qui ne tiennent pas dans les règles, avec par tâche le nombre de jours de conflit et une raison :

- « … atteint un pic de … unités/jour, la capacité est de … — ne peut pas être résolu en décalant. » — une affectation demande à son pic plus que la capacité de la ressource ; réduisez les unités/j ou augmentez les Unités max.
- « La ressource ne travaille pas tous les jours nécessaires à cette tâche — le décalage ne résout pas ce problème. » — désaccord de calendrier entre la tâche et la ressource.
- « Capacité libre insuffisante dans la marge pour résoudre ce conflit. » — surtout avec le lissage : pas de fenêtre libre dans la marge disponible.

## Appliquer et annuler

**Appliquer** exécute la proposition et ferme la fenêtre ; **Annuler** ferme sans modification. Annulez un nivellement appliqué avec **Effacer le nivellement** (même groupe de ruban) ou Ctrl+Z.

## Poursuivre la lecture

- [Ressources, histogramme & nivellement](docs://gids-resources-histogram) — repérer la surallocation dans l'histogramme et le flux de travail complet de nivellement.

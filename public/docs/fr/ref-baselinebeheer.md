# Gestion des baselines

La fenêtre **Baselines** gère les instantanés enregistrés du planning : enregistrer, renommer, choisir la baseline active et supprimer.

## Ouverture

**Planification** → groupe de ruban **Baselines et avancement** → **Enregistrer une baseline…** ou **Gérer les baselines…** (les deux ouvrent la même fenêtre). **Échap**, **Fermer**, la croix de fermeture ou un clic en dehors de la fenêtre ferme ; toutes les modifications dans cette fenêtre prennent effet immédiatement.

## Le tableau des baselines

Une ligne par baseline enregistrée :

- **Active** — bouton radio ; une seule baseline peut être active. La baseline active est la base de comparaison pour la superposition de la baseline dans le Gantt et le rapport de variance.
- **Nom** — modifiable directement dans la ligne.
- **Créée le** — la date d'enregistrement de la baseline.
- **Supprimer** (corbeille) — retire la baseline. Si c'est la baseline active, la fenêtre demande d'abord confirmation (« Supprimer la baseline active ? ») ; ensuite, la baseline restante enregistrée le plus récemment devient active, ou aucune s'il n'en reste pas.

Sans baseline, la fenêtre affiche « Aucune baseline pour l'instant ».

## Enregistrer une nouvelle baseline

- **Champ Nom** — pré-rempli avec « Baseline {n} — {date} » ; ajustez le nom si vous le souhaitez.
- **Enregistrer** — enregistre le début, la fin et (pour les jalons) la date de chaque tâche, et rend la nouvelle baseline active.
- **Avertissement** — si le planning est obsolète depuis le dernier calcul, « La planification est obsolète — recalculez d'abord (F5) » apparaît : une indication, pas un blocage. Une baseline sur un planning obsolète figerait les mauvaises dates.

## Poursuivre la lecture

- [Baselines & avancement](docs://gids-baselines-voortgang) — superposition de la baseline, rapport de variance, avancement et date de statut.

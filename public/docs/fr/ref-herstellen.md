# Récupérer après un plantage

L'application de bureau conserve automatiquement des instantanés de récupération de votre travail. Si l'application se ferme de manière inattendue (plantage, coupure de courant), elle propose de restaurer ce travail au démarrage suivant.

## Comment fonctionne la sauvegarde automatique

- Peu après chaque modification (en moins d'une seconde), l'application écrit un instantané par document ouvert dans son propre dossier de données — pour tous les onglets ouverts, y compris les documents qui n'ont jamais été enregistrés.
- Ceci ne remplace pas l'enregistrement : votre fichier de projet lui-même ne change pas. Continuez donc à enregistrer votre travail avec Ctrl+S.
- Les instantanés sont nettoyés dès que vous faites un choix dans la fenêtre de récupération (**Restaurer** ou **Ne pas restaurer**).
- **Application de bureau uniquement.** La version navigateur n'a pas de sauvegarde automatique ni de récupération — enregistrez-y vous-même régulièrement.

## La fenêtre « Restaurer le travail non enregistré »

Apparaît au démarrage lorsque des instantanés sont trouvés : « Open Planner Studio ne s'est pas fermé normalement. Les documents suivants comportaient des modifications non enregistrées qui peuvent être restaurées : » Pour chaque document, elle affiche :

- le **nom** (nom de fichier ou nom de projet ; sans nom : « Projet sans titre ») ;
- le **chemin du fichier**, si le document a déjà été enregistré ;
- le **nombre de tâches** dans l'instantané ;
- **Enregistré** — l'heure du dernier instantané.

## Les choix

- **Restaurer** (ou **Entrée**) — tous les documents listés reviennent comme onglets ouverts. Ils comptent alors comme non enregistrés : enregistrez-les vous-même.
- **Ne pas restaurer** — les instantanés sont abandonnés ; vous démarrez avec un projet vide.
- **Croix de fermeture**, **Échap** ou un clic en dehors de la fenêtre — reporter en toute sécurité : rien n'est abandonné et rien n'est restauré ; la question réapparaît au démarrage suivant.

## Poursuivre la lecture

- [Démarrage rapide](docs://quick-start) — enregistrer et ouvrir des projets.

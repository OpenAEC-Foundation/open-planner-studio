# Liens externes

La fenêtre **Lien externe (inter-projets)** enregistre une dépendance entre une tâche de ce projet et une tâche d'un autre fichier de projet — par exemple un projet de travaux de voirie qui doit se terminer avant votre démarrage.

## Ouverture

Onglet **Relations** → bouton **Lien externe…**. Exactement une tâche doit être sélectionnée ; sinon « Sélectionnez une seule tâche pour ajouter un lien externe. » apparaît.

## L'ancrage figé

Un lien externe ne calcule pas en direct par rapport au projet source. Lorsque vous l'ajoutez, la date pertinente de la tâche source (début ou fin, selon la direction et le type de relation) est stockée comme **date d'ancrage** fixe ; le calcul utilise cette date comme borne. Si le projet source change ensuite, rien ne se décale jusqu'à ce que vous **actualisiez** le lien.

## Deux voies

- **Fichier source** — choisissez un fichier sous **Choisir un fichier récent** ; il est lu en lecture seule (« Le fichier source est lu en lecture seule — il n'est pas ouvert comme document. »). Choisissez ensuite la **Tâche source** dans la liste ; la date d'ancrage est lue automatiquement depuis cette tâche et affichée en bas. Cette voie nécessite l'application de bureau et au moins un fichier récent.
- **Manuel (solution de secours)** — pas de fichier sous la main (ou version navigateur) : collez l'**Identifiant de projet** et l'**Identifiant de tâche** de la tâche externe, éventuellement un **Nom de la tâche**, et saisissez vous-même la **Date d'ancrage**. Un lien manuel est marqué « obsolète » jusqu'à ce qu'une actualisation trouve effectivement la source.

## Champs partagés

- **Direction** — **Prédécesseur (externe → moi)** : la tâche externe détermine ma tâche ; ou **Successeur (moi → externe)** : ma tâche détermine la tâche externe.
- **Type de relation** — FS, SS, FF ou SF.
- **Décalage (jours ouvrés)** — temps d'attente (ou négatif : chevauchement) en plus de l'ancrage.

**Ajouter le lien** enregistre le lien (désactivé tant que les champs requis ne sont pas remplis) ; **Annuler** ferme sans ajouter.

## Gestion, actualisation et sources manquantes

Les liens existants sont listés dans le panneau Relations sous **Liens externes** :

- Par lien : la tâche source, le type, l'ancrage, et un badge **obsolète** dès que la source n'a pas pu être chargée (ou plus) — avec l'explication « source non chargée — réimportez pour actualiser ».
- **Actualiser ce lien** — relit le fichier source de ce lien précis et met à jour l'ancrage.
- **Actualiser les ancrages externes** — relit chaque fichier source référencé et met à jour tous les ancrages ainsi que le statut obsolète. Ensuite, une ligne de statut indique combien d'ancrages ont été actualisés et combien sont restés obsolètes.
- **Supprimer** — supprime le lien.
- L'actualisation lit des fichiers et ne fonctionne donc que dans l'application de bureau ; la version navigateur indique « La lecture des fichiers source n'est possible que dans l'application de bureau ; utilisez la solution de secours manuelle. »

## Poursuivre la lecture

- [Chemin critique & analyse avancée](docs://gids-kritiek-pad-analyse) — comment les liens externes alimentent le chemin critique.

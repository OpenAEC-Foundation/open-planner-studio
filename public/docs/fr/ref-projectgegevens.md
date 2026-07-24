# Informations du projet

La fenêtre **Informations du projet** contient les métadonnées du projet ainsi que la section **Calcul** avec les options de planification. Le même formulaire sert aussi d'assistant de projet pour **Nouveau**.

## Ouverture

- **Paramètres** (onglet du ruban) → groupe de ruban **Projet** → **Info projet**.
- Fenêtre Paramètres (engrenage ⚙) → onglet **Général** → **Informations du projet...**
- **Fichier** → **Info projet** — une variante simplifiée dans le Backstage, avec uniquement les champs de métadonnées (pas de section Calcul).

**Appliquer** valide toutes les modifications à la fois ; **Annuler**, **Échap** ou un clic en dehors de la fenêtre les abandonne. **Entrée** fait la même chose qu'Appliquer.

## Métadonnées

- **Nom du projet** — le nom dans la barre de titre et l'onglet de document.
- **Description** — texte libre.
- **Ingénieur** et **Entreprise** — texte libre ; stocké dans le fichier IFC.
- **Date de début** — le début du projet à partir duquel le calcul compte.
- **Date de fin** — fin informative du projet.

## Calcul

Options de planification pour ce projet — elles sont stockées avec le fichier, pas avec l'application, donc elles voyagent vers d'autres machines. Si vous modifiez quelque chose ici, le planning est recalculé automatiquement après **Appliquer**.

- **Définition du critique** — **Marge totale ≤ seuil** (avec **Seuil (jours ouvrés)**, par défaut 0) ou **Chemin le plus long**.
- **Calcul de la marge** — **Le plus petit (début/fin)** (par défaut), **Marge de début** ou **Marge de fin**.
- **Tâches à extrémité ouverte critiques** — marque comme critiques les tâches sans successeur.
- **Marquer quasi critique** — le cocher révèle un **Seuil** supplémentaire (par défaut 2 jours ouvrés ; l'unité suit l'affichage de la Durée, donc éventuellement des heures) : les tâches avec peu de marge reçoivent le marquage « quasi critique ».
- **Plusieurs chemins de marge** — le cocher révèle la **Méthode** (**Marge libre (peeling)** ou **Marge totale (classement)**) et **Chemins max.** (par défaut 10) : le calcul numérote alors les chemins de marge les plus importants.
- **Calendrier de décalage** — quel calendrier compte le décalage d'une relation : **Prédécesseur** (par défaut), **Successeur**, **24 heures** ou **Calendrier du projet**.

La façon de lire ces résultats est couverte dans [Chemin critique & analyse avancée](docs://gids-kritiek-pad-analyse).

## L'assistant de projet (Nouveau)

**Nouveau** ouvre la même fenêtre sous forme d'assistant (titre **Nouveau projet**, bouton **Créer**). Outre les champs de métadonnées, l'assistant contient :

- **Modèle de phasage** — **Vide**, **Construction résidentielle** ou **Tertiaire / rénovation** : remplit le nouveau projet avec une structure de phases.
- **Équipe** — visible uniquement avec la planification horaire activée : **Équipe de jour** (par défaut), **2 équipes**, **3 équipes** ou **24/7**.
- **Jeu de jours fériés** — génère le calendrier du projet : choisissez un pays (avec région et congés du bâtiment le cas échéant), **Aucun jour férié**, ou **Personnalisé…** — ce dernier ouvre la boîte de dialogue de calendrier juste après la création afin que vous puissiez composer le calendrier à la main. Voir [Boîte de dialogue de calendrier](docs://ref-kalenderdialoog).

La section Calcul est absente de l'assistant ; configurez-la ensuite via l'une des entrées ci-dessus.

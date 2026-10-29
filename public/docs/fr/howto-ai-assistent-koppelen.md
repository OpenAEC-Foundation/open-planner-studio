# Connecter un assistant IA (MCP)

Objectif : permettre à un assistant IA de suivre votre planning et d'y travailler, avec un aperçu de ce qu'il fait et des limites que vous fixez vous-même.

## Quand vous en avez besoin

Vous voulez qu'un assistant IA lise, analyse ou modifie votre planning. Par exemple pour qu'il rédige un premier WBS, corrige des tâches ou explique le chemin critique. Cela passe par le **Model Context Protocol** (MCP) : une norme qui permet à un assistant IA d'utiliser les outils d'un programme. Pour cela, Open Planner Studio lance un petit serveur sur votre ordinateur, le **pont**. Il propose un ensemble d'outils, dont le nom commence par `planner_` : lire et modifier des tâches, des relations, des ressources, des calendriers, des références, des documents et des fichiers. Les outils disponibles et ce qu'ils refusent sont décrits dans [Outils IA](docs://ref-ai-tools) ; la raison de ce fonctionnement est expliquée dans [Comment fonctionne la liaison IA](docs://uitleg-ai-koppeling).

Le pont ne fonctionne que dans l'application de bureau. Si vous activez le mode IA dans le navigateur, vous voyez bien l'onglet *IA*, mais le bouton *Démarrer le pont* est grisé avec le texte *Le pont ne fonctionne que dans l'application de bureau.* La suite de cet article concerne l'application de bureau. Dans le navigateur, *Sauvegarder maintenant* et *Ouvrir le dossier de sauvegarde* sont aussi grisés.

## Étapes

### 1. Activer le mode IA

1. Choisissez *Paramètres › Projet › Paramètres de l'application*. Vous pouvez aussi choisir *Fichier › Paramètres de l'application*, ou l'engrenage en haut.
2. Choisissez l'onglet *Avancé* et activez *Activer le mode IA*. L'onglet *IA* apparaît dans le ruban.
3. Si vous voulez que le pont soit actif dès le démarrage de l'application, activez aussi *Démarrer la passerelle automatiquement*. Cela n'agit que si le mode IA est activé, et ne fonctionne que dans l'application de bureau. Cette option est désactivée par défaut, car ouvrir un port est un choix délibéré.

Si vous désactivez le mode IA, le pont s'arrête et l'onglet *IA* disparaît.

### 2. Démarrer le pont

1. Allez à l'onglet *IA* et cliquez sur *Démarrer le pont* sous *Serveur*.
2. Regardez l'état à côté du bouton. Il affiche *Désactivé*, *Actif sur le port 3877*, *Port 3877 occupé* ou *Erreur*. Si le démarrage réussit, il affiche *Actif sur le port 3877* et le bouton s'appelle *Arrêter le pont*. Avec *Port 3877 occupé* ou *Erreur*, le bouton reste *Démarrer le pont* ; voir les pièges.

Le pont écoute uniquement sur votre propre ordinateur, sur un seul port. Par défaut, c'est le 3877. Dans le groupe *Connexion*, vous pouvez choisir un autre port sous *Port*, mais seulement pendant que le pont est arrêté.

### 3. Connecter l'assistant

1. Cliquez sur *Se connecter* sous *Connexion*. La fenêtre *Détails de connexion* s'ouvre.
2. Choisissez ce dont votre client a besoin, voir ci-dessous.
3. Le jeton est masqué. Avec l'icône en forme d'œil, vous l'affichez. Les boutons de copie copient toujours la valeur réelle, même si l'écran masque le jeton.
4. Demandez à l'assistant de charger la liste des outils. Cette vérification figure aussi dans l'invite de connexion : l'assistant doit voir les outils dont le nom commence par `planner_` ; le nombre attendu figure dans l'invite de connexion.

La fenêtre propose trois façons de se connecter :

- *Extrait de configuration* : un bloc de configuration que vous collez dans les paramètres MCP de votre client.
- *Invite de connexion* : un texte que vous collez dans votre assistant IA, qui se connecte alors lui-même.
- *Point de terminaison* et *Authentification* : les détails séparés. Le point de terminaison est `http://localhost:3877/mcp` avec le transport *streamable HTTP*. Chaque requête a besoin d'un en-tête `Authorization: Bearer` suivi de votre jeton. Votre client doit aussi prendre en charge les sessions MCP : lors de la connexion, le pont donne un code de session dans l'en-tête `Mcp-Session-Id`, et il refuse chaque requête suivante sans ce code. Claude Code et `mcp-remote` font cela tout seuls.

**Reconnectez-vous après une mise à jour de l'application.** Si votre client IA était déjà connecté à une version plus ancienne de l'application, il n'envoie pas encore de code de session, et le pont refuse toutes les requêtes. Reconnectez-vous donc après la mise à jour : démarrez une nouvelle session dans Claude Code, et quittez complètement Claude Desktop, puis relancez-le.

**Claude Code.** L'extrait de configuration convient directement à Claude Code. Donnez cette commande dans un terminal, avec votre propre jeton à la place de `<token>` :

```
claude mcp add --transport http open-planner-studio http://localhost:3877/mcp --header "Authorization: Bearer <token>"
```

Vous pouvez aussi mettre l'extrait dans le fichier `.mcp.json` du dossier de votre projet. Ne mettez alors pas ce fichier dans git, car le jeton donne accès à votre planning. Un serveur venant de `.mcp.json` doit être approuvé une première fois dans Claude Code.

**Claude Desktop.** L'extrait de configuration ne convient pas directement à Claude Desktop. Dans le fichier `claude_desktop_config.json`, vous indiquez un programme que Claude Desktop lance lui-même, et non une adresse. Utilisez donc l'outil externe `mcp-remote` entre les deux ; il a besoin de Node.js. Dans Claude Desktop, choisissez *Paramètres › Développeur › Modifier la configuration*, placez ceci dans le fichier (avec votre propre jeton), puis relancez Claude Desktop :

```
{
  "mcpServers": {
    "open-planner-studio": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://localhost:3877/mcp", "--header", "Authorization:${AUTH_HEADER}"],
      "env": { "AUTH_HEADER": "Bearer <token>" }
    }
  }
}
```

Le jeton est placé dans `env` et non dans `args`, à dessein : sous Windows, Claude Desktop casse un argument qui contient un espace. Un *connecteur personnalisé* dans Claude (*Personnaliser › Connecteurs*) ne fonctionne pas avec le pont. Claude se connecte alors depuis le cloud d'Anthropic, et celui-ci ne peut pas atteindre le pont sur votre propre ordinateur.

Dans le groupe *Connexion*, il y a aussi le champ *Jeton*. C'est un long code aléatoire que l'application crée pour vous et qu'elle enregistre sur cet ordinateur. Dans la fenêtre, on lit *Ce jeton donne accès au planning ouvert. Ne le partagez pas*. Avec l'icône *Nouveau jeton*, vous créez un nouveau jeton. L'application demande d'abord *Générer un nouveau jeton rompt toutes les connexions existantes. Continuer ?* Si le pont est actif, il redémarre avec le nouveau jeton, et l'ancien ne fonctionne plus.

### 4. Voir ce que fait l'IA

1. Cliquez sur *Panneau d'activité* sous *Activité*. Dans le volet latéral, le panneau *Activité IA* s'ouvre.
2. Chaque appel du pont figure sur une ligne, le plus récent en haut : l'heure, ce qui s'est passé, la durée, et si l'appel a réussi ou non. Cliquez sur une ligne pour développer *Arguments* et *Réponse*.
3. Avec *Effacer*, vous videz la liste. Le panneau garde les 500 derniers appels. Tant que rien ne s'est passé, il affiche *Aucune activité IA pour l'instant. Les appels du pont apparaîtront ici*.

Quand le mode IA est activé, un point avec *IA* apparaît en bas à droite de la barre d'état. Sa couleur indique l'état du pont, et un clic dessus vous mène à l'onglet *IA*.

### 5. Fixer des limites

Sous *Sécurité*, vous trouvez les boutons qui limitent l'IA :

- *Mettre en pause* : l'IA ne peut temporairement rien modifier, mais la lecture reste permise. Le pont reste actif. Le bouton devient *Reprendre*.
- *Lecture seule* : tous les outils qui modifient quelque chose sont refusés tant que cette option est activée.
- *Sauvegarde automatique : activée* : avant la première modification de l'IA dans un document, l'application écrit une sauvegarde IFC. Cette option est activée par défaut. Avec le bouton, vous la désactivez ; le texte affiche alors *Sauvegarde automatique : désactivée*. Cela se produit une fois par document, à chaque démarrage du pont.
- *Sauvegarder maintenant* : crée tout de suite une sauvegarde du document actif. Ensuite, le texte affiche *Sauvegarde créée :* suivi du nom du fichier.
- *Ouvrir le dossier de sauvegarde* : ouvre le dossier contenant les sauvegardes.

Les sauvegardes se trouvent dans le dossier `ai-backups`, dans le dossier de données de l'application. L'application garde les sauvegardes récentes et supprime peu à peu les plus anciennes ; le détail exact se trouve dans [Outils IA](docs://ref-ai-tools).

### 6. Faire en sorte que l'assistant planifie bien

Un assistant ne planifie bien que s'il connaît les règles de planning. Pourquoi c'est important et ce qu'elles contiennent, vous le lisez dans [Comment fonctionne la liaison IA](docs://uitleg-ai-koppeling). Voici ce que vous faites vous-même :

1. **Vous n'avez rien à faire pour les règles de base.** Elles arrivent à la connexion. Que votre client les place dans son invite système dépend de ce client.
2. **Faites lire le guide.** L'invite de connexion de la fenêtre *Détails de connexion* demande à l'assistant de lire le guide avec l'outil `planner_get_planning_guide`. Si vous n'utilisez pas l'invite, demandez-le vous-même à l'assistant : *Lisez d'abord le guide de planning avec planner_get_planning_guide, avant de modifier quoi que ce soit.* Vous pouvez lire le guide vous-même à l'adresse `https://open-planner-studio.open-aec.com/agent/planning-guide.md`.
3. **Facultatif : installez les skills.** Cela ne fonctionne qu'avec un assistant IA qui prend en charge les skills. Placez le `SKILL.md` de *goed-plannen* et de *progress-update* dans `.claude/skills/goed-plannen/SKILL.md` et `.claude/skills/progress-update/SKILL.md` dans le dossier du projet sur lequel travaille l'assistant, ou sous `~/.claude/skills/` pour chaque projet.

Vous obtenez les fichiers de deux façons. Demandez à l'assistant d'appeler l'outil `planner_get_planning_guide` avec `part` défini sur `skill` : la réponse contient les deux textes et, pour chaque skill, les endroits où il doit être placé. Ou téléchargez-les depuis `https://open-planner-studio.open-aec.com/skills/goed-plannen/SKILL.md` et `https://open-planner-studio.open-aec.com/skills/progress-update/SKILL.md`. Si *goed-plannen* est encore présent d'une version plus ancienne de l'application, remplacez-le : cet ancien texte est en néerlandais et renvoie à l'article d'aide au lieu du guide destiné aux assistants.

Vous voyez dans le *Panneau d'activité* si l'assistant a vraiment lu le guide : il y a alors un appel de `planner_get_planning_guide`. La réponse finale doit contenir une liste d'hypothèses : durées estimées, décomposition choisie, relations qu'il a créées lui-même et chaque contrainte qu'il a définie. Si cette liste manque, demandez-la. Après une mise à jour de l'avancement suivant *progress-update*, la réponse doit mentionner la date d'état, la nouvelle date de fin et l'écart par rapport à la référence.

## Pièges et réaction de l'application

**L'IA modifie quelque chose que vous voulez annuler.** Chaque modification de l'IA est une étape que vous annulez avec *Annuler* (Ctrl+Z). Une série de modifications que l'IA transmet d'un bloc forme une seule étape. Ensuite, le projet s'affiche comme non enregistré. Après une modification, le planning est de nouveau calculé : vous n'avez donc pas à appuyer vous-même sur F5.

**L'application refuse un appel de l'IA.** Avec *Mettre en pause* et *Lecture seule*, l'application refuse toutes les modifications, mais la lecture reste possible, y compris le recalcul d'un planning périmé. Si vous êtes vous-même en train de modifier, par exemple en faisant glisser une barre ou en saisissant dans un champ, l'IA reçoit les dates d'avant votre modification, avec un avertissement indiquant qu'elles sont périmées. Si une boîte de dialogue est ouverte, par exemple les paramètres, une boîte de dialogue de tâche ou la fenêtre d'accueil, ou si le mode présentation est activé, l'application refuse tous les appels, y compris la lecture, jusqu'à ce que vous fermiez la boîte de dialogue. L'IA reçoit alors un message d'erreur avec le nom interne de ce qui est ouvert, par exemple `showTaskDialog`. Seul `planner_get_planning_guide` continue de fonctionner, car il ne lit pas votre planning.

**Vous changez d'onglet pendant que l'IA travaille.** L'IA travaille sur le document où a eu lieu sa première modification. Si vous changez d'onglet entre-temps, l'application refuse sa modification suivante, jusqu'à ce qu'elle confirme qu'elle veut travailler sur l'autre onglet. Ainsi, rien n'atterrit dans le mauvais projet.

**L'IA écrit ou ouvre un fichier.** L'IA peut écrire un planning sous forme de fichier IFC et ouvrir un fichier de planning dans un nouvel onglet. Elle ne peut le faire que dans votre dossier utilisateur. Elle n'écrase un fichier existant que si elle le demande explicitement.

**L'état est *Port 3877 occupé*.** Un autre programme utilise le port. Le message de l'application s'affiche en dessous. Le champ du port reste alors verrouillé (*Modifiable uniquement lorsque le serveur est arrêté.*), alors que le pont n'est pas actif, et il n'y a pas de bouton d'arrêt. C'est un défaut connu. Jusqu'à sa correction : désactivez puis réactivez *Activer le mode IA*. L'état revient alors à *Désactivé* et vous pouvez choisir un autre port. Copiez ensuite de nouveau les détails de connexion, car le point de terminaison contient le port.

**Le client ne peut pas se connecter après un nouveau jeton.** Un nouveau jeton rompt toutes les connexions existantes. Donnez le nouveau jeton au client, ou collez de nouveau l'extrait de configuration.

**Vous avez arrêté le pont vous-même : il ne redémarre pas tout seul.** *Démarrer la passerelle automatiquement* fonctionne une fois à chaque démarrage de l'application. Si vous arrêtez le pont vous-même, l'application ne le réactive pas en silence.

**L'onglet *IA* a disparu.** Le mode IA est désactivé. Activez-le à l'étape 1.

**Une page web dans votre navigateur ne peut pas communiquer avec le pont.** Le pont refuse toute requête venant d'un navigateur, ainsi que toute requête sans le bon jeton.

## Voir aussi

- [Donner son avis](docs://howto-feedback-geven) : si la connexion fonctionne autrement que décrit ici, signalez-le.
- [Comment fonctionne la liaison IA](docs://uitleg-ai-koppeling) : ce qu'est la liaison, pourquoi l'assistant IA travaille dans votre projet ouvert et ce qu'il ne peut pas faire.
- [Outils IA](docs://ref-ai-tools) : tous les outils `planner_*` par groupe, les codes d'erreur et la durée de conservation des sauvegardes.
- [Bien planifier](docs://gids-goed-plannen) : les principes de planification ; l'assistant les reçoit dans une version anglaise, avec les outils ajoutés.
- [Paramètres](docs://ref-instellingen) : les paramètres IA.

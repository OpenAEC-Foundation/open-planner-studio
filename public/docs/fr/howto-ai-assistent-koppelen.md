# Connecter un client MCP

Objectif : permettre à un client MCP de suivre votre planning et d'y travailler, avec une vue claire sur ce qu'il fait et avec des limites que vous fixez vous-même.

## Rapide : laissez Claude le faire

Vous travaillez avec Claude Desktop ou Claude Code ? Alors Claude peut installer la connexion lui-même :

1. Cliquez sur *Copier le prompt* ci-dessous.
2. Collez le prompt dans une nouvelle discussion avec Claude, puis envoyez-le.

Claude installe ensuite l'extension pour Open Planner Studio et explique ce qu'elle fait en cours de route. Si vous devez faire quelque chose vous-même, par exemple cliquer sur *Installer* dans Claude Desktop, Claude vous indique exactement quel clic faire. Vous n'avez pas besoin de jeton pour cela.

```prompt
Installez l'extension Open Planner Studio pour moi, afin que vous puissiez lire et modifier mes plannings de construction dans Open Planner Studio. Faites vous-même le plus possible. Avant chaque étape, dites en une seule phrase simple ce que vous allez faire et pourquoi. Si vous avez besoin de moi, posez une question à la fois et attendez ma réponse. Si je dois faire quelque chose moi-même, dites-moi exactement quel clic ou quelle action faire, et où.

Ce que vous devez savoir :
- L'extension est un seul fichier, open-planner-studio-<version>.mcpb, de la version la plus récente : https://github.com/OpenAEC-Foundation/open-planner-studio/releases/latest. L'adresse directe se trouve dans https://api.github.com/repos/OpenAEC-Foundation/open-planner-studio/releases/latest (le fichier dont le nom se termine par .mcpb). C'est un fichier ZIP.
- L'extension fonctionne avec l'application de bureau Open Planner Studio, et aussi sans l'application. Quand l'application est ouverte et que son pont MCP tourne, vous travaillez dans le planning ouvert dans l'application. Quand l'application est fermée, vous travaillez sur des fichiers de planning dans un dossier de travail que je choisis.
- L'installation ne demande ni jeton ni mot de passe. Ne me demandez pas de jeton, et ne lisez ni n'affichez aucun jeton.

Si vous travaillez dans Claude Desktop :
1. Si vous pouvez télécharger un fichier et l'ouvrir sur mon ordinateur, faites-le avec le fichier .mcpb. Si vous ne le pouvez pas, donnez-moi l'adresse de téléchargement directe, et dites-moi de double-cliquer sur le fichier quand le téléchargement est terminé.
2. Claude Desktop affiche ensuite l'extension Open Planner Studio. Dites-moi de cliquer sur Installer. Dites-moi ensuite de choisir, dans Working folder, le dossier qui contient mes fichiers de planning.
3. Dites-moi de commencer une nouvelle discussion, et de vous y demander quels outils Open Planner Studio vous voyez.

Si vous travaillez dans Claude Code :
1. Vérifiez que Node.js 22 ou une version plus récente est installé. Si ce n'est pas le cas, dites-moi comment l'installer, et arrêtez-vous là.
2. Demandez-moi quel dossier contient mes fichiers de planning. C'est le dossier de travail.
3. Téléchargez le fichier .mcpb et décompressez-le dans un nouveau dossier à part, dans mon dossier utilisateur. Lisez-y manifest.json : server.mcp_config indique comment le serveur démarre. Remplacez ${__dirname} par le dossier décompressé, et ${user_config.workdir} par le dossier de travail.
4. Exécutez claude mcp list. Si un serveur nommé open-planner-studio existe déjà, demandez-moi si vous pouvez le remplacer. N'affichez pas ses paramètres, car ils peuvent contenir un jeton.
5. Ajoutez le serveur pour mon compte utilisateur, par exemple : claude mcp add open-planner-studio --scope user -e OPS_MCP_ROOT=<dossier de travail> -- node <dossier décompressé>/server/index.mjs
6. Dites-moi de démarrer une nouvelle session Claude Code et de vérifier avec /mcp si open-planner-studio est connecté.

Si vous travaillez ailleurs, par exemple sur claude.ai dans le navigateur, dites-moi que cela demande Claude Desktop ou Claude Code. Si vous ne savez pas où vous travaillez, demandez-moi.

Quand l'installation est terminée, expliquez-moi en quelques phrases :
- comment je vous permets de travailler dans l'application ouverte : dans Open Planner Studio, choisissez Paramètres › Projet › Paramètres de l'application, onglet Avancé, et activez Autoriser la connexion MCP. Cliquez ensuite sur Démarrer le pont dans l'onglet MCP.
- que, sans l'application, une modification n'est dans le fichier qu'après l'enregistrement, et que vous n'écrasez pas un fichier existant pendant que l'application est ouverte.
Si une étape échoue, dites-moi en une phrase ce qui s'est mal passé et ce que je peux faire. Ne devinez pas.
```

Vous préférez le faire vous-même, ou vous utilisez un autre client MCP ? Alors suivez les étapes ci-dessous.

## Quand vous en avez besoin

Vous voulez qu'un client MCP lise, analyse ou modifie votre planning. Par exemple pour qu'il rédige un premier WBS, corrige des tâches ou explique le chemin critique. Cela passe par le **Model Context Protocol** (MCP) : une norme qui permet à un programme d'IA, le **client MCP**, d'utiliser les outils d'un autre programme. Pour cela, Open Planner Studio fait tourner sur votre propre ordinateur un petit serveur, le **pont**. Il propose un ensemble d'outils dont le nom commence par `planner_` : lecture et modification des tâches, relations, ressources, calendriers, références, documents et fichiers. Quels outils existent, et ce qu'ils refusent, se trouve dans [outils MCP](docs://ref-ai-tools). Le client MCP travaille dans le projet que vous avez ouvert, pas dans une copie : une tâche qu'il ajoute apparaît tout de suite dans le Gantt. Il utilise le même calcul et le même historique de la commande *Annuler* que vous.

Le pont ne fonctionne que dans l'application de bureau. Si vous autorisez la connexion MCP dans le navigateur, vous voyez bien l'onglet *MCP*, mais le bouton *Démarrer le pont* est grisé, avec le texte *Le pont ne fonctionne que dans l'application de bureau.* Le reste de cet article concerne l'application de bureau. Dans le navigateur, *Sauvegarder maintenant* et *Ouvrir le dossier de sauvegarde* sont aussi grisés.

## Étapes

### 1. Autoriser la connexion MCP

1. Choisissez *Paramètres › Projet › Paramètres de l'app*. Vous pouvez aussi choisir *Fichier › Paramètres de l'app*, ou l'engrenage en haut.
2. Choisissez l'onglet *Avancé* et activez *Autoriser la connexion MCP*. L'onglet *MCP* apparaît dans le ruban.
3. Si vous voulez que le pont soit actif dès que l'application démarre, activez aussi *Démarrer la passerelle automatiquement*. Cette option n'agit que si la connexion MCP est activée, et elle ne fonctionne que dans l'application de bureau. Elle est désactivée par défaut, car ouvrir un port est un choix délibéré.

Si vous désactivez la connexion MCP, le pont s'arrête et l'onglet *MCP* disparaît.

### 2. Démarrer le pont

1. Allez à l'onglet *MCP* et cliquez sur *Démarrer le pont* sous *Serveur*.
2. Regardez le statut à côté du bouton. Il indique *Désactivé*, *Actif sur le port 3877*, *Port 3877 occupé* ou *Erreur*. Si le démarrage réussit, il indique *Actif sur le port 3877* et le bouton s'appelle *Arrêter le pont*. Avec *Port 3877 occupé* ou *Erreur*, le bouton reste *Démarrer le pont* ; voir les pièges.

Le pont n'écoute que sur votre propre ordinateur, sur un seul port. Par défaut, il s'agit du port 3877. Dans le groupe *Connexion*, vous pouvez en choisir un autre sous *Port*, mais uniquement lorsque le pont est arrêté. La connexion est du HTTP en clair sur votre propre ordinateur. L'application elle-même n'envoie rien vers l'extérieur. Ce que le client MCP fait de votre planning, par exemple ce que son fournisseur en fait, ne relève pas de l'application.

### 3. Connecter le client MCP

1. Cliquez sur *Se connecter* sous *Connexion*. La fenêtre *Détails de connexion* s'ouvre.
2. Choisissez ce dont votre client a besoin, voir ci-dessous.
3. Le jeton est masqué. Avec l'icône en forme d'œil, vous l'affichez. Les boutons de copie copient toujours la valeur réelle, même si l'écran masque le jeton.
4. Faites demander au client MCP la liste des outils. Ce contrôle figure aussi dans l'invite de connexion : le client doit voir les outils dont le préfixe est `planner_` ; le nombre attendu figure dans l'invite de connexion.

La fenêtre propose quatre façons de connecter votre client :

- *Laisser Claude le faire* : la même invite que celle en haut de cet article, avec le bouton *Copier le prompt*. Elle est destinée à Claude Desktop et à Claude Code. Vous n'avez pas besoin de jeton pour cela.
- *Extrait de configuration* : un morceau de configuration que vous collez dans les paramètres MCP de votre client.
- *Invite de connexion* : un texte que vous collez dans votre client MCP, après quoi il se connecte tout seul.
- *Point de terminaison* et *Authentification* : les détails séparés. Le point de terminaison est `http://localhost:3877/mcp`, avec le transport *streamable HTTP*. Chaque requête doit contenir un en-tête `Authorization: Bearer`, suivi de votre jeton. Votre client doit aussi prendre en charge les sessions MCP : à la connexion, le pont remet un code de session dans l'en-tête `Mcp-Session-Id`, et il refuse chaque requête ultérieure sans ce code. Claude Code et `mcp-remote` font cela tout seuls.

**Reconnectez-vous après une mise à jour de l'application.** Si votre client MCP était déjà connecté à une ancienne version de l'application, il n'envoie pas encore de code de session, et le pont refuse chaque requête. Reconnectez-vous donc après la mise à jour : démarrez une nouvelle session dans Claude Code, et quittez complètement Claude Desktop, puis relancez-le.

**Claude Code.** L'extrait de configuration convient directement à Claude Code. Exécutez cette commande dans un terminal, en remplaçant `<token>` par votre propre jeton :

```
claude mcp add --transport http open-planner-studio http://localhost:3877/mcp --header "Authorization: Bearer <token>"
```

Vous pouvez aussi placer l'extrait dans le fichier `.mcp.json` de votre dossier de projet. Ne mettez alors pas ce fichier dans git, car le jeton donne accès à votre planning. Un serveur issu de `.mcp.json` doit être approuvé la première fois dans Claude Code.

**Claude Desktop.** Pour Claude Desktop, il existe une extension : le fichier `open-planner-studio-<version>.mcpb`. Claude Desktop l'installe par un double-clic. Vous n'avez pas besoin de Node.js pour cela. L'extension fonctionne avec l'application et sans l'application. C'est plus rapide avec l'invite en haut de cet article ; ci-dessous se trouvent les étapes manuelles.

1. Téléchargez le fichier `.mcpb` de la dernière version : `https://github.com/OpenAEC-Foundation/open-planner-studio/releases/latest`.
2. Double-cliquez sur le fichier. Claude Desktop s'ouvre et affiche l'extension *Open Planner Studio*. Installez-la. Si le double-clic ne fonctionne pas, ouvrez *Paramètres › Extensions* dans Claude Desktop et installez le fichier à cet endroit.
3. Dans *Working folder*, choisissez le dossier de vos fichiers de planning. Claude n'utilise ce dossier que lorsque l'application est fermée. Claude ne lit et n'écrit alors que dans ce dossier.
4. Activez l'extension et démarrez une nouvelle conversation. Demandez à Claude quels outils d'Open Planner Studio il voit.

Vous n'entrez ni jeton ni port : pendant que le pont fonctionne, l'extension trouve l'application toute seule. Pour chaque question de Claude, l'extension choisit de nouveau :

- *L'application est ouverte et le pont fonctionne* : Claude travaille dans le planning ouvert dans l'application. Vous voyez chaque modification dans l'application immédiatement.
- *L'application est fermée, ou le pont est désactivé* : Claude travaille sur un fichier de planning dans le dossier de travail. Une modification n'est dans le fichier que lorsque Claude enregistre ce fichier. Il n'y a pas d'enregistrement automatique. Pendant que l'application est ouverte, Claude n'écrase pas un fichier existant, mais enregistre sous un nouveau nom.

Si l'application s'ouvre ou se ferme pendant que Claude travaille, l'extension bascule et le signale à Claude. Claude choisit ou ouvre alors de nouveau le planning, et ce n'est qu'ensuite qu'il modifie quelque chose. Si Claude a encore des modifications sans l'application qui ne sont pas enregistrées, l'extension continue de fonctionner sans l'application jusqu'à ce que Claude les ait enregistrées. Ainsi, aucun travail n'est perdu. Si l'extension ne peut pas joindre l'application et qu'il n'y a pas de dossier de travail utilisable, Claude ne voit que l'outil `open_planner_studio_status`, avec un message qui vous indique quoi faire.

**Claude Desktop sans l'extension.** Si vous ne pouvez pas utiliser l'extension, connectez Claude Desktop avec l'outil externe `mcp-remote`. L'extrait de configuration ne convient pas directement à Claude Desktop : dans le fichier `claude_desktop_config.json`, vous indiquez un programme que Claude Desktop démarre lui-même, et non une adresse. `mcp-remote` a besoin de Node.js. Dans Claude Desktop, choisissez *Paramètres › Developer › Edit Config*, placez ceci dans le fichier (avec votre propre jeton), puis relancez Claude Desktop :

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

Le jeton se trouve dans `env` et non dans `args`, volontairement : sous Windows, Claude Desktop casse un argument qui contient un espace. Un *connecteur personnalisé* dans Claude (*Customize › Connectors*) ne fonctionne pas avec le pont. Claude se connecte alors depuis le cloud d'Anthropic, et celui-ci ne peut pas atteindre le pont sur votre propre ordinateur.

Dans le groupe *Connexion*, il y a aussi le champ *Jeton*. C'est un code long et aléatoire que l'application crée pour vous et enregistre sur cet ordinateur. Dans la fenêtre, il est écrit *Ce jeton donne accès au planning ouvert. Ne le partagez pas.* Avec l'icône *Nouveau jeton*, vous créez un nouveau jeton. L'application demande d'abord *Générer un nouveau jeton rompt toutes les connexions existantes. Continuer ?* Si le pont fonctionne, il redémarre avec le nouveau jeton, et l'ancien ne fonctionne plus.

**Comment l'extension trouve l'application.** Pendant que le pont fonctionne, l'application de bureau écrit le port et le jeton dans le fichier `mcp/runtime.json` du dossier de données de l'application. L'extension pour Claude Desktop lit ce fichier à chaque question. Sous Linux et macOS, seul votre compte utilisateur peut lire le fichier. Sous Windows, l'ACL par défaut du dossier de votre profil protège le fichier ; l'application ne vérifie pas cela séparément. Lorsque vous arrêtez le pont ou désactivez la connexion MCP, l'application supprime le fichier. L'application tient aussi une liste des fichiers ouverts dans `mcp/open-files.json`, même lorsque la connexion MCP est désactivée. Tant que ce fichier existe, l'extension et le serveur MCP sans interface ne remplacent aucun fichier existant, pas même un fichier que vous venez d'ouvrir et qui ne figure pas encore dans la liste. La création d'un nouveau fichier est autorisée. La lecture l'est aussi : Claude voit alors la version sur le disque, sans vos modifications qui ne sont pas encore enregistrées.

### 4. Voir ce que fait le client MCP

1. Cliquez sur *Panneau d'activité* sous *Activité*. Dans le volet latéral, le panneau *Activité MCP* s'ouvre.
2. Chaque appel du pont figure sur une ligne, le plus récent en haut : l'heure, ce qui s'est passé, la durée, et la réussite ou non de l'appel. Cliquez sur une ligne pour développer *Arguments* et *Réponse*.
3. Avec *Vider*, vous videz la liste. Le panneau conserve les 500 derniers appels. Tant que rien ne s'est passé, il indique *Aucune activité MCP pour l'instant. Les appels du pont apparaîtront ici.*

Avec la connexion MCP activée, un point avec *MCP* se trouve en bas à droite de la barre d'état. Sa couleur indique l'état du pont, et un clic dessus vous mène à l'onglet *MCP*.

### 5. Définir des limites

Sous *Sécurité* se trouvent les boutons qui vous permettent de limiter le client MCP :

- *Mettre en pause* : le client MCP ne peut temporairement rien modifier, mais la lecture reste autorisée. Le pont reste actif. Le bouton devient *Reprendre*.
- *Lecture seule* : tous les outils qui modifient quelque chose sont refusés tant que cette option est activée.
- *Sauvegarde automatique : activée* : avant la première modification du client MCP dans un document, l'application écrit une sauvegarde IFC. Cette option est activée par défaut. Avec le bouton, vous la désactivez ; le bouton indique alors *Sauvegarde automatique : désactivée*. Cela se fait une fois par document, à chaque démarrage du pont.
- *Sauvegarder maintenant* : crée tout de suite une sauvegarde du document actif. Ensuite, il indique *Sauvegarde créée :* avec le nom du fichier.
- *Ouvrir le dossier de sauvegarde* : ouvre le dossier contenant les sauvegardes.

Les sauvegardes se trouvent dans le dossier `ai-backups` du dossier de données de l'application. L'application conserve les sauvegardes récentes et réduit le nombre des plus anciennes ; le détail exact se trouve dans [Outils MCP](docs://ref-ai-tools).

### 6. Faire bien planifier le client MCP

Un client MCP ne planifie bien que s'il connaît les règles de planification. Voici ce que vous faites vous-même :

1. **Vous n'avez rien à faire pour les règles essentielles.** Elles arrivent lors de la connexion : le pont les envoie dans le champ `instructions` de la poignée de main MCP. Que votre client les place dans son invite système dépend du client.
2. **Faites lire le guide.** L'invite de connexion de la fenêtre *Détails de connexion* demande au client MCP de lire le guide avec l'outil `planner_get_planning_guide`. Si vous n'utilisez pas cette invite, donnez cette consigne à votre client MCP : *Lisez d'abord le guide de planification avec planner_get_planning_guide, avant de modifier quoi que ce soit.* Vous pouvez lire vous-même le guide à l'adresse `https://open-planner-studio.open-aec.com/agent/planning-guide.md`.
3. **Facultatif : installez les compétences.** Cela ne fonctionne qu'avec un client MCP qui prend en charge les compétences. Placez le `SKILL.md` de *goed-plannen* et celui de *progress-update* dans `.claude/skills/goed-plannen/SKILL.md` et `.claude/skills/progress-update/SKILL.md`, dans le dossier de projet où travaille le client MCP, ou sous `~/.claude/skills/` pour tous les projets.

Vous obtenez les fichiers de deux façons. Demandez au client MCP d'appeler l'outil `planner_get_planning_guide` avec `part` réglé sur `skill` : la réponse contient les deux textes et, pour chaque compétence, les emplacements où elle doit se trouver. Ou téléchargez-les depuis `https://open-planner-studio.open-aec.com/skills/goed-plannen/SKILL.md` et `https://open-planner-studio.open-aec.com/skills/progress-update/SKILL.md`. Si *goed-plannen* est encore présent depuis une ancienne version de l'application, remplacez-le : ce vieux texte est en néerlandais et renvoie à l'article d'aide au lieu du guide pour les clients MCP.

Vous voyez dans le *Panneau d'activité* si le client MCP a vraiment lu le guide : il y a alors un appel de `planner_get_planning_guide`. La réponse finale doit contenir une liste d'hypothèses : durées estimées, découpage choisi, relations qu'il a créées lui-même et chaque contrainte qu'il a définie. Si cette liste manque, demandez-la. Après une mise à jour d'avancement selon *progress-update*, la réponse doit mentionner la date d'état, la nouvelle date de fin et l'écart par rapport à la référence.

## Pièges et ce que l'application fait alors

**Le client MCP modifie quelque chose que vous voulez annuler.** Chaque modification du client MCP est une étape que vous annulez avec *Annuler* (Ctrl+Z). Une série de modifications que le client MCP transmet d'un seul bloc constitue une seule étape. Ensuite, le projet s'affiche comme non enregistré. Après une modification, le planning est de nouveau calculé, donc vous n'avez pas à appuyer vous-même sur F5.

**L'application refuse un appel du client MCP.** Avec *Mettre en pause* et *Lecture seule*, l'application refuse toutes les modifications, mais la lecture reste possible, y compris le recalcul d'un planning périmé. Si vous êtes en train de modifier vous-même quelque chose, par exemple en faisant glisser une barre ou en saisissant dans un champ, le client MCP reçoit les dates d'avant votre modification, avec un avertissement indiquant qu'elles sont périmées. Si une boîte de dialogue est ouverte, par exemple les paramètres, une boîte de dialogue de tâche ou la fenêtre d'accueil, ou si le mode présentation est activé, l'application refuse tous les appels, lecture comprise, jusqu'à ce que vous fermiez la boîte de dialogue. Le client MCP reçoit alors un message d'erreur avec le nom interne de ce qui est ouvert, par exemple `showTaskDialog`. Seul `planner_get_planning_guide` continue de fonctionner, car il ne lit pas votre planning.

**Vous changez d'onglet pendant que le client MCP travaille.** Le client MCP travaille sur le document où a été faite sa première modification. Si vous changez d'onglet entre-temps, l'application refuse sa modification suivante, jusqu'à ce qu'il confirme qu'il veut travailler sur l'autre onglet. Ainsi, rien n'atterrit dans le mauvais projet. Si le client MCP ouvre ou duplique lui-même un document, il travaille ensuite dans ce nouveau document.

**Le client MCP écrit ou ouvre un fichier.** Le client MCP peut enregistrer un planning sous forme de fichier IFC et ouvrir un fichier de planning dans un nouvel onglet. Il ne peut le faire que dans votre dossier utilisateur. Il n'écrase un fichier existant que s'il le demande explicitement.

**Le statut est *Port 3877 occupé*.** Un autre programme utilise le port. Le message de l'application s'affiche en dessous. Le champ du port reste alors verrouillé (*Modifiable uniquement lorsque le serveur est arrêté.*), alors que le pont ne fonctionne pas, et il n'y a pas de bouton d'arrêt. C'est un défaut connu. En attendant la correction : désactivez *Autoriser la connexion MCP*, puis réactivez-le. Le statut revient alors à *Désactivé*, et vous pouvez choisir un autre port. Copiez ensuite de nouveau les détails de connexion, car le point de terminaison contient le port.

**Le client ne peut pas se connecter après un nouveau jeton.** Un nouveau jeton rompt toutes les connexions existantes. Donnez au client le nouveau jeton, ou collez de nouveau l'extrait de configuration. L'extension dans Claude Desktop lit le nouveau jeton toute seule ; vous n'avez rien à faire à cet endroit.

**Vous avez arrêté le pont vous-même, et il ne redémarre pas tout seul.** *Démarrer la passerelle automatiquement* ne fonctionne qu'une fois à chaque démarrage de l'application. Si vous arrêtez vous-même le pont, l'application ne le réactive pas d'elle-même.

**L'onglet *MCP* a disparu.** La connexion MCP est désactivée. Activez-la à l'étape 1.

**Une page web dans votre navigateur ne peut pas communiquer avec le pont.** Le pont refuse chaque requête qui vient d'un navigateur, ainsi que chaque requête sans le bon jeton.

## Sans l'application

Il existe aussi un serveur MCP qui fonctionne sans l'application de bureau : le **serveur MCP sans interface**. Il propose les mêmes outils `planner_*`, mais il travaille sur un fichier de planning sur le disque au lieu de votre projet ouvert. Vous ne voyez donc pas les modifications dans le diagramme de Gantt, et *Annuler* dans l'application ne s'applique pas à elles. Utilisez-le si vous ne souhaitez pas ouvrir l'application, ou sur un ordinateur sans écran.

L'extension pour Claude Desktop démarre ce serveur automatiquement lorsque l'application est fermée (voir l'étape 3). Les étapes ci-dessous concernent un autre client MCP, comme Claude Code.

La version publiée ne contient pas de serveur prêt à télécharger. Vous le construisez à partir du code source avec `npm run build:mcp-server` ; pour cela, il vous faut Node.js 22 ou plus récent. Le résultat est un seul fichier, `server.mjs`.

1. Choisissez un dossier de travail qui contient vos fichiers de planning. Le serveur lit et écrit uniquement dans ce dossier.
2. Connectez votre client MCP. Pour Claude Code, la commande se trouve sous ces étapes.
3. Demandez au client MCP d'ouvrir un planning, par exemple `~/plan.ifc`. Dans ce serveur, `~` signifie le dossier de travail.
4. Demandez au client MCP d'enregistrer le résultat. Il n'y a pas d'enregistrement automatique : le client MCP écrit le fichier avec `planner_export_ifc`. Ce que le serveur n'enregistre pas est perdu lorsqu'il s'arrête.

Pour l'étape 2 dans Claude Code, saisissez cette commande dans un terminal, avec vos propres chemins :

```
claude mcp add open-planner -- node /path/to/server.mjs --root /path/to/working-folder
```

Avant la première modification par document, le serveur crée une sauvegarde MCP, comme l'application. Un client MCP qui choisit un chemin en dehors du dossier de travail, aussi par un raccourci (lien symbolique), reçoit un refus. Tant que l'application est ouverte, le serveur n'écrase pas un fichier existant.

## Voir aussi

- [Donner votre avis](docs://howto-feedback-geven) : si la connexion fonctionne autrement que décrit ici, signalez-le.
- [Outils MCP](docs://ref-ai-tools) : tous les outils `planner_*` par groupe, les codes d'erreur et la durée de conservation des sauvegardes.
- [Paramètres de l'application](docs://ref-instellingen) : les paramètres MCP.

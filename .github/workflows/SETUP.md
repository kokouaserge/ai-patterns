# GitHub Release Workflow Setup

Ce document explique comment configurer le workflow automatique de release pour ce projet.

## Prérequis: Créer un Personal Access Token (PAT)

Le workflow nécessite un Personal Access Token GitHub avec les permissions appropriées.

### Étapes pour créer le PAT:

1. **Accédez aux paramètres GitHub:**
   - Allez sur [GitHub.com](https://github.com)
   - Cliquez sur votre photo de profil (coin supérieur droit)
   - Sélectionnez **Settings**

2. **Accédez aux Developer settings:**
   - Dans la barre latérale gauche, descendez jusqu'à **Developer settings**

3. **Créez un nouveau token:**
   - Cliquez sur **Personal access tokens** → **Tokens (classic)**
   - Cliquez sur **Generate new token** → **Generate new token (classic)**

4. **Configurez le token:**
   - **Note:** Donnez un nom descriptif (ex: "ai-patterns-release-workflow")
   - **Expiration:** Choisissez une durée (recommandé: 90 jours ou plus)
   - **Select scopes:** Cochez les permissions suivantes:
     - ✅ `repo` (Full control of private repositories)
       - Ceci inclut automatiquement: repo:status, repo_deployment, public_repo, repo:invite, security_events
     - ✅ `workflow` (Update GitHub Action workflows)
     - ✅ `write:packages` (Upload packages to GitHub Package Registry) - optionnel

5. **Générez et copiez le token:**
   - Cliquez sur **Generate token** en bas de la page
   - **IMPORTANT:** Copiez immédiatement le token - vous ne pourrez plus le voir après!
   - Format: `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### Ajouter le token au repository:

1. **Accédez aux secrets du repository:**
   - Allez sur votre repository: https://github.com/kokouaserge/ai-patterns
   - Cliquez sur **Settings** (onglet en haut)
   - Dans la barre latérale gauche: **Secrets and variables** → **Actions**

2. **Créez le secret:**
   - Cliquez sur **New repository secret**
   - **Name:** `PAT_TOKEN`
   - **Secret:** Collez le token que vous avez copié
   - Cliquez sur **Add secret**

3. **Vérification:**
   - Le secret `PAT_TOKEN` devrait maintenant apparaître dans la liste
   - Vous ne pourrez plus voir sa valeur (c'est normal et sécurisé)

## Comment fonctionne le workflow

Le workflow se déclenche automatiquement lors d'un push sur la branche `main`:

1. **Exécute les tests** pour garantir la qualité du code
2. **Détermine le type de version bump** basé sur les messages de commit:
   - `BREAKING CHANGE`, `feat!`, `fix!` → Version **majeure** (ex: 1.0.0 → 2.0.0)
   - `feat:` → Version **mineure** (ex: 1.0.0 → 1.1.0)
   - `fix:`, `chore:`, etc. → Version **patch** (ex: 1.0.0 → 1.0.1)
3. **Met à jour `package.json`** avec la nouvelle version
4. **Crée un commit** avec le message "chore: bump version to X.X.X"
5. **Crée un tag Git** (ex: v1.1.4)
6. **Génère un changelog** à partir des messages de commit
7. **Crée une GitHub Release** avec le changelog

## Conventions de commit

Pour que le workflow fonctionne correctement, utilisez les préfixes suivants dans vos commits:

- `feat:` - Nouvelle fonctionnalité (version mineure)
- `fix:` - Correction de bug (version patch)
- `chore:` - Tâches de maintenance (version patch)
- `docs:` - Documentation (version patch)
- `BREAKING CHANGE:` - Changement incompatible (version majeure)
- `feat!:` ou `fix!:` - Avec `!` pour indiquer un breaking change (version majeure)

### Exemples:

```bash
git commit -m "feat: add retry mechanism for API calls"        # → 1.0.0 → 1.1.0
git commit -m "fix: resolve memory leak in cache cleanup"     # → 1.1.0 → 1.1.1
git commit -m "feat!: change API signature for withRetry"     # → 1.1.1 → 2.0.0
git commit -m "chore: update dependencies"                     # → 2.0.0 → 2.0.1
```

## Dépannage

### Le workflow échoue avec "Resource not accessible by integration"
- Vérifiez que le secret `PAT_TOKEN` est bien créé
- Vérifiez que le token a les permissions `repo` et `workflow`

### Le workflow ne se déclenche pas
- Vérifiez que le workflow est activé dans **Actions** → **Release**
- Vérifiez que vous avez bien push sur la branche `main`

### Le token a expiré
- Créez un nouveau token en suivant les étapes ci-dessus
- Mettez à jour le secret `PAT_TOKEN` dans les paramètres du repository

## Sécurité

- Ne partagez JAMAIS votre Personal Access Token
- Ne commitez JAMAIS le token dans le code
- Utilisez toujours les GitHub Secrets pour stocker les tokens
- Renouvelez régulièrement vos tokens

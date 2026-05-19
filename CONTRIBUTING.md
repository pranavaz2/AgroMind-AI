# Contributing to AgroMind AI 🌱

First off, thank you for considering contributing to AgroMind AI! It's people like you that make open-source software such a fantastic community to learn, inspire, and create.

## 💻 Development Workflow

1. **Fork the Repository**: Start by forking the repo to your own GitHub account.
2. **Clone Locally**: `git clone https://github.com/your-username/agromind-ai.git`
3. **Set Up Environments**: 
   - Copy the `.env.example` files in `server/`, `mobile/`, and `ai-service/` to `.env` and fill in your values.
   - Run `npm install` in both `server/` and `mobile/`.
   - Set up your Python virtual environment and run `pip install -r requirements.txt` in `ai-service/`.
4. **Create a Branch**: Create a feature branch following our naming conventions.
5. **Develop**: Write your code, ensuring you follow our architectural patterns.
6. **Test**: Run all local servers and verify end-to-end functionality (React Native -> Node.js -> FastAPI).
7. **Submit a PR**: Open a Pull Request against the `main` branch.

## 🌿 Branch Naming Conventions

Please name your branches using the following format:
- `feat/your-feature-name` (for new features)
- `fix/your-bug-fix` (for bug fixes)
- `docs/your-doc-update` (for documentation)
- `refactor/your-refactor` (for code refactoring)

## 💬 Commit Conventions

We follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/). This makes our repository history clean and readable.

Format: `<type>(<scope>): <subject>`

Examples:
- `feat(mobile): add offline inference capability`
- `fix(ai): resolve tensor scaling bug in MobileNetV2`
- `docs(readme): add architecture diagrams`
- `chore(deps): update React Native to 0.74`

## 🚀 Pull Request Guidelines

1. **Keep PRs small**: Do not bundle a UI redesign and a database migration into one PR.
2. **Update Documentation**: If your change modifies an API endpoint, please update `docs/API_REFERENCE.md`.
3. **Describe your changes**: Fill out the provided PR template thoroughly. Include screenshots or GIFs if your PR changes the React Native UI!

We look forward to reviewing your code!

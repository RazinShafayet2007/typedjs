# Contributing to TypedJS

Thank you for your interest in contributing to TypedJS! We welcome contributions from everyone.

## Getting Started

1.  **Fork the repository** on GitHub.
2.  **Clone your fork** locally:
    ```bash
    git clone https://github.com/your-username/typedjs.git
    cd typedjs
    ```
3.  **Install dependencies**:
    ```bash
    npm install
    ```

## Development Workflow

### Running Tests
We use Jest for testing. Ensure all tests pass before submitting a PR.
```bash
npm test
```

### Linting
We use ESLint to maintain code quality.
```bash
npm run lint
```

### Benchmarks
If you are making performance-sensitive changes, please run the benchmarks to ensure no regression.
```bash
npm run bench:full
```

## Submitting a Pull Request

1.  Create a new branch for your feature or fix: `git checkout -b feature/my-new-feature`
2.  Commit your changes with clear messages.
3.  Push to your fork and submit a Pull Request.
4.  Ensure CI checks pass.

## Code Style
-   Use ES Modules.
-   Follow the existing code style (checked by ESLint).
-   Write tests for new features.

Thank you for helping improve TypedJS!

# Local Development

Muninn uses a declarative development environment powered by **Nix** and **devenv** to guarantee consistent tooling across developer environments.

---

## Prerequisites

Ensure you have the following installed on your local operating system:
*   [Nix Package Manager](https://nixos.org/download)
*   [devenv CLI](https://devenv.sh/getting-started/)

---

## Getting Started

1.  Clone the repository and navigate to the project directory:
    ```bash
    git clone https://github.com/olafkfreund/Muninn.git
    cd Muninn
    ```
2.  Launch the development shell. Devenv will automatically download and install the exact versions of Ruby, Bundler, and Jekyll required:
    ```bash
    devenv shell
    ```
3.  Install dependencies:
    ```bash
    bundle install
    npm install
    ```
4.  Launch the local Jekyll server with live-reloading enabled:
    ```bash
    serve
    ```
    This script alias maps to:
    ```bash
    bundle exec jekyll serve --livereload
    ```
5.  Open your browser and navigate to the local server address:
    `http://localhost:4000/`

---

## Production Build

To compile a final optimized static build of the website:
1.  Run the build script:
    ```bash
    build
    ```
    This compiles the Jekyll site and outputs the static assets into the local `_site/` directory, which is excluded from git commits and built remotely by GitHub Actions upon push.

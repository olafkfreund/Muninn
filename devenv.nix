{ pkgs, lib, config, ... }:

{
  # Package list
  packages = with pkgs; [
    git
    gh
  ];

  # Ruby configuration
  languages.ruby = {
    enable = true;
    bundler.enable = true;
  };

  # Custom scripts
  scripts.serve.exec = "bundle exec jekyll serve --livereload";
  scripts.build.exec = "bundle exec jekyll build";
  scripts.agent.exec = ".venv/bin/python3 agent_daemon.py";

  enterShell = ''
    echo "===================================================="
    echo " Welcome to the Muninn Dev Shell!"
    echo "===================================================="
    echo " Ruby Version: $(ruby -v)"
    echo " Bundler Version: $(bundle -v)"
    echo " Available commands:"
    echo "   - serve : Start Jekyll local server with livereload"
    echo "   - build : Run a production build of Jekyll"
    echo "   - agent : Launch the Autonomous Developer Agent"
    echo "===================================================="
  '';
}

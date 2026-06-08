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
    version = "3.4.9";
    bundler.enable = true;
  };

  # Custom scripts
  scripts.serve.exec = "bundle exec jekyll serve --livereload";
  scripts.build.exec = "bundle exec jekyll build";

  enterShell = ''
    echo "===================================================="
    echo " Welcome to the Muninn Dev Shell!"
    echo "===================================================="
    echo " Ruby Version: $(ruby -v)"
    echo " Bundler Version: $(bundle -v)"
    echo " Available commands:"
    echo "   - serve : Start Jekyll local server with livereload"
    echo "   - build : Run a production build of Jekyll"
    echo "===================================================="
  '';
}

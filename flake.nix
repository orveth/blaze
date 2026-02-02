{
  description = "Kanban board - FastAPI backend + vanilla JS frontend";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
        python = pkgs.python311;
        pythonPkgs = python.pkgs;
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = [
            python
            pythonPkgs.fastapi
            pythonPkgs.uvicorn
            pythonPkgs.pydantic
            pythonPkgs.python-multipart
          ];

          shellHook = ''
            echo "🗂️  Kanban dev shell"
            echo "Run: uvicorn backend.main:app --reload"
          '';
        };
      }
    );
}

{
  description = "Kanban board - FastAPI backend + vanilla JS frontend";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.11";
  };

  outputs = { self, nixpkgs }:
    let
      system = "x86_64-linux";
      pkgs = nixpkgs.legacyPackages.${system};
      python = pkgs.python311;
    in
    {
      devShells.${system}.default = pkgs.mkShell {
        buildInputs = [
          python
          python.pkgs.fastapi
          python.pkgs.uvicorn
          python.pkgs.pydantic
        ];

        shellHook = ''
          echo "🗂️  Kanban dev shell"
          echo "Run: uvicorn backend.main:app --reload"
        '';
      };
    };
}

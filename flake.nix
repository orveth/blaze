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
      
      # Python environment with dependencies
      pythonEnv = python.withPackages (ps: [
        ps.fastapi
        ps.uvicorn
        ps.pydantic
      ]);

      # The kanban package
      kanbanPackage = pkgs.stdenv.mkDerivation {
        pname = "kanban";
        version = "0.2.0";

        src = ./.;

        nativeBuildInputs = [ pkgs.makeWrapper ];

        installPhase = ''
          runHook preInstall

          # Install Python backend
          mkdir -p $out/lib/kanban
          cp -r backend $out/lib/kanban/
          cp -r frontend $out/lib/kanban/

          # Create wrapper script
          mkdir -p $out/bin
          makeWrapper ${pythonEnv}/bin/uvicorn $out/bin/kanban-server \
            --set PYTHONPATH "$out/lib/kanban" \
            --add-flags "backend.main:app" \
            --add-flags "--host" \
            --add-flags "\''${KANBAN_HOST:-127.0.0.1}" \
            --add-flags "--port" \
            --add-flags "\''${KANBAN_PORT:-8080}"

          runHook postInstall
        '';

        meta = with pkgs.lib; {
          description = "Personal kanban board with FastAPI backend and vanilla JS frontend";
          homepage = "https://github.com/orveth/kanban";
          license = licenses.mit;
          maintainers = [ ];
          platforms = platforms.linux;
        };
      };

    in
    {
      # Development shell (unchanged)
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

      # Packages
      packages.${system} = {
        default = kanbanPackage;
        kanban = kanbanPackage;
      };

      # NixOS module
      nixosModules = {
        default = import ./module.nix;
        kanban = import ./module.nix;
      };

      # Apps (for `nix run`)
      apps.${system} = {
        default = {
          type = "app";
          program = "${kanbanPackage}/bin/kanban-server";
        };
        kanban = {
          type = "app";
          program = "${kanbanPackage}/bin/kanban-server";
        };
      };
    };
}

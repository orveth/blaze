{
  description = "Blaze - Personal task board with FastAPI backend + vanilla JS frontend";

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

      # The blaze server package
      blazeServer = pkgs.stdenv.mkDerivation {
        pname = "blaze-server";
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
          makeWrapper ${pythonEnv}/bin/uvicorn $out/bin/blaze-server \
            --set PYTHONPATH "$out/lib/kanban" \
            --add-flags "backend.main:app" \
            --add-flags "--host" \
            --add-flags "\''${BLAZE_HOST:-127.0.0.1}" \
            --add-flags "--port" \
            --add-flags "\''${BLAZE_PORT:-8080}"

          runHook postInstall
        '';

        meta = with pkgs.lib; {
          description = "Personal task board with FastAPI backend and vanilla JS frontend";
          homepage = "https://github.com/orveth/blaze";
          license = licenses.mit;
          maintainers = [ ];
          platforms = platforms.linux;
        };
      };

      # The blaze CLI package
      blazeCli = pkgs.rustPlatform.buildRustPackage {
        pname = "blaze-cli";
        version = "0.1.0";

        src = ./cli;

        cargoLock = {
          lockFile = ./cli/Cargo.lock;
        };

        nativeBuildInputs = [ pkgs.pkg-config ];
        buildInputs = [ pkgs.openssl ];

        meta = with pkgs.lib; {
          description = "CLI for Blaze task board";
          homepage = "https://github.com/orveth/blaze";
          license = licenses.mit;
          maintainers = [ ];
          platforms = platforms.linux;
        };
      };

    in
    {
      # Development shell
      devShells.${system}.default = pkgs.mkShell {
        buildInputs = [
          python
          python.pkgs.fastapi
          python.pkgs.uvicorn
          python.pkgs.pydantic
          pkgs.cargo
          pkgs.rustc
          pkgs.pkg-config
          pkgs.openssl
        ];

        shellHook = ''
          echo "🗂️  Blaze dev shell"
          echo "Server: uvicorn backend.main:app --reload"
          echo "CLI: cd cli && cargo build"
        '';
      };

      # Packages
      packages.${system} = {
        default = blazeServer;
        server = blazeServer;
        cli = blazeCli;
      };

      # NixOS module
      nixosModules = {
        default = import ./module.nix;
        blaze = import ./module.nix;
      };

      # Apps (for `nix run`)
      apps.${system} = {
        default = {
          type = "app";
          program = "${blazeServer}/bin/blaze-server";
        };
        server = {
          type = "app";
          program = "${blazeServer}/bin/blaze-server";
        };
        cli = {
          type = "app";
          program = "${blazeCli}/bin/blaze";
        };
      };
    };
}

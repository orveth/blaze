{ config, lib, pkgs, ... }:

let
  cfg = config.services.blaze;
  
  # Import the package from the flake
  blazePackage = cfg.package;
in
{
  options.services.blaze = {
    enable = lib.mkEnableOption "Blaze task board service";

    package = lib.mkOption {
      type = lib.types.package;
      description = "The blaze package to use.";
    };

    port = lib.mkOption {
      type = lib.types.port;
      default = 8080;
      description = "Port to listen on.";
    };

    host = lib.mkOption {
      type = lib.types.str;
      default = "127.0.0.1";
      description = "Host/IP to bind to. Use 0.0.0.0 for all interfaces.";
    };

    dataDir = lib.mkOption {
      type = lib.types.path;
      default = "/var/lib/blaze";
      description = "Directory for persistent data.";
    };

    passwordFile = lib.mkOption {
      type = lib.types.nullOr lib.types.path;
      default = null;
      description = ''
        Path to a file containing the API token/password.
        If null, a random token is generated on first start and stored in dataDir.
      '';
    };

    openFirewall = lib.mkOption {
      type = lib.types.bool;
      default = false;
      description = "Whether to open the firewall port.";
    };

    user = lib.mkOption {
      type = lib.types.str;
      default = "blaze";
      description = "User account under which blaze runs.";
    };

    group = lib.mkOption {
      type = lib.types.str;
      default = "blaze";
      description = "Group under which blaze runs.";
    };
  };

  config = lib.mkIf cfg.enable {
    # Create user and group
    users.users.${cfg.user} = {
      isSystemUser = true;
      group = cfg.group;
      home = cfg.dataDir;
      description = "Blaze task board service user";
    };

    users.groups.${cfg.group} = { };

    # Systemd service
    systemd.services.blaze = {
      description = "Blaze Service";
      wantedBy = [ "multi-user.target" ];
      after = [ "network.target" ];

      environment = {
        BLAZE_DATA_DIR = cfg.dataDir;
      } // lib.optionalAttrs (cfg.passwordFile != null) {
        BLAZE_TOKEN_FILE = cfg.passwordFile;
      };

      serviceConfig = {
        Type = "simple";
        User = cfg.user;
        Group = cfg.group;
        WorkingDirectory = cfg.dataDir;

        ExecStart = ''
          ${blazePackage}/bin/blaze-server \
            --host ${cfg.host} \
            --port ${toString cfg.port}
        '';

        Restart = "on-failure";
        RestartSec = "5s";

        # Create state directory with correct permissions
        StateDirectory = "blaze";
        StateDirectoryMode = "0750";

        # Hardening
        NoNewPrivileges = true;
        ProtectSystem = "strict";
        ProtectHome = true;
        PrivateTmp = true;
        PrivateDevices = true;
        ProtectKernelTunables = true;
        ProtectKernelModules = true;
        ProtectControlGroups = true;
        RestrictAddressFamilies = [ "AF_INET" "AF_INET6" "AF_UNIX" ];
        RestrictNamespaces = true;
        RestrictRealtime = true;
        RestrictSUIDSGID = true;
        MemoryDenyWriteExecute = true;
        LockPersonality = true;

        # Allow binding to ports
        AmbientCapabilities = lib.mkIf (cfg.port < 1024) [ "CAP_NET_BIND_SERVICE" ];
      };
    };

    # Firewall
    networking.firewall.allowedTCPPorts = lib.mkIf cfg.openFirewall [ cfg.port ];
  };
}

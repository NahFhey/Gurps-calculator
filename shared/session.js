/**
 * Session and role types shared between client and server.
 */
export var Role;
(function (Role) {
    Role["GM"] = "gm";
    Role["Player"] = "player";
    Role["Spectator"] = "spectator";
})(Role || (Role = {}));

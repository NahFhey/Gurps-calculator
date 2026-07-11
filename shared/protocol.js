/**
 * Socket.IO protocol — event names and payload types shared between client and server.
 */
// ---------------------------------------------------------------------------
// Event names
// ---------------------------------------------------------------------------
export const EVENTS = {
    /** Client → Server: join a campaign room */
    JOIN_ROOM: 'room:join',
    /** Server → Client: confirm room joined */
    ROOM_JOINED: 'room:joined',
    /** Server → Room: campaign state was updated */
    STATE_UPDATED: 'state:updated',
    /** Server → Room: a player connected */
    PLAYER_JOINED: 'player:joined',
    /** Server → Room: a player disconnected */
    PLAYER_LEFT: 'player:left',
    /** Server → Room: current player count */
    PLAYER_COUNT: 'player:count',
    /** Server → GM: full player list */
    PLAYER_LIST: 'player:list',
};

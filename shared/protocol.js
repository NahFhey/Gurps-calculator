/**
 * Socket.IO protocol — event names and payload types shared between client and server.
 */
/** Paths relative to the /api router. */
export const ASSET_ROUTES = {
    list: '/campaigns/:id/assets',
    item: '/campaigns/:id/assets/:assetId',
};
export function campaignAssetsPath(campaignId) {
    return `/api${ASSET_ROUTES.list.replace(':id', encodeURIComponent(campaignId))}`;
}
export function campaignAssetPath(campaignId, assetId) {
    return `${campaignAssetsPath(campaignId)}/${encodeURIComponent(assetId)}`;
}
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

/**
 * Socket.IO protocol — event names and payload types shared between client and server.
 */
import type { Role } from './session.js';
/** Paths relative to the /api router. */
export declare const ASSET_ROUTES: {
    readonly list: "/campaigns/:id/assets";
    readonly item: "/campaigns/:id/assets/:assetId";
};
export declare function campaignAssetsPath(campaignId: string): string;
export declare function campaignAssetPath(campaignId: string, assetId: string): string;
export interface AssetMeta {
    id: string;
    mime: string;
    size: number;
}
export interface AssetUploadResponse {
    id: string;
    size: number;
    created: boolean;
}
export interface AssetListResponse {
    assets: AssetMeta[];
}
export declare const EVENTS: {
    /** Client → Server: join a campaign room */
    readonly JOIN_ROOM: "room:join";
    /** Server → Client: confirm room joined */
    readonly ROOM_JOINED: "room:joined";
    /** Server → Room: campaign state was updated */
    readonly STATE_UPDATED: "state:updated";
    /** Server → Room: a player connected */
    readonly PLAYER_JOINED: "player:joined";
    /** Server → Room: a player disconnected */
    readonly PLAYER_LEFT: "player:left";
    /** Server → Room: current player count */
    readonly PLAYER_COUNT: "player:count";
    /** Server → GM: full player list */
    readonly PLAYER_LIST: "player:list";
};
export interface JoinRoomPayload {
    campaignId: string;
    role: Role;
    displayName: string;
}
export interface RoomJoinedPayload {
    campaignId: string;
    playerCount: number;
}
export interface StateUpdatedPayload {
    version: number;
    updatedAt: string;
}
export interface PlayerJoinedPayload {
    displayName: string;
    role: Role;
    playerCount: number;
}
export interface PlayerLeftPayload {
    displayName: string;
    playerCount: number;
}
export interface PlayerCountPayload {
    count: number;
}
export interface PlayerInfo {
    socketId: string;
    displayName: string;
    role: Role;
}
export interface PlayerListPayload {
    players: PlayerInfo[];
}

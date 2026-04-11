/**
 * Session and role types shared between client and server.
 */
export declare enum Role {
    GM = "gm",
    Player = "player",
    Spectator = "spectator"
}
export interface SessionInfo {
    sessionId: string;
    campaignId: string;
    joinCode: string;
    role: Role;
}
export interface CampaignInfo {
    id: string;
    name: string;
    version: number;
    createdAt: string;
    updatedAt: string;
}

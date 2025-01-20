import { Party } from "@/matchmaker/entity/party";
import { PlayerInParty } from "@/matchmaker/entity/player-in-party";
import { QueueMeta } from "@/matchmaker/entity/queue-meta";
import { Room } from "@/matchmaker/entity/room";
import { PlayerInRoom } from "@/matchmaker/entity/player-in-room";
import { PartyInvite } from "@/matchmaker/entity/party-invite";

export default [
  Party,
  PlayerInParty,
  QueueMeta,
  Room,
  PlayerInRoom,
  PartyInvite
];

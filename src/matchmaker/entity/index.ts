import { Party } from "@/matchmaker/entity/party";
import { PlayerInParty } from "@/matchmaker/entity/player-in-party";
import { Room } from "@/matchmaker/entity/room";
import { PlayerInRoom } from "@/matchmaker/entity/player-in-room";
import { PartyInvite } from "@/matchmaker/entity/party-invite";
import { QueueSettings } from "@/matchmaker/entity/queue-settings";

export default [
  Party,
  PlayerInParty,
  Room,
  PlayerInRoom,
  PartyInvite,
  QueueSettings,
];

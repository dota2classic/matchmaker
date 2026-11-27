import { BanReason } from "@/gateway/shared-types/ban";

export function isSecretQueueBan(ban: {
  isBanned?: boolean;
  status?: number;
}): boolean {
  return (
    ban.isBanned === true &&
    (ban.status === BanReason.INFINITE_BAN ||
      ban.status === BanReason.ABANDON ||
      ban.status === BanReason.RULE_VIOLATION)
  );
}

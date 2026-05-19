import { call } from "../core/builtins";
import type { InlineFunction } from "../core/function";
import { Address, Bool, Weis } from "../core/types";

type Recipient = { address: Address; amount: bigint };
type RecipientGroup = { amount: bigint; recipients: Address[] };

const batchSendFixedAmount = (
  recipients: readonly Address[],
  amount: bigint,
): InlineFunction => {
  if (recipients.length == 0)
    throw new RangeError("batchSend requires at least one recipient");
  if (recipients.length == 1) {
    const recipient = recipients[0]!;
    return evm (): Bool => {
      return call(0, recipient, amount, 0, 0, 0, 0);
    };
  }
  return evm (): Bool => {
    const value: Weis = amount;
    static for (const recipient of recipients) {
      call(0, recipient, value, 0, 0, 0, 0);
    }
  };
}

const batchSend = (recipients: readonly Recipient[]): InlineFunction => {
  const groups = groupByAmount(recipients);
  if (groups.length == 0)
    throw new RangeError("batchSend requires at least one recipient");
  return evm (): Bool => {
    static for (const group of groups) {
      const value: Weis = group.amount;
      static for (const recipient of group.recipients) {
        call(0, recipient, value, 0, 0, 0, 0);
      }
    }
  };
}

const groupByAmount = (recipients: readonly Recipient[]): RecipientGroup[] => {
  const sorted = [...recipients].sort((a, b) =>
    a.amount < b.amount ? -1 : a.amount > b.amount ? 1 : 0);
  const groups: RecipientGroup[] = [];
  for (const { address, amount } of sorted) {
    const last = groups[groups.length - 1];
    if (last && last.amount == amount)
      last.recipients.push(address);
    else
      groups.push({ amount, recipients: [address] });
  }
  return groups;
}

export {
  batchSend,
  batchSendFixedAmount,
  Recipient
};

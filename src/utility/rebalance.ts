import { EncodeObject } from "@cosmjs/proto-signing";
import { MsgBeginRedelegate, MsgDelegate, MsgUndelegate } from "cosmjs-types/cosmos/staking/v1beta1/tx";

interface ValidatorTarget {
  validatorAddress: string;
  percentage: number; // 0-100
}

interface CurrentDelegation {
  validatorAddress: string;
  amount: string; // in base denom
}

interface RebalanceParams {
  validatorTargets: ValidatorTarget[];
  preferredStakedPercentage: number; // 0-100
  currentDelegations: CurrentDelegation[];
  availableBalance: string; // unstaked tokens
  denom: string; // e.g., "uatom"
}

export function calculateRebalanceMessages (
  delegatorAddress: string,
  params: RebalanceParams
): EncodeObject[] {
  const {
    validatorTargets,
    preferredStakedPercentage,
    currentDelegations,
    availableBalance,
    denom
  } = params;

  // Validate that percentages add up to 100
  const totalPercentage = validatorTargets.reduce(
    (sum, vt) => sum + vt.percentage,
    0
  );
  if (Math.abs(totalPercentage - 100) > 0.01) {
    throw new Error(`Validator percentages must add up to 100%, got ${totalPercentage}%`);
  }

  // Calculate total current staked amount
  const totalCurrentStaked = currentDelegations.reduce(
    (sum, d) => sum + BigInt(d.amount),
    BigInt(0)
  );

  // Calculate total balance (staked + available)
  const totalBalance = totalCurrentStaked + BigInt(availableBalance);

  // Calculate target total staked amount
  const targetTotalStaked =
    totalBalance * BigInt(Math.floor(preferredStakedPercentage * 100)) /
    BigInt(10000);

  // Calculate target delegation for each validator
  const targetDelegations = new Map<string, bigint>();
  validatorTargets.forEach((vt) => {
    const targetAmount =
      targetTotalStaked * BigInt(Math.floor(vt.percentage * 100)) /
      BigInt(10000);
    targetDelegations.set(
      vt.validatorAddress,
      targetAmount
    );
  });

  // Create a map of current delegations
  const currentDelegationMap = new Map<string, bigint>();
  currentDelegations.forEach((d) => {
    currentDelegationMap.set(
      d.validatorAddress,
      BigInt(d.amount)
    );
  });

  // Calculate differences
  const messages: EncodeObject[] = [];
  const surplusValidators: { address: string;
    surplus: bigint; }[] = [];
  const deficitValidators: { address: string;
    deficit: bigint; }[] = [];

  /*
   * First pass: identify surpluses and deficits
   * Handle validators in target list
   */
  validatorTargets.forEach((vt) => {
    const current = currentDelegationMap.get(vt.validatorAddress) || BigInt(0);
    const target = targetDelegations.get(vt.validatorAddress) || BigInt(0);
    const diff = target - current;

    if (diff > 0) {
      deficitValidators.push({
        address: vt.validatorAddress,
        deficit: diff
      });
    } else if (diff < 0) {
      surplusValidators.push({
        address: vt.validatorAddress,
        surplus: -diff
      });
    }
  });

  // Handle validators not in target list (should be fully undelegated)
  currentDelegations.forEach((d) => {
    if (!targetDelegations.has(d.validatorAddress)) {
      surplusValidators.push({
        address: d.validatorAddress,
        surplus: BigInt(d.amount)
      });
    }
  });

  /*
   * Second pass: create redelegate messages
   * Try to use redelegations to move tokens between validators
   */
  let surplusIndex = 0;
  let deficitIndex = 0;

  while (
    surplusIndex < surplusValidators.length &&
    deficitIndex < deficitValidators.length
  ) {
    const surplus = surplusValidators[surplusIndex];
    const deficit = deficitValidators[deficitIndex];

    const transferAmount =
      surplus.surplus < deficit.deficit
        ? surplus.surplus
        : deficit.deficit;

    messages.push({
      typeUrl: "/cosmos.staking.v1beta1.MsgBeginRedelegate",
      value: MsgBeginRedelegate.fromPartial({
        delegatorAddress,
        validatorSrcAddress: surplus.address,
        validatorDstAddress: deficit.address,
        amount: {
          denom,
          amount: transferAmount.toString()
        }
      })
    });

    surplus.surplus -= transferAmount;
    deficit.deficit -= transferAmount;

    if (surplus.surplus === BigInt(0)) surplusIndex++;
    if (deficit.deficit === BigInt(0)) deficitIndex++;
  }

  // Third pass: handle remaining surpluses (undelegate)
  while (surplusIndex < surplusValidators.length) {
    const surplus = surplusValidators[surplusIndex];
    if (surplus.surplus > 0) {
      messages.push({
        typeUrl: "/cosmos.staking.v1beta1.MsgUndelegate",
        value: MsgUndelegate.fromPartial({
          delegatorAddress,
          validatorAddress: surplus.address,
          amount: {
            denom,
            amount: surplus.surplus.toString()
          }

        })
      });
    }
    surplusIndex++;
  }

  // Fourth pass: handle remaining deficits (delegate from available balance)
  while (deficitIndex < deficitValidators.length) {
    const deficit = deficitValidators[deficitIndex];
    if (deficit.deficit > 0) {
      messages.push({
        typeUrl: "/cosmos.staking.v1beta1.MsgDelegate",
        value: MsgDelegate.fromPartial({
          delegatorAddress,
          validatorAddress: deficit.address,
          amount: {
            denom,
            amount: deficit.deficit.toString()
          }
        })
      });
    }
    deficitIndex++;
  }

  return messages;
}

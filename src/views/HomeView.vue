<script setup lang="ts">
import { Coin } from "@cosmjs/proto-signing";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/vue-query";
import { computed, Ref } from "vue";

import chainConfig from "@/chain-config";
import Claim from "@/components/popups/Claim.vue";
import Delegate from "@/components/popups/Delegate.vue";
import Redelegate from "@/components/popups/Redelegate.vue";
import Undelegate from "@/components/popups/Undelegate.vue";
import TokenAmount from "@/components/ui/TokenAmount.vue";
import { useWallet } from "@/composables/useWallet";

import Icon from "../components/ui/Icon.vue";

const Wallet = useWallet();
const queryClient = useQueryClient();
const fetcher = () => fetch(chainConfig.rest + "cosmos/staking/v1beta1/validators?pagination.limit=1000").then((response) => response.json());
const delegationsFetcher = (address: Ref<string>) => fetch(`${chainConfig.rest}cosmos/staking/v1beta1/delegations/${address.value}?pagination.limit=1000`).then((response) => response.json());
const rewardsFetcher = (address: Ref<string>) => fetch(`${chainConfig.rest}cosmos/distribution/v1beta1/delegators/${address.value}/rewards?pagination.limit=1000`).then((response) => response.json());
const nakamotoBonusCoefficientFetcher = () => fetch(chainConfig.rest + "cosmos/distribution/v1beta1/nakamoto_bonus_coefficient").then((response) => response.json());
const annualProvisionsFetcher = () => fetch(chainConfig.rest + "cosmos/mint/v1beta1/annual_provisions").then((response) => response.json());
const distributionParamsFetcher = () => fetch(chainConfig.rest + "cosmos/distribution/v1beta1/params").then((response) => response.json());
const { data } = useQuery({
  queryKey: ["validators"],
  queryFn: () => fetcher(),
  placeholderData: keepPreviousData
});
const { data: nakamotoBonusCoefficientData } = useQuery({
  queryKey: ["nakamotoBonusCoefficient"],
  queryFn: () => nakamotoBonusCoefficientFetcher(),
  placeholderData: keepPreviousData
});
const { data: annualProvisionsData } = useQuery({
  queryKey: ["annualProvisions"],
  queryFn: () => annualProvisionsFetcher(),
  placeholderData: keepPreviousData
});
const { data: distributionParamsData } = useQuery({
  queryKey: ["distributionParams"],
  queryFn: () => distributionParamsFetcher(),
  placeholderData: keepPreviousData
});

/*
 * The bonus coefficient (η) is a LegacyDec serialized as a string (e.g.
 * "0.030000000000000000") representing the share of rewards distributed equally.
 * We surface it as a percentage to match the explanatory text. It is undefined
 * on chains that don't expose the endpoint yet, in which case the box is hidden.
 */
const nakamotoBonusEta = computed(() => {
  const coefficient = nakamotoBonusCoefficientData.value?.coefficient;
  if (coefficient === undefined) {
    return undefined;
  }
  return Number(coefficient);
});
const nakamotoBonusCoefficient = computed(() => {
  if (nakamotoBonusEta.value === undefined) {
    return undefined;
  }
  return new Intl.NumberFormat(
    "en-US",
    { style: "percent",
      maximumFractionDigits: 2 }
  ).format(nakamotoBonusEta.value);
});

/*
 * Token total and count of the bonded validator set, shared by the Nakamoto
 * Coefficient and the per-validator effective APR.
 */
const bondedStats = computed(() => {
  const validators = data.value?.validators;
  if (!validators) {
    return undefined;
  }
  const bondedTokens = validators.
    filter((validator: { status: string }) => validator.status === "BOND_STATUS_BONDED").
    map((validator: { tokens: string }) => BigInt(validator.tokens));
  if (bondedTokens.length === 0) {
    return undefined;
  }
  const totalTokens = bondedTokens.reduce(
    (sum: bigint, tokens: bigint) => sum + tokens,
    0n
  );
  return { count: bondedTokens.length,
    totalTokens,
    sortedTokens: bondedTokens.toSorted((a: bigint, b: bigint) => {
      if (a > b) {
        return -1;
      }
      if (a < b) {
        return 1;
      }
      return 0;
    }) };
});

/*
 * The Nakamoto Coefficient is the minimum number of validators whose combined
 * voting power exceeds one-third of the total — the point at which they could
 * halt consensus. It is not exposed by the chain, so we derive it from the
 * bonded validators by accumulating tokens from largest to smallest until the
 * running total passes one third.
 */
const nakamotoCoefficient = computed(() => {
  const stats = bondedStats.value;
  if (!stats) {
    return undefined;
  }
  let cumulativeTokens = 0n;
  let count = 0;
  for (const tokens of stats.sortedTokens) {
    cumulativeTokens += tokens;
    count++;
    if (cumulativeTokens * 3n > stats.totalTokens) {
      break;
    }
  }
  return count;
});

/*
 * Baseline network staking APR, before the Nakamoto Bonus redistribution:
 *   APR_base = annual_provisions * (1 - community_tax) / bonded_tokens
 * Returned together with the bonus coefficient (η) and the average bonded stake
 * so the per-validator effective APR can be derived without refetching.
 */
const aprInputs = computed(() => {
  const annualProvisions = annualProvisionsData.value?.annual_provisions;
  const communityTax = distributionParamsData.value?.params?.community_tax;
  const eta = nakamotoBonusEta.value;
  const stats = bondedStats.value;
  if (annualProvisions === undefined || communityTax === undefined || eta === undefined || !stats) {
    return undefined;
  }
  const bondedTokens = Number(stats.totalTokens);
  if (bondedTokens === 0) {
    return undefined;
  }
  const rewardPool = Number(annualProvisions) * (1 - Number(communityTax));
  return { baseApr: rewardPool / bondedTokens,
    eta,
    averageStake: bondedTokens / stats.count };
});

/*
 * Effective APR for delegating to a given validator, net of its commission.
 * The Nakamoto Bonus splits rewards into a proportional share (1 - η) and an
 * equal-per-validator share (η), so smaller validators earn a higher APR:
 *   APR_i = APR_base * [(1 - η) + η * (avg_stake / validator_stake)]
 * Only bonded validators earn staking rewards, so others return undefined.
 */
const getEffectiveApr = (validator: {
  status: string;
  tokens: string;
  commission?: { commission_rates?: { rate?: string } };
}) => {
  const inputs = aprInputs.value;
  if (!inputs || validator.status !== "BOND_STATUS_BONDED") {
    return undefined;
  }
  const stake = Number(validator.tokens);
  if (stake === 0) {
    return undefined;
  }
  const grossApr = inputs.baseApr * (1 - inputs.eta + inputs.eta * inputs.averageStake / stake);
  const commission = Number(validator.commission?.commission_rates?.rate ?? 0);
  return new Intl.NumberFormat(
    "en-US",
    { style: "percent",
      maximumFractionDigits: 2 }
  ).format(grossApr * (1 - commission));
};

const orderedValidators = computed(() => {
  if (!data) {
    return [];
  }

  const validatorsSortedByTokens = data.value.validators.toSorted((a: { tokens: bigint;
    status: string; }, b: { tokens: bigint;
    status: string; }) => {
    if (a.status == b.status) {
      return b.tokens - a.tokens;
    }

    if (a.status == "BOND_STATUS_BONDED") {
      return -1;
    }

    if (a.status == "BOND_STATUS_UNBONDING" && b.status == "BOND_STATUS_UNBONDED") {
      return -1;
    }

    return 1;
  });

  const delegatedValidators = [];
  for (let i = validatorsSortedByTokens.length - 1; i >= 0; i--) {
    const validator = validatorsSortedByTokens[i];
    if (isDelegating(validator.operator_address)) {
      delegatedValidators.unshift(validator);
      validatorsSortedByTokens.splice(
        i,
        1
      );
      continue;
    }
  }

  return [
    ...delegatedValidators,
    ...validatorsSortedByTokens
  ];
});

const { data: delegations } = useQuery({
  queryKey: ["delegations"],
  queryFn: () => delegationsFetcher(Wallet.address),
  enabled: Wallet.loggedIn
});
const { data: rewards } = useQuery({
  queryKey: ["rewards"],
  queryFn: () => rewardsFetcher(Wallet.address),
  enabled: Wallet.loggedIn
});
const userDelegations = computed(() => {
  if (delegations.value) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return delegations.value.delegation_responses as any[];
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return [] as any[];
  }
});
setInterval(
  () => {
    queryClient.invalidateQueries({ queryKey: ["rewards"] });
    queryClient.invalidateQueries({ queryKey: ["delegations"] });
    queryClient.invalidateQueries({ queryKey: ["validators"] });
    queryClient.invalidateQueries({ queryKey: ["nakamotoBonusCoefficient"] });
    queryClient.invalidateQueries({ queryKey: ["annualProvisions"] });
    queryClient.invalidateQueries({ queryKey: ["distributionParams"] });
  },
  30000
);
const userRewards = computed(() => {
  if (rewards.value) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return rewards.value.rewards as any[];
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return [] as any[];
  }
});
const isDelegating = (addr: string) => {
  if (userDelegations.value.length == 0) {
    return false;
  } else {
    if (userDelegations.value.find((a) => a.delegation.validator_address == addr)) {
      return true;
    } else {
      return false;
    }
  }
};
const getReward = (addr: string) => {
  if (userRewards.value.length == 0) {
    return [] as Coin[];
  } else {
    if (userRewards.value.find((a) => a.validator_address == addr)) {
      return userRewards.value.find((a) => a.validator_address == addr).reward;
    } else {
      return [] as Coin[];
    }
  }
};
const getDelegationAmount = (addr: string) => {
  if (userDelegations.value.length == 0) {
    return 0n;
  } else {
    if (userDelegations.value.find((a) => a.delegation.validator_address == addr)) {
      return BigInt(userDelegations.value.find((a) => a.delegation.validator_address == addr).balance.amount);
    } else {
      return 0n;
    }
  }
};
const getDisplayReward = (validator: string) => {
  const rewards = getReward(validator).filter((x: { denom: string }) => x.denom == chainConfig.stakeCurrency.coinMinimalDenom);
  const total =
    0 +
    rewards.reduce(
      (sum: number, reward: Coin) => {
        return sum + Number(reward.amount);
      },
      0
    );
  return rewards.length == 0
    ? undefined
    : total / Math.pow(
      10,
      chainConfig.stakeCurrency.coinDecimals
    );
};
</script>

<template>
  <div class="flex flex-col w-full pb-[72px] gap-4">
    <div v-if="userRewards.length > 0">
      <Claim :validator-address="userRewards.map((x) => x.validator_address)" />
    </div>
    <!-- Network Decentralization -->
    <div class="flex flex-col bg-grey-400 rounded-md p-4 gap-4">
      <!-- Nakamoto Coefficient -->
      <div class="flex flex-col gap-2">
        <div class="flex flex-row justify-between items-center gap-4 flex-wrap">
          <span class="text-grey-50 text-200 font-bold">Nakamoto Coefficient</span>
          <span class="text-light text-400">{{ nakamotoCoefficient ?? "—" }}</span>
        </div>
        <p class="text-grey-100 text-100">
          The minimum number of validators whose combined voting power exceeds one third of the total —
          the number that would need to collude to halt consensus. A higher value means the network is
          more decentralized.
        </p>
      </div>
      <!-- Nakamoto Bonus Coefficient -->
      <div v-if="nakamotoBonusCoefficient" class="flex flex-col gap-2 border-t pt-4 border-grey-200">
        <div class="flex flex-row justify-between items-center gap-4 flex-wrap">
          <span class="text-grey-50 text-200 font-bold">Nakamoto Bonus Coefficient</span>
          <span class="text-light text-400">{{ nakamotoBonusCoefficient }}</span>
        </div>
        <p class="text-grey-100 text-100">
          The share of staking rewards (η) distributed equally across all validators instead of
          proportionally to stake. This raises the reward-per-stake of smaller validators, giving
          delegators an incentive to support them and improve the Nakamoto Coefficient above. It adjusts
          weekly, ranging between 3% and 100%. Each validator's resulting effective APR — net of its
          commission — is shown below.
        </p>
      </div>
    </div>
    <div v-if="data">
      <div v-for="(validator, index) in orderedValidators" :key="index" class="flex flex-col">
        <div class="flex flex-col bg-grey-400 rounded-md mb-4 p-4 flex-wrap gap-4">
          <div class="flex flex-row justify-between flex-wrap gap-4">
            <!-- Validator Info -->
            <div class="flex flex-row gap-4 items-center">
              <!-- Validator Activity Status -->
              <div
                class="w-2 h-full rounded-full"
                :class="validator.status == 'BOND_STATUS_BONDED' ? [' bg-gradient-900 '] : ['bg-red-400']"
              />
              <Icon v-if="validator.jailed" icon="jailed" :size="2" class="text-grey-50" title="Jailed" />
              <div class="flex flex-col gap-2">
                <span class="text-grey-50 text-200 font-bold">
                  {{ validator.description.moniker }}
                </span>
                <span class="text-grey-100 text-100 text-wrap break-all">
                  {{ validator.operator_address }}
                </span>
              </div>
            </div>
            <!-- Validator Stake -->
            <div class="flex flex-col gap-2 flex-grow items-start md:items-end">
              <span class="text-grey-50 text-100 text-left md:text-right">Delegated Power</span>
              <TokenAmount
                :amount="validator.tokens / Math.pow(10, chainConfig.stakeCurrency.coinDecimals)"
                :denom="chainConfig.stakeCurrency.coinDenom"
                class="text-grey-100 text-100"
              />
            </div>
            <!-- Effective APR (incl. Nakamoto Bonus, net of commission) -->
            <div
              v-if="getEffectiveApr(validator)"
              class="flex flex-col gap-2 items-start md:items-end"
            >
              <span class="text-grey-50 text-100 text-left md:text-right">Effective APR</span>
              <span class="text-gradient text-100 font-bold">{{ getEffectiveApr(validator) }}</span>
            </div>
            <div
              v-if="
                !isDelegating(validator.operator_address) &&
                !validator.jailed &&
                validator.status == 'BOND_STATUS_BONDED'
              "
              class="flex flex-row items-center justify-center"
            >
              <Delegate
                v-if="Wallet.loggedIn.value"
                :validator-address="validator.operator_address"
                class="flex-grow"
              />
            </div>
          </div>
          <div v-if="isDelegating(validator.operator_address)" class="flex flex-col border-t pt-4 border-grey-200">
            <!-- Reward Display -->
            <div class="flex flex-row gap-2">
              <div class="flex flex-col gap-2 items-center justify-center rounded-sm w-full p-4">
                <TokenAmount
                  :amount="
                    Number(getDelegationAmount(validator.operator_address)) /
                    Math.pow(10, chainConfig.stakeCurrency.coinDecimals)
                  "
                  :denom="chainConfig.stakeCurrency.coinDenom"
                  class="text-light text-400"
                />
                <span class="text-grey-100 text-300">Staked</span>
              </div>
              <div class="flex flex-col gap-2 items-center justify-center rounded-sm w-full p-4">
                <TokenAmount
                  :amount="getDisplayReward(validator.operator_address)"
                  :denom="chainConfig.stakeCurrency.coinDenom"
                  class="text-light text-400"
                />
                <span class="text-grey-100 text-300"> Rewards </span>
              </div>
            </div>
            <!-- Actions -->
            <div class="flex flex-row gap-2 mt-4 flex-wrap w-full">
              <Delegate
                v-if="Wallet.loggedIn.value"
                :validator-address="validator.operator_address"
                class="flex-grow"
              />
              <Redelegate
                v-if="Wallet.loggedIn.value && isDelegating(validator.operator_address)"
                :validator-list="orderedValidators"
                :validator-address="validator.operator_address"
                :delegation-amount="getDelegationAmount(validator.operator_address)"
                class="flex-grow"
              />
              <Undelegate
                v-if="Wallet.loggedIn.value && isDelegating(validator.operator_address)"
                :validator-address="validator.operator_address"
                :delegation-amount="getDelegationAmount(validator.operator_address)"
                class="flex-grow"
              />
              <Claim
                v-if="Wallet.loggedIn.value && getReward(validator.operator_address).length > 0"
                :validator-address="[validator.operator_address]"
                class="flex-grow"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

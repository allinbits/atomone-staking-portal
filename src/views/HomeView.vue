<script setup lang="ts">
import { Coin } from "@cosmjs/proto-signing";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/vue-query";
import { computed, Ref } from "vue";

import chainConfig from "@/chain-config.json";
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
const { data } = useQuery({
  queryKey: ["validators"],
  queryFn: () => fetcher(),
  placeholderData: keepPreviousData
});

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

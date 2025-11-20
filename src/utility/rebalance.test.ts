/* eslint-disable max-lines-per-function */
/* eslint-disable max-lines */
import { EncodeObject } from "@cosmjs/proto-signing";
import { MsgBeginRedelegate, MsgDelegate, MsgUndelegate } from "cosmjs-types/cosmos/staking/v1beta1/tx";
import { describe, expect, it } from "vitest";

import { calculateRebalanceMessages } from "./rebalance";

// Type guards for message types using typeUrl property
function isMsgDelegate (msg: EncodeObject): msg is EncodeObject & { value: MsgDelegate } {
  return msg.typeUrl === "/cosmos.staking.v1beta1.MsgDelegate";
}

function isMsgBeginRedelegate (msg: EncodeObject): msg is EncodeObject & { value: MsgBeginRedelegate } {
  return msg.typeUrl === "/cosmos.staking.v1beta1.MsgBeginRedelegate";
}

function isMsgUndelegate (msg: EncodeObject): msg is EncodeObject & { value: MsgUndelegate } {
  return msg.typeUrl === "/cosmos.staking.v1beta1.MsgUndelegate";
}

// Simulate the state transitions based on the generated messages to test outcomes
function simulateStateTransitions (
  currentDelegations: Array<{ validatorAddress: string;
    amount: string; }>,
  availableBalance: string,
  messages: EncodeObject[]
): {
  finalDelegations: Map<string, bigint>;
  finalBalance: bigint;
} {
  const delegations = new Map<string, bigint>();

  // Initialize with current delegations
  for (const d of currentDelegations) {
    delegations.set(
      d.validatorAddress,
      BigInt(d.amount)
    );
  }
  let balance = BigInt(availableBalance);

  // Apply each message
  for (const msg of messages) {
    if (isMsgDelegate(msg)) {
      const delegateMsg = msg.value as MsgDelegate;
      const amount = BigInt(delegateMsg.amount?.amount || "0");
      const validator = delegateMsg.validatorAddress;

      // Delegate: decrease balance, increase delegation
      balance -= amount;
      delegations.set(
        validator,
        (delegations.get(validator) || BigInt(0)) + amount
      );
    } else if (isMsgBeginRedelegate(msg)) {
      const redelegateMsg = msg.value as MsgBeginRedelegate;
      const amount = BigInt(redelegateMsg.amount?.amount || "0");
      const srcValidator = redelegateMsg.validatorSrcAddress;
      const dstValidator = redelegateMsg.validatorDstAddress;

      // Redelegate: decrease source, increase destination
      const srcAmount = delegations.get(srcValidator) || BigInt(0);
      delegations.set(
        srcValidator,
        srcAmount - amount
      );
      delegations.set(
        dstValidator,
        (delegations.get(dstValidator) || BigInt(0)) + amount
      );
    } else if (isMsgUndelegate(msg)) {
      const undelegateMsg = msg.value as MsgUndelegate;
      const amount = BigInt(undelegateMsg.amount?.amount || "0");
      const validator = undelegateMsg.validatorAddress;

      // Undelegate: decrease delegation, increase balance
      const validatorAmount = delegations.get(validator) || BigInt(0);
      delegations.set(
        validator,
        validatorAmount - amount
      );
      balance += amount;
    }
  }

  return { finalBalance: balance,
    finalDelegations: delegations };
}
describe(
  "calculateRebalanceMessages",
  () => {
    const delegatorAddress = "atone1test123";
    const denom = "uatone";
    const validator1 = "atonevaloper1";
    const validator2 = "atonevaloper2";
    const validator3 = "atonevaloper3";

    describe(
      "validation",
      () => {
        it(
          "should throw error when validator percentages do not add up to 100",
          () => {
            expect(() => calculateRebalanceMessages(
              delegatorAddress,
              {
                validatorTargets: [
                  { validatorAddress: validator1,
                    percentage: 50 },
                  { validatorAddress: validator2,
                    percentage: 40 }
                ],
                preferredStakedPercentage: 100,
                currentDelegations: [],
                availableBalance: "1000000",
                denom
              }
            )).toThrow("Validator percentages must add up to 100%, got 90%");
          }
        );

        it(
          "should throw error when validator percentages exceed 100",
          () => {
            expect(() => calculateRebalanceMessages(
              delegatorAddress,
              {
                validatorTargets: [
                  { validatorAddress: validator1,
                    percentage: 60 },
                  { validatorAddress: validator2,
                    percentage: 50 }
                ],
                preferredStakedPercentage: 100,
                currentDelegations: [],
                availableBalance: "1000000",
                denom
              }
            )).toThrow("Validator percentages must add up to 100%, got 110%");
          }
        );

        it(
          "should accept percentages that add up to 100",
          () => {
            expect(() => calculateRebalanceMessages(
              delegatorAddress,
              {
                validatorTargets: [
                  { validatorAddress: validator1,
                    percentage: 50 },
                  { validatorAddress: validator2,
                    percentage: 50 }
                ],
                preferredStakedPercentage: 100,
                currentDelegations: [],
                availableBalance: "1000000",
                denom
              }
            )).not.toThrow();
          }
        );
      }
    );

    describe(
      "delegation from available balance",
      () => {
        it(
          "should create delegate messages when starting with no delegations",
          () => {
            const messages = calculateRebalanceMessages(
              delegatorAddress,
              {
                validatorTargets: [
                  { validatorAddress: validator1,
                    percentage: 50 },
                  { validatorAddress: validator2,
                    percentage: 50 }
                ],
                preferredStakedPercentage: 100,
                currentDelegations: [],
                availableBalance: "1000000",
                denom
              }
            );

            expect(messages).toHaveLength(2);
            expect(messages.every((msg) => isMsgDelegate(msg))).toBe(true);

            const msg1 = messages[0].value as MsgDelegate;
            const msg2 = messages[1].value as MsgDelegate;

            expect(msg1.delegatorAddress).toBe(delegatorAddress);
            expect(msg1.amount?.denom).toBe(denom);
            expect(msg1.amount?.amount).toBe("500000");

            expect(msg2.delegatorAddress).toBe(delegatorAddress);
            expect(msg2.amount?.denom).toBe(denom);
            expect(msg2.amount?.amount).toBe("500000");
          }
        );

        it(
          "should delegate only the preferred staked percentage",
          () => {
            const messages = calculateRebalanceMessages(
              delegatorAddress,
              {
                validatorTargets: [
                  { validatorAddress: validator1,
                    percentage: 100 }
                ],
                preferredStakedPercentage: 80,
                currentDelegations: [],
                availableBalance: "1000000",
                denom
              }
            );

            expect(messages).toHaveLength(1);
            const msg = messages[0].value as MsgDelegate;
            expect(msg.amount?.amount).toBe("800000");
          }
        );
      }
    );

    describe(
      "redelegation",
      () => {
        it(
          "should redelegate from one validator to another",
          () => {
            const messages = calculateRebalanceMessages(
              delegatorAddress,
              {
                validatorTargets: [
                  { validatorAddress: validator1,
                    percentage: 0 },
                  { validatorAddress: validator2,
                    percentage: 100 }
                ],
                preferredStakedPercentage: 100,
                currentDelegations: [
                  { validatorAddress: validator1,
                    amount: "1000000" }
                ],
                availableBalance: "0",
                denom
              }
            );

            expect(messages).toHaveLength(1);
            expect(isMsgBeginRedelegate(messages[0])).toBe(true);

            const msg = messages[0].value as MsgBeginRedelegate;
            expect(msg.delegatorAddress).toBe(delegatorAddress);
            expect(msg.validatorSrcAddress).toBe(validator1);
            expect(msg.validatorDstAddress).toBe(validator2);
            expect(msg.amount?.amount).toBe("1000000");
            expect(msg.amount?.denom).toBe(denom);
          }
        );

        it(
          "should redelegate partial amounts to rebalance",
          () => {
            const messages = calculateRebalanceMessages(
              delegatorAddress,
              {
                validatorTargets: [
                  { validatorAddress: validator1,
                    percentage: 30 },
                  { validatorAddress: validator2,
                    percentage: 70 }
                ],
                preferredStakedPercentage: 100,
                currentDelegations: [
                  { validatorAddress: validator1,
                    amount: "1000000" }
                ],
                availableBalance: "0",
                denom
              }
            );

            expect(messages).toHaveLength(1);
            expect(isMsgBeginRedelegate(messages[0])).toBe(true);

            const msg = messages[0].value as MsgBeginRedelegate;
            expect(msg.validatorSrcAddress).toBe(validator1);
            expect(msg.validatorDstAddress).toBe(validator2);
            expect(msg.amount?.amount).toBe("700000");
          }
        );

        it(
          "should handle multiple redelegations",
          () => {
            const messages = calculateRebalanceMessages(
              delegatorAddress,
              {
                validatorTargets: [
                  { validatorAddress: validator1,
                    percentage: 33.33 },
                  { validatorAddress: validator2,
                    percentage: 33.33 },
                  { validatorAddress: validator3,
                    percentage: 33.34 }
                ],
                preferredStakedPercentage: 100,
                currentDelegations: [
                  { validatorAddress: validator1,
                    amount: "1000000" }
                ],
                availableBalance: "0",
                denom
              }
            );

            const redelegations = messages.filter((msg) => isMsgBeginRedelegate(msg));
            expect(redelegations.length).toBeGreaterThan(0);
          }
        );
      }
    );

    describe(
      "undelegation",
      () => {
        it(
          "should undelegate when reducing staked percentage",
          () => {
            const messages = calculateRebalanceMessages(
              delegatorAddress,
              {
                validatorTargets: [
                  { validatorAddress: validator1,
                    percentage: 100 }
                ],
                preferredStakedPercentage: 50,
                currentDelegations: [
                  { validatorAddress: validator1,
                    amount: "1000000" }
                ],
                availableBalance: "0",
                denom
              }
            );

            expect(messages).toHaveLength(1);
            expect(isMsgUndelegate(messages[0])).toBe(true);

            const msg = messages[0].value as MsgUndelegate;
            expect(msg.delegatorAddress).toBe(delegatorAddress);
            expect(msg.validatorAddress).toBe(validator1);
            expect(msg.amount?.amount).toBe("500000");
            expect(msg.amount?.denom).toBe(denom);
          }
        );

        it(
          "should redelegate from validator not in target list",
          () => {
            const messages = calculateRebalanceMessages(
              delegatorAddress,
              {
                validatorTargets: [
                  { validatorAddress: validator1,
                    percentage: 100 }
                ],
                preferredStakedPercentage: 100,
                currentDelegations: [
                  { validatorAddress: validator1,
                    amount: "500000" },
                  { validatorAddress: validator2,
                    amount: "500000" }
                ],
                availableBalance: "0",
                denom
              }
            );

            const redelegations = messages.filter((msg) => isMsgBeginRedelegate(msg));
            expect(redelegations.length).toBe(1);

            const redelegate = redelegations[0].value as MsgBeginRedelegate;
            expect(redelegate.validatorSrcAddress).toBe(validator2);
            expect(redelegate.validatorDstAddress).toBe(validator1);
            expect(redelegate.amount?.amount).toBe("500000");
          }
        );
      }
    );

    describe(
      "complex scenarios",
      () => {
        it(
          "should handle rebalancing with available balance",
          () => {
            const messages = calculateRebalanceMessages(
              delegatorAddress,
              {
                validatorTargets: [
                  { validatorAddress: validator1,
                    percentage: 50 },
                  { validatorAddress: validator2,
                    percentage: 50 }
                ],
                preferredStakedPercentage: 100,
                currentDelegations: [
                  { validatorAddress: validator1,
                    amount: "500000" }
                ],
                availableBalance: "500000",
                denom
              }
            );

            const delegations = messages.filter((msg) => isMsgDelegate(msg));
            expect(delegations.length).toBeGreaterThan(0);
          }
        );

        it(
          "should handle multiple validators with complex rebalancing",
          () => {
            const messages = calculateRebalanceMessages(
              delegatorAddress,
              {
                validatorTargets: [
                  { validatorAddress: validator1,
                    percentage: 25 },
                  { validatorAddress: validator2,
                    percentage: 25 },
                  { validatorAddress: validator3,
                    percentage: 50 }
                ],
                preferredStakedPercentage: 100,
                currentDelegations: [
                  { validatorAddress: validator1,
                    amount: "600000" },
                  { validatorAddress: validator2,
                    amount: "400000" }
                ],
                availableBalance: "0",
                denom
              }
            );

            expect(messages.length).toBeGreaterThan(0);

            // Should have redelegations to rebalance
            const redelegations = messages.filter((msg) => isMsgBeginRedelegate(msg));
            expect(redelegations.length).toBeGreaterThan(0);
          }
        );

        it(
          "should return no messages when already balanced",
          () => {
            const messages = calculateRebalanceMessages(
              delegatorAddress,
              {
                validatorTargets: [
                  { validatorAddress: validator1,
                    percentage: 50 },
                  { validatorAddress: validator2,
                    percentage: 50 }
                ],
                preferredStakedPercentage: 100,
                currentDelegations: [
                  { validatorAddress: validator1,
                    amount: "500000" },
                  { validatorAddress: validator2,
                    amount: "500000" }
                ],
                availableBalance: "0",
                denom
              }
            );

            expect(messages).toHaveLength(0);
          }
        );

        it(
          "should handle combination of redelegate and delegate operations",
          () => {
            const messages = calculateRebalanceMessages(
              delegatorAddress,
              {
                validatorTargets: [
                  { validatorAddress: validator1,
                    percentage: 25 },
                  { validatorAddress: validator2,
                    percentage: 75 }
                ],
                preferredStakedPercentage: 100,
                currentDelegations: [
                  { validatorAddress: validator1,
                    amount: "500000" }
                ],
                availableBalance: "500000",
                denom
              }
            );

            const redelegations = messages.filter((msg) => isMsgBeginRedelegate(msg));
            const delegations = messages.filter((msg) => isMsgDelegate(msg));

            // Should have both types of operations
            expect(redelegations.length).toBeGreaterThan(0);
            expect(delegations.length).toBeGreaterThan(0);
          }
        );

        it(
          "should handle combination of redelegate and undelegate operations",
          () => {
            const messages = calculateRebalanceMessages(
              delegatorAddress,
              {
                validatorTargets: [
                  { validatorAddress: validator2,
                    percentage: 100 }
                ],
                preferredStakedPercentage: 50,
                currentDelegations: [
                  { validatorAddress: validator1,
                    amount: "1000000" }
                ],
                availableBalance: "0",
                denom
              }
            );

            const redelegations = messages.filter((msg) => isMsgBeginRedelegate(msg));
            const undelegations = messages.filter((msg) => isMsgUndelegate(msg));

            expect(redelegations.length).toBeGreaterThan(0);
            expect(undelegations.length).toBeGreaterThan(0);
          }
        );
      }
    );

    describe(
      "edge cases",
      () => {
        it(
          "should handle zero available balance",
          () => {
            const messages = calculateRebalanceMessages(
              delegatorAddress,
              {
                validatorTargets: [
                  { validatorAddress: validator1,
                    percentage: 100 }
                ],
                preferredStakedPercentage: 100,
                currentDelegations: [
                  { validatorAddress: validator1,
                    amount: "1000000" }
                ],
                availableBalance: "0",
                denom
              }
            );

            expect(messages).toHaveLength(0);
          }
        );

        it(
          "should handle zero current delegations",
          () => {
            const messages = calculateRebalanceMessages(
              delegatorAddress,
              {
                validatorTargets: [
                  { validatorAddress: validator1,
                    percentage: 100 }
                ],
                preferredStakedPercentage: 100,
                currentDelegations: [],
                availableBalance: "1000000",
                denom
              }
            );

            expect(messages).toHaveLength(1);
            expect(isMsgDelegate(messages[0])).toBe(true);
          }
        );

        it(
          "should handle preferredStakedPercentage of 0",
          () => {
            const messages = calculateRebalanceMessages(
              delegatorAddress,
              {
                validatorTargets: [
                  { validatorAddress: validator1,
                    percentage: 100 }
                ],
                preferredStakedPercentage: 0,
                currentDelegations: [
                  { validatorAddress: validator1,
                    amount: "1000000" }
                ],
                availableBalance: "0",
                denom
              }
            );

            expect(messages).toHaveLength(1);
            expect(isMsgUndelegate(messages[0])).toBe(true);

            const msg = messages[0].value as MsgUndelegate;
            expect(msg.amount?.amount).toBe("1000000");
          }
        );

        it(
          "should handle large amounts",
          () => {
            const largeAmount = "1000000000000"; // 1 million tokens
            const messages = calculateRebalanceMessages(
              delegatorAddress,
              {
                validatorTargets: [
                  { validatorAddress: validator1,
                    percentage: 50 },
                  { validatorAddress: validator2,
                    percentage: 50 }
                ],
                preferredStakedPercentage: 100,
                currentDelegations: [],
                availableBalance: largeAmount,
                denom
              }
            );

            expect(messages).toHaveLength(2);
            const totalDelegated = messages.reduce(
              (sum, msg) => {
                const amount = (msg.value as MsgDelegate).amount?.amount || "0";
                return sum + BigInt(amount);
              },
              BigInt(0)
            );

            expect(totalDelegated).toBe(BigInt(largeAmount));
          }
        );

        it(
          "should handle fractional percentages correctly",
          () => {
            const messages = calculateRebalanceMessages(
              delegatorAddress,
              {
                validatorTargets: [
                  { validatorAddress: validator1,
                    percentage: 33.33 },
                  { validatorAddress: validator2,
                    percentage: 33.33 },
                  { validatorAddress: validator3,
                    percentage: 33.34 }
                ],
                preferredStakedPercentage: 100,
                currentDelegations: [],
                availableBalance: "1000000",
                denom
              }
            );

            expect(messages).toHaveLength(3);

            const totalDelegated = messages.reduce(
              (sum, msg) => {
                const amount = (msg.value as MsgDelegate).amount?.amount || "0";
                return sum + BigInt(amount);
              },
              BigInt(0)
            );

            // Total should be close to 1000000 (allowing for rounding)
            expect(totalDelegated).toBeLessThanOrEqual(BigInt("1000000"));
            expect(totalDelegated).toBeGreaterThan(BigInt("999000"));
          }
        );

        it(
          "should handle single validator target",
          () => {
            const messages = calculateRebalanceMessages(
              delegatorAddress,
              {
                validatorTargets: [
                  { validatorAddress: validator1,
                    percentage: 100 }
                ],
                preferredStakedPercentage: 100,
                currentDelegations: [],
                availableBalance: "1000000",
                denom
              }
            );

            expect(messages).toHaveLength(1);
            expect(isMsgDelegate(messages[0])).toBe(true);

            const msg = messages[0].value as MsgDelegate;
            expect(msg.validatorAddress).toBe(validator1);
            expect(msg.amount?.amount).toBe("1000000");
          }
        );
      }
    );

    describe(
      "message structure verification",
      () => {
        it(
          "should create properly formatted MsgDelegate",
          () => {
            const messages = calculateRebalanceMessages(
              delegatorAddress,
              {
                validatorTargets: [
                  { validatorAddress: validator1,
                    percentage: 100 }
                ],
                preferredStakedPercentage: 100,
                currentDelegations: [],
                availableBalance: "1000000",
                denom
              }
            );

            const msg = messages[0].value as MsgDelegate;
            expect(msg).toHaveProperty("delegatorAddress");
            expect(msg).toHaveProperty("validatorAddress");
            expect(msg).toHaveProperty("amount");
            expect(msg.amount).toHaveProperty("denom");
            expect(msg.amount).toHaveProperty("amount");
          }
        );

        it(
          "should create properly formatted MsgBeginRedelegate",
          () => {
            const messages = calculateRebalanceMessages(
              delegatorAddress,
              {
                validatorTargets: [
                  { validatorAddress: validator2,
                    percentage: 100 }
                ],
                preferredStakedPercentage: 100,
                currentDelegations: [
                  { validatorAddress: validator1,
                    amount: "1000000" }
                ],
                availableBalance: "0",
                denom
              }
            );

            const msg = messages[0].value as MsgBeginRedelegate;
            expect(msg).toHaveProperty("delegatorAddress");
            expect(msg).toHaveProperty("validatorSrcAddress");
            expect(msg).toHaveProperty("validatorDstAddress");
            expect(msg).toHaveProperty("amount");
            expect(msg.amount).toHaveProperty("denom");
            expect(msg.amount).toHaveProperty("amount");
          }
        );

        it(
          "should create properly formatted MsgUndelegate",
          () => {
            const messages = calculateRebalanceMessages(
              delegatorAddress,
              {
                validatorTargets: [
                  { validatorAddress: validator1,
                    percentage: 100 }
                ],
                preferredStakedPercentage: 50,
                currentDelegations: [
                  { validatorAddress: validator1,
                    amount: "1000000" }
                ],
                availableBalance: "0",
                denom
              }
            );

            const msg = messages[0].value as MsgUndelegate;
            expect(msg).toHaveProperty("delegatorAddress");
            expect(msg).toHaveProperty("validatorAddress");
            expect(msg).toHaveProperty("amount");
            expect(msg.amount).toHaveProperty("denom");
            expect(msg.amount).toHaveProperty("amount");
          }
        );
      }
    );

    describe(
      "random delegation scenarios with manual state verification",
      () => {
        it(
          "should correctly rebalance random scenario 1: complex multi-validator rebalance",
          () => {
            // Random scenario 1: Multiple validators with imbalanced delegations
            const validator4 = "atonevaloper4";
            const validator5 = "atonevaloper5";

            const targetPercentages = [
              { percentage: 25,
                validatorAddress: validator1 },
              { percentage: 35,
                validatorAddress: validator2 },
              { percentage: 20,
                validatorAddress: validator3 },
              { percentage: 20,
                validatorAddress: validator4 }
            ];

            const currentDelegations = [
              { amount: "500000",
                validatorAddress: validator1 },
              { amount: "100000",
                validatorAddress: validator2 },
              { amount: "300000",
                validatorAddress: validator5 } // Not in target list
            ];

            const availableBalance = "600000";
            const preferredStakedPercentage = 90;

            // Calculate expected values
            const totalBalance =
              BigInt("500000") + BigInt("100000") + BigInt("300000") + BigInt("600000");
            const targetTotalStaked = totalBalance * BigInt(90) / BigInt(100);

            const expectedTargets = new Map([
              [
                validator1,
                targetTotalStaked * BigInt(25) / BigInt(100)
              ],
              [
                validator2,
                targetTotalStaked * BigInt(35) / BigInt(100)
              ],
              [
                validator3,
                targetTotalStaked * BigInt(20) / BigInt(100)
              ],
              [
                validator4,
                targetTotalStaked * BigInt(20) / BigInt(100)
              ]
            ]);

            // Run rebalance
            const messages = calculateRebalanceMessages(
              delegatorAddress,
              {
                availableBalance,
                currentDelegations,
                denom,
                preferredStakedPercentage,
                validatorTargets: targetPercentages
              }
            );

            // Simulate state transitions
            const { finalBalance, finalDelegations } = simulateStateTransitions(
              currentDelegations,
              availableBalance,
              messages
            );

            // Verify final state matches expected targets
            for (const [
              validator,
              expectedAmount
            ] of expectedTargets) {
              const actualAmount = finalDelegations.get(validator) || BigInt(0);
              // Allow for small rounding errors (< 2 tokens)
              expect(actualAmount).toBeGreaterThanOrEqual(expectedAmount - BigInt(2));
              expect(actualAmount).toBeLessThanOrEqual(expectedAmount + BigInt(2));
            }

            // Verify validator5 (not in target list) has been completely removed
            expect(finalDelegations.get(validator5) || BigInt(0)).toBe(BigInt(0));

            // Verify total staked matches target
            const totalStaked = Array.from(finalDelegations.values()).reduce(
              (sum, amount) => sum + amount,
              BigInt(0)
            );
            expect(totalStaked).toBeGreaterThanOrEqual(targetTotalStaked - BigInt(5));
            expect(totalStaked).toBeLessThanOrEqual(targetTotalStaked + BigInt(5));

            // Verify balance is correct
            const expectedBalance = totalBalance - totalStaked;
            expect(finalBalance).toBeGreaterThanOrEqual(expectedBalance - BigInt(5));
            expect(finalBalance).toBeLessThanOrEqual(expectedBalance + BigInt(5));

            // Verify no negative amounts
            for (const amount of finalDelegations.values()) {
              expect(amount).toBeGreaterThanOrEqual(BigInt(0));
            }
            expect(finalBalance).toBeGreaterThanOrEqual(BigInt(0));
          }
        );

        it(
          "should correctly rebalance random scenario 2: heavy redelegation scenario",
          () => {
            // Random scenario 2: Complete redistribution from one validator to many
            const validator4 = "atonevaloper4";
            const validator5 = "atonevaloper5";
            const validator6 = "atonevaloper6";

            const targetPercentages = [
              { percentage: 15,
                validatorAddress: validator1 },
              { percentage: 25,
                validatorAddress: validator2 },
              { percentage: 30,
                validatorAddress: validator3 },
              { percentage: 18,
                validatorAddress: validator4 },
              { percentage: 12,
                validatorAddress: validator5 }
            ];

            const currentDelegations = [
              { amount: "8500000",
                validatorAddress: validator6 }, // 100% on one validator not in targets
              { amount: "1500000",
                validatorAddress: validator2 }
            ];

            const availableBalance = "0";
            const preferredStakedPercentage = 100;

            // Calculate expected values
            const totalBalance = BigInt("8500000") + BigInt("1500000");
            const targetTotalStaked = totalBalance; // 100% staked

            const expectedTargets = new Map([
              [
                validator1,
                targetTotalStaked * BigInt(15) / BigInt(100)
              ],
              [
                validator2,
                targetTotalStaked * BigInt(25) / BigInt(100)
              ],
              [
                validator3,
                targetTotalStaked * BigInt(30) / BigInt(100)
              ],
              [
                validator4,
                targetTotalStaked * BigInt(18) / BigInt(100)
              ],
              [
                validator5,
                targetTotalStaked * BigInt(12) / BigInt(100)
              ]
            ]);

            // Run rebalance
            const messages = calculateRebalanceMessages(
              delegatorAddress,
              {
                availableBalance,
                currentDelegations,
                denom,
                preferredStakedPercentage,
                validatorTargets: targetPercentages
              }
            );

            // Should be mostly redelegations
            const redelegations = messages.filter((msg) => isMsgBeginRedelegate(msg));
            expect(redelegations.length).toBeGreaterThan(0);

            // Simulate state transitions
            const { finalBalance, finalDelegations } = simulateStateTransitions(
              currentDelegations,
              availableBalance,
              messages
            );

            // Verify final state matches expected targets
            for (const [
              validator,
              expectedAmount
            ] of expectedTargets) {
              const actualAmount = finalDelegations.get(validator) || BigInt(0);
              // Allow for small rounding errors
              expect(actualAmount).toBeGreaterThanOrEqual(expectedAmount - BigInt(2));
              expect(actualAmount).toBeLessThanOrEqual(expectedAmount + BigInt(2));
            }

            // Verify validator6 has been completely removed
            expect(finalDelegations.get(validator6) || BigInt(0)).toBe(BigInt(0));

            // Verify total staked matches target
            const totalStaked = Array.from(finalDelegations.values()).reduce(
              (sum, amount) => sum + amount,
              BigInt(0)
            );
            expect(totalStaked).toBeGreaterThanOrEqual(targetTotalStaked - BigInt(5));
            expect(totalStaked).toBeLessThanOrEqual(targetTotalStaked + BigInt(5));

            // Verify balance unchanged (should be 0)
            expect(finalBalance).toBe(BigInt(0));
          }
        );

        it(
          "should correctly rebalance random scenario 3: mixed operations with partial unstaking",
          () => {
            // Random scenario 3: Need delegation, redelegation, and undelegation
            const validator4 = "atonevaloper4";

            const targetPercentages = [
              { percentage: 40,
                validatorAddress: validator1 },
              { percentage: 30,
                validatorAddress: validator2 },
              { percentage: 30,
                validatorAddress: validator4 }
            ];

            const currentDelegations = [
              { amount: "3000000",
                validatorAddress: validator1 },
              { amount: "4000000",
                validatorAddress: validator2 },
              { amount: "3000000",
                validatorAddress: validator3 } // Not in target
            ];

            const availableBalance = "2000000";
            const preferredStakedPercentage = 75; // Only stake 75%

            // Calculate expected values
            const totalBalance =
              BigInt("3000000") +
              BigInt("4000000") +
              BigInt("3000000") +
              BigInt("2000000");
            const targetTotalStaked = totalBalance * BigInt(75) / BigInt(100);

            const expectedTargets = new Map([
              [
                validator1,
                targetTotalStaked * BigInt(40) / BigInt(100)
              ],
              [
                validator2,
                targetTotalStaked * BigInt(30) / BigInt(100)
              ],
              [
                validator4,
                targetTotalStaked * BigInt(30) / BigInt(100)
              ]
            ]);

            // Run rebalance
            const messages = calculateRebalanceMessages(
              delegatorAddress,
              {
                availableBalance,
                currentDelegations,
                denom,
                preferredStakedPercentage,
                validatorTargets: targetPercentages
              }
            );

            // Verify we have multiple types of operations
            expect(messages.length).toBeGreaterThan(0);

            // Simulate state transitions
            const { finalBalance, finalDelegations } = simulateStateTransitions(
              currentDelegations,
              availableBalance,
              messages
            );

            // Verify final state matches expected targets
            for (const [
              validator,
              expectedAmount
            ] of expectedTargets) {
              const actualAmount = finalDelegations.get(validator) || BigInt(0);
              // Allow for small rounding errors
              expect(actualAmount).toBeGreaterThanOrEqual(expectedAmount - BigInt(2));
              expect(actualAmount).toBeLessThanOrEqual(expectedAmount + BigInt(2));
            }

            // Verify validator3 has been removed
            expect(finalDelegations.get(validator3) || BigInt(0)).toBe(BigInt(0));

            // Verify total staked matches target
            const totalStaked = Array.from(finalDelegations.values()).reduce(
              (sum, amount) => sum + amount,
              BigInt(0)
            );
            expect(totalStaked).toBeGreaterThanOrEqual(targetTotalStaked - BigInt(5));
            expect(totalStaked).toBeLessThanOrEqual(targetTotalStaked + BigInt(5));

            // Verify balance is correct (25% of total)
            const expectedBalance = totalBalance - totalStaked;
            expect(finalBalance).toBeGreaterThanOrEqual(expectedBalance - BigInt(5));
            expect(finalBalance).toBeLessThanOrEqual(expectedBalance + BigInt(5));

            // Balance should be approximately 25% of total
            const balancePercentage = finalBalance * BigInt(100) / totalBalance;
            expect(balancePercentage).toBeGreaterThanOrEqual(BigInt(24));
            expect(balancePercentage).toBeLessThanOrEqual(BigInt(26));
          }
        );
      }
    );
  }
);
